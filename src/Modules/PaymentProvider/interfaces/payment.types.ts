import { PaymentGateway, PaymentChannel } from '@/prisma/generated/client';

export type PaymentOperation = 'COLLECTION' | 'PAYOUT';

export interface PaymentInitializationInput {
  reference: string;
  amount: number;
  currency: string;
  email: string;
  name?: string;
  phone?: string;
  description: string;
  callbackUrl: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
  paymentType: 'BOOKING' | 'SUBSCRIPTION';
  country?: string;
  channels?: PaymentChannel[];
}

export interface PaymentInitializationResult {
  checkoutUrl: string;
  reference: string;
  gateway: PaymentGateway;
  rawResponse?: any;
}

export interface PaymentVerificationResult {
  isSuccessful: boolean;
  reference: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'FAILED' | 'PENDING';
  channel?: PaymentChannel;
  paidAt?: Date;
  gatewayFee?: number;
  cardBrand?: string;
  cardLast4?: string;
  bankName?: string;
  accountName?: string;
  metadata?: any;
  rawResponse?: any;
}

export interface PayoutRecipientInput {
  accountType: 'bank_account' | 'mobile_money';
  name: string;
  accountNumber: string;
  bankCode?: string;
  currency: string;
  country: string;
  metadata?: Record<string, any>;
}

export interface PayoutRecipientResult {
  recipientCode: string;
  accountName?: string;
  gateway: PaymentGateway;
  rawResponse?: any;
}

export interface PayoutInput {
  transferReference: string;
  amount: number;
  currency: string;
  recipientCode: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface PayoutResult {
  transferReference: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  fee?: number;
  gateway: PaymentGateway;
  rawResponse?: any;
}

export interface PayoutStatusResult {
  transferReference: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  amount: number;
  currency: string;
  failureReason?: string;
  completedAt?: Date;
  rawResponse?: any;
}

export interface WebhookResult {
  isValid: boolean;
  eventType: string;
  gatewayEventId: string;
  operation: 'COLLECTION' | 'PAYOUT' | 'OTHER';
  reference?: string;
  amount?: number;
  currency?: string;
  status: 'PAID' | 'FAILED' | 'PROCESSING' | 'IGNORED';
  failureReason?: string;
  paidAt?: Date;
  channel?: PaymentChannel;
  gatewayFee?: number;
  metadata?: any;
  rawPayload: any;
}
