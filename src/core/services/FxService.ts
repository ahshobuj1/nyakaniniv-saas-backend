import { AppLogger } from '@/core/logging/logger';

export class FxService {
  private static logger = new AppLogger('FxService');

  // Static fallback exchange rates (1 local unit = X USD)
  private static FALLBACK_RATES_TO_USD: Record<string, number> = {
    USD: 1.0,
    KES: 0.0077,   // ~130 KES = 1 USD
    NGN: 0.00067,  // ~1,500 NGN = 1 USD
    GHS: 0.065,    // ~15.4 GHS = 1 USD
    ZAR: 0.056,    // ~18 ZAR = 1 USD
    UGX: 0.00027,  // ~3,700 UGX = 1 USD
    TZS: 0.00038,  // ~2,600 TZS = 1 USD
    RWF: 0.00072,  // ~1,380 RWF = 1 USD
    XOF: 0.0016,   // ~625 XOF = 1 USD
    XAF: 0.0016,   // ~625 XAF = 1 USD
    ZMW: 0.037,    // ~27 ZMW = 1 USD
  };

  /**
   * Get the exchange rate to USD for a given currency code.
   * 1 unit of `currencyCode` = `return` units of USD.
   */
  public static getRateToUsd(currencyCode: string): number {
    const code = currencyCode.trim().toUpperCase();
    if (code === 'USD') return 1.0;

    const rate = this.FALLBACK_RATES_TO_USD[code];
    if (rate !== undefined) {
      return rate;
    }

    this.logger.warn(`No explicit FX rate found for currency ${code}, defaulting to 1.0`);
    return 1.0;
  }

  /**
   * Calculate the USD equivalent amount rounded to 2 decimal places.
   */
  public static calculateUsdAmount(amount: number, currencyCode: string): { amountUsd: number; fxRate: number } {
    const fxRate = this.getRateToUsd(currencyCode);
    const amountUsd = Math.round(Number(amount) * fxRate * 100) / 100;
    return { amountUsd, fxRate };
  }
}
