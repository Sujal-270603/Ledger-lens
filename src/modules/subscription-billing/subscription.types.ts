import { SubscriptionPlan, SubscriptionStatus, PaymentStatus } from '../../types/prisma';

export interface SubscriptionResponse {
  id: string;
  organizationId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  planLimits?: PlanLimits;
}

export interface PlanLimits {
  name: string;
  invoicesPerMonth: number;
  usersLimit: number;
  clientsLimit: number;
  price: number;
  tallyExport: boolean;
}

export interface BillingHistoryResponse {
  id: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  description: string;
  invoiceUrl?: string | null;
  paidAt?: Date | null;
  createdAt: Date;
}

export interface ChangePlanInput {
  plan: SubscriptionPlan;
}

export interface UsageSummaryResponse {
  plan: SubscriptionPlan;
  invoicesProcessed: number;
  invoicesLimit: number;
  usersCount: number;
  usersLimit: number;
  clientsCount: number;
  clientsLimit: number;
  resetDate: Date;
}

export interface BillingHistoryFilters {
  page?: number;
  limit?: number;
}
