// src/modules/clients/clients.repository.ts
import { prisma } from '../../database/db';
import { Prisma, Client } from '@prisma/client';
import { ClientFilters, ClientInvoiceFilters } from './clients.types';

export class ClientsRepository {
  async findClientsByOrganization(
    organizationId: string,
    filters: ClientFilters,
    accessClientIds: string[] | null
  ): Promise<{ clients: any[]; total: number }> {
    const where: Prisma.ClientWhereInput = {
      organizationId,
    };

    if (accessClientIds !== null) {
      if (accessClientIds.length === 0) {
        return { clients: [], total: 0 };
      }
      where.id = { in: accessClientIds };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { gstin: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [clients, total] = await prisma.$transaction([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { invoices: true }
          }
        }
      }),
      prisma.client.count({ where }),
    ]);

    return { clients, total };
  }

  async findClientByIdAndOrg(
    clientId: string,
    organizationId: string,
    accessClientIds: string[] | null = null
  ): Promise<any | null> {
    if (accessClientIds !== null && !accessClientIds.includes(clientId)) {
      return null;
    }

    return prisma.client.findFirst({
      where: { id: clientId, organizationId },
      include: {
        _count: {
          select: { invoices: true }
        },
        invoices: {
          take: 5,
          orderBy: { invoiceDate: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
            gstAmount: true,
            status: true
          }
        },
        userAccess: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: { select: { name: true } }
              }
            }
          }
        }
      }
    });
  }

  async findClientByGstinAndOrg(gstin: string, organizationId: string): Promise<Client | null> {
    return prisma.client.findFirst({
      where: { gstin, organizationId }
    });
  }

  async createClient(data: {
    name: string;
    organizationId: string;
    gstin?: string | null;
    email?: string | null;
    phone?: string | null;
  }): Promise<Client> {
    return prisma.client.create({
      data: {
        name: data.name,
        organizationId: data.organizationId,
        gstin: data.gstin || null,
        email: data.email || null,
        phone: data.phone || null,
      }
    });
  }

  async updateClient(clientId: string, organizationId: string, data: Prisma.ClientUpdateInput): Promise<Client> {
    return prisma.client.update({
      where: {
        id: clientId,
        organizationId: organizationId // Double-checking via unique constraint if possible, but update requires unique identifier.
        // Prisma update requires unique where. id is unique.
      },
      data
    });
  }

  async deleteClient(clientId: string, organizationId: string): Promise<void> {
    // We only pass id because it's the unique identifier. We ensure organizationId match before calling this in the service layer.
    await prisma.client.delete({
      where: { id: clientId }
    });
  }

  async hasApprovedInvoices(clientId: string, organizationId: string): Promise<boolean> {
    const count = await prisma.invoice.count({
      where: {
        clientId,
        organizationId,
        status: 'APPROVED'
      }
    });
    return count > 0;
  }

  async findClientInvoices(
    clientId: string,
    organizationId: string,
    filters: ClientInvoiceFilters
  ): Promise<{ invoices: any[]; total: number }> {
    const where: Prisma.InvoiceWhereInput = {
      clientId,
      organizationId,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' }
      }),
      prisma.invoice.count({ where })
    ]);

    return { invoices, total };
  }

  async findUserClientAccess(userId: string, clientId: string): Promise<any | null> {
    return prisma.userClientAccess.findUnique({
      where: {
        userId_clientId: {
          userId,
          clientId
        }
      }
    });
  }

  async assignUserToClient(userId: string, clientId: string): Promise<void> {
    await prisma.userClientAccess.upsert({
      where: {
        userId_clientId: {
          userId,
          clientId
        }
      },
      update: {},
      create: {
        userId,
        clientId
      }
    });
  }

  async removeUserFromClient(userId: string, clientId: string, organizationId: string): Promise<void> {
    // organizationId is handled in service to ensure client belongs to org
    await prisma.userClientAccess.delete({
      where: {
        userId_clientId: {
          userId,
          clientId
        }
      }
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

export const clientsRepository = new ClientsRepository();
