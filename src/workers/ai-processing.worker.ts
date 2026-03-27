// src/workers/ai-processing.worker.ts
import { receiveMessages, deleteMessage } from '../shared/sqs';
import { extractTextFromDocument } from '../shared/textract';
import { structureInvoiceData } from '../shared/llm';
import { aiProcessingRepository } from '../modules/ai-processing/ai-processing.repository';
import { logger } from '../common/logger/logger';
import { InvoiceStatus } from '../types/prisma';

const LOW_CONFIDENCE_THRESHOLD = 0.75;

export interface WorkerProcessingResult {
  success: boolean;
  documentId: string;
  invoiceId?: string;
  error?: string;
}

const processMessage = async (message: any): Promise<WorkerProcessingResult> => {
  if (!message.Body) {
    return { success: false, documentId: 'unknown', error: 'Empty message body' };
  }

  let payload: any;
  try {
    payload = JSON.parse(message.Body);
  } catch (err) {
    logger.error({ err, messageId: message.MessageId }, 'Failed to parse SQS message body');
    return { success: false, documentId: 'unknown', error: 'Invalid JSON body' };
  }

  const { documentId, organizationId, s3Key } = payload;
  if (!documentId || !organizationId || !s3Key) {
    logger.error({ payload }, 'Invalid message payload: missing required fields');
    return { success: false, documentId: documentId || 'unknown', error: 'Missing required payload fields' };
  }

  try {
    const doc = await aiProcessingRepository.findDocumentById(documentId);
    if (!doc) {
      logger.warn({ documentId }, 'Document not found in DB');
      return { success: false, documentId, error: 'Document not found' };
    }

    const invoice = doc.invoices && doc.invoices.length > 0 ? doc.invoices[0] : null;

    if (invoice) {
      const existingMetadata = invoice.aiMetadata as any || {};
      await aiProcessingRepository.updateInvoiceAIMetadata(invoice.id, {
        ...existingMetadata,
        processingStartedAt: new Date().toISOString(),
        processingFailedAt: null,
        errorMessage: null,
      });
    } else {
      logger.info({ documentId }, 'Document processing started, no existing invoice yet.');
    }
    
    const s3Bucket = process.env.AWS_S3_BUCKET;
    if (!s3Bucket) {
      throw new Error('AWS_S3_BUCKET environment variable is not set');
    }

    const textractResult = await extractTextFromDocument({ s3Key, s3Bucket });
    logger.info({ documentId, confidence: textractResult.confidence }, 'Textract extraction complete');

    const extraction = await structureInvoiceData({
      rawText: textractResult.rawText,
      organizationId,
      documentId,
    });
    logger.info({ documentId, llmConfidence: extraction.confidenceScore }, 'LLM structuring complete');

    if (!extraction.invoiceNumber) {
      extraction.invoiceNumber = `AUTO-${documentId.slice(0, 8)}`;
    }
    if (!extraction.invoiceDate) {
      extraction.invoiceDate = new Date().toISOString().split('T')[0];
    }
    if (extraction.totalAmount === null || extraction.totalAmount === undefined) {
      extraction.totalAmount = 0;
    }
    if (!extraction.items || extraction.items.length === 0) {
      extraction.items = [{
        description: 'Unrecognized item — please update',
        hsnCode: null,
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        taxRate: 0
      }];
    }

    let client = null;
    if (extraction.vendorName || extraction.vendorGstin) {
      client = await aiProcessingRepository.findOrCreateClientByName(
        extraction.vendorName || 'Unknown Vendor',
        extraction.vendorGstin,
        organizationId
      );
    }

    const aiMetadata = {
      processingStartedAt: invoice ? (invoice.aiMetadata as any)?.processingStartedAt : undefined,
      processingCompletedAt: new Date().toISOString(),
      textractConfidence: textractResult.confidence,
      llmConfidence: extraction.confidenceScore,
      rawExtraction: extraction,
      extractionNotes: extraction.extractionNotes,
      retryCount: invoice ? (invoice.aiMetadata as any)?.retryCount || 0 : 0,
    };

    let savedInvoice;
    if (!invoice) {
      savedInvoice = await aiProcessingRepository.createInvoiceFromExtraction({
        organizationId,
        documentId,
        invoiceNumber: extraction.invoiceNumber,
        invoiceDate: new Date(extraction.invoiceDate),
        totalAmount: extraction.totalAmount,
        gstAmount: extraction.gstAmount || 0,
        cgstAmount: extraction.cgstAmount || undefined,
        sgstAmount: extraction.sgstAmount || undefined,
        igstAmount: extraction.igstAmount || undefined,
        confidenceScore: extraction.confidenceScore,
        aiMetadata,
        items: extraction.items.map(i => ({
          description: i.description,
          hsnCode: i.hsnCode,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount,
          taxRate: i.taxRate
        })),
        clientId: client?.id,
      });
    } else {
      savedInvoice = await aiProcessingRepository.updateInvoiceFromAcceptedExtraction(invoice.id, organizationId, {
        invoiceNumber: extraction.invoiceNumber,
        invoiceDate: new Date(extraction.invoiceDate),
        totalAmount: extraction.totalAmount,
        gstAmount: extraction.gstAmount || 0,
        cgstAmount: extraction.cgstAmount || undefined,
        sgstAmount: extraction.sgstAmount || undefined,
        igstAmount: extraction.igstAmount || undefined,
        clientId: client?.id,
        status: InvoiceStatus.DRAFT,
      });

      await aiProcessingRepository.updateInvoiceAIMetadata(invoice.id, aiMetadata);

      // Recreate items (we can't update them directly via updateInvoiceFromAcceptedExtraction)
      const { prisma } = await import('../database/db');
      await prisma.$transaction(async (tx) => {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.invoiceItem.createMany({
          data: extraction.items.map(i => ({
            description: i.description,
            hsnCode: i.hsnCode,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            amount: i.amount,
            taxRate: i.taxRate,
            invoiceId: invoice.id
          }))
        });
      });
    }

    await aiProcessingRepository.createAuditLog({
      action: 'AI_PROCESSING_COMPLETED',
      resource: 'INVOICE',
      details: {
        documentId,
        invoiceId: savedInvoice.id,
        confidenceScore: extraction.confidenceScore,
        isLowConfidence: extraction.confidenceScore < LOW_CONFIDENCE_THRESHOLD,
        textractConfidence: textractResult.confidence,
      }
    });

    return { success: true, documentId, invoiceId: savedInvoice.id };

  } catch (error: any) {
    logger.error({ error, documentId }, 'AI processing failed');

    try {
      const doc = await aiProcessingRepository.findDocumentById(documentId);
      const invoice = doc?.invoices?.[0];

      if (invoice) {
        const existingMetadata = invoice.aiMetadata as any || {};
        await aiProcessingRepository.updateInvoiceAIMetadata(invoice.id, {
          ...existingMetadata,
          processingFailedAt: new Date().toISOString(),
          errorMessage: error.message || 'Unknown error',
        }, InvoiceStatus.FAILED);
      } else if (doc) {
        await aiProcessingRepository.createInvoiceFromExtraction({
          organizationId,
          documentId,
          invoiceNumber: `FAILED-${documentId.slice(0, 8)}`,
          invoiceDate: new Date(),
          totalAmount: 0,
          gstAmount: 0,
          confidenceScore: 0,
          aiMetadata: {
            processingFailedAt: new Date().toISOString(),
            errorMessage: error.message || 'Unknown error',
            retryCount: 0
          },
          items: [],
          status: InvoiceStatus.FAILED
        });
      }

      await aiProcessingRepository.createAuditLog({
        action: 'AI_PROCESSING_FAILED',
        resource: 'INVOICE',
        details: { documentId, errorMessage: error.message || 'Unknown error' }
      });
    } catch (fallbackError) {
      logger.error({ error: fallbackError, documentId }, 'Failed to record AI processing failure in DB');
    }

    throw error;
  }
};

let isShuttingDown = false;

export async function startAIProcessingWorker(): Promise<void> {
  logger.info('AI Processing Worker started');

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down worker gracefully...');
    isShuttingDown = true;
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down worker gracefully...');
    isShuttingDown = true;
  });

  while (!isShuttingDown) {
    try {
      const messages = await receiveMessages(5);

      if (messages.length === 0) {
        // No messages — receiveMessages already waited 20s (long polling)
        // Loop immediately back to poll again
        continue;
      }

      if (messages.length > 0) {
        for (const message of messages) {
          try {
            await processMessage(message);
            if (message.ReceiptHandle) {
              await deleteMessage(message.ReceiptHandle);
            }
          } catch (processError) {
            // Error is already logged in processMessage, and message is not deleted so SQS will retry
            // Continue with next message
            logger.error({ err: processError }, 'SQS polling error — retrying in 5s');
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Error in SQS polling loop');
      // Wait a bit before retrying on polling errors to prevent tight loops
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  logger.info('AI Processing Worker shut down.');
}
