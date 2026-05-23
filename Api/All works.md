# All Works Checklist

Important: This document contains the complete list of tasks required to build the full backend system. When you completed any works, must update here, [Porgress works.md](<Progress works.md>) file, [API Documentation](<API Documentation.md>) and also add swagger for each endpoin

## 🔑 Phase 2: Core Modules

### 📁 File Upload Service (Plug-and-play)
- [x] Implement generic upload endpoint `POST /uploads/v1/`
> **Note:** Right now we are exclusively using **Cloudinary** for file uploads. In the final step before deployment, we will replace it with **AWS S3** by simply changing the `FILE_UPLOADER` environment variable. The API layer will remain completely untouched.

### Auth Module

- [x] Implement Login endpoint (JWT generation).
- [x] Implement Logout endpoint.
- [x] Implement Password Reset flow.
- [x] Implement Email Verification / OTP validation.
- [x] Implement Resend Verification OTP.
- [x] Secure routes with JWT middleware.

### Theme Module

- [x] Create Theme (Admin - supports multipart/form-data for image upload).
- [x] Get All Themes.
- [x] Get Theme by Slug.
- [x] Update Theme (supports multipart/form-data for image upload).
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

- [x] Create Booking Request (Public client).
- [x] Get Tenant Bookings (For DJ dashboard).
- [x] Accept/Reject Booking (Integrates Stripe Checkout).

### Invoice Module

- [x] Generate Invoice for Booking.
- [ ] Generate Invoice for Subscription.
- [x] Pay Invoice (Stripe Connect).

## 📣 Phase 5: Support & Communication

### Support Ticket Module

- [ ] Create Support Ticket (Public or User).
- [ ] Get Support Tickets (Admin).
- [ ] Update Ticket Status.

### Notification Module

- [x] Create Notification (Triggered by events).
- [x] Get User Notifications.
- [x] Mark Notification as Read.

## 🌐 Phase 6: Admin Content (Landing Page)

- [ ] Manage Landing Page Heroes.
- [ ] Manage Landing Page Steps.
- [ ] Manage Landing Page Services.
- [ ] Manage Landing Page FAQs.
- [ ] Manage Landing Page Marquees.
