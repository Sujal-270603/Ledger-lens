// src/modules/workflow/workflow.types.ts
import { InvoiceStatus } from '../../types/prisma';

export interface SubmitInvoiceInput {
  // Empty as per requirements
}

export interface ApproveInvoiceInput {
  // Empty as per requirements
}

export interface RejectInvoiceInput {
  rejectionReason: string;
}

export interface ReopenInvoiceInput {
  reopenReason: string;
}

export interface WorkflowActionResponse {
  invoiceId: string;
  previousStatus: InvoiceStatus;
  currentStatus: InvoiceStatus;
  actionAt: Date;
  actionBy: {
    id: string;
    fullName: string;
    email: string;
  };
  message: string;
}

export interface InvoiceHistoryEntry {
  action: string;
  fromStatus: string | null;
  toStatus: string;
  performedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: Date;
}
