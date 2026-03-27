import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { errorHandler } from './middleware/error.middleware';
import { env } from './config/env';
import { redis } from './database/redis';

import { authRoutes } from './modules/auth/auth.routes';
import { organizationRoutes } from './modules/organization/organization.routes';
import { invoicesRoutes } from './modules/invoices/invoices.routes';

import { usersRoutes } from './modules/users/users.routes';
import { clientsRoutes } from './modules/clients/clients.routes';
import ledgerRoutes from './modules/ledger/ledger.routes';
import { documentsRoutes } from './modules/documents/documents.routes';
import { workflowRoutes } from './modules/workflow/workflow.routes';
import { subscriptionRoutes } from './modules/subscription-billing/subscription.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = fastify({
    logger: {
      level: env.isDev ? 'debug' : 'info',
      transport: env.isDev
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          // Mask sensitive headers
          headers: { ...req.headers, authorization: undefined },
        }),
      },
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Validation
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // Middleware
  await app.register(helmet);
  await app.register(cors);
  
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'GST AI Invoice Processor API',
        description: 'Enterprise API for GST Invoice Processing',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKey: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Health Check
  app.get('/health', async (request, reply) => {
    return reply.status(200).send({
      status:    'ok',
      timestamp: new Date().toISOString(),
      uptime:    process.uptime(),
    });
  });

  // Register Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(invoicesRoutes, { prefix: '/api/v1/invoices' });
  await app.register(workflowRoutes, { prefix: '/api/v1/invoices' });
  await app.register(organizationRoutes, { prefix: '/api/v1/organization' });

  await app.register(usersRoutes, { prefix: '/api/v1/users' });
  await app.register(clientsRoutes, { prefix: '/api/v1/clients' });
  await app.register(documentsRoutes, { prefix: '/api/v1/documents' });
  await app.register(subscriptionRoutes, { prefix: '/api/v1/subscription' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(ledgerRoutes);


  return app;
};
