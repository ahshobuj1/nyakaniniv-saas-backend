# 📝 Today's Architecture & Codebase Changes (Developer Guide)

This document outlines all the structural, database, and backend logic changes implemented today. The goal of this refactor was to separate subscription revenue from booking revenue, introduce a CRM for DJs (Clients), and implement soft deletes.

## 1. Database Schema Changes (`schema.prisma` & `PostgreSQL.sql`)

### 💥 Breaking Changes: The `Invoice` Model Was Deleted
The generic `Invoice` model was a bottleneck because it conflated DJ SaaS Subscriptions and DJ-to-Client Bookings. It has been replaced with two distinct models:

1. **`SubscriptionInvoice`**:
   - Tracks the DJ's payments to the SaaS platform.
   - Belongs to `User`.
   - Uses `SubscriptionInvoiceStatus` (`paid`, `unpaid`).
2. **`BookingPayment`**:
   - Tracks the Client's payments to the DJ for specific gigs/events.
   - Belongs to `Tenant` and `Booking`.
   - Uses `BookingPaymentMethod` (`STRIPE`, `CASH`) and `BookingPaymentStatus` (`paid`, `unpaid`).

### ✨ New Feature: Mini-CRM (`Client` Model)
Previously, the `Booking` model stored raw `clientName`, `clientEmail`, and `clientPhone` fields. This meant repeat customers had no unified profile. 
- Created a new **`Client`** model linked to `Tenant`.
- Removed `clientName`, `clientEmail`, and `clientPhone` from `Booking`.
- Added `clientId` as a foreign key on the `Booking` model.

### 🛡️ Data Safety: Soft Deletes
Added `deletedAt` (mapped to `deleted_at`) fields to:
- `Booking`
- `Event`
- `MixTape`

### 🌍 Bug Fix: Event Timezones
- Changed `Event.eventDate` from `@db.Date` to standard `DateTime` (which maps to `TIMESTAMP WITH TIME ZONE` in PostgreSQL) to accurately reflect gig times across different timezones.

---

## 2. API & Swagger Documentation Updates

- Updated `Api/API Documentation.md` to reflect the removal of the generic `/invoices/v1/` routes.
- Separated invoice endpoints into **Subscription Invoice Module** and **Booking Payment Module**.
- Added documentation for the new **Client Module** (`/clients/v1/`).
- Updated `booking.swagger.ts` and `invoice.swagger.ts` to reflect the new payloads (`clientId` in booking request) and split endpoint responsibilities.

---

## 3. TypeScript Backend Logic Fixes (`src/Modules`)

To ensure the backend compiles and functions correctly with the new Prisma models, several services were refactored:

### `BookingServices` (`booking.service.ts`)
- **Auto-Client Creation**: The `createBooking` endpoint still accepts the raw `clientName`, `clientEmail`, and `clientPhone` payload for public forms, but the service now automatically searches for an existing `Client` by email or creates a new one, passing the resulting `clientId` to the new `Booking`.
- **Payment Generation**: When a booking status is updated to `accepted`, the system now generates a `BookingPayment` (instead of an `Invoice`) and creates a Stripe checkout session with `invoiceId: payment.id` in the metadata.

### `InvoiceServices` (`invoice.service.ts`)
- The controller endpoints for `/invoices/v1/my-invoices` and `/invoices/v1/all` were preserved to prevent breaking frontend dashboards.
- The service now queries **both** `SubscriptionInvoice` and `BookingPayment` tables concurrently, standardizes the objects by injecting a `type: 'SUBSCRIPTION' | 'BOOKING'` field, sorts them chronologically, and sends back a unified payload. 

### `SubscriptionServices` (`subscription.service.ts`)
- Modified the mock and actual Stripe checkout logic to write directly to the new `SubscriptionInvoice` table rather than the deprecated `Invoice` model.

### `WebhookServices` (`webhook.service.ts`)
- Updated the Stripe `checkout.session.completed` handler.
- If `invoiceId` exists in the Stripe metadata, it now performs a transaction to update `BookingPayment` and `Booking` statuses.
- If it's a subscription checkout (has `planId` and `userId`), it generates a `SubscriptionInvoice`.

### `AnalyticsServices` (`analytics.service.ts`)
- **Admin Dashboards**: Revenue calculations now query the `SubscriptionInvoice` table.
- **Tenant (DJ) Dashboards**: Earnings calculations and charts now accurately query the `BookingPayment` table.

> **Note to Devs:** Run `bunx prisma generate` and `bunx tsc --noEmit` if you experience any lingering VSCode caching issues. The entire codebase is currently type-safe against the new schema.
