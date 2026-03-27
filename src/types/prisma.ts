import { Prisma } from '@prisma/client';
export { Prisma };

// Re-export Enums (Values + Types)
export {
  Role,
  InvoiceStatus,
  SyncStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  PaymentStatus
} from '@prisma/client';

// Define Model Types
export type Organization = Prisma.OrganizationGetPayload<{}>;
export type User = Prisma.UserGetPayload<{}>;
export type Client = Prisma.ClientGetPayload<{}>;
export type Document = Prisma.DocumentGetPayload<{}>;
export type Invoice = Prisma.InvoiceGetPayload<{}>;
export type InvoiceItem = Prisma.InvoiceItemGetPayload<{}>;
export type Subscription = Prisma.SubscriptionGetPayload<{}>;
export type BillingHistory = Prisma.BillingHistoryGetPayload<{}>;
export type UsageQuota = Prisma.UsageQuotaGetPayload<{}>;
export type AuditLog = Prisma.AuditLogGetPayload<{}>;
export type Ledger = Prisma.LedgerGetPayload<{}>;
export type JournalEntry = Prisma.JournalEntryGetPayload<{}>;
export type JournalLine = Prisma.JournalLineGetPayload<{}>;
