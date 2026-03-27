// src/modules/organization/organization.schema.ts

import { z } from 'zod';

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional(),
  address: z.string().optional(),
});

export const auditLogFiltersSchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
