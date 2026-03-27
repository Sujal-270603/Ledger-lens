import { Worker, Job } from 'bullmq';
import { prisma } from '../database/db';
import { redisConfig } from '../database/redis';
import { extractTextFromDocument } from '../shared/textract';
import { structureInvoiceData } from '../shared/llm';
import { calculateConfidence } from '../utils/validation';
import { INVOICE_QUEUE_NAME } from '../queues/invoice.queue';
import pino from 'pino';

const logger = pino({ name: 'worker-invoice' });

interface InvoiceJobData {
  invoiceId: string;
  s3Key: string;
  organizationId: string;
}

export const invoiceWorker = new Worker<InvoiceJobData>(
  INVOICE_QUEUE_NAME,
  async (job: Job<InvoiceJobData>) => {
    const { invoiceId, s3Key, organizationId } = job.data;
    logger.info(`Processing invoice ${invoiceId}`);

    try {
      // 1. Extract Text
      const s3Bucket = process.env.AWS_S3_BUCKET || '';
      const textractResult = await extractTextFromDocument({ s3Key, s3Bucket });
      const text = textractResult.rawText;
      if (!text) throw new Error('No text extracted from document');

      // 2. Parse with AI
      const aiData = await structureInvoiceData({
        rawText: text,
        organizationId,
        documentId: invoiceId,
      });

      // 3. Validation & Confidence
      const confidence = aiData.confidenceScore ? Math.round(aiData.confidenceScore * 100) : calculateConfidence(aiData);
      const status = confidence > 80 ? 'COMPLETED' : 'REVIEW_REQUIRED';

      // 4. Save to DB
      await prisma.$transaction(async (tx) => {
        // Update Invoice
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            invoiceNumber: aiData.invoiceNumber || 'UNKNOWN',
            invoiceDate: aiData.invoiceDate ? new Date(aiData.invoiceDate) : new Date(),
            totalAmount: aiData.totalAmount || 0,
            gstAmount: aiData.gstAmount || 0,
            status: status as any,
            confidenceScore: confidence,
            aiMetadata: aiData as any,
            clientId: undefined, // Logic to find/create client would go here
          },
        });

        // Create Items
        if (aiData.items && Array.isArray(aiData.items)) {
          await tx.invoiceItem.createMany({
            data: aiData.items.map((item: any) => ({
              invoiceId,
              description: item.description || 'Item',
              hsnCode: item.hsnCode,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              amount: item.amount || 0,
              taxRate: item.taxRate || 0,
            })),
          });
        }
        
        // Update Quota
        await tx.usageQuota.update({
          where: { organizationId },
          data: {
            invoicesProcessed: { increment: 1 },
          },
        });
      });

      logger.info(`Invoice ${invoiceId} processed successfully with confidence ${confidence}`);
      return { success: true, invoiceId };

    } catch (error: any) {
      logger.error(`Failed to process invoice ${invoiceId}: ${error.message}`);
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  },
  {
    connection: redisConfig,
    concurrency: 5,
  }
);

invoiceWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

invoiceWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed: ${err.message}`);
});
