// src/modules/users/users.service.ts

import { usersRepository } from './users.repository';
import { authRepository } from '../auth/auth.repository';
import { InviteUserInput, UpdateUserRoleInput, UserProfile, UserListItem, UserFilters } from './users.types';
import { PaginatedResponse } from '../../shared/types';
import { NotFoundError, ConflictError, BadRequestError } from '../../errors';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

export class UsersService {
  async listUsers(
    organizationId: string,
    filters: UserFilters
  ): Promise<PaginatedResponse<UserListItem>> {
    const { users, total } = await usersRepository.findUsersByOrganization(organizationId, filters);
    const limit = filters.limit || 20;
    const page = filters.page || 1;

    const data: UserListItem[] = users.map(user => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
      isActive: user.isActive,
      assignedClients: (user as any).clientAccess?.map((ua: any) => ({
        id: ua.client.id,
        name: ua.client.name,
      })),
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async inviteUser(
    organizationId: string,
    invitedByUserId: string,
    input: InviteUserInput
  ): Promise<UserProfile> {
    const existingUser = await usersRepository.findUserByEmail(input.email);
    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    const role = await usersRepository.findRoleById(input.roleId);
    if (!role) {
      throw new NotFoundError('Role');
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    const newUser = await usersRepository.createUser({
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      roleId: input.roleId,
      organizationId,
    });

    const permissions = await usersRepository.getUserPermissions(newUser.roleId);

    await usersRepository.createAuditLog({
      userId: invitedByUserId,
      action: 'INVITE_USER',
      resource: 'USER',
      details: { invitedUserId: newUser.id, email: input.email, roleId: input.roleId },
    });

    return {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      createdAt: newUser.createdAt,
      role: {
        id: newUser.role.id,
        name: newUser.role.name,
      },
      permissions,
      isActive: newUser.isActive,
      assignedClients: (newUser as any).userAccess?.map((ua: any) => ({
        id: ua.client.id,
        name: ua.client.name,
      })),
    };
  }

  async getUserById(
    userId: string,
    organizationId: string
  ): Promise<UserProfile> {
    const user = await usersRepository.findUserByIdAndOrg(userId, organizationId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const permissions = await usersRepository.getUserPermissions(user.roleId);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
      permissions,
      isActive: user.isActive,
      assignedClients: (user as any).clientAccess?.map((ua: any) => ({
        id: ua.client.id,
        name: ua.client.name,
      })),
    };
  }

  async updateUserRole(
    targetUserId: string,
    organizationId: string,
    requestingUserId: string,
    input: UpdateUserRoleInput
  ): Promise<UserProfile> {
    if (targetUserId === requestingUserId) {
      throw new BadRequestError('You cannot change your own role');
    }

    const targetUser = await usersRepository.findUserByIdAndOrg(targetUserId, organizationId);
    if (!targetUser) {
      throw new NotFoundError('User');
    }

    const role = await usersRepository.findRoleById(input.roleId);
    if (!role) {
      throw new NotFoundError('Role');
    }

    const updatedUser = await usersRepository.updateUserRole(targetUserId, organizationId, input.roleId);
    
    await usersRepository.createAuditLog({
      userId: requestingUserId,
      action: 'UPDATE_USER_ROLE',
      resource: 'USER',
      details: { targetUserId, oldRoleId: targetUser.roleId, newRoleId: input.roleId },
    });

    const permissions = await usersRepository.getUserPermissions(updatedUser.roleId);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      createdAt: updatedUser.createdAt,
      role: {
        id: updatedUser.role.id,
        name: updatedUser.role.name,
      },
      permissions,
      isActive: updatedUser.isActive,
      assignedClients: (updatedUser as any).userAccess?.map((ua: any) => ({
        id: ua.client.id,
        name: ua.client.name,
      })),
    };
  }

  async updateUserStatus(
    targetUserId: string,
    organizationId: string,
    requestingUserId: string,
    isActive: boolean
  ): Promise<void> {
    if (targetUserId === requestingUserId) {
      const actionType = isActive ? 'activate' : 'deactivate';
      throw new BadRequestError(`You cannot ${actionType} yourself`);
    }
 
    const targetUser = await usersRepository.findUserByIdAndOrg(targetUserId, organizationId);
    if (!targetUser) {
      throw new NotFoundError('User');
    }
 
    await usersRepository.updateUserStatus(targetUserId, organizationId, isActive);
    
    // Revoke tokens only upon deactivation
    if (!isActive) {
      await authRepository.revokeAllUserRefreshTokens(targetUserId);
    }
 
    await usersRepository.createAuditLog({
      userId: requestingUserId,
      action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      resource: 'USER',
      details: { [isActive ? 'activatedUserId' : 'deactivatedUserId']: targetUserId },
    });
  }

  async getMyPermissions(userId: string, organizationId: string): Promise<string[]> {
    const user = await usersRepository.findUserByIdAndOrg(userId, organizationId);
    if (!user) {
      throw new NotFoundError('User');
    }
    return usersRepository.getUserPermissions(user.roleId);
  }

  async listRoles(): Promise<Role[]> {
    return usersRepository.getAllRoles();
  }
}

export const usersService = new UsersService();
