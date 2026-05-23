# Uncompleted Works: Booking Expansion, Payments, & Notifications

This document outlines the required steps to complete the remaining core flows of the platform, specifically addressing the Booking model expansion, the end-to-end payment flow, and the automated notification system.

## 1. Booking Model Expansion

The booking request needs to capture more information about the event and the client.

### Schema Changes (`src/prisma/schema.prisma`)
Update the `Booking` model to include the new fields:
```prisma
model Booking {
  // ... existing fields ...
  clientPhone  String?        @map("client_phone") @db.VarChar(50)
  eventDate    DateTime?      @map("event_date")
  address      String?        @db.Text
  // ... existing fields ...
}
```
*Run `npx prisma db push` or `bunx prisma db push` after making these changes to sync the database.*

### DTO Changes (`src/Modules/Booking/BookingDTO.ts`)
Update `CreateBookingDTO` to validate these new fields:
- `clientPhone` (string, optional/required depending on preference)
- `eventDate` (ISO date string, required)
- `address` (string, required)

---

## 2. Payment Flow (Booking -> Invoice -> Stripe -> Client)

Currently, the system creates an Invoice when a DJ accepts a booking, but it doesn't notify the client or provide a way to pay. We need to implement the following flow:

### Step 2.1: Generate Payment Link & Send Email
When a DJ updates a booking status to `accepted` and provides a `totalAmount`:
1. The `BookingService` creates the `Invoice` (This is already implemented).
2. **[NEW]** Generate a Stripe Checkout Session URL for this specific Invoice.
3. **[NEW]** Send an email to the `clientEmail` using an email service (e.g., Nodemailer + SendGrid/Resend).
   - **Email Content**: Description of the event, total amount, and two call-to-action buttons:
     - **"Pay Online"**: Links directly to the Stripe Checkout Session.
     - **"Pay Cash on Delivery (COD)"**: Links to a frontend page or backend endpoint to confirm COD.

### Step 2.2: Handle "Cash on Delivery" Selection
Create a new public endpoint for clients to select COD:
- **Endpoint**: `PATCH /invoices/v1/:id/select-cod`
- **Logic**: Updates the invoice `method` to `CASH` and `status` remains `unpaid` (or changes to `pending_cash`). Creates a notification for the DJ that the client opted for COD.

### Step 2.3: Handle Stripe Payment Success
Update the Stripe Webhook (`src/Modules/Webhook/webhook.service.ts` if it exists) to listen for `checkout.session.completed`:
1. Extract the `invoiceId` from the Stripe session metadata.
2. Mark the `Invoice` status as `paid`.
3. **[NEW]** Send a "Payment Receipt" email to the `clientEmail`.
4. **[NEW]** Send an automated notification to the DJ (User) that the payment was received.

---

## 3. Automated Notification System

Currently, notifications are only manual (Broadcast). We need to trigger notifications automatically based on system events.

### System Events to Track:
1. **New Booking Request**:
   - **Where**: `BookingService.createBooking`
   - **Action**: Find the `userId` associated with the `tenantId` and create a notification:
     *Title*: "New Booking Request", *Message*: "You have a new booking request from [clientName] for [eventDate]".
2. **Payment Received**:
   - **Where**: Stripe Webhook (when invoice is paid)
   - **Action**: Notify the DJ.
     *Title*: "Payment Received", *Message*: "Payment of $[amount] received for booking [id]".
3. **New User / Subscription (Admin Notifications)**:
   - **Where**: `AuthService.register` / `SubscriptionService`
   - **Action**: Create a notification for users with role `SUPER_ADMIN`.
     *Title*: "New Registration", *Message*: "A new DJ has joined the platform."

### Implementation Approach:
Create a helper method in `NotificationServices` (e.g., `sendSystemNotification(userId, title, message, type)`) and inject `NotificationServices` into the `Booking`, `Invoice`, and `Webhook` services to trigger them at the right time.

---

## 4. Extended Notifications System

### 4.1 Admin Notifications
To provide the Admin with a complete overview upon login, we need to add the following automated notifications sent to the `SUPER_ADMIN`:
- **New Subscription Purchased**: "DJ [Name] purchased [Plan Name] plan on subdomain [subdomain.example.com]".
- **New Support Ticket Message**: "New message received on Support Ticket #[ID] from [User/DJ]".

### 4.2 DJ Subscription Notifications
Automated emails and in-app notifications for the DJ regarding their subscription status (requires a daily cron job):
- **7 Days Before Expiration**: "Your [Plan Name] subscription expires in 7 days. Renew now to keep your website live."
- **1 Day Before Expiration**: "Your subscription expires tomorrow! Action required."
- **Upon Expiration**: "Your subscription has expired. Your website is currently offline. Please renew to restore access."

---

## 5. DJ Payment Processing (Booking Fees)

**The Problem**: Currently, Stripe is configured for the Admin to receive SaaS subscription payments. However, when a client pays a DJ for a booking, the money needs to go to the DJ, not the Admin.

**The Solution**: We have two approaches to handle this.

### Approach A: Stripe Connect (Recommended for SaaS)
- DJs go through a Stripe onboarding flow in their dashboard to connect their bank accounts (Stripe Express or Standard).
- When a client pays for a booking, the platform creates a **Destination Charge**.
- The money goes directly to the DJ's Stripe account.
- *Bonus*: The platform (Admin) can optionally take an "Application Fee" (e.g., a 2% cut of every booking) automatically.

### Approach B: Bring Your Own Keys (BYOK)
- DJs create their own regular Stripe accounts and paste their `Publishable Key` and `Secret Key` into their SaaS settings.
- The platform uses the DJ's specific keys to generate the Checkout Session.
- The money goes entirely to the DJ. (Platform cannot take an automated cut).

*Action Item*: Decide between Approach A and Approach B and implement the required fields in the `Tenant`/`User` model (either Stripe Account ID for Connect, or Stripe API Keys for BYOK).

---

## 6. Subscription & Feature Management

We need a robust system to manage limits, renewals, and access control based on the 3 subscription plans.

### 6.1 Subscription Lifecycle Management
- **Active**: Website is live, full backend access based on tier.
- **Expired**:
  - The DJ's subdomain/website automatically routes to a "Site Offline / Subscription Expired" holding page.
  - The DJ can still log into the admin panel but is restricted to the Billing/Subscription page until they renew.
- **Implementation**: A middleware (`checkSubscription`) that runs on tenant website routes and specific API endpoints to verify the `tenant.subscriptionStatus == 'ACTIVE'`.

### 6.2 Proposed Subscription Tiers & Access

Here is the recommended feature distribution across 3 plans to maximize conversions:

#### Tier 1: Starter (e.g., $15/mo)
*For DJs just starting out who need a basic online presence.*
- Custom Subdomain (`djname.platform.com`)
- Basic Profile Website (1 Standard Theme)
- Accept Booking Requests (Manual approval)
- **Cash / Manual Payments Only** (No Stripe integration for bookings)
- Standard Support

#### Tier 2: Pro (e.g., $39/mo) - *Most Popular*
*For working DJs who want to automate their business.*
- *Everything in Starter, plus:*
- **Online Payments (Stripe Integration)**
- Automated Invoicing & Receipts
- Choice of Multiple Website Themes
- Client Email Notifications (Booking updates)
- Basic Analytics Dashboard (Profile views, total earnings)

#### Tier 3: Elite/Agency (e.g., $79/mo)
*For top-tier professionals.*
- *Everything in Pro, plus:*
- **Custom Domain Support** (`www.theirname.com`)
- Advanced Analytics
- Remove Platform Branding ("Powered by Platform")
- Priority Support

### 6.3 Technical Implementation of Feature Flags
- Add an `activePlan` and `features` JSON column (or related table) to the `Tenant` model.
- Create an `AccessControlService` that checks if a tenant has access to a specific feature before allowing the action (e.g., `if (!tenant.hasFeature('ONLINE_PAYMENTS')) throw Error(...)`).
