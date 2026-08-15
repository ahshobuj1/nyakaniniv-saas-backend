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
          invoice: {
            include: { plan: true, booking: { include: { client: true } } }
          }
        }
      })
    ]);

    const invoices = txs.map(tx => ({
      ...tx,
      type: tx.invoice?.type || 'UNKNOWN',
      plan: tx.invoice?.plan,
      booking: tx.invoice?.booking,
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
      id: tx.id,
      amount: Number(tx.amount),
      status: tx.status,
      method: tx.channel,
      type: tx.invoice?.type || 'UNKNOWN',
      createdAt: tx.createdAt,
      user: tx.user ? { email: tx.user.email, firstName: tx.user.firstName, lastName: tx.user.lastName } : 
            tx.invoice?.booking?.client ? { email: tx.invoice.booking.client.email, firstName: tx.invoice.booking.client.name, lastName: '' } : null,
      plan: tx.invoice?.plan ? { name: tx.invoice.plan.name } : null,
      tenant: tx.tenant ? { subdomain: tx.tenant.subdomain, stageName: tx.tenant.stageName } : null
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
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // --- Header Section ---
        doc.fontSize(28).font('Helvetica-Bold').fillColor('#F63131').text('UpBeat Africa', 50, 40, { align: 'left' });
        
        doc.fillColor('#111827');
        doc.fontSize(24).font('Helvetica-Bold').text(invoice.status === 'PAID' ? 'RECEIPT' : 'INVOICE', 50, 40, { align: 'right' });
        doc.fontSize(10).font('Helvetica').text(`Invoice No: ${invoice.id.split('-')[0].toUpperCase()}`, 50, 80, { align: 'left' });
        doc.text(`Date Issued: ${invoice.createdAt?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'left' });
        doc.text(`Transaction ID: ${invoice.id}`, { align: 'left' });
        
        if (invoice.status === 'PAID' && mainTx) {
          doc.text(`Date Paid: ${mainTx.createdAt?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, { align: 'left' });
          doc.text(`Payment Method: ${mainTx.gateway}`, { align: 'left' });
          if (mainTx.cardBrand && mainTx.cardLast4) {
            doc.text(`Payment Source: ${mainTx.cardBrand.toUpperCase()} **** **** ${mainTx.cardLast4}`, { align: 'left' });
          }
          if (mainTx.bankName) {
            doc.text(`Bank Name: ${mainTx.bankName}`, { align: 'left' });
          }
          if (mainTx.accountName) {
            doc.text(`Account Name: ${mainTx.accountName}`, { align: 'left' });
          }
        }
        
        doc.fillColor('#000000');
        doc.y = Math.max(doc.y, 120);
        doc.moveDown(2);

        // --- Parties Section ---
        let billedFrom = 'UpBeat Africa Platform';
        let billedFromDesc = 'Billing Department';
        let clientName = 'Valued Client';
        let clientEmail = 'N/A';
        let clientPhone = '';

        if (invoice.type === 'BOOKING' && invoice.booking) {
          billedFrom = invoice.tenant?.stageName || invoice.tenant?.user?.firstName || "DJ";
          billedFromDesc = invoice.tenant?.user?.email || '';
          clientName = invoice.booking.client?.name || clientName;
          clientEmail = invoice.booking.client?.email || clientEmail;
          clientPhone = invoice.booking.client?.phone || '';
        } else if (invoice.type === 'SUBSCRIPTION') {
          clientName = `${invoice.user?.firstName || ''} ${invoice.user?.lastName || ''}`.trim() || clientName;
          clientEmail = invoice.user?.email || clientEmail;
        }
        
        const partiesY = doc.y;
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Billed From:', 50, partiesY);
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(billedFrom, 50, doc.y + 5);
        doc.text(billedFromDesc, 50, doc.y + 2);
        
        const leftColY = doc.y;
        doc.y = partiesY;
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Billed To:', 300, partiesY);
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(clientName, 300, doc.y + 5);
        doc.text(clientEmail, 300, doc.y + 2);
        if (clientPhone) doc.text(clientPhone, 300, doc.y + 2);
        
        doc.y = Math.max(leftColY, doc.y);
        doc.moveDown(3);

        // --- Event Details (If Booking) ---
        if (invoice.type === 'BOOKING' && invoice.booking) {
          doc.fontSize(12).font('Helvetica-Bold').text('Event Details');
          doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).strokeColor('#e5e7eb').stroke();
          doc.moveDown();
          doc.fontSize(10).font('Helvetica');
          doc.text(`Event Type: ${invoice.booking.eventType || 'N/A'}`, 50, doc.y + 5);
          doc.text(`Event Date: ${invoice.booking.eventDate ? invoice.booking.eventDate.toLocaleDateString('en-US') : 'N/A'}`, 300, doc.y - 12);
          doc.text(`Location: ${invoice.booking.address || 'N/A'}`, 50, doc.y + 10);
          doc.moveDown(3);
        }

        // --- Table Header ---
        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Item Description', 50, tableTop);
        doc.fillColor('#6b7280').font('Helvetica').fontSize(8);
        doc.text('Thank you for choosing UpBeat Africa.', 50, 700, { align: 'center', width: 500 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
