// src/modules/ai-processing/ai-processing.schema.ts
import { z } from 'zod';

export const acceptExtractionSchema = z.object({
  overrides: z.object({
    invoiceNumber: z.string().min(1).max(100).optional(),
    invoiceDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    clientId: z.string().uuid().optional(),
    totalAmount: z.number().positive().optional(),
    gstAmount: z.number().min(0).optional(),
    cgstAmount: z.number().min(0).optional(),
    sgstAmount: z.number().min(0).optional(),
    igstAmount: z.number().min(0).optional(),
  }).optional()
});
