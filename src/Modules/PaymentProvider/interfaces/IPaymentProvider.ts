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
} from './payment.types';
import { PaymentGateway } from '@/prisma/generated/client';

export interface IPaymentProvider {
  readonly gateway: PaymentGateway;

  initializePayment(input: PaymentInitializationInput): Promise<PaymentInitializationResult>;

  verifyPayment(reference: string): Promise<PaymentVerificationResult>;

  createPayoutRecipient(input: PayoutRecipientInput): Promise<PayoutRecipientResult>;

  initiatePayout(input: PayoutInput): Promise<PayoutResult>;

  verifyPayout(transferReference: string): Promise<PayoutStatusResult>;

  handleWebhook(payload: any, signature: string, headers?: Record<string, any>): Promise<WebhookResult>;

  refundPayment?(reference: string, amount?: number): Promise<{ success: boolean; refundReference?: string; rawResponse?: any }>;
}
