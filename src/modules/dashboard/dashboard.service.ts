import { dashboardRepository } from './dashboard.repository';
import { 
  DashboardOverview, 
  DashboardFilters, 
  InvoiceTrend, 
  TopClient, 
  RecentActivity 
} from './dashboard.types';
import { SubscriptionPlan, InvoiceStatus } from '@prisma/client';
import { isAdminRole, getAssignedClientIds } from '../../shared/access';

export class DashboardService {
  private async getAccessFilter(
    userId: string,
    userRole: string
  ): Promise<string[] | null> {
    if (isAdminRole(userRole)) return null;
    return getAssignedClientIds(userId);
  }

  async getOverview(
    organizationId: string,
    userId: string,
    userRole: string,
    filters: DashboardFilters
  ): Promise<DashboardOverview> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
    const endDate = filters.endDate ? new Date(filters.endDate) : undefined;

    const [
      invoiceCounts,
      invoiceValues,
      docCount,
      clientCount,
      userCount,
      quota,
      sub
    ] = await Promise.all([
      dashboardRepository.getInvoiceCounts(organizationId, accessFilter, startDate, endDate),
      dashboardRepository.getInvoiceValues(organizationId, accessFilter, InvoiceStatus.APPROVED, startDate, endDate),
      dashboardRepository.getDocumentCounts(organizationId, accessFilter, userId),
      dashboardRepository.getClientCounts(organizationId, accessFilter),
      dashboardRepository.getUserCounts(organizationId),
      dashboardRepository.getUsageQuota(organizationId),
      dashboardRepository.getSubscription(organizationId)
    ]);

    const totalInvoices = invoiceCounts.reduce((acc, curr) => acc + curr._count._all, 0);
    const approved = invoiceCounts.find(c => c.status === 'APPROVED')?._count._all || 0;
    const rejected = invoiceCounts.find(c => c.status === 'REJECTED')?._count._all || 0;
    const pending = invoiceCounts.find(c => c.status === 'SUBMITTED')?._count._all || 0;

    return {
      invoices: {
        total: totalInvoices,
        pending,
        approved,
        rejected,
        totalAmount: invoiceValues._sum.totalAmount?.toString() || '0'
      },
      usage: {
        plan: sub?.plan || SubscriptionPlan.FREE,
        invoicesProcessed: quota?.invoicesProcessed || 0,
        invoicesLimit: quota?.invoicesLimit || 0
      },
      counts: {
        documents: docCount,
        clients: clientCount,
        users: userCount
      }
    };
  }

  async getInvoiceTrend(
    organizationId: string,
    userId: string,
    userRole: string,
    period: string = 'last30days'
  ): Promise<InvoiceTrend> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const days = period === 'last7days' ? 7 : period === 'last90days' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const invoices = await dashboardRepository.getInvoiceTrend(organizationId, accessFilter, startDate);
    
    // Grouping strategy: daily for all these short periods
    const trendMap = new Map<string, { count: number; amount: number }>();
    
    // Initialize map with all days in range to ensure zero points are shown
    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dayStr = d.toISOString().substring(0, 10); // YYYY-MM-DD
      trendMap.set(dayStr, { count: 0, amount: 0 });
    }

    invoices.forEach(inv => {
      const day = inv.createdAt.toISOString().substring(0, 10);
      const existing = trendMap.get(day);
      if (existing) {
        trendMap.set(day, {
          count: existing.count + 1,
          amount: existing.amount + Number(inv.totalAmount)
        });
      }
    });

    const points = Array.from(trendMap.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      amount: data.amount.toString()
    })).sort((a, b) => a.date.localeCompare(b.date));

    return { points };
  }

  async getTopClients(
    organizationId: string,
    userId: string,
    userRole: string,
    period: string = 'last30days'
  ): Promise<TopClient[]> {
    const accessFilter = await this.getAccessFilter(userId, userRole);
    const days = period === 'last7days' ? 7 : period === 'last90days' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const topStats = await dashboardRepository.getTopClients(organizationId, accessFilter, startDate);
    const clientIds = topStats.map(s => s.clientId as string);
    const clients = await dashboardRepository.getClientNames(clientIds);
    
    return topStats.map(s => {
      const client = clients.find(c => c.id === s.clientId);
      return {
        id: s.clientId as string,
        name: client?.name || 'Unknown',
        count: s._count._all,
        amount: s._sum.totalAmount?.toString() || '0'
      };
    });
  }

  async getRecentActivity(
    organizationId: string,
    userId: string,
    userRole: string
  ): Promise<RecentActivity[]> {
    const isAdmin = isAdminRole(userRole);
    const logs = await dashboardRepository.getRecentActivity(organizationId, isAdmin ? null : userId);
    return logs.map(l => ({
      id: l.id,
      action: l.action,
      resource: l.resource,
      details: l.details,
      createdAt: l.createdAt,
      user: l.user ? { fullName: l.user.fullName } : null
    }));
  }
}

export const dashboardService = new DashboardService();
