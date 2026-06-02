import { PrismaClient, BookingStatus, InvoiceType, InvoiceMethod, InvoicePaymentStatus, NotificationType } from '@/prisma/generated/client';
import Stripe from 'stripe';
import { config } from '@/core/config';

const stripe = new Stripe(config.stripe.secretKey || process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-04-10" as any,
});
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { CreateBookingDTO, UpdateBookingStatusDTO } from './BookingDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';

export class BookingServices {
  constructor(private prisma: PrismaClient) { }

  private async getTenantIdByUserId(userId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) {
      throw new AuthorizationError();
    }
    return tenant.id;
  }

  async createBooking(data: CreateBookingDTO) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: data.tenantId } });
    if (!tenant) {
      throw new NotFoundError();
    }

    const booking = await this.prisma.booking.create({
      data: {
        tenantId: data.tenantId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        eventType: data.eventType,
        eventDetails: data.eventDetails,
        clientPhone: data.clientPhone,
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
    }

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
        invoice: true,
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
      include: { invoice: true },
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
    });

    if (!booking) {
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

        // Create Invoice
        const invoice = await tx.invoice.create({
          data: {
            tenantId,
            bookingId: id,
            amount: data.totalAmount,
            type: InvoiceType.BOOKING,
            method: InvoiceMethod.STRIPE, // default to stripe, client pays online
            status: InvoicePaymentStatus.unpaid,
          }
        });

        // Generate Stripe Checkout Session if the DJ has Stripe Connect set up
        const tenantInfo = await tx.tenant.findUnique({ where: { id: tenantId } });
        let checkoutUrl = null;

        if (tenantInfo?.stripeAccountId) {
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
              {
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `Booking: ${updatedBooking.eventType}`,
                    description: updatedBooking.eventDetails || "DJ Services",
                  },
                  unit_amount: Math.round(Number(data.totalAmount) * 100), // Stripe takes cents
                },
                quantity: 1,
              },
            ],
            mode: 'payment',
            success_url: `${config.clientUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.clientUrl}/payment-cancel`,
            payment_intent_data: {
              application_fee_amount: Math.round(Number(data.totalAmount) * 100 * 0.05), // 5% Application Fee
              transfer_data: {
                destination: tenantInfo.stripeAccountId,
              },
            },
            metadata: {
              invoiceId: invoice.id,
              bookingId: id,
            }
          });
          checkoutUrl = session.url;
        }

        // TODO: Send Email to client with checkoutUrl
        // e.g. emailService.sendBookingAcceptedEmail(updatedBooking.clientEmail, checkoutUrl);

        return { ...updatedBooking, checkoutUrl };
      });
    }

    // Otherwise just update status
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.totalAmount && { totalAmount: data.totalAmount }),
      },
    });
  }
}
