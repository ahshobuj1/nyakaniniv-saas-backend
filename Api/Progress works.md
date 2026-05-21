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

- [ ] Create/Manage Plans (Admin).
- [ ] Subscribe to Plan (Stripe Integration).
- [ ] Cancel Subscription.
- [ ] Handle Stripe Webhooks for subscription status.

### MixTape Module

- [ ] Upload MixTape (Integrate AWS S3).
- [ ] Get Tenant MixTapes.
- [ ] Update MixTape details.
- [ ] Delete MixTape.
- [ ] Reorder MixTapes.

### Event Module

- [x] Create Event.
- [x] Get Tenant Events (Filtered by upcoming/past).
- [x] Update Event.
- [x] Delete Event.

## 💼 Phase 4: Business Logic

### Booking Module

- [ ] Create Booking Request (Public client).
- [ ] Get Tenant Bookings (For DJ dashboard).
- [ ] Accept/Reject Booking.

### Invoice Module

- [ ] Generate Invoice for Booking.
- [ ] Generate Invoice for Subscription.
- [ ] Pay Invoice (Stripe).

## 📣 Phase 5: Support & Communication

### Support Ticket Module

- [ ] Create Support Ticket (Public or User).
- [ ] Get Support Tickets (Admin).
- [ ] Update Ticket Status.

### Notification Module

- [ ] Create Notification (Triggered by events).
- [ ] Get User Notifications.
- [ ] Mark Notification as Read.

## 🌐 Phase 6: Admin Content (Landing Page)

- [ ] Manage Landing Page Heroes.
- [ ] Manage Landing Page Steps.
- [ ] Manage Landing Page Services.
- [ ] Manage Landing Page FAQs.
- [ ] Manage Landing Page Marquees.
