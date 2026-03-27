// src/modules/ai-processing/ai-processing.repository.ts
import { prisma } from '../../database/db';
import { Prisma, Document, Invoice, Client } from '@prisma/client';
import { InvoiceStatus } from '../../types/prisma';

export type DocumentWithInvoice = Prisma.DocumentGetPayload<{
  include: {
    invoices: {
      select: {
        id: true;
        status: true;
        confidenceScore: true;
        aiMetadata: true;
        invoiceNumber: true;
        totalAmount: true;
        gstAmount: true;
        cgstAmount: true;
        sgstAmount: true;
        igstAmount: true;
        invoiceDate: true;
        items: true;
        clientId: true;
      };
    };
  };
}>;

export class AIProcessingRepository {
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
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            confidenceScore: true,
            aiMetadata: true,
            invoiceNumber: true,
            totalAmount: true,
            gstAmount: true,
            cgstAmount: true,
            sgstAmount: true,
            igstAmount: true,
            invoiceDate: true,
            items: true,
            clientId: true,
          }
        }
      }
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

  async findDocumentById(documentId: string): Promise<DocumentWithInvoice | null> {
    return prisma.document.findUnique({
      where: { id: documentId },
      include: {
        invoices: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            confidenceScore: true,
            aiMetadata: true,
            invoiceNumber: true,
            totalAmount: true,
            gstAmount: true,
            cgstAmount: true,
            sgstAmount: true,
            igstAmount: true,
            invoiceDate: true,
            items: true,
            clientId: true,
          }
        }
      }
    });
  }

  async createInvoiceFromExtraction(data: {
    organizationId: string;
    documentId: string;
    invoiceNumber: string;
    invoiceDate: Date;
    totalAmount: number;
    gstAmount: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    confidenceScore: number;
    aiMetadata: object;
    items: {
      description: string;
      hsnCode?: string | null;
      quantity: number;
      unitPrice: number;
      amount: number;
      taxRate: number;
    }[];
    clientId?: string;
    status?: InvoiceStatus;
  }): Promise<Invoice> {
    const { items, ...invoiceData } = data;

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          ...invoiceData,
          status: invoiceData.status || InvoiceStatus.DRAFT,
          aiMetadata: invoiceData.aiMetadata as any,
        }
      });

      if (items.length > 0) {
        await tx.invoiceItem.createMany({
          data: items.map(item => ({
            ...item,
            invoiceId: invoice.id
          }))
        });
      }

      return invoice;
    });
  }

  async updateInvoiceAIMetadata(
    invoiceId: string,
    aiMetadata: object,
    status?: InvoiceStatus
  ): Promise<void> {
    const data: Prisma.InvoiceUpdateInput = { aiMetadata: aiMetadata as any };
    if (status) {
      data.status = status;
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data
    });
  }

  async updateInvoiceFromAcceptedExtraction(
    invoiceId: string,
    organizationId: string,
    data: {
      status?: InvoiceStatus;
      invoiceNumber?: string;
      invoiceDate?: Date;
      clientId?: string;
      totalAmount?: number;
      gstAmount?: number;
      cgstAmount?: number;
      sgstAmount?: number;
      igstAmount?: number;
    }
  ): Promise<Invoice> {
    return prisma.invoice.update({
      where: { id: invoiceId, organizationId },
      data
    });
  }

  async findOrCreateClientByName(
    name: string,
    gstin: string | null,
    organizationId: string
  ): Promise<Client> {
    if (gstin) {
      const existing = await prisma.client.findFirst({
        where: { gstin, organizationId }
      });
      if (existing) return existing;
    }

    return prisma.client.create({
      data: {
        name,
        gstin,
        organizationId
      }
    });
  }

  async createAuditLog(data: {
    userId?: string;
    action: string;
    resource: string;
    details?: object;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        resource: data.resource,
        details: data.details ? (data.details as any) : undefined
      }
    });
  }
}

export const aiProcessingRepository = new AIProcessingRepository();
