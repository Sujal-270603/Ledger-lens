// src/modules/documents/documents.types.ts
import { InvoiceStatus } from '@prisma/client';

export enum DocumentProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface GenerateUploadUrlInput {
  originalName: string;
  mimeType: string;
  size: number;
  clientId?: string;
}

export interface ConfirmUploadInput {
  clientId?: string;
}

export interface DocumentFilters {
  processingStatus?: DocumentProcessingStatus;
  clientId?: string;
  page?: number;
  limit?: number;
}

export interface DocumentResponse {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  organizationId: string;
  uploadedBy: string | null;
  processingStatus: DocumentProcessingStatus;
  invoice: {
    id: string;
    status: InvoiceStatus;
  } | null;
  createdAt: Date;
}

export interface UploadUrlResponse {
  documentId: string;
  uploadUrl: string;
  expiresInSeconds: number;
  s3Key: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresInSeconds: number;
}
