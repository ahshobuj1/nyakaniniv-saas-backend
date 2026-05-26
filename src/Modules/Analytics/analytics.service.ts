import { PrismaClient, BookingStatus, SubscriptionStatus } from '@/prisma/generated/client';

export class AnalyticsServices {
  constructor(private prisma: PrismaClient) {}

  async getAdminAnalytics() {
    const [
      totalUsers,
      totalTenants,
      totalBookings,
      revenueInvoices,
      subscriptionStats,
      recentBookings
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tenant.count(),
      this.prisma.booking.count(),
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: 'paid' }
      }),
      this.prisma.subscription.groupBy({
        by: ['status'],
        _count: true
      }),
      this.prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { tenant: { include: { user: { select: { firstName: true, lastName: true } } } } }
      })
    ]);

    const subscriptions = {
      active: subscriptionStats.find(s => s.status === SubscriptionStatus.active)?._count || 0,
      canceled: subscriptionStats.find(s => s.status === SubscriptionStatus.canceled)?._count || 0,
      pastDue: subscriptionStats.find(s => s.status === SubscriptionStatus.past_due)?._count || 0,
    };

    return {
      totalUsers,
      totalTenants,
      totalBookings,
      totalRevenue: revenueInvoices._sum.amount || 0,
      subscriptions,
      recentBookings
    };
  }

  async getTenantAnalytics(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) return null;

    const [
      totalEarnings,
      pendingInvoices,
      bookingStats,
      recentRequests
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { tenantId: tenant.id, status: 'paid' }
      }),
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { tenantId: tenant.id, status: 'unpaid' }
      }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { tenantId: tenant.id },
        _count: true
      }),
      this.prisma.booking.findMany({
        where: { tenantId: tenant.id },
        take: 10,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const bookings = {
      pending: bookingStats.find(s => s.status === BookingStatus.pending)?._count || 0,
      accepted: bookingStats.find(s => s.status === BookingStatus.accepted)?._count || 0,
      completed: bookingStats.find(s => s.status === BookingStatus.completed)?._count || 0,
    };

    return {
      totalEarnings: totalEarnings._sum.amount || 0,
      pendingInvoices: pendingInvoices._sum.amount || 0,
      bookings,
      recentRequests
    };
  }

  async getAdminCharts() {
    const revenueChart = await this.prisma.$queryRaw`
      SELECT to_char(DATE_TRUNC('month', created_at), 'YYYY-MM') as month, COALESCE(SUM(amount), 0)::float as amount
      FROM invoices
      WHERE status = 'paid' AND created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC;
    `;

    const usersGrowthChart = await this.prisma.$queryRaw`
      SELECT to_char(DATE_TRUNC('month', created_at), 'YYYY-MM') as month, COUNT(id)::int as count
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC;
    `;

    return { revenueChart, usersGrowthChart };
  }

  async getTenantCharts(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) return null;

    const earningsChart = await this.prisma.$queryRaw`
      SELECT to_char(DATE_TRUNC('month', created_at), 'YYYY-MM') as month, COALESCE(SUM(amount), 0)::float as amount
      FROM invoices
      WHERE tenant_id = CAST(${tenant.id} AS UUID) AND status = 'paid' AND created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC;
    `;

    const bookingsChart = await this.prisma.$queryRaw`
      SELECT to_char(DATE_TRUNC('month', created_at), 'YYYY-MM') as month, COUNT(id)::int as count
      FROM bookings
      WHERE tenant_id = CAST(${tenant.id} AS UUID) AND created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC;
    `;

    return { earningsChart, bookingsChart };
  }
}
