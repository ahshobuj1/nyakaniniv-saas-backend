/*
  Warnings:

  - You are about to drop the column `client_email` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `client_name` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `client_phone` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the `invoices` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('paid', 'unpaid');

-- CreateEnum
CREATE TYPE "BookingPaymentMethod" AS ENUM ('STRIPE', 'CASH');

-- CreateEnum
CREATE TYPE "BookingPaymentStatus" AS ENUM ('paid', 'unpaid');

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_user_id_fkey";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "client_email",
DROP COLUMN "client_name",
DROP COLUMN "client_phone",
ADD COLUMN     "client_id" UUID,
ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ALTER COLUMN "event_date" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "mix_tapes" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- DropTable
DROP TABLE "invoices";

-- DropEnum
DROP TYPE "InvoiceMethod";

-- DropEnum
DROP TYPE "InvoicePaymentStatus";

-- DropEnum
DROP TYPE "InvoiceType";

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "plan_id" INTEGER,
    "amount" DECIMAL(10,2),
    "status" "SubscriptionInvoiceStatus",
    "stripe_invoice_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "booking_id" UUID,
    "amount" DECIMAL(10,2),
    "method" "BookingPaymentMethod",
    "status" "BookingPaymentStatus",
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_payments_booking_id_key" ON "booking_payments"("booking_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
