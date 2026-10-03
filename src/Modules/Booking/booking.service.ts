import {
  PrismaClient,
  BookingStatus,
  PaymentStatus,
  InvoiceStatus,
  InvoiceType,
  NotificationType,
  PaymentChannel,
  PaymentGateway,
  TransactionStatus,
} from '@/prisma/generated/client';
import { config } from '@/core/config';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { CreateBookingDTO, UpdateBookingStatusDTO } from './BookingDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { BookingStatusService } from './booking-status.service';
import { PaymentProviderResolver, COUNTRY_ROUTING_MATRIX } from '@/Modules/PaymentProvider/PaymentProviderResolver';
import { isValidUuid } from '@/utils/uuid';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = config.security.jwt.secret || 'default_secret_key';

interface BookingVerificationPayload {
  bookingData: CreateBookingDTO;
  otpHash: string;
  stageName: string;
}

export class BookingServices {
  private bookingStatusService: BookingStatusService;

  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) {
    this.bookingStatusService = new BookingStatusService(prisma, emailProvider);
  }

  async initiateBooking(data: CreateBookingDTO) {
    if (!isValidUuid(data.tenantId)) {
      throw new NotFoundError('Tenant not found');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: data.tenantId },
      include: { user: true },
    });
    if (!tenant) {
      throw new NotFoundError('DJ Profile not found');
    }

    const stageName = tenant.stageName || tenant.user?.firstName || 'DJ';
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const verificationToken = jwt.sign(
      {
        bookingData: data,
        otpHash,
        stageName,
      },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Send OTP to client
    await this.emailProvider.sendEmail(
      data.clientEmail,
      `Verify Your DJ Booking Request (${otp}) - UpBeat Entertainment Africa`,
      EmailTemplates.getBookingVerificationOtpTemplate(
        data.clientName,
        otp,
        stageName,
        data.eventType
      )
    );

    return {
      verificationToken,
      clientEmail: data.clientEmail,
      expiresIn: 600,
    };
  }

  async verifyBookingOtp(verificationToken: string, otp: string) {
    let decoded: BookingVerificationPayload;
    try {
      decoded = jwt.verify(verificationToken, JWT_SECRET) as BookingVerificationPayload;
    } catch {
      throw new BadRequestError('Verification code has expired or is invalid. Please request a new code.');
    }

    const submittedHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (submittedHash !== decoded.otpHash) {
      throw new BadRequestError('Invalid 6-digit verification code. Please check your email and try again.');
    }

    // OTP is valid -> proceed to create actual booking in database
    return this.createBooking(decoded.bookingData);
  }

  async resendBookingOtp(verificationToken: string) {
    let decoded: BookingVerificationPayload;
    try {
      decoded = jwt.decode(verificationToken) as BookingVerificationPayload;
      if (!decoded || !decoded.bookingData) {
        throw new Error('Invalid token');
      }
    } catch {
      throw new BadRequestError('Invalid verification session. Please submit your booking again.');
    }

    const stageName = decoded.stageName || 'DJ';
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const newVerificationToken = jwt.sign(
      {
        bookingData: decoded.bookingData,
        otpHash,
        stageName,
      },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    await this.emailProvider.sendEmail(
      decoded.bookingData.clientEmail,
      `Verify Your DJ Booking Request (${otp}) - UpBeat Entertainment Africa`,
      EmailTemplates.getBookingVerificationOtpTemplate(
        decoded.bookingData.clientName,
        otp,
        stageName,
        decoded.bookingData.eventType
      )
    );

    return {
      verificationToken: newVerificationToken,
      clientEmail: decoded.bookingData.clientEmail,
      expiresIn: 600,
    };
  }

  private async getTenantIdByUserId(userId: string): Promise<string> {
    if (!isValidUuid(userId)) {
      throw new AuthorizationError();
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) {
      throw new AuthorizationError();
    }
    return tenant.id;
  }

  async createBooking(data: CreateBookingDTO) {
    if (!isValidUuid(data.tenantId)) {
      throw new NotFoundError('Tenant not found');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: data.tenantId },
      include: { user: true },
    });
    if (!tenant) {
      throw new NotFoundError('DJ profile not found');
    }

    let client = await this.prisma.client.findFirst({
      where: { email: data.clientEmail, tenantId: data.tenantId },
    });
    if (!client) {
      client = await this.prisma.client.create({
        data: {
          tenantId: data.tenantId,
          name: data.clientName,
          email: data.clientEmail,
          phone: data.clientPhone,
        },
      });
    }

    // Resolve currency from tenant country using the PaymentProviderResolver's normalizeCountryCode
    // This correctly handles both ISO codes ("KE") and full names ("Kenya", "Nigeria", "South Africa")
    const normalizedCountryCode = PaymentProviderResolver.normalizeCountryCode(tenant.country);
    const countryConfig = COUNTRY_ROUTING_MATRIX[normalizedCountryCode];
    const resolvedCurrency = countryConfig?.defaultCurrency || 'KES';
    const currencyCode = data.currencyCode || resolvedCurrency;

    // Map abbreviated or full IANA timezone strings to proper IANA timezone names
    // EAT, WAT, SAST abbreviations are NOT valid IANA strings for date libraries (luxon, date-fns-tz)
    const tzAbbrToIana: Record<string, string> = {
      EAT: 'Africa/Nairobi',
      WAT: 'Africa/Lagos',
      SAST: 'Africa/Johannesburg',
      GMT: 'GMT',
      UTC: 'UTC',
    };
    const rawTimezone = data.eventTimezone || tenant.timezone || 'Africa/Nairobi';
    const eventTimezone = tzAbbrToIana[rawTimezone.toUpperCase()] || rawTimezone;

    const booking = await this.prisma.booking.create({
      data: {
        tenantId: data.tenantId,
        clientId: client.id,
        eventType: data.eventType,
        eventDetails: data.eventDetails ? { notes: data.eventDetails } : undefined,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        eventTimezone,
        currencyCode,
        address: data.address,
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    if (tenant.userId) {
      await this.prisma.notification.create({
        data: {
          userId: tenant.userId,
          title: 'New Booking Request',
          message: `You have a new booking request from ${data.clientName} for ${data.eventType}.`,
          type: NotificationType.booking_request,
          referenceId: booking.id,
        },
      });

      if (tenant.user && tenant.user.email) {
        this.emailProvider.sendEmail(
          tenant.user.email,
          'New Booking Request - UpBeat Entertainment Africa',
          EmailTemplates.getNewBookingAlertTemplate(
            data.clientName,
            data.eventType || 'Event',
            data.eventDate || new Date().toISOString(),
            tenant.timezone || 'Africa/Nairobi'
          )
        );
      }
    }

    // Auto-reply to Client with magic manage link & formatted date/time
    const targetTz = booking.eventTimezone || tenant.timezone || 'Africa/Nairobi';
    let clientEventDate = '';
    let clientEventTime = '';
    if (booking.eventDate) {
      const d = new Date(booking.eventDate);
      if (!isNaN(d.getTime())) {
        try {
          clientEventDate = d.toLocaleDateString('en-US', {
            timeZone: targetTz,
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          const timeFormatted = d.toLocaleTimeString('en-US', {
            timeZone: targetTz,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          clientEventTime = timeFormatted;
        } catch {
          clientEventDate = d.toDateString();
        }
      }
    }

    const manageUrl = `${config.clientUrl}/booking/manage/${booking.id}`;

    this.emailProvider.sendEmail(
      data.clientEmail,
      `Booking Request Received - ${tenant.stageName || tenant.user?.firstName || 'DJ'} - UpBeat Entertainment Africa`,
      EmailTemplates.getBookingAutoReplyTemplate({
        clientName: data.clientName,
        djName: tenant.stageName || tenant.user?.firstName || 'DJ',
        eventType: data.eventType || 'Event',
        eventDate: clientEventDate,
        eventTime: clientEventTime,
        manageUrl,
      })
    );

    return booking;
  }

  async getMyBookings(userId: string, query: Record<string, unknown> = {}) {
    const tenantId = await this.getTenantIdByUserId(userId);

    const bookingQuery = new QueryBuilder(this.prisma.booking, query)
      .search(['eventType', 'address'])
      .filter()
      .sort()
      .pagination();

    bookingQuery.prismaArgs.where = {
      ...bookingQuery.prismaArgs.where,
      tenantId,
    };

    bookingQuery.prismaArgs.include = {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      invoice: {
        select: {
          id: true,
          amount: true,
          status: true,
          currencyCode: true,
          transactions: {
            select: {
              id: true,
              amount: true,
              gateway: true,
              channel: true,
              status: true,
              gatewayReference: true,
              createdAt: true,
              metadata: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    };

    const bookings = await bookingQuery.model.findMany(bookingQuery.prismaArgs);
    const meta = await bookingQuery.countTotal();

    return { bookings, meta };
  }

  async getBookingById(userId: string | undefined, id: string) {
    if (!isValidUuid(id)) {
      throw new NotFoundError('Booking not found');
    }
    let whereClause: any = { id };
    if (userId) {
      const tenantId = await this.getTenantIdByUserId(userId);
      if (tenantId) {
        whereClause = { id, tenantId };
      }
    }
    const booking = await this.prisma.booking.findFirst({
      where: whereClause,
      include: {
        invoice: {
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        client: true,
        tenant: { include: { user: true } },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    return booking;
  }

  async updateBookingStatus(userId: string, id: string, data: UpdateBookingStatusDTO) {
    if (!isValidUuid(id)) {
      throw new NotFoundError('Booking not found');
    }
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    return this.bookingStatusService.transition({
      bookingId: id,
      targetStatus: data.status,
      userId,
      reason: data.reason,
      totalAmount: data.totalAmount,
      currencyCode: data.currencyCode,
    });
  }

  /**
   * Initializes payment for a customer booking.
   * Calculates amounts server-side and routes to the appropriate provider (Paystack / Flutterwave / Pesapal).
   */
  async getBookingPaymentLink(id: string, requestedGateway?: string) {
    if (!isValidUuid(id)) {
      throw new NotFoundError('Booking not found');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        tenant: {
          include: {
            user: true,
            paymentAccounts: {
              where: { isActive: true },
              orderBy: { updatedAt: 'desc' },
            },
          },
        },
        invoice: true,
        client: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.paymentStatus === PaymentStatus.PAID || booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestError('Booking is already paid');
    }

    if (booking.status === BookingStatus.REJECTED || booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestError('This booking has been declined or cancelled. The payment link is no longer valid.');
    }

    if (booking.status !== BookingStatus.AWAITING_PAYMENT && (booking.status as any) !== 'accepted') {
      throw new BadRequestError('Booking is not ready for payment');
    }

    // Enforce 48-hour payment window — if paymentDueAt has passed, expire the booking
    if (booking.paymentDueAt && new Date() > new Date(booking.paymentDueAt)) {
      // Attempt to transition to EXPIRED (non-blocking — status may already be terminal)
      try {
        await this.bookingStatusService.transition({
          bookingId: booking.id,
          targetStatus: BookingStatus.EXPIRED,
          reason: 'Payment window expired (48 hours)',
        });
      } catch {
        // Already in a terminal state — still block the payment link
      }
      throw new BadRequestError(
        'The payment window for this booking has expired. Please contact the DJ to request a new booking or a new payment link.'
      );
    }


    const amount = Number(booking.totalAmount);
    if (!amount || amount <= 0) {
      throw new BadRequestError('Booking total amount is invalid or zero');
    }

    const currency = booking.currencyCode || 'KES';
    const email = booking.client?.email;
    if (!email) {
      throw new BadRequestError('Customer email is required for payment initialization');
    }

    // Ensure unpaid invoice exists
    let invoice = booking.invoice;
    if (!invoice) {
      invoice = await this.prisma.invoice.create({
        data: {
          tenantId: booking.tenantId,
          bookingId: booking.id,
          amount,
          currencyCode: currency,
          type: InvoiceType.BOOKING,
          status: InvoiceStatus.UNPAID,
        },
      });
    }

    // Resolve Provider via PaymentProviderResolver
    const provider = PaymentProviderResolver.resolve({
      country: booking.tenant?.country,
      operation: 'COLLECTION',
      requestedGateway,
    });

    const reference = `bk_${booking.id.substring(0, 8)}_${Date.now()}`;
    const callbackUrl = `${config.clientUrl}/payment-success?reference=${reference}&bookingId=${booking.id}`;
    const cancelUrl = `${config.clientUrl}/payment-cancel?reference=${reference}&bookingId=${booking.id}`;

    const paymentResult = await provider.initializePayment({
      reference,
      amount,
      currency,
      email,
      name: booking.client?.name || 'Customer',
      phone: booking.client?.phone || undefined,
      description: `Payment for ${booking.eventType || 'DJ Booking'} with ${booking.tenant?.stageName || 'DJ'}`,
      callbackUrl,
      cancelUrl,
      paymentType: 'BOOKING',
      country: booking.tenant?.country || undefined,
      metadata: {
        bookingId: booking.id,
        invoiceId: invoice.id,
        tenantId: booking.tenantId,
      },
    });

    // Create pending transaction in database
    await this.prisma.transaction.create({
      data: {
        invoiceId: invoice.id,
        tenantId: booking.tenantId,
        amount,
        currency,
        gateway: provider.gateway,
        channel: PaymentChannel.UNKNOWN,
        status: TransactionStatus.PENDING,
        gatewayReference: reference,
        idempotencyKey: reference,
        grossAmount: amount,
        djNetEarning: amount,
        metadata: {
          bookingId: booking.id,
          paymentResult: paymentResult as any,
        },
      },
    });

    return {
      checkoutUrl: paymentResult.checkoutUrl,
      reference,
      gateway: provider.gateway,
      amount,
      currency,
    };
  }

  async requestCashPayment(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        invoice: { include: { transactions: true } },
        tenant: { include: { user: true } },
        client: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.paymentStatus === PaymentStatus.PAID || (booking.invoice && booking.invoice.status === InvoiceStatus.PAID)) {
      throw new BadRequestError('Booking is already paid');
    }

    if (booking.status === BookingStatus.REJECTED || booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestError('This booking has been declined or cancelled. Cash payment cannot be requested.');
    }

    if (booking.status !== BookingStatus.AWAITING_PAYMENT && (booking.status as any) !== 'accepted') {
      throw new BadRequestError('Booking is not ready for payment');
    }

    let invoice = booking.invoice;
    if (!invoice) {
      invoice = await this.prisma.invoice.create({
        data: {
          tenantId: booking.tenantId,
          bookingId: booking.id,
          amount: Number(booking.totalAmount) || 0,
          currencyCode: booking.currencyCode || 'KES',
          type: InvoiceType.BOOKING,
          status: InvoiceStatus.UNPAID,
        },
        include: { transactions: true },
      });
    }

    const existingCashTx = invoice.transactions?.find(
      (tx) => tx.gateway === PaymentGateway.CASH && tx.status === TransactionStatus.PENDING
    );
    if (existingCashTx) {
      return { success: true, message: 'Cash payment already requested' };
    }

    await this.prisma.transaction.create({
      data: {
        invoiceId: invoice.id,
        tenantId: booking.tenantId,
        amount: invoice.amount,
        currency: invoice.currencyCode || 'KES',
        gateway: PaymentGateway.CASH,
        channel: PaymentChannel.CASH,
        status: TransactionStatus.PENDING,
        metadata: { cashRequested: true, cashApproved: false },
      },
    });

    if (booking.tenant?.userId) {
      await this.prisma.notification.create({
        data: {
          userId: booking.tenant.userId,
          title: 'Cash Payment Requested',
          message: `${booking.client?.name || 'Client'} has requested to pay by cash for the ${booking.eventType} booking.`,
          type: NotificationType.system,
          referenceId: booking.id,
        },
      });

      if (booking.tenant.user?.email) {
        this.emailProvider.sendEmail(
          booking.tenant.user.email,
          'Cash Payment Requested - UpBeat Entertainment Africa',
          EmailTemplates.getCashPaymentRequestedTemplate(
            booking.client?.name || 'Client',
            booking.eventType || 'Event'
          )
        );
      }
    }

    return {
      success: true,
      message: 'Cash payment requested successfully',
      subdomain: booking.tenant?.subdomain || 'demo',
      stageName: booking.tenant?.stageName || 'DJ',
    };
  }

  async resendPaymentReminder(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
      include: { client: true, tenant: { include: { user: true } } },
    });

    if (!booking || (booking.status !== BookingStatus.AWAITING_PAYMENT && (booking.status as any) !== 'accepted')) {
      throw new BadRequestError('Booking is not in a state waiting for payment');
    }

    if (booking.client?.email) {
      const checkoutUrl = `${config.clientUrl}/checkout/${id}`;
      const checkoutRedirectUrl = `${config.apiUrl}/bookings/v1/${id}/checkout-redirect`;
      const clientName = booking.client?.name || 'Client';
      const djName = booking.tenant?.stageName || booking.tenant?.user?.firstName || 'DJ';
      const eventName = booking.eventType || 'Event';
      const amount = Number(booking.totalAmount || 0);
      const currency = booking.currencyCode || 'KES';
      const eventDate = booking.eventDate
        ? new Date(booking.eventDate).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : '';

      let eventTime = '';
      if (booking.eventDate) {
        const d = new Date(booking.eventDate);
        if (!isNaN(d.getTime())) {
          const hours = d.getUTCHours();
          const minutes = d.getUTCMinutes();
          if (hours !== 0 || minutes !== 0) {
            eventTime = d.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
          }
        }
      }

      if (booking.eventDetails) {
        let rawText = '';
        if (typeof booking.eventDetails === 'object' && booking.eventDetails !== null) {
          const detailsObj = booking.eventDetails as any;
          if (detailsObj.startTime) eventTime = String(detailsObj.startTime);
          else if (detailsObj.time) eventTime = String(detailsObj.time);
          else if (detailsObj.notes) rawText = String(detailsObj.notes);
        } else if (typeof booking.eventDetails === 'string') {
          rawText = booking.eventDetails;
        }
        if (!eventTime && rawText) {
          const match = rawText.match(/Start Time:\s*([^\n\r]+)/i);
          if (match && match[1]) {
            eventTime = match[1].trim();
          }
        }
      }

      if (booking.eventTimezone && eventTime && !eventTime.includes(booking.eventTimezone)) {
        eventTime = `${eventTime} (${booking.eventTimezone})`;
      }

      const amountFormatted = amount > 0 ? ` (${currency} ${amount.toLocaleString()})` : '';
      const reminderSubject = `Payment Reminder: Complete Payment${amountFormatted} to Secure Date with ${djName} - UpBeat Entertainment Africa`;

      const manageUrl = `${config.clientUrl}/booking/manage/${id}`;

      this.emailProvider.sendEmail(
        booking.client.email,
        reminderSubject,
        EmailTemplates.getPaymentReminderTemplate({
          clientName,
          djName,
          eventType: eventName,
          eventDate,
          eventTime,
          currency,
          amount,
          paymentUrl: checkoutUrl || checkoutRedirectUrl,
          manageUrl,
        })
      );
    }

    return { success: true, message: 'Payment reminder sent successfully' };
  }

  async handleCashRequestDecision(userId: string, id: string, decision: 'approve' | 'reject') {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
      include: {
        invoice: { include: { transactions: true } },
        client: true,
        tenant: { include: { user: true } },
      },
    });

    if (!booking || !booking.invoice) {
      throw new NotFoundError('Booking or payment record not found');
    }

    const cashTx = booking.invoice.transactions.find(
      (tx) => tx.gateway === PaymentGateway.CASH && tx.status === TransactionStatus.PENDING
    );
    if (!cashTx) {
      throw new BadRequestError('No pending cash request found');
    }

    const djName = booking.tenant?.stageName || booking.tenant?.user?.firstName || 'Your DJ';
    const clientEmail = booking.client?.email;
    const checkoutUrl = `${config.clientUrl}/checkout/${booking.id}`;
    const djUrl = booking.tenant?.subdomain
      ? (config.clientUrl.includes('localhost') ? `http://${booking.tenant.subdomain}.localhost:3000` : `https://${booking.tenant.subdomain}.deejay.africa`)
      : config.clientUrl;

    const manageUrl = `${config.clientUrl}/booking/manage/${booking.id}`;

    if (decision === 'reject') {
      await this.prisma.transaction.update({
        where: { id: cashTx.id },
        data: { status: TransactionStatus.FAILED },
      });

      if (clientEmail) {
        this.emailProvider.sendEmail(
          clientEmail,
          `Action Required: Cash Request Declined for ${booking.eventType || 'Event'} - UpBeat Entertainment Africa`,
          EmailTemplates.getCashRequestDeclinedTemplate(
            booking.client?.name || 'Valued Client',
            djName,
            booking.eventType || 'Event',
            booking.currencyCode || 'KES',
            Number(booking.totalAmount || 0),
            checkoutUrl,
            manageUrl
          )
        );
      }

      return { success: true, message: 'Cash request declined. Client has been notified by email to pay online.' };
    } else {
      await this.prisma.transaction.update({
        where: { id: cashTx.id },
        data: { metadata: { ...(cashTx.metadata as any), cashApproved: true } },
      });

      if (booking.invoice) {
        await this.prisma.invoice.update({
          where: { id: booking.invoice.id },
          data: { status: InvoiceStatus.PAID },
        });
      }

      await this.bookingStatusService.transition({
        bookingId: booking.id,
        targetStatus: BookingStatus.CONFIRMED,
        userId,
        reason: 'DJ approved cash payment request',
      });

      // NOTE: Cash payments are collected directly by the DJ — no platform funds are involved.
      // Therefore we do NOT credit the DJ's platform escrow wallet here.
      // Crediting escrow here would create a fraudulent liability where the DJ could withdraw
      // platform funds despite having already received cash directly from the client.
      // The DJ's actual cash earnings are tracked via the Invoice (PAID) + Transaction (CASH/PENDING) records only.

      if (clientEmail) {
        this.emailProvider.sendEmail(
          clientEmail,
          `Cash Payment Approved! Your Booking with ${djName} is Confirmed - UpBeat Entertainment Africa`,
          EmailTemplates.getCashRequestApprovedTemplate(
            booking.client?.name || 'Valued Client',
            djName,
            booking.eventType || 'Event',
            booking.eventDate ? new Date(booking.eventDate).toLocaleDateString() : 'Event Day',
            booking.currencyCode || 'KES',
            Number(booking.totalAmount || 0),
            djUrl,
            manageUrl
          )
        );
      }

      return { success: true, message: 'Cash request approved. Booking is confirmed and client has been notified by email.' };
    }
  }

  async markCashAsPaid(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
      include: { invoice: { include: { transactions: true } } },
    });

    if (!booking || !booking.invoice) {
      throw new NotFoundError('Booking or payment not found');
    }

    const cashTx = booking.invoice.transactions.find(
      (tx) => tx.gateway === PaymentGateway.CASH && (tx.status === TransactionStatus.PENDING || tx.status === TransactionStatus.SUCCEEDED)
    );
    if (!cashTx) {
      throw new BadRequestError('No valid cash transaction found');
    }

    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: cashTx.id },
        data: { status: TransactionStatus.SUCCEEDED },
      }),
      this.prisma.invoice.update({
        where: { id: booking.invoice.id },
        data: { status: InvoiceStatus.PAID },
      }),
    ]);

    await this.bookingStatusService.transition({
      bookingId: booking.id,
      targetStatus: BookingStatus.COMPLETED,
      userId,
      reason: 'Cash payment confirmed by DJ',
    });

    return { success: true, message: 'Cash payment confirmed, invoice marked as paid, and booking completed' };
  }

  async refundBooking(userId: string, bookingId: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: { invoice: true }
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.paymentStatus !== PaymentStatus.PAID && booking.paymentStatus !== PaymentStatus.REFUND_PENDING) {
      throw new BadRequestError('Only paid bookings can be refunded');
    }

    await this.bookingStatusService.transition({
      bookingId: booking.id,
      targetStatus: BookingStatus.CANCELLED,
      userId,
      reason: 'DJ initiated refund and cancellation',
    });

    return { success: true, message: 'Booking refunded and cancelled successfully' };
  }

  public async getClientBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            stageName: true,
            subdomain: true,
            timezone: true,
            logoUrl: true,
            bio: true,
            city: true,
            country: true,
            socialLinks: true,
            config: true,
            user: { select: { email: true, firstName: true, lastName: true, profileImg: true } }
          }
        },
        client: {
          select: { name: true, email: true, phone: true }
        },
        invoice: {
          select: { id: true, status: true, amount: true, currencyCode: true }
        }
      }
    });
    if (!booking) throw new NotFoundError('Booking not found');
    return booking;
  }

  public async clientCancelBooking(id: string, reason?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });
    if (!booking) throw new NotFoundError('Booking not found');
    
    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.EXPIRED ||
      booking.status === BookingStatus.REJECTED
    ) {
      throw new BadRequestError('Booking cannot be cancelled at this stage.');
    }

    await this.bookingStatusService.transition({
      bookingId: booking.id,
      targetStatus: BookingStatus.CANCELLED,
      cancelledBy: 'CLIENT',
      reason: reason || 'Client requested cancellation',
    });

    return { success: true, message: 'Booking cancelled successfully' };
  }
}
