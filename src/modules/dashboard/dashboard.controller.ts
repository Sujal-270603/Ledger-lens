import { FastifyReply, FastifyRequest } from 'fastify';
import { dashboardService } from './dashboard.service';
import { DashboardFilters } from './dashboard.types';

export class DashboardController {
  async getOverview(request: FastifyRequest<{ Querystring: DashboardFilters }>, reply: FastifyReply) {
    const { organizationId, userId, role } = request.user;
    const filters = request.query;
    const result = await dashboardService.getOverview(organizationId, userId, role, filters);
    return reply.status(200).send(result);
  }

  async getInvoiceTrend(request: FastifyRequest<{ Querystring: { period?: string } }>, reply: FastifyReply) {
    const { organizationId, userId, role } = request.user;
    const { period } = request.query;
    const result = await dashboardService.getInvoiceTrend(organizationId, userId, role, period);
    return reply.status(200).send(result);
  }

  async getTopClients(request: FastifyRequest<{ Querystring: { period?: string } }>, reply: FastifyReply) {
    const { organizationId, userId, role } = request.user;
    const { period } = request.query;
    const result = await dashboardService.getTopClients(organizationId, userId, role, period);
    return reply.status(200).send(result);
  }

  async getRecentActivity(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId, userId, role } = request.user;
    const result = await dashboardService.getRecentActivity(organizationId, userId, role);
    return reply.status(200).send(result);
  }
}

export const dashboardController = new DashboardController();
