// src/middleware/rateLimiter.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitError } from '../errors';
import { redis } from '../database/redis';

interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export const rateLimiter = (options: RateLimitOptions) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip || 'unknown';
    // Generate a specific key per route and per IP
    const key = `rate:${ip}:${request.routerPath}`;
    
    const count = await redis.incr(key);
    
    // First request sets the expiry timeframe
    if (count === 1) {
      await redis.pexpire(key, options.windowMs);
    }

    // Assign standard headers
    reply.header('X-RateLimit-Limit', options.max.toString());
    reply.header('X-RateLimit-Remaining', Math.max(0, options.max - count).toString());

    if (count > options.max) {
      // Fetch TTL simply to provide the reset timer
      const ttl = await redis.pttl(key);
      reply.header('X-RateLimit-Reset', (Date.now() + (ttl > 0 ? ttl : 0)).toString());
      throw new RateLimitError('Too many requests. Please try again later.');
    }
  };
};
