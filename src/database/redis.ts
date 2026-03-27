import IORedis from 'ioredis';
import { env } from '../config/env';

export const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null, // Required for BullMQ
};

export const redis = new IORedis(redisConfig);
