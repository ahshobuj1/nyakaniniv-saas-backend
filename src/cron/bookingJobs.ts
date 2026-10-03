import cron from 'node-cron';
import { PrismaClient, BookingStatus, PaymentStatus, InvoiceStatus } from '@/prisma/generated/client';
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
    
    // Runs every hour to check for expired booking payment links
    cron.schedule('0 * * * *', async () => {
      this.logger.info('[CRON] Running Payment Link Expiry Check...');
      await this.runPaymentLinkExpiryCheck();
    });

    // Runs every hour to check for bookings that should be auto-completed
    cron.schedule('0 * * * *', async () => {
      this.logger.info('[CRON] Running Auto-Completion Check...');
      await this.runAutoCompletionCheck();
    });

    // Runs every 6 hours to retry gateway refunds that previously FAILED
    cron.schedule('0 */6 * * *', async () => {
      this.logger.info('[CRON] Running Failed Refund Retry...');
      await this.runFailedRefundRetry();
    });
  }

  private async runPaymentLinkExpiryCheck() {
    const now = new Date();
    
    try {
      const expiredBookings = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.AWAITING_PAYMENT,
          paymentStatus: PaymentStatus.PENDING,
          paymentDueAt: {
            lt: now,
          },
        },
        include: {
          client: true,
          tenant: { include: { user: true } },
          invoice: true,
        }
      });

      if (expiredBookings.length === 0) {
        return;
      }

      this.logger.info(`[CRON] Found ${expiredBookings.length} bookings with expired payment links.`);

      for (const booking of expiredBookings) {
        await this.prisma.$transaction(async (tx) => {
          // Update booking
          await tx.booking.update({
            where: { id: booking.id },
            data: { 
              status: BookingStatus.EXPIRED,
              paymentStatus: PaymentStatus.FAILED 
            },
          });

          // Update invoice if it exists
          if (booking.invoice) {
            await tx.invoice.update({
              where: { id: booking.invoice.id },
              data: { status: InvoiceStatus.OVERDUE },
            });
          }
        });

        // Send email to client
        if (booking.client?.email) {
          const djName = booking.tenant?.stageName || booking.tenant?.user?.firstName || 'DJ';
          const manageUrl = `${config.clientUrl}/booking/manage/${booking.id}`;
          const expiredContent = `
            <p style="margin-top: 0; font-size: 16px;">Hi <strong>${booking.client.name}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6;">
              Your payment link for the booking with <strong>${djName}</strong> has expired because the 48-hour payment window has passed.
            </p>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: bold;">
                Booking Status: EXPIRED
              </p>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569;">
                The reserved date has been released back to the DJ's public schedule.
              </p>
            </div>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              If you still wish to book ${djName}, please submit a new booking request. You can review the details of this expired booking anytime in your client portal:
            </p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${manageUrl}" style="display: inline-block; padding: 12px 26px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);">
                📋 View Booking Details &rarr;
              </a>
            </div>
            <p style="text-align: center; font-size: 12px; color: #94a3b8;">
              Portal Link: <a href="${manageUrl}" style="color: #dc2626; word-break: break-all;">${manageUrl}</a>
            </p>
          `;
          this.emailProvider.sendEmail(
            booking.client.email,
            `Booking Expired - Payment Link Timeout for ${djName} - UpBeat Entertainment Africa`,
            EmailTemplates.getHtmlShell('Booking Expired', expiredContent)
          );
        }
      }

      this.logger.info(`[CRON] Successfully processed ${expiredBookings.length} expired bookings.`);
    } catch (error) {
      this.logger.error(`[CRON] Error running payment link expiry check:`, error);
    }
  }

  private async runAutoCompletionCheck() {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      const inProgressBookings = await this.prisma.booking.findMany({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
          eventDate: {
            lt: twentyFourHoursAgo,
          },
        },
      });

      if (inProgressBookings.length === 0) return;

      this.logger.info(`[CRON] Found ${inProgressBookings.length} bookings ready for auto-completion.`);
      
      const { BookingStatusService } = require('@/Modules/Booking/booking-status.service');
      const bookingStatusService = new BookingStatusService(this.prisma, this.emailProvider);

      for (const booking of inProgressBookings) {
        try {
          await bookingStatusService.transition({
            bookingId: booking.id,
            targetStatus: BookingStatus.COMPLETED,
            reason: 'System auto-completed booking 24h after event date',
            cancelledBy: 'SYSTEM'
          });
        } catch (err) {
          this.logger.error(`[CRON] Failed to auto-complete booking ${booking.id}:`, err);
        }
      }
    } catch (error) {
      this.logger.error(`[CRON] Error running auto-completion check:`, error);
    }
  }

  /**
   * Retries FAILED gateway refunds. After MAX_REFUND_ATTEMPTS the refund is
   * escalated to MANUAL_REQUIRED so it never loops forever.
   */
  private async runFailedRefundRetry() {
    try {
      const { CancellationPolicyService } = require('@/Modules/Booking/cancellation-policy.service');
      const { WalletService } = require('@/Modules/Wallet/wallet.service');
      const walletService = new WalletService(this.prisma);
      const policyService = new CancellationPolicyService(this.prisma, walletService);

      const retried = await policyService.retryFailedRefunds();

      if (retried > 0) {
        this.logger.info(`[CRON] Retried ${retried} failed refund(s).`);
      }
    } catch (error) {
      this.logger.error(`[CRON] Error running failed refund retry:`, error);
    }
  }
}
