// src/middleware/requirePermission.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../errors';

export const requirePermission = (requiredPermission: string) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    // Safety check ensuring authenticate middleware ran prior
    if (!user || !user.permissions) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }

    if (!user.permissions.includes(requiredPermission)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
  };
};
