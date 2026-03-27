// src/modules/invoices/invoices.repository.ts
import { prisma } from '../../database/db';
import { Prisma } from '@prisma/client';
import { InvoiceStatus, SyncStatus } from '../../types/prisma';
import { InvoiceFilters, CreateInvoiceItemInput } from './invoices.types';

export type InvoiceListItemWithClient = Prisma.InvoiceGetPayload<{
  include: {
    client: { select: { id: true; name: true } };
  };
}>;

export type InvoiceWithAll = Prisma.InvoiceGetPayload<{
  include: {
    items: true;
    client: { select: { id: true; name: true; gstin: true } };
    document: { select: { id: true; originalName: true } };
    submittedBy: { select: { id: true; fullName: true } };
    approvedBy: { select: { id: true; fullName: true } };
    rejectedBy: { select: { id: true; fullName: true } };
    reopenedBy: { select: { id: true; fullName: true } };
  };
}>;

export class InvoicesRepository {
  async findInvoicesByOrganization(
    organizationId: string,
    filters: InvoiceFilters,
    accessClientIds: string[] | null
  ): Promise<{ invoices: InvoiceListItemWithClient[]; total: number }> {
    const where: Prisma.InvoiceWhereInput = { organizationId };

    if (accessClientIds !== null) {
      if (accessClientIds.length === 0) {
        return { invoices: [], total: 0 };
      }
      where.clientId = { in: accessClientIds };
    }

    if (filters.status) where.status = filters.status;
    if (filters.syncStatus) where.syncStatus = filters.syncStatus;
    if (filters.clientId) where.clientId = filters.clientId;

    if (filters.dateFrom || filters.dateTo) {
      where.invoiceDate = {};
      if (filters.dateFrom) where.invoiceDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.invoiceDate.lte = new Date(filters.dateTo);
    }

    if (filters.search) {
      where.invoiceNumber = { contains: filters.search, mode: 'insensitive' };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } }
        }
      }),
      prisma.invoice.count({ where }),
    ]);

    return { invoices, total };
  }

  async findInvoiceByIdAndOrg(
    invoiceId: string,
    organizationId: string,
    accessClientIds: string[] | null = null
  ): Promise<InvoiceWithAll | null> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        items: true,
        client: { select: { id: true, name: true, gstin: true } },
        document: { select: { id: true, originalName: true } },
        submittedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        rejectedBy: { select: { id: true, fullName: true } },
        reopenedBy: { select: { id: true, fullName: true } }
      }
    });

    if (!invoice) return null;

    if (accessClientIds !== null) {
      if (!invoice.clientId || !accessClientIds.includes(invoice.clientId)) {
        return null;
      }
    }

    return invoice;
  }

  async createInvoice(data: {
    invoiceNumber: string;
    invoiceDate: Date;
    totalAmount: number;
    gstAmount: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    status: InvoiceStatus;
    organizationId: string;
    clientId?: string;
    documentId?: string;
    items: CreateInvoiceItemInput[];
  }): Promise<InvoiceWithAll> {
    const { items, ...invoiceData } = data;
    
    // We create invoice then items directly within a transaction
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: invoiceData
      });

      if (items && items.length > 0) {
        await tx.invoiceItem.createMany({
          data: items.map(item => ({
            ...item,
            invoiceId: invoice.id
          }))
        });
      }

      return tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: {
          items: true,
          client: { select: { id: true, name: true, gstin: true } },
          document: { select: { id: true, originalName: true } },
          submittedBy: { select: { id: true, fullName: true } },
          approvedBy: { select: { id: true, fullName: true } },
          rejectedBy: { select: { id: true, fullName: true } },
          reopenedBy: { select: { id: true, fullName: true } }
        }
      });
    });
  }

  async updateInvoice(
    invoiceId: string,
    organizationId: string,
    data: Prisma.InvoiceUpdateInput & { items?: CreateInvoiceItemInput[] }
  ): Promise<InvoiceWithAll> {
    const { items, ...updateData } = data;

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id: invoiceId, organizationId },
        data: updateData
      });

      if (items !== undefined) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: invoice.id }
        });

        if (items.length > 0) {
          await tx.invoiceItem.createMany({
            data: items.map(item => ({
              ...item,
              invoiceId: invoice.id
            }))
          });
        }
      }

      return tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: {
          items: true,
          client: { select: { id: true, name: true, gstin: true } },
          document: { select: { id: true, originalName: true } },
          submittedBy: { select: { id: true, fullName: true } },
          approvedBy: { select: { id: true, fullName: true } },
          rejectedBy: { select: { id: true, fullName: true } },
          reopenedBy: { select: { id: true, fullName: true } }
        }
      });
    });
  }

  async deleteInvoice(invoiceId: string, organizationId: string): Promise<void> {
    await prisma.invoice.deleteMany({
      where: { id: invoiceId, organizationId }
    });
  }

  async findInvoiceItems(invoiceId: string): Promise<Prisma.InvoiceItemGetPayload<{}>[]> {
    return prisma.invoiceItem.findMany({
      where: { invoiceId }
    });
  }

  async replaceInvoiceItems(
    invoiceId: string,
    items: CreateInvoiceItemInput[]
  ): Promise<Prisma.InvoiceItemGetPayload<{}>[]> {
    return prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({
        where: { invoiceId }
      });

      await tx.invoiceItem.createMany({
        data: items.map(item => ({
          ...item,
          invoiceId
        }))
      });

      return tx.invoiceItem.findMany({
        where: { invoiceId }
      });
    });
  }

  async checkInvoiceNumberExists(
    invoiceNumber: string,
    organizationId: string,
    excludeInvoiceId?: string
  ): Promise<boolean> {
    const where: Prisma.InvoiceWhereInput = {
      invoiceNumber,
      organizationId,
    };
    if (excludeInvoiceId) {
      where.id = { not: excludeInvoiceId };
    }

    const count = await prisma.invoice.count({ where });
    return count > 0;
  }

  async createAuditLog(data: {
    userId: string;
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
        ipAddress: data.ipAddress
      }
    });
  }
}

export const invoicesRepository = new InvoicesRepository();
