import {IPaymentProvider} from './interfaces/IPaymentProvider';
import {PaymentOperation} from './interfaces/payment.types';
import {PaystackProvider} from './providers/PaystackProvider';
import {FlutterwaveProvider} from './providers/FlutterwaveProvider';
import {PesapalProvider} from './providers/PesapalProvider';
import {PaymentGateway} from '@/prisma/generated/client';
import {BadRequestError} from '@/core/errors/AppError';
import {AppLogger} from '@/core/logging/logger';

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
    collectionGateway: PaymentGateway.PAYSTACK,
    payoutGateway: PaymentGateway.FLUTTERWAVE,
    supportedGateways: [
      PaymentGateway.PAYSTACK,
      PaymentGateway.PESAPAL,
      PaymentGateway.FLUTTERWAVE,
    ],
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

  private static getProviderInstance(
    gateway: PaymentGateway,
  ): IPaymentProvider {
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

  public static resolveCurrencyFromCountry(country?: string | null): string {
    if (!country) return 'USD';
    const normalized = country.trim().toUpperCase();
    if (COUNTRY_ROUTING_MATRIX[normalized]?.defaultCurrency) {
      return COUNTRY_ROUTING_MATRIX[normalized].defaultCurrency;
    }

    const map: Record<string, string> = {
      // East Africa
      KE: 'KES',
      KENYA: 'KES',
      UG: 'UGX',
      UGANDA: 'UGX',
      TZ: 'TZS',
      TANZANIA: 'TZS',
      RW: 'RWF',
      RWANDA: 'RWF',
      BI: 'BIF',
      BURUNDI: 'BIF',
      ET: 'ETB',
      ETHIOPIA: 'ETB',
      SS: 'SSP',
      'SOUTH SUDAN': 'SSP',
      SO: 'SOS',
      SOMALIA: 'SOS',
      DJ: 'DJF',
      DJIBOUTI: 'DJF',
      ER: 'ERN',
      ERITREA: 'ERN',

      // West Africa
      NG: 'NGN',
      NIGERIA: 'NGN',
      GH: 'GHS',
      GHANA: 'GHS',
      SN: 'XOF',
      SENEGAL: 'XOF',
      CI: 'XOF',
      "COTE D'IVOIRE": 'XOF',
      'IVORY COAST': 'XOF',
      BF: 'XOF',
      'BURKINA FASO': 'XOF',
      ML: 'XOF',
      MALI: 'XOF',
      BJ: 'XOF',
      BENIN: 'XOF',
      TG: 'XOF',
      TOGO: 'XOF',
      NE: 'XOF',
      NIGER: 'XOF',
      GW: 'XOF',
      'GUINEA-BISSAU': 'XOF',
      GN: 'GNF',
      GUINEA: 'GNF',
      SL: 'SLE',
      'SIERRA LEONE': 'SLE',
      LR: 'LRD',
      LIBERIA: 'LRD',
      GM: 'GMD',
      GAMBIA: 'GMD',
      'THE GAMBIA': 'GMD',
      CV: 'CVE',
      'CAPE VERDE': 'CVE',
      'CABO VERDE': 'CVE',
      MR: 'MRU',
      MAURITANIA: 'MRU',

      // Southern Africa
      ZA: 'ZAR',
      'SOUTH AFRICA': 'ZAR',
      BW: 'BWP',
      BOTSWANA: 'BWP',
      NA: 'NAD',
      NAMIBIA: 'NAD',
      ZM: 'ZMW',
      ZAMBIA: 'ZMW',
      ZW: 'ZWL',
      ZIMBABWE: 'ZWL',
      MW: 'MWK',
      MALAWI: 'MWK',
      MZ: 'MZN',
      MOZAMBIQUE: 'MZN',
      AO: 'AOA',
      ANGOLA: 'AOA',
      LS: 'LSL',
      LESOTHO: 'LSL',
      SZ: 'SZL',
      ESWATINI: 'SZL',
      SWAZILAND: 'SZL',
      MG: 'MGA',
      MADAGASCAR: 'MGA',
      MU: 'MUR',
      MAURITIUS: 'MUR',
      SC: 'SCR',
      SEYCHELLES: 'SCR',
      KM: 'KMF',
      COMOROS: 'KMF',

      // Central Africa
      CM: 'XAF',
      CAMEROON: 'XAF',
      GA: 'XAF',
      GABON: 'XAF',
      CG: 'XAF',
      CONGO: 'XAF',
      'REPUBLIC OF THE CONGO': 'XAF',
      CD: 'CDF',
      'DEMOCRATIC REPUBLIC OF THE CONGO': 'CDF',
      'DR CONGO': 'CDF',
      TD: 'XAF',
      CHAD: 'XAF',
      CF: 'XAF',
      'CENTRAL AFRICAN REPUBLIC': 'XAF',
      GQ: 'XAF',
      'EQUATORIAL GUINEA': 'XAF',
      ST: 'STN',
      'SAO TOME AND PRINCIPE': 'STN',

      // North Africa
      EG: 'EGP',
      EGYPT: 'EGP',
      MA: 'MAD',
      MOROCCO: 'MAD',
      DZ: 'DZD',
      ALGERIA: 'DZD',
      TN: 'TND',
      TUNISIA: 'TND',
      LY: 'LYD',
      LIBYA: 'LYD',
      SD: 'SDG',
      SUDAN: 'SDG',

      // Global
      US: 'USD',
      USA: 'USD',
      'UNITED STATES': 'USD',
      GB: 'GBP',
      UK: 'GBP',
      'UNITED KINGDOM': 'GBP',
      CA: 'CAD',
      CANADA: 'CAD',
      AU: 'AUD',
      AUSTRALIA: 'AUD',
      AE: 'AED',
      UAE: 'AED',
      'UNITED ARAB EMIRATES': 'AED',
      SA: 'SAR',
      'SAUDI ARABIA': 'SAR',
      QA: 'QAR',
      QATAR: 'QAR',
      CH: 'CHF',
      SWITZERLAND: 'CHF',
      JP: 'JPY',
      JAPAN: 'JPY',
      IN: 'INR',
      INDIA: 'INR',
      BD: 'BDT',
      BANGLADESH: 'BDT',
      PK: 'PKR',
      PAKISTAN: 'PKR',
      SG: 'SGD',
      SINGAPORE: 'SGD',
      BR: 'BRL',
      BRAZIL: 'BRL',
      CN: 'CNY',
      CHINA: 'CNY',

      // Europe
      FR: 'EUR',
      FRANCE: 'EUR',
      DE: 'EUR',
      GERMANY: 'EUR',
      ES: 'EUR',
      SPAIN: 'EUR',
      IT: 'EUR',
      ITALY: 'EUR',
      NL: 'EUR',
      NETHERLANDS: 'EUR',
      EU: 'EUR',
      EUROPE: 'EUR',
    };

    return map[normalized] || 'USD';
  }

  public static resolve(params: {
    country?: string | null;
    operation: PaymentOperation;
    requestedGateway?: string | null;
  }): IPaymentProvider {
    // 1. If explicit gateway requested and supported
    if (params.requestedGateway) {
      const g = params.requestedGateway.trim().toUpperCase();
      if (g === 'PAYSTACK')
        return this.getProviderInstance(PaymentGateway.PAYSTACK);
      if (g === 'FLUTTERWAVE')
        return this.getProviderInstance(PaymentGateway.FLUTTERWAVE);
      if (g === 'PESAPAL')
        return this.getProviderInstance(PaymentGateway.PESAPAL);
    }

    const code = this.normalizeCountryCode(params.country);
    const config = COUNTRY_ROUTING_MATRIX[code];

    if (!config || !config.enabled) {
      this.logger.warn(
        `Country ${code} is currently disabled or unsupported. Defaulting to Paystack.`,
      );
      return this.getProviderInstance(PaymentGateway.PAYSTACK);
    }

    const gateway =
      params.operation === 'PAYOUT'
        ? config.payoutGateway
        : config.collectionGateway;
    return this.getProviderInstance(gateway);
  }

  public static getGatewayProvider(
    gateway: PaymentGateway | string,
  ): IPaymentProvider {
    const normalized =
      typeof gateway === 'string'
        ? (gateway.toUpperCase() as PaymentGateway)
        : gateway;
    return this.getProviderInstance(normalized);
  }

  public static getSupportedCountries(): CountryRoutingConfig[] {
    return Object.values(COUNTRY_ROUTING_MATRIX).filter((c) => c.enabled);
  }

  /**
   * Resolve provider directly from currency based on SUBSCRIPTION_CURRENCY_ROUTING config map.
   * For now: USD → Paystack, KES → Pesapal. Other currencies → Flutterwave when enabled.
   */
  public static resolveByCurrency(
    currency: string,
    requestedGateway?: string | null,
  ): IPaymentProvider {
    const code = currency.trim().toUpperCase();

    if (requestedGateway) {
      const g = requestedGateway.trim().toUpperCase();
      if (g === 'PAYSTACK')
        return this.getProviderInstance(PaymentGateway.PAYSTACK);
      if (g === 'FLUTTERWAVE')
        return this.getProviderInstance(PaymentGateway.FLUTTERWAVE);
      if (g === 'PESAPAL')
        return this.getProviderInstance(PaymentGateway.PESAPAL);
    }

    const gateway =
      SUBSCRIPTION_CURRENCY_ROUTING[code] || PaymentGateway.PAYSTACK;
    return this.getProviderInstance(gateway);
  }

  public static getGatewayForCurrency(currency: string): PaymentGateway {
    const code = currency.trim().toUpperCase();
    return SUBSCRIPTION_CURRENCY_ROUTING[code] || PaymentGateway.PAYSTACK;
  }
}

/**
 * Currency-to-Provider routing config map.
 * Business registered in Kenya: Paystack can only charge KES and USD.
 * For now: USD → Paystack, KES → Pesapal. Other currencies route to Flutterwave.
 */
export const SUBSCRIPTION_CURRENCY_ROUTING: Record<string, PaymentGateway> = {
  USD: PaymentGateway.PAYSTACK,
  KES: PaymentGateway.PAYSTACK,
  NGN: PaymentGateway.FLUTTERWAVE,
  GHS: PaymentGateway.FLUTTERWAVE,
  ZAR: PaymentGateway.FLUTTERWAVE,
  UGX: PaymentGateway.FLUTTERWAVE,
  TZS: PaymentGateway.PESAPAL,
  RWF: PaymentGateway.FLUTTERWAVE,
  XOF: PaymentGateway.FLUTTERWAVE,
  XAF: PaymentGateway.FLUTTERWAVE,
  ZMW: PaymentGateway.FLUTTERWAVE,
};
