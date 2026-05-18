CREATE TYPE "user_role" AS ENUM (
  'SUPER_ADMIN',
  'DJ'
);

CREATE TYPE "subscription_status" AS ENUM (
  'active',
  'past_due',
  'canceled'
);

CREATE TYPE "event_status" AS ENUM (
  'upcoming',
  'completed',
  'canceled'
);

CREATE TYPE "booking_status" AS ENUM (
  'pending',
  'accepted',
  'completed'
);

CREATE TYPE "invoice_type" AS ENUM (
  'SUBSCRIPTION',
  'BOOKING'
);

CREATE TYPE "invoice_method" AS ENUM (
  'STRIPE',
  'CASH'
);

CREATE TYPE "invoice_payment_status" AS ENUM (
  'paid',
  'unpaid'
);

CREATE TYPE "ticket_status" AS ENUM (
  'open',
  'in_progress',
  'resolved'
);

CREATE TYPE "notification_type" AS ENUM (
  'booking_request',
  'payment',
  'system'
);
;

CREATE TYPE "booking_status" AS ENUM (
  'pending',
  'accepted',
  'completed'
);

CREATE TYPE "invoice_type" AS ENUM (
  'SUBSCRIPTION',
  'BOOKING'
);

CREATE TYPE "invoice_method" AS ENUM (
  'STRIPE',
  'CASH'
);

CREATE TYPE "invoice_payment_status" AS ENUM (
  'paid',
  'unpaid'
);

CREATE TYPE "ticket_status" AS ENUM (
  'open',
  'in_progress',
  'resolved'
);

CREATE TYPE "notification_type" AS ENUM (
  'booking_request',
  'payment',
  'system'
);

CREATE TABLE "users" (
    "id" UUID PRIMARY KEY,
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" user_role NOT NULL,
    "profile_img" VARCHAR(255),
    "is_verified" BOOLEAN DEFAULT false,
    "otp" VARCHAR(255),
    "otp_expiry" TIMESTAMP,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "themes" (
    "id" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "slug" VARCHAR(255),
    "preview_image_url" VARCHAR(255),
    "default_config" JSONB,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);

CREATE TABLE "tenants" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID UNIQUE,
    "subdomain" VARCHAR(255) UNIQUE,
    "stage_name" VARCHAR(255),
    "country" VARCHAR(255),
    "city" VARCHAR(255),
    "genres" JSONB,
    "theme_id" INTEGER,
    "logo_url" VARCHAR(255),
    "bio" Text,
    "timezone" VARCHAR(255),
    "is_active" BOOLEAN,
    "social_links" JSONB,
    "config" JSONB,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);

CREATE TABLE "subscription_plans" (
    "id" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "price_monthly" DECIMAL(10, 2),
    "price_annually" DECIMAL(10, 2),
    "stripe_monthly_price_id" VARCHAR(255),
    "stripe_annual_price_id" VARCHAR(255),
    "discount_percentage" INTEGER,
    "features" JSONB,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);

CREATE TABLE "subscriptions" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID,
    "plan_id" INTEGER,
    "stripe_sub_id" VARCHAR(255),
    "status" subscription_status,
    "period_end" TIMESTAMP,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);

CREATE TABLE "mix_tapes" (
    "id" UUID PRIMARY KEY,
    "tenant_id" UUID,
    "title" VARCHAR(255),
    "audio_url" VARCHAR(255),
    "cover_url" VARCHAR(255),
    "order" INTEGER,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);

CREATE TABLE "events" (
    "id" UUID PRIMARY KEY,
    "tenant_id" UUID,
    "title" VARCHAR(255),
    "description" Text,
    "event_date" DATE,
    "venue_name" VARCHAR(255),
    "venue_address" VARCHAR(255),
    "capacity" INTEGER,
    "price" DECIMAL(10, 2),
    "status" event_status,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);

CREATE TABLE "bookings" (
    "id" UUID PRIMARY KEY,
    "tenant_id" UUID,
    "client_name" VARCHAR(255),
    "client_email" VARCHAR(255),
    "event_type" VARCHAR(255),
    "event_details" Text,
    "status" booking_status,
    "total_amount" DECIMAL(10, 2),
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);

CREATE TABLE "invoices" (
    "id" UUID PRIMARY KEY,
    "tenant_id" UUID,
    "booking_id" UUID UNIQUE,
    "user_id" UUID,
    "amount" DECIMAL(10, 2),
    "type" invoice_type,
    "method" invoice_method,
    "status" invoice_payment_status,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);

CREATE TABLE "webhook_events" (
    "id" UUID PRIMARY KEY,
    "stripe_event_id" VARCHAR(255) UNIQUE NOT NULL,
    "type" VARCHAR(255),
    "status" VARCHAR(255),
    "created_at" TIMESTAMP
);

CREATE TABLE "audit_logs" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID,
    "action" VARCHAR(255),
    "metadata" JSONB,
    "ip_address" VARCHAR(255),
    "created_at" TIMESTAMP
);

CREATE TABLE "support_tickets" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID,
    "full_name" VARCHAR(255),
    "email" VARCHAR(255),
    "subject" VARCHAR(255),
    "issue" Text,
    "status" ticket_status,
    "created_at" TIMESTAMP
);

CREATE TABLE "notifications" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID,
    "title" VARCHAR(255),
    "message" Text,
    "type" notification_type,
    "is_read" BOOLEAN,
    "created_at" TIMESTAMP
);

CREATE TABLE "landing_page_heroes" (
    "id" INTEGER PRIMARY KEY,
    "title" VARCHAR(255),
    "description" Text,
    "image_url" VARCHAR(255),
    "is_active" BOOLEAN
);

CREATE TABLE "landing_page_steps" (
    "id" INTEGER PRIMARY KEY,
    "title" VARCHAR(255),
    "description" Text,
    "image_url" VARCHAR(255),
    "order" INTEGER
);

CREATE TABLE "landing_page_services" (
    "id" INTEGER PRIMARY KEY,
    "title" VARCHAR(255),
    "description" Text,
    "image_url" VARCHAR(255),
    "order" INTEGER
);

CREATE TABLE "landing_page_faqs" (
    "id" INTEGER PRIMARY KEY,
    "question" VARCHAR(255),
    "answer" Text,
    "order" INTEGER
);

CREATE TABLE "landing_page_marquees" (
    "id" INTEGER PRIMARY KEY,
    "image_url" VARCHAR(255),
    "order" INTEGER
);

ALTER TABLE "tenants"
ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tenants"
ADD FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mix_tapes"
ADD FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "events"
ADD FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bookings"
ADD FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "invoices"
ADD FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "subscriptions"
ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "subscriptions"
ADD FOREIGN KEY ("plan_id") REFERENCES "subscription_plans" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "invoices"
ADD FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "invoices"
ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_logs"
ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "support_tickets"
ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "notifications"
ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;