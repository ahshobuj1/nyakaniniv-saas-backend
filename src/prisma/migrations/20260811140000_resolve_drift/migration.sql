-- AlterTable
ALTER TABLE "booking_payments" ADD COLUMN "account_name" VARCHAR(255),
ADD COLUMN "bank_name" VARCHAR(100),
ADD COLUMN "card_brand" VARCHAR(50),
ADD COLUMN "card_first6" VARCHAR(10),
ADD COLUMN "card_last4" VARCHAR(10);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "reference_id" VARCHAR(255);

-- AlterTable
ALTER TABLE "subscription_invoices" ADD COLUMN "account_name" VARCHAR(255),
ADD COLUMN "bank_name" VARCHAR(100),
ADD COLUMN "card_brand" VARCHAR(50),
ADD COLUMN "card_first6" VARCHAR(10),
ADD COLUMN "card_last4" VARCHAR(10);

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
