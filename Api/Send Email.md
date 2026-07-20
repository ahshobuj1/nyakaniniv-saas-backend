# 📧 Comprehensive System Email Triggers & Notifications

After a deep analysis of the application requirements, database schema (`schema.prisma`), and user flows, here is the complete, exhaustive list of all necessary email triggers required for the platform to function professionally.

## 1. Authentication & Security (`User` Model)
- **Registration OTP:** Sent to verify email addresses during initial sign-up.
- **Resend OTP:** Sent when a user requests a new OTP because their previous one expired or was lost.
- **Welcome Email:** Sent to the DJ immediately after OTP verification is successful, welcoming them to the platform.
- **Portfolio is Live:** Sent to the DJ when they successfully configure their Tenant profile and subdomain.
- **Password Reset:** Sent containing an OTP or secure reset link when a user forgets their password.
- **Account Suspended:** Sent to the DJ if an Admin manually deactivates or suspends their account.

## 2. SaaS Subscriptions (`Subscription` & `SubscriptionInvoice` Models)
- **Subscription Activated:** Sent to the **DJ** confirming their new plan, features unlocked, and next billing date.
- **Subscription Changed (Upgrade/Downgrade):** Sent to the **DJ** if they switch to a different pricing plan.
- **New Subscription Alert:** Sent to the **Admin** alerting them of a new paid subscriber (revenue alert).
- **Subscription Expiry Warning (7 Days):** Sent to the **DJ** exactly 1 week before their period ends.
- **Subscription Expiry Warning (1 Day):** Sent to the **DJ** exactly 24 hours before their period ends.
- **Subscription Expired / Portfolio Offline:** Sent to the **DJ** when their subscription officially ends, warning them that their public subdomain is now inactive.
- **Subscription Canceled:** Sent to the **DJ** confirming their manual cancellation.
- **Payment Failed (Stripe Webhook):** Sent to the **DJ** if their recurring automatic card charge fails.

## 3. Booking System (`Booking` & `BookingPayment` Models)
- **New Booking Request Alert:** Sent to the **DJ** immediately when a client submits the booking form on their portfolio.
- **Booking Request Received (Auto-reply):** Sent to the **Client** confirming their request was successfully sent to the DJ and is pending review.
- **Booking Accepted & Payment Link:** Sent to the **Client** when the DJ accepts. Includes event details, DJ contact info, and the Stripe Checkout link.
- **Booking Updated:** Sent to the **Client** if the DJ manually changes the event date, time, or details of an existing booking.
- **Booking Rejected/Canceled:** Sent to the **Client** if the DJ declines or cancels the booking.
- **Booking Payment Receipt:** Sent to the **Client** upon successful Stripe payment (or manual Cash verification). Serves as an official invoice/receipt.
- **Payment Received Alert:** Sent to the **DJ** notifying them that a client has successfully paid for a booking.
- **Upcoming Event Reminder:** Sent to **Both DJ and Client** 24 hours before the `eventDate` mapped in the booking.

## 4. Support & CRM (`SupportTicket` Model)
- **New Support Ticket Opened:** Sent to the **Admin** with the DJ's full details and issue description.
- **Ticket Received (Auto-reply):** Sent to the **DJ** confirming their support request has been logged and an admin will review it shortly.
- **Ticket Resolved/Updated:** Sent to the **DJ** when an admin changes the `TicketStatus` to `resolved` or updates the ticket.
