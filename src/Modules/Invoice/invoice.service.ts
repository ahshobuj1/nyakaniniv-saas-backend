import { PrismaClient, BookingPaymentStatus, SubscriptionInvoiceStatus, BookingStatus, NotificationType, BookingPaymentMethod } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import Stripe from 'stripe';
import { PayInvoiceDTO } from './InvoiceDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';

export class InvoiceServices {
  private stripe: any = null;

  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2024-04-10" as any,
      });
    }
  }

  private async getTenantIdByUserId(userId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) {
      throw new AuthorizationError();
    }
    return tenant.id;
  }


  async getMyInvoices(userId: string, query: Record<string, unknown> = {}) {
    const tenantId = await this.getTenantIdByUserId(userId).catch(() => null);

    const subscriptionInvoices = await this.prisma.subscriptionInvoice.findMany({
      where: { userId }
    });

    const bookingPayments = tenantId ? await this.prisma.bookingPayment.findMany({
      where: { tenantId },
      include: { booking: { include: { client: true } } }
    }) : [];

    const invoices = [
      ...subscriptionInvoices.map(s => ({ ...s, type: 'SUBSCRIPTION' })),
      ...bookingPayments.map(b => ({ ...b, type: 'BOOKING' }))
    ].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    return { invoices, meta: { total: invoices.length, page: 1, limit: invoices.length, totalPages: 1, hasNext: false, hasPrevious: false } };
  }

  async getAllInvoices(query: Record<string, unknown> = {}) {
    const subscriptionInvoices = await this.prisma.subscriptionInvoice.findMany({
      include: { user: { select: { email: true, firstName: true, lastName: true } } }
    });

    const bookingPayments = await this.prisma.bookingPayment.findMany({
      include: { 
        booking: { include: { client: true } }, 
        tenant: { select: { subdomain: true, stageName: true } } 
      }
    });

    const invoices = [
      ...subscriptionInvoices.map(s => ({ ...s, type: 'SUBSCRIPTION' })),
      ...bookingPayments.map(b => ({ ...b, type: 'BOOKING' }))
    ].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    return { invoices, meta: { total: invoices.length, page: 1, limit: invoices.length, totalPages: 1, hasNext: false, hasPrevious: false } };
  }

  async markAsPaid(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const payment = await this.prisma.bookingPayment.findFirst({
      where: { id, tenantId },
      include: { booking: { include: { client: true } }, tenant: { include: { user: true } } }
    });

    if (!payment) {
      throw new NotFoundError();
    }

    if (payment.status === BookingPaymentStatus.paid) {
      return payment;
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.bookingPayment.update({
        where: { id },
        data: { status: BookingPaymentStatus.paid },
      });

      if (payment.bookingId) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: BookingStatus.completed }
        });
      }

      return updatedPayment;
    });

    // Send Email Receipt to Client
    if (payment.bookingId && payment.booking?.client?.email && payment.amount) {
      const djName = payment.tenant?.stageName || payment.tenant?.user?.firstName || "DJ";
      this.emailProvider.sendEmail(
        payment.booking.client.email,
        "Payment Receipt - UpbeatAfrica",
        EmailTemplates.getPaymentReceiptTemplate(
          Number(payment.amount), 
          payment.booking.eventType || "Event",
          djName,
          payment.booking.eventDate?.toISOString() || new Date().toISOString(),
          payment.method === BookingPaymentMethod.CASH ? "Cash" : "Stripe / Credit Card",
          payment.bookingId
        )
      );
    }

    return txResult;
  }

  async payInvoice(id: string, data: PayInvoiceDTO) {
    const payment = await this.prisma.bookingPayment.findUnique({
      where: { id },
      include: { booking: { include: { client: true } } }
    });

    if (!payment) {
      throw new NotFoundError();
    }

    if (payment.status === BookingPaymentStatus.paid) {
      throw new BadRequestError();
    }

    if (!this.stripe || !payment.amount) {
      return { url: 'http://localhost:3000/payment-mock' };
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Booking for ${payment.booking?.client?.name || 'Client'}`,
          },
          unit_amount: Math.round(Number(payment.amount) * 100), // Stripe expects cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: data.successUrl || `${process.env.FRONTEND_URL}/payment/success?invoice_id=${id}`,
      cancel_url: data.cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
      metadata: {
        invoiceId: payment.id,
        ...(payment.bookingId && { bookingId: payment.bookingId }),
      }
    });

    return { url: session.url };
  }
}
