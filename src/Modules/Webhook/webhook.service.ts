import {
  PrismaClient,
  BookingStatus,
  NotificationType,
  InvoiceStatus,
  InvoiceType,
  PaymentGateway,
  PaymentChannel,
  TransactionStatus,
  SubscriptionStatus,
} from '@/prisma/generated/client';
import { BadRequestError } from '@/core/errors/AppError';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { InvoiceServices } from '../Invoice/invoice.service';
import { AppLogger } from '@/core/logging/logger';
import { PaymentProviderResolver } from '@/Modules/PaymentProvider/PaymentProviderResolver';
import { BookingStatusService } from '@/Modules/Booking/booking-status.service';

export class WebhookServices {
  private logger = new AppLogger('WebhookServices');
  private bookingStatusService: BookingStatusService;

  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) {
    this.bookingStatusService = new BookingStatusService(prisma, emailProvider);
  }

  /**
   * Universal idempotent webhook processor
   */
  private async processPaymentSuccess(params: {
    reference: string;
    gateway: PaymentGateway;
    gatewayEventId: string;
    amountPaid: number;
    currency: string;
    channel?: PaymentChannel;
    metadata?: any;
    paidAt?: Date;
    rawPayload: any;
  }) {
    // 1. Check idempotency in WebhookEvent
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { gatewayEventId: params.gatewayEventId },
    });

    if (existingEvent) {
      this.logger.info(`Webhook event ${params.gatewayEventId} already processed. Skipping.`);
      return { received: true, message: 'Already processed' };
    }

    // 2. Locate Transaction and Invoice
    let transaction = await this.prisma.transaction.findFirst({
      where: {
        OR: [
          { gatewayReference: params.reference },
          { idempotencyKey: params.reference },
          { id: params.reference },
        ],
      },
      include: { invoice: { include: { booking: { include: { client: true } } } } },
    });

    let invoice = transaction?.invoice;

    if (!invoice) {
      // Try to find invoice by reference prefix
      const cleanRef = params.reference.replace(/^bk_/, '').replace(/^sub_/, '').split('_')[0];
      invoice = await this.prisma.invoice.findFirst({
        where: {
          OR: [
            { id: cleanRef },
            { bookingId: cleanRef },
          ],
        },
        include: { booking: { include: { client: true } } },
      });
    }

    // Record webhook event to guarantee idempotency
    await this.prisma.webhookEvent.create({
      data: {
        gateway: params.gateway,
        gatewayEventId: params.gatewayEventId,
        type: 'charge.success',
        status: 'PROCESSED',
        payload: params.rawPayload,
      },
    });

    if (!invoice) {
      this.logger.warn(`No invoice found for reference ${params.reference}. Logged event for reconciliation.`);
      return { received: true, message: 'Invoice not found' };
    }

    const amountPaid = params.amountPaid || Number(invoice.amount);
    const currency = params.currency || invoice.currencyCode || 'KES';

    // 3. Atomic financial update: Invoice -> PAID, Transaction -> SUCCEEDED
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID },
      });

      if (transaction) {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.SUCCEEDED,
            channel: params.channel || transaction.channel || PaymentChannel.UNKNOWN,
            gatewayReference: params.reference,
            grossAmount: amountPaid,
            djNetEarning: amountPaid,
            remainingAmount: amountPaid,
          },
        });
      } else {
        transaction = await tx.transaction.create({
          data: {
            invoiceId: invoice.id,
            userId: invoice.userId,
            tenantId: invoice.tenantId,
            amount: amountPaid,
            currency,
            gateway: params.gateway,
            channel: params.channel || PaymentChannel.UNKNOWN,
            status: TransactionStatus.SUCCEEDED,
            gatewayReference: params.reference,
            idempotencyKey: params.reference,
            grossAmount: amountPaid,
            djNetEarning: amountPaid,
            remainingAmount: amountPaid,
            metadata: params.metadata,
          },
          include: { invoice: { include: { booking: { include: { client: true } } } } },
        });
      }

      // Handle Subscription activation
      if (invoice.type === InvoiceType.SUBSCRIPTION && invoice.userId && invoice.planId) {
        await tx.subscription.upsert({
          where: { id: invoice.id },
          update: {
            status: SubscriptionStatus.active,
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          create: {
            userId: invoice.userId,
            planId: invoice.planId,
            status: SubscriptionStatus.active,
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
    });

    // 4. Handle Booking Confirmation & Escrow Credit
    if (invoice.bookingId && invoice.type === InvoiceType.BOOKING) {
      try {
        // Transition booking to CONFIRMED (Spec: Never COMPLETED on payment!)
        await this.bookingStatusService.transition({
          bookingId: invoice.bookingId,
          targetStatus: BookingStatus.CONFIRMED,
          reason: `Payment verified via ${params.gateway}`,
        });

        // Credit Escrow in DJ Wallet
        if (invoice.tenantId) {
          const { WalletService } = await import('@/Modules/Wallet/wallet.service');
          const walletService = new WalletService(this.prisma);
          await walletService.creditBookingEscrow(
            invoice.tenantId,
            invoice.bookingId,
            amountPaid,
            currency,
            0,
            transaction?.id
          );
        }
      } catch (err: any) {
        this.logger.error(`Failed to transition booking #${invoice.bookingId} to CONFIRMED:`, err);
      }
    }

    return { received: true, success: true };
  }

  public async handlePaystackWebhook(signature: string, rawBody: Buffer | string | any) {
    const provider = PaymentProviderResolver.getGatewayProvider(PaymentGateway.PAYSTACK);
    const bodyObj = typeof rawBody === 'string' || Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString()) : rawBody;

    const webhookResult = await provider.handleWebhook(bodyObj, signature);

    if (!webhookResult.isValid) {
      this.logger.error(`Invalid Paystack webhook signature: ${webhookResult.failureReason}`);
      throw new BadRequestError(webhookResult.failureReason || 'Invalid webhook signature');
    }

    // Handle Transfer / Payout events
    if (webhookResult.operation === 'PAYOUT' && webhookResult.reference) {
      const { WalletService } = await import('@/Modules/Wallet/wallet.service');
      const walletService = new WalletService(this.prisma);

      const payout = await this.prisma.payoutRequest.findFirst({
        where: { transferReference: webhookResult.reference },
      });

      if (payout) {
        if (webhookResult.status === 'PAID') {
          await walletService.handleTransferSuccess(payout.id);
        } else if (webhookResult.status === 'FAILED') {
          await walletService.handleTransferFailure(payout.id, webhookResult.failureReason || 'Transfer failed');
        }
      }
      return { received: true };
    }

    if (webhookResult.operation === 'COLLECTION' && webhookResult.reference) {
      return this.processPaymentSuccess({
        reference: webhookResult.reference,
        gateway: PaymentGateway.PAYSTACK,
        gatewayEventId: webhookResult.gatewayEventId,
        amountPaid: webhookResult.amount || 0,
        currency: webhookResult.currency || 'KES',
        paidAt: webhookResult.paidAt,
        metadata: webhookResult.metadata,
        rawPayload: bodyObj,
      });
    }

    return { received: true };
  }

  public async handleFlutterwaveWebhook(signature: string, rawBody: Buffer | string | any, headers?: any) {
    const provider = PaymentProviderResolver.getGatewayProvider(PaymentGateway.FLUTTERWAVE);
    const bodyObj = typeof rawBody === 'string' || Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString()) : rawBody;

    const webhookResult = await provider.handleWebhook(bodyObj, signature, headers);

    if (!webhookResult.isValid) {
      this.logger.error(`Invalid Flutterwave webhook hash: ${webhookResult.failureReason}`);
      throw new BadRequestError(webhookResult.failureReason || 'Invalid Flutterwave webhook signature');
    }

    if (webhookResult.operation === 'PAYOUT' && webhookResult.reference) {
      const { WalletService } = await import('@/Modules/Wallet/wallet.service');
      const walletService = new WalletService(this.prisma);

      const payout = await this.prisma.payoutRequest.findFirst({
        where: { transferReference: webhookResult.reference },
      });

      if (payout) {
        if (webhookResult.status === 'PAID') {
          await walletService.handleTransferSuccess(payout.id);
        } else if (webhookResult.status === 'FAILED') {
          await walletService.handleTransferFailure(payout.id, webhookResult.failureReason || 'Transfer failed');
        }
      }
      return { received: true };
    }

    if (webhookResult.operation === 'COLLECTION' && webhookResult.reference) {
      return this.processPaymentSuccess({
        reference: webhookResult.reference,
        gateway: PaymentGateway.FLUTTERWAVE,
        gatewayEventId: webhookResult.gatewayEventId,
        amountPaid: webhookResult.amount || 0,
        currency: webhookResult.currency || 'KES',
        paidAt: webhookResult.paidAt,
        metadata: webhookResult.metadata,
        rawPayload: bodyObj,
      });
    }

    return { received: true };
  }

  public async handlePesapalIPN(orderTrackingId: string, orderMerchantReference?: string) {
    this.logger.info(`Processing Pesapal IPN with orderTrackingId: ${orderTrackingId}`);
    const provider = PaymentProviderResolver.getGatewayProvider(PaymentGateway.PESAPAL);

    const verification = await provider.verifyPayment(orderTrackingId);
    const isCompleted = verification.status === 'PAID';

    if (!isCompleted) {
      this.logger.warn(`Pesapal payment not completed for ${orderTrackingId}. Status: ${verification.status}`);
      return { received: true, status: verification.status };
    }

    const reference = orderMerchantReference || verification.reference || orderTrackingId;

    return this.processPaymentSuccess({
      reference,
      gateway: PaymentGateway.PESAPAL,
      gatewayEventId: `pesapal_${orderTrackingId}`,
      amountPaid: verification.amount,
      currency: verification.currency,
      paidAt: verification.paidAt,
      metadata: verification.metadata,
      rawPayload: { orderTrackingId, orderMerchantReference, verification },
    });
  }
}
