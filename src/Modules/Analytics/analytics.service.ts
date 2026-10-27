import { PrismaClient, BookingStatus, SubscriptionStatus, InvoiceStatus, InvoiceType, TransactionStatus } from '@/prisma/generated/client';

export class AnalyticsServices {
  constructor(private prisma: PrismaClient) {}

  async getAdminAnalytics(filterCurrency?: string) {
    const isSpecificCurrency = !!filterCurrency && filterCurrency.trim().toUpperCase() !== 'ALL';
    const targetCurrency = isSpecificCurrency ? filterCurrency!.trim().toUpperCase() : 'USD';

    const [
      totalUsers,
      totalTenants,
      totalBookings,
      revenueAggregation,
      currencyBreakdown,
      subscriptionStats,
      subscriptionPlans,
      recentBookings
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tenant.count(),
      this.prisma.booking.count(),
      // Aggregate revenue based on filter (USD consolidated or specific currency)
      isSpecificCurrency
        ? this.prisma.transaction.aggregate({
            _sum: { amount: true, amountUsd: true },
            where: {
              status: TransactionStatus.SUCCEEDED,
              currency: targetCurrency,
              invoice: { type: InvoiceType.SUBSCRIPTION },
            },
          })
        : this.prisma.transaction.aggregate({
            _sum: { amount: true, amountUsd: true },
            where: {
              status: TransactionStatus.SUCCEEDED,
              invoice: { type: InvoiceType.SUBSCRIPTION },
            },
          }),
      // Breakdown across all currencies
      this.prisma.transaction.groupBy({
        by: ['currency'],
        where: {
          status: TransactionStatus.SUCCEEDED,
          invoice: { type: InvoiceType.SUBSCRIPTION },
        },
        _sum: { amount: true, amountUsd: true },
        _count: true,
      }),
      this.prisma.subscription.groupBy({
        by: ['status'],
        _count: true,
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
              status: true,
            },
          },
        },
        orderBy: { priceMonthly: 'asc' },
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
      }),
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
        totalPurchases,
      };
    });

    const subscriptions = {
      active: activeCount,
      canceled: canceledCount,
      pastDue: pastDueCount,
      total: activeCount + canceledCount + pastDueCount,
      byPlan,
    };

    const totalRevenue = isSpecificCurrency
      ? Number(revenueAggregation._sum.amount || 0)
      : Number(revenueAggregation._sum.amountUsd || 0);

    const revenueByCurrency = currencyBreakdown.map((item) => ({
      currency: item.currency,
      amount: Number(item._sum.amount || 0),
      amountUsd: Number(item._sum.amountUsd || 0),
      count: item._count,
    }));

    return {
      totalUsers,
      totalTenants,
      totalBookings,
      reportingCurrency: targetCurrency,
      totalRevenue,
      revenueByCurrency,
      subscriptions,
      recentBookings,
    };
  }

  async getTenantAnalytics(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) return null;

    const [
      completedEarnings,
      pendingBookingAmounts,
      bookingStats,
      recentRequests
    ] = await Promise.all([
      // 1. Total Earnings: Sum of totalAmount for all COMPLETED bookings
      this.prisma.booking.aggregate({
        _sum: { totalAmount: true },
        where: {
          tenantId: tenant.id,
          status: BookingStatus.COMPLETED,
        }
      }),
      // 2. Pending / In-progress: Sum of totalAmount for confirmed/accepted bookings awaiting completion
      this.prisma.booking.aggregate({
        _sum: { totalAmount: true },
        where: {
          tenantId: tenant.id,
          status: {
            in: [
              BookingStatus.ACCEPTED,
              BookingStatus.AWAITING_PAYMENT,
              BookingStatus.CONFIRMED,
              BookingStatus.IN_PROGRESS,
            ]
          }
        }
      }),
      // 3. Status breakdown
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { tenantId: tenant.id },
        _count: true
      }),
      // 4. Recent Requests
      this.prisma.booking.findMany({
        where: { tenantId: tenant.id },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { 
          client: true, 
          invoice: {
            include: {
              transactions: {
                orderBy: { createdAt: 'desc' }
              }
            }
          } 
        }
      })
    ]);

    const bookings = {
      pending: bookingStats.find((s: any) => s.status === BookingStatus.PENDING)?._count || 0,
      accepted: bookingStats.reduce((sum: number, s: any) => {
        if ([BookingStatus.ACCEPTED, BookingStatus.AWAITING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS].includes(s.status)) {
          return sum + s._count;
        }
        return sum;
      }, 0),
      completed: bookingStats.find((s: any) => s.status === BookingStatus.COMPLETED)?._count || 0,
    };

    return {
      totalEarnings: completedEarnings._sum.totalAmount ? Number(completedEarnings._sum.totalAmount) : 0,
      pendingInvoices: pendingBookingAmounts._sum.totalAmount ? Number(pendingBookingAmounts._sum.totalAmount) : 0,
      currencyCode: tenant.currencyCode || 'KES',
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
      SELECT to_char(DATE_TRUNC('month', created_at), 'YYYY-MM') as month, COALESCE(SUM(total_amount), 0)::float as amount
      FROM bookings
      WHERE tenant_id = CAST(${tenant.id} AS UUID) AND status = 'COMPLETED' AND created_at >= CURRENT_DATE - INTERVAL '12 months'
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
