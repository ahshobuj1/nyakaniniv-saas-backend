# API Documentation

This document contains the API endpoints for the project. You can use this to manually test or integrate with Postman.

## Base URL

`http://localhost:3030`

> **Note:** A complete, interactive Swagger documentation is available at `http://localhost:3030/api-docs`. It includes all modules: Auth, Theme, Tenant, Event, Subscription, MixTape, Booking, Invoice, Support Ticket, Notification, and Landing Page.

---

## 📊 Analytics Module

### 1. Get Admin Analytics
- **URL:** `/analytics/v1/admin`
- **Method:** `GET`
- **Description:** Retrieve platform-wide metrics: total users, total revenue, subscription metrics, and recent bookings.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:** `200 OK`

### 2. Get Tenant Analytics
- **URL:** `/analytics/v1/tenant`
- **Method:** `GET`
- **Description:** Retrieve DJ-specific metrics: total earnings, pending invoices, and booking statistics. Requires active subscription.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:** `200 OK`

### 3. Get Admin Charts
- **URL:** `/analytics/v1/admin/charts`
- **Method:** `GET`
- **Description:** Retrieve time-series data for admin charts (revenue over time, user growth).
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:** `200 OK`

### 4. Get Tenant Charts
- **URL:** `/analytics/v1/tenant/charts`
- **Method:** `GET`
- **Description:** Retrieve time-series data for DJ charts (earnings over time, bookings over time). Requires active subscription.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:** `200 OK`

---

## 🪝 Webhook Module

### 1. Stripe Webhook (Payments & Invoices)
- **URL:** `/webhooks/v1/stripe`
- **Method:** `POST`
- **Description:** Centralized endpoint to listen for Stripe events (e.g. `checkout.session.completed`). Updates Invoices to `paid` and Bookings to `completed`.
- **Headers:** `stripe-signature: <signature>`
- **Body:** Raw Body
- **Success Response:** `200 OK`

---

## 👤 User Module

### 1. Get All Users (Admin)
- **URL:** `/users/v1/`
- **Method:** `GET`
- **Description:** Get all users with pagination and search.
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:** `page`, `limit`, `search`
- **Success Response:** `200 OK`

### 2. Get Current Profile
- **URL:** `/users/v1/me`
- **Method:** `GET`
- **Description:** Get the logged-in user profile.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:** `200 OK`

### 3. Update Current Profile
- **URL:** `/users/v1/me`
- **Method:** `PATCH`
- **Description:** Update first name, last name, profile image.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:** `200 OK`

### 4. Update User Status (Admin)
- **URL:** `/users/v1/:id/status`
- **Method:** `PATCH`
- **Description:** Update user verification status.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:** `200 OK`

### 5. Update User Role (Admin)
- **URL:** `/users/v1/:id/role`
- **Method:** `PATCH`
- **Description:** Update user role to SUPER_ADMIN or DJ.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:** `200 OK`

### 6. Delete User (Admin)
- **URL:** `/users/v1/:id`
- **Method:** `DELETE`
- **Description:** Delete a user account.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:** `200 OK`

---

## 🔑 Auth Module

### 1. Register User

- **URL:** `/auth/v1/register`
- **Method:** `POST`
- **Description:** Register a new user (DJ or Admin).
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "password": "strongPassword123"
  }
  ```
- **Success Response:**
  - **Code:** 201
  - **Content:** User registered successfully. Please verify your email. (Returns user object without password)

### 2. Verify OTP

- **URL:** `/auth/v1/verify`
- **Method:** `POST`
- **Description:** Verify the user's email using the OTP sent to their email.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otp": "123456"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Email verified successfully. Returns JWT token and user info.

### 3. Resend Verification OTP

- **URL:** `/auth/v1/resend-otp`
- **Method:** `POST`
- **Description:** Request a new verification OTP for an unverified account.
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** If your account exists and is not verified, a new OTP has been sent.

### 4. Login

- **URL:** `/auth/v1/login`
- **Method:** `POST`
- **Description:** Authenticate user and get JWT.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "strongPassword123"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Login successful. Returns JWT token and user info.

### 5. Logout

- **URL:** `/auth/v1/logout`
- **Method:** `POST`
- **Description:** Logout user.
- **Headers:**
  - `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200
  - **Content:** Logout successful.

### 6. Forgot Password

- **URL:** `/auth/v1/forgot-password`
- **Method:** `POST`
- **Description:** Request a password reset OTP.
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** If an account exists with that email, a password reset OTP has been sent.

### 7. Reset Password

- **URL:** `/auth/v1/reset-password`
- **Method:** `POST`
- **Description:** Reset password using the OTP.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otp": "123456",
    "newPassword": "newStrongPassword123"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Password has been reset successfully.

## 🏢 Tenant Module

### 1. Create Tenant Profile (Onboarding)

- **URL:** `/tenant/v1/onboard`
- **Method:** `POST`
- **Description:** Create the initial DJ profile (subdomain, stage name, location, genres).
- **Headers:**
  - `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "subdomain": "dj-alex",
    "stageName": "Alex Vibes",
    "country": "USA",
    "city": "New York",
    "genres": ["House", "Techno"]
  }
  ```
- **Success Response:**
  - **Code:** 201
  - **Content:** Tenant profile created successfully. Returns created tenant object.

### 2. Get All Tenants (Admin Only)

- **URL:** `/tenant/v1/`
- **Method:** `GET`
- **Description:** Fetch a paginated list of all tenants across the platform. Includes the basic user info.
- **Headers:**
  - `Authorization: Bearer <token>`
- **Query Parameters:**
  - `page` (optional): Page number, default 1
  - `limit` (optional): Items per page, default 10
- **Success Response:**
  - **Code:** 200
  - **Content:** Paginated list of tenants.

### 3. Get Public Profile

- **URL:** `/tenant/v1/:subdomain`
- **Method:** `GET`
- **Description:** Fetch the public portfolio data for rendering the DJ website.
- **Success Response:**
  - **Code:** 200
  - **Content:** Tenant profile retrieved successfully. Includes nested Theme, MixTapes, and Events.

### 3. Update Tenant Profile

- **URL:** `/tenant/v1/profile`
- **Method:** `PUT`
- **Description:** Update bio, social links, logo, and other details.
- **Headers:**
  - `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "bio": "International DJ based in NY",
    "socialLinks": {
      "instagram": "https://instagram.com/alexvibes"
    }
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Tenant profile updated successfully.

### 4. Assign Theme

- **URL:** `/tenant/v1/theme`
- **Method:** `PUT`
- **Description:** Choose or change the portfolio theme.
- **Headers:**
  - `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "themeId": 1
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Theme assigned successfully.

## 🎨 Theme Module

### 1. Get All Themes

- **URL:** `/themes/v1/`
- **Method:** `GET`
- **Description:** Fetch a list of all themes.
- **Success Response:**
  - **Code:** 200
  - **Content:** List of themes.

### 2. Get Theme by Slug

- **URL:** `/themes/v1/slug/:slug`
- **Method:** `GET`
- **Description:** Fetch a specific theme by its slug.
- **Success Response:**
  - **Code:** 200
  - **Content:** Theme object.

### 3. Create Theme (Admin)

- **URL:** `/themes/v1/`
- **Method:** `POST`
- **Description:** Create a new theme. Supports `multipart/form-data`.
- **Headers:**
  - `Authorization: Bearer <token>`
- **Request Body:** (`multipart/form-data`)
  - `name`: "Dark Mode Theme"
  - `slug`: "dark-mode"
  - `previewImage`: (File - optional)
  - `data`: (Optional) JSON string containing `defaultConfig` or other fields.
- **Success Response:**
  - **Code:** 201
  - **Content:** Theme created successfully.

### 4. Update Theme (Admin)

- **URL:** `/themes/v1/:id`
- **Method:** `PATCH`
- **Description:** Update an existing theme. Supports `multipart/form-data`.
- **Headers:**
  - `Authorization: Bearer <token>`
- **Request Body:** (`multipart/form-data`)
  - `name`: "Updated Theme Name" (Optional)
  - `slug`: "updated-slug" (Optional)
  - `previewImage`: (File - optional)
  - `data`: (Optional) JSON string containing `defaultConfig` or other fields.
- **Success Response:**
  - **Code:** 200
  - **Content:** Theme updated successfully.

### 5. Delete Theme (Admin)

- **URL:** `/themes/v1/:id`
- **Method:** `DELETE`
- **Description:** Delete a theme by ID.
- **Headers:**
  - `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200
  - **Content:** Theme deleted successfully.

## 📅 Event Module

### 1. Get Tenant Events

- **URL:** `/events/v1/tenant/:tenantId`
- **Method:** `GET`
- **Description:** Fetch all events for a specific tenant.
- **Success Response:**
  - **Code:** 200
  - **Content:** List of events for the given tenant.

### 2. Get Event by ID

- **URL:** `/events/v1/:id`
- **Method:** `GET`
- **Description:** Fetch a specific event by its ID.
- **Success Response:**
  - **Code:** 200
  - **Content:** Event object.

### 3. Create Event (DJ)

- **URL:** `/events/v1/`
- **Method:** `POST`
- **Description:** Create a new event for the logged-in DJ (Tenant).
- **Headers:**
  - `Authorization: Bearer <token>`
- **Request Body:** (`application/json`)
  ```json
  {
    "title": "Summer Beach Party",
    "description": "The biggest beach party of the year.",
    "eventDate": "2026-07-15T20:00:00Z",
    "venueName": "Miami Beach",
    "venueAddress": "Ocean Drive, Miami, FL",
    "capacity": 500,
    "price": 25.00,
    "status": "upcoming"
  }
  ```
- **Success Response:**
  - **Code:** 201
  - **Content:** Event created successfully.

### 4. Update Event (DJ)

- **URL:** `/events/v1/:id`
- **Method:** `PATCH`
- **Description:** Update an existing event.
- **Headers:**
  - `Authorization: Bearer <token>`
- **Request Body:** (`application/json`)
  ```json
  {
    "title": "Updated Summer Beach Party",
    "price": 30.00
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Event updated successfully.

### 5. Delete Event (DJ)

- **URL:** `/events/v1/:id`
- **Method:** `DELETE`
- **Description:** Delete an event by ID.
- **Headers:**
  - `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200
  - **Content:** Event deleted successfully.

---

## 💳 Subscription Module

> **Note:** The `checkSubscription(['FEATURE_NAME'])` middleware is now available and should be applied to DJ endpoints to ensure they have an active plan and necessary features (e.g. `ONLINE_PAYMENTS`).


### 1. Get All Subscription Plans
- **URL:** `/subscriptions/v1/plans`
- **Method:** `GET`
- **Description:** Fetch all available subscription plans.
- **Success Response:**
  - **Code:** 200
  - **Content:** List of subscription plans.

### 2. Create Subscription Plan (Admin)
- **URL:** `/subscriptions/v1/plans`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "name": "Basic",
    "priceMonthly": 9.99,
    "priceAnnually": 99.99,
    "discountPercentage": 10,
    "features": ["CUSTOM_SUBDOMAIN", "ONLINE_PAYMENTS"]
  }
  ```
- **Success Response:**
  - **Code:** 201
  - **Content:** Plan created successfully.

### 3. Update Subscription Plan (Admin)
- **URL:** `/subscriptions/v1/plans/:id`
- **Method:** `PATCH`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:** Partial plan object
- **Success Response:**
  - **Code:** 200
  - **Content:** Plan updated successfully.

### 4. Delete Subscription Plan (Admin)
- **URL:** `/subscriptions/v1/plans/:id`
- **Method:** `DELETE`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 5. Get My Active Subscription (DJ)
- **URL:** `/subscriptions/v1/my-subscription`
- **Method:** `GET`
- **Description:** Fetch the currently active subscription and its plan details for the logged-in DJ.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200
  - **Content:** Returns the `Subscription` object, including nested `plan` object (features, limits, etc.).

### 6. Subscribe to Plan
- **URL:** `/subscriptions/v1/subscribe`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "planId": 1,
    "billingCycle": "monthly"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Returns Stripe Checkout URL or Mock URL.

### 7. Cancel Subscription
- **URL:** `/subscriptions/v1/cancel`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

## 🎵 MixTape Module

### 1. Create MixTape
- **URL:** `/mixtapes/v1/`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:** (`multipart/form-data`)
  - `title`: "My Mix"
  - `audioUrl`: "https://s3.url/audio.mp3"
  - `coverImage`: (File - optional)
- **Success Response:**
  - **Code:** 201

### 2. Get My MixTapes
- **URL:** `/mixtapes/v1/`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 3. Update MixTape
- **URL:** `/mixtapes/v1/:id`
- **Method:** `PATCH`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:** (`multipart/form-data`)
- **Success Response:**
  - **Code:** 200

### 4. Delete MixTape
- **URL:** `/mixtapes/v1/:id`
- **Method:** `DELETE`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 5. Reorder MixTapes
- **URL:** `/mixtapes/v1/reorder`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "orders": [
      { "id": "uuid-1", "order": 0 },
      { "id": "uuid-2", "order": 1 }
    ]
  }
  ```
- **Success Response:**
  - **Code:** 200

## 📆 Booking Module

### 1. Create Booking (Public)
- **URL:** `/bookings/v1/`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "tenantId": "uuid-tenant",
    "clientName": "John Doe",
    "clientEmail": "john@example.com",
    "clientPhone": "1234567890",
    "eventDate": "2026-10-10T20:00:00Z",
    "eventType": "Wedding",
    "eventDetails": "Looking forward to it!",
    "address": "Grand Hall, 123 Main St"
  }
  ```
- **Success Response:**
  - **Code:** 201

### 2. Get My Bookings (DJ)
- **URL:** `/bookings/v1/`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 3. Update Booking Status (DJ)
- **URL:** `/bookings/v1/:id/status`
- **Method:** `PATCH`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "status": "ACCEPTED",
    "totalAmount": 500.00
  }
  ```
- **Description:** Accepts booking, generates a booking payment, and returns a `checkoutUrl` for Stripe.
- **Success Response:**
  - **Code:** 200

### 4. Request Cash Payment (Public)
- **URL:** `/bookings/v1/:id/request-cash`
- **Method:** `PATCH`
- **Description:** Client can request to pay a booking with Cash if they do not have a card. Sets the payment method to CASH and notifies the DJ.
- **Success Response:**
  - **Code:** 200

---

## 🔗 Stripe Connect Module

### 1. Get Onboarding Link (DJ)
- **URL:** `/stripe-connect/v1/onboard`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "tenantId": "uuid-tenant",
    "returnUrl": "https://yourfrontend.com/settings/stripe/return",
    "refreshUrl": "https://yourfrontend.com/settings/stripe/refresh"
  }
  ```
- **Success Response:**
  - **Code:** 200
  - **Content:** Returns Stripe Connect onboarding URL and account ID.

### 2. Check Account Status (DJ)
- **URL:** `/stripe-connect/v1/status`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:** `tenantId=uuid-tenant`
- **Success Response:**
  - **Code:** 200
  - **Content:** Returns `isConnected`, `detailsSubmitted`, and `payoutsEnabled`.

## 👥 Client Module

### 1. Get My Clients (DJ)
- **URL:** `/clients/v1/`
- **Method:** `GET`
- **Description:** Returns all clients that have booked the DJ (Mini-CRM).
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 2. Get Client Details (DJ)
- **URL:** `/clients/v1/:id`
- **Method:** `GET`
- **Description:** Returns a specific client and their booking history.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

## 🧾 Subscription Invoice Module

### 1. Get My Subscription Invoices (DJ)
- **URL:** `/subscription-invoices/v1/my-invoices`
- **Method:** `GET`
- **Description:** Returns **Subscription Invoices** for the DJ. Subscription invoices are automatically generated when subscribing to a plan.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 2. Get All Subscription Invoices (Admin)
- **URL:** `/subscription-invoices/v1/`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

## 💳 Invoice Module (Payments)

### 1. Get My Booking Payments/Invoices (DJ)
- **URL:** `/invoices/v1/my-invoices`
- **Method:** `GET`
- **Description:** Returns all **Invoices & Booking Payments** requested or received by the DJ from their clients.
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 2. Pay Booking (Public)
- **URL:** `/invoices/v1/:id/pay`
- **Method:** `POST`
- **Description:** Returns Stripe Checkout URL to pay for the booking.
- **Success Response:**
  - **Code:** 200

### 3. Mark Booking Paid (Cash)
- **URL:** `/invoices/v1/:id/mark-paid`
- **Method:** `PATCH`
- **Headers:** `Authorization: Bearer <token>`
- **Description:** DJ can mark a booking payment as paid if paid in cash. This completes the booking and emails the payment receipt to the client.
- **Success Response:**
  - **Code:** 200

## 🎫 Support Ticket Module

### 1. Create Ticket
- **URL:** `/tickets/v1/`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "subject": "Help",
    "message": "I need help with my account",
    "contactEmail": "user@test.com"
  }
  ```
- **Success Response:**
  - **Code:** 201

### 2. Get My Tickets (User)
- **URL:** `/tickets/v1/my-tickets`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 3. Get All Tickets (Admin)
- **URL:** `/tickets/v1/`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 4. Update Ticket Status (Admin)
- **URL:** `/tickets/v1/:id/status`
- **Method:** `PATCH`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "status": "RESOLVED"
  }
  ```
- **Success Response:**
  - **Code:** 200

## 🔔 Notification Module

### 1. Get My Notifications
- **URL:** `/notifications/v1/`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 2. Mark Notification as Read
- **URL:** `/notifications/v1/:id/read`
- **Method:** `PATCH`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response:**
  - **Code:** 200

### 3. Broadcast Notification (Admin)
- **URL:** `/notifications/v1/broadcast`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "title": "System Update",
    "message": "Downtime expected at midnight",
    "type": "SYSTEM",
    "targetUserId": "optional-uuid"
  }
  ```
- **Success Response:**
  - **Code:** 201

## 🌐 Landing Page Module

### 1. Get Landing Page Content
- **URL:** `/landing-page/v1/content`
- **Method:** `GET`
- **Description:** Fetch the public landing page data (Heroes, Steps, Services, FAQs, Marquees).
- **Success Response:**
  - **Code:** 200

### 2. Manage Content (Admin)
The following resources follow standard CRUD (`POST /`, `PATCH /:id`, `DELETE /:id`). Support `multipart/form-data` for image uploads.
- **Hero:** `/landing-page/v1/hero`
- **Step:** `/landing-page/v1/step`
- **Service:** `/landing-page/v1/service`
- **FAQ:** `/landing-page/v1/faq`
- **Marquee:** `/landing-page/v1/marquee`
