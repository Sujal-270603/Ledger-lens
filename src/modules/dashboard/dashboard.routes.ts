import { FastifyInstance } from 'fastify';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';
import { dashboardFiltersSchema } from './dashboard.schema';
import { DashboardFilters } from './dashboard.types';

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get<{ Querystring: DashboardFilters }>('/overview', {
    preHandler: [requirePermission('VIEW_DASHBOARD')],
    schema: { querystring: dashboardFiltersSchema }
  }, dashboardController.getOverview);

  fastify.get<{ Querystring: DashboardFilters }>('/trends', {
    preHandler: [requirePermission('VIEW_DASHBOARD')]
  }, dashboardController.getInvoiceTrend);

  fastify.get<{ Querystring: DashboardFilters }>('/top-clients', {
    preHandler: [requirePermission('VIEW_DASHBOARD')]
  }, dashboardController.getTopClients);

  fastify.get('/recent-activity', {
    preHandler: [requirePermission('VIEW_DASHBOARD')]
  }, dashboardController.getRecentActivity);
}
