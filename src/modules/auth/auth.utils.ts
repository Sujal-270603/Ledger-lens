import bcrypt from 'bcryptjs';
import { env } from '../../config/env';

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (candidate: string, hash: string) => {
  return bcrypt.compare(candidate, hash);
};

export const generateApiKey = () => {
  const key = require('crypto').randomBytes(32).toString('hex');
  const hash = require('crypto')
    .createHmac('sha256', env.API_KEY_SALT)
    .update(key)
    .digest('hex');
  return { key, hash };
};
