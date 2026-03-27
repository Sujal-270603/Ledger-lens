// src/middleware/validateBody.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

export const validateBody = (schema: ZodSchema) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.body = schema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = error.errors.map(e => ({
          field: e.path.join('.') || 'unknown',
          message: e.message
        }));
        throw new ValidationError('Validation failed', fields);
      }
      throw error;
    }
  };
};
