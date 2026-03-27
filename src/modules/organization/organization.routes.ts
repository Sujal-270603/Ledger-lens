// src/modules/organization/organization.routes.ts

import { FastifyInstance } from 'fastify';
import { organizationController } from './organization.controller';
import { updateOrganizationSchema } from './organization.schema';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';
import { validateBody } from '../../middleware/validateBody';

export async function organizationRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [authenticate] },
    organizationController.getOrganizationProfile
  );

  app.patch(
    '/',
    {
      preHandler: [
        authenticate,
        requirePermission('MANAGE_ORG'),
        validateBody(updateOrganizationSchema),
      ],
    },
    organizationController.updateOrganization
  );

  app.get(
    '/quota',
    { preHandler: [authenticate] },
    organizationController.getQuota
  );

  app.get(
    '/audit-logs',
    {
      preHandler: [authenticate, requirePermission('VIEW_AUDIT_LOGS')],
    },
    organizationController.getAuditLogs
  );
}
