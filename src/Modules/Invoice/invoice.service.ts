import { PrismaClient, BookingStatus } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { PayInvoiceDTO } from './InvoiceDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';
import PDFDocument from 'pdfkit';

export class InvoiceServices {
  constructor(private prisma: PrismaClient) {}

  private async getTenantIdByUserId(userId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) {
      throw new AuthorizationError();
    }
    return tenant.id;
  }

  async getMyInvoices(userId: string, query: Record<string, unknown> = {}) {
    const tenantId = await this.getTenantIdByUserId(userId).catch(() => null);

    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      OR: [
        { userId },
        ...(tenantId ? [{ tenantId }] : [])
      ]
    };

    const [total, txs] = await Promise.all([
      this.prisma.transaction.count({ where: whereClause }),
      this.prisma.transaction.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          tenant: { select: { subdomain: true, stageName: true } },
          invoice: {
            include: {
              plan: { select: { name: true } },
              booking: { include: { client: { select: { name: true, email: true } } } }
            }
          }
        }
      })
    ]);

    const invoices = txs.map(tx => ({
      id: tx.invoice?.id || tx.id,
      transactionId: tx.id,
      amount: Number(tx.amount),
      status: tx.invoice?.status || (tx.status === 'SUCCESS' ? 'PAID' : tx.status),
      method: tx.channel,
      gateway: tx.gateway,
      type: tx.invoice?.type || 'UNKNOWN',
      createdAt: tx.createdAt,
      user: tx.user ? { email: tx.user.email, firstName: tx.user.firstName, lastName: tx.user.lastName } : 
            tx.invoice?.booking?.client ? { email: tx.invoice.booking.client.email, firstName: tx.invoice.booking.client.name, lastName: '' } : null,
      plan: tx.invoice?.plan ? { name: tx.invoice.plan.name } : null,
      tenant: tx.tenant ? { subdomain: tx.tenant.subdomain, stageName: tx.tenant.stageName } : null,
      booking: tx.invoice?.booking || null
    }));

    const totalPages = Math.ceil(total / limit);

    return { 
      invoices, 
      meta: { total, page, limit, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 } 
    };
  }

  async getAllInvoices(query: Record<string, unknown> = {}) {
    const txQuery = new QueryBuilder(this.prisma.transaction, query)
      .search(['id'])
      .filter()
      .sort()
      .pagination();
    
    // 1. Complex Search
    const searchTerm = (query?.searchTerm as string || query?.search as string)?.toLowerCase();
    if (searchTerm) {
      txQuery.prismaArgs.where.OR = [
        { id: { contains: searchTerm, mode: 'insensitive' } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
        { invoice: { booking: { client: { email: { contains: searchTerm, mode: 'insensitive' } } } } }
      ];
    }

    // 2. Filter by status
    const status = query?.status as string || query?.paymentStatus as string;
    if (status && status !== 'all') {
      txQuery.prismaArgs.where.status = status.toUpperCase();
    }

    // 3. Includes
    txQuery.prismaArgs.include = {
      user: { select: { email: true, firstName: true, lastName: true } },
      tenant: { select: { subdomain: true, stageName: true } },
      invoice: {
        include: {
          plan: { select: { name: true } },
          booking: { include: { client: { select: { name: true, email: true } } } }
        }
      }
    };

    // 4. Cleanup query builder filter artifacts
    delete txQuery.prismaArgs.where.search;
    delete txQuery.prismaArgs.where.sortBy;
    delete txQuery.prismaArgs.where.sortOrder;
    delete txQuery.prismaArgs.where.paymentStatus;

    const transactionsData = await txQuery.model.findMany(txQuery.prismaArgs);
    const meta = await txQuery.countTotal();

    const invoices = transactionsData.map((tx: any) => ({
      id: tx.invoice?.id || tx.id,
      transactionId: tx.id,
      amount: Number(tx.amount),
      status: tx.invoice?.status || (tx.status === 'SUCCESS' ? 'PAID' : tx.status),
      method: tx.channel,
      gateway: tx.gateway,
      type: tx.invoice?.type || 'UNKNOWN',
      createdAt: tx.createdAt,
      user: tx.user ? { email: tx.user.email, firstName: tx.user.firstName, lastName: tx.user.lastName } : 
            tx.invoice?.booking?.client ? { email: tx.invoice.booking.client.email, firstName: tx.invoice.booking.client.name, lastName: '' } : null,
      plan: tx.invoice?.plan ? { name: tx.invoice.plan.name } : null,
      tenant: tx.tenant ? { subdomain: tx.tenant.subdomain, stageName: tx.tenant.stageName } : null,
      booking: tx.invoice?.booking || null
    }));

    return { invoices, meta };
  }

  async getInvoiceById(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId).catch(() => null);

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        OR: [
          { userId },
          ...(tenantId ? [{ tenantId }] : []),
          { booking: { clientId: userId } }
        ]
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        plan: { select: { name: true, priceMonthly: true, priceAnnually: true } },
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
        },
        transactions: true
      }
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Attach transaction details to root for backward compatibility with frontend
    const mainTx = invoice.transactions[0];
    return {
      ...invoice,
      method: mainTx?.channel || 'UNKNOWN',
      gateway: mainTx?.gateway || null,
      cardBrand: mainTx?.cardBrand || null,
      cardLast4: mainTx?.cardLast4 || null,
      bankName: mainTx?.bankName || null,
      accountName: mainTx?.accountName || null,
      paidAt: mainTx?.createdAt || null
    };
  }

  async markAsPaid(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { booking: { include: { client: true } }, tenant: { include: { user: true } } }
    });

    if (!invoice) {
      throw new NotFoundError();
    }

    if (invoice.status === 'PAID') {
      return invoice;
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: { status: 'PAID' }
      });

      await tx.transaction.create({
        data: {
          invoiceId: id,
          tenantId,
          amount: invoice.amount,
          gateway: 'MANUAL',
          channel: 'CASH',
          status: 'SUCCESS'
        }
      });

      if (invoice.bookingId) {
        await tx.booking.update({
          where: { id: invoice.bookingId },
          data: { status: BookingStatus.completed }
        });
      }

      return updatedInvoice;
    });

    return txResult;
  }

  async payInvoice(id: string, data: PayInvoiceDTO) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { booking: { include: { client: true, tenant: true } }, tenant: true }
    });

    if (!invoice) {
      throw new NotFoundError();
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestError('Invoice is already paid');
    }

    if (!invoice.amount) {
      return { url: 'http://localhost:3000/payment-mock' };
    }

    const { PaymentProviderFactory } = await import('@/providers/PaymentProvider/PaymentProviderFactory');
    // Using Paystack by default for now if no specific country is found
    const country = invoice.tenant?.country || invoice.booking?.tenant?.country || 'NG';
    const paymentProvider = PaymentProviderFactory.getProvider(country);
    
    try {
      // Mocking payment link generation if booking doesn't exist (e.g. for subscription)
      if (invoice.type === 'SUBSCRIPTION') {
        return { url: `https://paystack.com/pay/subscription_${invoice.id}` };
      }

      if (invoice.booking) {
        const { checkoutUrl } = await paymentProvider.getPaymentLink(invoice.booking, invoice.id);
        return { url: checkoutUrl };
      }
      
      throw new BadRequestError("Cannot generate link for this invoice type");
    } catch (error: any) {
      console.error("Payment Link Generation Error:", error.message);
      throw new BadRequestError(error.message || "Failed to generate payment link");
    }
  }

  async generateInvoicePdf(id: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        booking: { include: { client: true } },
        tenant: { include: { user: true } },
        user: true,
        plan: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!invoice) {
      throw new NotFoundError();
    }

    const mainTx = invoice.transactions[0];

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // A4 Dimensions: 595.28 x 841.89
        const pageWidth = 595.28;
        const pageHeight = 841.89;

        // Background (#FFFFFF)
        doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');

        // Compact Container (Centered, Top ~65%)
        const boxW = 500;
        const boxX = (pageWidth - boxW) / 2; // ~47.64
        const boxY = 60;
        
        // Colors
        const primary = '#F63131';
        const textMain = '#111827';
        const textMuted = '#6B7280';
        const border = '#E5E7EB';

        let currentY = boxY;

        // Header (UpBeat Africa & PAID Badge)
        doc.font('Helvetica-Bold').fontSize(24).fillColor(primary).text('UpBeat Africa', boxX, currentY);
        if (invoice.status === 'PAID') {
          doc.rect(boxX + boxW - 70, currentY, 70, 24).fill('#DEF7EC');
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#03543F').text('PAID', boxX + boxW - 70, currentY + 6, { width: 70, align: 'center' });
        }
        
        currentY += 30;
        doc.font('Helvetica-Bold').fontSize(14).fillColor(textMain).text('Payment Receipt', boxX, currentY);
        doc.font('Helvetica').fontSize(12).fillColor(textMuted).text(invoice.createdAt?.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || '', boxX + boxW - 140, currentY, { width: 140, align: 'right' });
        
        currentY += 30;
        // Divider
        doc.moveTo(boxX, currentY).lineTo(boxX + boxW, currentY).strokeColor(border).lineWidth(1).stroke();
        currentY += 20;

        // RECEIPT INFORMATION
        doc.font('Helvetica-Bold').fontSize(11).fillColor(textMuted).text('RECEIPT INFORMATION', boxX, currentY);
        currentY += 20;
        
        const drawRow = (label: string, value: string, y: number) => {
          doc.font('Helvetica').fontSize(12).fillColor(textMuted).text(label, boxX, y);
          doc.font('Helvetica-Bold').fontSize(12).fillColor(textMain).text(value, boxX + 160, y);
        };
        
        drawRow('Receipt No.', `INV-${invoice.id.split('-')[0].toUpperCase()}`, currentY); currentY += 20;
        drawRow('Transaction ID', invoice.id, currentY); currentY += 20;
        drawRow('Payment Date', mainTx?.createdAt?.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) || '', currentY); currentY += 20;
        drawRow('Payment Method', `${mainTx?.channel?.replace('_', ' ') || mainTx?.gateway || 'CARD'} ${mainTx?.cardLast4 ? '•••• ' + mainTx.cardLast4 : ''}`.trim(), currentY); currentY += 20;
        if (mainTx?.bankName) { drawRow('Bank Name', mainTx.bankName, currentY); currentY += 20; }
        
        // Divider
        doc.moveTo(boxX, currentY).lineTo(boxX + boxW, currentY).strokeColor(border).lineWidth(1).stroke();
        currentY += 20;

        // BILLED FROM / TO
        doc.font('Helvetica-Bold').fontSize(11).fillColor(textMuted).text('BILLED FROM', boxX, currentY);
        doc.text('BILLED TO', boxX + boxW / 2, currentY);
        currentY += 20;

        // Parties Info
        let billedFromName = 'UpBeat Africa';
        let billedFromDesc = 'UpBeat Africa';
        let billedFromEmail = 'hello@upbeatafrica.com';
        
        let clientName = 'Valued Client';
        let clientEmail = 'N/A';
        let clientPhone = '';

        if (invoice.type === 'BOOKING' && invoice.booking) {
          billedFromName = invoice.tenant?.stageName || invoice.tenant?.user?.firstName || billedFromName;
          billedFromDesc = invoice.tenant?.user?.email || billedFromDesc;
          billedFromEmail = invoice.tenant?.subdomain ? `https://${invoice.tenant.subdomain}.deejay.africa` : '';
          clientName = invoice.booking.client?.name || clientName;
          clientEmail = invoice.booking.client?.email || clientEmail;
          clientPhone = invoice.booking.client?.phone || '';
        } else if (invoice.type === 'SUBSCRIPTION') {
          clientName = `${invoice.user?.firstName || ''} ${invoice.user?.lastName || ''}`.trim() || clientName;
          clientEmail = invoice.user?.email || clientEmail;
        }

        doc.font('Helvetica-Bold').fontSize(13).fillColor(textMain).text(billedFromName, boxX, currentY);
        doc.text(clientName, boxX + boxW / 2, currentY);
        currentY += 16;
        
        doc.font('Helvetica').fontSize(12).fillColor(textMuted).text(billedFromDesc, boxX, currentY);
        doc.text(clientEmail, boxX + boxW / 2, currentY);
        currentY += 16;

        if (billedFromEmail || clientPhone) {
          if (billedFromEmail) doc.text(billedFromEmail, boxX, currentY);
          if (clientPhone) doc.text(clientPhone, boxX + boxW / 2, currentY);
          currentY += 16;
        }

        currentY += 10;
        // Divider
        doc.moveTo(boxX, currentY).lineTo(boxX + boxW, currentY).strokeColor(border).lineWidth(1).stroke();
        currentY += 20;

        // EVENT DETAILS (If Booking)
        if (invoice.type === 'BOOKING' && invoice.booking) {
          doc.font('Helvetica-Bold').fontSize(11).fillColor(textMuted).text('EVENT DETAILS', boxX, currentY);
          currentY += 20;
          
          drawRow('Event Type', (invoice.booking.eventType || 'Event').toUpperCase(), currentY); currentY += 20;
          drawRow('Event Date', invoice.booking.eventDate?.toLocaleDateString('en-US', { dateStyle: 'medium' }) || 'N/A', currentY); currentY += 20;
          drawRow('Location', invoice.booking.address || 'N/A', currentY); currentY += 20;

          // Divider
          doc.moveTo(boxX, currentY).lineTo(boxX + boxW, currentY).strokeColor(border).lineWidth(1).stroke();
          currentY += 20;
        }

        // PAYMENT SUMMARY
        doc.font('Helvetica-Bold').fontSize(11).fillColor(textMuted).text('PAYMENT SUMMARY', boxX, currentY);
        currentY += 20;
        
        const description = invoice.type === 'SUBSCRIPTION' ? 'Platform Subscription' : 'DJ Booking Payment';
        doc.font('Helvetica').fontSize(14).fillColor(textMain).text(description, boxX, currentY);
        
        const displayCurrency = mainTx?.currency || 'KES';
        const displayAmount = Number(mainTx?.amount || invoice.amount).toFixed(2);
        
        doc.font('Helvetica-Bold').fontSize(14).fillColor(textMain).text(`${displayCurrency} ${displayAmount}`, boxX + boxW - 140, currentY, { width: 140, align: 'right' });
        currentY += 30;
        
        // Divider
        doc.moveTo(boxX, currentY).lineTo(boxX + boxW, currentY).strokeColor(border).lineWidth(1).stroke();
        currentY += 20;

        // TOTAL PAID
        doc.font('Helvetica-Bold').fontSize(14).fillColor(textMain).text('TOTAL PAID', boxX, currentY + 6);
        doc.font('Helvetica-Bold').fontSize(24).fillColor(primary).text(`${displayCurrency} ${displayAmount}`, boxX + boxW - 200, currentY, { width: 200, align: 'right' });
        
        currentY += 60;
        
        // Footer Message inside the layout
        doc.font('Helvetica').fontSize(12).fillColor('#03543F').text('Payment Successful', boxX, currentY, { align: 'center', width: boxW });
        currentY += 30;
        doc.font('Helvetica').fontSize(11).fillColor(textMuted).text('Thank you for choosing UpBeat Africa.', boxX, currentY, { align: 'center', width: boxW });
        currentY += 16;
        doc.font('Helvetica-Bold').fontSize(11).fillColor(textMuted).text('upbeat.africa', boxX, currentY, { align: 'center', width: boxW });
        
        // Final bottom message
        currentY += 40;
        doc.font('Helvetica').fontSize(10).fillColor('#9CA3AF').text('This is an electronically generated payment receipt.', 0, currentY, { align: 'center', width: pageWidth });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
