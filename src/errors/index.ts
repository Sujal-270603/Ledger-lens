// src/shared/errors.ts

import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// BASE ERROR CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean; // true = known/expected error, false = bug

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED ERROR CLASSES
// ─────────────────────────────────────────────────────────────────────────────

/** 400 — Malformed request, invalid input that passed schema but failed business rules */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400, 'BAD_REQUEST');
  }
}

/** 400 — Schema/field validation failed (Zod, manual checks) */
export class ValidationError extends AppError {
  public readonly fields?: { field: string; message: string }[];

  constructor(message = 'Validation failed', fields?: { field: string; message: string }[]) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

/** 401 — Missing or invalid token, wrong password, expired session */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** 402 — Payment required / subscription issue */
export class PaymentError extends AppError {
  constructor(message = 'Payment required') {
    super(message, 402, 'PAYMENT_REQUIRED');
  }
}

/** 403 — Authenticated but lacks permission */
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 404 — Resource not found */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/** 409 — Duplicate entry, unique constraint violation */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

/** 422 — Request understood but semantically invalid (e.g. wrong invoice state) */
export class UnprocessableError extends AppError {
  constructor(message = 'Unprocessable entity') {
    super(message, 422, 'UNPROCESSABLE_ENTITY');
  }
}

/** 429 — Rate limit exceeded */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/** 500 — Unexpected internal error */
export class InternalError extends AppError {
  constructor(message = 'Something went wrong') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

/** 503 — Downstream service unavailable (S3, SQS, Textract, Razorpay) */
export class ServiceUnavailableError extends AppError {
  constructor(service = 'Service') {
    super(`${service} is currently unavailable. Please try again later.`, 503, 'SERVICE_UNAVAILABLE');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ZOD ERROR FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

const formatZodError = (error: ZodError): { field: string; message: string }[] =>
  error.errors.map((e) => ({
    field: e.path.join('.') || 'unknown',
    message: e.message,
  }));

// ─────────────────────────────────────────────────────────────────────────────
// PRISMA ERROR CODES → HTTP ERRORS
// ─────────────────────────────────────────────────────────────────────────────

const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (error.code) {
    // Unique constraint violation — e.g. duplicate email, duplicate GSTIN
    case 'P2002': {
      const fields = (error.meta?.target as string[])?.join(', ') ?? 'field';
      return new ConflictError(`A record with this ${fields} already exists.`);
    }

    // Record not found — e.g. update/delete on non-existent row
    case 'P2025':
      return new NotFoundError('Record');

    // Foreign key constraint failed — e.g. referencing a deleted org
    case 'P2003':
      return new BadRequestError('Related record does not exist.');

    // Required field missing at DB level
    case 'P2011':
      return new ValidationError('A required field is missing.');

    // Value too long for column
    case 'P2000':
      return new ValidationError('Input value is too long for the field.');

    // Transaction failed / deadlock
    case 'P2034':
      return new InternalError('Transaction failed due to a conflict. Please retry.');

    default:
      return new InternalError('A database error occurred.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL FASTIFY ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export const errorHandler = (
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void => {

  // ── Zod validation error ─────────────────────────────────────────────────
  if (error instanceof ZodError) {
    reply.status(422).send({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: formatZodError(error),
    });
    return;
  }

  // ── Fastify built-in schema validation error ──────────────────────────────
  if ('validation' in error && Array.isArray((error as any).validation)) {
    reply.status(400).send({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      errors: (error as any).validation,
    });
    return;
  }

  // ── Prisma known request error ────────────────────────────────────────────
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const appError = handlePrismaError(error);
    reply.status(appError.statusCode).send({
      status: 'error',
      code: appError.code,
      message: appError.message,
    });
    return;
  }

  // ── Prisma validation error (bad query construction) ──────────────────────
  if (error instanceof Prisma.PrismaClientValidationError) {
    request.log.error({ err: error }, 'Prisma validation error');
    reply.status(400).send({
      status: 'error',
      code: 'BAD_REQUEST',
      message: 'Invalid query parameters.',
    });
    return;
  }

  // ── Prisma initialization error ───────────────────────────────────────────
  if (error instanceof Prisma.PrismaClientInitializationError) {
    request.log.error({ err: error }, 'Prisma initialization error');
    reply.status(503).send({
      status: 'error',
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database connection failed.',
    });
    return;
  }

  // ── Known operational AppError ────────────────────────────────────────────
  if (error instanceof AppError && error.isOperational) {
    // Include field errors for ValidationError
    const body: Record<string, unknown> = {
      status: 'error',
      code: error.code,
      message: error.message,
    };
    if (error instanceof ValidationError && error.fields) {
      body.errors = error.fields;
    }
    reply.status(error.statusCode).send(body);
    return;
  }

  // ── JWT errors from jsonwebtoken library ──────────────────────────────────
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
    reply.status(401).send({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token.',
    });
    return;
  }

  // ── Unhandled / unexpected errors ─────────────────────────────────────────
  // Log full error internally — NEVER send stack trace or internal details to client
  request.log.error(
    { err: error, requestId: request.id, url: request.url, method: request.method },
    'Unhandled error',
  );

  reply.status(500).send({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong. Please try again later.',
  });
};