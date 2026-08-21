import { PrismaClient, BookingStatus, InvoiceStatus, InvoiceType, NotificationType, PaymentChannel } from '@/prisma/generated/client';
import Stripe from 'stripe';
import { config } from '@/core/config';

const stripe = new Stripe(config.stripe.secretKey || process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-04-10" as any,
});
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { CreateBookingDTO, UpdateBookingStatusDTO } from './BookingDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { PaymentProviderFactory } from '@/providers/PaymentProvider/PaymentProviderFactory';

export class BookingServices {
  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) { }

  private async getTenantIdByUserId(userId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) {
      throw new AuthorizationError();
    }
    return tenant.id;
  }

  async createBooking(data: CreateBookingDTO) {
    const tenant = await this.prisma.tenant.findUnique({ 
      where: { id: data.tenantId },
      include: { user: true }
    });
    if (!tenant) {
      throw new NotFoundError();
    }

    let client = await this.prisma.client.findFirst({
      where: { email: data.clientEmail, tenantId: data.tenantId }
    });
    if (!client) {
      client = await this.prisma.client.create({
        data: {
          tenantId: data.tenantId,
          name: data.clientName,
          email: data.clientEmail,
          phone: data.clientPhone
        }
      });
    }

    const booking = await this.prisma.booking.create({
      data: {
        tenantId: data.tenantId,
        clientId: client.id,
        eventType: data.eventType,
        eventDetails: data.eventDetails,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        address: data.address,
        status: BookingStatus.pending,
      },
    });

    if (tenant.userId) {
      await this.prisma.notification.create({
        data: {
          userId: tenant.userId,
          title: "New Booking Request",
          message: `You have a new booking request from ${data.clientName} for ${data.eventType}.`,
          type: NotificationType.booking_request, 
          referenceId: booking.id,
        }
      });

      if (tenant.user && tenant.user.email) {
        this.emailProvider.sendEmail(
          tenant.user.email,
          "New Booking Request - UpBeat Entertainment Africa",
          EmailTemplates.getNewBookingAlertTemplate(data.clientName, data.eventType || "Event", data.eventDate || new Date().toISOString())
        );
      }
    }

    // Auto-reply to Client
    this.emailProvider.sendEmail(
      data.clientEmail,
      "Booking Request Received - UpBeat Entertainment Africa",
      EmailTemplates.getBookingAutoReplyTemplate(tenant.stageName || tenant.user?.firstName || "DJ", data.eventType || "Event")
    );

    return booking;
  }

  async getMyBookings(userId: string, query: Record<string, unknown> = {}) {
    const tenantId = await this.getTenantIdByUserId(userId);

    const bookingQuery = new QueryBuilder(this.prisma.booking, query)
      .search(['clientName', 'clientEmail', 'status', 'eventType'])
      .filter()
      .sort()
      .pagination()
      .fields();

    bookingQuery.prismaArgs.where = {
      ...bookingQuery.prismaArgs.where,
      tenantId,
    };

    if (!bookingQuery.prismaArgs.select) {
      bookingQuery.prismaArgs.include = {
        invoice: { include: { transactions: true } },
        client: true,
      };
    }

    const bookings = await bookingQuery.model.findMany(bookingQuery.prismaArgs);
    const meta = await bookingQuery.countTotal();

    return { bookings, meta };
  }

  async getBookingById(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
      include: { invoice: { include: { transactions: true } }, client: true },
    });

    if (!booking) {
      throw new NotFoundError();
    }
    return booking;
  }

  async updateBookingStatus(userId: string, id: string, data: UpdateBookingStatusDTO) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
      include: { client: true, tenant: { include: { user: true } } }
    });

    if (!booking || !booking.client) {
      throw new NotFoundError();
    }

    // Logic for accepting a booking: create an invoice
    if (data.status === BookingStatus.accepted && booking.status !== BookingStatus.accepted) {
      if (!data.totalAmount) {
        throw new BadRequestError();
      }

      // Perform in transaction
      const txResult = await this.prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id },
          data: {
            status: data.status,
            totalAmount: data.totalAmount,
          },
        });

        // Create Payment
        const invoice = await tx.invoice.create({
          data: {
            tenantId,
            bookingId: id,
            amount: data.totalAmount || 0,
            // method is not set initially; it will be set by the respective webhook (Stripe/Paystack) upon payment
            status: InvoiceStatus.UNPAID,
            type: InvoiceType.BOOKING,
          }
        });

        return { updatedBooking, invoiceId: invoice.id };
      });

      const checkoutRedirectUrl = `${config.apiUrl}/bookings/v1/${id}/checkout-redirect`;
      const requestCashUrl = `${config.apiUrl}/bookings/v1/${id}/request-cash-redirect`;

      if (booking.client?.email) {
        this.emailProvider.sendEmail(
          booking.client.email,
          "Booking Request Accepted! - UpBeat Entertainment Africa",
          EmailTemplates.getBookingAcceptedTemplate(
            booking.tenant?.stageName || booking.tenant?.user?.firstName || "DJ",
            txResult.updatedBooking.eventType || "Event",
            checkoutRedirectUrl,
            requestCashUrl
          )
        );
      }

      return { ...txResult.updatedBooking, paymentId: txResult.invoiceId };
    }

    // Otherwise just update status
    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.totalAmount && { totalAmount: data.totalAmount }),
      },
    });

    if (((data.status as any) === 'canceled' || (data.status as any) === 'rejected') && booking.client?.email) {
      this.emailProvider.sendEmail(
        booking.client.email,
        "Booking Canceled - UpBeat Entertainment Africa",
        EmailTemplates.getBookingRejectedTemplate(
          booking.tenant?.stageName || booking.tenant?.user?.firstName || "DJ",
          booking.eventType || "Event"
        )
      );
    } else if (booking.client?.email) {
      // If just a regular update (not canceled, not accepted), consider it an update email
      this.emailProvider.sendEmail(
        booking.client.email,
        "Booking Details Updated - UpBeat Entertainment Africa",
        EmailTemplates.getBookingUpdatedTemplate(
          booking.tenant?.stageName || booking.tenant?.user?.firstName || "DJ",
          updatedBooking.eventType || "Event",
          updatedBooking.eventDate?.toISOString() || new Date().toISOString()
        )
      );
    }

    return updatedBooking;
  }

  async getBookingPaymentLink(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { tenant: true, invoice: true, client: true }
    });

    if (booking && booking.status === BookingStatus.completed) {
      throw new BadRequestError('Booking is already paid');
    }

    if (!booking || booking.status !== BookingStatus.accepted) {
      throw new BadRequestError('Booking is not ready for payment or already paid');
    }

    if (booking.invoice && booking.invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestError('Booking is already paid');
    }

    const paymentId = booking.invoice ? booking.invoice.id : id; // fallback to booking id if no invoice record

    // Determine the correct payment provider based on the DJ's country
    const paymentProvider = PaymentProviderFactory.getProvider(booking.tenantId);

    return paymentProvider.getPaymentLink(booking as any, paymentId);
  }

  async requestCashPayment(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { invoice: { include: { transactions: true } }, tenant: { include: { user: true } }, client: true }
    });

    if (!booking || booking.status !== BookingStatus.accepted) {
      throw new BadRequestError('Booking is not ready for payment');
    }

    if (booking.invoice && booking.invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestError('Booking is already paid');
    }

    if (!booking.invoice) {
      throw new BadRequestError('Payment record not found');
    }

    // Check if a PENDING cash transaction already exists
    const existingCashTx = booking.invoice.transactions.find(tx => tx.gateway === 'CASH' && tx.status === 'PENDING');
    if (existingCashTx) {
      return { success: true, message: 'Cash payment already requested' };
    }

    // Create a new PENDING transaction for CASH
    await this.prisma.transaction.create({
      data: {
        invoiceId: booking.invoice.id,
        userId: booking.tenant?.userId || null,
        tenantId: booking.tenantId,
        amount: booking.invoice.amount,
        currency: 'KES',
        gateway: 'CASH',
        channel: PaymentChannel.CASH,
        status: 'PENDING',
        metadata: { cashRequested: true, cashApproved: false }
      }
    });

    // Notify DJ that client requested cash payment
    if (booking.tenant?.userId) {
      await this.prisma.notification.create({
        data: {
          userId: booking.tenant.userId,
          title: 'Cash Payment Requested',
          message: `${booking.client?.name || 'Client'} has requested to pay by cash for the ${booking.eventType} booking.`,
          type: NotificationType.system,
          referenceId: booking.id,
        }
      });

      if (booking.tenant.user?.email) {
        this.emailProvider.sendEmail(
          booking.tenant.user.email,
          "Cash Payment Requested - UpBeat Entertainment Africa",
          EmailTemplates.getCashPaymentRequestedTemplate(
            booking.client?.name || 'Client',
            booking.eventType || 'Event'
          )
        );
      }
    }

    return { success: true, message: 'Cash payment requested successfully' };
  }

  async resendPaymentReminder(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
      include: { client: true, tenant: { include: { user: true } } }
    });

    if (!booking || booking.status !== BookingStatus.accepted) {
      throw new BadRequestError('Booking is not in a state waiting for payment');
    }

    if (booking.client?.email) {
      const checkoutRedirectUrl = `${config.apiUrl}/bookings/v1/${id}/checkout-redirect`;
      this.emailProvider.sendEmail(
        booking.client.email,
        "Payment Reminder for DJ Booking - UpBeat Entertainment Africa",
        EmailTemplates.getPaymentReminderTemplate(
          booking.tenant?.stageName || booking.tenant?.user?.firstName || "DJ",
          booking.eventType || "Event",
          checkoutRedirectUrl
        )
      );
    }

    return { success: true, message: 'Payment reminder sent successfully' };
  }

  async handleCashRequestDecision(userId: string, id: string, decision: 'approve' | 'reject') {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
      include: { invoice: { include: { transactions: true } } }
    });

    if (!booking || !booking.invoice) {
      throw new NotFoundError('Booking or payment not found');
    }

    const cashTx = booking.invoice.transactions.find(tx => tx.gateway === 'CASH' && tx.status === 'PENDING');
    if (!cashTx) {
      throw new BadRequestError('No pending cash request found');
    }

    if (decision === 'reject') {
      await this.prisma.transaction.update({
        where: { id: cashTx.id },
        data: { status: 'FAILED' }
      });
      // Optionally notify client to pay online
      return { success: true, message: 'Cash request rejected' };
    } else {
      await this.prisma.transaction.update({
        where: { id: cashTx.id },
        data: { metadata: { ...cashTx.metadata as any, cashApproved: true } }
      });
      return { success: true, message: 'Cash request approved' };
    }
  }

  async markCashAsPaid(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
      include: { invoice: { include: { transactions: true } } }
    });

    if (!booking || !booking.invoice) {
      throw new NotFoundError('Booking or payment not found');
    }

    const cashTx = booking.invoice.transactions.find(tx => tx.gateway === 'CASH' && (tx.status === 'PENDING' || tx.status === 'SUCCESS'));
    if (!cashTx) {
      throw new BadRequestError('No valid cash transaction found');
    }

    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: cashTx.id },
        data: { status: 'SUCCESS' }
      }),
      this.prisma.invoice.update({
        where: { id: booking.invoice.id },
        data: { status: InvoiceStatus.PAID }
      })
    ]);

    return { success: true, message: 'Cash payment confirmed and invoice marked as paid' };
  }
}
