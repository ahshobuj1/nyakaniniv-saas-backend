/**
 * UpBeat Africa - Financial Configuration Matrix
 * Implements country-by-country Payment & Transfer rules, platform fee, and dynamic gateway fee calculation.
 */

export interface CountryFinancialConfig {
  countryCode: string;
  countryName: string;
  currency: string;
  customerPaymentProvider: 'PAYSTACK' | 'PESAPAL' | 'FLUTTERWAVE';
  supportedPaymentMethods: Array<'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'USSD'>;
  djTransferProvider: 'PAYSTACK' | 'PESAPAL' | 'FLUTTERWAVE';
  supportedPayoutMethods: Array<'BANK_TRANSFER' | 'MOBILE_MONEY'>;
  defaultGatewayFeePercent: number;
  fixedGatewayFee: number;
  maxGatewayFeeCap?: number;
  transferFee: number;
}

export const PLATFORM_FEE_PERCENT = 2.0; // Fixed 2% platform fee

export const COUNTRY_FINANCIAL_MATRIX: Record<string, CountryFinancialConfig> = {
  KE: {
    countryCode: 'KE',
    countryName: 'Kenya',
    currency: 'KES',
    customerPaymentProvider: 'PESAPAL',
    supportedPaymentMethods: ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'],
    djTransferProvider: 'PESAPAL',
    supportedPayoutMethods: ['MOBILE_MONEY', 'BANK_TRANSFER'],
    defaultGatewayFeePercent: 3.5,
    fixedGatewayFee: 0,
    transferFee: 50, // Standard MPesa/B2C disbursement fee
  },
  NG: {
    countryCode: 'NG',
    countryName: 'Nigeria',
    currency: 'NGN',
    customerPaymentProvider: 'PAYSTACK',
    supportedPaymentMethods: ['CARD', 'BANK_TRANSFER', 'USSD'],
    djTransferProvider: 'PAYSTACK',
    supportedPayoutMethods: ['BANK_TRANSFER'],
    defaultGatewayFeePercent: 1.5,
    fixedGatewayFee: 100, // 100 NGN waived on transactions under 2500 NGN by Paystack
    maxGatewayFeeCap: 2000,
    transferFee: 50,
  },
  GH: {
    countryCode: 'GH',
    countryName: 'Ghana',
    currency: 'GHS',
    customerPaymentProvider: 'PAYSTACK',
    supportedPaymentMethods: ['MOBILE_MONEY', 'CARD'],
    djTransferProvider: 'PAYSTACK',
    supportedPayoutMethods: ['MOBILE_MONEY', 'BANK_TRANSFER'],
    defaultGatewayFeePercent: 1.95,
    fixedGatewayFee: 0,
    transferFee: 5,
  },
  ZA: {
    countryCode: 'ZA',
    countryName: 'South Africa',
    currency: 'ZAR',
    customerPaymentProvider: 'PAYSTACK',
    supportedPaymentMethods: ['CARD', 'BANK_TRANSFER'],
    djTransferProvider: 'PAYSTACK',
    supportedPayoutMethods: ['BANK_TRANSFER'],
    defaultGatewayFeePercent: 2.9,
    fixedGatewayFee: 1.0,
    transferFee: 10,
  },
  TZ: {
    countryCode: 'TZ',
    countryName: 'Tanzania',
    currency: 'TZS',
    customerPaymentProvider: 'PESAPAL',
    supportedPaymentMethods: ['MOBILE_MONEY'],
    djTransferProvider: 'PESAPAL',
    supportedPayoutMethods: ['MOBILE_MONEY'],
    defaultGatewayFeePercent: 3.5,
    fixedGatewayFee: 0,
    transferFee: 1000,
  },
  UG: {
    countryCode: 'UG',
    countryName: 'Uganda',
    currency: 'UGX',
    customerPaymentProvider: 'PESAPAL',
    supportedPaymentMethods: ['MOBILE_MONEY'],
    djTransferProvider: 'PESAPAL',
    supportedPayoutMethods: ['MOBILE_MONEY'],
    defaultGatewayFeePercent: 3.5,
    fixedGatewayFee: 0,
    transferFee: 1500,
  },
  RW: {
    countryCode: 'RW',
    countryName: 'Rwanda',
    currency: 'RWF',
    customerPaymentProvider: 'PESAPAL',
    supportedPaymentMethods: ['MOBILE_MONEY'],
    djTransferProvider: 'PESAPAL',
    supportedPayoutMethods: ['MOBILE_MONEY'],
    defaultGatewayFeePercent: 3.5,
    fixedGatewayFee: 0,
    transferFee: 500,
  },
};

/**
 * Resolves configuration for a given country code or name. Fallbacks to KE or NG.
 */
export function getCountryFinancialConfig(countryInput?: string | null): CountryFinancialConfig {
  if (!countryInput) {
    return COUNTRY_FINANCIAL_MATRIX.KE;
  }

  const normalized = countryInput.trim().toUpperCase();
  if (COUNTRY_FINANCIAL_MATRIX[normalized]) {
    return COUNTRY_FINANCIAL_MATRIX[normalized];
  }

  // Country name lookup
  const nameMap: Record<string, string> = {
    KENYA: 'KE',
    NIGERIA: 'NG',
    GHANA: 'GH',
    'SOUTH AFRICA': 'ZA',
    TANZANIA: 'TZ',
    UGANDA: 'UG',
    RWANDA: 'RW',
  };

  const matchedCode = nameMap[normalized];
  if (matchedCode && COUNTRY_FINANCIAL_MATRIX[matchedCode]) {
    return COUNTRY_FINANCIAL_MATRIX[matchedCode];
  }

  return COUNTRY_FINANCIAL_MATRIX.KE;
}

export interface FinancialBreakdown {
  grossAmount: number;
  platformFeePercent: number;
  platformFee: number;
  gatewayFee: number;
  djNetEarning: number;
  currency: string;
  isGatewayFeeEstimated: boolean;
}

/**
 * Calculate the exact financial split:
 * Gross Customer Payment
 * - Platform Fee (2%)
 * - Gateway Processing Fee (actual or country rule)
 * = DJ Net Earning
 */
export function calculateFinancialBreakdown(
  grossAmount: number,
  currency: string = 'KES',
  actualGatewayFee?: number | null,
  countryInput?: string | null
): FinancialBreakdown {
  const safeGross = Math.max(0, Number(grossAmount) || 0);
  const platformFee = Math.round(safeGross * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;

  let gatewayFee: number;
  let isGatewayFeeEstimated = false;

  if (actualGatewayFee !== undefined && actualGatewayFee !== null && !isNaN(actualGatewayFee)) {
    gatewayFee = Math.round(actualGatewayFee * 100) / 100;
  } else {
    isGatewayFeeEstimated = true;
    const config = getCountryFinancialConfig(countryInput);
    let estimatedFee = safeGross * (config.defaultGatewayFeePercent / 100);
    if (config.fixedGatewayFee && safeGross > 2500) {
      estimatedFee += config.fixedGatewayFee;
    }
    if (config.maxGatewayFeeCap && estimatedFee > config.maxGatewayFeeCap) {
      estimatedFee = config.maxGatewayFeeCap;
    }
    gatewayFee = Math.round(estimatedFee * 100) / 100;
  }

  const djNetEarning = Math.max(0, Math.round((safeGross - platformFee - gatewayFee) * 100) / 100);

  return {
    grossAmount: safeGross,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    platformFee,
    gatewayFee,
    djNetEarning,
    currency,
    isGatewayFeeEstimated,
  };
}
