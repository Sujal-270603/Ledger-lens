import { Queue } from 'bullmq';
import { redisConfig } from '../database/redis';
import { env } from '../config/env';

export const INVOICE_QUEUE_NAME = 'invoice-processing';

export const invoiceQueue = new Queue(INVOICE_QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
  },
});
