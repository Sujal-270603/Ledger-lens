// src/modules/ai-processing/ai-processing.service.ts
import { aiProcessingRepository } from './ai-processing.repository';
import { invoicesRepository } from '../invoices/invoices.repository';
import { sendDocumentProcessingMessage } from '../../shared/sqs';
import {
  AIProcessingStatus,
  AIStatusResponse,
  ExtractionPreviewResponse,
  AcceptExtractionInput
} from './ai-processing.types';
import { InvoiceResponse } from '../invoices/invoices.types';
import { NotFoundError, UnprocessableError, ForbiddenError } from '../../errors';
import { InvoiceStatus } from '../../types/prisma';
import { documentsRepository } from '../documents/documents.repository';
import { isAdminRole, getAssignedClientIds } from '../../shared/access';

const LOW_CONFIDENCE_THRESHOLD = 0.75;

interface ParsedAIMetadata {
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  processingFailedAt: Date | null;
  textractConfidence: number | null;
  llmConfidence: number | null;
  rawExtraction: any | null;
  errorMessage: string | null;
  retryCount: number;
}

export class AIProcessingService {
  private async getAccessFilter(
    userId: string,
    userRole: string
  ): Promise<string[] | null> {
    if (isAdminRole(userRole)) return null;
    return getAssignedClientIds(userId);
  }

  private deriveAIStatus(invoice: any): AIProcessingStatus {
    if (!invoice) return AIProcessingStatus.PENDING;
    if (invoice.status === InvoiceStatus.FAILED) return AIProcessingStatus.FAILED;
    
    if (invoice.aiMetadata && typeof invoice.aiMetadata === 'object') {
      if ('processingCompletedAt' in invoice.aiMetadata && invoice.aiMetadata.processingCompletedAt) {
        return AIProcessingStatus.COMPLETED;
      }
      if ('processingStartedAt' in invoice.aiMetadata && invoice.aiMetadata.processingStartedAt) {
        return AIProcessingStatus.PROCESSING;
      }
    }
    
    return AIProcessingStatus.PENDING;
  }

  private extractAIMetadata(aiMetadata: unknown): ParsedAIMetadata {
    const defaults: ParsedAIMetadata = {
      processingStartedAt: null,
      processingCompletedAt: null,
      processingFailedAt: null,
      textractConfidence: null,
      llmConfidence: null,
      rawExtraction: null,
      errorMessage: null,
      retryCount: 0
    };

    if (!aiMetadata || typeof aiMetadata !== 'object') {
      return defaults;
    }

    try {
      const meta = aiMetadata as any;
      return {
        processingStartedAt: meta.processingStartedAt ? new Date(meta.processingStartedAt) : null,
        processingCompletedAt: meta.processingCompletedAt ? new Date(meta.processingCompletedAt) : null,
        processingFailedAt: meta.processingFailedAt ? new Date(meta.processingFailedAt) : null,
        textractConfidence: typeof meta.textractConfidence === 'number' ? meta.textractConfidence : null,
        llmConfidence: typeof meta.llmConfidence === 'number' ? meta.llmConfidence : null,
        rawExtraction: meta.rawExtraction || null,
        errorMessage: typeof meta.errorMessage === 'string' ? meta.errorMessage : null,
        retryCount: typeof meta.retryCount === 'number' ? meta.retryCount : 0
      };
    } catch {
      return defaults;
    }
  }

  async getAIStatus(
    documentId: string, 
    organizationId: string, 
    userId: string, 
    userRole: string
  ): Promise<AIStatusResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const doc = await aiProcessingRepository.findDocumentByIdAndOrg(documentId, organizationId, userId, accessFilter);
    if (!doc) throw new NotFoundError('Document');

    const invoice = doc.invoices?.[0] || null;
    const processingStatus = this.deriveAIStatus(invoice);
    const meta = this.extractAIMetadata(invoice?.aiMetadata);

    const confidenceScore = invoice?.confidenceScore ?? meta.llmConfidence ?? null;
    const isLowConfidence = confidenceScore !== null && confidenceScore < LOW_CONFIDENCE_THRESHOLD;

    return {
      documentId,
      processingStatus,
      invoiceId: invoice?.id || null,
      confidenceScore,
      isLowConfidence,
      processingStartedAt: meta.processingStartedAt,
      processingCompletedAt: meta.processingCompletedAt,
      processingFailedAt: meta.processingFailedAt,
      errorMessage: meta.errorMessage,
      retryCount: meta.retryCount,
      extractionNotes: meta.rawExtraction?.extractionNotes || null
    };
  }

  async reprocessDocument(
    documentId: string, 
    organizationId: string, 
    userId: string,
    userRole: string
  ): Promise<{ message: string }> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const doc = await aiProcessingRepository.findDocumentByIdAndOrg(documentId, organizationId, userId, accessFilter);
    if (!doc) throw new NotFoundError('Document');

    const invoice = doc.invoices?.[0];
    if (invoice && invoice.status !== InvoiceStatus.FAILED) {
      throw new UnprocessableError('Document can only be reprocessed if processing has failed.');
    }

    const quota = await documentsRepository.findUsageQuota(organizationId);
    if (!quota) {
      throw new UnprocessableError('Usage quota not configured for this organization');
    }

    if (quota.invoicesProcessed >= quota.invoicesLimit) {
      throw new UnprocessableError('Invoice processing limit reached.');
    }

    await documentsRepository.incrementQuotaUsage(organizationId);

    if (invoice) {
      const existingMeta = invoice.aiMetadata as any || {};
      const newMeta = {
        ...existingMeta,
        retryCount: (existingMeta.retryCount || 0) + 1,
        processingFailedAt: null,
        errorMessage: null,
        processingStartedAt: new Date().toISOString()
      };
      await aiProcessingRepository.updateInvoiceAIMetadata(invoice.id, newMeta, InvoiceStatus.DRAFT);
    }

    await sendDocumentProcessingMessage({
      documentId,
      organizationId,
      s3Key: doc.s3Key,
      mimeType: doc.mimeType
    });

    await aiProcessingRepository.createAuditLog({
      userId,
      action: 'REPROCESS_DOCUMENT',
      resource: 'DOCUMENT',
      details: { documentId, invoiceId: invoice?.id }
    });

    return { message: 'Document queued for reprocessing.' };
  }

  async getExtractionPreview(
    documentId: string, 
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<ExtractionPreviewResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const doc = await aiProcessingRepository.findDocumentByIdAndOrg(documentId, organizationId, userId, accessFilter);
    if (!doc) throw new NotFoundError('Document');

    const invoice = doc.invoices?.[0];
    if (!invoice || !invoice.aiMetadata) {
      throw new UnprocessableError('No extraction data available for this document.');
    }

    const meta = this.extractAIMetadata(invoice.aiMetadata);
    if (!meta.rawExtraction) {
      throw new UnprocessableError('No extraction data available for this document.');
    }

    const confidenceScore = invoice.confidenceScore ?? meta.llmConfidence ?? 0;
    const isLowConfidence = confidenceScore < LOW_CONFIDENCE_THRESHOLD;

    return {
      documentId,
      invoiceId: invoice.id,
      rawExtraction: meta.rawExtraction,
      confidenceScore,
      isLowConfidence,
      extractionNotes: meta.rawExtraction.extractionNotes || null
    };
  }

  async acceptExtraction(
    documentId: string,
    organizationId: string,
    userId: string,
    userRole: string,
    input: AcceptExtractionInput
  ): Promise<InvoiceResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const doc = await aiProcessingRepository.findDocumentByIdAndOrg(documentId, organizationId, userId, accessFilter);
    if (!doc) throw new NotFoundError('Document');

    const invoice = doc.invoices?.[0];
    if (!invoice) {
      throw new UnprocessableError('No extraction available to accept.');
    }

    if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.FAILED) {
      throw new UnprocessableError('Extraction can only be accepted for DRAFT or FAILED invoices.');
    }

    const updateData: any = {
      status: InvoiceStatus.DRAFT
    };

    if (input.overrides) {
      if (input.overrides.invoiceNumber !== undefined) updateData.invoiceNumber = input.overrides.invoiceNumber;
      if (input.overrides.invoiceDate !== undefined) updateData.invoiceDate = new Date(input.overrides.invoiceDate);
      
      if (input.overrides.clientId !== undefined) {
        // Validate override clientId
        if (accessFilter !== null && !accessFilter.includes(input.overrides.clientId)) {
          throw new UnprocessableError('You are not authorized to assign this invoice to the specified client.');
        }
        updateData.clientId = input.overrides.clientId;
      }
      
      if (input.overrides.totalAmount !== undefined) updateData.totalAmount = input.overrides.totalAmount;
      if (input.overrides.gstAmount !== undefined) updateData.gstAmount = input.overrides.gstAmount;
      if (input.overrides.cgstAmount !== undefined) updateData.cgstAmount = input.overrides.cgstAmount;
      if (input.overrides.sgstAmount !== undefined) updateData.sgstAmount = input.overrides.sgstAmount;
      if (input.overrides.igstAmount !== undefined) updateData.igstAmount = input.overrides.igstAmount;
    }

    await aiProcessingRepository.updateInvoiceFromAcceptedExtraction(invoice.id, organizationId, updateData);

    await aiProcessingRepository.createAuditLog({
      userId,
      action: 'ACCEPT_EXTRACTION',
      resource: 'INVOICE',
      details: {
        documentId,
        invoiceId: invoice.id,
        overridesApplied: Object.keys(input.overrides || {})
      }
    });

    const fullInvoice = await invoicesRepository.findInvoiceByIdAndOrg(invoice.id, organizationId);
    if (!fullInvoice) throw new NotFoundError('Invoice');

    return {
      id: fullInvoice.id,
      invoiceNumber: fullInvoice.invoiceNumber,
      invoiceDate: fullInvoice.invoiceDate,
      totalAmount: fullInvoice.totalAmount.toString(),
      gstAmount: fullInvoice.gstAmount.toString(),
      cgstAmount: fullInvoice.cgstAmount?.toString() || null,
      sgstAmount: fullInvoice.sgstAmount?.toString() || null,
      igstAmount: fullInvoice.igstAmount?.toString() || null,
      status: fullInvoice.status as InvoiceStatus,
      syncStatus: fullInvoice.syncStatus,
      confidenceScore: fullInvoice.confidenceScore,
      organizationId: fullInvoice.organizationId,
      clientId: fullInvoice.clientId,
      documentId: fullInvoice.documentId,
      client: fullInvoice.client ? {
        id: fullInvoice.client.id,
        name: fullInvoice.client.name,
        gstin: fullInvoice.client.gstin
      } : null,
      items: fullInvoice.items.map((item: any) => ({
        id: item.id,
        description: item.description,
        hsnCode: item.hsnCode,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        amount: item.amount.toString(),
        taxRate: item.taxRate.toString(),
        ledgerId: item.ledgerId,
        creditLedgerId: item.creditLedgerId,
        ledger: item.ledger ? {
          id: item.ledger.id,
          name: item.ledger.name
        } : undefined,
        creditLedger: item.creditLedger ? {
          id: item.creditLedger.id,
          name: item.creditLedger.name
        } : undefined
      })),
      submittedAt: fullInvoice.submittedAt,
      approvedAt: fullInvoice.approvedAt,
      rejectedAt: fullInvoice.rejectedAt,
      rejectionReason: fullInvoice.rejectionReason,
      reopenedAt: fullInvoice.reopenedAt,
      reopenReason: fullInvoice.reopenReason,
      createdAt: fullInvoice.createdAt,
      updatedAt: fullInvoice.updatedAt
    };
  }
}

export const aiProcessingService = new AIProcessingService();
