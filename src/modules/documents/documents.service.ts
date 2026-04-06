// src/modules/documents/documents.service.ts
import { documentsRepository } from './documents.repository';
import {
  GenerateUploadUrlInput,
  ConfirmUploadInput,
  DocumentFilters,
  DocumentResponse,
  UploadUrlResponse,
  DownloadUrlResponse,
  DocumentProcessingStatus
} from './documents.types';
import { PaginatedResponse } from '../../shared/types';
import { UnprocessableError, NotFoundError, ForbiddenError } from '../../errors';
import { generatePresignedPutUrl, generatePresignedGetUrl, deleteS3Object } from '../../shared/s3';
import { sendDocumentProcessingMessage } from '../../shared/sqs';
import { prisma } from '../../database/db';
import { InvoiceStatus } from '../../types/prisma';
import crypto from 'crypto';
import { isAdminRole, getAssignedClientIds } from '../../shared/access';
import { logger } from '../../common/logger/logger';

export class DocumentsService {
  private async getAccessFilter(
    userId: string,
    userRole: string
  ): Promise<string[] | null> {
    if (isAdminRole(userRole)) return null;
    return getAssignedClientIds(userId);
  }

  async markStaleDocumentsAsFailed(): Promise<void> {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    try {
      // Find stuck invoices using dynamic raw query to safely interrogate the JSONB aiMetadata
      const stuckInvoices: any[] = await prisma.$queryRaw`
        SELECT id, "aiMetadata"
        FROM "Invoice"
        WHERE status = 'DRAFT'
          AND "aiMetadata"->>'processingStartedAt' IS NOT NULL
          AND ("aiMetadata"->>'processingStartedAt')::timestamp < ${fifteenMinsAgo}
      `;

      if (stuckInvoices.length > 0) {
        for (const invoice of stuckInvoices) {
          const aiMetadata = typeof invoice.aiMetadata === 'string' ? JSON.parse(invoice.aiMetadata) : (invoice.aiMetadata || {});
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: InvoiceStatus.FAILED,
              aiMetadata: {
                ...aiMetadata,
                processingFailedAt: new Date().toISOString(),
                errorMessage: 'Processing timed out after 15 minutes of inactivity'
              }
            }
          });
        }
      }
    } catch (error) {
      // Intentionally log and swallow so the cron loop doesn't crash the server
      console.error('Failed to run stale document cron job:', error);
    }
  }

  private deriveProcessingStatus(invoices: any[], createdAt: Date): DocumentProcessingStatus {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (!invoices || invoices.length === 0) {
      if (new Date(createdAt) < fiveMinutesAgo) {
        return DocumentProcessingStatus.FAILED;
      }
      return DocumentProcessingStatus.PENDING;
    }

    const invoice = invoices[0];
    if (invoice.status === 'FAILED') {
      return DocumentProcessingStatus.FAILED;
    }

    if (invoice.status === 'DRAFT' && invoice.aiMetadata && typeof invoice.aiMetadata === 'object') {
      const meta = invoice.aiMetadata as any;
      if (meta.processingCompletedAt) {
        return DocumentProcessingStatus.COMPLETED;
      }
      
      if (meta.processingStartedAt) {
        const processingStartedAt = new Date(meta.processingStartedAt);
        if (processingStartedAt < fiveMinutesAgo) {
          return DocumentProcessingStatus.FAILED;
        }
        return DocumentProcessingStatus.PROCESSING;
      }
    }

    return DocumentProcessingStatus.COMPLETED;
  }

  private mapToDocumentResponse(doc: any): DocumentResponse {
    const processingStatus = this.deriveProcessingStatus(doc.invoices, doc.createdAt);
    const invoice = doc.invoices && doc.invoices.length > 0 ? {
      id: doc.invoices[0].id,
      status: doc.invoices[0].status
    } : null;

    return {
      id: doc.id,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      size: doc.size,
      s3Key: doc.s3Key,
      organizationId: doc.organizationId,
      uploadedBy: doc.uploadedBy,
      processingStatus,
      invoice,
      createdAt: doc.createdAt
    };
  }

  async generateUploadUrl(
    organizationId: string,
    userId: string,
    userRole: string,
    input: GenerateUploadUrlInput
  ): Promise<UploadUrlResponse> {
    const quota = await documentsRepository.findUsageQuota(organizationId);
    if (!quota) {
      throw new UnprocessableError('Usage quota not configured for this organization');
    }

    if (quota.invoicesProcessed >= quota.invoicesLimit) {
      const formattedResetDate = quota.resetDate.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      throw new UnprocessableError(
        `Invoice processing limit reached (${quota.invoicesProcessed}/${quota.invoicesLimit}). Upgrade your plan or wait for quota reset on ${formattedResetDate}.`
      );
    }

    const documentId = crypto.randomUUID();
    const s3Key = `organizations/${organizationId}/documents/${documentId}/${input.originalName}`;
    
    const uploadUrl = await generatePresignedPutUrl({
      key: s3Key,
      mimeType: input.mimeType,
      maxSizeBytes: input.size
    });

    const newDoc = await documentsRepository.createDocument({
      id: documentId,
      s3Key,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      organizationId,
      uploadedBy: userId
    });

    await documentsRepository.createAuditLog({
      userId,
      action: 'GENERATE_UPLOAD_URL',
      resource: 'DOCUMENT',
      details: { documentId, originalName: input.originalName, mimeType: input.mimeType }
    });

    return {
      documentId: newDoc.id,
      uploadUrl,
      expiresInSeconds: 900,
      s3Key
    };
  }

  async confirmUpload(
    documentId: string,
    organizationId: string,
    userId: string,
    userRole: string,
    ipAddress: string
  ): Promise<DocumentResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const document = await documentsRepository.findDocumentByIdAndOrg(documentId, organizationId, userId, accessFilter);
    if (!document) {
      throw new NotFoundError('Document');
    }

    if (document.invoices && document.invoices.length > 0) {
      throw new UnprocessableError('Document has already been processed');
    }

    await documentsRepository.incrementQuotaUsage(organizationId);

    await sendDocumentProcessingMessage({
      documentId,
      organizationId,
      s3Key: document.s3Key,
      mimeType: document.mimeType
    });
    logger.info(`Document processing message sent for document ${documentId}`);
    await documentsRepository.createAuditLog({
      userId,
      action: 'CONFIRM_UPLOAD',
      resource: 'DOCUMENT',
      details: { documentId, s3Key: document.s3Key },
      ipAddress
    });

    return {
      ...this.mapToDocumentResponse(document),
      processingStatus: DocumentProcessingStatus.PENDING
    };
  }

  async listDocuments(
    organizationId: string,
    userId: string,
    userRole: string,
    filters: DocumentFilters
  ): Promise<PaginatedResponse<DocumentResponse>> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const { documents, total } = await documentsRepository.findDocumentsByOrganization(organizationId, filters, userId, accessFilter);
    
    let docs = documents.map(doc => this.mapToDocumentResponse(doc));

    if (filters.processingStatus) {
      docs = docs.filter(doc => doc.processingStatus === filters.processingStatus);
    }

    const limit = filters.limit || 20;
    const page = filters.page || 1;

    return {
      data: docs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getDocumentById(
    documentId: string,
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<DocumentResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const document = await documentsRepository.findDocumentByIdAndOrg(documentId, organizationId, userId, accessFilter);
    if (!document) {
      throw new NotFoundError('Document');
    }

    return this.mapToDocumentResponse(document);
  }

  async generateDownloadUrl(
    documentId: string,
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<DownloadUrlResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const document = await documentsRepository.findDocumentByIdAndOrg(documentId, organizationId, userId, accessFilter);
    if (!document) {
      throw new NotFoundError('Document');
    }

    const downloadUrl = await generatePresignedGetUrl({
      key: document.s3Key,
      expiresInSeconds: 900
    });

    return {
      downloadUrl,
      expiresInSeconds: 900
    };
  }

  async reprocessDocument(
    documentId: string,
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<DocumentResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const document = await documentsRepository.findDocumentByIdAndOrg(documentId, organizationId, userId, accessFilter);
    if (!document) {
      throw new NotFoundError('Document');
    }

    const invoice = document.invoices?.[0];
    if (invoice && invoice.status !== 'FAILED') {
      throw new UnprocessableError('Only failed documents can be reprocessed');
    }

    // Attempt to queue the message via SQS FIRST. 
    // If this throws, it gracefully aborts here, bubbling a 503 and preventing ghost UI updates.
    await sendDocumentProcessingMessage({
      documentId,
      organizationId,
      s3Key: document.s3Key,
      mimeType: document.mimeType
    });

    logger.info(`Document processing message sent for document ${documentId}`);

    // SQS succeeded! Immediately reset the DB state so the UI reflects "PROCESSING"
    if (invoice) {
      const existingMetadata = (invoice.aiMetadata as any) || {};
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.DRAFT,
          aiMetadata: {
            ...existingMetadata,
            processingStartedAt: new Date().toISOString(),
            processingCompletedAt: null,
            processingFailedAt: null,
            errorMessage: null,
            retryCount: (existingMetadata.retryCount || 0) + 1
          }
        }
      });
    } else {
      // If there is no invoice yet (it dropped during initial SQS transit), 
      // we update the Document's createdAt to give the frontend a fresh 5-minute PENDING window.
      await prisma.document.update({
        where: { id: documentId },
        data: { createdAt: new Date() }
      });
    }

    await documentsRepository.createAuditLog({
      userId,
      action: 'REPROCESS_DOCUMENT',
      resource: 'DOCUMENT',
      details: { documentId, s3Key: document.s3Key, status: 'Re-queued successfully' }
    });

    return {
      ...this.mapToDocumentResponse(document),
      processingStatus: DocumentProcessingStatus.PENDING
    };
  }

  async deleteDocument(
    documentId: string,
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<void> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const document = await documentsRepository.findDocumentByIdAndOrg(documentId, organizationId, userId, accessFilter);
    if (!document) {
      throw new NotFoundError('Document');
    }

    if (document.invoices && document.invoices.length > 0) {
      throw new UnprocessableError('Cannot delete a document that has been processed. Delete the linked invoice first.');
    }

    await deleteS3Object(document.s3Key);
    await documentsRepository.deleteDocument(documentId, organizationId);

    await documentsRepository.createAuditLog({
      userId,
      action: 'DELETE_DOCUMENT',
      resource: 'DOCUMENT',
      details: { documentId, s3Key: document.s3Key, originalName: document.originalName }
    });
  }
}

export const documentsService = new DocumentsService();
