import { prisma } from '../../database/db';
import { SubscriptionPlan, SubscriptionStatus, PaymentStatus } from '../../types/prisma';

export class SubscriptionRepository {
  async findSubscriptionByOrg(organizationId: string) {
    return prisma.subscription.findUnique({
      where: { organizationId }
    });
  }

  async createSubscription(data: {
    organizationId: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }) {
    return prisma.subscription.create({
      data
    });
  }

  async updateSubscription(organizationId: string, data: Partial<{
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelledAt: Date | null;
  }>) {
    return prisma.subscription.update({
      where: { organizationId },
      data
    });
  }

  async findBillingHistoryByOrg(organizationId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await prisma.$transaction([
      prisma.billingHistory.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.billingHistory.count({
        where: { organizationId }
      })
    ]);

    return { data, total };
  }

  async createBillingRecord(data: {
    organizationId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    description: string;
    paidAt?: Date;
  }) {
    return prisma.billingHistory.create({
      data
    });
  }

  async findUsageQuota(organizationId: string) {
    return prisma.usageQuota.findUnique({
      where: { organizationId }
    });
  }

  async updateUsageQuota(organizationId: string, data: Partial<{
    invoicesProcessed: number;
    invoicesLimit: number;
    resetDate: Date;
  }>) {
    return prisma.usageQuota.update({
      where: { organizationId },
      data
    });
  }

  async countUsersByOrg(organizationId: string) {
    return prisma.user.count({
      where: { organizationId, isActive: true }
    });
  }

  async countClientsByOrg(organizationId: string) {
    return prisma.client.count({
      where: { organizationId }
    });
  }

  async createAuditLog(data: {
    userId: string;
    organizationId: string;
    action: string;
    resource: string;
    details?: any;
  }) {
    return prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        details: data.details,
      }
    });
  }

  async createInitialSubscription(data: {
    organizationId: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    invoicesLimit: number;
    resetDate: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          organizationId: data.organizationId,
          plan: data.plan,
          status: data.status,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd
        }
      });

      await tx.usageQuota.create({
        data: {
          organizationId: data.organizationId,
          invoicesProcessed: 0,
          invoicesLimit: data.invoicesLimit,
          resetDate: data.resetDate
        }
      });

      return subscription;
    });
  }

  async executePlanChange(data: {
    organizationId: string;
    userId: string;
    newPlan: SubscriptionPlan;
    oldPlan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    invoicesLimit: number;
    resetDate: Date;
    price: number;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Update Subscription
      const updatedSub = await tx.subscription.update({
        where: { organizationId: data.organizationId },
        data: {
          plan: data.newPlan,
          status: data.status,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd
        }
      });

      // 2. Update Usage Quota
      await tx.usageQuota.update({
        where: { organizationId: data.organizationId },
        data: {
          invoicesLimit: data.invoicesLimit,
          resetDate: data.resetDate
        }
      });

      // 3. Create Audit Log
      await tx.auditLog.create({
        data: {
          userId: data.userId,
          action: 'CHANGE_PLAN',
          resource: 'SUBSCRIPTION',
          details: { from: data.oldPlan, to: data.newPlan } as any
        }
      });

      // 4. Create Billing record if it's a paid plan
      if (data.price > 0) {
        await tx.billingHistory.create({
          data: {
            organizationId: data.organizationId,
            amount: data.price,
            status: PaymentStatus.SUCCESS,
            currency: 'INR',
            description: `Upgrade to ${data.newPlan} plan`,
            paidAt: new Date()
          }
        });
      }

      return updatedSub;
    });
  }
}

export const subscriptionRepository = new SubscriptionRepository();
