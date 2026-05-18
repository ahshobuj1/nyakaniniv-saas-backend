# Project: Multi-Tenant SaaS DJ Platform

## System Design & Requirements Analysis

### 1. Project Brief

This is a multi-tenant SaaS application designed specifically for DJs. The platform allows DJs to register, manage their subscriptions, and create a personalized portfolio website hosted on a custom subdomain. It bridges the gap between DJs and their clients by providing a central hub for booking, payment management, and event showcase.

---

### 2. Core System Architecture

- **Multi-tenancy:** Isolated data for each DJ (tenant).
- **Subdomain Support:** Each DJ's portfolio is accessible via `djname.platform.com`.
- **Payment Gateway:** Stripe integration for both SaaS subscriptions and DJ-to-Client bookings.

---

### 3. User Roles

1.  **Super Admin:** Manages the platform, monitors subscriptions, and views global invoices.
2.  **DJ (Tenant):** The primary user who manages their portfolio, events, and bookings.
3.  **Client (Visitor):** Public users who visit a DJ's portfolio to book services.

---

### 4. Functional Requirements

#### 4.1 SaaS Onboarding & Authentication

- **Landing Page:** A professional landing page explaining the platform features.
- **Registration:** DJs can sign up for an account.
- **Authentication:** Secure Login/Logout and Password Reset, forget password, otp verification using email only functionality.
- **SaaS Subscription:**
  - Integration with Stripe.
  - DJs must subscribe to a plan to access the dashboard and live portfolio.
  - Subscription details viewable in the DJ Dashboard.

#### 4.2 DJ Dashboard (Tenant Panel)

- **Subscription Management:** View plan details, upcoming payments, and download subscription invoices.
- **Theme Management:**
  - Choose from two premium themes (Landing page layouts).
  - Content Editor: Update Logo, Name, Hero Section, About and all section of that theme.
- **Mix-Tape Management:**
  - Create/Update/Delete Mix-tapes.
  - Fields: Title, Avatar/Cover Image, and External Audio Link (e.g., SoundCloud, Mixcloud).
- **Event Management:**
  - Full CRUD (Create, Read, Update, Delete) for DJ events.
  - Displayed on the live portfolio site.
- **Booking Management:**
  - View incoming booking requests from clients.
  - Track booking status (Pending, Confirmed, Completed, Cancelled).

#### 4.3 Portfolio Engine (Public Site)

- **Subdomain Routing:** Automatically route traffic to the correct DJ's theme based on the subdomain.
- **Dynamic Content:** Display the DJ's customized content, mix-tapes, and events.
- **"Book Now" System:**
  - A dedicated section/form for clients to submit booking requests.
  - Form collects client details and event requirements.

#### 4.4 Payment & Invoicing System

- **DJ-to-Client Payments:**
  - DJ can trigger a payment request to a client via email.
  - Two Payment Modes:
    1.  **Online (Stripe):** DJ sends a Stripe checkout link via email.
    2.  **Cash on Concert:** Client pays in person; DJ manually marks the invoice as "Completed" in the dashboard.
- **Invoicing:**
  - **DJs:** Can view their Subscription Invoices and Booking Invoices (from clients).
  - **Super Admin:** Can view all Subscription Invoices and individual DJ Booking Invoices for auditing.

---

### 5. Data Requirements (Draft)

- **Tenants (DJs):** Domain, Branding (Logo, Colors), Theme Selection.
- **Content:** Hero, About, Mix-tapes (Metadata + Links), Events, Footer all section of the theme.
- **Bookings:** Client info, Date, Status, Payment Type.
- **Invoices:** Transaction IDs, Amounts, Status (Paid/Unpaid), Date.

---

### 6. Technical Stack

- **Backend:** Node.js / Express .
- **Database:** PostgreSQL (Ideal for relational multi-tenancy).
- **Frontend:** React / Next.js (For SEO and Subdomain routing).
- **Styling:** Tailwind and shadcn ui.
- **Payments:** Stripe API.
