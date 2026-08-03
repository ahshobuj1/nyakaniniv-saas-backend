import { PrismaClient, BookingPaymentStatus, SubscriptionInvoiceStatus, BookingStatus, NotificationType, BookingPaymentMethod } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import Stripe from 'stripe';
import { PayInvoiceDTO } from './InvoiceDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import PDFDocument from 'pdfkit';

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
      where: { userId },
      include: { plan: true }
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
      include: { 
        user: { select: { email: true, firstName: true, lastName: true } },
        plan: true
      }
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

  async getInvoiceById(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId).catch(() => null);

    const payment = await this.prisma.bookingPayment.findFirst({
      where: tenantId ? { id, OR: [{ tenantId }, { booking: { clientId: userId } }] } : { id, booking: { clientId: userId } },
      select: {
        id: true,
        amount: true,
        status: true,
        method: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        bookingId: true,
        tenant: {
          select: {
            stageName: true,
            logoUrl: true,
            country: true,
            city: true,
            user: { select: { firstName: true, lastName: true, email: true } }
          }
        },
        booking: {
          select: {
            id: true,
            eventDate: true,
            eventType: true,
            eventDetails: true,
            address: true,
            status: true,
            totalAmount: true,
            client: { select: { name: true, email: true, phone: true } }
          }
        }
      }
    });

    if (payment) {
      return { ...payment, type: 'BOOKING' };
    }

    const subscription = await this.prisma.subscriptionInvoice.findFirst({
      where: { id, userId },
      select: {
        id: true,
        amount: true,
        status: true,
        stripeInvoiceId: true,
        createdAt: true,
        updatedAt: true,
        planId: true,
        userId: true,
        plan: {
          select: {
            name: true,
            priceMonthly: true,
            priceAnnually: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (subscription) {
      return { ...subscription, type: 'SUBSCRIPTION' };
    }

    throw new NotFoundError('Invoice not found');
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
        "Payment Receipt - UpBeat Africa",
        EmailTemplates.getPaymentReceiptTemplate(
          Number(payment.amount), 
          payment.booking.eventType || "Event",
          djName,
          payment.booking.eventDate?.toISOString() || new Date().toISOString(),
          payment.method === BookingPaymentMethod.CASH ? "Cash" : (payment.method || "Online Payment"),
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
      success_url: data.successUrl || `${process.env.FRONTEND_URL || 'https://upbeat.africa'}/payment-success?invoice_id=${id}`,
      cancel_url: data.cancelUrl || `${process.env.FRONTEND_URL || 'https://upbeat.africa'}/payment-cancel`,
      metadata: {
        invoiceId: payment.id,
        ...(payment.bookingId && { bookingId: payment.bookingId }),
      }
    });

    return { url: session.url };
  }

  async generateInvoicePdf(id: string): Promise<Buffer> {
    const payment = await this.prisma.bookingPayment.findUnique({
      where: { id },
      include: {
        booking: { include: { client: true } },
        tenant: { include: { user: true } }
      }
    });

    if (!payment) {
      const subscription = await this.prisma.subscriptionInvoice.findUnique({
        where: { id },
        include: { user: true, plan: true }
      });
      if (!subscription) {
        throw new NotFoundError();
      }
      return this.generateSubscriptionPdf(subscription);
    }

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // --- Header Section ---
        // UpBeat Africa Brand
        doc.fontSize(28).font('Helvetica-Bold').fillColor('#F63131').text('UpBeat Africa', 50, 40, { align: 'left' });
        
        // Receipt info
        doc.fillColor('#111827');
        doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', 50, 40, { align: 'right' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(`Receipt No: ${payment.id.split('-')[0].toUpperCase()}`, { align: 'right' });
        doc.text(`Date Issued: ${payment.createdAt?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'right' });
        doc.text(`Transaction ID: ${payment.id}`, { align: 'right' });
        if (payment.status === BookingPaymentStatus.paid) {
          doc.text(`Date Paid: ${payment.updatedAt?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, { align: 'right' });
          if (payment.method) {
            let methodStr = `Payment Method: ${payment.method}`;
            if (payment.cardBrand && payment.cardLast4) {
              methodStr += ` (${payment.cardBrand.toUpperCase()} ending in ${payment.cardLast4})`;
            }
            doc.text(methodStr, { align: 'right' });
          }
        }
        
        doc.fillColor('#000000');
        doc.y = 120; // Reset Y below header

        // --- Parties Section ---
        const djName = payment.tenant?.stageName || payment.tenant?.user?.firstName || 'DJ / Service Provider';
        const djEmail = payment.tenant?.user?.email || 'N/A';
        const djLocation = [payment.tenant?.city, payment.tenant?.country].filter(Boolean).join(', ') || 'Online';
        
        const clientName = payment.booking?.client?.name || 'Valued Client';
        const clientEmail = payment.booking?.client?.email || 'N/A';
        const clientPhone = payment.booking?.client?.phone || 'N/A';
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Billed From:', 50, doc.y);
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(djName, 50, doc.y + 5);
        doc.text(djEmail, 50, doc.y + 2);
        doc.text(djLocation, 50, doc.y + 2);
        doc.text('UpBeat Africa Platform', 50, doc.y + 2);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Billed To:', 300, doc.y - 45);
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(clientName, 300, doc.y + 5);
        doc.text(clientEmail, 300, doc.y + 2);
        doc.text(clientPhone, 300, doc.y + 2);
        doc.moveDown(3);

        // --- Event Details ---
        if (payment.booking) {
          doc.fontSize(12).font('Helvetica-Bold').text('Event Details');
          doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).strokeColor('#e5e7eb').stroke();
          doc.moveDown();
          doc.fontSize(10).font('Helvetica');
          doc.text(`Event Type: ${payment.booking.eventType || 'N/A'}`, 50, doc.y + 5);
          doc.text(`Event Date: ${payment.booking.eventDate ? payment.booking.eventDate.toLocaleDateString('en-US') : 'N/A'}`, 300, doc.y - 12);
          doc.text(`Location: ${payment.booking.address || 'N/A'}`, 50, doc.y + 10);
          doc.moveDown(3);
        }

        // --- Table Header ---
        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Item Description', 50, tableTop);
        doc.text('Payment Method', 300, tableTop);
        doc.text('Amount', 450, tableTop, { width: 100, align: 'right' });
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#000000').stroke();
        
        // --- Table Content ---
        doc.font('Helvetica');
        const itemY = tableTop + 25;
        doc.text(`Booking Payment - ${payment.booking?.eventType || 'Event'}`, 50, itemY, { width: 200 });
        doc.text(payment.method || 'Not Specified', 300, itemY);
        doc.text(`KES ${Number(payment.amount).toFixed(2)}`, 450, itemY, { width: 100, align: 'right' });

        // --- Totals ---
        doc.moveTo(50, itemY + 30).lineTo(550, itemY + 30).strokeColor('#e5e7eb').stroke();
        doc.font('Helvetica-Bold');
        doc.text('Total Paid', 300, itemY + 45);
        doc.fontSize(12).text(`KES ${Number(payment.amount).toFixed(2)}`, 450, itemY + 45, { width: 100, align: 'right' });

        // --- Status Banner ---
        doc.moveDown(3);
        const statusY = doc.y + 20;
        const isPaid = payment.status === BookingPaymentStatus.paid;
        
        doc.rect(50, statusY, 500, 30).fill(isPaid ? '#ecfdf5' : '#fef2f2');
        doc.fillColor(isPaid ? '#059669' : '#dc2626').font('Helvetica-Bold').fontSize(12);
        doc.text(`PAYMENT STATUS: ${isPaid ? 'PAID IN FULL' : 'PAYMENT PENDING'}`, 50, statusY + 10, { width: 500, align: 'center' });

        // --- Footer ---
        doc.fillColor('#6b7280').font('Helvetica').fontSize(8);
        doc.text('Thank you for choosing UpBeat Africa.', 50, 700, { align: 'center', width: 500 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private generateSubscriptionPdf(subscription: any): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // --- Header Section ---
        doc.fontSize(28).font('Helvetica-Bold').fillColor('#F63131').text('UpBeat Africa', 50, 40, { align: 'left' });
        
        doc.fillColor('#111827');
        doc.fontSize(24).font('Helvetica-Bold').text('RECEIPT', 50, 40, { align: 'right' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(`Receipt No: ${subscription.id.split('-')[0].toUpperCase()}`, { align: 'right' });
        doc.text(`Date Issued: ${subscription.createdAt?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'right' });
        doc.text(`Transaction ID: ${subscription.id}`, { align: 'right' });
        if (subscription.status === 'paid') {
          doc.text(`Date Paid: ${subscription.updatedAt?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, { align: 'right' });
          if (subscription.cardBrand && subscription.cardLast4) {
            doc.text(`Payment Method: ${subscription.cardBrand.toUpperCase()} ending in ${subscription.cardLast4}`, { align: 'right' });
          }
        }
        
        doc.fillColor('#000000');
        doc.y = 120; // Reset Y below header

        // --- Parties Section ---
        const clientName = `${subscription.user?.firstName || ''} ${subscription.user?.lastName || ''}`.trim() || 'Valued Client';
        const clientEmail = subscription.user?.email || 'N/A';
        
        doc.fontSize(12).font('Helvetica-Bold').text('Billed From:', 50, doc.y);
        doc.fontSize(10).font('Helvetica').text('UpBeat Africa Platform', 50, doc.y + 5);
        doc.text('Billing Department', 50, doc.y + 2);
        
        doc.fontSize(12).font('Helvetica-Bold').text('Billed To:', 300, doc.y - 25);
        doc.fontSize(10).font('Helvetica').text(clientName, 300, doc.y + 5);
        doc.text(clientEmail, 300, doc.y + 2);
        doc.moveDown(3);

        // --- Table Header ---
        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Item Description', 50, tableTop);
        doc.text('Amount', 450, tableTop, { width: 100, align: 'right' });
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#000000').stroke();
        
        // --- Table Content ---
        doc.font('Helvetica');
        const itemY = tableTop + 25;
        doc.text(`Subscription Plan: ${subscription.plan?.name || 'Standard'}`, 50, itemY, { width: 350 });
        doc.text(`KES ${Number(subscription.amount).toFixed(2)}`, 450, itemY, { width: 100, align: 'right' });

        // --- Totals ---
        doc.moveTo(50, itemY + 30).lineTo(550, itemY + 30).strokeColor('#e5e7eb').stroke();
        doc.font('Helvetica-Bold');
        doc.text('Total Paid', 300, itemY + 45);
        doc.fontSize(12).text(`KES ${Number(subscription.amount).toFixed(2)}`, 450, itemY + 45, { width: 100, align: 'right' });

        // --- Status Banner ---
        doc.moveDown(3);
        const statusY = doc.y + 20;
        const isPaid = subscription.status === SubscriptionInvoiceStatus.paid;
        
        doc.rect(50, statusY, 500, 30).fill(isPaid ? '#ecfdf5' : '#fef2f2');
        doc.fillColor(isPaid ? '#059669' : '#dc2626').font('Helvetica-Bold').fontSize(12);
        doc.text(`PAYMENT STATUS: ${isPaid ? 'PAID IN FULL' : 'PAYMENT PENDING'}`, 50, statusY + 10, { width: 500, align: 'center' });

        // --- Footer ---
        doc.fillColor('#6b7280').font('Helvetica').fontSize(8);
        doc.text('Thank you for choosing UpBeat Africa.', 50, 700, { align: 'center', width: 500 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
