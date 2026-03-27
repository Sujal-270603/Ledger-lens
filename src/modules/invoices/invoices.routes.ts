// src/modules/invoices/invoices.routes.ts
import { FastifyInstance } from 'fastify';
import { invoicesController } from './invoices.controller';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceFiltersSchema,
  replaceItemsSchema
} from './invoices.schema';
import { validateBody } from '../../middleware/validateBody';
import { validateParams } from '../../middleware/validateParams';
import { validateQuery } from '../../middleware/validateQuery';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';

export async function invoicesRoutes(app: FastifyInstance) {
  app.get('/', {
    preHandler: [
      authenticate,
      validateQuery(invoiceFiltersSchema)
    ]
  }, invoicesController.listInvoices);

  app.post('/', {
    preHandler: [
      authenticate,
      requirePermission('CREATE_INVOICE'),
      validateBody(createInvoiceSchema)
    ]
  }, invoicesController.createInvoice);

  app.get('/:invoiceId', {
    preHandler: [
      authenticate,
      validateParams
    ]
  }, invoicesController.getInvoiceById);

  app.put('/:invoiceId', {
    preHandler: [
      authenticate,
      requirePermission('EDIT_INVOICE'),
      validateParams,
      validateBody(updateInvoiceSchema)
    ]
  }, invoicesController.updateInvoice);

  app.delete('/:invoiceId', {
    preHandler: [
      authenticate,
      requirePermission('DELETE_INVOICE'),
      validateParams
    ]
  }, invoicesController.deleteInvoice);

  app.get('/:invoiceId/items', {
    preHandler: [
      authenticate,
      validateParams
    ]
  }, invoicesController.getInvoiceItems);

  app.put('/:invoiceId/items', {
    preHandler: [
      authenticate,
      requirePermission('EDIT_INVOICE'),
      validateParams,
      validateBody(replaceItemsSchema)
    ]
  }, invoicesController.replaceInvoiceItems);
}
