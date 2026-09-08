import axios, { AxiosInstance } from "axios";
import { Booking, Client, Tenant } from "@/prisma/generated/client";
import { config } from "@/core/config";
import { BadRequestError } from "@/core/errors/AppError";
import { IPaymentProvider } from "./IPaymentProvider";

type BookingWithCustomer = Booking & {
  tenant: Tenant | null;
  client?: Client | null;
};

type PesapalTokenResponse = {
  token?: string;
  expiryDate?: string;
  status?: string;
  message?: string;
};

type PesapalOrderResponse = {
  order_tracking_id?: string;
  merchant_reference?: string;
  redirect_url?: string;
  status?: string;
  message?: string;
};

export type PesapalTransactionStatus = {
  payment_method?: string;
  amount?: number;
  created_date?: string;
  confirmation_code?: string;
  payment_status_description?: string;
  description?: string;
  message?: string;
  payment_account?: string;
  call_back_url?: string;
  status_code?: number;
  merchant_reference?: string;
  currency?: string;
  error?: any;
  status?: string;
};

/**
 * Pesapal API 3 adapter.
 *
 * This class only owns provider communication. Booking state changes remain
 * server-side and will be performed after a verified IPN/status lookup.
 */
export class PesapalPaymentProvider implements IPaymentProvider {
  private readonly client: AxiosInstance;
  private accessToken?: string;
  private accessTokenExpiresAt = 0;

  constructor() {
    this.client = axios.create({
      baseURL: config.pesapal.sandbox
        ? "https://cybqa.pesapal.com/pesapalv3"
        : "https://pay.pesapal.com/v3",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: config.server.requestTimeout,
    });
  }

  async getPaymentLink(
    booking: BookingWithCustomer,
    paymentId: string,
  ): Promise<{ checkoutUrl: string }> {
    if (!booking.tenant) {
      throw new BadRequestError("DJ profile is required for Pesapal payment");
    }

    if (!booking.client?.email && !booking.client?.phone) {
      throw new BadRequestError("Customer email or phone is required for Pesapal payment");
    }

    if (!booking.totalAmount || Number(booking.totalAmount) <= 0) {
      throw new BadRequestError("A positive booking amount is required for Pesapal payment");
    }

    if (!config.pesapal.ipnId) {
      throw new BadRequestError("Pesapal IPN is not configured");
    }

    const token = await this.getAccessToken();
    const reference = this.createMerchantReference(paymentId);
    const [firstName, ...lastNameParts] = (booking.client?.name || "Guest Customer").trim().split(/\s+/);

    const callbackBaseUrl = booking.tenant.subdomain
      ? `https://${booking.tenant.subdomain}.deejay.africa`
      : config.clientUrl;

    const currencyToUse = (booking as any).currencyCode || process.env.PESAPAL_DEFAULT_CURRENCY || "KES";

    try {
      const response = await this.client.post<PesapalOrderResponse>(
        "/api/Transactions/SubmitOrderRequest",
        {
          id: reference,
          currency: currencyToUse,
          amount: Number(booking.totalAmount),
          description: `Booking for ${booking.tenant.stageName || "DJ"}`.slice(0, 100),
          callback_url: `${callbackBaseUrl}/payment-success?provider=pesapal`,
          cancellation_url: `${callbackBaseUrl}/payment-cancel?provider=pesapal`,
          notification_id: config.pesapal.ipnId,
          billing_address: {
            email_address: booking.client?.email || undefined,
            phone_number: booking.client?.phone || undefined,
            first_name: firstName || "Guest",
            last_name: lastNameParts.join(" ") || undefined,
            country_code: this.toCountryCode(booking.tenant.country),
            city: booking.tenant.city || undefined,
          },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.data.redirect_url || response.data.status !== "200") {
        throw new Error(response.data.message || "Pesapal did not return a checkout URL");
      }

      return { checkoutUrl: response.data.redirect_url };
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error
          ? error.message
          : "Unknown Pesapal checkout error";
      throw new BadRequestError(`Unable to initialize Pesapal payment: ${message}`);
    }
  }

  async createSubscriptionPayment(params: {
    reference: string;
    amount: number;
    currency: string;
    description: string;
    callbackUrl: string;
    cancellationUrl: string;
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    countryCode?: string;
    city?: string;
  }): Promise<{ checkoutUrl: string }> {
    if (!config.pesapal.ipnId) {
      throw new BadRequestError("Pesapal IPN is not configured");
    }

    const token = await this.getAccessToken();

    try {
      const response = await this.client.post<PesapalOrderResponse>(
        "/api/Transactions/SubmitOrderRequest",
        {
          id: params.reference.slice(0, 50),
          currency: params.currency,
          amount: params.amount,
          description: params.description.slice(0, 100),
          callback_url: params.callbackUrl,
          cancellation_url: params.cancellationUrl,
          notification_id: config.pesapal.ipnId,
          billing_address: {
            email_address: params.email,
            phone_number: params.phone || undefined,
            first_name: params.firstName || "Subscriber",
            last_name: params.lastName || undefined,
            country_code: this.toCountryCode(params.countryCode),
            city: params.city || undefined,
          },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.data.redirect_url || response.data.status !== "200") {
        throw new Error(response.data.message || "Pesapal did not return a checkout URL");
      }

      return { checkoutUrl: response.data.redirect_url };
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error
          ? error.message
          : "Unknown Pesapal checkout error";
      throw new BadRequestError(`Unable to initialize Pesapal subscription payment: ${message}`);
    }
  }

  /** Fetch the authoritative status after callback or IPN; callback parameters are never trusted. */
  async verifyTransaction(orderTrackingId: string): Promise<PesapalTransactionStatus> {
    const token = await this.getAccessToken();
    const response = await this.client.get<PesapalTransactionStatus>("/api/Transactions/GetTransactionStatus", {
      params: { orderTrackingId },
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    if (!config.pesapal.consumerKey || !config.pesapal.consumerSecret) {
      throw new BadRequestError("Pesapal credentials are not configured");
    }

    const response = await this.client.post<PesapalTokenResponse>("/api/Auth/RequestToken", {
      consumer_key: config.pesapal.consumerKey,
      consumer_secret: config.pesapal.consumerSecret,
    });

    if (!response.data.token) {
      throw new BadRequestError(response.data.message || "Pesapal authentication failed");
    }

    this.accessToken = response.data.token;
    // Pesapal access tokens are short-lived. Refresh one minute before expiry.
    const parsedExpiry = response.data.expiryDate ? Date.parse(response.data.expiryDate) : NaN;
    this.accessTokenExpiresAt = Number.isNaN(parsedExpiry)
      ? Date.now() + 4 * 60 * 1000
      : Math.max(Date.now(), parsedExpiry - 60 * 1000);

    return this.accessToken;
  }

  private createMerchantReference(paymentId: string): string {
    // Pesapal permits alphanumeric characters, dashes, underscores, dots and colons, max 50 chars.
    return `booking-${paymentId}`.slice(0, 50);
  }

  private toCountryCode(country?: string | null): string | undefined {
    const codes: Record<string, string> = {
      kenya: "KE",
      uganda: "UG",
      tanzania: "TZ",
      rwanda: "RW",
    };
    return country ? codes[country.trim().toLowerCase()] : undefined;
  }
}
