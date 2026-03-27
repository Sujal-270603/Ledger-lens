// src/modules/clients/clients.routes.ts
import { FastifyInstance } from 'fastify';
import { clientsController } from './clients.controller';
import {
  createClientSchema,
  updateClientSchema,
  clientFiltersSchema,
  clientInvoiceFiltersSchema,
  assignUserSchema
} from './clients.schema';
import { validateBody } from '../../middleware/validateBody';
import { validateParams } from '../../middleware/validateParams';
import { validateQuery } from '../../middleware/validateQuery';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';

export async function clientsRoutes(app: FastifyInstance) {
  
  app.get('/', {
    preHandler: [
      authenticate,
      validateQuery(clientFiltersSchema)
    ]
  }, clientsController.listClients);

  app.post('/', {
    preHandler: [
      authenticate,
      requirePermission('CREATE_CLIENT'),
      validateBody(createClientSchema)
    ]
  }, clientsController.createClient);

  app.get('/:clientId', {
    preHandler: [
      authenticate,
      validateParams
    ]
  }, clientsController.getClientById);

  app.patch('/:clientId', {
    preHandler: [
      authenticate,
      requirePermission('EDIT_CLIENT'),
      validateParams,
      validateBody(updateClientSchema)
    ]
  }, clientsController.updateClient);

  app.delete('/:clientId', {
    preHandler: [
      authenticate,
      requirePermission('DELETE_CLIENT'),
      validateParams
    ]
  }, clientsController.deleteClient);

  app.get('/:clientId/invoices', {
    preHandler: [
      authenticate,
      validateParams,
      validateQuery(clientInvoiceFiltersSchema)
    ]
  }, clientsController.getClientInvoices);

  app.post('/:clientId/users', {
    preHandler: [
      authenticate,
      requirePermission('MANAGE_USERS'),
      validateParams,
      validateBody(assignUserSchema)
    ]
  }, clientsController.assignUserToClient);

  app.delete('/:clientId/users/:userId', {
    preHandler: [
      authenticate,
      requirePermission('MANAGE_USERS'),
      validateParams
    ]
  }, clientsController.removeUserFromClient);
}
