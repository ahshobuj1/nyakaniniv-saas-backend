# Stripe Integration Guide

This document provides a comprehensive guide on how Stripe is integrated into the Nyakaniniv SaaS platform, how to configure your environment variables, and how to run end-to-end tests for the payment flows.

---

## 1. How Stripe is Used in This Project

The project uses Stripe in two completely different ways:

### A. SaaS Subscriptions (Admin gets paid)
DJs pay a monthly/yearly subscription fee to use the platform. This uses standard Stripe Subscriptions. The money goes directly to your platform's main Stripe account.

### B. DJ Booking Payments (Stripe Connect - DJ gets paid)
When a client books a DJ, the client pays online. The money must go to the DJ, not the platform admin. 
To achieve this, we use **Stripe Connect**:
1. The DJ goes through a Stripe Onboarding flow to connect their bank account.
2. When the client pays for the booking, the platform creates a "Destination Charge".
3. The money goes directly to the DJ, and the platform automatically keeps a **5% Application Fee**.

---

## 2. How to Collect Stripe API Keys

To run tests, you need to collect your Stripe API keys and put them in your `.env` file.

### Step 1: Getting Test Keys
1. Go to your [Stripe Dashboard](https://dashboard.stripe.com/).
2. Toggle the **"Test mode"** switch in the top right corner (it should turn orange).
3. Go to **Developers > API keys**.
4. Copy the **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`).

### Step 2: Getting the Connect Client ID
Because we are using Stripe Connect, you need a Client ID to allow DJs to onboard.
1. Go to **Settings** (gear icon) > **Connect settings**.
2. Scroll down to the **Integration** section.
3. Find your **Test mode client ID** (starts with `ca_...`).

### Step 3: Webhook Secret (For listening to successful payments)
1. Go to **Developers > Webhooks**.
2. Click **Add endpoint**.
3. For local testing, use the Stripe CLI: `stripe listen --forward-to localhost:3030/api/v1/webhooks/stripe`
4. The CLI will print a webhook secret (`whsec_...`).

### Setting up `.env`
Update your project's `.env` file with the test keys:
```env
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_CLIENT_ID=ca_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Going Live (Production Keys)
When you are ready to launch, simply toggle **"Test mode"** OFF in the Stripe Dashboard. The interface is identical. You will grab the `pk_live_...`, `sk_live_...`, and the Live Connect Client ID, and replace them in your production server's environment variables.

---

## 3. Step-by-Step API Testing Guide

Here is exactly how to test the DJ Booking Payment flow from start to finish using Postman or cURL.

### Phase 1: DJ Stripe Connect Onboarding
*Goal: The DJ connects their Stripe account so they can receive money.*

**Step 1: Login as DJ**
- `POST /auth/v1/login`
- Copy the JWT token.

**Step 2: Generate Onboarding Link**
- **Endpoint**: `POST /stripe-connect/v1/onboard`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "tenantId": "dj-tenant-uuid",
    "returnUrl": "http://localhost:3000/settings",
    "refreshUrl": "http://localhost:3000/settings/stripe/refresh"
  }
  ```
- **Action**: The API will return a `stripeAccountId` and a `url`. 
- **Test**: Open the `url` in your browser. Complete the dummy Stripe onboarding (in test mode, you can use `000-000-0000` for phone numbers and dummy test data). Once finished, it will redirect back to your `returnUrl`.

**Step 3: Verify Status**
- **Endpoint**: `GET /stripe-connect/v1/status?tenantId=dj-tenant-uuid`
- **Headers**: `Authorization: Bearer <token>`
- **Action**: Ensure it returns `"isConnected": true` and `"payoutsEnabled": true`.

---

### Phase 2: Client Booking & Payment
*Goal: A client books the DJ, the DJ accepts, and the client pays.*

**Step 1: Client Submits Booking Request**
- **Endpoint**: `POST /bookings/v1/` (Public - no token needed)
- **Body**:
  ```json
  {
    "tenantId": "dj-tenant-uuid",
    "clientName": "John Doe",
    "clientEmail": "john@example.com",
    "clientPhone": "1234567890",
    "eventDate": "2026-10-10T20:00:00Z",
    "eventType": "Wedding",
    "address": "Miami Beach"
  }
  ```
- **Action**: Grab the returned `bookingId`.

**Step 2: DJ Accepts Booking & Quotes Price**
- **Endpoint**: `PATCH /bookings/v1/:bookingId/status`
- **Headers**: `Authorization: Bearer <token>` (DJ Token)
- **Body**:
  ```json
  {
    "status": "accepted",
    "totalAmount": 1000.00
  }
  ```
- **Action**: The system updates the booking, generates an `Invoice`, and talks to Stripe to generate a Checkout Session specifically routed to the DJ.
- **Output**: The API returns the booking details along with a `checkoutUrl`.

**Step 3: Client Pays**
- **Action**: Copy the `checkoutUrl` returned in Step 2 and paste it into your browser.
- **Test**: You will see a Stripe Checkout page asking for $1,000.00. Use Stripe's test credit card:
  - Card Number: `4242 4242 4242 4242`
  - MM/YY: Any future date (e.g., `12/30`)
  - CVC: Any 3 digits (e.g., `123`)
- **Result**: Upon successful payment, you will be redirected to the `payment-success` page.

**Step 4: Verification in Stripe Dashboard**
1. Go to your Stripe Dashboard.
2. Go to **Payments**. You should see the $1,000 payment.
3. Click on the payment. You will see that a **5% Application Fee ($50)** was kept by the platform, and **$950** was transferred to the DJ's connected account!
