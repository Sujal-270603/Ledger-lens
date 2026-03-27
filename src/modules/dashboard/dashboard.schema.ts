import { z } from 'zod';

export const dashboardFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.string().optional(),
});
