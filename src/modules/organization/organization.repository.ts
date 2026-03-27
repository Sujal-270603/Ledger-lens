// src/modules/organization/organization.repository.ts

import { prisma } from '../../database/db';
import { Organization, AuditLog, User, Prisma } from '@prisma/client';
import { UpdateOrganizationInput, AuditLogFilters } from './organization.types';

export type OrganizationWithQuotaAndSub = Prisma.OrganizationGetPayload<{
  include: { usageQuotas: true; subscriptions: true };
}>;

export type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: { user: { select: { id: true; fullName: true; email: true } } };
}>;

export class OrganizationRepository {
  async findOrganizationById(organizationId: string): Promise<OrganizationWithQuotaAndSub | null> {
    return prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        usageQuotas: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        subscriptions: true,
      },
    });
  }

  async findOrganizationByGstin(gstin: string): Promise<Organization | null> {
    return prisma.organization.findUnique({
      where: { gstin },
    });
  }

  async updateOrganization(organizationId: string, data: UpdateOrganizationInput): Promise<Organization> {
    return prisma.organization.update({
      where: { id: organizationId },
      data,
    });
  }

  async getAuditLogs(
    organizationId: string,
    filters: AuditLogFilters
  ): Promise<{ logs: AuditLogWithUser[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      user: {
        organizationId,
      },
    };

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.action) {
      where.action = { contains: filters.action, mode: 'insensitive' };
    }

    if (filters.resource) {
      where.resource = { contains: filters.resource, mode: 'insensitive' };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async createAuditLog(data: {
    userId: string;
    organizationId?: string;
    action: string;
    resource: string;
    details?: object;
    ipAddress?: string;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        details: data.details ? (data.details as any) : undefined,
        ipAddress: data.ipAddress,
      },
    });
  }
}

export const organizationRepository = new OrganizationRepository();
