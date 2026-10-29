import {
  PrismaClient,
  BookingStatus,
  DirectPaymentStatus,
  NotificationType,
} from '@/prisma/generated/client';
import {
  BadRequestError,
  NotFoundError,
  AuthorizationError,
} from '@/core/errors/AppError';
import {AppLogger} from '@/core/logging/logger';
import {QueryBuilder} from '@/utils/QueryBuilder';
import {
  CreateBookingDTO,
  UpdateBookingStatusDTO,
  ProposeQuoteDTO,
  ReportDirectPaymentDTO,
  ReportIssueDTO,
  SubmitReviewDTO,
} from './BookingDTO';
import {IEmailProvider} from '@/providers/EmailProvider';
import {EmailTemplates} from '@/utils/EmailTemplates';
import {BookingStatusService} from './booking-status.service';
import {
  COUNTRY_ROUTING_MATRIX,
  PaymentProviderResolver,
} from '../PaymentProvider/PaymentProviderResolver';
import {config} from '@/core/config';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {generateBookingAccessToken} from '@/utils/jwt';

const JWT_SECRET = config.security.jwt.secret || 'default_secret_key';

interface BookingVerificationPayload {
  bookingData: CreateBookingDTO;
  otpHash: string;
  stageName: string;
}

interface BookingAccessSessionPayload {
  bookingId: string;
  orderReference: string;
  clientEmail: string;
  otpHash: string;
}

function isValidUuid(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uuid,
  );
}

export class BookingServices {
  private logger = new AppLogger('BookingServices');
  public bookingStatusService: BookingStatusService;

  // Resilient multi-OTP store for booking portal access.
  // Stores valid OTP hashes per booking so multiple clicks, resends, or slight session delays do NOT fail valid codes.
  private accessOtpStore = new Map<
    string,
    {
      otpHashes: Set<string>;
      clientEmail: string;
      orderReference: string;
      bookingId: string;
      expiresAt: number;
    }
  >();

  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider,
  ) {
    this.bookingStatusService = new BookingStatusService(prisma, emailProvider);
  }

  /**
   * Helper to generate a 1-click magic link for client portal access
   */
  private getClientPortalUrl(
    bookingId: string,
    orderReference: string,
    clientEmail?: string | null,
  ): string {
    const base = `${config.clientUrl}/booking/manage/${bookingId}`;
    if (!clientEmail) {
      return `${base}?ref=${encodeURIComponent(orderReference)}`;
    }
    const token = generateBookingAccessToken({
      bookingId,
      orderReference,
      clientEmail,
      role: 'CLIENT',
    });
    return `${base}?ref=${encodeURIComponent(orderReference)}&token=${encodeURIComponent(token)}`;
  }

  // ==========================================
  // 1. Initial Booking Request & Verification Flow
  // ==========================================

  async initiateBooking(data: CreateBookingDTO) {
    if (!isValidUuid(data.tenantId)) {
      throw new NotFoundError('DJ profile not found');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: {id: data.tenantId},
    });
    if (!tenant || tenant.isActive === false || tenant.subscriptionStatus !== 'active') {
      throw new BadRequestError('This DJ is currently unavailable or awaiting subscription renewal.');
    }

    const stageName = tenant.stageName || 'DJ';
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const verificationToken = jwt.sign(
      {
        bookingData: data,
        otpHash,
        stageName,
      },
      JWT_SECRET,
      {expiresIn: '10m'},
    );

    await this.emailProvider.sendEmail(
      data.clientEmail,
      `Verify Your DJ Booking Request (${otp}) - UpBeat Entertainment Africa`,
      EmailTemplates.getBookingVerificationOtpTemplate(
        data.clientName,
        otp,
        stageName,
        data.eventType,
      ),
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
      decoded = jwt.verify(
        verificationToken,
        JWT_SECRET,
      ) as BookingVerificationPayload;
    } catch {
      throw new BadRequestError(
        'Verification session expired or invalid. Please submit your request again.',
      );
    }

    const computedHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (computedHash !== decoded.otpHash) {
      throw new BadRequestError(
        'Invalid verification code. Please check your email and try again.',
      );
    }

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
      throw new BadRequestError(
        'Invalid verification session. Please submit your booking again.',
      );
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
      {expiresIn: '10m'},
    );

    await this.emailProvider.sendEmail(
      decoded.bookingData.clientEmail,
      `Verify Your DJ Booking Request (${otp}) - UpBeat Entertainment Africa`,
      EmailTemplates.getBookingVerificationOtpTemplate(
        decoded.bookingData.clientName,
        otp,
        stageName,
        decoded.bookingData.eventType,
      ),
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
    const tenant = await this.prisma.tenant.findUnique({where: {userId}});
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
      where: {id: data.tenantId},
      include: {user: true},
    });
    if (!tenant) {
      throw new NotFoundError('DJ profile not found');
    }

    let client = await this.prisma.client.findFirst({
      where: {email: data.clientEmail, tenantId: data.tenantId},
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

    const resolvedCurrency =
      tenant.currencyCode ||
      PaymentProviderResolver.resolveCurrencyFromCountry(tenant.country);
    const currencyCode = data.currencyCode || resolvedCurrency;

    const tzAbbrToIana: Record<string, string> = {
      EAT: 'Africa/Nairobi',
      WAT: 'Africa/Lagos',
      SAST: 'Africa/Johannesburg',
      GMT: 'GMT',
      UTC: 'UTC',
    };
    const rawTimezone =
      data.eventTimezone || tenant.timezone || 'Africa/Nairobi';
    const eventTimezone =
      tzAbbrToIana[rawTimezone.toUpperCase()] || rawTimezone;

    // Generate readable order reference: e.g. UB-9E2A8F1C
    const orderReference = `UB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const booking = await this.prisma.booking.create({
      data: {
        tenantId: data.tenantId,
        clientId: client.id,
        eventType: data.eventType,
        eventDetails: data.eventDetails
          ? {notes: data.eventDetails}
          : undefined,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        eventTimezone,
        currencyCode,
        address: data.address,
        status: BookingStatus.PENDING,
        orderReference,
        directPaymentStatus: DirectPaymentStatus.UNREPORTED,
      },
    });

    // Record initial audit event
    await this.prisma.bookingAuditEvent.create({
      data: {
        bookingId: booking.id,
        actorType: 'CLIENT',
        eventType: 'BOOKING_CREATED',
        metadata: {
          orderReference,
          eventType: data.eventType,
          eventDate: data.eventDate,
          address: data.address,
        },
      },
    });

    // Notify DJ
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
        const djTz = tenant.timezone || 'Africa/Nairobi';
        const clientTz = booking.eventTimezone || djTz;
        const djTimeDisplay = EmailTemplates.formatEventDateTimeWithZone(
          booking.eventDate,
          djTz,
        );
        const eventDateDisplay =
          clientTz !== djTz && booking.eventDate
            ? `${djTimeDisplay} • Client local: ${EmailTemplates.formatEventDateTimeWithZone(booking.eventDate, clientTz)}`
            : djTimeDisplay;

        this.emailProvider.sendEmail(
          tenant.user.email,
          'New Booking Request! 📅 - UpBeat Entertainment Africa',
          EmailTemplates.getNewBookingAlertTemplate(
            data.clientName,
            data.eventType,
            eventDateDisplay,
            djTz,
          ),
        );
      }
    }

    // Auto-reply email to Client
    const clientTz = booking.eventTimezone || 'Africa/Nairobi';
    const clientTimeDisplay = EmailTemplates.formatEventDateTimeWithZone(
      booking.eventDate,
      clientTz,
    );
    const orderRef =
      booking.orderReference || `UB-${booking.id.slice(0, 8).toUpperCase()}`;
    const clientPortalUrl = this.getClientPortalUrl(
      booking.id,
      orderRef,
      data.clientEmail,
    );

    this.emailProvider.sendEmail(
      data.clientEmail,
      'We received your booking request! - UpBeat Entertainment Africa',
      EmailTemplates.getBookingAutoReplyTemplate({
        clientName: data.clientName,
        djName: tenant.stageName || 'the DJ',
        eventType: data.eventType,
        eventDate: clientTimeDisplay,
        orderReference: orderRef,
        manageUrl: clientPortalUrl,
      }),
    );

    return booking;
  }

  // ==========================================
  // 2. Secure Booking Page Access Flow (Order Ref + Email OTP)
  // ==========================================

  async requestBookingAccessOtp(
    orderReference: string,
    clientEmailInput?: string,
  ) {
    const cleanRef = orderReference.trim();
    const isUuid = isValidUuid(cleanRef);

    // Look up booking by reference or ID with case-insensitivity
    const booking = await this.prisma.booking.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{id: cleanRef}] : []),
          {orderReference: cleanRef},
          {orderReference: cleanRef.toUpperCase()},
          {orderReference: {equals: cleanRef, mode: 'insensitive' as const}},
        ],
      },
      include: {client: true, tenant: true},
    });

    // Check if client email matches (if provided)
    const emailMatches =
      !clientEmailInput ||
      (booking?.client?.email &&
        booking.client.email.trim().toLowerCase() ===
          clientEmailInput.trim().toLowerCase());

    if (!booking) {
      this.logger.warn(
        `requestBookingAccessOtp: No booking found for ref ${cleanRef}`,
      );
    } else if (!booking.client?.email) {
      this.logger.warn(
        `requestBookingAccessOtp: Booking ${booking.id} has no client email`,
      );
    } else if (!emailMatches) {
      this.logger.warn(
        `requestBookingAccessOtp: Email mismatch. Input=${clientEmailInput}, DB=${booking.client.email}`,
      );
    }

    // Neutral response whether found or not to reduce booking enumeration (spec §4.1)
    if (!booking || !booking.client?.email || !emailMatches) {
      const dummySessionToken = jwt.sign(
        {dummy: true, ref: cleanRef},
        JWT_SECRET,
        {expiresIn: '10m'},
      );
      return {
        sessionToken: dummySessionToken,
        message:
          'If a booking exists for this reference code, a 6-digit access code has been sent to the associated email address.',
      };
    }

    const effectiveRef = booking.orderReference || cleanRef.toUpperCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Store in resilient multi-OTP cache (keyed by booking ID and order reference)
    const existing = this.accessOtpStore.get(booking.id);
    const hashes =
      existing && existing.expiresAt > Date.now()
        ? existing.otpHashes
        : new Set<string>();
    hashes.add(otpHash);
    const otpRecord = {
      otpHashes: hashes,
      clientEmail: booking.client.email,
      orderReference: effectiveRef,
      bookingId: booking.id,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    this.accessOtpStore.set(booking.id, otpRecord);
    this.accessOtpStore.set(effectiveRef.toUpperCase(), otpRecord);

    const sessionPayload: BookingAccessSessionPayload = {
      bookingId: booking.id,
      orderReference: effectiveRef,
      clientEmail: booking.client.email,
      otpHash,
    };

    const sessionToken = jwt.sign(sessionPayload, JWT_SECRET, {
      expiresIn: '10m',
    });

    // Send access OTP email
    await this.emailProvider.sendEmail(
      booking.client.email,
      `Your Booking Access Code (${otp}) - Ref: ${effectiveRef}`,
      EmailTemplates.getBookingAccessOtpTemplate(otp, effectiveRef),
    );

    return {
      sessionToken,
      message: 'A 6-digit access code has been sent to your email address.',
    };
  }

  async verifyBookingAccessOtp(sessionToken: string, otp: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(sessionToken, JWT_SECRET);
    } catch (err: any) {
      this.logger.warn('verifyBookingAccessOtp: JWT verification failed', {
        err,
      });
      throw new BadRequestError(
        'Access session has expired or is invalid. Please request a new access code.',
      );
    }

    if (decoded.dummy) {
      this.logger.warn(
        'verifyBookingAccessOtp: Attempted verification on dummy session token',
      );
      throw new BadRequestError(
        'No matching booking found for this reference code and email. Please check your details and try again.',
      );
    }

    const session = decoded as BookingAccessSessionPayload;
    const cleanOtp = String(otp || '')
      .trim()
      .replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      throw new BadRequestError('Verification code must be 6 digits.');
    }
    const computedHash = crypto
      .createHash('sha256')
      .update(cleanOtp)
      .digest('hex');

    // Check primary session hash first, then fall back to recent valid active hashes for this booking
    const cachedRecord =
      this.accessOtpStore.get(session.bookingId) ||
      this.accessOtpStore.get(session.orderReference.toUpperCase());
    const isCachedMatch =
      cachedRecord &&
      cachedRecord.expiresAt > Date.now() &&
      cachedRecord.otpHashes.has(computedHash);

    if (computedHash !== session.otpHash && !isCachedMatch) {
      this.logger.warn(
        `verifyBookingAccessOtp: Hash mismatch for booking ${session.bookingId}`,
      );
      throw new BadRequestError(
        'Incorrect passcode. Please check the latest 6-digit code sent to your email.',
      );
    }

    // Generate short-lived scoped booking access token (spec §4.1)
    const bookingAccessToken = generateBookingAccessToken({
      bookingId: session.bookingId,
      orderReference: session.orderReference,
      clientEmail: session.clientEmail,
      role: 'CLIENT',
    });

    return {
      bookingAccessToken,
      bookingId: session.bookingId,
      orderReference: session.orderReference,
    };
  }

  async resendBookingAccessOtp(sessionToken: string) {
    let decoded: any;
    try {
      decoded = jwt.decode(sessionToken);
      if (!decoded || decoded.dummy) {
        return {
          sessionToken,
          message: 'If a booking exists, a fresh code has been sent.',
        };
      }
    } catch {
      throw new BadRequestError('Invalid session. Please request a new code.');
    }

    const session = decoded as BookingAccessSessionPayload;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Store in resilient multi-OTP cache
    const existing = this.accessOtpStore.get(session.bookingId);
    const hashes =
      existing && existing.expiresAt > Date.now()
        ? existing.otpHashes
        : new Set<string>();
    hashes.add(otpHash);
    const otpRecord = {
      otpHashes: hashes,
      clientEmail: session.clientEmail,
      orderReference: session.orderReference,
      bookingId: session.bookingId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    this.accessOtpStore.set(session.bookingId, otpRecord);
    this.accessOtpStore.set(session.orderReference.toUpperCase(), otpRecord);

    const newSessionToken = jwt.sign(
      {
        bookingId: session.bookingId,
        orderReference: session.orderReference,
        clientEmail: session.clientEmail,
        otpHash,
      },
      JWT_SECRET,
      {expiresIn: '10m'},
    );

    await this.emailProvider.sendEmail(
      session.clientEmail,
      `Your Booking Access Code (${otp}) - Ref: ${session.orderReference}`,
      EmailTemplates.getBookingAccessOtpTemplate(otp, session.orderReference),
    );

    return {
      sessionToken: newSessionToken,
      message: 'A fresh verification code has been sent to your email.',
    };
  }

  // ==========================================
  // 3. Booking Details & Portal Operations
  // ==========================================

  async getBookingPortalDetails(
    idOrRef: string,
    actor?: {
      role: 'DJ' | 'CLIENT' | 'ADMIN';
      userId?: string;
      clientBookingId?: string;
    },
  ) {
    const isUuid = isValidUuid(idOrRef);

    const booking = await this.prisma.booking.findFirst({
      where: isUuid ? {id: idOrRef} : {orderReference: idOrRef.toUpperCase()},
      include: {
        client: true,
        tenant: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profileImg: true,
              },
            },
          },
        },
        quotes: {
          orderBy: {version: 'desc'},
        },
        agreement: true,
        messages: {
          orderBy: {createdAt: 'asc'},
        },
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking record not found');
    }

    // Authorization checks
    if (actor) {
      if (
        actor.role === 'CLIENT' &&
        actor.clientBookingId &&
        actor.clientBookingId !== booking.id
      ) {
        throw new AuthorizationError(
          'You do not have permission to view this booking.',
        );
      }
      if (actor.role === 'DJ' && actor.userId) {
        const tenant = await this.prisma.tenant.findUnique({
          where: {userId: actor.userId},
        });
        if (!tenant || tenant.id !== booking.tenantId) {
          throw new AuthorizationError(
            'You do not have permission to view this booking.',
          );
        }
      }
    }

    // Direct payment instructions are only exposed if status is ACCEPTED, CONFIRMED, IN_PROGRESS, or COMPLETED
    const canSeePaymentInstructions = (
      [
        BookingStatus.ACCEPTED,
        BookingStatus.AWAITING_PAYMENT,
        BookingStatus.CONFIRMED,
        BookingStatus.IN_PROGRESS,
        BookingStatus.COMPLETED,
      ] as BookingStatus[]
    ).includes(booking.status);

    const paymentInstructions = canSeePaymentInstructions
      ? booking.tenant?.directPaymentInstructions
      : null;

    return {
      ...booking,
      paymentInstructions,
    };
  }

  // DJ Dashboard: List all bookings
  async getMyBookings(userId: string, query: Record<string, unknown>) {
    const tenantId = await this.getTenantIdByUserId(userId);

    const bookingQuery = new QueryBuilder(this.prisma.booking, query)
      .search(['eventType', 'address'])
      .filter()
      .sort()
      .pagination()
      .fields();

    bookingQuery.prismaArgs.where = {
      ...bookingQuery.prismaArgs.where,
      tenantId,
    };

    bookingQuery.prismaArgs.include = {
      client: true,
      quotes: {orderBy: {version: 'desc'}, take: 1},
      agreement: true,
      review: true,
      _count: {
        select: {
          messages: true,
          quotes: true,
        },
      },
    };

    const bookings = await this.prisma.booking.findMany(
      bookingQuery.prismaArgs,
    );
    const meta = await bookingQuery.countTotal();

    return {
      bookings,
      meta,
    };
  }

  async getBookingById(userId: string | undefined, id: string) {
    if (!isValidUuid(id)) {
      throw new NotFoundError('Booking not found');
    }

    const where: any = {id};
    if (userId) {
      const tenant = await this.prisma.tenant.findUnique({where: {userId}});
      if (tenant) {
        where.tenantId = tenant.id;
      }
    }

    const booking = await this.prisma.booking.findFirst({
      where,
      include: {
        client: true,
        tenant: {
          include: {
            user: true,
          },
        },
        quotes: {
          orderBy: {version: 'desc'},
        },
        agreement: true,
        messages: {
          orderBy: {createdAt: 'asc'},
        },
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    return booking;
  }

  async updateBookingStatus(
    userId: string,
    id: string,
    data: UpdateBookingStatusDTO,
  ) {
    if (!isValidUuid(id)) {
      throw new NotFoundError('Booking not found');
    }
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: {id, tenantId},
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

  // ==========================================
  // 4. Asynchronous Messaging Thread
  // ==========================================

  async getBookingMessages(bookingId: string) {
    if (!isValidUuid(bookingId)) {
      throw new NotFoundError('Booking not found');
    }

    return this.prisma.bookingMessage.findMany({
      where: {bookingId},
      orderBy: {createdAt: 'asc'},
    });
  }

  async sendBookingMessage(
    bookingId: string,
    senderType: 'DJ' | 'CLIENT',
    senderId: string | null,
    content: string,
  ) {
    if (!isValidUuid(bookingId)) {
      throw new NotFoundError('Booking not found');
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestError('Message cannot be empty.');
    }
    if (trimmed.length > 2000) {
      throw new BadRequestError('Message cannot exceed 2000 characters.');
    }

    const booking = await this.prisma.booking.findUnique({
      where: {id: bookingId},
      include: {client: true, tenant: {include: {user: true}}},
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const message = await this.prisma.bookingMessage.create({
      data: {
        bookingId,
        senderType,
        senderId,
        content: trimmed,
      },
    });

    // Send email notification to other party without including sensitive content
    const djName =
      booking.tenant?.stageName || booking.tenant?.user?.firstName || 'DJ';
    const clientName = booking.client?.name || 'Client';
    const orderRef =
      booking.orderReference || `UB-${booking.id.slice(0, 8).toUpperCase()}`;
    const clientPortalUrl = this.getClientPortalUrl(
      booking.id,
      orderRef,
      booking.client?.email,
    );
    const dashboardUrl = `${config.clientUrl}/dashboard/bookings/${booking.id}`;

    if (senderType === 'CLIENT') {
      if (booking.tenant?.user?.email) {
        this.emailProvider.sendEmail(
          booking.tenant.user.email,
          `New Message from ${clientName} (Booking Ref: ${orderRef})`,
          EmailTemplates.getBookingNewMessageTemplate({
            recipientName: djName,
            senderName: clientName,
            eventType: booking.eventType || 'Event',
            orderReference: orderRef,
            portalUrl: dashboardUrl,
          }),
        );
      }
    } else {
      if (booking.client?.email) {
        this.emailProvider.sendEmail(
          booking.client.email,
          `New Message from ${djName} (Booking Ref: ${orderRef})`,
          EmailTemplates.getBookingNewMessageTemplate({
            recipientName: clientName,
            senderName: djName,
            eventType: booking.eventType || 'Event',
            orderReference: orderRef,
            portalUrl: clientPortalUrl,
          }),
        );
      }
    }

    return message;
  }

  // ==========================================
  // 5. Quote Negotiation & Explicit Agreement Snapshot
  // ==========================================

  async proposeQuote(
    bookingId: string,
    proposer: 'DJ' | 'CLIENT',
    proposerId: string | null,
    data: ProposeQuoteDTO,
  ) {
    if (!isValidUuid(bookingId)) {
      throw new NotFoundError('Booking not found');
    }

    const booking = await this.prisma.booking.findUnique({
      where: {id: bookingId},
      include: {client: true, tenant: {include: {user: true}}},
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REJECTED
    ) {
      throw new BadRequestError(
        'Cannot negotiate quotes for a completed or inactive booking.',
      );
    }

    const currency =
      data.currency ||
      booking.currencyCode ||
      booking.tenant?.currencyCode ||
      'KES';

    // Calculate next version
    const lastQuote = await this.prisma.bookingQuote.findFirst({
      where: {bookingId},
      orderBy: {version: 'desc'},
    });

    const nextVersion = (lastQuote?.version || 0) + 1;

    // Invalidate/supersede any pending quotes
    await this.prisma.bookingQuote.updateMany({
      where: {bookingId, status: 'PROPOSED'},
      data: {status: 'SUPERSEDED'},
    });

    const quote = await this.prisma.bookingQuote.create({
      data: {
        bookingId,
        version: nextVersion,
        amount: data.amount,
        currency,
        proposedBy: proposer,
        status: 'PROPOSED',
        notes: data.notes,
      },
    });

    // If booking was PENDING and DJ proposed, move to ACCEPTED
    if (booking.status === BookingStatus.PENDING && proposer === 'DJ') {
      await this.prisma.booking.update({
        where: {id: bookingId},
        data: {
          status: BookingStatus.ACCEPTED,
          totalAmount: data.amount,
          currencyCode: currency,
        },
      });
    }

    // Record in audit log
    await this.prisma.bookingAuditEvent.create({
      data: {
        bookingId,
        actorType: proposer,
        actorId: proposerId,
        eventType: 'QUOTE_PROPOSED',
        metadata: {
          quoteId: quote.id,
          version: nextVersion,
          amount: data.amount,
          currency,
          notes: data.notes,
        },
      },
    });

    // Notify other party
    const djName =
      booking.tenant?.stageName || booking.tenant?.user?.firstName || 'DJ';
    const clientName = booking.client?.name || 'Client';
    const orderRef =
      booking.orderReference || `UB-${booking.id.slice(0, 8).toUpperCase()}`;

    if (proposer === 'DJ' && booking.client?.email) {
      const clientPortalUrl = this.getClientPortalUrl(
        booking.id,
        orderRef,
        booking.client.email,
      );
      this.emailProvider.sendEmail(
        booking.client.email,
        `New Quote Proposed by ${djName} - Ref: ${orderRef}`,
        EmailTemplates.getQuoteProposedTemplate({
          recipientName: clientName,
          proposerName: djName,
          amount: data.amount,
          currency,
          notes: data.notes,
          orderReference: orderRef,
          portalUrl: clientPortalUrl,
        }),
      );
    } else if (proposer === 'CLIENT' && booking.tenant?.user?.email) {
      this.emailProvider.sendEmail(
        booking.tenant.user.email,
        `Counterproposal Received from ${clientName} - Ref: ${orderRef}`,
        EmailTemplates.getQuoteProposedTemplate({
          recipientName: djName,
          proposerName: clientName,
          amount: data.amount,
          currency,
          notes: data.notes,
          orderReference: orderRef,
          portalUrl: `${config.clientUrl}/dashboard/bookings/${booking.id}`,
        }),
      );
    }

    return quote;
  }

  async acceptQuote(
    bookingId: string,
    quoteId: string,
    actor: 'DJ' | 'CLIENT',
    actorId: string | null,
  ) {
    if (!isValidUuid(bookingId) || !isValidUuid(quoteId)) {
      throw new NotFoundError('Booking or quote not found');
    }

    const booking = await this.prisma.booking.findUnique({
      where: {id: bookingId},
      include: {client: true, tenant: {include: {user: true}}},
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const quote = await this.prisma.bookingQuote.findUnique({
      where: {id: quoteId},
    });

    if (!quote || quote.bookingId !== bookingId) {
      throw new NotFoundError('Quote not found for this booking');
    }

    if (quote.status !== 'PROPOSED') {
      throw new BadRequestError(
        `This quote is no longer available (status: ${quote.status}).`,
      );
    }

    // A party cannot accept their own proposal. Only the counterparty can accept.
    if (quote.proposedBy === actor) {
      throw new BadRequestError(
        'You cannot accept your own proposed quotation. Awaiting the counterparty to accept or propose a counteroffer.',
      );
    }

    const now = new Date();

    await this.prisma.bookingQuote.update({
      where: {id: quoteId},
      data: {
        status: 'ACCEPTED',
        acceptedAt: now,
      },
    });

    // Invalidate other quotes
    await this.prisma.bookingQuote.updateMany({
      where: {bookingId, id: {not: quoteId}, status: 'PROPOSED'},
      data: {status: 'SUPERSEDED'},
    });

    // Create or update immutable agreement snapshot
    const agreement = await this.prisma.bookingAgreement.upsert({
      where: {bookingId},
      update: {
        quoteId: quote.id,
        agreedAmount: quote.amount,
        currency: quote.currency,
        termsSnapshot: {
          eventType: booking.eventType,
          eventDate: booking.eventDate,
          eventTimezone: booking.eventTimezone,
          address: booking.address,
          acceptedQuoteVersion: quote.version,
          agreedAt: now.toISOString(),
        },
        acceptedByParty: actor,
        clientAcceptedAt: actor === 'CLIENT' ? now : undefined,
        djAcceptedAt: actor === 'DJ' ? now : undefined,
      },
      create: {
        bookingId,
        quoteId: quote.id,
        agreedAmount: quote.amount,
        currency: quote.currency,
        termsSnapshot: {
          eventType: booking.eventType,
          eventDate: booking.eventDate,
          eventTimezone: booking.eventTimezone,
          address: booking.address,
          acceptedQuoteVersion: quote.version,
          agreedAt: now.toISOString(),
        },
        acceptedByParty: actor,
        clientAcceptedAt: actor === 'CLIENT' ? now : null,
        djAcceptedAt: actor === 'DJ' ? now : null,
      },
    });

    // Transition booking to CONFIRMED
    await this.prisma.booking.update({
      where: {id: bookingId},
      data: {
        status: BookingStatus.CONFIRMED,
        totalAmount: quote.amount,
        currencyCode: quote.currency,
        confirmedAt: now,
      },
    });

    // Record in audit log
    await this.prisma.bookingAuditEvent.create({
      data: {
        bookingId,
        actorType: actor,
        actorId,
        eventType: 'QUOTE_ACCEPTED',
        metadata: {
          quoteId: quote.id,
          agreedAmount: Number(quote.amount),
          currency: quote.currency,
          version: quote.version,
        },
      },
    });

    // Send confirmation emails
    const djName =
      booking.tenant?.stageName || booking.tenant?.user?.firstName || 'DJ';
    const clientName = booking.client?.name || 'Client';
    const orderRef =
      booking.orderReference || `UB-${booking.id.slice(0, 8).toUpperCase()}`;

    const acceptedByName = actor === 'CLIENT' ? clientName : djName;

    if (booking.client?.email) {
      const clientPortalUrl = this.getClientPortalUrl(
        booking.id,
        orderRef,
        booking.client.email,
      );
      this.emailProvider.sendEmail(
        booking.client.email,
        `Agreement Confirmed! Booking Ref: ${orderRef}`,
        EmailTemplates.getQuoteAcceptedTemplate({
          recipientName: clientName,
          acceptedByName,
          amount: Number(quote.amount),
          currency: quote.currency,
          orderReference: orderRef,
          portalUrl: clientPortalUrl,
        }),
      );
    }

    if (booking.tenant?.user?.email) {
      this.emailProvider.sendEmail(
        booking.tenant.user.email,
        `Agreement Confirmed! Booking Ref: ${orderRef}`,
        EmailTemplates.getQuoteAcceptedTemplate({
          recipientName: djName,
          acceptedByName,
          amount: Number(quote.amount),
          currency: quote.currency,
          orderReference: orderRef,
          portalUrl: `${config.clientUrl}/dashboard/bookings/${booking.id}`,
        }),
      );
    }

    return agreement;
  }

  async rejectQuote(
    bookingId: string,
    quoteId: string,
    actor: 'DJ' | 'CLIENT',
    actorId: string | null,
    reason?: string,
  ) {
    if (!isValidUuid(bookingId) || !isValidUuid(quoteId)) {
      throw new NotFoundError('Booking or quote not found');
    }

    const quote = await this.prisma.bookingQuote.findUnique({
      where: {id: quoteId},
    });

    if (!quote || quote.bookingId !== bookingId) {
      throw new NotFoundError('Quote not found for this booking');
    }

    await this.prisma.bookingQuote.update({
      where: {id: quoteId},
      data: {status: 'REJECTED'},
    });

    await this.prisma.bookingAuditEvent.create({
      data: {
        bookingId,
        actorType: actor,
        actorId,
        eventType: 'QUOTE_REJECTED',
        metadata: {
          quoteId: quote.id,
          reason,
        },
      },
    });

    return {success: true, message: 'Quote rejected.'};
  }

  // ==========================================
  // 6. Direct Payment Reporting (Informational only!)
  // ==========================================

  async reportDirectPayment(bookingId: string, data: ReportDirectPaymentDTO) {
    if (!isValidUuid(bookingId)) {
      throw new NotFoundError('Booking not found');
    }

    const booking = await this.prisma.booking.findUnique({
      where: {id: bookingId},
      include: {tenant: {include: {user: true}}, client: true},
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const existingDetails =
      typeof booking.eventDetails === 'object' && booking.eventDetails !== null
        ? { ...(booking.eventDetails as Record<string, any>) }
        : {};

    const directPaymentReport = {
      method: data.method,
      reference: data.reference ? data.reference.trim() : undefined,
      notes: data.notes ? data.notes.trim() : undefined,
      reportedAt: new Date().toISOString(),
    };

    const updated = await this.prisma.booking.update({
      where: {id: bookingId},
      data: {
        directPaymentStatus: DirectPaymentStatus.CLIENT_REPORTED,
        eventDetails: {
          ...existingDetails,
          directPaymentReport,
        },
      },
    });

    await this.prisma.bookingAuditEvent.create({
      data: {
        bookingId,
        actorType: 'CLIENT',
        eventType: 'DIRECT_PAYMENT_REPORTED',
        metadata: {
          method: data.method,
          notes: data.notes,
        },
      },
    });

    // Notify DJ
    if (booking.tenant?.userId) {
      await this.prisma.notification.create({
        data: {
          userId: booking.tenant.userId,
          title: 'Direct Payment Reported',
          message: `${booking.client?.name || 'Client'} has reported that they sent direct payment via ${data.method}. Please verify and confirm when received.`,
          type: NotificationType.system,
          referenceId: booking.id,
        },
      });
    }

    return updated;
  }

  async confirmDirectPaymentReceived(bookingId: string, userId: string) {
    if (!isValidUuid(bookingId)) {
      throw new NotFoundError('Booking not found');
    }
    const tenantId = await this.getTenantIdByUserId(userId);

    const booking = await this.prisma.booking.findFirst({
      where: {id: bookingId, tenantId},
      include: {client: true, tenant: true},
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const existingDetails =
      typeof booking.eventDetails === 'object' && booking.eventDetails !== null
        ? { ...(booking.eventDetails as Record<string, any>) }
        : {};

    const updated = await this.prisma.booking.update({
      where: {id: bookingId},
      data: {
        directPaymentStatus: DirectPaymentStatus.DJ_CONFIRMED,
        eventDetails: {
          ...existingDetails,
          directPaymentConfirmedAt: new Date().toISOString(),
        },
      },
    });

    await this.prisma.bookingAuditEvent.create({
      data: {
        bookingId,
        actorType: 'DJ',
        actorId: userId,
        eventType: 'DIRECT_PAYMENT_CONFIRMED_BY_DJ',
        metadata: {
          confirmedAt: new Date().toISOString(),
        },
      },
    });

    return updated;
  }

  // ==========================================
  // 7. Event Completion, Issue Reporting & Reviews
  // ==========================================

  async requestCompletion(bookingId: string) {
    if (!isValidUuid(bookingId)) {
      throw new NotFoundError('Booking not found');
    }

    const booking = await this.prisma.booking.findUnique({
      where: {id: bookingId},
      include: {client: true, tenant: true},
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.eventDate && new Date(booking.eventDate).getTime() > Date.now()) {
      const dateStr = new Date(booking.eventDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      throw new BadRequestError(
        `Cannot request event completion before its scheduled date (${dateStr}). The event has not taken place yet.`
      );
    }

    const now = new Date();
    await this.prisma.booking.update({
      where: {id: bookingId},
      data: {completionRequestedAt: now},
    });

    await this.prisma.bookingAuditEvent.create({
      data: {
        bookingId,
        actorType: 'DJ',
        eventType: 'COMPLETION_REQUESTED',
        metadata: {requestedAt: now.toISOString()},
      },
    });

    if (booking.client?.email) {
      const orderRef =
        booking.orderReference || `UB-${booking.id.slice(0, 8).toUpperCase()}`;
      const clientPortalUrl = this.getClientPortalUrl(
        booking.id,
        orderRef,
        booking.client.email,
      );
      this.emailProvider.sendEmail(
        booking.client.email,
        `Please Confirm Event Completion - ${booking.tenant?.stageName || 'DJ'}`,
        EmailTemplates.getCompletionConfirmationRequestTemplate({
          clientName: booking.client.name || 'Client',
          djName: booking.tenant?.stageName || 'DJ',
          eventType: booking.eventType || 'Event',
          portalUrl: clientPortalUrl,
        }),
      );
    }

    return {success: true, message: 'Completion request sent to client.'};
  }

  async confirmCompletion(bookingId: string) {
    if (!isValidUuid(bookingId)) {
      throw new NotFoundError('Booking not found');
    }

    const booking = await this.prisma.booking.findUnique({
      where: {id: bookingId},
      include: {client: true, tenant: {include: {user: true}}},
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.eventDate && new Date(booking.eventDate).getTime() > Date.now()) {
      const dateStr = new Date(booking.eventDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      throw new BadRequestError(
        `Cannot mark event as completed before its scheduled date (${dateStr}). The event has not taken place yet.`
      );
    }

    const now = new Date();
    const existingDetails =
      typeof booking.eventDetails === 'object' && booking.eventDetails !== null
        ? { ...(booking.eventDetails as Record<string, any>) }
        : {};

    if (booking.status === BookingStatus.DISPUTED) {
      existingDetails.issueResolvedAt = now.toISOString();
      existingDetails.issueResolution = 'CONFIRMED_COMPLETED';
    }

    const updated = await this.prisma.booking.update({
      where: {id: bookingId},
      data: {
        status: BookingStatus.COMPLETED,
        completionConfirmedAt: now,
        completedAt: now,
        eventDetails: existingDetails,
      },
    });

    await this.prisma.bookingAuditEvent.create({
      data: {
        bookingId,
        actorType: 'CLIENT',
        eventType: 'COMPLETION_CONFIRMED',
        metadata: {confirmedAt: now.toISOString()},
      },
    });

    // Send review invitation
    if (booking.client?.email) {
      const orderRef =
        booking.orderReference || `UB-${booking.id.slice(0, 8).toUpperCase()}`;
      const clientPortalUrl = this.getClientPortalUrl(
        booking.id,
        orderRef,
        booking.client.email,
      );
      this.emailProvider.sendEmail(
        booking.client.email,
        `How was your event with ${booking.tenant?.stageName || 'DJ'}? - UpBeat Entertainment Africa`,
        EmailTemplates.getReviewRequestTemplate({
          clientName: booking.client.name || 'Client',
          djName: booking.tenant?.stageName || 'DJ',
          portalUrl: clientPortalUrl,
        }),
      );
    }

    return updated;
  }

  async reportIssue(bookingId: string, data: ReportIssueDTO) {
    if (!isValidUuid(bookingId)) {
      throw new NotFoundError('Booking not found');
    }

    const booking = await this.prisma.booking.findUnique({
      where: {id: bookingId},
      include: {client: true, tenant: {include: {user: true}}},
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const now = new Date();
    const updated = await this.prisma.booking.update({
      where: {id: bookingId},
      data: {
        status: BookingStatus.DISPUTED,
        issueReportedAt: now,
        issueDescription: data.description,
      },
    });

    await this.prisma.bookingAuditEvent.create({
      data: {
        bookingId,
        actorType: 'CLIENT',
        eventType: 'ISSUE_REPORTED',
        metadata: {
          description: data.description,
          reportedAt: now.toISOString(),
        },
      },
    });

    const djName =
      booking.tenant?.stageName || booking.tenant?.user?.firstName || 'DJ';
    const clientName = booking.client?.name || 'Client';
    const orderRef =
      booking.orderReference || `UB-${booking.id.slice(0, 8).toUpperCase()}`;

    // Notify DJ
    if (booking.tenant?.user?.email) {
      this.emailProvider.sendEmail(
        booking.tenant.user.email,
        `Issue Reported on Booking Ref: ${orderRef}`,
        EmailTemplates.getIssueReportedTemplate({
          recipientName: djName,
          reporterName: clientName,
          orderReference: orderRef,
          description: data.description,
          portalUrl: `${config.clientUrl}/dashboard/bookings/${booking.id}`,
        }),
      );
    }

    return updated;
  }

  async submitReview(bookingId: string, data: SubmitReviewDTO) {
    if (!isValidUuid(bookingId)) {
      throw new NotFoundError('Booking not found');
    }

    const booking = await this.prisma.booking.findUnique({
      where: {id: bookingId},
      include: {client: true, review: true},
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestError(
        'Reviews can only be submitted for completed events.',
      );
    }

    if (booking.review) {
      throw new BadRequestError(
        'You have already submitted a review for this booking.',
      );
    }

    const review = await this.prisma.bookingReview.create({
      data: {
        bookingId,
        tenantId: booking.tenantId,
        rating: data.rating,
        reviewText: data.reviewText,
        clientName: booking.client?.name || 'Verified Client',
      },
    });

    await this.prisma.bookingAuditEvent.create({
      data: {
        bookingId,
        actorType: 'CLIENT',
        eventType: 'REVIEW_SUBMITTED',
        metadata: {
          rating: data.rating,
        },
      },
    });

    return review;
  }

  // ==========================================
  // 8. DJ Schedule Query
  // ==========================================

  async getDjSchedule(
    userId: string,
    view:
      | 'all'
      | 'today'
      | 'tomorrow'
      | 'upcoming'
      | 'past'
      | 'needs_action' = 'all',
  ) {
    const tenantId = await this.getTenantIdByUserId(userId);

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfTomorrow = new Date(
      startOfToday.getTime() + 24 * 60 * 60 * 1000,
    );
    const startOfDayAfterTomorrow = new Date(
      startOfTomorrow.getTime() + 24 * 60 * 60 * 1000,
    );

    const includeRelations = {
      client: true,
      quotes: {orderBy: {version: 'desc' as const}, take: 1},
      agreement: true,
      review: true,
    };

    if (view === 'all') {
      const [today, tomorrow, upcoming, past, needsAction] = await Promise.all([
        this.prisma.booking.findMany({
          where: {
            tenantId,
            eventDate: {gte: startOfToday, lt: startOfTomorrow},
            status: {notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED]},
          },
          include: includeRelations,
          orderBy: {eventDate: 'asc'},
        }),
        this.prisma.booking.findMany({
          where: {
            tenantId,
            eventDate: {gte: startOfTomorrow, lt: startOfDayAfterTomorrow},
            status: {notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED]},
          },
          include: includeRelations,
          orderBy: {eventDate: 'asc'},
        }),
        this.prisma.booking.findMany({
          where: {
            tenantId,
            eventDate: {gte: startOfToday},
            status: {
              in: [
                BookingStatus.ACCEPTED,
                BookingStatus.AWAITING_PAYMENT,
                BookingStatus.CONFIRMED,
                BookingStatus.IN_PROGRESS,
              ],
            },
          },
          include: includeRelations,
          orderBy: {eventDate: 'asc'},
        }),
        this.prisma.booking.findMany({
          where: {
            tenantId,
            OR: [
              {status: BookingStatus.COMPLETED},
              {eventDate: {lt: startOfToday}},
            ],
            status: {notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED]},
          },
          include: includeRelations,
          orderBy: {eventDate: 'desc'},
          take: 50,
        }),
        this.prisma.booking.findMany({
          where: {
            tenantId,
            OR: [
              {status: BookingStatus.PENDING},
              {status: BookingStatus.DISPUTED},
              {directPaymentStatus: DirectPaymentStatus.CLIENT_REPORTED},
              {
                status: {in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS]},
                eventDate: {lt: now},
                completedAt: null,
              },
            ],
          },
          include: includeRelations,
          orderBy: {createdAt: 'desc'},
        }),
      ]);

      return {
        today,
        tomorrow,
        upcoming,
        past,
        needsAction,
      };
    }

    const baseWhere: any = {tenantId};

    if (view === 'today') {
      baseWhere.eventDate = {
        gte: startOfToday,
        lt: startOfTomorrow,
      };
    } else if (view === 'tomorrow') {
      baseWhere.eventDate = {
        gte: startOfTomorrow,
        lt: startOfDayAfterTomorrow,
      };
    } else if (view === 'upcoming') {
      baseWhere.eventDate = {
        gte: startOfToday,
      };
      baseWhere.status = {
        in: [
          BookingStatus.ACCEPTED,
          BookingStatus.AWAITING_PAYMENT,
          BookingStatus.CONFIRMED,
          BookingStatus.IN_PROGRESS,
        ],
      };
    } else if (view === 'past') {
      baseWhere.eventDate = {
        lt: startOfToday,
      };
    } else if (view === 'needs_action') {
      baseWhere.OR = [
        {status: BookingStatus.PENDING},
        {status: BookingStatus.DISPUTED},
        {directPaymentStatus: DirectPaymentStatus.CLIENT_REPORTED},
        {
          status: {in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS]},
          eventDate: {lt: now},
          completedAt: null,
        },
      ];
    }

    return this.prisma.booking.findMany({
      where: baseWhere,
      include: {
        client: true,
        quotes: {orderBy: {version: 'desc'}, take: 1},
        agreement: true,
        review: true,
      },
      orderBy: {eventDate: view === 'past' ? 'desc' : 'asc'},
    });
  }

  // ==========================================
  // 9. Legacy / Public Compatibility
  // ==========================================

  async getClientBooking(id: string) {
    return this.getBookingPortalDetails(id);
  }

  async clientCancelBooking(id: string, reason?: string) {
    if (!isValidUuid(id)) {
      throw new NotFoundError('Booking not found');
    }

    const booking = await this.prisma.booking.findUnique({where: {id}});
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REJECTED
    ) {
      throw new BadRequestError('Booking is already closed.');
    }

    await this.bookingStatusService.transition({
      bookingId: id,
      targetStatus: BookingStatus.CANCELLED,
      reason: reason || 'Cancelled by client',
      cancelledBy: 'CLIENT',
    });

    return {success: true, message: 'Booking cancelled successfully.'};
  }
}
