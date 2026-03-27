// src/modules/workflow/workflow.schema.ts
import { z } from 'zod';

export const rejectInvoiceSchema = z.object({
  rejectionReason: z.string()
    .min(10, { message: 'Rejection reason must be at least 10 characters' })
    .max(1000)
});

export const reopenInvoiceSchema = z.object({
  reopenReason: z.string()
    .min(10, { message: 'Reopen reason must be at least 10 characters' })
    .max(1000)
});
