import cron from 'node-cron';
import { PrismaClient, BookingStatus } from '@/prisma/generated/client';
import { AppLogger } from '@/core/logging/logger';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { config } from '@/core/config';

export class BookingCronJobs {
  private logger = new AppLogger('BookingCronJobs');

  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) {}

  public init() {
    this.logger.info('Initializing Booking Cron Jobs...');

    // Runs every hour to check for events that have ended and send completion confirmation reminders
    cron.schedule('0 * * * *', async () => {
      this.logger.info('[CRON] Running Event Completion Reminder Check...');
      await this.runCompletionReminderCheck();
    });
  }

  /**
   * After the event scheduled end, prompts the client to confirm completion or report an issue.
   * Does NOT automatically mark completed merely because event time expired (spec §7 & §8).
   */
  private async runCompletionReminderCheck() {
    const now = new Date();

    try {
      const endedBookings = await this.prisma.booking.findMany({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
          eventDate: {
            lt: now,
          },
          completionRequestedAt: null,
        },
        include: {
          client: true,
          tenant: true,
        },
      });

      if (endedBookings.length === 0) return;

      this.logger.info(`[CRON] Found ${endedBookings.length} completed events ready for confirmation reminder.`);

      for (const booking of endedBookings) {
        try {
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: { completionRequestedAt: now },
          });

          await this.prisma.bookingAuditEvent.create({
            data: {
              bookingId: booking.id,
              actorType: 'SYSTEM',
              eventType: 'COMPLETION_REMINDER_SENT',
              metadata: { sentAt: now.toISOString() },
            },
          });

          if (booking.client?.email) {
            const djName = booking.tenant?.stageName || 'the DJ';
            const portalUrl = `${config.clientUrl}/booking/manage/${booking.id}`;

            this.emailProvider.sendEmail(
              booking.client.email,
              `Please Confirm Event Completion - ${djName}`,
              EmailTemplates.getCompletionConfirmationRequestTemplate({
                clientName: booking.client.name || 'Client',
                djName,
                eventType: booking.eventType || 'Event',
                portalUrl,
              }),
            );
          }
        } catch (err) {
          this.logger.error(`[CRON] Failed to send completion reminder for booking #${booking.id}:`, err);
        }
      }
    } catch (error) {
      this.logger.error(`[CRON] Error running completion reminder check:`, error);
    }
  }
}
