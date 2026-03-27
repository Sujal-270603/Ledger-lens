// src/modules/invoices/invoices.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { invoicesService } from './invoices.service';
import {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceFilters,
  CreateInvoiceItemInput
} from './invoices.types';

export class InvoicesController {
  async listInvoices(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const filters = request.query as InvoiceFilters;
    const result = await invoicesService.listInvoices(user.organizationId, user.userId, user.role, filters);
    return reply.status(200).send(result);
  }

  async createInvoice(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const data = request.body as CreateInvoiceInput;
    const result = await invoicesService.createInvoice(user.organizationId, user.userId, user.role, data);
    return reply.status(201).send({ status: 'success', data: result });
  }

  async getInvoiceById(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { invoiceId } = request.params as { invoiceId: string };
    const result = await invoicesService.getInvoiceById(invoiceId, user.organizationId, user.userId, user.role);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async updateInvoice(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { invoiceId } = request.params as { invoiceId: string };
    const data = request.body as UpdateInvoiceInput;
    const result = await invoicesService.updateInvoice(invoiceId, user.organizationId, user.userId, user.role, data);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async deleteInvoice(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { invoiceId } = request.params as { invoiceId: string };
    await invoicesService.deleteInvoice(invoiceId, user.organizationId, user.userId, user.role);
    return reply.status(204).send();
  }

  async getInvoiceItems(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { invoiceId } = request.params as { invoiceId: string };
    const result = await invoicesService.getInvoiceItems(invoiceId, user.organizationId, user.userId, user.role);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async replaceInvoiceItems(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { invoiceId } = request.params as { invoiceId: string };
    const { items } = request.body as { items: CreateInvoiceItemInput[] };
    const result = await invoicesService.replaceInvoiceItems(invoiceId, user.organizationId, user.userId, user.role, items);
    return reply.status(200).send({ status: 'success', data: result });
  }
}

export const invoicesController = new InvoicesController();
