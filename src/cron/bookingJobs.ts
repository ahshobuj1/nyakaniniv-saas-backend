import cron from 'node-cron';
import { PrismaClient, BookingStatus, PaymentStatus, InvoiceStatus } from '@/prisma/generated/client';
import { AppLogger } from '@/core/logging/logger';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';

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
          this.emailProvider.sendEmail(
            booking.client.email,
            `Booking Expired - Payment Link Timeout for ${djName} - UpBeat Entertainment Africa`,
            `
            <html>
              <body>
                <p>Hi ${booking.client.name},</p>
                <p>Your payment link for the booking with <strong>${djName}</strong> has expired because the 48-hour window has passed.</p>
                <p>This booking request has been marked as expired.</p>
                <p>If you still wish to proceed, please submit a new booking request.</p>
                <br>
                <p>Regards,<br>UpBeat Entertainment Africa</p>
              </body>
            </html>
            `
          );
        }
      }

      this.logger.info(`[CRON] Successfully processed ${expiredBookings.length} expired bookings.`);
    } catch (error) {
      this.logger.error(`[CRON] Error running payment link expiry check:`, error);
    }
  }
}
