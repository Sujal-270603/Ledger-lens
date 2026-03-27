// src/middleware/authenticate.ts
import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { verifyAccessToken } from '../common/utils/jwt.utils';
import { authRepository } from '../modules/auth/auth.repository';
import { UnauthorizedError } from '../errors';

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];
  
  // Verify token, will throw UnauthorizedError if expired or invalid signature
  const payload = verifyAccessToken(token);

  // Check if user still exists in DB
  const user = await authRepository.findUserById(payload.userId);
  if (!user) {
    throw new UnauthorizedError('User no longer exists');
  }

  const permissions = await authRepository.getUserPermissions(payload.roleId);

  // Inject strict user credentials
  (request as any).user = {
    userId: payload.userId,
    email: payload.email,
    organizationId: payload.organizationId,
    roleId: payload.roleId,
    role: payload.role,
    permissions
  };
};
