import { IPaymentProvider } from './IPaymentProvider';
import { StripePaymentProvider } from './StripePaymentProvider';
import { PaystackPaymentProvider } from './PaystackPaymentProvider';

export class PaymentProviderFactory {
  /**
   * Returns the appropriate payment provider based on the DJ's country.
   * Allows easy future extension for Pesapal, Flutterwave, etc.
   */
  static getProvider(countryCode?: string | null): IPaymentProvider {
    // Convert to uppercase for standard comparison if provided
    const country = countryCode?.toUpperCase();

    // Mapping countries to their respective payment gateways
    const paystackCountries = ['KE', 'KENYA', 'GH', 'GHANA', 'NG', 'NIGERIA', 'ZA', 'SOUTH AFRICA', 'CI', 'COTE D\'IVOIRE'];
    // const pesapalCountries = ['UGANDA', 'TANZANIA', 'MALAWI', 'ZAMBIA', 'ZIMBABWE', 'RWANDA'];

    if (country && paystackCountries.includes(country)) {
      return new PaystackPaymentProvider();
    }

    // Default to Stripe for global users
    return new StripePaymentProvider();
  }
}
