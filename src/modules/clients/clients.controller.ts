// src/modules/clients/clients.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { clientsService } from './clients.service';
import {
  CreateClientInput,
  UpdateClientInput,
  ClientFilters,
  ClientInvoiceFilters,
  AssignUserInput
} from './clients.types';

export class ClientsController {
  async listClients(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const filters = request.query as ClientFilters;
    const result = await clientsService.listClients(user.organizationId, user.userId, user.role, filters);
    return reply.status(200).send(result);
  }

  async createClient(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const data = request.body as CreateClientInput;
    const result = await clientsService.createClient(user.organizationId, user.userId, user.role, data);
    return reply.status(201).send(result);
  }

  async getClientById(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { clientId } = request.params as { clientId: string };
    const result = await clientsService.getClientById(clientId, user.organizationId, user.userId, user.role);
    return reply.status(200).send(result);
  }

  async updateClient(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { clientId } = request.params as { clientId: string };
    const data = request.body as UpdateClientInput;
    const result = await clientsService.updateClient(clientId, user.organizationId, user.userId, user.role, data);
    return reply.status(200).send(result);
  }

  async deleteClient(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { clientId } = request.params as { clientId: string };
    await clientsService.deleteClient(clientId, user.organizationId, user.userId, user.role);
    return reply.status(204).send();
  }

  async getClientInvoices(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { clientId } = request.params as { clientId: string };
    const filters = request.query as ClientInvoiceFilters;
    const result = await clientsService.getClientInvoices(clientId, user.organizationId, user.userId, user.role, filters);
    return reply.status(200).send(result);
  }

  async assignUserToClient(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { clientId } = request.params as { clientId: string };
    const data = request.body as AssignUserInput;
    const result = await clientsService.assignUserToClient(clientId, user.organizationId, user.userId, data);
    return reply.status(200).send(result);
  }

  async removeUserFromClient(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { clientId, userId: targetUserId } = request.params as { clientId: string, userId: string };
    await clientsService.removeUserFromClient(clientId, user.organizationId, user.userId, targetUserId);
    return reply.status(204).send();
  }
}

export const clientsController = new ClientsController();
