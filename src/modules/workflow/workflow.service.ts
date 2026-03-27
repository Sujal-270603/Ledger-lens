// src/modules/workflow/workflow.service.ts
import { workflowRepository, InvoiceWithWorkflowUsers } from './workflow.repository';
import { ledgerService } from '../ledger/ledger.service';
import { prisma } from '../../database/db'; // Used to check items count
import {
  WorkflowActionResponse,
  RejectInvoiceInput,
  ReopenInvoiceInput,
  InvoiceHistoryEntry
} from './workflow.types';
import { InvoiceStatus } from '../../types/prisma';
import { NotFoundError, UnprocessableError, ForbiddenError } from '../../errors';
import { isAdminRole, getAssignedClientIds } from '../../shared/access';

export class WorkflowService {
  private async getAccessFilter(
    userId: string,
    userRole: string
  ): Promise<string[] | null> {
    if (isAdminRole(userRole)) return null;
    return getAssignedClientIds(userId);
  }

  private validateTransition(
    invoice: { status: string },
    requiredStatus: InvoiceStatus | InvoiceStatus[],
    actionName: string
  ): void {
    const validStatuses = Array.isArray(requiredStatus) ? requiredStatus : [requiredStatus];
    if (!validStatuses.includes(invoice.status as InvoiceStatus)) {
      throw new UnprocessableError(`Cannot ${actionName} an invoice with status ${invoice.status}. Required status: ${validStatuses.join(' or ')}`);
    }
  }

  async submitInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string,
    userRole: string,
    ipAddress: string
  ): Promise<WorkflowActionResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const invoice = await workflowRepository.findInvoiceByIdAndOrg(invoiceId, organizationId, accessFilter);
    if (!invoice) throw new NotFoundError('Invoice');

    this.validateTransition(invoice, [InvoiceStatus.DRAFT, InvoiceStatus.REJECTED], 'submit');

    const itemsCount = await prisma.invoiceItem.count({ where: { invoiceId } });
    if (itemsCount === 0) {
      throw new UnprocessableError('Invoice must have at least one item before submitting');
    }

    if (!invoice.clientId) {
      throw new UnprocessableError('Invoice must have a client assigned before submitting. You can only submit invoices for your assigned clients.');
    }

    if (parseFloat(invoice.totalAmount.toString()) <= 0) {
      throw new UnprocessableError('Invoice total amount must be greater than 0');
    }

    const updated = await workflowRepository.submitInvoice(invoiceId, organizationId, userId);

    await workflowRepository.createAuditLog({
      userId,
      action: 'SUBMIT_INVOICE',
      resource: 'INVOICE',
      details: { invoiceId, fromStatus: invoice.status, toStatus: InvoiceStatus.SUBMITTED },
      ipAddress
    });

    return {
      invoiceId: updated.id,
      previousStatus: invoice.status as InvoiceStatus,
      currentStatus: InvoiceStatus.SUBMITTED,
      actionAt: updated.submittedAt!,
      actionBy: updated.submittedBy!,
      message: 'Invoice submitted for approval successfully.'
    };
  }

  async approveInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string,
    userRole: string,
    ipAddress: string
  ): Promise<WorkflowActionResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const invoice = await workflowRepository.findInvoiceByIdAndOrg(invoiceId, organizationId, accessFilter);
    if (!invoice) throw new NotFoundError('Invoice');

    this.validateTransition(invoice, [InvoiceStatus.SUBMITTED], 'approve');

    if (invoice.submittedById === userId) {
      throw new UnprocessableError('You cannot approve an invoice you submitted.');
    }

    const updated = await workflowRepository.approveInvoice(invoiceId, organizationId, userId);

    // Auto-create journal entry for approved invoice
    await ledgerService.createAutoJournalEntry(updated as any, organizationId);

    await workflowRepository.createAuditLog({
      userId,
      action: 'APPROVE_INVOICE',
      resource: 'INVOICE',
      details: { invoiceId, fromStatus: invoice.status, toStatus: InvoiceStatus.APPROVED },
      ipAddress
    });

    return {
      invoiceId: updated.id,
      previousStatus: invoice.status as InvoiceStatus,
      currentStatus: InvoiceStatus.APPROVED,
      actionAt: updated.approvedAt!,
      actionBy: updated.approvedBy!,
      message: 'Invoice approved successfully.'
    };
  }

  async rejectInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string,
    userRole: string,
    input: RejectInvoiceInput,
    ipAddress: string
  ): Promise<WorkflowActionResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const invoice = await workflowRepository.findInvoiceByIdAndOrg(invoiceId, organizationId, accessFilter);
    if (!invoice) throw new NotFoundError('Invoice');

    this.validateTransition(invoice, [InvoiceStatus.SUBMITTED], 'reject');

    const updated = await workflowRepository.rejectInvoice(invoiceId, organizationId, userId, input.rejectionReason);

    await workflowRepository.createAuditLog({
      userId,
      action: 'REJECT_INVOICE',
      resource: 'INVOICE',
      details: { invoiceId, fromStatus: invoice.status, toStatus: InvoiceStatus.REJECTED, rejectionReason: input.rejectionReason },
      ipAddress
    });

    return {
      invoiceId: updated.id,
      previousStatus: invoice.status as InvoiceStatus,
      currentStatus: InvoiceStatus.REJECTED,
      actionAt: updated.rejectedAt!,
      actionBy: updated.rejectedBy!,
      message: 'Invoice rejected successfully.'
    };
  }

  async reopenInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string,
    userRole: string,
    input: ReopenInvoiceInput,
    ipAddress: string
  ): Promise<WorkflowActionResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const invoice = await workflowRepository.findInvoiceByIdAndOrg(invoiceId, organizationId, accessFilter);
    if (!invoice) throw new NotFoundError('Invoice');

    this.validateTransition(invoice, [InvoiceStatus.APPROVED], 'reopen');

    const updated = await workflowRepository.reopenInvoice(invoiceId, organizationId, userId, input.reopenReason);

    await workflowRepository.createAuditLog({
      userId,
      action: 'REOPEN_INVOICE',
      resource: 'INVOICE',
      details: { invoiceId, fromStatus: invoice.status, toStatus: InvoiceStatus.DRAFT, reopenReason: input.reopenReason },
      ipAddress
    });

    return {
      invoiceId: updated.id,
      previousStatus: invoice.status as InvoiceStatus,
      currentStatus: InvoiceStatus.DRAFT,
      actionAt: updated.reopenedAt!,
      actionBy: updated.reopenedBy!,
      message: 'Invoice reopened to draft successfully.'
    };
  }

  async getInvoiceHistory(
    invoiceId: string,
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<InvoiceHistoryEntry[]> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const invoice = await workflowRepository.findInvoiceByIdAndOrg(invoiceId, organizationId, accessFilter);
    if (!invoice) throw new NotFoundError('Invoice');

    const logs = await workflowRepository.findInvoiceHistory(invoiceId, organizationId);

    return logs.map(log => {
      const details = log.details as any || {};
      return {
        action: log.action,
        fromStatus: details.fromStatus || null,
        toStatus: details.toStatus || log.action,
        performedBy: log.user ? {
          id: log.user.id,
          fullName: log.user.fullName,
          email: log.user.email
        } : null,
        details,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt
      };
    });
  }
}

export const workflowService = new WorkflowService();
