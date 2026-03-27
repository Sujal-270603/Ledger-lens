// src/modules/auth/auth.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service';
import { 
  SignupInput, LoginInput, RefreshTokenInput, 
  ForgotPasswordInput, ResetPasswordInput, ChangePasswordInput 
} from './auth.types';

export class AuthController {
  async signup(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as SignupInput;
    const result = await authService.signup(data);
    return reply.status(201).send(result);
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as LoginInput;
    const ipAddress = request.ip || 'unknown';
    const result = await authService.login(data, ipAddress);
    return reply.status(200).send(result);
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as RefreshTokenInput;
    const result = await authService.refreshTokens(data);
    return reply.status(200).send(result);
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    let rToken = '';
    const body = request.body as Record<string, any>;
    if (body && body.refreshToken) {
      rToken = body.refreshToken;
    }
    await authService.logout(rToken);
    return reply.status(204).send();
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user.userId;
    const result = await authService.getMe(userId);
    return reply.status(200).send(result);
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as ForgotPasswordInput;
    await authService.forgotPassword(data.email);
    return reply.status(200).send({ message: 'If this email exists, a reset link has been sent.' });
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as ResetPasswordInput;
    await authService.resetPassword(data);
    return reply.status(200).send({ message: 'Password reset successfully.' });
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as ChangePasswordInput;
    const userId = (request as any).user.userId;
    await authService.changePassword(userId, data);
    return reply.status(200).send({ message: 'Password changed successfully.' });
  }
}

export const authController = new AuthController();
