import { prisma } from '../../database/db';
import { InvoiceStatus, Prisma } from '@prisma/client';

export class DashboardRepository {
  async getInvoiceCounts(organizationId: string, accessClientIds: string[] | null, startDate?: Date, endDate?: Date) {
    const where: Prisma.InvoiceWhereInput = { organizationId };
    
    if (accessClientIds !== null) {
      where.clientId = { in: accessClientIds };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return prisma.invoice.groupBy({
      by: ['status'],
      where,
      _count: {
        _all: true
      }
    });
  }

  async getInvoiceValues(organizationId: string, accessClientIds: string[] | null, status?: InvoiceStatus, startDate?: Date, endDate?: Date) {
    const where: Prisma.InvoiceWhereInput = { organizationId };
    
    if (accessClientIds !== null) {
      where.clientId = { in: accessClientIds };
    }

    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return prisma.invoice.aggregate({
      where,
      _sum: {
        totalAmount: true
      }
    });
  }

  async getDocumentCounts(organizationId: string, accessClientIds: string[] | null, userId: string | null = null) {
    const where: Prisma.DocumentWhereInput = { organizationId };

    if (accessClientIds !== null && userId !== null) {
      where.OR = [
        { uploadedBy: userId },
        { invoices: { some: { clientId: { in: accessClientIds } } } }
      ];
    }

    return prisma.document.count({ where });
  }

  async getClientCounts(organizationId: string, accessClientIds: string[] | null) {
    const where: Prisma.ClientWhereInput = { organizationId };
    
    if (accessClientIds !== null) {
      where.id = { in: accessClientIds };
    }

    return prisma.client.count({ where });
  }

  async getUserCounts(organizationId: string) {
    // Admins only usually care about total user count in org
    return prisma.user.count({
      where: { organizationId, isActive: true }
    });
  }

  async getUsageQuota(organizationId: string) {
    return prisma.usageQuota.findUnique({
      where: { organizationId }
    });
  }

  async getSubscription(organizationId: string) {
    return prisma.subscription.findUnique({
      where: { organizationId }
    });
  }

  async getInvoiceTrend(organizationId: string, accessClientIds: string[] | null, startDate: Date) {
    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      status: InvoiceStatus.APPROVED,
      createdAt: { gte: startDate }
    };

    if (accessClientIds !== null) {
      where.clientId = { in: accessClientIds };
    }

    return prisma.invoice.findMany({
      where,
      select: {
        createdAt: true,
        totalAmount: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async getTopClients(organizationId: string, accessClientIds: string[] | null, startDate?: Date, limit: number = 5) {
    const where: Prisma.InvoiceWhereInput = { 
      organizationId,
      status: InvoiceStatus.APPROVED,
      clientId: { not: null }
    };

    if (accessClientIds !== null) {
      where.clientId = { in: accessClientIds };
    }

    if (startDate) {
      where.createdAt = { ...((where.createdAt as any) || {}), gte: startDate };
    }

    return prisma.invoice.groupBy({
      by: ['clientId'],
      where,
      _sum: {
        totalAmount: true
      },
      _count: {
        _all: true
      },
      orderBy: {
        _sum: {
          totalAmount: 'desc'
        }
      },
      take: limit
    });
  }

  async getClientNames(clientIds: string[]) {
    return prisma.client.findMany({
      where: {
        id: { in: clientIds }
      },
      select: {
        id: true,
        name: true
      }
    });
  }

  async getRecentActivity(organizationId: string, userId: string | null = null, limit: number = 10) {
    const where: Prisma.AuditLogWhereInput = {
      user: {
        organizationId
      }
    };

    if (userId !== null) {
      where.userId = userId;
    }

    return prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
}

export const dashboardRepository = new DashboardRepository();
