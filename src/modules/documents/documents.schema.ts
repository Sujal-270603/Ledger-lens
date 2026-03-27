// src/modules/documents/documents.schema.ts
import { z } from 'zod';
import { DocumentProcessingStatus } from './documents.types';

export const generateUploadUrlSchema = z.object({
  originalName: z.string().min(1).max(255).regex(/^[\w\-. ]+$/, { message: 'File name contains invalid characters' }),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'], { 
    message: 'Unsupported file type. Allowed: PDF, JPEG, PNG, TIFF' 
  }),
  size: z.number().int().nonnegative().max(10485760, { message: 'File size exceeds 10MB limit' }),
  clientId: z.string().uuid().optional()
});

export const confirmUploadSchema = z.object({
  clientId: z.string().uuid().optional()
});

export const documentFiltersSchema = z.object({
  processingStatus: z.nativeEnum(DocumentProcessingStatus).optional(),
  clientId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
