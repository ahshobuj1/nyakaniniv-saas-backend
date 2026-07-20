import { IPaymentProvider } from './IPaymentProvider';
import { StripePaymentProvider } from './StripePaymentProvider';
import { PaystackPaymentProvider } from './PaystackPaymentProvider';

export class PaymentProviderFactory {
  /**
   * Returns the appropriate payment provider.
   * Defaults to Paystack since it has replaced Stripe.
   */
  static getProvider(countryCode?: string | null): IPaymentProvider {
    return new PaystackPaymentProvider();
  }
}
