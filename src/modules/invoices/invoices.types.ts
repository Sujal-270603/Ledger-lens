// src/modules/invoices/invoices.types.ts
import { InvoiceStatus, SyncStatus } from '../../types/prisma';

export interface CreateInvoiceItemInput {
  description: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: number;
}

export interface CreateInvoiceInput {
  invoiceNumber: string;
  invoiceDate: string;
  clientId?: string;
  documentId?: string;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  gstAmount: number;
  totalAmount: number;
  items: CreateInvoiceItemInput[];
}

export interface UpdateInvoiceInput {
  invoiceNumber?: string;
  invoiceDate?: string;
  clientId?: string;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  gstAmount?: number;
  totalAmount?: number;
  items?: CreateInvoiceItemInput[];
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  clientId?: string;
  syncStatus?: SyncStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceItemResponse {
  id: string;
  description: string;
  hsnCode: string | null;
  quantity: string;
  unitPrice: string;
  amount: string;
  taxRate: string;
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: string;
  gstAmount: string;
  cgstAmount: string | null;
  sgstAmount: string | null;
  igstAmount: string | null;
  status: InvoiceStatus;
  syncStatus: SyncStatus;
  confidenceScore: number | null;
  organizationId: string;
  clientId: string | null;
  documentId: string | null;
  client: {
    id: string;
    name: string;
    gstin: string | null;
  } | null;
  items: InvoiceItemResponse[];
  submittedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  reopenedAt: Date | null;
  reopenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: string;
  gstAmount: string;
  status: InvoiceStatus;
  syncStatus: SyncStatus;
  clientId: string | null;
  client: {
    id: string;
    name: string;
  } | null;
  createdAt: Date;
}
