// src/modules/workflow/workflow.routes.ts
import { FastifyInstance } from 'fastify';
import { workflowController } from './workflow.controller';
import { rejectInvoiceSchema, reopenInvoiceSchema } from './workflow.schema';
import { validateBody } from '../../middleware/validateBody';
import { validateParams } from '../../middleware/validateParams';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';

export async function workflowRoutes(app: FastifyInstance) {
  app.post('/:invoiceId/submit', {
    preHandler: [
      authenticate,
      requirePermission('SUBMIT_INVOICE'),
      validateParams
    ]
  }, workflowController.submitInvoice);

  app.post('/:invoiceId/approve', {
    preHandler: [
      authenticate,
      requirePermission('APPROVE_INVOICE'),
      validateParams
    ]
  }, workflowController.approveInvoice);

  app.post('/:invoiceId/reject', {
    preHandler: [
      authenticate,
      requirePermission('APPROVE_INVOICE'),
      validateParams,
      validateBody(rejectInvoiceSchema)
    ]
  }, workflowController.rejectInvoice);

  app.post('/:invoiceId/reopen', {
    preHandler: [
      authenticate,
      requirePermission('REOPEN_INVOICE'),
      validateParams,
      validateBody(reopenInvoiceSchema)
    ]
  }, workflowController.reopenInvoice);

  app.get('/:invoiceId/history', {
    preHandler: [
      authenticate,
      validateParams
    ]
  }, workflowController.getInvoiceHistory);
}
