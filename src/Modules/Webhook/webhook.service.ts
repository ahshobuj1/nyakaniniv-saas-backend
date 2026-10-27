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
import { CancellationPolicyService } from '@/Modules/Booking/cancellation-policy.service';
import { WalletService } from '@/Modules/Wallet/wallet.service';
import { FxService } from '@/core/services/FxService';

/** Booking states that can no longer accept a payment. */
const DEAD_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.REJECTED];

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

    const isValidUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const transactionOrConditions: any[] = [
      { gatewayReference: params.reference },
      { idempotencyKey: params.reference },
    ];
    if (isValidUuid(params.reference)) {
      transactionOrConditions.push({ id: params.reference });
    }

    // 2. Locate Transaction and Invoice
    let transaction = await this.prisma.transaction.findFirst({
      where: {
        OR: transactionOrConditions,
      },
      include: { invoice: { include: { booking: { include: { client: true } } } } },
    });

    let invoice = transaction?.invoice;

    if (!invoice) {
      // Try to find invoice by reference prefix if it's a full UUID
      // Some gateways might drop the timestamp part, so we check if the cleanRef happens to be a valid UUID
      let cleanRef = params.reference.replace(/^bk_/, '').replace(/^sub_/, '').split('_')[0];
      
      // If the original reference contained the full UUID (e.g. bk_uuid_timestamp), extract it:
      const uuidMatch = params.reference.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (uuidMatch) {
        cleanRef = uuidMatch[0];
      }

      if (isValidUuid(cleanRef)) {
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

    const invoiceAmount = Number(invoice.amount);
    const invoiceCurrency = (invoice.currencyCode || 'KES').trim().toUpperCase();
    const paidAmount = params.amountPaid !== undefined && params.amountPaid !== null ? Number(params.amountPaid) : invoiceAmount;
    const paidCurrency = (params.currency || invoiceCurrency).trim().toUpperCase();

    // Requirement 4: Verify that the paid amount and currency match the invoice
    if (paidCurrency !== invoiceCurrency) {
      this.logger.error(
        `Payment verification failed: Currency mismatch for invoice ${invoice.id}. Expected ${invoiceCurrency}, received ${paidCurrency}`,
      );
      throw new BadRequestError(
        `Currency mismatch: Invoice is in ${invoiceCurrency} but payment was in ${paidCurrency}`,
      );
    }

    if (Math.abs(paidAmount - invoiceAmount) > 0.05) {
      this.logger.error(
        `Payment verification failed: Amount mismatch for invoice ${invoice.id}. Expected ${invoiceAmount}, received ${paidAmount}`,
      );
      throw new BadRequestError(
        `Amount mismatch: Invoice amount is ${invoiceAmount} but payment received was ${paidAmount}`,
      );
    }

    // Requirement 4: Set amountUsd and fxRate only once (idempotent permanent snapshot)
    let fxData: { amountUsd: number; fxRate: number } | null = null;
    if (!transaction || transaction.amountUsd === null || transaction.amountUsd === undefined) {
      fxData = FxService.calculateUsdAmount(paidAmount, paidCurrency);
    }

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
            grossAmount: paidAmount,
            djNetEarning: paidAmount,
            remainingAmount: paidAmount,
            ...(fxData ? { amountUsd: fxData.amountUsd, fxRate: fxData.fxRate } : {}),
          },
        });
      } else {
        transaction = await tx.transaction.create({
          data: {
            invoiceId: invoice.id,
            userId: invoice.userId,
            tenantId: invoice.tenantId,
            amount: paidAmount,
            currency: paidCurrency,
            gateway: params.gateway,
            channel: params.channel || PaymentChannel.UNKNOWN,
            status: TransactionStatus.SUCCEEDED,
            gatewayReference: params.reference,
            idempotencyKey: params.reference,
            grossAmount: paidAmount,
            djNetEarning: paidAmount,
            remainingAmount: paidAmount,
            amountUsd: fxData?.amountUsd,
            fxRate: fxData?.fxRate,
            metadata: params.metadata,
          },
          include: { invoice: { include: { booking: { include: { client: true } } } } },
        });
      }

      // Handle Subscription activation
      if (invoice.type === InvoiceType.SUBSCRIPTION && invoice.userId && invoice.planId) {
        // Dynamic period calculation based on billing cycle (annually: 365 days, monthly: 30 days)
        const txMeta = (transaction?.metadata as any) || (params.metadata as any) || {};
        const cycle = txMeta.billingCycle || 'monthly';
        const durationDays = cycle === 'annually' ? 365 : 30;
        const newPeriodEnd = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

        // Find existing active subscription to update, or create a new one
        const existingSub = await tx.subscription.findFirst({
          where: { userId: invoice.userId, status: SubscriptionStatus.active },
          orderBy: { createdAt: 'desc' },
        });

        if (existingSub) {
          await tx.subscription.update({
            where: { id: existingSub.id },
            data: {
              planId: invoice.planId,
              status: SubscriptionStatus.active,
              periodEnd: newPeriodEnd,
            },
          });
        } else {
          await tx.subscription.create({
            data: {
              userId: invoice.userId,
              planId: invoice.planId,
              status: SubscriptionStatus.active,
              periodEnd: newPeriodEnd,
            },
          });
        }

        // Atomically update Tenant activePlanId & subscriptionStatus inside the transaction
        if (invoice.tenantId) {
          await tx.tenant.update({
            where: { id: invoice.tenantId },
            data: {
              subscriptionStatus: SubscriptionStatus.active,
              activePlanId: invoice.planId,
            },
          });
        }
      }
    });

    // Booking payments are now arranged directly between client and DJ without platform escrow or gateway checkout.
    // Subscription payments continue to be processed above.
    return { received: true, success: true };
  }

  public async handlePaystackWebhook(signature: string, rawBody: Buffer | string | any) {
    const provider = PaymentProviderResolver.getGatewayProvider(PaymentGateway.PAYSTACK);
    const bodyObj = typeof rawBody === 'string' || Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString()) : rawBody;

    const webhookResult = await provider.handleWebhook(bodyObj, signature, undefined, rawBody);

    if (!webhookResult.isValid) {
      this.logger.error(`Invalid Paystack webhook signature: ${webhookResult.failureReason}`);
      throw new BadRequestError(webhookResult.failureReason || 'Invalid webhook signature');
    }

    // Handle Transfer / Payout events
    if (webhookResult.operation === 'PAYOUT' && webhookResult.reference) {
      const { WalletService } = require('@/Modules/Wallet/wallet.service');
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
        channel: webhookResult.channel,
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

      const cleanRef = webhookResult.reference.replace(/_PMCK$/, '');
      const payout = await this.prisma.payoutRequest.findFirst({
        where: {
          OR: [
            { transferReference: webhookResult.reference },
            { transferReference: cleanRef },
          ],
        },
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
        channel: webhookResult.channel,
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
      channel: verification.channel,
      metadata: verification.metadata,
      rawPayload: { orderTrackingId, orderMerchantReference, verification },
    });
  }
}
