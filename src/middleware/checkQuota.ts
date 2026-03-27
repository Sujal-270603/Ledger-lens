// src/middleware/checkQuota.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { UnprocessableError, InternalError } from '../errors';
import { prisma } from '../database/db';

export const checkQuota = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = (request as any).user;
  
  if (!user || !user.organizationId) {
    throw new InternalError('User context missing or invalid');
  }

  const sub = await prisma.subscription.findUnique({
    where: { organizationId: user.organizationId }
  });

  if (!sub || sub.status !== 'ACTIVE') {
    throw new UnprocessableError('Your organization does not have an active subscription. Please subscribe to continue.');
  }

  const quota = await prisma.usageQuota.findUnique({
    where: { organizationId: user.organizationId }
  });

  if (!quota) {
    throw new InternalError('Usage quota not configured for this organization');
  }

  if (quota.invoicesProcessed >= quota.invoicesLimit) {
    const formattedResetDate = quota.resetDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    throw new UnprocessableError(
      `Invoice processing limit reached (${quota.invoicesProcessed}/${quota.invoicesLimit}). Upgrade your plan or wait for quota reset on ${formattedResetDate}.`
    );
  }
};
