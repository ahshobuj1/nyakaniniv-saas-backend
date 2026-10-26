# Multi-Currency Subscriptions & Admin Revenue Dashboard: Implementation Spec

**Audience:** AI coding agent working inside an existing codebase.
**Product:** A platform where DJs buy subscriptions. DJs come from multiple countries, so prices must be shown and charged in local currencies (including KES), with M-Pesa/mobile money supported.

---

## 0. Instructions for the agent (read first)

1. **Inspect the existing repo before writing code.** Identify the framework, folder structure, auth system, existing Prisma schema, existing user/plan models, UI components and conventions. Extend what exists; do not duplicate or rewrite working parts.
2. If a model, module or page already exists (e.g. `User`, `Plan`, auth guards, an admin area), reuse it and add only what is missing.
3. Follow the existing code style, folder layout and naming.
4. Implement in the phases listed in section 9, one phase at a time. Keep each phase runnable and type-safe.
5. Do not hardcode secrets. Use environment variables (section 10).
6. Where this spec is ambiguous or the repo conflicts with it, choose the option that fits the repo and leave a short note in the PR/summary.
7. Verify provider-specific details (endpoints, webhook signatures, recurring support) against each provider's **official, current docs** before implementing. Do not rely on memory.

### Assumed stack (confirm against the repo)

- Frontend: React, Next.js, TypeScript, Tailwind CSS, shadcn/ui (+ shadcn Charts / Recharts)
- Backend: Node.js, TypeScript, NestJS (or Express), Zod, Prisma, PostgreSQL
- Package manager: npm or Bun (use whichever the repo already uses)

---

## 1. Goals

1. Show plan prices in the visitor's local currency (KES, USD, NGN, etc.), with auto-detect and a manual currency switcher.
2. Let users subscribe and pay via **Paystack**, **Flutterwave** and **Pesapal**.
3. Own the subscription logic in **our backend**. Gateways are only payment rails.
4. Store every payment and subscription event so the admin dashboard can report revenue and stats across currencies without extra rework.
5. Provide an admin dashboard with correct multi-currency revenue reporting.
6. Let admins manage **all prices from the admin dashboard** (add, edit, deactivate prices per plan per currency, enable/disable currencies) with no code change or redeploy.
7. Only show and charge currencies that our payment gateways can actually charge. Visitors from countries without a chargeable local currency (e.g. Bangladesh) see the USD fallback.

## 2. Core design decisions

| Decision | Choice | Reason |
|---|---|---|
| Pricing | Fixed price per plan per currency (e.g. USD 10, KES 1,300). No live auto-conversion at checkout. | Stable prices, cleaner UX, no surprise changes from exchange rates. |
| Billing engine | Our own (DB + cron), not the gateways' built-in subscription products. | M-Pesa/mobile money does not support auto-debit; gateways differ; avoids lock-in. |
| Provider access | `PaymentProvider` interface with one implementation per gateway. | Add/replace gateways without touching business logic. |
| Provider routing | Config-driven (currency / payment method to provider), not hardcoded. | Easy to change after testing fees and success rates. |
| Reporting | Store original amount **and** USD-equivalent at payment time. | Never add different currencies together; historical numbers must not change when rates move. |
| Displayable currencies | Only **chargeable** currencies are shown as prices. A currency is chargeable if it is enabled in the `Currency` table, has at least one supporting provider, and the plan has an active price in it. | We must never show a price we cannot charge (e.g. BDT). Fallback is USD. |
| Price management | All prices and currency settings live in the DB and are editable from the admin dashboard. | No redeploy to change prices; full audit trail. |
| Price changes vs existing subscribers | A price change affects **new** purchases only. Each subscription stores a snapshot of the price it was bought at (grandfathering). Admin can optionally migrate existing subscribers explicitly. | Prevents surprise charges on renewal. |

## 3. Data model (Prisma)

Adapt names to the existing schema. Add only what is missing.

```prisma
enum SubscriptionStatus { PENDING ACTIVE PAST_DUE GRACE CANCELED EXPIRED }
enum PaymentStatus      { PENDING SUCCESS FAILED REFUNDED }
enum PaymentProviderKey { PAYSTACK FLUTTERWAVE PESAPAL }
enum BillingInterval    { MONTHLY YEARLY }

model Plan {
  id        String        @id @default(cuid())
  name      String
  interval  BillingInterval
  isActive  Boolean       @default(true)
  prices    PlanPrice[]
  subs      Subscription[]
}

model Currency {               // admin-managed list of chargeable currencies
  code        String   @id      // ISO 4217: USD, KES, NGN ...
  name        String
  symbol      String?
  isEnabled   Boolean  @default(true)   // admin can turn a currency on/off
  providers   PaymentProviderKey[]       // providers able to charge this currency
  sortOrder   Int      @default(0)
  prices      PlanPrice[]
}

model CountryCurrency {        // country -> preferred currency (display default)
  countryCode  String  @id     // ISO 3166-1 alpha-2, e.g. KE, NG, BD
  currencyCode String           // preferred currency; may NOT be chargeable (then fall back to USD)
}

model PlanPrice {
  id          String   @id @default(cuid())
  planId      String
  currency    String
  amount      Decimal  @db.Decimal(14, 2)
  isActive    Boolean  @default(true)
  updatedById String?
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())
  plan        Plan     @relation(fields: [planId], references: [id])
  curr        Currency @relation(fields: [currency], references: [code])
  @@unique([planId, currency])
}

model PriceChangeLog {         // audit trail for every admin price/currency change
  id          String   @id @default(cuid())
  entity      String   // "PlanPrice" | "Currency" | "Plan"
  entityId    String
  action      String   // CREATE | UPDATE | DEACTIVATE | MIGRATE_SUBSCRIBERS
  before      Json?
  after       Json?
  adminId     String
  createdAt   DateTime @default(now())
  @@index([entity, entityId])
}

model Subscription {
  id                 String   @id @default(cuid())
  userId             String
  planId             String
  currency           String
  priceAmount        Decimal  @db.Decimal(14, 2) // price snapshot at purchase (grandfathering)
  priceId            String?                    // PlanPrice used at purchase
  provider           PaymentProviderKey
  status             SubscriptionStatus @default(PENDING)
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  graceEndsAt        DateTime?
  cancelAtPeriodEnd  Boolean  @default(false)
  createdAt          DateTime @default(now())
  canceledAt         DateTime?
  plan               Plan     @relation(fields: [planId], references: [id])
  payments           Payment[]
  @@index([userId])
  @@index([status, currentPeriodEnd])
}

model Payment {
  id             String   @id @default(cuid())
  subscriptionId String
  userId         String
  provider       PaymentProviderKey
  providerRef    String   // gateway transaction/reference id
  amount         Decimal  @db.Decimal(14, 2) // original amount
  currency       String
  fxRate         Decimal  @db.Decimal(18, 8) // original currency -> USD at payment time
  amountUsd      Decimal  @db.Decimal(14, 2) // converted, stored permanently
  status         PaymentStatus @default(PENDING)
  country        String?  // ISO country code if known
  method         String?  // card, mpesa, mobile_money, bank ...
  paidAt         DateTime?
  createdAt      DateTime @default(now())
  subscription   Subscription @relation(fields: [subscriptionId], references: [id])
  @@unique([provider, providerRef])
  @@index([status, paidAt])
  @@index([currency, paidAt])
}

// Refunds: either a negative Payment row or a separate Refund table.
// Either way, refunds MUST reduce reported revenue.
model Refund {
  id         String   @id @default(cuid())
  paymentId  String
  amount     Decimal  @db.Decimal(14, 2)
  amountUsd  Decimal  @db.Decimal(14, 2)
  currency   String
  createdAt  DateTime @default(now())
}

model PaymentMethod {          // cards only (for off-session renewals)
  id        String   @id @default(cuid())
  userId    String
  provider  PaymentProviderKey
  token     String   // authorization code / card token (encrypt at rest if possible)
  last4     String?
  brand     String?
  createdAt DateTime @default(now())
}

model WebhookEvent {           // idempotency + audit
  id         String   @id @default(cuid())
  provider   PaymentProviderKey
  eventId    String
  payload    Json
  processedAt DateTime?
  createdAt  DateTime @default(now())
  @@unique([provider, eventId])
}

model FxRate {                 // daily rates
  id         String   @id @default(cuid())
  date       DateTime @db.Date
  currency   String
  rateToUsd  Decimal  @db.Decimal(18, 8)
  @@unique([date, currency])
}

model DailyMetric {            // nightly aggregate, one row per date + currency
  id           String   @id @default(cuid())
  date         DateTime @db.Date
  currency     String
  revenue      Decimal  @db.Decimal(14, 2) // original currency
  revenueUsd   Decimal  @db.Decimal(14, 2)
  paymentCount Int
  newSubs      Int
  churnedSubs  Int
  activeSubs   Int
  mrrUsd       Decimal  @db.Decimal(14, 2)
  @@unique([date, currency])
}
```

Notes:
- Always use `Decimal` for money, never `Float`.
- `@@unique([provider, providerRef])` on `Payment` prevents duplicate payments.

## 4. Currency display and detection

### 4.1 Golden rule
**Only show prices in currencies we can actually charge.** If a visitor's local currency is not chargeable (e.g. a DJ in Bangladesh, local currency BDT, which Paystack/Flutterwave/Pesapal cannot charge), show and charge **USD**. Never display a price we cannot charge.

### 4.2 Chargeable currency
A currency is chargeable for a plan when **all** are true:
1. `Currency.isEnabled = true`
2. `Currency.providers` contains at least one provider that is configured and enabled
3. The plan has an active `PlanPrice` in that currency

USD must always exist as the universal fallback (enforce: admin cannot disable USD or delete the last USD price of an active plan).

### 4.3 Resolution logic

```ts
async function resolveCurrency(countryCode: string | null, userChoice?: string, planId?: string) {
  const chargeable = await getChargeableCurrencies(planId); // enabled + has provider + active price
  if (userChoice && chargeable.includes(userChoice)) return userChoice;     // 1. manual switch
  const local = await countryToCurrency(countryCode);                       // 2. BD -> BDT
  if (local && chargeable.includes(local)) return local;                    //    only if chargeable
  return 'USD';                                                              // 3. fallback
}
```

- Detect country from CDN/geo header (e.g. `x-vercel-ip-country`, `cf-ipcountry`), otherwise IP lookup.
- The currency switcher lists **only** chargeable currencies.
- Persist the choice (cookie, and user profile when logged in).
- Format with `Intl.NumberFormat(locale, { style: 'currency', currency })`.
- The price shown at checkout must be exactly the amount charged. The server re-reads the price from `PlanPrice`; never trust a client-sent amount.

### 4.4 No local-currency estimate
Do **not** show an approximate local-currency value (e.g. "≈ ৳1,200") for non-chargeable currencies. Show only the chargeable price (e.g. `$10.00 / month`); users can check conversion themselves.

Only add a short checkout note: "You will be charged in USD. Your bank may convert it using its own rate and may apply foreign transaction fees."

### 4.5 Known limitation (inform the client)
Customers paying USD from countries without local payment support (e.g. Bangladesh) depend on their card allowing international transactions, and on their bank's conversion rate and fees. Local methods such as bKash/Nagad are not covered by Paystack, Flutterwave or Pesapal. If such a country is a major market, plan an additional local gateway later (the `PaymentProvider` interface makes this a drop-in addition).

## 5. Payment provider abstraction

```ts
export interface PaymentProvider {
  readonly key: 'PAYSTACK' | 'FLUTTERWAVE' | 'PESAPAL';

  createCheckout(input: {
    userId: string;
    email: string;
    amount: number;
    currency: string;
    reference: string;          // our internal unique reference
    callbackUrl: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ checkoutUrl: string; providerRef: string }>;

  verify(providerRef: string): Promise<{
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    amount: number;
    currency: string;
    method?: string;
    country?: string;
    saveToken?: { token: string; last4?: string; brand?: string };
  }>;

  // Card only; omit for mobile-money-only flows
  chargeSavedMethod?(input: {
    token: string;
    email: string;
    amount: number;
    currency: string;
    reference: string;
  }): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PENDING'; providerRef: string }>;

  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string>): boolean;
  parseWebhook(rawBody: Buffer): { eventId: string; providerRef: string; type: string };
}
```

Implement `PaystackProvider`, `FlutterwaveProvider`, `PesapalProvider`. Use a `PaymentProviderRegistry` plus a `ProviderRouter` service.

### Provider routing (config-driven; start here, tune later)

| Case | Provider |
|---|---|
| KES with M-Pesa / mobile money | Pesapal or Paystack (Kenya) |
| Card payments, local or international | Paystack or Flutterwave |
| Anything else / fallback | Flutterwave |

Store the routing table in config (env or DB), with an optional user-selected method at checkout.

## 6. Subscription lifecycle

### Checkout flow
1. User picks plan + currency. Backend loads `PlanPrice`.
2. Create `Subscription` (`PENDING`) and `Payment` (`PENDING`) with a unique internal reference.
3. `ProviderRouter` picks provider; call `createCheckout`; redirect user to `checkoutUrl`.
4. On callback and/or webhook: `verify` with the provider, never trust the redirect alone.
5. On SUCCESS: mark `Payment` SUCCESS, set `paidAt`, store `fxRate` and `amountUsd`, activate `Subscription`, set `currentPeriodStart/End`. If a card token is returned, store it in `PaymentMethod`.

### Renewals (daily cron)
- **Card with saved token:** shortly before/at `currentPeriodEnd`, call `chargeSavedMethod`. On success extend the period. On failure set `PAST_DUE`, retry (e.g. day 1, 3, 5), email the user.
- **M-Pesa / mobile money (no auto-debit):** send reminders at 5, 3 and 1 days before `currentPeriodEnd` with a one-click "Renew now" link (creates a new checkout). After expiry, move to `GRACE` (e.g. 3 days, configurable), then `EXPIRED` and remove paid access.
- Cancellation: `cancelAtPeriodEnd = true`; access continues until `currentPeriodEnd`.

### Webhooks
- Endpoint per provider: `POST /webhooks/:provider`. Use **raw body** for signature verification.
- Steps: verify signature, insert into `WebhookEvent` (unique `provider+eventId`; ignore if already processed), re-verify the transaction with the provider API, update `Payment`/`Subscription` in a DB transaction, mark processed.
- Validate parsed payloads with Zod.
- Respond 200 quickly; do heavy work after persisting the event.
- Must be fully **idempotent**.

## 7. FX handling

- Daily cron fetches rates into `FxRate(date, currency, rateToUsd)` from a rates API (choose one; keep behind a small `FxService`). Where a gateway reports a settlement rate, prefer it.
- At payment success: `fxRate = rate for payment date`, `amountUsd = amount * fxRate`. Store both permanently.
- Never recompute historical `amountUsd` from newer rates.

## 8. Admin dashboard

### 8.1 Rule
**Never sum different currencies together.** Provide two views:

- **All (USD):** every currency converted using stored `amountUsd`. Default view. Label totals as approximate.
- **Single currency filter (KES, NGN, USD...):** original `amount`, no conversion.

### 8.2 Filters
Currency (All USD + each currency), date range, provider, plan.

### 8.3 Widgets

| Widget | Content |
|---|---|
| KPI: Revenue | Big number in USD; small line below with per-currency breakdown, e.g. `KES 450,000 · NGN 1.2M · USD 3,200` |
| KPI: MRR | Active subscriptions normalized to monthly (yearly / 12), in USD; note "converted at current rate" |
| KPI: Active subscribers | Count |
| KPI: New subscribers / Churn | Count and % for the period |
| Revenue trend | Line chart; USD in All view, original currency when filtered |
| Revenue by currency | Donut/stacked bar by USD equivalent; tooltip shows original amount |
| Revenue by provider | Bar chart (Paystack / Flutterwave / Pesapal) |
| Subscribers by country / currency | Count chart |
| Upcoming renewals | Next 7 days list |
| Recent payments | Table: original amount + currency, plus `≈ $USD`, provider, method, status |
| Failed / expired payments | Same table, filtered by status |

Show the top 4 currencies in charts and group the rest into "Other".

### 8.4 API (admin-only, behind the existing admin guard)

```
GET /admin/stats/overview?from=&to=&currency=ALL&provider=
GET /admin/stats/revenue?from=&to=&currency=ALL&provider=&interval=day|week|month
GET /admin/stats/subscribers?from=&to=
GET /admin/payments?status=&currency=&provider=&page=&pageSize=
```

Validate all query params with Zod.

Example response (`/admin/stats/revenue`):

```json
{
  "reportingCurrency": "USD",
  "totalUsd": 12450.50,
  "byCurrency": [
    { "currency": "KES", "amount": 980000, "amountUsd": 7600.20, "count": 540 },
    { "currency": "NGN", "amount": 2100000, "amountUsd": 1350.00, "count": 120 },
    { "currency": "USD", "amount": 3500, "amountUsd": 3500, "count": 350 }
  ],
  "trend": [{ "date": "2026-10-01", "usd": 410.5, "KES": 31000, "USD": 120 }]
}
```

Example query:

```ts
const byCurrency = await prisma.payment.groupBy({
  by: ['currency'],
  where: { status: 'SUCCESS', paidAt: { gte: from, lte: to } },
  _sum: { amount: true, amountUsd: true },
  _count: true,
});
const totalUsd = byCurrency.reduce((s, r) => s + Number(r._sum.amountUsd ?? 0), 0);
// subtract refunds for the same period
```

### 8.5 Performance
Start with live queries. When data grows, a nightly job fills `DailyMetric` (one row per date + currency) and the dashboard reads from it.

### 8.6 Admin price and currency management

Admins manage everything below from the dashboard (route e.g. `/admin/pricing`). No code change or redeploy is needed.

**Screens / features**

| Feature | Behaviour |
|---|---|
| Plans list | Create / rename / activate / deactivate plans, set interval (monthly / yearly). |
| Price matrix | Table with plans as rows and currencies as columns. Each cell is an editable amount with an active toggle. Empty cell = "add price". |
| Currencies | Enable/disable a currency, set symbol, sort order, and which providers can charge it. USD cannot be disabled. |
| Country mapping | View/edit `CountryCurrency` (country to preferred currency). Countries mapped to a non-chargeable currency automatically fall back to USD. |
| Preview | "Preview as country" selector showing what a visitor from that country sees (currency and price). |
| Audit log | Table of `PriceChangeLog` entries: who, when, before/after. |

**Rules**
1. Editing or deactivating a price affects **new** purchases only. Existing subscriptions keep their `priceAmount` snapshot and renew at that price.
2. Optional action "Migrate existing subscribers to new price": explicit, requires a confirmation dialog showing the number of affected subscribers and the old/new amount, takes effect from their next renewal, writes `MIGRATE_SUBSCRIBERS` to the audit log, and should trigger a notification email to affected users.
3. Validate: amount greater than 0, max 2 decimals (0 for zero-decimal currencies where relevant), currency must exist and be enabled, plan must exist.
4. Warn the admin before saving if the new amount deviates strongly (e.g. more than 30%) from the USD price converted at the current FX rate.
5. Cannot delete a price that has subscriptions or payments; deactivate it instead.
6. Cannot leave an active plan without an active USD price.
7. Every change is written to `PriceChangeLog` in the same DB transaction.
8. Public pricing pages must reflect changes quickly (cache for a short TTL or revalidate on change, e.g. Next.js `revalidateTag`).

**Admin API** (admin role only, Zod-validated)

```
GET    /admin/plans
POST   /admin/plans
PATCH  /admin/plans/:id

GET    /admin/prices                     # price matrix
PUT    /admin/plans/:planId/prices/:currency   # create or update a price
PATCH  /admin/prices/:id/active          # activate / deactivate
POST   /admin/prices/:id/migrate-subscribers   # explicit, confirm payload required

GET    /admin/currencies
PATCH  /admin/currencies/:code           # enable/disable, symbol, providers, sortOrder

GET    /admin/country-currency
PUT    /admin/country-currency/:countryCode

GET    /admin/price-audit?entity=&entityId=&page=
```

Public (non-admin) endpoint used by the pricing page:

```
GET /pricing?country=XX&currency=YYY
-> { currency, chargeableCurrencies, plans: [{ id, name, interval, amount }] }
```

### 8.7 Frontend
Next.js admin route (e.g. `/admin/billing`), shadcn `Card`, `Select`, `Table`, `Tabs`, and shadcn Charts (Recharts). Give each currency a fixed color via `ChartConfig`. Tooltips show both original amount and USD equivalent. Use `Intl.NumberFormat` for all money.

## 9. Implementation phases

1. **Schema and seed:** Prisma models/migrations; seed plans with USD and KES prices.
2. **Pricing UI:** chargeable-currency resolution with USD fallback, switcher (chargeable currencies only), localized price display, checkout note about bank conversion.
2b. **Admin pricing management:** admin APIs and `/admin/pricing` UI (price matrix, currencies, country mapping, audit log), price snapshot on subscriptions, cache revalidation.
3. **Provider layer:** interface, registry, router; implement Paystack first.
4. **Checkout + webhook:** end-to-end payment, signature verification, idempotency, subscription activation, FX capture on payment.
5. **Renewal engine:** cron, reminders (email), retries, grace period, expiry, cancel flow.
6. **Flutterwave and Pesapal providers.**
7. **Admin stats API.**
8. **Admin dashboard UI.**
9. **Hardening:** tests, logging, error monitoring, refund handling, docs.

## 10. Environment variables (names are suggestions)

```
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_WEBHOOK_HASH=
PESAPAL_CONSUMER_KEY=
PESAPAL_CONSUMER_SECRET=
PESAPAL_IPN_ID=
FX_API_KEY=
APP_BASE_URL=
SUBSCRIPTION_GRACE_DAYS=3
```

## 11. Security and correctness checklist

- [ ] All webhook signatures verified using the raw request body
- [ ] Every payment is re-verified via the provider API before activating a subscription
- [ ] Idempotent webhook handling (`WebhookEvent` unique constraint, `Payment` unique constraint)
- [ ] Charged amount and currency match the stored `PlanPrice` (never trust client-sent amounts)
- [ ] Non-chargeable currencies (e.g. BDT) are never shown as a price; USD fallback works
- [ ] Price edits do not change existing subscribers' renewal price unless explicitly migrated
- [ ] Every price/currency change is audit-logged in the same transaction
- [ ] USD cannot be disabled and an active plan always has an active USD price
- [ ] Money stored as `Decimal`, never `Float`
- [ ] No secrets in code or logs; card tokens never logged
- [ ] Admin endpoints protected by role-based guard
- [ ] All inputs validated with Zod
- [ ] Refunds reduce reported revenue
- [ ] Subscription state changes happen inside DB transactions
- [ ] Sandbox/test mode for every provider before going live

## 12. Testing

- Unit tests: router, FX conversion, period calculation, status transitions.
- Integration tests: checkout, webhook (valid, invalid signature, duplicate event), renewal success/failure, expiry/grace.
- Use each provider's sandbox with test cards and test M-Pesa numbers.
- Dashboard: seed mixed-currency payments (KES, NGN, USD, one refund) and verify totals against hand-calculated numbers.

## 13. Open questions (ask the client / owner)

1. Which countries will most DJs be in? (decides currencies to price)
2. In which country is the business registered, and which currency are payouts settled in?
3. Is international (non-African) card acceptance enabled on the Paystack / Flutterwave accounts?
4. What are the plans, intervals and prices per currency?
5. Grace period length and refund policy?
6. Is a country like Bangladesh a major target market? If yes, plan an extra local gateway (bKash/Nagad/SSLCommerz) later.
7. Should price changes ever auto-apply to existing subscribers, or always stay explicit (recommended)?
8. Which admin roles may edit prices (all admins, or super-admin only)?
