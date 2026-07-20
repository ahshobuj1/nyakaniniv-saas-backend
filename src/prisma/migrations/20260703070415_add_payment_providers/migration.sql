-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingPaymentMethod" ADD VALUE 'PAYSTACK';
ALTER TYPE "BookingPaymentMethod" ADD VALUE 'PESAPAL';
ALTER TYPE "BookingPaymentMethod" ADD VALUE 'FLUTTERWAVE';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "flutterwave_subaccount_id" VARCHAR(255),
ADD COLUMN     "paystack_subaccount_id" VARCHAR(255),
ADD COLUMN     "pesapal_account_id" VARCHAR(255);

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
