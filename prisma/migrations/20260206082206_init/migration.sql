---------------------------------------------------
-- ENUMS
---------------------------------------------------

CREATE TYPE "RoleType" AS ENUM ('ADMIN', 'USER', 'VIEWER');

CREATE TYPE "InvoiceStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'FAILED'
);

CREATE TYPE "SyncStatus" AS ENUM (
  'NOT_SYNCED',
  'SYNCED',
  'ERROR'
);

CREATE TYPE "SubscriptionTier" AS ENUM (
  'FREE',
  'PRO',
  'ENTERPRISE'
);

---------------------------------------------------
-- ORGANIZATIONS
---------------------------------------------------

CREATE TABLE "organizations" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "gstin" TEXT,
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "organizations_gstin_key"
ON "organizations"("gstin");

---------------------------------------------------
-- RBAC TABLES
---------------------------------------------------

CREATE TABLE "Role" (
  "id" TEXT PRIMARY KEY,
  "name" "RoleType" NOT NULL UNIQUE
);

CREATE TABLE "Permission" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT
);

CREATE TABLE "RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  PRIMARY KEY ("roleId", "permissionId"),
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE,
  FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE
);

---------------------------------------------------
-- USERS
---------------------------------------------------

CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("roleId") REFERENCES "Role"("id"),
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

---------------------------------------------------
-- CLIENTS
---------------------------------------------------

CREATE TABLE "clients" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "gstin" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "clients_organizationId_gstin_key"
ON "clients"("organizationId", "gstin");

---------------------------------------------------
-- USER CLIENT ACCESS
---------------------------------------------------

CREATE TABLE "user_client_access" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  UNIQUE("userId", "clientId"),
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE
);

---------------------------------------------------
-- DOCUMENTS
---------------------------------------------------

CREATE TABLE "documents" (
  "id" TEXT PRIMARY KEY,
  "s3Key" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "organizationId" TEXT NOT NULL,
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

---------------------------------------------------
-- INVOICES
---------------------------------------------------

CREATE TABLE "invoices" (
  "id" TEXT PRIMARY KEY,
  "invoiceNumber" TEXT NOT NULL,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "gstAmount" DECIMAL(14,2) NOT NULL,
  "cgstAmount" DECIMAL(14,2),
  "sgstAmount" DECIMAL(14,2),
  "igstAmount" DECIMAL(14,2),
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "syncStatus" "SyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
  "confidenceScore" DOUBLE PRECISION,
  "aiMetadata" JSONB,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT,
  "documentId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "reopenedAt" TIMESTAMP(3),
  "reopenedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL,
  FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL,
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL,
  FOREIGN KEY ("reopenedById") REFERENCES "users"("id") ON DELETE SET NULL
);

---------------------------------------------------
-- INVOICE ITEMS
---------------------------------------------------

CREATE TABLE "invoice_items" (
  "id" TEXT PRIMARY KEY,
  "description" TEXT NOT NULL,
  "hsnCode" TEXT,
  "quantity" DECIMAL(14,2) NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "taxRate" DECIMAL(5,2) NOT NULL,
  "invoiceId" TEXT NOT NULL,
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE
);

---------------------------------------------------
-- LEDGER SYSTEM
---------------------------------------------------

CREATE TABLE "Ledger" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE TABLE "JournalEntry" (
  "id" TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE
);

CREATE TABLE "JournalLine" (
  "id" TEXT PRIMARY KEY,
  "journalId" TEXT NOT NULL,
  "ledgerId" TEXT NOT NULL,
  "debit" DECIMAL(14,2),
  "credit" DECIMAL(14,2),
  FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE,
  FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE CASCADE
);

---------------------------------------------------
-- SUBSCRIPTIONS
---------------------------------------------------

CREATE TABLE "subscriptions" (
  "id" TEXT PRIMARY KEY,
  "razorpaySubId" TEXT NOT NULL UNIQUE,
  "tier" "SubscriptionTier" NOT NULL,
  "status" TEXT NOT NULL,
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

---------------------------------------------------
-- USAGE QUOTA
---------------------------------------------------

CREATE TABLE "usage_quotas" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL UNIQUE,
  "invoicesProcessed" INTEGER NOT NULL DEFAULT 0,
  "invoicesLimit" INTEGER NOT NULL DEFAULT 100,
  "resetDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

---------------------------------------------------
-- AUDIT LOG
---------------------------------------------------

CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "details" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
);