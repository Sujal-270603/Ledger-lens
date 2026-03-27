// src/modules/ai-processing/ai-processing.routes.ts
import { FastifyInstance } from 'fastify';
import { aiProcessingController } from './ai-processing.controller';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';
import { validateParams } from '../../middleware/validateParams';
import { validateBody } from '../../middleware/validateBody';
import { acceptExtractionSchema } from './ai-processing.schema';

export default async function aiProcessingRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/:documentId/ai-status',
    { preHandler: [authenticate, validateParams] },
    aiProcessingController.getAIStatus.bind(aiProcessingController)
  );

  fastify.post(
    '/:documentId/reprocess',
    { preHandler: [authenticate, requirePermission('REPROCESS_INVOICE'), validateParams] },
    aiProcessingController.reprocessDocument.bind(aiProcessingController)
  );

  fastify.get(
    '/:documentId/extraction-preview',
    { preHandler: [authenticate, validateParams] },
    aiProcessingController.getExtractionPreview.bind(aiProcessingController)
  );

  fastify.patch(
    '/:documentId/accept-extraction',
    {
      preHandler: [
        authenticate,
        requirePermission('EDIT_INVOICE'),
        validateParams,
        validateBody(acceptExtractionSchema)
      ]
    },
    aiProcessingController.acceptExtraction.bind(aiProcessingController)
  );
}
