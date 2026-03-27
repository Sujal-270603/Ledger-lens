import { clientsRepository } from './clients.repository';
import { usersRepository } from '../users/users.repository';
import { ledgerService } from '../ledger/ledger.service';
import {
  CreateClientInput,
  UpdateClientInput,
  ClientFilters,
  ClientInvoiceFilters,
  ClientResponse,
  ClientDetailResponse
} from './clients.types';
import { PaginatedResponse } from '../../shared/types';
import { NotFoundError, ConflictError, ForbiddenError, UnprocessableError } from '../../errors';
import { Prisma } from '@prisma/client';
import { isAdminRole, getAssignedClientIds } from '../../shared/access';

export class ClientsService {
  private async getAccessFilter(
    userId: string,
    userRole: string
  ): Promise<string[] | null> {
    if (isAdminRole(userRole)) return null;
    return getAssignedClientIds(userId);
  }

  async listClients(
    organizationId: string,
    userId: string,
    userRole: string,
    filters: ClientFilters
  ): Promise<PaginatedResponse<ClientResponse>> {
    const accessFilter = await this.getAccessFilter(userId, userRole);

    const { clients, total } = await clientsRepository.findClientsByOrganization(
      organizationId,
      filters,
      accessFilter
    );

    const limit = filters.limit || 20;
    const page = filters.page || 1;

    const data: ClientResponse[] = clients.map(client => ({
      id: client.id,
      name: client.name,
      gstin: client.gstin,
      email: client.email,
      phone: client.phone,
      organizationId: client.organizationId,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      _count: {
        invoices: client._count.invoices
      }
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

  async createClient(
    organizationId: string,
    userId: string,
    userRole: string,
    input: CreateClientInput
  ): Promise<ClientResponse> {
    // Only admins or people with permission can create clients (handled by middleware)
    // We don't apply access filter to creation, but we might want to automatically 
    // assign the creator to the client if they are not an admin.
    
    if (input.gstin) {
      const existing = await clientsRepository.findClientByGstinAndOrg(input.gstin, organizationId);
      if (existing) {
        throw new ConflictError('A client with this GSTIN already exists in your organization');
      }
    }

    const newClient = await clientsRepository.createClient({
      name: input.name,
      gstin: input.gstin,
      email: input.email,
      phone: input.phone,
      organizationId,
    });

    // If non-admin created it, assign them access
    if (!isAdminRole(userRole)) {
      await clientsRepository.assignUserToClient(userId, newClient.id);
    }

    // Seed default ledgers for the new client
    await ledgerService.createDefaultLedgers(newClient.id, organizationId);

    await clientsRepository.createAuditLog({
      userId,
      action: 'CREATE_CLIENT',
      resource: 'CLIENT',
      details: { clientId: newClient.id, name: newClient.name }
    });

    return {
      id: newClient.id,
      name: newClient.name,
      gstin: newClient.gstin,
      email: newClient.email,
      phone: newClient.phone,
      organizationId: newClient.organizationId,
      createdAt: newClient.createdAt,
      updatedAt: newClient.updatedAt,
      _count: {
        invoices: 0
      }
    };
  }

  async getClientById(
    clientId: string,
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<ClientDetailResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    
    const client = await clientsRepository.findClientByIdAndOrg(clientId, organizationId, accessFilter);
    if (!client) {
      throw new NotFoundError('Client');
    }

    return {
      id: client.id,
      name: client.name,
      gstin: client.gstin,
      email: client.email,
      phone: client.phone,
      organizationId: client.organizationId,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      _count: {
        invoices: client._count.invoices
      },
      recentInvoices: client.invoices.map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        totalAmount: inv.totalAmount.toString(),
        gstAmount: inv.gstAmount.toString(),
        status: inv.status
      })),
      assignedUsers: client.userAccess.map((ua: any) => ({
        id: ua.user.id,
        fullName: ua.user.fullName,
        email: ua.user.email,
        role: ua.user.role.name
      }))
    };
  }

  async updateClient(
    clientId: string,
    organizationId: string,
    userId: string,
    userRole: string,
    input: UpdateClientInput
  ): Promise<ClientResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const client = await clientsRepository.findClientByIdAndOrg(clientId, organizationId, accessFilter);
    if (!client) {
      throw new NotFoundError('Client');
    }

    if (input.gstin && input.gstin !== client.gstin) {
      const existing = await clientsRepository.findClientByGstinAndOrg(input.gstin, organizationId);
      if (existing && existing.id !== clientId) {
        throw new ConflictError('A client with this GSTIN already exists in your organization');
      }
    }

    const updateData: Prisma.ClientUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.gstin !== undefined) updateData.gstin = input.gstin;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;

    const updatedClient = await clientsRepository.updateClient(clientId, organizationId, updateData);

    await clientsRepository.createAuditLog({
      userId,
      action: 'UPDATE_CLIENT',
      resource: 'CLIENT',
      details: { clientId, updates: input }
    });

    const refreshedClient = await clientsRepository.findClientByIdAndOrg(clientId, organizationId, accessFilter);

    return {
      id: refreshedClient.id,
      name: refreshedClient.name,
      gstin: refreshedClient.gstin,
      email: refreshedClient.email,
      phone: refreshedClient.phone,
      organizationId: refreshedClient.organizationId,
      createdAt: refreshedClient.createdAt,
      updatedAt: refreshedClient.updatedAt,
      _count: {
        invoices: refreshedClient._count.invoices
      }
    };
  }

  async deleteClient(
    clientId: string,
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<void> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const client = await clientsRepository.findClientByIdAndOrg(clientId, organizationId, accessFilter);
    if (!client) {
      throw new NotFoundError('Client');
    }

    const hasApproved = await clientsRepository.hasApprovedInvoices(clientId, organizationId);
    if (hasApproved) {
      throw new UnprocessableError('Cannot delete a client that has approved invoices');
    }

    await clientsRepository.deleteClient(clientId, organizationId);

    await clientsRepository.createAuditLog({
      userId,
      action: 'DELETE_CLIENT',
      resource: 'CLIENT',
      details: { clientId, name: client.name }
    });
  }

  async getClientInvoices(
    clientId: string,
    organizationId: string,
    userId: string,
    userRole: string,
    filters: ClientInvoiceFilters
  ): Promise<PaginatedResponse<any>> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const client = await clientsRepository.findClientByIdAndOrg(clientId, organizationId, accessFilter);
    if (!client) {
      throw new NotFoundError('Client');
    }

    const { invoices, total } = await clientsRepository.findClientInvoices(clientId, organizationId, filters);
    const limit = filters.limit || 20;
    const page = filters.page || 1;

    const data = invoices.map(inv => ({
      ...inv,
      totalAmount: inv.totalAmount.toString(),
      gstAmount: inv.gstAmount.toString(),
      cgstAmount: inv.cgstAmount ? inv.cgstAmount.toString() : null,
      sgstAmount: inv.sgstAmount ? inv.sgstAmount.toString() : null,
      igstAmount: inv.igstAmount ? inv.igstAmount.toString() : null,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  async assignUserToClient(
    clientId: string,
    organizationId: string,
    requestingUserId: string,
    input: { userId: string }
  ): Promise<{ message: string }> {
    // Admin only action (handled by permission middleware)
    const client = await clientsRepository.findClientByIdAndOrg(clientId, organizationId);
    if (!client) {
      throw new NotFoundError('Client');
    }

    const targetUser = await usersRepository.findUserByIdAndOrg(input.userId, organizationId);
    if (!targetUser) {
      throw new NotFoundError('User');
    }

    await clientsRepository.assignUserToClient(input.userId, clientId);

    await clientsRepository.createAuditLog({
      userId: requestingUserId,
      action: 'ASSIGN_USER_TO_CLIENT',
      resource: 'CLIENT',
      details: { clientId, assignedUserId: input.userId }
    });

    return { message: 'User assigned to client successfully' };
  }

  async removeUserFromClient(
    clientId: string,
    organizationId: string,
    requestingUserId: string,
    targetUserId: string
  ): Promise<void> {
    // Admin only action (handled by permission middleware)
    const client = await clientsRepository.findClientByIdAndOrg(clientId, organizationId);
    if (!client) {
      throw new NotFoundError('Client');
    }

    // Checking if the access actually exists
    const access = await clientsRepository.findUserClientAccess(targetUserId, clientId);
    if (!access) {
      throw new NotFoundError('User access');
    }

    await clientsRepository.removeUserFromClient(targetUserId, clientId, organizationId);

    await clientsRepository.createAuditLog({
      userId: requestingUserId,
      action: 'REMOVE_USER_FROM_CLIENT',
      resource: 'CLIENT',
      details: { clientId, removedUserId: targetUserId }
    });
  }
}

export const clientsService = new ClientsService();
