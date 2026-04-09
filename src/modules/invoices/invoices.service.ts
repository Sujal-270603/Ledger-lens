// src/modules/invoices/invoices.service.ts
import { invoicesRepository, InvoiceWithAll } from './invoices.repository';
import { prisma } from '../../database/db';
import {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceFilters,
  InvoiceResponse,
  InvoiceListItem,
  InvoiceItemResponse,
  CreateInvoiceItemInput
} from './invoices.types';
import { InvoiceStatus } from '../../types/prisma';
import { PaginatedResponse } from '../../shared/types';
import { NotFoundError, UnprocessableError, ValidationError, BadRequestError, ConflictError, ForbiddenError } from '../../errors';
import { isAdminRole, getAssignedClientIds } from '../../shared/access';

export class InvoicesService {
  private async getAccessFilter(
    userId: string,
    userRole: string
  ): Promise<string[] | null> {
    if (isAdminRole(userRole)) return null;
    return getAssignedClientIds(userId);
  }

  private validateAmounts(input: CreateInvoiceInput | UpdateInvoiceInput): void {
    if (input.items && input.items.length > 0) {
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const expectedAmount = item.quantity * item.unitPrice;
        if (Math.abs(expectedAmount - item.amount) > 0.01) {
          throw new ValidationError('Validation Error', [
            { field: `items.${i}.amount`, message: `Amount must equal quantity (${item.quantity}) * unitPrice (${item.unitPrice})` }
          ]);
        }
      }
    }

    const cgstDefined = input.cgstAmount !== undefined && input.cgstAmount !== null;
    const sgstDefined = input.sgstAmount !== undefined && input.sgstAmount !== null;
    const igstDefined = input.igstAmount !== undefined && input.igstAmount !== null;
    
    // Default to existing or 0 if undefined for update validation if not present
    const cgst = input.cgstAmount || 0;
    const sgst = input.sgstAmount || 0;
    const igst = input.igstAmount || 0;
    const gst = input.gstAmount !== undefined ? input.gstAmount : undefined;

    if ((cgstDefined || sgstDefined) && igstDefined) {
      throw new BadRequestError('Cannot have both CGST/SGST and IGST on the same invoice');
    }

    if ((cgstDefined && !sgstDefined) || (!cgstDefined && sgstDefined)) {
      throw new BadRequestError('CGST and SGST must both be provided together');
    }

    if (gst !== undefined) {
      if (cgstDefined && sgstDefined) {
        if (Math.abs(cgst + sgst - gst) > 0.01) {
          throw new ValidationError('Validation Error', [{ field: 'gstAmount', message: 'GST amount must equal CGST + SGST' }]);
        }
      } else if (igstDefined) {
        if (Math.abs(igst - gst) > 0.01) {
          throw new ValidationError('Validation Error', [{ field: 'gstAmount', message: 'GST amount must equal IGST' }]);
        }
      }
    }

    if (input.totalAmount !== undefined && input.items) {
      let sumItems = 0;
      for (const item of input.items) {
        sumItems += item.amount;
      }
      
      const combinedGst = gst !== undefined ? gst : 0;
      if (Math.abs(sumItems + combinedGst - input.totalAmount) > 0.01) {
        throw new ValidationError('Validation Error', [{ field: 'totalAmount', message: 'Total amount must equal sum of items amount + GST amount' }]);
      }
    }
  }

  private mapToInvoiceResponse(invoice: InvoiceWithAll): InvoiceResponse {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      totalAmount: invoice.totalAmount.toString(),
      gstAmount: invoice.gstAmount.toString(),
      cgstAmount: invoice.cgstAmount?.toString() || null,
      sgstAmount: invoice.sgstAmount?.toString() || null,
      igstAmount: invoice.igstAmount?.toString() || null,
      status: invoice.status as InvoiceStatus,
      syncStatus: invoice.syncStatus,
      confidenceScore: invoice.confidenceScore,
      organizationId: invoice.organizationId,
      clientId: invoice.clientId,
      documentId: invoice.documentId,
      client: invoice.client ? {
        id: invoice.client.id,
        name: invoice.client.name,
        gstin: invoice.client.gstin
      } : null,
      items: invoice.items.map((item: any) => ({
        id: item.id,
        description: item.description,
        hsnCode: item.hsnCode,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        amount: item.amount.toString(),
        taxRate: item.taxRate.toString(),
        ledgerId: item.ledgerId,
        creditLedgerId: item.creditLedgerId,
        ledger: item.ledger ? {
          id: item.ledger.id,
          name: item.ledger.name
        } : undefined,
        creditLedger: item.creditLedger ? {
          id: item.creditLedger.id,
          name: item.creditLedger.name
        } : undefined
      })),
      submittedAt: invoice.submittedAt,
      approvedAt: invoice.approvedAt,
      rejectedAt: invoice.rejectedAt,
      rejectionReason: invoice.rejectionReason,
      reopenedAt: invoice.reopenedAt,
      reopenReason: invoice.reopenReason,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt
    };
  }

  private mapToInvoiceListItem(invoice: any): InvoiceListItem {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      totalAmount: invoice.totalAmount.toString(),
      gstAmount: invoice.gstAmount.toString(),
      status: invoice.status as InvoiceStatus,
      syncStatus: invoice.syncStatus,
      clientId: invoice.clientId,
      client: invoice.client ? {
        id: invoice.client.id,
        name: invoice.client.name
      } : null,
      createdAt: invoice.createdAt
    };
  }

  private async validateClientExists(clientId: string, organizationId: string): Promise<void> {
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId }
    });
    if (!client) {
      throw new NotFoundError('Client');
    }
  }

  private async validateDocumentExists(documentId: string, organizationId: string): Promise<void> {
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId }
    });
    if (!document) {
      throw new NotFoundError('Document');
    }
  }

  async createInvoice(
    organizationId: string,
    userId: string,
    userRole: string,
    input: CreateInvoiceInput
  ): Promise<InvoiceResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    
    if (accessFilter !== null) {
      if (!input.clientId) {
        throw new UnprocessableError(
          'You must assign a client to this invoice. You can only create invoices for your assigned clients.'
        );
      }
      if (!accessFilter.includes(input.clientId)) {
        throw new ForbiddenError('You are not assigned to this client');
      }
    }

    this.validateAmounts(input);

    const exists = await invoicesRepository.checkInvoiceNumberExists(input.invoiceNumber, organizationId);
    if (exists) {
      throw new ConflictError('Invoice number already exists');
    }

    if (input.clientId) await this.validateClientExists(input.clientId, organizationId);
    if (input.documentId) await this.validateDocumentExists(input.documentId, organizationId);

    const invoice = await invoicesRepository.createInvoice({
      ...input,
      invoiceDate: new Date(input.invoiceDate),
      status: InvoiceStatus.DRAFT,
      organizationId,
    });

    await invoicesRepository.createAuditLog({
      userId,
      action: 'CREATE_INVOICE',
      resource: 'INVOICE',
      details: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber }
    });

    return this.mapToInvoiceResponse(invoice);
  }

  async listInvoices(
    organizationId: string,
    userId: string,
    userRole: string,
    filters: InvoiceFilters
  ): Promise<PaginatedResponse<InvoiceListItem>> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const { invoices, total } = await invoicesRepository.findInvoicesByOrganization(organizationId, filters, accessFilter);
    
    return {
      data: invoices.map(inv => this.mapToInvoiceListItem(inv)),
      meta: {
        total,
        page: filters.page || 1,
        limit: filters.limit || 20,
        totalPages: Math.ceil(total / (filters.limit || 20))
      }
    };
  }

  async getInvoiceById(
    invoiceId: string,
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<InvoiceResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const invoice = await invoicesRepository.findInvoiceByIdAndOrg(invoiceId, organizationId, accessFilter);
    if (!invoice) throw new NotFoundError('Invoice');
    
    return this.mapToInvoiceResponse(invoice);
  }

  async updateInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string,
    userRole: string,
    input: UpdateInvoiceInput
  ): Promise<InvoiceResponse> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const existing = await invoicesRepository.findInvoiceByIdAndOrg(invoiceId, organizationId, accessFilter);
    if (!existing) throw new NotFoundError('Invoice');

    if (existing.status !== InvoiceStatus.DRAFT && existing.status !== InvoiceStatus.REJECTED) {
      throw new UnprocessableError(`Invoice cannot be edited in ${existing.status} status. Only DRAFT and REJECTED invoices can be modified.`);
    }

    // Merge existing amounts with input for validation if a partial update is provided
    const validationInput = {
      cgstAmount: input.cgstAmount !== undefined ? input.cgstAmount : parseFloat(existing.cgstAmount?.toString() || '0') || undefined,
      sgstAmount: input.sgstAmount !== undefined ? input.sgstAmount : parseFloat(existing.sgstAmount?.toString() || '0') || undefined,
      igstAmount: input.igstAmount !== undefined ? input.igstAmount : parseFloat(existing.igstAmount?.toString() || '0') || undefined,
      gstAmount: input.gstAmount !== undefined ? input.gstAmount : parseFloat(existing.gstAmount.toString()),
      totalAmount: input.totalAmount !== undefined ? input.totalAmount : parseFloat(existing.totalAmount.toString()),
      items: input.items !== undefined ? input.items : existing.items.map((item: any) => ({
        description: item.description,
        quantity: parseFloat(item.quantity.toString()),
        unitPrice: parseFloat(item.unitPrice.toString()),
        amount: parseFloat(item.amount.toString()),
        taxRate: parseFloat(item.taxRate.toString()),
        ledgerId: item.ledgerId
      }))
    };
    
    // Only invoke full validation if amounts or items changed
    if (input.items || input.totalAmount !== undefined || input.gstAmount !== undefined) {
       this.validateAmounts(validationInput as unknown as CreateInvoiceInput);
    }

    if (input.invoiceNumber && input.invoiceNumber !== existing.invoiceNumber) {
      const exists = await invoicesRepository.checkInvoiceNumberExists(input.invoiceNumber, organizationId, invoiceId);
      if (exists) throw new ConflictError('Invoice number already exists');
    }

    if (input.clientId && input.clientId !== existing.clientId) {
      // If non-admin changes client, must be to an assigned client
      if (accessFilter !== null && !accessFilter.includes(input.clientId)) {
        throw new ForbiddenError('You are not assigned to this client');
      }
      await this.validateClientExists(input.clientId, organizationId);
    }

    const updateData: any = { ...input };
    if (input.invoiceDate) updateData.invoiceDate = new Date(input.invoiceDate);

    const updated = await invoicesRepository.updateInvoice(invoiceId, organizationId, updateData);

    await invoicesRepository.createAuditLog({
      userId,
      action: 'UPDATE_INVOICE',
      resource: 'INVOICE',
      details: { invoiceId, updatedFields: Object.keys(input) }
    });

    return this.mapToInvoiceResponse(updated);
  }

  async deleteInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<void> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const existing = await invoicesRepository.findInvoiceByIdAndOrg(invoiceId, organizationId, accessFilter);
    if (!existing) throw new NotFoundError('Invoice');

    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new UnprocessableError(`Invoice cannot be deleted in ${existing.status} status. Only DRAFT invoices can be deleted.`);
    }

    await invoicesRepository.deleteInvoice(invoiceId, organizationId);

    await invoicesRepository.createAuditLog({
      userId,
      action: 'DELETE_INVOICE',
      resource: 'INVOICE',
      details: { invoiceId, invoiceNumber: existing.invoiceNumber }
    });
  }

  async getInvoiceItems(
    invoiceId: string,
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<InvoiceItemResponse[]> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const existing = await invoicesRepository.findInvoiceByIdAndOrg(invoiceId, organizationId, accessFilter);
    if (!existing) throw new NotFoundError('Invoice');

    const items = await invoicesRepository.findInvoiceItems(invoiceId);
    return items.map((item: any) => ({
      id: item.id,
      description: item.description,
      hsnCode: item.hsnCode,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      amount: item.amount.toString(),
      taxRate: item.taxRate.toString(),
      ledgerId: item.ledgerId,
      creditLedgerId: item.creditLedgerId,
      ledger: item.ledger ? {
        id: item.ledger.id,
        name: item.ledger.name
      } : undefined,
      creditLedger: item.creditLedger ? {
        id: item.creditLedger.id,
        name: item.creditLedger.name
      } : undefined
    }));
  }

  async replaceInvoiceItems(
    invoiceId: string,
    organizationId: string,
    userId: string,
    userRole: string,
    items: CreateInvoiceItemInput[]
  ): Promise<InvoiceItemResponse[]> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const existing = await invoicesRepository.findInvoiceByIdAndOrg(invoiceId, organizationId, accessFilter);
    if (!existing) throw new NotFoundError('Invoice');

    if (existing.status !== InvoiceStatus.DRAFT && existing.status !== InvoiceStatus.REJECTED) {
      throw new UnprocessableError(`Invoice cannot be edited in ${existing.status} status. Only DRAFT and REJECTED invoices can be modified.`);
    }

    let sumItems = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const expectedAmount = item.quantity * item.unitPrice;
      if (Math.abs(expectedAmount - item.amount) > 0.01) {
        throw new ValidationError('Validation Error', [
          { field: `items.${i}.amount`, message: `Amount must equal quantity (${item.quantity}) * unitPrice (${item.unitPrice})` }
        ]);
      }
      sumItems += item.amount;
    }

    // Recalculate invoice total
    const existingGst = parseFloat(existing.gstAmount.toString());
    const newTotal = sumItems + existingGst;

    const newItems = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId } });
      await tx.invoiceItem.createMany({ data: items.map(i => ({ ...i, invoiceId })) });
      
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { totalAmount: newTotal }
      });

      return tx.invoiceItem.findMany({
        where: { invoiceId },
        include: {
          ledger: { select: { id: true, name: true } },
          creditLedger: { select: { id: true, name: true } }
        }
      });
    });

    await invoicesRepository.createAuditLog({
      userId,
      action: 'REPLACE_INVOICE_ITEMS',
      resource: 'INVOICE',
      details: { invoiceId, itemCount: items.length }
    });

    return newItems.map((item: any) => ({
      id: item.id,
      description: item.description,
      hsnCode: item.hsnCode,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      amount: item.amount.toString(),
      taxRate: item.taxRate.toString(),
      ledgerId: item.ledgerId,
      creditLedgerId: item.creditLedgerId,
      ledger: item.ledger ? {
        id: item.ledger.id,
        name: item.ledger.name
      } : undefined,
      creditLedger: item.creditLedger ? {
        id: item.creditLedger.id,
        name: item.creditLedger.name
      } : undefined
    }));
  }
}

export const invoicesService = new InvoicesService();
