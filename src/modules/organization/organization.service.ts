// src/modules/organization/organization.service.ts

import { organizationRepository } from './organization.repository';
import { OrganizationProfile, UpdateOrganizationInput, AuditLogFilters, AuditLogEntry } from './organization.types';
import { PaginatedResponse } from '../../shared/types';
import { NotFoundError, ConflictError } from '../../errors';

export class OrganizationService {
  async getOrganizationProfile(organizationId: string): Promise<OrganizationProfile> {
    const org = await organizationRepository.findOrganizationById(organizationId);
    if (!org) {
      throw new NotFoundError('Organization');
    }

    const quota = org.usageQuotas[0] || {
      invoicesProcessed: 0,
      invoicesLimit: 100,
      resetDate: new Date(),
    };
    const percentUsed = quota.invoicesLimit > 0 ? Math.round((quota.invoicesProcessed / quota.invoicesLimit) * 100) : 0;

    const sub = org.subscriptions;

    return {
      id: org.id,
      name: org.name,
      gstin: org.gstin,
      address: org.address,
      createdAt: org.createdAt,
      quota: {
        invoicesProcessed: quota.invoicesProcessed,
        invoicesLimit: quota.invoicesLimit,
        percentUsed,
        resetDate: quota.resetDate,
      },
      subscription: sub
        ? {
            tier: sub.plan,
            status: sub.status,
          }
        : null,
    };
  }

  async updateOrganization(
    organizationId: string,
    userId: string,
    input: UpdateOrganizationInput
  ): Promise<OrganizationProfile> {
    const existingOrg = await organizationRepository.findOrganizationById(organizationId);
    if (!existingOrg) {
      throw new NotFoundError('Organization');
    }

    if (input.gstin && input.gstin !== existingOrg.gstin) {
      const gstinConflict = await organizationRepository.findOrganizationByGstin(input.gstin);
      if (gstinConflict && gstinConflict.id !== organizationId) {
        throw new ConflictError('An organization with this GSTIN already exists');
      }
    }

    await organizationRepository.updateOrganization(organizationId, input);

    await organizationRepository.createAuditLog({
      userId,
      action: 'UPDATE_ORGANIZATION',
      resource: 'ORGANIZATION',
      details: { updatedFields: Object.keys(input) },
    });

    return this.getOrganizationProfile(organizationId);
  }

  async getAuditLogs(
    organizationId: string,
    filters: AuditLogFilters
  ): Promise<PaginatedResponse<AuditLogEntry>> {
    const { logs, total } = await organizationRepository.getAuditLogs(organizationId, filters);
    const limit = filters.limit || 20;
    const page = filters.page || 1;

    const data: AuditLogEntry[] = logs.map(log => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      details: log.details,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
      user: log.user
        ? {
            id: log.user.id,
            fullName: log.user.fullName,
            email: log.user.email,
          }
        : null,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getQuota(organizationId: string): Promise<OrganizationProfile['quota']> {
    const org = await organizationRepository.findOrganizationById(organizationId);
    if (!org) {
      throw new NotFoundError('Organization');
    }
    const quota = org.usageQuotas[0];
    if (!quota) {
      throw new NotFoundError('UsageQuota');
    }
    const percentUsed = quota.invoicesLimit > 0 ? Math.round((quota.invoicesProcessed / quota.invoicesLimit) * 100) : 0;
    return {
      invoicesProcessed: quota.invoicesProcessed,
      invoicesLimit: quota.invoicesLimit,
      percentUsed,
      resetDate: quota.resetDate,
    };
  }
}

export const organizationService = new OrganizationService();
