// src/modules/organization/organization.controller.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { organizationService } from './organization.service';
import { UpdateOrganizationInput, AuditLogFilters } from './organization.types';

export class OrganizationController {
  async getOrganizationProfile(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = request.user;
    const profile = await organizationService.getOrganizationProfile(organizationId);
    return reply.status(200).send(profile);
  }

  async updateOrganization(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId, userId } = request.user;
    const input = request.body as UpdateOrganizationInput;
    const profile = await organizationService.updateOrganization(organizationId, userId, input);
    return reply.status(200).send(profile);
  }

  async getQuota(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = request.user;
    const quota = await organizationService.getQuota(organizationId);
    return reply.status(200).send(quota);
  }

  async getAuditLogs(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = request.user;
    const filters = request.query as AuditLogFilters;
    const logs = await organizationService.getAuditLogs(organizationId, filters);
    return reply.status(200).send(logs);
  }
}

export const organizationController = new OrganizationController();
