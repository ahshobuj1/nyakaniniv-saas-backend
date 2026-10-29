import {
  PrismaClient,
  BookingStatus,
  TransactionStatus,
  PaymentStatus,
} from '@/prisma/generated/client';
import {config} from '@/core/config';
import {
  NotFoundError,
  BadRequestError,
  AuthorizationError,
} from '@/core/errors/AppError';
import {PayInvoiceDTO} from './InvoiceDTO';
import {QueryBuilder} from '@/utils/QueryBuilder';
import {isValidUuid} from '@/utils/uuid';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import {PaymentProviderResolver} from '@/Modules/PaymentProvider/PaymentProviderResolver';

export class InvoiceServices {
  constructor(private prisma: PrismaClient) {}

  private async getTenantIdByUserId(userId: string): Promise<string> {
    if (!isValidUuid(userId)) {
      throw new AuthorizationError();
    }
    const tenant = await this.prisma.tenant.findUnique({where: {userId}});
    if (!tenant) {
      throw new AuthorizationError();
    }
    return tenant.id;
  }

  private async findMatchingInvoiceIdsBySearch(
    cleanSearch: string,
  ): Promise<string[]> {
    if (!cleanSearch) return [];
    try {
      const rawMatches = await this.prisma.$queryRaw<{id: string}[]>`
        SELECT id FROM invoices WHERE id::text ILIKE ${`%${cleanSearch}%`}
        UNION
        SELECT invoice_id as id FROM transactions WHERE invoice_id IS NOT NULL AND id::text ILIKE ${`%${cleanSearch}%`}
        LIMIT 100
      `;
      return rawMatches.map((r) => r.id);
    } catch {
      return [];
    }
  }

  async getMyInvoices(userId: string, query: Record<string, unknown> = {}) {
    const tenantId = await this.getTenantIdByUserId(userId).catch(() => null);

    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      OR: [{userId}, ...(tenantId ? [{tenantId}] : [])],
    };

    const status = query?.status as string;
    if (status && status.toLowerCase() !== 'all') {
      whereClause.status = status.toUpperCase();
    }

    const type = query?.type as string;
    if (type && type.toLowerCase() !== 'all') {
      whereClause.type = type.toUpperCase();
    }

    const rawSearch = (
      (query?.searchTerm as string) || (query?.search as string)
    )?.trim();
    const cleanSearch = rawSearch?.replace(/^(inv-|#)/i, '').trim();
    if (cleanSearch) {
      const matchedInvoiceIds =
        await this.findMatchingInvoiceIdsBySearch(cleanSearch);
      const searchConditions: any[] = [
        // 1. Transactions (Gateway Reference, Idempotency Key)
        {
          transactions: {
            some: {
              OR: [
                {
                  gatewayReference: {
                    contains: cleanSearch,
                    mode: 'insensitive',
                  },
                },
                {
                  idempotencyKey: {
                    contains: cleanSearch,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        },

        // 2. Client / User Email
        {
          booking: {
            client: {
              email: {
                contains: cleanSearch,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          user: {
            email: {
              contains: cleanSearch,
              mode: 'insensitive',
            },
          },
        },
      ];

      if (matchedInvoiceIds.length > 0) {
        searchConditions.unshift({id: {in: matchedInvoiceIds}});
      }

      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: searchConditions,
        },
      ];
    }

    const sortBy = (query?.sortBy as string) || 'createdAt';
    const sortOrder =
      (query?.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    let orderBy: any = {createdAt: sortOrder};
    if (sortBy === 'amount') {
      orderBy = {amount: sortOrder};
    } else if (sortBy === 'status') {
      orderBy = {status: sortOrder};
    } else if (sortBy === 'createdAt') {
      orderBy = {createdAt: sortOrder};
    }

    const [total, invoiceRecords] = await Promise.all([
      this.prisma.invoice.count({where: whereClause}),
      this.prisma.invoice.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {select: {email: true, firstName: true, lastName: true}},
          tenant: {select: {subdomain: true, stageName: true}},
          plan: {select: {name: true}},
          booking: {include: {client: {select: {name: true, email: true}}}},
          transactions: {
            orderBy: {createdAt: 'desc'},
            take: 1,
          },
        },
      }),
    ]);

    const invoices = invoiceRecords.map((inv) => {
      const latestTx = inv.transactions[0];
      const isBooking = inv.type === 'BOOKING';
      const item: any = {
        id: inv.id,
        amount: Number(inv.amount),
        currencyCode:
          inv.currencyCode ||
          latestTx?.currency ||
          inv.booking?.currencyCode ||
          'KES',
        status: inv.status,
        type: inv.type,
        createdAt: inv.createdAt,
        gateway: latestTx?.gateway || null,
        method: latestTx?.channel || (inv.status === 'PAID' ? 'ONLINE' : null),
        transactionId: latestTx?.id || null,
        gatewayReference: latestTx?.gatewayReference || null,
        transactions: inv.transactions,
      };

      if (isBooking && inv.booking) {
        item.booking = {
          id: inv.booking.id,
          eventType: inv.booking.eventType,
          client: inv.booking.client
            ? {
                name: inv.booking.client.name,
                email: inv.booking.client.email,
              }
            : null,
        };
      } else if (!isBooking) {
        if (inv.user) {
          item.user = {
            firstName: inv.user.firstName,
            lastName: inv.user.lastName,
            email: inv.user.email,
          };
        }
        if (inv.plan) {
          item.plan = {
            name: inv.plan.name,
          };
        }
      }

      return item;
    });

    const totalPages = Math.ceil(total / limit);

    return {
      invoices,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async getAllInvoices(query: Record<string, unknown> = {}) {
    const invQuery = new QueryBuilder(this.prisma.invoice, query)
      .filter()
      .sort()
      .pagination();

    // 1. Complex Search
    const rawSearch = (
      (query?.searchTerm as string) || (query?.search as string)
    )?.trim();
    const cleanSearch = rawSearch?.replace(/^(inv-|#)/i, '').trim();
    if (cleanSearch) {
      const matchedInvoiceIds =
        await this.findMatchingInvoiceIdsBySearch(cleanSearch);
      const searchConditions: any[] = [
        // 1. Transactions (Gateway Reference, Idempotency Key)
        {
          transactions: {
            some: {
              OR: [
                {
                  gatewayReference: {
                    contains: cleanSearch,
                    mode: 'insensitive',
                  },
                },
                {idempotencyKey: {contains: cleanSearch, mode: 'insensitive'}},
              ],
            },
          },
        },

        // 2. Client / User Email
        {
          booking: {
            client: {
              email: {
                contains: cleanSearch,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          user: {
            email: {
              contains: cleanSearch,
              mode: 'insensitive',
            },
          },
        },
      ];

      if (matchedInvoiceIds.length > 0) {
        searchConditions.unshift({id: {in: matchedInvoiceIds}});
      }

      invQuery.prismaArgs.where.OR = searchConditions;
    }

    // 2. Filter by status
    const status =
      (query?.status as string) || (query?.paymentStatus as string);
    if (status && status !== 'all') {
      invQuery.prismaArgs.where.status = status.toUpperCase();
    }

    // 3. Filter by invoice type (SUBSCRIPTION or BOOKING)
    const invoiceType = query?.type as string;
    if (invoiceType && invoiceType !== 'all') {
      invQuery.prismaArgs.where.type = invoiceType.toUpperCase();
    }

    // 4. Includes
    invQuery.prismaArgs.include = {
      user: {select: {email: true, firstName: true, lastName: true}},
      tenant: {select: {subdomain: true, stageName: true}},
      plan: {select: {name: true}},
      booking: {include: {client: {select: {name: true, email: true}}}},
      transactions: {
        orderBy: {createdAt: 'desc'},
        take: 1,
      },
    };

    // 5. Cleanup query builder filter artifacts
    delete invQuery.prismaArgs.where.search;
    delete invQuery.prismaArgs.where.searchTerm;
    delete invQuery.prismaArgs.where.sortBy;
    delete invQuery.prismaArgs.where.sortOrder;
    delete invQuery.prismaArgs.where.paymentStatus;

    const invoicesData = await invQuery.model.findMany(invQuery.prismaArgs);
    const meta = await invQuery.countTotal();

    const invoices = invoicesData.map((inv: any) => {
      const latestTx = inv.transactions?.[0];
      const isBooking = inv.type === 'BOOKING';
      const item: any = {
        id: inv.id,
        amount: Number(inv.amount),
        currencyCode: inv.currencyCode || 'KES',
        status: inv.status,
        type: inv.type,
        createdAt: inv.createdAt,
        gateway: latestTx?.gateway || null,
        method: latestTx?.channel || (inv.status === 'PAID' ? 'ONLINE' : null),
        transactionId: latestTx?.id || null,
        gatewayReference: latestTx?.gatewayReference || null,
        transactions: inv.transactions,
      };

      if (isBooking && inv.booking) {
        item.booking = {
          id: inv.booking.id,
          eventType: inv.booking.eventType,
          client: inv.booking.client
            ? {
                name: inv.booking.client.name,
                email: inv.booking.client.email,
              }
            : null,
        };
      } else if (!isBooking) {
        if (inv.user) {
          item.user = {
            firstName: inv.user.firstName,
            lastName: inv.user.lastName,
            email: inv.user.email,
          };
        }
        if (inv.plan) {
          item.plan = {
            name: inv.plan.name,
          };
        }
      }

      return item;
    });

    return {invoices, meta};
  }

  async getInvoiceById(userId: string, id: string) {
    if (!isValidUuid(id)) {
      throw new NotFoundError('Invoice not found');
    }

    const user = await this.prisma.user.findUnique({where: {id: userId}});
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    const tenantId = await this.getTenantIdByUserId(userId).catch(() => null);

    const invoice = await this.prisma.invoice.findFirst({
      where: isAdmin
        ? {id}
        : {
            id,
            OR: [
              {userId},
              ...(tenantId ? [{tenantId}] : []),
              {booking: {clientId: userId}},
            ],
          },
      include: {
        user: {select: {firstName: true, lastName: true, email: true}},
        plan: {select: {name: true}},
        tenant: {
          select: {
            stageName: true,
            country: true,
            city: true,
            user: {select: {firstName: true, lastName: true, email: true}},
          },
        },
        booking: {
          select: {
            id: true,
            eventDate: true,
            eventType: true,
            address: true,
            client: {select: {name: true, email: true, phone: true}},
          },
        },
        transactions: {
          orderBy: {createdAt: 'desc'},
          take: 1,
          select: {
            id: true,
            gateway: true,
            channel: true,
            cardBrand: true,
            cardLast4: true,
            gatewayReference: true,
            idempotencyKey: true,
            createdAt: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const mainTx = invoice.transactions[0];
    const isBooking = invoice.type === 'BOOKING';

    const result: any = {
      id: invoice.id,
      type: invoice.type,
      status: invoice.status,
      amount: Number(invoice.amount),
      currencyCode: invoice.currencyCode || 'KES',
      createdAt: invoice.createdAt,
      gateway: mainTx?.gateway || null,
      method: mainTx?.channel || (invoice.status === 'PAID' ? 'ONLINE' : null),
      transactionId: mainTx?.id || null,
      gatewayReference: mainTx?.gatewayReference || null,
    };

    if (mainTx?.cardBrand) result.cardBrand = mainTx.cardBrand;
    if (mainTx?.cardLast4) result.cardLast4 = mainTx.cardLast4;
    if (invoice.status === 'PAID') {
      result.paidAt =
        mainTx?.createdAt || invoice.updatedAt || invoice.createdAt;
    }

    if (isBooking) {
      if (invoice.booking) {
        result.booking = {
          id: invoice.booking.id,
          eventType: invoice.booking.eventType,
          eventDate: invoice.booking.eventDate,
          address: invoice.booking.address,
          client: invoice.booking.client
            ? {
                name: invoice.booking.client.name,
                email: invoice.booking.client.email,
                phone: invoice.booking.client.phone,
              }
            : null,
        };
      }
      if (invoice.tenant) {
        result.tenant = {
          stageName: invoice.tenant.stageName,
          country: invoice.tenant.country,
          city: invoice.tenant.city,
          user: invoice.tenant.user
            ? {
                firstName: invoice.tenant.user.firstName,
                lastName: invoice.tenant.user.lastName,
                email: invoice.tenant.user.email,
              }
            : null,
        };
      }
    } else {
      if (invoice.plan) {
        result.plan = {
          name: invoice.plan.name,
        };
      }
      if (invoice.user) {
        result.user = {
          firstName: invoice.user.firstName,
          lastName: invoice.user.lastName,
          email: invoice.user.email,
        };
      }
    }

    return result;
  }

  async markAsPaid(userId: string, id: string) {
    if (!isValidUuid(id)) {
      throw new NotFoundError('Invoice not found');
    }

    const tenantId = await this.getTenantIdByUserId(userId);
    const invoice = await this.prisma.invoice.findFirst({
      where: {id, tenantId},
      include: {
        booking: {include: {client: true}},
        tenant: {include: {user: true}},
      },
    });

    if (!invoice) {
      throw new NotFoundError();
    }

    if (invoice.status === 'PAID') {
      return invoice;
    }

    const txResult = await this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: {id},
        data: {status: 'PAID'},
      });

      await tx.transaction.create({
        data: {
          invoiceId: id,
          tenantId,
          amount: invoice.amount,
          gateway: 'MANUAL',
          channel: 'CASH',
          status: TransactionStatus.SUCCEEDED,
        },
      });

      if (invoice.bookingId) {
        await tx.booking.update({
          where: {id: invoice.bookingId},
          data: {
            status: BookingStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
          },
        });
      }

      return updatedInvoice;
    });

    return txResult;
  }

  async payInvoice(id: string, data: PayInvoiceDTO) {
    if (!isValidUuid(id)) {
      throw new NotFoundError('Invoice not found');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: {id},
      include: {
        booking: {
          include: {
            client: true,
            tenant: {
              include: {
                paymentAccounts: {
                  where: {isActive: true},
                  orderBy: {updatedAt: 'desc'},
                },
              },
            },
          },
        },
        tenant: {
          include: {
            paymentAccounts: {
              where: {isActive: true},
              orderBy: {updatedAt: 'desc'},
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError();
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestError('Invoice is already paid');
    }

    if (!invoice.amount) {
      return {url: 'http://localhost:3000/payment-mock'};
    }

    const {PaymentProviderFactory} =
      await import('@/providers/PaymentProvider/PaymentProviderFactory');
    const paymentProvider = PaymentProviderFactory.getProvider(
      (invoice.booking || invoice.tenant) as any,
    );

    try {
      // Mocking payment link generation if booking doesn't exist (e.g. for subscription)
      if (invoice.type === 'SUBSCRIPTION') {
        return {url: `https://paystack.com/pay/subscription_${invoice.id}`};
      }

      if (invoice.booking) {
        const clientEmail =
          (invoice.booking as any).client?.email ||
          (invoice.booking as any).customerEmail ||
          (invoice.tenant as any)?.user?.email ||
          'customer@example.com';
        const reference = `inv_${invoice.id}_${Date.now()}`;
        const paymentResult = await paymentProvider.initializePayment({
          amount: Number(invoice.amount),
          currency:
            invoice.booking?.currencyCode ||
            invoice.currencyCode ||
            PaymentProviderResolver.resolveCurrencyFromCountry(
              (invoice.booking as any)?.tenant?.country ?? invoice.tenant?.country,
            ) ||
            'KES',
          email: clientEmail,
          reference,
          description: `Payment for invoice #${invoice.id.slice(0, 8)}`,
          callbackUrl: `${config.clientUrl}/payment-success?reference=${reference}`,
          paymentType: 'BOOKING',
          metadata: {
            invoiceId: invoice.id,
            bookingId: invoice.booking.id,
            tenantId: invoice.tenantId,
          },
        });
        return {url: paymentResult.checkoutUrl};
      }

      throw new BadRequestError('Cannot generate link for this invoice type');
    } catch (error: any) {
      console.error('Payment Link Generation Error:', error.message);
      throw new BadRequestError(
        error.message || 'Failed to generate payment link',
      );
    }
  }

  async generateInvoicePdf(id: string): Promise<Buffer> {
    if (!isValidUuid(id)) {
      throw new NotFoundError('Invoice not found');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: {id},
      include: {
        booking: {include: {client: true}},
        tenant: {include: {user: true}},
        user: true,
        plan: true,
        transactions: {
          orderBy: {createdAt: 'desc'},
          take: 1,
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError();
    }

    const mainTx = invoice.transactions[0];

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({margin: 0, size: 'A4'});
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

        const logoPath = path.resolve(process.cwd(), 'public/logo.png');
        if (fs.existsSync(logoPath)) {
          try {
            doc.image(logoPath, boxX, currentY, {height: 32});
            currentY += 40;
          } catch (err) {
            // fallback
          }
        }

        // Header (UpBeat Entertainment Africa & PAID/UNPAID Badge)
        doc
          .font('Helvetica-Bold')
          .fontSize(18)
          .fillColor(primary)
          .text('UpBeat Entertainment Africa', boxX, currentY);
        if (invoice.status === 'PAID') {
          doc.rect(boxX + boxW - 70, currentY, 70, 24).fill('#DEF7EC');
          doc
            .font('Helvetica-Bold')
            .fontSize(11)
            .fillColor('#03543F')
            .text('PAID', boxX + boxW - 70, currentY + 6, {
              width: 70,
              align: 'center',
            });
        } else {
          doc.rect(boxX + boxW - 70, currentY, 70, 24).fill('#FEE2E2');
          doc
            .font('Helvetica-Bold')
            .fontSize(11)
            .fillColor('#991B1B')
            .text('UNPAID', boxX + boxW - 70, currentY + 6, {
              width: 70,
              align: 'center',
            });
        }

        currentY += 30;
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor(textMain)
          .text('Payment Receipt', boxX, currentY);
        doc
          .font('Helvetica')
          .fontSize(12)
          .fillColor(textMuted)
          .text(
            invoice.createdAt?.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }) || '',
            boxX + boxW - 140,
            currentY,
            {width: 140, align: 'right'},
          );

        currentY += 30;
        // Divider
        doc
          .moveTo(boxX, currentY)
          .lineTo(boxX + boxW, currentY)
          .strokeColor(border)
          .lineWidth(1)
          .stroke();
        currentY += 20;

        // RECEIPT INFORMATION
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(textMuted)
          .text('RECEIPT INFORMATION', boxX, currentY);
        currentY += 20;

        const drawRow = (label: string, value: string, y: number) => {
          doc
            .font('Helvetica')
            .fontSize(12)
            .fillColor(textMuted)
            .text(label, boxX, y);
          doc
            .font('Helvetica-Bold')
            .fontSize(12)
            .fillColor(textMain)
            .text(value, boxX + 160, y);
        };

        drawRow(
          'Receipt No.',
          `INV-${invoice.id.split('-')[0].toUpperCase()}`,
          currentY,
        );
        currentY += 20;
        drawRow('Transaction ID', invoice.id, currentY);
        currentY += 20;
        drawRow(
          'Payment Date',
          mainTx?.createdAt?.toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }) || '',
          currentY,
        );
        currentY += 20;
        const methodString =
          `${mainTx?.channel?.replace('_', ' ') || 'UNKNOWN'} (${mainTx?.gateway || 'UNKNOWN'}) ${mainTx?.cardLast4 ? '•••• ' + mainTx.cardLast4 : ''}`.trim();
        drawRow('Payment Method', methodString, currentY);
        currentY += 20;
        if (mainTx?.bankName) {
          drawRow('Bank Name', mainTx.bankName, currentY);
          currentY += 20;
        }

        // Divider
        doc
          .moveTo(boxX, currentY)
          .lineTo(boxX + boxW, currentY)
          .strokeColor(border)
          .lineWidth(1)
          .stroke();
        currentY += 20;

        // BILLED FROM / TO
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(textMuted)
          .text('BILLED FROM', boxX, currentY);
        doc.text('BILLED TO', boxX + boxW / 2, currentY);
        currentY += 20;

        // Parties Info
        let billedFromName = 'UpBeat Entertainment Africa';
        let billedFromDesc = 'UpBeat Entertainment Africa';
        let billedFromEmail = 'hello@upbeatafrica.com';

        let clientName = 'Valued Client';
        let clientEmail = 'N/A';
        let clientPhone = '';

        if (invoice.type === 'BOOKING' && invoice.booking) {
          billedFromName =
            invoice.tenant?.stageName ||
            invoice.tenant?.user?.firstName ||
            billedFromName;
          billedFromDesc = invoice.tenant?.user?.email || billedFromDesc;
          billedFromEmail = invoice.tenant?.subdomain
            ? `https://${invoice.tenant.subdomain}.deejay.africa`
            : '';
          clientName = invoice.booking.client?.name || clientName;
          clientEmail = invoice.booking.client?.email || clientEmail;
          clientPhone = invoice.booking.client?.phone || '';
        } else if (invoice.type === 'SUBSCRIPTION') {
          clientName =
            `${invoice.user?.firstName || ''} ${invoice.user?.lastName || ''}`.trim() ||
            clientName;
          clientEmail = invoice.user?.email || clientEmail;
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(13)
          .fillColor(textMain)
          .text(billedFromName, boxX, currentY);
        doc.text(clientName, boxX + boxW / 2, currentY);
        currentY += 16;

        doc
          .font('Helvetica')
          .fontSize(12)
          .fillColor(textMuted)
          .text(billedFromDesc, boxX, currentY);
        doc.text(clientEmail, boxX + boxW / 2, currentY);
        currentY += 16;

        if (billedFromEmail || clientPhone) {
          if (billedFromEmail) doc.text(billedFromEmail, boxX, currentY);
          if (clientPhone) doc.text(clientPhone, boxX + boxW / 2, currentY);
          currentY += 16;
        }

        currentY += 10;
        // Divider
        doc
          .moveTo(boxX, currentY)
          .lineTo(boxX + boxW, currentY)
          .strokeColor(border)
          .lineWidth(1)
          .stroke();
        currentY += 20;

        // EVENT DETAILS (If Booking)
        if (invoice.type === 'BOOKING' && invoice.booking) {
          doc
            .font('Helvetica-Bold')
            .fontSize(11)
            .fillColor(textMuted)
            .text('EVENT DETAILS', boxX, currentY);
          currentY += 20;

          drawRow(
            'Event Type',
            (invoice.booking.eventType || 'Event').toUpperCase(),
            currentY,
          );
          currentY += 20;
          drawRow(
            'Event Date',
            invoice.booking.eventDate?.toLocaleDateString('en-US', {
              dateStyle: 'medium',
            }) || 'N/A',
            currentY,
          );
          currentY += 20;
          drawRow('Location', invoice.booking.address || 'N/A', currentY);
          currentY += 20;

          // Divider
          doc
            .moveTo(boxX, currentY)
            .lineTo(boxX + boxW, currentY)
            .strokeColor(border)
            .lineWidth(1)
            .stroke();
          currentY += 20;
        }

        // PAYMENT SUMMARY
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(textMuted)
          .text('PAYMENT SUMMARY', boxX, currentY);
        currentY += 20;

        const description =
          invoice.type === 'SUBSCRIPTION'
            ? 'Platform Subscription'
            : 'DJ Booking Payment';
        doc
          .font('Helvetica')
          .fontSize(14)
          .fillColor(textMain)
          .text(description, boxX, currentY);

        const displayCurrency =
          mainTx?.currency || invoice.currencyCode || 'KES';
        const displayAmount = Number(mainTx?.amount || invoice.amount).toFixed(
          2,
        );

        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor(textMain)
          .text(
            `${displayCurrency} ${displayAmount}`,
            boxX + boxW - 140,
            currentY,
            {width: 140, align: 'right'},
          );
        currentY += 30;

        // Divider
        doc
          .moveTo(boxX, currentY)
          .lineTo(boxX + boxW, currentY)
          .strokeColor(border)
          .lineWidth(1)
          .stroke();
        currentY += 20;

        // TOTAL DUE / PAID
        const totalText =
          invoice.status === 'PAID' ? 'TOTAL PAID' : 'TOTAL DUE';
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor(textMain)
          .text(totalText, boxX, currentY + 6);
        doc
          .font('Helvetica-Bold')
          .fontSize(24)
          .fillColor(primary)
          .text(
            `${displayCurrency} ${displayAmount}`,
            boxX + boxW - 200,
            currentY,
            {width: 200, align: 'right'},
          );

        currentY += 60;

        // Footer Message inside the layout
        if (invoice.status === 'PAID') {
          doc
            .font('Helvetica')
            .fontSize(12)
            .fillColor('#03543F')
            .text('Payment Successful', boxX, currentY, {
              align: 'center',
              width: boxW,
            });
        } else {
          doc
            .font('Helvetica')
            .fontSize(12)
            .fillColor('#991B1B')
            .text('Payment Pending', boxX, currentY, {
              align: 'center',
              width: boxW,
            });
        }
        currentY += 30;
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor(textMuted)
          .text(
            'Thank you for choosing UpBeat Entertainment Africa.',
            boxX,
            currentY,
            {align: 'center', width: boxW},
          );
        currentY += 16;
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(textMuted)
          .text('upbeat.africa', boxX, currentY, {
            align: 'center',
            width: boxW,
          });

        // Final bottom message
        currentY += 40;
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#9CA3AF')
          .text(
            'This is an electronically generated payment receipt.',
            0,
            currentY,
            {align: 'center', width: pageWidth},
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
