// src/modules/users/users.routes.ts

import { FastifyInstance } from 'fastify';
import { usersController } from './users.controller';
import { inviteUserSchema, updateUserRoleSchema, userFiltersSchema } from './users.schema';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';
import { validateBody } from '../../middleware/validateBody';

export async function usersRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [authenticate] },
    usersController.listUsers
  );

  app.post(
    '/invite',
    {
      preHandler: [
        authenticate,
        requirePermission('MANAGE_USERS'),
        validateBody(inviteUserSchema),
      ],
    },
    usersController.inviteUser
  );

  // IMPORTANT: Register GET /roles BEFORE GET /:userId
  app.get(
    '/roles',
    { preHandler: [authenticate, requirePermission('MANAGE_USERS')] },
    usersController.listRoles
  );

  app.get(
    '/:userId',
    { preHandler: [authenticate, requirePermission('MANAGE_USERS')] },
    usersController.getUserById
  );

  app.patch(
    '/:userId/role',
    {
      preHandler: [
        authenticate,
        requirePermission('MANAGE_USERS'),
        validateBody(updateUserRoleSchema),
      ],
    },
    usersController.updateUserRole
  );

  app.patch(
    '/:userId/status',
    { preHandler: [authenticate, requirePermission('MANAGE_USERS')] },
    usersController.updateUserStatus
  );

  app.get(
    '/:userId/permissions',
    { preHandler: [authenticate, requirePermission('MANAGE_USERS')] },
    usersController.getMyPermissions
  );
}
