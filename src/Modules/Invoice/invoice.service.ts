import { PrismaClient, InvoicePaymentStatus, InvoiceType } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import Stripe from 'stripe';
import { PayInvoiceDTO } from './InvoiceDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';

export class InvoiceServices {
  private stripe: any = null;

  constructor(private prisma: PrismaClient) {
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
    // DJ can see their subscription invoices and booking invoices for their tenant
    const tenantId = await this.getTenantIdByUserId(userId).catch(() => null);

    const baseWhere = {
      OR: [
        { userId },
        ...(tenantId ? [{ tenantId }] : [])
      ]
    };

    const invoiceQuery = new QueryBuilder(this.prisma.invoice, query)
      .search(['status', 'type'])
      .filter()
      .sort()
      .pagination()
      .fields();

    // Merge our base conditions with whatever QueryBuilder found
    invoiceQuery.prismaArgs.where = {
      ...invoiceQuery.prismaArgs.where,
      ...baseWhere,
    };

    if (!invoiceQuery.prismaArgs.select) {
      invoiceQuery.prismaArgs.include = {
        booking: true,
      };
    }

    const invoices = await invoiceQuery.model.findMany(invoiceQuery.prismaArgs);
    const meta = await invoiceQuery.countTotal();

    return { invoices, meta };
  }

  async getAllInvoices(query: Record<string, unknown> = {}) {
    const invoiceQuery = new QueryBuilder(this.prisma.invoice, query)
      .search(['status', 'type'])
      .filter()
      .sort()
      .pagination()
      .fields();

    if (!invoiceQuery.prismaArgs.select) {
      invoiceQuery.prismaArgs.include = {
        booking: true,
        tenant: {
          select: {
            subdomain: true,
            stageName: true,
          }
        },
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      };
    }

    const invoices = await invoiceQuery.model.findMany(invoiceQuery.prismaArgs);
    const meta = await invoiceQuery.countTotal();

    return { invoices, meta };
  }

  async markAsPaid(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });

    if (!invoice) {
      throw new NotFoundError();
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoicePaymentStatus.paid },
    });
  }

  async payInvoice(id: string, data: PayInvoiceDTO) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { booking: true }
    });

    if (!invoice) {
      throw new NotFoundError();
    }

    if (invoice.status === InvoicePaymentStatus.paid) {
      throw new BadRequestError();
    }

    if (!this.stripe || !invoice.amount) {
      // Mock logic
      return { url: 'http://localhost:3000/payment-mock' };
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: invoice.type === InvoiceType.BOOKING ? `Booking for ${invoice.booking?.clientName}` : 'Subscription',
          },
          unit_amount: Math.round(Number(invoice.amount) * 100), // Stripe expects cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: data.successUrl || `${process.env.FRONTEND_URL}/payment/success?invoice_id=${id}`,
      cancel_url: data.cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
      metadata: {
        invoiceId: invoice.id,
        ...(invoice.bookingId && { bookingId: invoice.bookingId }),
      }
    });

    return { url: session.url };
  }
}
