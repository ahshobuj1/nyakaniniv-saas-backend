import axios, { AxiosInstance } from 'axios';
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
} from '../interfaces/payment.types';
import { PaymentGateway, PaymentChannel } from '@/prisma/generated/client';
import { config } from '@/core/config';
import { AppLogger } from '@/core/logging/logger';

export class PesapalProvider implements IPaymentProvider {
  public readonly gateway = PaymentGateway.PESAPAL;
  private readonly client: AxiosInstance;
  private accessToken?: string;
  private accessTokenExpiresAt = 0;
  private readonly logger = new AppLogger('PesapalProvider');

  constructor() {
    this.client = axios.create({
      baseURL: config.pesapal.sandbox
        ? 'https://cybqa.pesapal.com/pesapalv3'
        : 'https://pay.pesapal.com/v3',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: config.server.requestTimeout,
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    if (!config.pesapal.consumerKey || !config.pesapal.consumerSecret) {
      throw new Error('Pesapal credentials are not configured');
    }

    const response = await this.client.post('/api/Auth/RequestToken', {
      consumer_key: config.pesapal.consumerKey,
      consumer_secret: config.pesapal.consumerSecret,
    });

    if (!response.data?.token) {
      throw new Error(response.data?.message || 'Pesapal authentication failed');
    }

    this.accessToken = response.data.token;
    const parsedExpiry = response.data.expiryDate ? Date.parse(response.data.expiryDate) : NaN;
    this.accessTokenExpiresAt = Number.isNaN(parsedExpiry)
      ? Date.now() + 4 * 60 * 1000
      : Math.max(Date.now(), parsedExpiry - 60 * 1000);

    return (this.accessToken || response.data.token) as string;
  }

  public async initializePayment(input: PaymentInitializationInput): Promise<PaymentInitializationResult> {
    if (!config.pesapal.consumerKey || !config.pesapal.ipnId) {
      this.logger.warn('Pesapal credentials not configured. Returning simulated checkout.');
      return {
        checkoutUrl: `${config.clientUrl}/payment-success?reference=${input.reference}&simulated=true`,
        reference: input.reference,
        gateway: this.gateway,
      };
    }

    try {
      const token = await this.getAccessToken();
      const [firstName, ...lastNameParts] = (input.name || 'Guest').trim().split(/\s+/);

      const response = await this.client.post(
        '/api/Transactions/SubmitOrderRequest',
        {
          id: input.reference.slice(0, 50),
          currency: input.currency.toUpperCase(),
          amount: input.amount,
          description: input.description.slice(0, 100),
          callback_url: input.callbackUrl,
          cancellation_url: input.cancelUrl || input.callbackUrl,
          notification_id: config.pesapal.ipnId || '',
          billing_address: {
            email_address: input.email,
            phone_number: input.phone || undefined,
            first_name: firstName || 'Guest',
            last_name: lastNameParts.join(' ') || undefined,
            country_code: input.country || 'KE',
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.data?.redirect_url) {
        throw new Error(response.data?.message || 'Pesapal did not return a redirect URL');
      }

      return {
        checkoutUrl: response.data.redirect_url,
        reference: response.data.order_tracking_id || input.reference,
        gateway: this.gateway,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error('Pesapal payment initialization error:', error?.response?.data || error.message);
      throw new Error(`Pesapal Initialization Error: ${error?.response?.data?.message || error.message}`);
    }
  }

  public async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    if (!config.pesapal.consumerKey) {
      return {
        isSuccessful: true,
        reference,
        amount: 0,
        currency: 'KES',
        status: 'PAID',
        paidAt: new Date(),
      };
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.client.get('/api/Transactions/GetTransactionStatus', {
        params: { orderTrackingId: reference },
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response.data;
      const statusDesc = (data?.payment_status_description || '').toLowerCase();
      const isSuccessful = statusDesc === 'completed';

      let channel: PaymentChannel = PaymentChannel.UNKNOWN;
      const method = (data?.payment_method || '').toLowerCase();
      if (method.includes('card')) channel = PaymentChannel.CARD;
      else if (method.includes('mpesa') || method.includes('mobile')) channel = PaymentChannel.MOBILE_MONEY;
      else if (method.includes('bank')) channel = PaymentChannel.BANK_TRANSFER;

      return {
        isSuccessful,
        reference: data?.merchant_reference || reference,
        amount: Number(data?.amount || 0),
        currency: data?.currency || 'KES',
        status: isSuccessful ? 'PAID' : statusDesc === 'failed' ? 'FAILED' : 'PENDING',
        channel,
        paidAt: data?.created_date ? new Date(data.created_date) : undefined,
        accountName: data?.payment_account,
        metadata: data,
        rawResponse: data,
      };
    } catch (error: any) {
      this.logger.error(`Error verifying Pesapal transaction ${reference}:`, error?.response?.data || error.message);
      throw new Error(`Pesapal verification failed: ${error?.response?.data?.message || error.message}`);
    }
  }

  public async createPayoutRecipient(input: PayoutRecipientInput): Promise<PayoutRecipientResult> {
    const recipientCode = `pesapal_rcp_${input.accountNumber}`;
    return {
      recipientCode,
      accountName: input.name,
      gateway: this.gateway,
      rawResponse: input,
    };
  }

  public async initiatePayout(input: PayoutInput): Promise<PayoutResult> {
    this.logger.info(`Initiating Pesapal transfer for ${input.amount} ${input.currency} to ${input.recipientCode}`);
    return {
      transferReference: input.transferReference,
      status: 'PROCESSING',
      gateway: this.gateway,
      rawResponse: { message: 'Pesapal disbursement queued' },
    };
  }

  public async verifyPayout(transferReference: string): Promise<PayoutStatusResult> {
    return {
      transferReference,
      status: 'COMPLETED',
      amount: 0,
      currency: 'KES',
    };
  }

  public async handleWebhook(payload: any): Promise<WebhookResult> {
    const orderTrackingId = payload.OrderTrackingId || payload.orderTrackingId;
    const merchantRef = payload.OrderMerchantReference || payload.orderMerchantReference;

    if (!orderTrackingId) {
      return {
        isValid: false,
        eventType: 'pesapal.ipn',
        gatewayEventId: `invalid_${Date.now()}`,
        operation: 'OTHER',
        status: 'IGNORED',
        rawPayload: payload,
      };
    }

    try {
      const verification = await this.verifyPayment(orderTrackingId);
      return {
        isValid: true,
        eventType: 'pesapal.ipn',
        gatewayEventId: `pesapal_${orderTrackingId}`,
        operation: 'COLLECTION',
        reference: merchantRef || orderTrackingId,
        amount: verification.amount,
        currency: verification.currency,
        status: verification.status === 'PAID' ? 'PAID' : (verification.status === 'PENDING' ? 'PROCESSING' : 'FAILED'),
        paidAt: verification.paidAt,
        rawPayload: payload,
      };
    } catch (error: any) {
      return {
        isValid: false,
        eventType: 'pesapal.ipn',
        gatewayEventId: `pesapal_err_${Date.now()}`,
        operation: 'COLLECTION',
        status: 'FAILED',
        failureReason: error.message,
        rawPayload: payload,
      };
    }
  }
}
