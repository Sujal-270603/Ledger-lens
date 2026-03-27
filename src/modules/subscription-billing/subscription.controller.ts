import { FastifyReply, FastifyRequest } from 'fastify';
import { subscriptionService } from './subscription.service';
import { ChangePlanInput, BillingHistoryFilters } from './subscription.types';

export class SubscriptionController {
  async getSubscription(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = request.user;
    const result = await subscriptionService.getSubscription(organizationId);
    return reply.status(200).send(result);
  }

  async getUsageSummary(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = request.user;
    const result = await subscriptionService.getUsageSummary(organizationId);
    return reply.status(200).send(result);
  }

  async changePlan(request: FastifyRequest<{ Body: ChangePlanInput }>, reply: FastifyReply) {
    const { organizationId, userId } = request.user;
    const { plan } = request.body;
    const result = await subscriptionService.changePlan(organizationId, userId, plan);
    return reply.status(200).send(result);
  }

  async cancelSubscription(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId, userId } = request.user;
    const result = await subscriptionService.cancelSubscription(organizationId, userId);
    return reply.status(200).send(result);
  }

  async reactivateSubscription(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId, userId } = request.user;
    const result = await subscriptionService.reactivateSubscription(organizationId, userId);
    return reply.status(200).send(result);
  }

  async getBillingHistory(request: FastifyRequest<{ Querystring: BillingHistoryFilters }>, reply: FastifyReply) {
    const { organizationId } = request.user;
    const filters = request.query;
    const result = await subscriptionService.getBillingHistory(organizationId, filters);
    return reply.status(200).send(result);
  }
}

export const subscriptionController = new SubscriptionController();
