# Progress Works

This document tracks the active progress of the project.

## ⚙️ Phase 1: Setup & Tracking

- [x] Create `Api/All works.md` with full project checklist.
- [x] Create `Api/Progress works.md` for progress tracking.
- [x] Create `Api/API Documentation.md` for Postman integration.

## 🔑 Phase 2: Core Modules

### User Module

- [x] Implement Get All Users (Admin).
- [x] Implement Get Current User Profile (Me).
- [x] Implement Update Current User Profile.
- [x] Implement Update User Status (Admin).
- [x] Implement Update User Role (Admin).
- [x] Implement Delete User (Admin).

### Auth Module

- [x] Implement Login endpoint (JWT generation).
- [x] Implement Logout endpoint.
- [x] Implement Password Reset flow.
- [x] Implement Email Verification / OTP validation.
- [x] Implement Resend Verification OTP.
- [x] Secure routes with JWT middleware.

### Theme Module

- [x] Create Theme (Admin).
- [x] Get All Themes.
- [x] Get Theme by Slug.
- [x] Update Theme.
- [x] Delete Theme.

### Tenant Module

- [x] Get All Tenants (Admin).
- [x] Create Tenant Profile (DJ onboarding).
- [x] Get Tenant by Subdomain.
- [x] Update Tenant Profile.
- [x] Assign Theme to Tenant.

## ☁️ Phase 3: SaaS & Content

### Subscription Module

- [x] Subscription History Tracking (Auto-Invoicing).
- [x] Webhook integration for Stripe Events.
- [x] Create/Manage Plans (Admin).
- [x] Subscribe to Plan (Stripe Integration).
- [x] Cancel Subscription.
- [x] Handle Stripe Webhooks for subscription status.
- [x] Create Database Seeder for Subscription Plans (Starter, Pro, Elite).
- [x] Implement AccessControlService for plan features.
- [x] Implement checkSubscription middleware for route protection.

### MixTape Module

- [x] Upload MixTape (Integrate AWS S3).
- [x] Get Tenant MixTapes.
- [x] Update MixTape details.
- [x] Delete MixTape.
- [x] Reorder MixTapes.

### Event Module

- [x] Create Event.
- [x] Get Tenant Events (Filtered by upcoming/past).
- [x] Update Event.
- [x] Delete Event.

## 💼 Phase 4: Business Logic

### Booking Module

- [x] Create Booking Request (Public client).
- [x] Get Tenant Bookings (For DJ dashboard).
- [x] Accept/Reject Booking.

### Invoice Module

- [x] Generate Invoice for Booking.
- [x] Generate Invoice for Subscription.
- [x] Pay Invoice (Stripe).

### Webhook Module (Payment & Invoice)
- [x] Implement Stripe Webhook (`checkout.session.completed`).
- [x] Extract `invoiceId` and update Invoice to `paid`.
- [x] Update Booking status to `completed` upon payment.
- [x] Automate DJ Notification on payment receipt.

### Analytics Module
- [x] Implement Admin Dashboard Analytics (Users, Revenue, Subscriptions, Bookings).
- [x] Implement Tenant Dashboard Analytics (Earnings, Invoices, Bookings stats, Requests).
- [x] Implement Admin Dashboard Charts (Revenue, User Growth over 12 months).
- [x] Implement Tenant Dashboard Charts (Earnings, Bookings over 12 months).

## 📣 Phase 5: Support & Communication

### Support Ticket Module

- [x] Create Support Ticket (Public or User).
- [x] Get Support Tickets (Admin).
- [x] Update Ticket Status.

### Notification Module

- [x] Create Notification (Triggered by events).
- [x] Get User Notifications.
- [x] Mark Notification as Read.

## 🌐 Phase 6: Admin Content (Landing Page)

- [x] Manage Landing Page Heroes.
- [x] Manage Landing Page Steps.
- [x] Manage Landing Page Services.
- [x] Manage Landing Page FAQs.
- [x] Manage Landing Page Marquees.
