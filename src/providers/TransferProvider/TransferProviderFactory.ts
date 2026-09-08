import { ITransferProvider } from './ITransferProvider';
import { PaystackTransferProvider } from './PaystackTransferProvider';
import { PesapalTransferProvider } from './PesapalTransferProvider';
import { getCountryFinancialConfig } from '@/core/config/financial-matrix.config';

export class TransferProviderFactory {
  private static paystackProvider = new PaystackTransferProvider();
  private static pesapalProvider = new PesapalTransferProvider();

  /**
   * Resolves transfer provider based on DJ's country or connected payout account gateway
   */
  public static getProvider(gatewayOrCountry?: string | null): ITransferProvider {
    if (!gatewayOrCountry) {
      return this.paystackProvider;
    }

    const upper = gatewayOrCountry.trim().toUpperCase();
    if (upper === 'PESAPAL') {
      return this.pesapalProvider;
    }
    if (upper === 'PAYSTACK') {
      return this.paystackProvider;
    }

    // Country based check
    const config = getCountryFinancialConfig(gatewayOrCountry);
    if (config.djTransferProvider === 'PESAPAL') {
      return this.pesapalProvider;
    }

    return this.paystackProvider;
  }
}
