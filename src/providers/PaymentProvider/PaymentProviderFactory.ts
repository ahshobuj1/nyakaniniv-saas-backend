import { PaymentProviderResolver } from '@/Modules/PaymentProvider/PaymentProviderResolver';
import { IPaymentProvider } from '@/Modules/PaymentProvider/interfaces/IPaymentProvider';
import { Booking } from '@/prisma/generated/client';

export class PaymentProviderFactory {
  /**
   * Resolve payment provider for processing customer payments.
   */
  static getProvider(
    target: (Booking & { tenant?: any | null }) | string | null | undefined,
    requestedGateway?: string | null,
  ): IPaymentProvider {
    let country: string | null | undefined;
    if (typeof target === 'string') {
      country = target;
    } else if (target && typeof target === 'object') {
      country = (target as any).tenant?.country || (target as any).country;
    }

    return PaymentProviderResolver.resolve({
      country,
      operation: 'COLLECTION',
      requestedGateway,
    });
  }
}
