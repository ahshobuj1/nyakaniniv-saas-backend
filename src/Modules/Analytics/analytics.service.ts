import { PrismaClient, BookingStatus, SubscriptionStatus, InvoiceStatus, InvoiceType } from '@/prisma/generated/client';

export class AnalyticsServices {
  constructor(private prisma: PrismaClient) {}

  async getAdminAnalytics() {
    const [
      totalUsers,
      totalTenants,
      totalBookings,
      revenueInvoices,
      subscriptionStats,
      subscriptionPlans,
      recentBookings
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tenant.count(),
      this.prisma.booking.count(),
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: InvoiceStatus.PAID, type: InvoiceType.SUBSCRIPTION }
      }),
      this.prisma.subscription.groupBy({
        by: ['status'],
        _count: true
      }),
      this.prisma.subscriptionPlan.findMany({
        select: {
          id: true,
          name: true,
          priceMonthly: true,
          priceAnnually: true,
          isActive: true,
          subscriptions: {
            select: {
              status: true
            }
          }
        },
        orderBy: { priceMonthly: 'asc' }
      }),
      this.prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          eventType: true,
          eventDate: true,
          address: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          tenant: {
            select: {
              id: true,
              subdomain: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      })
    ]);

    const activeCount = subscriptionStats.find((s: any) => s.status === SubscriptionStatus.active)?._count || 0;
    const canceledCount = subscriptionStats.find((s: any) => s.status === SubscriptionStatus.canceled)?._count || 0;
    const pastDueCount = subscriptionStats.find((s: any) => s.status === SubscriptionStatus.past_due)?._count || 0;

    const byPlan = subscriptionPlans.map((plan) => {
      const activeSubscribers = plan.subscriptions.filter((s: any) => s.status === SubscriptionStatus.active).length;
      const totalPurchases = plan.subscriptions.length;
      return {
        planId: plan.id,
        planName: plan.name || 'Unnamed Plan',
        priceMonthly: Number(plan.priceMonthly || 0),
        priceAnnually: Number(plan.priceAnnually || 0),
        isActive: plan.isActive,
        activeSubscribers,
        totalPurchases
      };
    });

    const subscriptions = {
      active: activeCount,
      canceled: canceledCount,
      pastDue: pastDueCount,
      total: activeCount + canceledCount + pastDueCount,
      byPlan
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
        where: { tenantId: tenant.id, status: InvoiceStatus.PAID, type: InvoiceType.BOOKING }
      }),
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { tenantId: tenant.id, status: InvoiceStatus.UNPAID, type: InvoiceType.BOOKING }
      }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { tenantId: tenant.id },
        _count: true
      }),
      this.prisma.booking.findMany({
        where: { tenantId: tenant.id },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { client: true, invoice: true }
      })
    ]);

    const bookings = {
      pending: bookingStats.find((s: any) => s.status === BookingStatus.pending)?._count || 0,
      accepted: bookingStats.find((s: any) => s.status === BookingStatus.accepted)?._count || 0,
      completed: bookingStats.find((s: any) => s.status === BookingStatus.completed)?._count || 0,
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
      WHERE status = 'PAID' AND type = 'SUBSCRIPTION' AND created_at >= CURRENT_DATE - INTERVAL '12 months'
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
      WHERE tenant_id = CAST(${tenant.id} AS UUID) AND status = 'PAID' AND type = 'BOOKING' AND created_at >= CURRENT_DATE - INTERVAL '12 months'
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
