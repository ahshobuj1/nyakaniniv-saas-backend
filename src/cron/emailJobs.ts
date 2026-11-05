import cron from 'node-cron';
import { PrismaClient, BookingStatus, SubscriptionStatus, NotificationType } from '@/prisma/generated/client';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { AppLogger } from '@/core/logging/logger';
import { config } from '@/core/config';

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
        status: BookingStatus.CONFIRMED,
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
        const clientManageUrl = `${config.clientUrl}/booking/manage/${booking.id}`;
        this.emailProvider.sendEmail(
          booking.client.email,
          "Upcoming Event Reminder 📅 - UpBeat Entertainment Africa",
          EmailTemplates.getUpcomingEventReminderTemplate(
            booking.eventType || "Event",
            booking.eventDate?.toISOString() || new Date().toISOString(),
            false,
            clientManageUrl
          )
        );
      }

      if (booking.tenant?.user?.email) {
        const djDashboardUrl = `${config.clientUrl}/dashboard/bookings/${booking.id}`;
        this.emailProvider.sendEmail(
          booking.tenant.user.email,
          "Upcoming Event Reminder 📅 - UpBeat Entertainment Africa",
          EmailTemplates.getUpcomingEventReminderTemplate(
            booking.eventType || "Event",
            booking.eventDate?.toISOString() || new Date().toISOString(),
            true,
            djDashboardUrl
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
          "Subscription Expiring Soon! - UpBeat Entertainment Africa",
          EmailTemplates.getSubscriptionExpiryWarningTemplate(3)
        );
      }

      if (sub.userId) {
        await this.prisma.notification.create({
          data: {
            userId: sub.userId,
            title: 'Subscription Expiring Soon (3 Days Left) 📅',
            message: 'Your subscription will expire in 3 days. Renew now to keep your DJ portfolio uninterrupted.',
            type: NotificationType.system,
            referenceId: sub.id,
          },
        }).catch((err) => {
          this.logger.error('Failed to create in-app expiry notification:', err);
        });
      }
    }

    this.logger.info(`[CRON] Processed ${expiringSubscriptions.length} subscription expiry warnings.`);
  }

  private async runSubscriptionExpiry() {
    const now = new Date();
    const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

    // Stage 1: Subscriptions that just reached their periodEnd (active -> past_due: Grace Period starts)
    // The DJ's portfolio remains LIVE during this 7-day grace period!
    const newlyExpiredSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.active,
        periodEnd: {
          lt: now,
        },
      },
      include: { user: true },
    });

    for (const sub of newlyExpiredSubscriptions) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.past_due },
      });

      if (sub.userId) {
        await this.prisma.tenant.updateMany({
          where: { userId: sub.userId },
          data: { subscriptionStatus: SubscriptionStatus.past_due },
        });

        await this.prisma.notification.create({
          data: {
            userId: sub.userId,
            title: '7-Day Grace Period Active ⚠️',
            message: 'Your subscription cycle ended. You have entered a 7-day grace period. Your portfolio remains online, but will go offline in 7 days if not renewed.',
            type: NotificationType.system,
            referenceId: sub.id,
          },
        }).catch((err) => {
          this.logger.error('Failed to create in-app grace period notification:', err);
        });
      }

      if (sub.user?.email) {
        this.emailProvider.sendEmail(
          sub.user.email,
          "Action Required: Subscription Grace Period (7 Days Remaining) - UpBeat Entertainment Africa",
          EmailTemplates.getSubscriptionGracePeriodTemplate(7),
        );
      }
    }

    // Stage 2: Subscriptions in past_due whose 7-day grace period has now fully expired
    // Only now does the DJ's portfolio go offline (past_due -> canceled)
    const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_MS);
    const graceExpiredSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.past_due,
        periodEnd: {
          lt: graceCutoff,
        },
      },
      include: { user: true },
    });

    for (const sub of graceExpiredSubscriptions) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.canceled },
      });

      if (sub.userId) {
        await this.prisma.tenant.updateMany({
          where: { userId: sub.userId },
          data: { subscriptionStatus: SubscriptionStatus.canceled },
        });

        await this.prisma.notification.create({
          data: {
            userId: sub.userId,
            title: 'Subscription Expired - Portfolio Offline ⚠️',
            message: 'Your 7-day grace period has ended and your public portfolio website is now offline. Please renew your plan to reactivate.',
            type: NotificationType.system,
            referenceId: sub.id,
          },
        }).catch((err) => {
          this.logger.error('Failed to create in-app cancellation notification:', err);
        });
      }

      if (sub.user?.email) {
        this.emailProvider.sendEmail(
          sub.user.email,
          "Subscription Expired - Portfolio Offline ⚠️ - UpBeat Entertainment Africa",
          EmailTemplates.getSubscriptionExpiredTemplate(),
        );
      }
    }

    this.logger.info(
      `[CRON] Processed ${newlyExpiredSubscriptions.length} grace period entries and ${graceExpiredSubscriptions.length} grace-expired cancellations.`,
    );
  }
}
