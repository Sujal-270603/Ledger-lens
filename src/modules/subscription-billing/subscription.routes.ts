import { FastifyInstance } from 'fastify';
import { subscriptionController } from './subscription.controller';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';
import { validateBody } from '../../middleware/validateBody';
import { validateQuery } from '../../middleware/validateQuery';
import { changePlanSchema, billingHistoryFiltersSchema } from './subscription.schema';
import { ChangePlanInput, BillingHistoryFilters } from './subscription.types';

export async function subscriptionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', {
    preHandler: [requirePermission('VIEW_SUBSCRIPTION')]
  }, subscriptionController.getSubscription);

  app.get('/usage', {
    preHandler: [requirePermission('VIEW_SUBSCRIPTION')]
  }, subscriptionController.getUsageSummary);

  app.patch<{ Body: ChangePlanInput }>('/plan', {
    preHandler: [requirePermission('MANAGE_BILLING')],
    schema: { body: changePlanSchema }
  }, subscriptionController.changePlan);

  app.post('/cancel', {
    preHandler: [requirePermission('MANAGE_BILLING')]
  }, subscriptionController.cancelSubscription);

  app.post('/reactivate', {
    preHandler: [requirePermission('MANAGE_BILLING')]
  }, subscriptionController.reactivateSubscription);

  app.get<{ Querystring: BillingHistoryFilters }>('/billing-history', {
    preHandler: [requirePermission('VIEW_BILLING')],
    schema: { querystring: billingHistoryFiltersSchema }
  }, subscriptionController.getBillingHistory);
}
