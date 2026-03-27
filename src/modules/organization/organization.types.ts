// src/modules/organization/organization.types.ts

export interface UpdateOrganizationInput {
  name?: string;
  gstin?: string;
  address?: string;
}

export interface OrganizationProfile {
  id: string;
  name: string;
  gstin: string | null;
  address: string | null;
  createdAt: Date;
  quota: {
    invoicesProcessed: number;
    invoicesLimit: number;
    percentUsed: number;
    resetDate: Date;
  };
  subscription: {
    tier: string;
    status: string;
  } | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  details: unknown;
  ipAddress: string | null;
  createdAt: Date;
  user: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
