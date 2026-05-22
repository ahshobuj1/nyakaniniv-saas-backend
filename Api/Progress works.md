# Progress Works

This document tracks the active progress of the project.

## ⚙️ Phase 1: Setup & Tracking

- [x] Create `Api/All works.md` with full project checklist.
- [x] Create `Api/Progress works.md` for progress tracking.
- [x] Create `Api/API Documentation.md` for Postman integration.

## 🔑 Phase 2: Core Modules

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

- [x] Create/Manage Plans (Admin).
- [x] Subscribe to Plan (Stripe Integration).
- [x] Cancel Subscription.
- [x] Handle Stripe Webhooks for subscription status.

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
