import { prisma } from '../database/db';
import { PrismaClient } from '@prisma/client';

/**
 * Checks if the user role is ADMIN.
 * This is the single source of truth for the admin bypass rule.
 */
export function isAdminRole(roleName: string): boolean {
  return roleName === 'ADMIN';
}

/**
 * Higher-level check for client access.
 */
export function userHasClientAccess(
  userRole: string,
  userId: string,
  assignedClientIds: string[],
  targetClientId: string
): boolean {
  if (isAdminRole(userRole)) return true;
  return assignedClientIds.includes(targetClientId);
}

/**
 * Fetches the list of client IDs assigned to a specific user.
 */
export async function getAssignedClientIds(
  userId: string,
  p: PrismaClient = prisma
): Promise<string[]> {
  const access = await p.userClientAccess.findMany({
    where: { userId },
    select: { clientId: true },
  });
  
  return access.map((a) => a.clientId);
}
