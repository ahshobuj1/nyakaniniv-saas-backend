import cron from 'node-cron';
import { PrismaClient, BookingStatus, SubscriptionStatus } from '@/prisma/generated/client';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { AppLogger } from '@/core/logging/logger';

export class EmailCronJobs {
  private logger = new AppLogger('EmailCronJobs');

  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) {}

  public init() {
    this.logger.info('Initializing Email Cron Jobs...');
    
    // 1. Upcoming Event Reminders: Runs every day at 08:00 AM
    cron.schedule('0 8 * * *', async () => {
      this.logger.info('[CRON] Running Upcoming Event Reminders...');
      await this.runUpcomingEventReminders();
    });

    // 2. Subscription Expiry Warnings: Runs every day at 09:00 AM
    cron.schedule('0 9 * * *', async () => {
      this.logger.info('[CRON] Running Subscription Expiry Warnings...');
      await this.runSubscriptionExpiryWarnings();
    });

    // 3. Subscription Expired processing: Runs every day at 10:00 AM
    cron.schedule('0 10 * * *', async () => {
      this.logger.info('[CRON] Running Subscription Expiry check...');
      await this.runSubscriptionExpiry();
    });
  }

  private async runUpcomingEventReminders() {
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const upcomingBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.completed,
        eventDate: {
          gte: tomorrowStart,
          lte: tomorrowEnd
        }
      },
      include: {
        client: true,
        tenant: {
          include: { user: true }
        }
      }
    });

    for (const booking of upcomingBookings) {
      if (booking.client?.email) {
        this.emailProvider.sendEmail(
          booking.client.email,
          "Upcoming Event Reminder 📅 - UpbeatAfrica",
          EmailTemplates.getUpcomingEventReminderTemplate(
            booking.eventType || "Event",
            booking.eventDate?.toISOString() || new Date().toISOString(),
            false
          )
        );
      }

      if (booking.tenant?.user?.email) {
        this.emailProvider.sendEmail(
          booking.tenant.user.email,
          "Upcoming Event Reminder 📅 - UpbeatAfrica",
          EmailTemplates.getUpcomingEventReminderTemplate(
            booking.eventType || "Event",
            booking.eventDate?.toISOString() || new Date().toISOString(),
            true
          )
        );
      }
    }
    
    this.logger.info(`[CRON] Processed ${upcomingBookings.length} upcoming event reminders.`);
  }

  private async runSubscriptionExpiryWarnings() {
    const threeDaysFromNowStart = new Date();
    threeDaysFromNowStart.setDate(threeDaysFromNowStart.getDate() + 3);
    threeDaysFromNowStart.setHours(0, 0, 0, 0);

    const threeDaysFromNowEnd = new Date(threeDaysFromNowStart);
    threeDaysFromNowEnd.setHours(23, 59, 59, 999);

    const expiringSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.active,
        periodEnd: {
          gte: threeDaysFromNowStart,
          lte: threeDaysFromNowEnd
        }
      },
      include: { user: true }
    });

    for (const sub of expiringSubscriptions) {
      if (sub.user?.email) {
        this.emailProvider.sendEmail(
          sub.user.email,
          "Subscription Expiring Soon! ⚠️ - UpbeatAfrica",
          EmailTemplates.getSubscriptionExpiryWarningTemplate(3)
        );
      }
    }

    this.logger.info(`[CRON] Processed ${expiringSubscriptions.length} subscription expiry warnings.`);
  }

  private async runSubscriptionExpiry() {
    const now = new Date();

    const expiredSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.active,
        periodEnd: {
          lt: now
        }
      },
      include: { user: true }
    });

    for (const sub of expiredSubscriptions) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.past_due }
      });

      if (sub.user?.email) {
        this.emailProvider.sendEmail(
          sub.user.email,
          "Subscription Expired - Portfolio Offline ⚠️ - UpbeatAfrica",
          EmailTemplates.getSubscriptionExpiredTemplate()
        );
      }
    }

    this.logger.info(`[CRON] Processed ${expiredSubscriptions.length} expired subscriptions.`);
  }
}
