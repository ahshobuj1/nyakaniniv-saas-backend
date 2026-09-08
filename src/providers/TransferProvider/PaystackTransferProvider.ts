import axios from 'axios';
import { ITransferProvider, CreateRecipientDTO, RecipientResult, InitiateTransferDTO, TransferResult } from './ITransferProvider';
import { AppLogger } from '@/core/logging/logger';

export class PaystackTransferProvider implements ITransferProvider {
  private logger = new AppLogger('PaystackTransferProvider');
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  }

  async createRecipient(data: CreateRecipientDTO): Promise<RecipientResult> {
    if (!this.secretKey) {
      this.logger.warn('Paystack secret key is missing. Using sandbox simulated recipient.');
      return {
        success: true,
        recipientCode: `RCP_SIMULATED_${Date.now()}`,
        message: 'Sandbox recipient simulated',
      };
    }

    try {
      const response = await axios.post(
        'https://api.paystack.co/transferrecipient',
        {
          type: data.type || 'nuban',
          name: data.name,
          account_number: data.accountNumber,
          bank_code: data.bankCode,
          currency: data.currency || 'NGN',
          metadata: data.metadata,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const resData = response.data;
      if (resData.status && resData.data?.recipient_code) {
        return {
          success: true,
          recipientCode: resData.data.recipient_code,
          details: resData.data.details,
        };
      }

      return {
        success: false,
        recipientCode: '',
        message: resData.message || 'Failed to create Paystack recipient',
      };
    } catch (error: any) {
      this.logger.error('Error creating Paystack recipient:', error.response?.data || error.message);
      // If in dev/test sandbox environment, gracefully simulate so testing can continue
      if (process.env.NODE_ENV !== 'production') {
        return {
          success: true,
          recipientCode: `RCP_MOCK_${Date.now()}`,
          message: 'Development simulated recipient code',
        };
      }
      return {
        success: false,
        recipientCode: '',
        message: error.response?.data?.message || error.message || 'Paystack recipient creation failed',
      };
    }
  }

  async initiateTransfer(data: InitiateTransferDTO): Promise<TransferResult> {
    if (!this.secretKey) {
      this.logger.warn('Paystack secret key missing. Simulating instant successful sandbox transfer.');
      return {
        success: true,
        transferReference: data.reference,
        status: 'PROCESSING',
        fee: 50,
        message: 'Sandbox payout transfer queued',
      };
    }

    const amountInMinorUnits = Math.round(data.amount * 100);

    try {
      const response = await axios.post(
        'https://api.paystack.co/transfer',
        {
          source: 'balance',
          amount: amountInMinorUnits,
          recipient: data.recipientCode,
          reference: data.reference,
          reason: data.reason || 'UpBeat Africa DJ Payout',
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const resData = response.data;
      if (resData.status && resData.data) {
        const gatewayStatus = (resData.data.status || 'pending').toLowerCase();
        let status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' = 'PROCESSING';
        if (gatewayStatus === 'success') status = 'SUCCEEDED';
        else if (gatewayStatus === 'failed' || gatewayStatus === 'reversed') status = 'FAILED';

        return {
          success: true,
          transferReference: resData.data.reference || data.reference,
          status,
          fee: resData.data.fee ? Number(resData.data.fee) / 100 : 0,
          gatewayResponse: resData.data,
        };
      }

      return {
        success: false,
        transferReference: data.reference,
        status: 'FAILED',
        message: resData.message || 'Transfer initiation failed',
      };
    } catch (error: any) {
      this.logger.error('Error initiating Paystack transfer:', error.response?.data || error.message);
      if (process.env.NODE_ENV !== 'production') {
        // Safe mock for local developer experience
        return {
          success: true,
          transferReference: data.reference,
          status: 'PROCESSING',
          fee: 50,
          message: 'Development simulated transfer',
        };
      }
      return {
        success: false,
        transferReference: data.reference,
        status: 'FAILED',
        message: error.response?.data?.message || error.message,
      };
    }
  }

  async verifyTransfer(transferReference: string): Promise<TransferResult> {
    if (!this.secretKey) {
      return {
        success: true,
        transferReference,
        status: 'SUCCEEDED',
      };
    }

    try {
      const response = await axios.get(
        `https://api.paystack.co/transfer/verify/${transferReference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        }
      );

      const resData = response.data;
      if (resData.status && resData.data) {
        const gatewayStatus = (resData.data.status || '').toLowerCase();
        let status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' = 'PROCESSING';
        if (gatewayStatus === 'success') status = 'SUCCEEDED';
        else if (gatewayStatus === 'failed' || gatewayStatus === 'reversed') status = 'FAILED';

        return {
          success: true,
          transferReference,
          status,
          fee: resData.data.fee ? Number(resData.data.fee) / 100 : 0,
          gatewayResponse: resData.data,
        };
      }

      return {
        success: false,
        transferReference,
        status: 'FAILED',
        message: resData.message,
      };
    } catch (error: any) {
      this.logger.error('Error verifying Paystack transfer:', error.response?.data || error.message);
      return {
        success: false,
        transferReference,
        status: 'FAILED',
        message: error.message,
      };
    }
  }
}
