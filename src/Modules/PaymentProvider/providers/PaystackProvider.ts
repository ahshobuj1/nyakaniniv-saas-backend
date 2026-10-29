import axios from 'axios';
import crypto from 'crypto';
import { IPaymentProvider } from '../interfaces/IPaymentProvider';
import {
  PaymentInitializationInput,
  PaymentInitializationResult,
  PaymentVerificationResult,
  PayoutRecipientInput,
  PayoutRecipientResult,
  PayoutInput,
  PayoutResult,
  PayoutStatusResult,
  WebhookResult,
  RefundResult,
} from '../interfaces/payment.types';
import { PaymentGateway, PaymentChannel } from '@/prisma/generated/client';
import { config } from '@/core/config';
import { AppLogger } from '@/core/logging/logger';

export class PaystackProvider implements IPaymentProvider {
  public readonly gateway = PaymentGateway.PAYSTACK;
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly logger = new AppLogger('PaystackProvider');

  /** Currencies supported by this Paystack Kenya business account (no domiciliary USD). */
  private readonly SUPPORTED_CURRENCIES = new Set(['KES']);

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  private isZeroDecimalCurrency(currency: string): boolean {
    return ['UGX', 'RWF'].includes(currency.toUpperCase());
  }

  private toMinorUnit(amount: number, currency: string): number {
    if (this.isZeroDecimalCurrency(currency)) {
      return Math.round(amount);
    }
    return Math.round(amount * 100);
  }

  private fromMinorUnit(amount: number, currency: string): number {
    if (this.isZeroDecimalCurrency(currency)) {
      return amount;
    }
    return amount / 100;
  }

  public async initializePayment(input: PaymentInitializationInput): Promise<PaymentInitializationResult> {
    const currencyUpper = input.currency.trim().toUpperCase();

    // Guard: Paystack KE account only supports KES
    if (!this.SUPPORTED_CURRENCIES.has(currencyUpper)) {
      this.logger.error(
        `[PaystackProvider] Unsupported currency: ${currencyUpper}. ` +
        `Paystack Kenya supports: ${[...this.SUPPORTED_CURRENCIES].join(', ')}. ` +
        `Route ${currencyUpper} payments to Flutterwave or Pesapal.`,
      );
      throw new Error(
        `Paystack (Kenya account) does not support ${currencyUpper}. ` +
        `Please use Flutterwave for NGN/GHS/ZAR/UGX/RWF or Pesapal for TZS.`,
      );
    }

    if (!this.secretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY not set. Using simulated checkout URL.');
      return {
        checkoutUrl: `${config.clientUrl}/payment-success?reference=${input.reference}&simulated=true`,
        reference: input.reference,
        gateway: this.gateway,
      };
    }

    try {
      const payload: Record<string, any> = {
        reference: input.reference,
        amount: this.toMinorUnit(input.amount, input.currency),
        currency: input.currency.toUpperCase(),
        email: input.email,
        callback_url: input.callbackUrl,
        metadata: {
          ...input.metadata,
          custom_fields: [
            { display_name: 'Payment Type', variable_name: 'payment_type', value: input.paymentType },
            { display_name: 'Customer Name', variable_name: 'customer_name', value: input.name || 'Customer' },
          ],
        },
      };

      if (input.channels && input.channels.length > 0) {
        payload.channels = input.channels.map((c) => c.toLowerCase());
      }

      const response = await axios.post(`${this.baseUrl}/transaction/initialize`, payload, {
        headers: this.headers,
      });

      if (!response.data?.status || !response.data?.data?.authorization_url) {
        throw new Error(response.data?.message || 'Paystack initialization failed');
      }

      return {
        checkoutUrl: response.data.data.authorization_url,
        reference: response.data.data.reference || input.reference,
        gateway: this.gateway,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error('Failed to initialize Paystack payment:', error?.response?.data || error.message);
      throw new Error(`Paystack Payment Initialization Error: ${error?.response?.data?.message || error.message}`);
    }
  }
  public async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    if (!this.secretKey) {
      const { prisma } = await import('@/lib/prisma');
      const tx: any = await prisma.transaction.findFirst({
        where: {
          OR: [
            { gatewayReference: reference },
            { idempotencyKey: reference },
          ],
        },
        include: { invoice: true },
      });
      const currency = tx?.currency || tx?.invoice?.currencyCode || 'KES';
      const amount = tx ? Number(tx.amount) : tx?.invoice ? Number(tx.invoice.amount) : 0;

      return {
        isSuccessful: true,
        reference,
        amount,
        currency,
        status: 'PAID',
        paidAt: new Date(),
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: this.headers,
      });

      const data = response.data?.data;
      if (!response.data?.status || !data) {
        throw new Error(response.data?.message || 'Failed to verify transaction with Paystack');
      }

      const isSuccessful = data.status === 'success';
      const currency = data.currency || 'KES';
      const parsedAmount = this.fromMinorUnit(data.amount, currency);

      let channel: PaymentChannel = PaymentChannel.UNKNOWN;
      if (data.channel === 'card') channel = PaymentChannel.CARD;
      else if (data.channel === 'bank' || data.channel === 'bank_transfer') channel = PaymentChannel.BANK_TRANSFER;
      else if (data.channel === 'mobile_money') channel = PaymentChannel.MOBILE_MONEY;
      else if (data.channel === 'ussd') channel = PaymentChannel.USSD;

      return {
        isSuccessful,
        reference: data.reference,
        amount: parsedAmount,
        currency,
        status: isSuccessful ? 'PAID' : data.status === 'failed' ? 'FAILED' : 'PENDING',
        channel,
        paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
        gatewayFee: data.fees ? this.fromMinorUnit(data.fees, currency) : 0,
        cardBrand: data.authorization?.card_type,
        cardLast4: data.authorization?.last4,
        bankName: data.authorization?.bank,
        accountName: data.customer?.first_name ? `${data.customer.first_name} ${data.customer.last_name || ''}`.trim() : undefined,
        metadata: data.metadata,
        rawResponse: data,
      };
    } catch (error: any) {
      this.logger.error(`Error verifying Paystack transaction ${reference}:`, error?.response?.data || error.message);
      throw new Error(`Paystack verification failed: ${error?.response?.data?.message || error.message}`);
    }
  }

  public async createPayoutRecipient(input: PayoutRecipientInput): Promise<PayoutRecipientResult> {
    if (!this.secretKey) {
      return {
        recipientCode: `mock_rcp_${Date.now()}`,
        accountName: input.name,
        gateway: this.gateway,
      };
    }

    try {
      let recipientType = 'nuban';
      const isMobileMoney = input.accountType === 'mobile_money' || 
                           ['MPESA', 'MPPAYBILL', 'MPTILL', 'ATL_KE', 'MTN', 'VOD', 'TIGO', 'AIRTEL'].includes((input.bankCode || '').toUpperCase());

      if (isMobileMoney) {
        recipientType = 'mobile_money';
      } else if (input.country.toUpperCase() === 'ZA') {
        recipientType = 'basa';
      } else if (input.country.toUpperCase() === 'KE') {
        recipientType = 'kepss';
      } else if (input.country.toUpperCase() === 'GH') {
        recipientType = 'mobile_money'; // Ghana mostly uses mobile_money or ghipss
      }

      const payload = {
        type: recipientType,
        name: input.name,
        account_number: input.accountNumber,
        bank_code: input.bankCode || '',
        currency: input.currency.toUpperCase(),
        metadata: input.metadata,
      };

      const response = await axios.post(`${this.baseUrl}/transferrecipient`, payload, {
        headers: this.headers,
      });

      if (!response.data?.status || !response.data?.data?.recipient_code) {
        throw new Error(response.data?.message || 'Failed to create Paystack transfer recipient');
      }

      return {
        recipientCode: response.data.data.recipient_code,
        accountName: response.data.data.details?.account_name || input.name,
        gateway: this.gateway,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error('Error creating Paystack payout recipient:', error?.response?.data || error.message);
      throw new Error(`Paystack Recipient Creation Error: ${error?.response?.data?.message || error.message}`);
    }
  }

  public async initiatePayout(input: PayoutInput): Promise<PayoutResult> {
    if (!this.secretKey) {
      return {
        transferReference: input.transferReference,
        status: 'COMPLETED',
        gateway: this.gateway,
      };
    }

    try {
      const payload = {
        source: 'balance',
        amount: this.toMinorUnit(input.amount, input.currency),
        recipient: input.recipientCode,
        reference: input.transferReference,
        reason: input.reason || 'UpBeat Africa DJ Earnings Withdrawal',
      };

      const response = await axios.post(`${this.baseUrl}/transfer`, payload, {
        headers: this.headers,
      });

      const data = response.data?.data;
      if (!response.data?.status || !data) {
        throw new Error(response.data?.message || 'Failed to initiate Paystack transfer');
      }

      let status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' = 'PROCESSING';
      if (data.status === 'success') status = 'COMPLETED';
      else if (data.status === 'failed') status = 'FAILED';
      else if (data.status === 'pending' || data.status === 'processing' || data.status === 'otp') status = 'PROCESSING';

      return {
        transferReference: data.reference || input.transferReference,
        status,
        fee: data.fee ? this.fromMinorUnit(data.fee, input.currency) : 0,
        gateway: this.gateway,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error('Error initiating Paystack payout:', error?.response?.data || error.message);
      throw new Error(`Paystack Payout Error: ${error?.response?.data?.message || error.message}`);
    }
  }

  public async verifyPayout(transferReference: string): Promise<PayoutStatusResult> {
    if (!this.secretKey) {
      return {
        transferReference,
        status: 'COMPLETED',
        amount: 0,
        currency: 'KES',
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/transfer/verify/${encodeURIComponent(transferReference)}`, {
        headers: this.headers,
      });

      const data = response.data?.data;
      if (!response.data?.status || !data) {
        throw new Error(response.data?.message || 'Failed to verify transfer with Paystack');
      }

      let status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' = 'PROCESSING';
      if (data.status === 'success') status = 'COMPLETED';
      else if (data.status === 'failed' || data.status === 'reversed') status = 'FAILED';

      const currency = data.currency || 'KES';
      return {
        transferReference: data.reference || transferReference,
        status,
        amount: this.fromMinorUnit(data.amount || 0, currency),
        currency,
        failureReason: data.failures?.reason || (data.status === 'failed' ? 'Transfer failed at recipient bank' : undefined),
        completedAt: data.transferred_at ? new Date(data.transferred_at) : undefined,
        rawResponse: data,
      };
    } catch (error: any) {
      this.logger.error(`Error verifying Paystack transfer ${transferReference}:`, error?.response?.data || error.message);
      throw new Error(`Paystack payout verification failed: ${error?.response?.data?.message || error.message}`);
    }
  }

  public async handleWebhook(payload: any, signature: string, headers?: Record<string, any>, rawBody?: string | Buffer): Promise<WebhookResult> {
    if (this.secretKey && signature) {
      const dataToHash = rawBody ? (Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody) : JSON.stringify(payload);
      const hash = crypto.createHmac('sha512', this.secretKey).update(dataToHash).digest('hex');
      if (hash !== signature) {
        return {
          isValid: false,
          eventType: 'unknown',
          gatewayEventId: `invalid_${Date.now()}`,
          operation: 'OTHER',
          status: 'IGNORED',
          failureReason: 'Invalid Paystack HMAC-SHA512 signature',
          rawPayload: payload,
        };
      }
    }

    const event = payload.event;
    const data = payload.data;
    const gatewayEventId = payload.id ? String(payload.id) : `paystack_evt_${data?.reference || Date.now()}`;

    if (event === 'charge.success') {
      const currency = data.currency || 'KES';

      let channel: PaymentChannel = PaymentChannel.UNKNOWN;
      if (data.channel === 'card') channel = PaymentChannel.CARD;
      else if (data.channel === 'bank' || data.channel === 'bank_transfer') channel = PaymentChannel.BANK_TRANSFER;
      else if (data.channel === 'mobile_money') channel = PaymentChannel.MOBILE_MONEY;
      else if (data.channel === 'ussd') channel = PaymentChannel.USSD;

      return {
        isValid: true,
        eventType: event,
        gatewayEventId,
        operation: 'COLLECTION',
        reference: data.reference,
        amount: this.fromMinorUnit(data.amount, currency),
        currency,
        status: 'PAID',
        channel,
        paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
        gatewayFee: data.fees ? this.fromMinorUnit(data.fees, currency) : 0,
        metadata: data.metadata,
        rawPayload: payload,
      };
    }

    if (event === 'transfer.success') {
      const currency = data.currency || 'KES';
      return {
        isValid: true,
        eventType: event,
        gatewayEventId,
        operation: 'PAYOUT',
        reference: data.reference,
        amount: this.fromMinorUnit(data.amount, currency),
        currency,
        status: 'PAID',
        paidAt: data.transferred_at ? new Date(data.transferred_at) : new Date(),
        metadata: data,
        rawPayload: payload,
      };
    }

    if (event === 'transfer.failed' || event === 'transfer.reversed') {
      const currency = data.currency || 'KES';
      return {
        isValid: true,
        eventType: event,
        gatewayEventId,
        operation: 'PAYOUT',
        reference: data.reference,
        amount: this.fromMinorUnit(data.amount, currency),
        currency,
        status: 'FAILED',
        failureReason: data.reason || 'Transfer failed or reversed',
        metadata: data,
        rawPayload: payload,
      };
    }

    return {
      isValid: true,
      eventType: event || 'unhandled',
      gatewayEventId,
      operation: 'OTHER',
      status: 'IGNORED',
      rawPayload: payload,
    };
  }

  public async refundPayment(reference: string, amount?: number, currency?: string): Promise<RefundResult> {
    try {
      const payload: any = { transaction: reference };
      if (amount && currency) {
        payload.amount = this.toMinorUnit(amount, currency);
      } else if (amount) {
        payload.amount = Math.round(amount * 100); // naive conversion if currency missing
      }

      const response = await axios.post(`${this.baseUrl}/refund`, payload, { headers: this.headers });
      if (!response.data?.status) {
        return {
          success: false,
          outcome: 'FAILED',
          failureReason: response.data?.message || 'Paystack rejected the refund request',
          rawResponse: response.data,
        };
      }

      // Paystack refund states: pending | processing | processed | failed | needs-attention
      const refundState = String(response.data?.data?.status || '').toLowerCase();
      const outcome =
        refundState === 'processed'
          ? 'COMPLETED'
          : refundState === 'failed'
            ? 'FAILED'
            : 'PENDING';

      return {
        success: outcome !== 'FAILED',
        outcome,
        refundReference: response.data?.data?.transaction?.reference || undefined,
        failureReason: outcome === 'FAILED' ? 'Paystack reported the refund as failed' : undefined,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error('Paystack refund failed', error.response?.data || error.message);
      return {
        success: false,
        outcome: 'FAILED',
        failureReason: error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      };
    }
  }
}
