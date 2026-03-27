// src/modules/documents/documents.repository.ts
import { prisma } from '../../database/db';
import { Document, UsageQuota, Prisma } from '@prisma/client';
import { DocumentFilters } from './documents.types';

export type DocumentWithInvoice = Prisma.DocumentGetPayload<{
  include: {
    invoices: {
      take: 1;
      select: {
        id: true;
        status: true;
        aiMetadata: true;
      };
    };
  };
}>;

export class DocumentsRepository {
  async createDocument(data: {
    id: string;
    s3Key: string;
    originalName: string;
    mimeType: string;
    size: number;
    organizationId: string;
    uploadedBy: string | null;
  }): Promise<Document> {
    return prisma.document.create({
      data,
    });
  }

  async findDocumentsByOrganization(
    organizationId: string,
    filters: DocumentFilters,
    userId: string | null = null,
    accessClientIds: string[] | null = null
  ): Promise<{ documents: DocumentWithInvoice[]; total: number }> {
    const where: Prisma.DocumentWhereInput = {
      organizationId,
    };

    if (userId !== null && accessClientIds !== null) {
      where.OR = [
        { uploadedBy: userId },
        { invoices: { some: { clientId: { in: accessClientIds } } } }
      ];
    }

    if (filters.clientId) {
      // If user is restricted, ensure filters.clientId is in accessClientIds
      if (accessClientIds !== null && !accessClientIds.includes(filters.clientId)) {
        return { documents: [], total: 0 };
      }
      
      where.invoices = {
        some: {
          clientId: filters.clientId,
        },
      };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [documents, total] = await prisma.$transaction([
      prisma.document.findMany({
        where,
        include: {
          invoices: {
            take: 1,
            select: {
              id: true,
              status: true,
              aiMetadata: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.count({ where }),
    ]);

    return { documents, total };
  }

  async findDocumentByIdAndOrg(
    documentId: string,
    organizationId: string,
    userId: string | null = null,
    accessClientIds: string[] | null = null
  ): Promise<DocumentWithInvoice | null> {
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId },
      include: {
        invoices: {
          take: 1,
          select: {
            id: true,
            clientId: true,
            status: true,
            aiMetadata: true,
          },
        },
      },
    });

    if (!document) return null;

    if (userId !== null && accessClientIds !== null) {
      const isUploader = document.uploadedBy === userId;
      const hasInvoiceAccess = document.invoices.some(inv => inv.clientId && accessClientIds.includes(inv.clientId));
      
      if (!isUploader && !hasInvoiceAccess) {
        return null;
      }
    }

    return document;
  }

  async findUsageQuota(organizationId: string): Promise<UsageQuota | null> {
    return prisma.usageQuota.findUnique({
      where: { organizationId },
    });
  }

  async incrementQuotaUsage(organizationId: string): Promise<void> {
    await prisma.usageQuota.update({
      where: { organizationId },
      data: { invoicesProcessed: { increment: 1 } },
    });
  }

  async deleteDocument(documentId: string, organizationId: string): Promise<void> {
    await prisma.document.deleteMany({
      where: { id: documentId, organizationId },
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
        ipAddress: data.ipAddress,
      },
    });
  }
}

export const documentsRepository = new DocumentsRepository();
