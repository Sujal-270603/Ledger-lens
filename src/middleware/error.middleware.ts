import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { errorResponse } from '../common/responses/apiResponse';
import { AppError, ValidationError } from '../errors';
import { env } from '../config/env';

export const errorHandler = (
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  request.log.error(error); // Logs stack trace internally 

  // Fastify Validation Errors Handler
  if ('validation' in error) {
    return reply.status(400).send(
      errorResponse('Validation Error', { details: (error as any).validation })
    );
  }

  // App domain custom error
  if (error instanceof AppError) {
    const meta: Record<string, unknown> = { code: error.code };
    if (error instanceof ValidationError && error.fields?.length) {
      meta.fields = error.fields;
    }
    return reply.status(error.statusCode).send(
      errorResponse(error.message, meta)
    );
  }

  // Fallback for unhandled exceptions
  return reply.status(500).send(
    errorResponse('Internal Server Error', env.isDev ? { stack: error.stack } : undefined)
  );
};
