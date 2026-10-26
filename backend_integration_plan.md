# Multi-Currency Subscription & Billing Engine — Backend Implementation Plan

## Objective

Implement backend multi-currency subscription pricing, admin price management, transaction FX rate tracking, and multi-currency admin revenue analytics in `nyakaniniv-saas-backend` without grandfathering complexity.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │             DJ / Client Request              │
                      │  GET /subscriptions/v1/plans?currency=NGN    │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │             Subscription Service             │
                      │   Finds Plan + SubscriptionPlanPrice (NGN)   │
                      └──────────────────────┬───────────────────────┘
                                             │
                       POST /subscriptions/v1/subscribe (currency: NGN)
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │    Invoice Created (Amount: 7500, NGN)       │
                      │    PaymentProviderResolver (Paystack)        │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │         Webhook / Payment Verification       │
                      │    - Computes FX to USD (e.g., 0.00065)      │
                      │    - Records Transaction (amountUsd: $4.87)  │
                      │    - Activates Subscription                  │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │        Admin Analytics Engine                │
                      │    - Consolidated Revenue in USD             │
                      │    - Per-currency Filter (KES, NGN, USD)     │
                      └──────────────────────────────────────────────┘
```

---

## Planned Implementation Steps

### Step 1: Database Schema Extension & Prisma Migration

**Files to modify:**

- [`nyakaniniv-saas-backend/src/prisma/schema.prisma`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/prisma/schema.prisma)

**Changes:**

1. **`SubscriptionPlanPrice` model**:
   - `id`: UUID (Primary Key)
   - `planId`: Int (Foreign Key to `SubscriptionPlan`, `onDelete: Cascade`)
   - `currencyCode`: VarChar(10) (ISO code: `KES`, `NGN`, `GHS`, `USD`, `ZAR`)
   - `priceMonthly`: Decimal(12, 2)
   - `priceAnnually`: Decimal(12, 2)
   - `isActive`: Boolean (`default(true)`)
   - Composite unique index: `@@unique([planId, currencyCode])`
2. **`Currency` model**:
   - `code`: VarChar(10) (Primary Key, e.g. `USD`, `KES`, `NGN`, `GHS`, `ZAR`)
   - `name`: VarChar(50) (e.g. `Kenyan Shilling`)
   - `symbol`: VarChar(10) (e.g. `KSh`, `₦`, `$`)
   - `isEnabled`: Boolean (`default(true)`)
   - `sortOrder`: Int (`default(0)`)
3. **`Transaction` model update**:
   - `amountUsd`: Decimal(14, 2)? (Immutable USD equivalent snapshot at payment time)
   - `fxRate`: Decimal(18, 8)? (Exchange rate used: `currency -> USD`)
4. **Seed Update**:
   - [`src/prisma/seed.ts`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/prisma/seed.ts)
   - Seed default currencies (`KES`, `USD`, `NGN`, `GHS`, `ZAR`).
   - Seed `SubscriptionPlanPrice` for Starter, Pro, and Elite plans across `KES`, `USD`, `NGN`.

---

### Step 2: DTOs & Validation

**Files to modify:**

- [`nyakaniniv-saas-backend/src/Modules/Subscription/SubscriptionDTO.ts`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/Modules/Subscription/SubscriptionDTO.ts)

**Changes:**

1. Update `SubscribeDTO` to accept optional `currency?: string` (ISO code). If omitted, falls back to tenant country currency or `USD`.
2. Add `SetPlanPriceDTO` (for Admin):
   - `currencyCode`: string (3-10 chars uppercase)
   - `priceMonthly`: number (min 0)
   - `priceAnnually`: number (min 0)
   - `isActive`: boolean (optional)
3. Add `ToggleCurrencyDTO` (for Admin):
   - `isEnabled`: boolean
   - `sortOrder`: number (optional)

---

### Step 3: Subscription Service Updates

**Files to modify:**

- [`nyakaniniv-saas-backend/src/Modules/Subscription/subscription.service.ts`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/Modules/Subscription/subscription.service.ts)
- [`nyakaniniv-saas-backend/src/Modules/Subscription/subscription.controller.ts`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/Modules/Subscription/subscription.controller.ts)
- [`nyakaniniv-saas-backend/src/Modules/Subscription/SubscriptionModule.ts`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/Modules/Subscription/SubscriptionModule.ts)

**Changes:**

1. **`getAllPlans(currency?: string)`**:
   - Return plans with `prices` mapped to the requested `currency` (falling back to plan default if specific currency not configured).
   - Also expose active currencies endpoint `GET /subscriptions/v1/currencies`.
2. **`subscribe(userId, data)`**:
   - Resolve target currency: user-selected `currency` > tenant country mapped currency > `USD`.
   - Look up the active `SubscriptionPlanPrice` for `(planId, targetCurrency)`.
   - Charge the **exact localized price** for that currency instead of hardcoded KES amounts.
   - Create invoice with correct `currencyCode` and local `amount`.
   - Route to appropriate gateway (`Pesapal` for KES, `Paystack` for NGN/GHS/ZAR, etc.).
3. **Admin Endpoints**:
   - `PUT /subscriptions/v1/plans/:id/prices/:currencyCode`: Set or update price for a specific currency.
   - `GET /subscriptions/v1/plans/:id/prices`: List all currency prices configured for a plan.
   - `PATCH /subscriptions/v1/currencies/:code`: Enable/disable currency.

---

### Step 4: FX Rate Calculation & Transaction Capture

**Files to modify:**

- Create [`src/core/services/FxService.ts`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/core/services/FxService.ts)
- [`src/Modules/Webhook/webhook.service.ts`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/Modules/Webhook/webhook.service.ts)
- [`src/Modules/Subscription/subscription.service.ts`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/Modules/Subscription/subscription.service.ts)

**Changes:**

1. **`FxService`**:
   - Provides conversion to USD for supported currencies (`KES`, `NGN`, `GHS`, `ZAR`, `USD`, `UGX`, `TZS`).
   - Uses daily cached exchange rate with built-in reliable fallback rates so transactions never fail if external FX API is temporarily unreachable.
2. **Payment Success Handling**:
   - On successful transaction creation/update (both direct and webhook):
     - Calculate `fxRate` to USD.
     - Compute `amountUsd = Number(amount) * Number(fxRate)`.
     - Save `amountUsd` and `fxRate` immutably in `Transaction`.

---

### Step 5: Multi-Currency Admin Revenue Analytics

**Files to modify:**

- [`nyakaniniv-saas-backend/src/Modules/Analytics/analytics.service.ts`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/Modules/Analytics/analytics.service.ts)
- [`nyakaniniv-saas-backend/src/Modules/Analytics/analytics.controller.ts`](file:///c:/Users/A%20H%20Shonuj/Desktop/Softvence/nyakaniniv-upbeat-africa/nyakaniniv-saas-backend/src/Modules/Analytics/analytics.controller.ts)

**Changes:**

1. Update `getAdminAnalytics(query)` to accept optional query params: `currency?: string` (e.g. `ALL`, `USD`, `KES`, `NGN`).
2. **Revenue Metrics**:
   - If `currency === 'ALL'` (default): Sum `Transaction.amountUsd` where status = `SUCCEEDED`.
   - If specific currency (e.g. `KES`): Filter by `Transaction.currency === 'KES'` and sum original `amount`.
   - Add `revenueByCurrency`: Array of `{ currency, totalAmount, totalUsd, transactionCount }` so admin sees clean breakdown.
   - Prevent mixed-currency addition bug.

---

## Verification & Type Safety Gate

Before completing:

1. `bun run type-check` (`tsc --noEmit`) - Must exit with code 0.
2. `bun run build` - Must build successfully with code 0.
3. Test endpoints with local API calls.
