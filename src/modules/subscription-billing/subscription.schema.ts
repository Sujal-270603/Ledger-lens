import { z } from 'zod';
import { SubscriptionPlan } from '@prisma/client';

export const changePlanSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
});

export const billingHistoryFiltersSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});
