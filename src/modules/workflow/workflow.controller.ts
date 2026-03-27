// src/modules/workflow/workflow.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { workflowService } from './workflow.service';
import { RejectInvoiceInput, ReopenInvoiceInput } from './workflow.types';

export class WorkflowController {
  async submitInvoice(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { invoiceId } = request.params as { invoiceId: string };
    const ipAddress = request.ip || 'unknown';
    const result = await workflowService.submitInvoice(invoiceId, user.organizationId, user.userId, user.role, ipAddress);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async approveInvoice(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { invoiceId } = request.params as { invoiceId: string };
    const ipAddress = request.ip || 'unknown';
    const result = await workflowService.approveInvoice(invoiceId, user.organizationId, user.userId, user.role, ipAddress);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async rejectInvoice(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { invoiceId } = request.params as { invoiceId: string };
    const data = request.body as RejectInvoiceInput;
    const ipAddress = request.ip || 'unknown';
    const result = await workflowService.rejectInvoice(invoiceId, user.organizationId, user.userId, user.role, data, ipAddress);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async reopenInvoice(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { invoiceId } = request.params as { invoiceId: string };
    const data = request.body as ReopenInvoiceInput;
    const ipAddress = request.ip || 'unknown';
    const result = await workflowService.reopenInvoice(invoiceId, user.organizationId, user.userId, user.role, data, ipAddress);
    return reply.status(200).send({ status: 'success', data: result });
  }

  async getInvoiceHistory(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    const { invoiceId } = request.params as { invoiceId: string };
    const result = await workflowService.getInvoiceHistory(invoiceId, user.organizationId, user.userId, user.role);
    return reply.status(200).send({ status: 'success', data: result });
  }
}

export const workflowController = new WorkflowController();
