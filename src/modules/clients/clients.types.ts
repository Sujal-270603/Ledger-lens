// src/modules/clients/clients.types.ts
import { InvoiceStatus } from '@prisma/client';

export interface CreateClientInput {
  name: string;
  gstin?: string;
  email?: string;
  phone?: string;
}

export interface UpdateClientInput {
  name?: string;
  gstin?: string;
  email?: string;
  phone?: string;
}

export interface ClientFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ClientInvoiceFilters {
  status?: InvoiceStatus;
  page?: number;
  limit?: number;
}

export interface ClientResponse {
  id: string;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    invoices: number;
  };
}

export interface ClientDetailResponse extends ClientResponse {
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    invoiceDate: Date;
    totalAmount: string;
    gstAmount: string;
    status: InvoiceStatus;
  }[];
  assignedUsers?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  }[];
}

export interface AssignUserInput {
  userId: string;
}
