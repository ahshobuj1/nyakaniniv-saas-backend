import { PrismaClient, BookingStatus, BookingPaymentMethod, BookingPaymentStatus, NotificationType } from '@/prisma/generated/client';
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
        }
      });

      if (tenant.user && tenant.user.email) {
        await this.emailProvider.sendEmail(
          tenant.user.email,
          "New Booking Request Alert - UpbeatAfrica",
          EmailTemplates.getNewBookingAlertTemplate(data.clientName, data.eventType || "Event", data.eventDate || new Date().toISOString())
        );
      }
    }

    // Auto-reply to Client
    await this.emailProvider.sendEmail(
      data.clientEmail,
      "Booking Request Received - UpbeatAfrica",
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
        payment: true,
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
      include: { payment: true, client: true },
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
      return this.prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id },
          data: {
            status: data.status,
            totalAmount: data.totalAmount,
          },
        });

        // Create Payment
        const payment = await tx.bookingPayment.create({
          data: {
            tenantId,
            bookingId: id,
            amount: data.totalAmount,
            method: BookingPaymentMethod.STRIPE, // default to stripe, client pays online
            status: BookingPaymentStatus.unpaid,
          }
        });

        const tenantInfo = await tx.tenant.findUnique({ where: { id: tenantId } });

        const platformInvoiceUrl = `https://${tenantInfo?.subdomain}.upbeatafrica.com/booking/${id}`;

        if (booking.client?.email) {
          await this.emailProvider.sendEmail(
            booking.client.email,
            "Booking Request Accepted! - UpbeatAfrica",
            EmailTemplates.getBookingAcceptedTemplate(
              booking.tenant?.stageName || booking.tenant?.user?.firstName || "DJ",
              updatedBooking.eventType || "Event",
              platformInvoiceUrl
            )
          );
        }

        return { ...updatedBooking, paymentId: payment.id };
      });
    }

    // Otherwise just update status
    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.totalAmount && { totalAmount: data.totalAmount }),
      },
    });

    if ((data.status as any) === 'canceled' && booking.client?.email) {
      await this.emailProvider.sendEmail(
        booking.client.email,
        "Booking Canceled - UpbeatAfrica",
        EmailTemplates.getBookingRejectedTemplate(
          booking.tenant?.stageName || booking.tenant?.user?.firstName || "DJ",
          booking.eventType || "Event"
        )
      );
    } else if (booking.client?.email) {
      // If just a regular update (not canceled, not accepted), consider it an update email
      await this.emailProvider.sendEmail(
        booking.client.email,
        "Booking Details Updated - UpbeatAfrica",
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
      include: { tenant: true, payment: true }
    });

    if (!booking || booking.status !== BookingStatus.accepted || !booking.totalAmount) {
      throw new BadRequestError('Booking is not ready for payment or already paid');
    }

    if (booking.payment && booking.payment.status === BookingPaymentStatus.paid) {
      throw new BadRequestError('Booking is already paid');
    }

    if (!booking.tenant?.stripeAccountId) {
      throw new BadRequestError('DJ has not configured Stripe payments yet');
    }

    const paymentId = booking.payment ? booking.payment.id : id; // fallback to booking id if no payment record

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Booking: ${booking.eventType}`,
              description: booking.eventDetails || "DJ Services",
            },
            unit_amount: Math.round(Number(booking.totalAmount) * 100), // Stripe takes cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `https://${booking.tenant.subdomain}.upbeatafrica.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${booking.tenant.subdomain}.upbeatafrica.com/booking/${id}`,
      payment_intent_data: {
        application_fee_amount: Math.round(Number(booking.totalAmount) * 100 * 0.05), // 5% Application Fee
        transfer_data: {
          destination: booking.tenant.stripeAccountId,
        },
      },
      metadata: {
        invoiceId: paymentId,
        bookingId: id,
      }
    });

    return { checkoutUrl: session.url };
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
      const platformInvoiceUrl = `https://${booking.tenant?.subdomain}.upbeatafrica.com/booking/${id}`;
      await this.emailProvider.sendEmail(
        booking.client.email,
        "Reminder: Payment Required for your Booking - UpbeatAfrica",
        EmailTemplates.getPaymentReminderTemplate(
          booking.tenant?.stageName || booking.tenant?.user?.firstName || "DJ",
          booking.eventType || "Event",
          platformInvoiceUrl
        )
      );
    }

    return { success: true, message: 'Payment reminder sent successfully' };
  }
}
