import { PrismaClient, RoleType } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// ALL PERMISSIONS
// ─────────────────────────────────────────────────────────────────────────────

const PERMISSIONS: { name: string; description: string }[] = [
  // ── Invoice ──────────────────────────────────────────────────────────────
  { name: 'CREATE_INVOICE',       description: 'Create a new invoice manually' },
  { name: 'EDIT_INVOICE',         description: 'Edit a DRAFT or REJECTED invoice' },
  { name: 'DELETE_INVOICE',       description: 'Delete a DRAFT invoice' },
  { name: 'SUBMIT_INVOICE',       description: 'Submit a DRAFT invoice for approval' },
  { name: 'APPROVE_INVOICE',      description: 'Approve a SUBMITTED invoice' },
  { name: 'REJECT_INVOICE',       description: 'Reject a SUBMITTED invoice with reason' },
  { name: 'REOPEN_INVOICE',       description: 'Reopen an APPROVED invoice back to DRAFT' },
  { name: 'REPROCESS_INVOICE',    description: 'Re-trigger AI extraction on a FAILED invoice' },
  { name: 'EXPORT_INVOICE',       description: 'Export APPROVED invoices to Tally XML' },

  // ── Document ──────────────────────────────────────────────────────────────
  { name: 'UPLOAD_DOCUMENT',      description: 'Upload scanned invoice documents to S3' },
  { name: 'DELETE_DOCUMENT',      description: 'Delete an unprocessed document' },

  // ── Client ────────────────────────────────────────────────────────────────
  { name: 'CREATE_CLIENT',        description: 'Create a new client under the organization' },
  { name: 'EDIT_CLIENT',          description: 'Edit existing client details' },
  { name: 'DELETE_CLIENT',        description: 'Delete a client with no approved invoices' },

  // ── Users ─────────────────────────────────────────────────────────────────
  { name: 'MANAGE_USERS',         description: 'Invite, edit, deactivate users and assign roles' },

  // ── Organization ─────────────────────────────────────────────────────────
  { name: 'MANAGE_ORG',           description: 'Update organization profile (name, GSTIN, address)' },
  { name: 'VIEW_AUDIT_LOGS',      description: 'View organization-level audit logs' },

  // ── Ledger & Accounting ──────────────────────────────────────────────────
  { name: 'MANAGE_LEDGER',        description: 'Create, edit and delete ledger accounts' },
  { name: 'MANAGE_JOURNAL',       description: 'Create and delete journal entries for invoices' },

  // ── Billing ───────────────────────────────────────────────────────────────
  { name: 'VIEW_SUBSCRIPTION',    description: 'View subscription plan and usage limits' },
  { name: 'VIEW_BILLING',         description: 'View billing history and invoices' },
  { name: 'MANAGE_BILLING',       description: 'Manage Razorpay subscription and upgrade plans' },

  // ── Reports & Dashboard ───────────────────────────────────────────────────
  { name: 'VIEW_DASHBOARD',       description: 'View dashboard summary and charts' },
  { name: 'VIEW_REPORTS',         description: 'Access GST summary and invoice register reports' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROLE → PERMISSION MAPPING
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<RoleType, string[]> = {
  // ADMIN gets every single permission
  ADMIN: PERMISSIONS.map((p) => p.name),

  // USER — day-to-day operations: upload, create, edit, submit invoices, manage clients
  USER: [
    'CREATE_INVOICE',
    'EDIT_INVOICE',
    'DELETE_INVOICE',
    'SUBMIT_INVOICE',
    'UPLOAD_DOCUMENT',
    'CREATE_CLIENT',
    'EDIT_CLIENT',
    'VIEW_SUBSCRIPTION',
    'VIEW_DASHBOARD',
    'VIEW_REPORTS',
  ],

  // VIEWER — read-only access
  VIEWER: [
    'VIEW_SUBSCRIPTION',
    'VIEW_DASHBOARD',
    'VIEW_REPORTS',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  GST SaaS — Database Seeder');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ── Step 1: Seed all permissions ────────────────────────────────────────
  console.log(`\n[1/2] Seeding ${PERMISSIONS.length} permissions...`);

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where:  { name: perm.name },
      update: { description: perm.description }, // keeps descriptions fresh on re-seed
      create: { name: perm.name, description: perm.description },
    });
  }

  console.log(`      ✓ ${PERMISSIONS.length} permissions upserted`);

  // ── Step 2: Seed roles and wire permissions ──────────────────────────────
  console.log('\n[2/2] Seeding roles and assigning permissions...');

  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    // Upsert the role
    const role = await prisma.role.upsert({
      where:  { name: roleName as RoleType },
      update: {},
      create: { name: roleName as RoleType },
    });

    // Fetch IDs for permissions assigned to this role
    const permissionRecords = await prisma.permission.findMany({
      where: { name: { in: permissionNames } },
      select: { id: true, name: true },
    });

    // Warn if any permission name in the map doesn't exist in DB
    const foundNames = permissionRecords.map((p) => p.name);
    const missing = permissionNames.filter((n) => !foundNames.includes(n));
    if (missing.length > 0) {
      console.warn(`      ⚠  Missing permissions for role ${roleName}: ${missing.join(', ')}`);
    }

    // Upsert each RolePermission join row
    for (const permission of permissionRecords) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId:       role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId:       role.id,
          permissionId: permission.id,
        },
      });
    }

    console.log(`      ✓ ${roleName.padEnd(8)} — ${permissionRecords.length} permissions assigned`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Seed completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('\n✗ Seed failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });