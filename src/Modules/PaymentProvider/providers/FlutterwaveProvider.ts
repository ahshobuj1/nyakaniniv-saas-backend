import axios from 'axios';
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

export class FlutterwaveProvider implements IPaymentProvider {
  public readonly gateway = PaymentGateway.FLUTTERWAVE;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = 'https://api.flutterwave.com/v3';
  private readonly logger = new AppLogger('FlutterwaveProvider');

  constructor() {
    this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    this.webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET || '';
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  public async initializePayment(input: PaymentInitializationInput): Promise<PaymentInitializationResult> {
    if (!this.secretKey) {
      this.logger.warn('FLUTTERWAVE_SECRET_KEY not set. Using simulated checkout URL.');
      return {
        checkoutUrl: `${config.clientUrl}/payment-success?reference=${input.reference}&simulated=true`,
        reference: input.reference,
        gateway: this.gateway,
      };
    }

    try {
      const payload: Record<string, any> = {
        tx_ref: input.reference,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        redirect_url: input.callbackUrl,
        customer: {
          email: input.email,
          name: input.name || 'UpBeat Customer',
          phonenumber: input.phone || '',
        },
        customizations: {
          title: 'UpBeat Africa',
          description: input.description,
          logo: `${config.clientUrl}/icon.png`,
        },
        meta: {
          ...input.metadata,
          payment_type: input.paymentType,
        },
      };

      const response = await axios.post(`${this.baseUrl}/payments`, payload, {
        headers: this.headers,
      });

      if (response.data?.status !== 'success' || !response.data?.data?.link) {
        throw new Error(response.data?.message || 'Flutterwave payment initiation failed');
      }

      return {
        checkoutUrl: response.data.data.link,
        reference: input.reference,
        gateway: this.gateway,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error('Failed to initialize Flutterwave payment:', error?.response?.data || error.message);
      throw new Error(`Flutterwave Payment Initialization Error: ${error?.response?.data?.message || error.message}`);
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
      const currency = tx?.currency || tx?.invoice?.currencyCode || 'USD';
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
      const response = await axios.get(
        `${this.baseUrl}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
        { headers: this.headers }
      );

      const data = response.data?.data;
      if (response.data?.status !== 'success' || !data) {
        throw new Error(response.data?.message || 'Failed to verify transaction with Flutterwave');
      }

      const isSuccessful = data.status === 'successful';
      const currency = data.currency || 'KES';

      let channel: PaymentChannel = PaymentChannel.UNKNOWN;
      const paymentType = (data.payment_type || '').toLowerCase();
      if (paymentType.includes('card')) channel = PaymentChannel.CARD;
      else if (paymentType.includes('mobilemoney') || paymentType.includes('mpesa')) channel = PaymentChannel.MOBILE_MONEY;
      else if (paymentType.includes('account') || paymentType.includes('banktransfer')) channel = PaymentChannel.BANK_TRANSFER;
      else if (paymentType.includes('ussd')) channel = PaymentChannel.USSD;

      return {
        isSuccessful,
        reference: data.tx_ref || reference,
        amount: Number(data.amount || 0),
        currency,
        status: isSuccessful ? 'PAID' : data.status === 'failed' ? 'FAILED' : 'PENDING',
        channel,
        paidAt: data.created_at ? new Date(data.created_at) : undefined,
        gatewayFee: Number(data.app_fee || 0),
        cardBrand: data.card?.type,
        cardLast4: data.card?.last_4digits,
        accountName: data.customer?.name,
        metadata: data.meta,
        rawResponse: data,
      };
    } catch (error: any) {
      this.logger.error(`Error verifying Flutterwave transaction ${reference}:`, error?.response?.data || error.message);
      throw new Error(`Flutterwave verification failed: ${error?.response?.data?.message || error.message}`);
    }
  }

  public async createPayoutRecipient(input: PayoutRecipientInput): Promise<PayoutRecipientResult> {
    const recipientCode = `flw_rcp_${input.accountType}_${input.bankCode || 'momo'}_${input.accountNumber}`;
    return {
      recipientCode,
      accountName: input.name,
      gateway: this.gateway,
      rawResponse: { recipientCode, ...input },
    };
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
      let accountType = input.metadata?.accountType || 'bank';
      let bankCode = input.metadata?.bankCode || input.metadata?.network || '';
      let accountNumber = input.metadata?.accountNumber || '';

      if (input.recipientCode && input.recipientCode.startsWith('flw_rcp_')) {
        const parts = input.recipientCode.split('_');
        accountType = parts[2] || accountType;
        bankCode = parts[3] || bankCode;
        accountNumber = parts.slice(4).join('_') || accountNumber;
      } else if (!accountNumber && input.recipientCode) {
        accountNumber = input.recipientCode;
      }

      if (!bankCode && input.metadata?.bankName) {
        bankCode = input.metadata.bankName;
      }

      if (!accountNumber) {
        throw new Error('No account number or recipient identifier passed to Flutterwave transfer');
      }

      const beneficiaryName = input.metadata?.accountName || input.metadata?.beneficiary_name || 'UpBeat DJ';

      const payload: Record<string, any> = {
        account_bank: bankCode,
        account_number: accountNumber,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        beneficiary_name: beneficiaryName,
        narration: input.reason || 'UpBeat Africa DJ Withdrawal',
        reference: input.transferReference,
        callback_url: `${config.apiUrl}/webhooks/v1/flutterwave`,
      };

      if (accountType === 'mobile_money' || bankCode === 'MPS' || bankCode.toLowerCase().includes('mpesa') || bankCode.toLowerCase().includes('momo')) {
        payload.meta = {
          sender: 'UpBeat Africa',
          sender_country: input.metadata?.country || 'KE',
          mobile_number: accountNumber,
        };
      }

      // Automatically append _PMCK in Test mode so the webhook fires successfully!
      if (this.secretKey.includes('_TEST')) {
        payload.reference = `${payload.reference}_PMCK`;
      }

      const response = await axios.post(`${this.baseUrl}/transfers`, payload, {
        headers: this.headers,
      });

      const data = response.data?.data;
      if (response.data?.status !== 'success' || !data) {
        throw new Error(response.data?.message || 'Failed to initiate Flutterwave transfer');
      }

      let status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' = 'PROCESSING';
      if (data.status === 'SUCCESSFUL') status = 'COMPLETED';
      else if (data.status === 'FAILED') status = 'FAILED';
      else status = 'PROCESSING';

      return {
        transferReference: data.reference || input.transferReference,
        status,
        fee: Number(data.fee || 0),
        gateway: this.gateway,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error('Error initiating Flutterwave payout:', error?.response?.data || error.message);
      const specificError = error?.response?.data?.data?.complete_message || error?.response?.data?.message || error.message;
      throw new Error(`Flutterwave Payout Error: ${specificError}`);
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
      let data: any = null;
      try {
        const response = await axios.get(
          `${this.baseUrl}/transfers?reference=${encodeURIComponent(transferReference)}`,
          { headers: this.headers }
        );
        const items = response.data?.data;
        data = Array.isArray(items) && items.length > 0 ? items[0] : null;
      } catch {}

      if (!data && !transferReference.endsWith('_PMCK')) {
        try {
          const response = await axios.get(
            `${this.baseUrl}/transfers?reference=${encodeURIComponent(`${transferReference}_PMCK`)}`,
            { headers: this.headers }
          );
          const items = response.data?.data;
          data = Array.isArray(items) && items.length > 0 ? items[0] : null;
        } catch {}
      }

      if (!data) {
        throw new Error('Transfer record not found on Flutterwave');
      }

      let status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' = 'PROCESSING';
      if (data.status === 'SUCCESSFUL') status = 'COMPLETED';
      else if (data.status === 'FAILED') status = 'FAILED';

      return {
        transferReference: data.reference || transferReference,
        status,
        amount: Number(data.amount || 0),
        currency: data.currency || 'KES',
        failureReason: data.complete_message || (data.status === 'FAILED' ? 'Transfer failed' : undefined),
        completedAt: data.created_at ? new Date(data.created_at) : undefined,
        rawResponse: data,
      };
    } catch (error: any) {
      this.logger.error(`Error verifying Flutterwave transfer ${transferReference}:`, error?.response?.data || error.message);
      throw new Error(`Flutterwave payout verification failed: ${error?.response?.data?.message || error.message}`);
    }
  }

  public async handleWebhook(payload: any, signature: string, headers?: Record<string, any>): Promise<WebhookResult> {
    const configuredHash = this.webhookSecret;
    const providedHash = signature || headers?.['verif-hash'];

    if (configuredHash && providedHash !== configuredHash) {
      return {
        isValid: false,
        eventType: 'unknown',
        gatewayEventId: `invalid_${Date.now()}`,
        operation: 'OTHER',
        status: 'IGNORED',
        failureReason: 'Invalid Flutterwave verif-hash',
        rawPayload: payload,
      };
    }

    const event = payload.event || payload['event.type'];
    const data = payload.data || payload;
    const gatewayEventId = data?.id ? `flw_${data.id}` : `flw_evt_${data?.tx_ref || data?.txRef || Date.now()}`;

    // Collections (charge.completed or flat CARD_TRANSACTION)
    if (event === 'charge.completed' || event === 'CARD_TRANSACTION' || data.txRef) {
      const isSuccessful = data.status === 'successful';
      
      let channel: PaymentChannel = PaymentChannel.UNKNOWN;
      const rawType = (data.payment_type || event || '').toUpperCase();
      if (rawType.includes('CARD')) channel = PaymentChannel.CARD;
      else if (rawType.includes('MOBILE') || rawType.includes('MOM')) channel = PaymentChannel.MOBILE_MONEY;
      else if (rawType.includes('BANK') || rawType.includes('ACCOUNT')) channel = PaymentChannel.BANK_TRANSFER;
      else if (rawType.includes('USSD')) channel = PaymentChannel.USSD;

      return {
        isValid: true,
        eventType: event || 'charge.completed',
        gatewayEventId,
        operation: 'COLLECTION',
        reference: data.tx_ref || data.txRef,
        amount: Number(data.amount || 0),
        currency: data.currency || 'KES',
        status: isSuccessful ? 'PAID' : 'FAILED',
        paidAt: data.created_at || data.createdAt ? new Date(data.created_at || data.createdAt) : new Date(),
        gatewayFee: Number(data.app_fee || data.appfee || 0),
        metadata: data.meta || data.metadata,
        channel,
        rawPayload: payload,
      };
    }

    if (event === 'transfer.completed') {
      const isSuccessful = data.status === 'SUCCESSFUL';
      return {
        isValid: true,
        eventType: event,
        gatewayEventId,
        operation: 'PAYOUT',
        reference: data.reference,
        amount: Number(data.amount || 0),
        currency: data.currency || 'KES',
        status: isSuccessful ? 'PAID' : 'FAILED',
        failureReason: isSuccessful ? undefined : data.complete_message,
        paidAt: data.created_at ? new Date(data.created_at) : new Date(),
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

  /**
   * Flutterwave's refund endpoint needs the numeric transaction id, while we persist the
   * merchant `tx_ref`. Resolve the id via verify_by_reference (numeric input is used as-is).
   */
  private async resolveTransactionId(reference: string): Promise<string | null> {
    if (/^\d+$/.test(reference)) return reference;

    const response = await axios.get(
      `${this.baseUrl}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { headers: this.headers }
    );
    const id = response.data?.data?.id;
    return id ? String(id) : null;
  }

  public async refundPayment(reference: string, amount?: number, currency?: string): Promise<RefundResult> {
    try {
      const transactionId = await this.resolveTransactionId(reference);
      if (!transactionId) {
        return {
          success: false,
          outcome: 'FAILED',
          failureReason: 'Could not resolve the Flutterwave transaction id for this reference',
        };
      }

      const payload: any = {};
      if (amount) {
        payload.amount = amount;
      }

      const response = await axios.post(`${this.baseUrl}/transactions/${transactionId}/refund`, payload, { headers: this.headers });
      if (response.data?.status !== 'success') {
        return {
          success: false,
          outcome: 'FAILED',
          failureReason: response.data?.message || 'Flutterwave rejected the refund request',
          rawResponse: response.data,
        };
      }

      // Flutterwave refund states: completed | pending | failed
      const refundState = String(response.data?.data?.status || '').toLowerCase();
      const outcome = refundState === 'completed' ? 'COMPLETED' : refundState === 'failed' ? 'FAILED' : 'PENDING';

      return {
        success: outcome !== 'FAILED',
        outcome,
        refundReference: response.data?.data?.id?.toString() || undefined,
        failureReason: outcome === 'FAILED' ? 'Flutterwave reported the refund as failed' : undefined,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error('Flutterwave refund failed', error.response?.data || error.message);
      return {
        success: false,
        outcome: 'FAILED',
        failureReason: error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      };
    }
  }
}
