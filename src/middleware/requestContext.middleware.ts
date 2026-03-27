import { FastifyRequest, FastifyReply } from 'fastify';

export const requestContextMiddleware = async (request: FastifyRequest, _reply: FastifyReply) => {
  if (request.user) {
    const req = request as any;
    req.userId = request.user.userId;
    req.organizationId = request.user.organizationId;
    req.roleId = request.user.roleId;
  }
};
