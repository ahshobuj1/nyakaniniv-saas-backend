export interface CreateRecipientDTO {
  type: 'nuban' | 'mobile_money' | 'basa';
  name: string;
  accountNumber: string;
  bankCode?: string;
  currency: string;
  metadata?: Record<string, any>;
}

export interface RecipientResult {
  success: boolean;
  recipientCode: string;
  details?: Record<string, any>;
  message?: string;
}

export interface InitiateTransferDTO {
  amount: number;
  currency: string;
  recipientCode: string;
  reference: string;
  reason: string;
}

export interface TransferResult {
  success: boolean;
  transferReference: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  fee?: number;
  message?: string;
  gatewayResponse?: any;
}

export interface ITransferProvider {
  createRecipient(data: CreateRecipientDTO): Promise<RecipientResult>;
  initiateTransfer(data: InitiateTransferDTO): Promise<TransferResult>;
  verifyTransfer(transferReference: string): Promise<TransferResult>;
}
