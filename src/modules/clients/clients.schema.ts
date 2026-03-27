// src/modules/clients/clients.schema.ts
import { z } from 'zod';
import { InvoiceStatus } from '@prisma/client';

export const createClientSchema = z.object({
  name: z.string().min(2).max(150).trim(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format' }).optional(),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' }).optional()
});

export const updateClientSchema = z.object({
  name: z.string().min(2).max(150).trim().optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format' }).optional(),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' }).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

export const clientFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const clientInvoiceFiltersSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const assignUserSchema = z.object({
  userId: z.string().uuid()
});
