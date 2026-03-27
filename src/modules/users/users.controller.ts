// src/modules/users/users.controller.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { usersService } from './users.service';
import { InviteUserInput, UpdateUserRoleInput, UserFilters } from './users.types';

export class UsersController {
  async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = request.user;
    const filters = request.query as UserFilters;
    const users = await usersService.listUsers(organizationId, filters);
    return reply.status(200).send(users);
  }

  async inviteUser(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId, userId: requestingUserId } = request.user;
    const input = request.body as InviteUserInput;
    const user = await usersService.inviteUser(organizationId, requestingUserId, input);
    return reply.status(201).send(user);
  }

  async getUserById(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = request.user;
    const { userId } = request.params as { userId: string };
    const user = await usersService.getUserById(userId, organizationId);
    return reply.status(200).send(user);
  }

  async updateUserRole(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId, userId: requestingUserId } = request.user;
    const { userId: targetUserId } = request.params as { userId: string };
    const input = request.body as UpdateUserRoleInput;
    const user = await usersService.updateUserRole(targetUserId, organizationId, requestingUserId, input);
    return reply.status(200).send(user);
  }

  async updateUserStatus(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId, userId: requestingUserId } = request.user;
    const { userId: targetUserId } = request.params as { userId: string };
    const { isActive } = request.body as { isActive: boolean };
    await usersService.updateUserStatus(targetUserId, organizationId, requestingUserId, isActive);
    return reply.status(204).send();
  }

  async getMyPermissions(request: FastifyRequest, reply: FastifyReply) {
    const { organizationId } = request.user;
    const { userId } = request.params as { userId: string };
    const permissions = await usersService.getMyPermissions(userId, organizationId);
    return reply.status(200).send({ permissions });
  }

  async listRoles(request: FastifyRequest, reply: FastifyReply) {
    const roles = await usersService.listRoles();
    return reply.status(200).send(roles);
  }
}

export const usersController = new UsersController();
