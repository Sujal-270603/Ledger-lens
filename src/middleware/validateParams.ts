// src/middleware/validateParams.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { BadRequestError } from '../errors';

const uuidSchema = z.string().uuid();

export const validateParams = async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as Record<string, any>;
  if (!params) return;

  for (const [key, value] of Object.entries(params)) {
    try {
      uuidSchema.parse(value);
    } catch (error) {
      throw new BadRequestError('Invalid ID format');
    }
  }
};
