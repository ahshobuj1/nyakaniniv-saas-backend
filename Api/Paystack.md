# Paystack Integration Guide

This document provides a comprehensive guide on how Paystack is integrated into the Nyakaniniv SaaS platform to support African DJs (Kenya, Ghana, Nigeria, South Africa, etc.) where Stripe payouts are not fully supported.

---

## 1. How Paystack is Used in This Project

While Stripe is used for global payments and SaaS subscriptions, **Paystack** is utilized specifically for **DJ Booking Payments** in supported African regions.

### DJ Booking Payments (Paystack Split Payments - DJ gets paid)
When a client books a DJ from a supported country (e.g., Kenya), the client pays online using Paystack in their local currency (e.g., KES). The money must go directly to the DJ, with the platform keeping a commission.

To achieve this, we use **Paystack Subaccounts (Split Payments)**:
1. **DJ Onboarding**: The DJ enters their local Bank Code and Account Number in their dashboard. The backend calls the Paystack API to create a `subaccount` and saves the `subaccount_code` in the database.
2. **Booking Payment**: When the client pays for the booking, the platform initializes a Paystack transaction and passes the DJ's `subaccount_code` alongside a `transaction_charge` (our 5% Application Fee).
3. **Split Payout**: Paystack automatically sends 95% of the funds to the DJ's bank account and keeps the 5% platform fee in our main Paystack account.

---

## 2. Environment Setup

Update your project's `.env` file with your Paystack API keys:
```env
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_SECRET_KEY=sk_test_...
```

For webhooks (to listen to successful payments):
1. Go to **Paystack Dashboard > Settings > API Keys & Webhooks**.
2. Set your **Webhook URL** to your server's endpoint (e.g., `https://your-domain.com/api/v1/webhooks/paystack`).

---

## 3. Implementation Details & Endpoints

### Phase 1: DJ Paystack Onboarding
*Goal: The DJ provides their bank details to receive payouts.*

**Endpoint**: `POST /paystack-connect/v1/onboard`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "bankCode": "044", 
    "accountNumber": "0690000031",
    "businessName": "DJ Awesome"
  }
  ```
- **Action**: The API creates a Paystack subaccount and saves the `paystackSubaccountId` to the DJ's Tenant profile.

### Phase 2: Client Booking & Payment
*Goal: A client books the DJ, the DJ accepts, and the client pays via Paystack.*

**1. Booking Creation & Acceptance**: Remains exactly the same as the standard flow. When the DJ accepts the booking, a payment link is generated and emailed to the client.

**2. Client Checkout Redirect**:
- **Action**: The client clicks the Checkout link (`GET /bookings/v1/:bookingId/checkout-redirect`). 
- **Backend Routing**: The system checks the DJ's country. If the DJ is in Kenya, it calls the Paystack `transaction/initialize` API, setting the currency to `KES`, and passing the DJ's subaccount for the split payment.
- **Output**: The client is redirected to the Paystack Checkout page.

**3. Webhook Confirmation**:
- Upon successful payment, Paystack sends a `charge.success` event to `POST /webhooks/paystack`.
- The system reads the `bookingId` from the event metadata, marks the invoice as Paid, and updates the booking status to Completed.
