// src/modules/ai-processing/ai-processing.types.ts
import { LLMExtractionResult } from '../../shared/llm';
import { InvoiceStatus } from '../../types/prisma';

export enum AIProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface AIStatusResponse {
  documentId: string;
  processingStatus: AIProcessingStatus;
  invoiceId: string | null;
  confidenceScore: number | null;
  isLowConfidence: boolean;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  processingFailedAt: Date | null;
  errorMessage: string | null;
  retryCount: number;
  extractionNotes: string | null;
}

export interface ExtractionPreviewResponse {
  documentId: string;
  invoiceId: string;
  rawExtraction: LLMExtractionResult;
  confidenceScore: number;
  isLowConfidence: boolean;
  extractionNotes: string | null;
}

export interface AcceptExtractionInput {
  overrides?: {
    invoiceNumber?: string;
    invoiceDate?: string;
    clientId?: string;
    totalAmount?: number;
    gstAmount?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
  };
}

export interface WorkerProcessingResult {
  success: boolean;
  documentId: string;
  invoiceId?: string;
  error?: string;
}
