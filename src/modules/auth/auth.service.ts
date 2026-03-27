// src/modules/auth/auth.service.ts
import { authRepository } from './auth.repository';
import { organizationRepository } from '../organization/organization.repository';
import { ledgerService } from '../ledger/ledger.service';
import { subscriptionService } from '../subscription-billing/subscription.service';
import { 
  SignupInput, LoginInput, RefreshTokenInput, 
  ResetPasswordInput, ChangePasswordInput, 
  AuthTokensResponse, UserProfile 
} from './auth.types';
import { 
  ConflictError, InternalError, UnauthorizedError, BadRequestError 
} from '../../errors/index';
import { 
  generateAccessToken, generateRefreshToken, hashToken 
} from '../../common/utils/jwt.utils';
import { logger } from '../../common/logger/logger';
import { redis } from '../../database/redis';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export class AuthService {
  async signup(input: SignupInput): Promise<{ user: UserProfile; tokens: AuthTokensResponse }> {
    const existing = await authRepository.findUserByEmail(input.adminEmail);
    if (existing) throw new ConflictError('Email already in use');
 
    if (input.gstin && input.gstin.trim() !== '') {
      const existingOrg = await organizationRepository.findOrganizationByGstin(input.gstin.trim());
      if (existingOrg) throw new ConflictError('Organization with this GSTIN already exists');
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const passwordHash = await bcrypt.hash(input.adminPassword, saltRounds);

    const adminRole = await authRepository.findAdminRole();
    if (!adminRole) throw new InternalError('Admin role missing. DB not seeded?');

    try {
      const { user, organization } = await authRepository.createOrganizationWithAdminUser(input, passwordHash, adminRole.id);


      // Create default subscription and usage quota

      await subscriptionService.createDefaultSubscription(organization.id);

      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        organizationId: organization.id,
        roleId: user.roleId,
        role: adminRole.name
      });

      const refreshToken = generateRefreshToken();
      const rtHash = await hashToken(refreshToken);
      
      const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      await authRepository.createRefreshToken(user.id, rtHash, expiresAt);
      await authRepository.createAuditLog({ action: 'SIGNUP', resource: 'USER', userId: user.id });

      const permissions = await authRepository.getUserPermissions(adminRole.id);

      return { 
        user: { 
          id: user.id, 
          email: user.email, 
          fullName: user.fullName,
          organizationId: organization.id,
          role: { name: adminRole.name },
          permissions
        },
        tokens: { accessToken, refreshToken }
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const targets = (error.meta?.target as string[]) || [];
          if (targets.includes('email')) throw new ConflictError('Email already in use');
          if (targets.includes('gstin')) throw new ConflictError('Organization with this GSTIN already exists');
          throw new ConflictError(`Unique constraint failed on: ${targets.join(', ')}`);
        }
      }
      throw error;
    }
  }

  async login(input: LoginInput, ipAddress: string): Promise<{ accessToken: string; refreshToken: string; user: UserProfile }> {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('Invalid email or password');

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roleId: user.roleId,
      role: user.role.name
    });

    const refreshToken = generateRefreshToken();
    const rtHash = await hashToken(refreshToken);

    const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    await authRepository.createRefreshToken(user.id, rtHash, expiresAt);
    await authRepository.createAuditLog({ action: 'LOGIN', resource: 'USER', userId: user.id, ipAddress });

    const permissions = await authRepository.getUserPermissions(user.roleId);

    return { 
      accessToken, 
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        organizationId: user.organizationId,
        role: { name: user.role.name },
        permissions
      }
    };
  }

  async refreshTokens(input: RefreshTokenInput): Promise<AuthTokensResponse> {
    const rtHash = await hashToken(input.refreshToken);
    const storedToken = await authRepository.findRefreshToken(rtHash);

    if (!storedToken) throw new UnauthorizedError('Invalid refresh token');
    if (storedToken.revokedAt) throw new UnauthorizedError('Refresh token revoked');
    if (storedToken.expiresAt.getTime() < Date.now()) throw new UnauthorizedError('Refresh token expired');

    await authRepository.revokeRefreshToken(storedToken.id);

    const user = await authRepository.findUserById(storedToken.userId);
    if (!user) throw new UnauthorizedError('User not found');

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roleId: user.roleId,
      role: user.role.name
    });

    const newRefreshToken = generateRefreshToken();
    const newRtHash = await hashToken(newRefreshToken);

    const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    await authRepository.createRefreshToken(user.id, newRtHash, expiresAt);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const rtHash = await hashToken(refreshToken);
    const storedToken = await authRepository.findRefreshToken(rtHash);
    if (storedToken && !storedToken.revokedAt) {
      await authRepository.revokeRefreshToken(storedToken.id);
    }
  }

  async getMe(userId: string): Promise<UserProfile> {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedError('User not found');
    const permissions = await authRepository.getUserPermissions(user.roleId);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: user.organizationId,
      role: { name: user.role.name },
      permissions
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await authRepository.findUserByEmail(email);
    if (!user) return; // Silent execution prevents enumeration

    const secret = process.env.JWT_RESET_SECRET || 'fallback_reset_secret';
    const resetToken = jwt.sign({ userId: user.id, email: user.email, type: 'PASSWORD_RESET' }, secret, { expiresIn: '1h' });
    
    const tokenHash = await hashToken(resetToken);
    await redis.set(`pwd_reset:${user.id}`, tokenHash, 'EX', 3600);

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    logger.info(`${appUrl}/reset-password?token=${resetToken}`);
    
    await authRepository.createAuditLog({ action: 'FORGOT_PASSWORD', resource: 'USER', userId: user.id });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const secret = process.env.JWT_RESET_SECRET || 'fallback_reset_secret';
    let payload: any;
    try {
      payload = jwt.verify(input.token, secret);
    } catch {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    if (payload.type !== 'PASSWORD_RESET') throw new UnauthorizedError('Invalid token type');

    const storedHash = await redis.get(`pwd_reset:${payload.userId}`);
    if (!storedHash) throw new UnauthorizedError('Reset token not active');

    const incomingHash = await hashToken(input.token);
    if (incomingHash !== storedHash) throw new UnauthorizedError('Invalid token hash');

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const newPasswordHash = await bcrypt.hash(input.newPassword, saltRounds);

    await authRepository.updatePassword(payload.userId, newPasswordHash);
    await redis.del(`pwd_reset:${payload.userId}`);
    await authRepository.revokeAllUserRefreshTokens(payload.userId);
    await authRepository.createAuditLog({ action: 'RESET_PASSWORD', resource: 'USER', userId: payload.userId });
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedError('User not found');

    const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('Incorrect current password');

    if (input.newPassword === input.currentPassword) throw new BadRequestError('New password cannot be the same');

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const newPasswordHash = await bcrypt.hash(input.newPassword, saltRounds);

    await authRepository.updatePassword(userId, newPasswordHash);
    await authRepository.createAuditLog({ action: 'CHANGE_PASSWORD', resource: 'USER', userId });
  }
}

export const authService = new AuthService();
