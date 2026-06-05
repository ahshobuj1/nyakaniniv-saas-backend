-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "address" TEXT,
ADD COLUMN     "client_phone" VARCHAR(50),
ADD COLUMN     "event_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "active_plan_id" INTEGER,
ADD COLUMN     "stripe_account_id" VARCHAR(255),
ADD COLUMN     "subscription_status" "SubscriptionStatus";
