import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/db';
import { ForbiddenError } from '../errors';
import { isAdminRole, getAssignedClientIds } from '../shared/access';

/**
 * Middleware to ensure the user has access to the client specified in :clientId.
 */
export async function requireClientAccess(
  request: FastifyRequest
): Promise<void> {
  const { clientId } = request.params as { clientId: string };
  const { userId, role } = request.user;

  if (isAdminRole(role)) {
    return;
  }

  const assignedIds = await getAssignedClientIds(userId);
  if (!assignedIds.includes(clientId)) {
    throw new ForbiddenError('You do not have access to this client');
  }
}
