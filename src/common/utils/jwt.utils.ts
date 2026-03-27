// src/shared/token.utils.ts
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { AccessTokenPayload } from '../../modules/auth/auth.types';
import { UnauthorizedError } from '../../errors/index';

const getAccessSecret = () => process.env.JWT_SECRET || 'fallback_access_secret';
const getAccessExpiry = () => process.env.ACCESS_TOKEN_EXPIRY || '15m';

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: getAccessExpiry() as SignOptions['expiresIn'] });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export async function hashToken(token: string): Promise<string> {
  // Utilizing SHA-256 for deterministic O(1) database string storage queries
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, getAccessSecret()) as AccessTokenPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
