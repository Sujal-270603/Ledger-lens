// src/modules/workflow/workflow.repository.ts
import { prisma } from '../../database/db';
import { Prisma } from '@prisma/client';
import { InvoiceStatus } from '../../types/prisma';

export type InvoiceWithWorkflowUsers = Prisma.InvoiceGetPayload<{
  include: {
    submittedBy: { select: { id: true; fullName: true; email: true } };
    approvedBy: { select: { id: true; fullName: true; email: true } };
    rejectedBy: { select: { id: true; fullName: true; email: true } };
    reopenedBy: { select: { id: true; fullName: true; email: true } };
    client: { select: { id: true; name: true } };
  };
}>;

export type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: {
    user: { select: { id: true; fullName: true; email: true } };
  };
}>;

export class WorkflowRepository {
  async findInvoiceByIdAndOrg(
    invoiceId: string,
    organizationId: string,
    accessClientIds: string[] | null = null
  ): Promise<InvoiceWithWorkflowUsers | null> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
        rejectedBy: { select: { id: true, fullName: true, email: true } },
        reopenedBy: { select: { id: true, fullName: true, email: true } },
        client: { select: { id: true, name: true } },
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

  async submitInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string
  ): Promise<InvoiceWithWorkflowUsers> {
    return prisma.invoice.update({
      where: { id: invoiceId, organizationId },
      data: {
        status: InvoiceStatus.SUBMITTED,
        submittedAt: new Date(),
        submittedById: userId
      },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
        rejectedBy: { select: { id: true, fullName: true, email: true } },
        reopenedBy: { select: { id: true, fullName: true, email: true } },
        client: { select: { id: true, name: true } },
      }
    });
  }

  async approveInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string
  ): Promise<InvoiceWithWorkflowUsers> {
    return prisma.invoice.update({
      where: { id: invoiceId, organizationId },
      data: {
        status: InvoiceStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: userId
      },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
        rejectedBy: { select: { id: true, fullName: true, email: true } },
        reopenedBy: { select: { id: true, fullName: true, email: true } },
        client: { select: { id: true, name: true } },
      }
    });
  }

  async rejectInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string,
    rejectionReason: string
  ): Promise<InvoiceWithWorkflowUsers> {
    return prisma.invoice.update({
      where: { id: invoiceId, organizationId },
      data: {
        status: InvoiceStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedById: userId,
        rejectionReason
      },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
        rejectedBy: { select: { id: true, fullName: true, email: true } },
        reopenedBy: { select: { id: true, fullName: true, email: true } },
        client: { select: { id: true, name: true } },
      }
    });
  }

  async reopenInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string,
    reopenReason: string
  ): Promise<InvoiceWithWorkflowUsers> {
    return prisma.invoice.update({
      where: { id: invoiceId, organizationId },
      data: {
        status: InvoiceStatus.DRAFT,
        reopenedAt: new Date(),
        reopenedById: userId,
        reopenReason,
        approvedAt: null,
        approvedById: null
      },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
        rejectedBy: { select: { id: true, fullName: true, email: true } },
        reopenedBy: { select: { id: true, fullName: true, email: true } },
        client: { select: { id: true, name: true } },
      }
    });
  }

  async findInvoiceHistory(
    invoiceId: string,
    organizationId: string
  ): Promise<AuditLogWithUser[]> {
    return prisma.auditLog.findMany({
      where: {
        resource: 'INVOICE',
        details: { path: ['invoiceId'], equals: invoiceId },
        user: { organizationId }
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
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

export const workflowRepository = new WorkflowRepository();
