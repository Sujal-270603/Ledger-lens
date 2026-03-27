// src/modules/users/users.repository.ts

import { prisma } from '../../database/db';
import { User, Role, Prisma } from '@prisma/client';
import { UserFilters } from './users.types';

export type UserWithRole = Prisma.UserGetPayload<{
  include: { role: true };
}>;

export class UsersRepository {
  async findUsersByOrganization(
    organizationId: string,
    filters: UserFilters
  ): Promise<{ users: UserWithRole[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      organizationId,
    };

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { fullName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.roleId) {
      where.roleId = filters.roleId;
    }

    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: { 
          role: true,
          clientAccess: {
            select: {
              client: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users: users as any, total };
  }

  async findUserByIdAndOrg(userId: string, organizationId: string): Promise<UserWithRole | null> {
    return prisma.user.findFirst({
      where: { id: userId, organizationId },
      include: { 
        role: true,
        clientAccess: {
          select: {
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
    }) as any;
  }

  async findUserByEmail(email: string): Promise<UserWithRole | null> {
    return prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async createUser(data: {
    email: string;
    fullName: string;
    passwordHash: string;
    roleId: string;
    organizationId: string;
  }): Promise<UserWithRole> {
    return prisma.user.create({
      data,
      include: { role: true },
    });
  }

  async updateUserRole(userId: string, organizationId: string, roleId: string): Promise<UserWithRole> {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new Error('User not found in organization'); // Boundary error fallback
    }

    return prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true },
    });
  }

  async updateUserStatus(userId: string, organizationId: string, isActive: boolean): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
 
    if (!user) {
      throw new Error('User not found in organization');
    }
 
    await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  async findRoleById(roleId: string): Promise<Role | null> {
    return prisma.role.findUnique({
      where: { id: roleId },
    });
  }

  async getAllRoles(): Promise<Role[]> {
    return prisma.role.findMany();
  }

  async getUserPermissions(roleId: string): Promise<string[]> {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return rolePermissions.map(rp => rp.permission.name);
  }

  async createAuditLog(data: {
    userId: string;
    action: string;
    resource: string;
    details?: object;
    ipAddress?: string;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        details: data.details ? (data.details as any) : undefined,
        ipAddress: data.ipAddress,
      },
    });
  }
}

export const usersRepository = new UsersRepository();
