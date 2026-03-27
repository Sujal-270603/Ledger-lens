// src/modules/users/users.schema.ts

import { z } from 'zod';

export const inviteUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  fullName: z.string().min(2).max(100),
  roleId: z.string().uuid(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const updateUserRoleSchema = z.object({
  roleId: z.string().uuid(),
});

export const userFiltersSchema = z.object({
  search: z.string().optional(),
  roleId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
