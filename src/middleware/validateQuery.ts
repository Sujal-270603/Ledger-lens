// src/middleware/validateQuery.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

export const validateQuery = (schema: ZodSchema) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.query = schema.parse(request.query);
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
