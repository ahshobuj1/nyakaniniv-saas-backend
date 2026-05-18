# User Journey & Technical Flow

## Multi-Tenant SaaS DJ Platform

This document outlines the step-by-step experience for each user role and the underlying technical processes that power the platform.

---

### 1. User Journeys

#### 1.1 DJ (Tenant) Journey

1.  **Discovery & Sign-up:**
    - DJ lands on the main platform marketing page.
    - Clicks **"Get Started"** and registers with Email and Password.
    - Receives an **OTP via Email** for verification.
    - Verifies account and logs in for the first time.
2.  **Subscription:**
    - System prompts the DJ to choose a subscription plan.
    - DJ is redirected to **Stripe Checkout**.
    - Upon successful payment, the DJ is granted access to the **Tenant Dashboard**.
3.  **Portfolio Customization:**
    - DJ navigates to **"Theme Settings"**.
    - Chooses one of the two available themes.
    - Uses the **Visual Editor** to upload a Logo, update Hero text, and About section content.
    - Adds **Mix-tapes** by pasting external links (SoundCloud/Mixcloud) and uploading cover art.
    - Adds upcoming **Events** with venue details and dates.
4.  **Managing Business:**
    - Receives a notification for a new **Booking Request**.
    - Reviews client details in the **Bookings** tab.
    - Clicks **"Accept"** and sends a **Payment Request** (Stripe Link) to the client’s email.
    - Tracks payment status and views the generated **Invoice**.

#### 1.2 Client (Visitor) Journey

1.  **Interaction:**
    - Visits the DJ's personal portfolio (e.g., `shobujdj.devscout.com`).
    - Listens to mix-tapes and checks the event calendar.
2.  **Booking:**
    - Clicks **"Book Now"** and fills out the event inquiry form.
    - Submits the request and receives an acknowledgement email.
3.  **Payment:**
    - Receives a follow-up email from the DJ with a payment link.
    - Clicks the link, pays via Stripe, and receives a receipt/invoice.

#### 1.3 Super Admin Journey

1.  **Overview:**
    - Logs into the **Admin Panel**.
    - Views global statistics (Total DJs, MRR, Active Subscriptions).
2.  **Audit & Management:**
    - Reviews all platform-wide invoices (Subscription and Booking).
    - Manages or suspends DJ accounts if necessary.
    - Configures system-wide subscription plans.

---

### 2. Technical Flows

#### 2.1 Authentication & Verification Flow

- **Step 1:** Frontend sends registration data to `/api/auth/register`.
- **Step 2:** Backend creates a user record with `is_verified: false` and generates a 6-digit OTP.
- **Step 3:** Backend triggers an email via SMTP (Resend/SendGrid) with the OTP.
- **Step 4:** User submits OTP to `/api/auth/verify`.
- **Step 5:** Backend validates OTP, updates user to `is_verified: true`, and issues a JWT session.

#### 2.2 Subdomain Routing Flow

- **Step 1:** A request hits the server (e.g., `https://shobujdj.platform.com`).
- **Step 2:** Middleware extracts the host header and identifies the subdomain slug (`shobujdj`).
- **Step 3:** Backend queries the `Tenants` table to fetch branding, theme selection, and associated content (Mix-tapes, Events).
- **Step 4:** The Frontend renders the selected theme template dynamically populated with the tenant's data.

#### 2.3 SaaS Subscription Flow (Stripe)

- **Step 1:** DJ selects a plan; Backend calls Stripe API to create a `Checkout Session`.
- **Step 2:** User completes payment on Stripe's hosted page.
- **Step 3:** Stripe sends a `checkout.session.completed` webhook to the Backend.
- **Step 4:** Backend updates the `Subscriptions` table, linking the `stripe_customer_id` and setting the status to `active`.
- **Step 5:** Middleware now allows access to `/dashboard` based on subscription status.

#### 2.4 Booking & Payment Flow (DJ to Client)

- **Step 1:** Client submits form on the portfolio; Backend saves to `Bookings` table with status `pending`.
- **Step 2:** DJ clicks "Send Payment Request"; Backend creates a Stripe `PaymentIntent` or `Checkout Session` on behalf of the DJ.
- **Step 3:** System sends an automated email to the Client with the payment URL.
- **Step 4:** Client pays; Stripe Webhook triggers a status update in the Backend.
- **Step 5:** Backend marks Booking as `paid` and generates a PDF invoice in the `Invoices` table.

#### 2.5 Cash Payment Flow

- **Step 1:** DJ agrees to "Cash on Concert".
- **Step 2:** After the event, DJ clicks **"Mark as Paid/Completed"** in the dashboard.
- **Step 3:** Backend updates the booking status and creates a "Cash" type transaction record for accounting.
