// src/modules/auth/auth.schema.ts
import { z } from 'zod';

const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/-]).{8,}$/;

export const signupSchema = z.object({
  organizationName: z.string().min(2).max(100),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional(),
  adminFullName: z.string().min(2).max(100),
  adminEmail: z.string().email().toLowerCase(),
  adminPassword: z.string().regex(passwordRegex, 'Password must be at least 8 characters long, contain 1 uppercase letter, 1 number, and 1 special character'),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().regex(passwordRegex, 'Password must be at least 8 characters long, contain 1 uppercase letter, 1 number, and 1 special character'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().regex(passwordRegex, 'Password must be at least 8 characters long, contain 1 uppercase letter, 1 number, and 1 special character'),
});
