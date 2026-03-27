// src/modules/auth/auth.repository.ts
import { prisma } from '../../database/db';
import { Prisma } from '@prisma/client';
import { SignupInput } from './auth.types';
import { User, Role, Organization } from '@prisma/client';

export class AuthRepository {
  async createOrganizationWithAdminUser(data: SignupInput, hashedPassword: string, adminRoleId: string): Promise<{ organization: Organization, user: User }> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          ...(data.gstin ? { gstin: data.gstin } : {})
        }
      });

      const user = await tx.user.create({
        data: {
          email: data.adminEmail,
          fullName: data.adminFullName,
          passwordHash: hashedPassword,
          roleId: adminRoleId,
          organizationId: organization.id
        }
      });

      return { organization, user };
    });
  }

  async findUserByEmail(email: string): Promise<(User & { role: Role }) | null> {
    return prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });
  }

  async findUserById(userId: string): Promise<(User & { role: Role }) | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });
  }

  async findAdminRole(): Promise<Role | null> {
    return prisma.role.findUnique({
      where: { name: 'ADMIN' }
    });
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<any> {
    return (prisma as any).refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt
      }
    });
  }

  async findRefreshToken(tokenHash: string): Promise<any | null> {
    return (prisma as any).refreshToken.findUnique({
      where: { tokenHash }
    });
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await (prisma as any).refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() }
    });
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await (prisma as any).refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async getUserPermissions(roleId: string): Promise<string[]> {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true }
    });
    return rolePermissions.map((rp: any) => rp.permission.name);
  }

  async createAuditLog(data: { userId?: string, action: string, resource: string, details?: object, ipAddress?: string }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        details: data.details ? JSON.parse(JSON.stringify(data.details)) : undefined,
        ipAddress: data.ipAddress
      }
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
  }
}

export const authRepository = new AuthRepository();
