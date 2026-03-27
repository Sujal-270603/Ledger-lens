// src/modules/invoices/invoices.schema.ts
import { z } from 'zod';
import { InvoiceStatus, SyncStatus } from '../../types/prisma';

export const createInvoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  hsnCode: z.string().max(8).regex(/^[a-zA-Z0-9]+$/).optional(),
  quantity: z.number().positive().multipleOf(0.01),
  unitPrice: z.number().positive().multipleOf(0.01),
  amount: z.number().positive().multipleOf(0.01),
  taxRate: z.number().nonnegative().max(100).multipleOf(0.01)
});

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(100),
  invoiceDate: z.union([z.string().datetime(), z.string().date()]),
  clientId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  cgstAmount: z.number().nonnegative().optional(),
  sgstAmount: z.number().nonnegative().optional(),
  igstAmount: z.number().nonnegative().optional(),
  gstAmount: z.number().nonnegative(),
  totalAmount: z.number().positive(),
  items: z.array(createInvoiceItemSchema).min(1)
});

export const updateInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(100).optional(),
  invoiceDate: z.union([z.string().datetime(), z.string().date()]).optional(),
  clientId: z.string().uuid().optional(),
  cgstAmount: z.number().nonnegative().optional(),
  sgstAmount: z.number().nonnegative().optional(),
  igstAmount: z.number().nonnegative().optional(),
  gstAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().positive().optional(),
  items: z.array(createInvoiceItemSchema).min(1).optional()
});

export const invoiceFiltersSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  syncStatus: z.nativeEnum(SyncStatus).optional(),
  clientId: z.string().uuid().optional(),
  dateFrom: z.union([z.string().datetime(), z.string().date()]).optional(),
  dateTo: z.union([z.string().datetime(), z.string().date()]).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const replaceItemsSchema = z.object({
  items: z.array(createInvoiceItemSchema).min(1)
});
