import { IPaymentProvider } from './interfaces/IPaymentProvider';
import { PaymentOperation } from './interfaces/payment.types';
import { PaystackProvider } from './providers/PaystackProvider';
import { FlutterwaveProvider } from './providers/FlutterwaveProvider';
import { PesapalProvider } from './providers/PesapalProvider';
import { PaymentGateway } from '@/prisma/generated/client';
import { BadRequestError } from '@/core/errors/AppError';
import { AppLogger } from '@/core/logging/logger';

export interface CountryRoutingConfig {
  countryCode: string;
  countryName: string;
  defaultCurrency: string;
  collectionGateway: PaymentGateway;
  payoutGateway: PaymentGateway;
  supportedGateways: PaymentGateway[];
  enabled: boolean;
}

export const COUNTRY_ROUTING_MATRIX: Record<string, CountryRoutingConfig> = {
  NG: {
    countryCode: 'NG',
    countryName: 'Nigeria',
    defaultCurrency: 'NGN',
    collectionGateway: PaymentGateway.PAYSTACK,
    payoutGateway: PaymentGateway.PAYSTACK,
    supportedGateways: [PaymentGateway.PAYSTACK, PaymentGateway.FLUTTERWAVE],
    enabled: true,
  },
  GH: {
    countryCode: 'GH',
    countryName: 'Ghana',
    defaultCurrency: 'GHS',
    collectionGateway: PaymentGateway.PAYSTACK,
    payoutGateway: PaymentGateway.PAYSTACK,
    supportedGateways: [PaymentGateway.PAYSTACK, PaymentGateway.FLUTTERWAVE],
    enabled: true,
  },
  KE: {
    countryCode: 'KE',
    countryName: 'Kenya',
    defaultCurrency: 'KES',
    collectionGateway: PaymentGateway.FLUTTERWAVE,
    payoutGateway: PaymentGateway.FLUTTERWAVE,
    supportedGateways: [PaymentGateway.FLUTTERWAVE, PaymentGateway.PAYSTACK, PaymentGateway.PESAPAL],
    enabled: true,
  },
  ZA: {
    countryCode: 'ZA',
    countryName: 'South Africa',
    defaultCurrency: 'ZAR',
    collectionGateway: PaymentGateway.PAYSTACK,
    payoutGateway: PaymentGateway.PAYSTACK,
    supportedGateways: [PaymentGateway.PAYSTACK, PaymentGateway.FLUTTERWAVE],
    enabled: true,
  },
  UG: {
    countryCode: 'UG',
    countryName: 'Uganda',
    defaultCurrency: 'UGX',
    collectionGateway: PaymentGateway.FLUTTERWAVE,
    payoutGateway: PaymentGateway.FLUTTERWAVE,
    supportedGateways: [PaymentGateway.FLUTTERWAVE, PaymentGateway.PESAPAL],
    enabled: true,
  },
  RW: {
    countryCode: 'RW',
    countryName: 'Rwanda',
    defaultCurrency: 'RWF',
    collectionGateway: PaymentGateway.FLUTTERWAVE,
    payoutGateway: PaymentGateway.FLUTTERWAVE,
    supportedGateways: [PaymentGateway.FLUTTERWAVE, PaymentGateway.PESAPAL],
    enabled: true,
  },
  TZ: {
    countryCode: 'TZ',
    countryName: 'Tanzania',
    defaultCurrency: 'TZS',
    collectionGateway: PaymentGateway.PESAPAL,
    payoutGateway: PaymentGateway.PESAPAL,
    supportedGateways: [PaymentGateway.PESAPAL, PaymentGateway.FLUTTERWAVE],
    enabled: true,
  },
};

export class PaymentProviderResolver {
  private static logger = new AppLogger('PaymentProviderResolver');
  private static providers: Map<PaymentGateway, IPaymentProvider> = new Map();

  private static getProviderInstance(gateway: PaymentGateway): IPaymentProvider {
    if (!this.providers.has(gateway)) {
      switch (gateway) {
        case PaymentGateway.PAYSTACK:
          this.providers.set(gateway, new PaystackProvider());
          break;
        case PaymentGateway.FLUTTERWAVE:
          this.providers.set(gateway, new FlutterwaveProvider());
          break;
        case PaymentGateway.PESAPAL:
          this.providers.set(gateway, new PesapalProvider());
          break;
        default:
          throw new BadRequestError(`Unsupported payment gateway: ${gateway}`);
      }
    }
    return this.providers.get(gateway)!;
  }

  public static normalizeCountryCode(country?: string | null): string {
    if (!country) return 'KE';
    const normalized = country.trim().toUpperCase();
    if (COUNTRY_ROUTING_MATRIX[normalized]) return normalized;

    const nameMap: Record<string, string> = {
      NIGERIA: 'NG',
      GHANA: 'GH',
      KENYA: 'KE',
      'SOUTH AFRICA': 'ZA',
      UGANDA: 'UG',
      RWANDA: 'RW',
      TANZANIA: 'TZ',
    };

    return nameMap[normalized] || 'KE';
  }

  public static resolve(params: {
    country?: string | null;
    operation: PaymentOperation;
    requestedGateway?: string | null;
  }): IPaymentProvider {
    // 1. If explicit gateway requested and supported
    if (params.requestedGateway) {
      const g = params.requestedGateway.trim().toUpperCase();
      if (g === 'PAYSTACK') return this.getProviderInstance(PaymentGateway.PAYSTACK);
      if (g === 'FLUTTERWAVE') return this.getProviderInstance(PaymentGateway.FLUTTERWAVE);
      if (g === 'PESAPAL') return this.getProviderInstance(PaymentGateway.PESAPAL);
    }

    const code = this.normalizeCountryCode(params.country);
    const config = COUNTRY_ROUTING_MATRIX[code];

    if (!config || !config.enabled) {
      this.logger.warn(`Country ${code} is currently disabled or unsupported. Defaulting to Paystack.`);
      return this.getProviderInstance(PaymentGateway.PAYSTACK);
    }

    const gateway = params.operation === 'PAYOUT' ? config.payoutGateway : config.collectionGateway;
    return this.getProviderInstance(gateway);
  }

  public static getGatewayProvider(gateway: PaymentGateway | string): IPaymentProvider {
    const normalized = typeof gateway === 'string' ? (gateway.toUpperCase() as PaymentGateway) : gateway;
    return this.getProviderInstance(normalized);
  }

  public static getSupportedCountries(): CountryRoutingConfig[] {
    return Object.values(COUNTRY_ROUTING_MATRIX).filter((c) => c.enabled);
  }
}
