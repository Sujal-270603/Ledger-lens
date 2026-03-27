import { InvoiceStatus, SubscriptionPlan } from '../../types/prisma';

export interface DashboardOverview {
  invoices: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    totalAmount: string;
  };
  usage: {
    plan: SubscriptionPlan;
    invoicesProcessed: number;
    invoicesLimit: number;
  };
  counts: {
    documents: number;
    clients: number;
    users: number;
  };
}

export interface InvoiceTrendPoint {
  date: string;
  count: number;
  amount: string;
}

export interface InvoiceTrend {
  points: InvoiceTrendPoint[];
}

export interface TopClient {
  id: string;
  name: string;
  count: number;
  amount: string;
}

export interface RecentActivity {
  id: string;
  action: string;
  resource: string;
  details: any;
  createdAt: Date;
  user: { fullName: string } | null;
}

export interface DashboardFilters {
  startDate?: string;
  endDate?: string;
  period?: string;
}
