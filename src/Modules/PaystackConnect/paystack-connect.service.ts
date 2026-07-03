import axios from 'axios';
import { PrismaClient } from '@/prisma/generated/client';

export class PaystackConnectService {
  constructor(private prisma: PrismaClient) { }

  public async createSubaccount(tenantId: string, bankCode: string, accountNumber: string, businessName: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user: true },
    });

    if (!tenant) throw new Error("Tenant not found");

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new Error("Paystack secret key is not configured.");

    let subaccountId = tenant.paystackSubaccountId;

    // Create a new Paystack Subaccount if they don't have one
    if (!subaccountId) {
      try {
        const response = await axios.post(
          'https://api.paystack.co/subaccount',
          {
            business_name: businessName,
            settlement_bank: bankCode,
            account_number: accountNumber,
            percentage_charge: 5, // Just for default, we override at checkout
          },
          {
            headers: {
              Authorization: `Bearer ${secretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        subaccountId = response.data.data.subaccount_code;

        // Save the subaccount ID to the tenant
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { paystackSubaccountId: subaccountId },
        });
      } catch (error: any) {
        console.error("Paystack Subaccount Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Failed to create Paystack subaccount");
      }
    }

    return {
      success: true,
      subaccountCode: subaccountId,
    };
  }

  public async checkAccountStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || !tenant.paystackSubaccountId) {
      return { isConnected: false };
    }

    // In a real scenario, you could verify the subaccount via Paystack API
    return {
      isConnected: true,
      subaccountCode: tenant.paystackSubaccountId
    };
  }
}
