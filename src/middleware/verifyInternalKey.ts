// src/middleware/verifyInternalKey.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../errors';
import crypto from 'crypto';

export const verifyInternalKey = async (request: FastifyRequest, reply: FastifyReply) => {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    throw new UnauthorizedError('Internal API access is not configured');
  }

  const providedKey = request.headers['x-internal-key'];
  if (!providedKey || typeof providedKey !== 'string') {
    throw new UnauthorizedError('Missing or invalid internal API key');
  }

  const expectedBuffer = Buffer.from(internalKey);
  const providedBuffer = Buffer.from(providedKey);

  if (expectedBuffer.length !== providedBuffer.length) {
    throw new UnauthorizedError('Invalid internal API key');
  }

  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new UnauthorizedError('Invalid internal API key');
  }
};
