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
