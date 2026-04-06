// src/modules/documents/documents.routes.ts
import { FastifyInstance } from 'fastify';
import { documentsController } from './documents.controller';
import {
  generateUploadUrlSchema,
  documentFiltersSchema,
  confirmUploadSchema
} from './documents.schema';
import { validateBody } from '../../middleware/validateBody';
import { validateParams } from '../../middleware/validateParams';
import { validateQuery } from '../../middleware/validateQuery';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';
import { checkQuota } from '../../middleware/checkQuota';

export async function documentsRoutes(app: FastifyInstance) {
  
  app.post('/upload-url', {
    preHandler: [
      authenticate,
      requirePermission('UPLOAD_DOCUMENT'),
      validateBody(generateUploadUrlSchema),
      checkQuota
    ]
  }, documentsController.generateUploadUrl);

  app.post('/:documentId/confirm', {
    preHandler: [
      authenticate,
      requirePermission('UPLOAD_DOCUMENT'),
      validateParams
    ]
  }, documentsController.confirmUpload);

  app.get('/', {
    preHandler: [
      authenticate,
      validateQuery(documentFiltersSchema)
    ]
  }, documentsController.listDocuments);

  app.get('/:documentId', {
    preHandler: [
      authenticate,
      validateParams
    ]
  }, documentsController.getDocumentById);

  app.get('/:documentId/download', {
    preHandler: [
      authenticate,
      validateParams
    ]
  }, documentsController.generateDownloadUrl);

  app.post('/:documentId/reprocess', {
    preHandler: [
      authenticate,
      requirePermission('UPLOAD_DOCUMENT'),
      validateParams
    ]
  }, documentsController.reprocessDocument);

  app.delete('/:documentId', {
    preHandler: [
      authenticate,
      requirePermission('DELETE_DOCUMENT'),
      validateParams
    ]
  }, documentsController.deleteDocument);
}
