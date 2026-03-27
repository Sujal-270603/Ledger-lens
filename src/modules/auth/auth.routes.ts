// src/modules/auth/auth.routes.ts
import { FastifyInstance } from 'fastify';
import { authController } from './auth.controller';
import { 
  signupSchema, loginSchema, refreshTokenSchema, 
  forgotPasswordSchema, resetPasswordSchema, changePasswordSchema 
} from './auth.schema';
import { validateBody } from '../../middleware/validateBody';
import { authenticate } from '../../middleware/authenticate';
import { rateLimiter } from '../../middleware/rateLimiter';

export async function authRoutes(app: FastifyInstance) {
  
  app.post('/signup', {
    preHandler: [
      validateBody(signupSchema),
      rateLimiter({ max: 10, windowMs: 15 * 60 * 1000 })
    ]
  }, authController.signup);

  app.post('/login', {
    preHandler: [
      validateBody(loginSchema),
      rateLimiter({ max: 10, windowMs: 15 * 60 * 1000 })
    ]
  }, authController.login);

  app.post('/refresh', {
    preHandler: [
      validateBody(refreshTokenSchema),
      // Prevent rapid fire refresh cycling
      rateLimiter({ max: 15, windowMs: 15 * 60 * 1000 })
    ]
  }, authController.refresh);

  app.post('/logout', {
    preHandler: [authenticate]
  }, authController.logout);

  app.get('/me', {
    preHandler: [authenticate]
  }, authController.getMe);

  app.post('/forgot-password', {
    preHandler: [
      validateBody(forgotPasswordSchema),
      rateLimiter({ max: 3, windowMs: 15 * 60 * 1000 })
    ]
  }, authController.forgotPassword);

  app.post('/reset-password', {
    preHandler: [
      validateBody(resetPasswordSchema),
      rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 })
    ]
  }, authController.resetPassword);

  app.patch('/change-password', {
    preHandler: [
      authenticate,
      validateBody(changePasswordSchema),
      rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 })
    ]
  }, authController.changePassword);
}
