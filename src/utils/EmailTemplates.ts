export class EmailTemplates {
  // Case 1 & 3: User Registration OTP / Resend OTP
  static getOtpTemplate(otp: string): string {
    return `
      <h2>Verify your Email Address</h2>
      <p>Here is your One-Time Password (OTP) to verify your account.</p>
      <p><strong>OTP:</strong> <span style="color: #4A90E2; font-size: 24px; font-weight: bold;">${otp}</span></p>
      <p>This code will expire in <strong>15 minutes</strong>.</p>
    `;
  }

  // Case 2: Successful Verification (Welcome Email)
  static getWelcomeTemplate(name: string): string {
    return `
      <h2>Welcome, ${name}! 🎉</h2>
      <p>Your email has been successfully verified, and your account is now active.</p>
      <p>Log in to your DJ dashboard to set up your portfolio and start taking bookings.</p>
    `;
  }

  // Case 4: Forgot Password Request
  static getPasswordResetTemplate(link: string): string {
    return `
      <h2>Password Reset Request</h2>
      <p>You recently requested to reset your password.</p>
      <p>Click the <strong>Reset Password</strong> button below to create a new password.</p>
      <p><strong>Reset Password Link:</strong> <a href="${link}">${link}</a></p>
      <p>If you did not request a password reset, please ignore this email.</p>
    `;
  }

  // Case 5: New Booking Request Alert for DJ
  static getNewBookingAlertTemplate(clientName: string, eventType: string, date: string): string {
    return `
      <h2>New Booking Request!</h2>
      <p>You have received a new booking request from <strong>${clientName}</strong>.</p>
      <h3>Booking Details</h3>
      <ul>
        <li><strong>Event Type:</strong> ${eventType}</li>
        <li><strong>Date:</strong> ${new Date(date).toLocaleString()}</li>
      </ul>
      <p>Please log in to your dashboard to review and accept the booking.</p>
    `;
  }

  // Case 6: Auto-reply to Client for New Booking Request
  static getBookingAutoReplyTemplate(djName: string, eventType: string): string {
    return `
      <h2>Booking Request Received</h2>
      <p>Thank you for submitting your booking request for <strong>${djName}</strong>.</p>
      <p>Your request for a <strong>${eventType}</strong> is currently pending review.</p>
      <p>The DJ will review your request and get back to you shortly.</p>
    `;
  }

  // Case 7: Booking Request Accepted
  static getBookingAcceptedTemplate(djName: string, eventType: string, paymentUrl: string, requestCashUrl: string): string {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2>Booking Request Accepted! 🎉</h2>
        <p>Great news! <strong>${djName}</strong> has accepted your booking request for a <strong>${eventType}</strong>.</p>
        <p>To finalize the booking and secure your event date, please complete your payment using one of the following options:</p>
        <ul>
          <li><strong>Pay Now:</strong> <a href="${paymentUrl}">${paymentUrl}</a></li>
          <li><strong>Request Cash on Payment:</strong> <a href="${requestCashUrl}">${requestCashUrl}</a></li>
        </ul>
      </div>
    `;
  }

  // Case 8: Booking Canceled / Rejected
  static getBookingRejectedTemplate(djName: string, eventType: string): string {
    return `
      <h2>Booking Update</h2>
      <p>Unfortunately, <strong>${djName}</strong> is unable to accept your booking request for a <strong>${eventType}</strong> at this time.</p>
    `;
  }

  // Case 9: Booking Details Updated
  static getBookingUpdatedTemplate(djName: string, eventType: string, date: string): string {
    return `
      <h2>Booking Details Updated</h2>
      <p><strong>${djName}</strong> has updated the details for your <strong>${eventType}</strong> booking.</p>
      <p><strong>Updated Event Date & Time:</strong> ${new Date(date).toLocaleString()}</p>
      <p>Please contact the DJ if you have any questions.</p>
    `;
  }

  // Case 10: Cash Payment Requested by Client
  static getCashPaymentRequestedTemplate(clientName: string, eventType: string): string {
    return `
      <h2>Cash Payment Requested</h2>
      <p><strong>${clientName}</strong> has requested a cash payment for their <strong>${eventType}</strong> booking.</p>
      <p>Once you receive the cash payment, you can mark the booking as paid from your dashboard.</p>
    `;
  }

  // Case 11: Payment Reminder for Booking
  static getPaymentReminderTemplate(djName: string, eventType: string, paymentUrl: string): string {
    return `
      <h2>Payment Reminder ⚠️</h2>
      <p>This is a friendly reminder from <strong>${djName}</strong> regarding your <strong>${eventType}</strong> booking.</p>
      <p>Your payment is still pending.</p>
      <p>Please complete your payment to fully secure your event date.</p>
      <p><strong>Payment Link:</strong> <a href="${paymentUrl}">${paymentUrl}</a></p>
      <p>If you have any questions, please contact the DJ.</p>
    `;
  }

  // Case 12: Payment Receipt
  static getPaymentReceiptTemplate(
    amount: number,
    eventType: string,
    djName: string,
    date: string,
    paymentMethod: string,
    bookingId: string
  ): string {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2>Payment Receipt</h2>
        <p>Thank you!</p>
        <p>Your payment for the booking has been successfully processed.</p>
        <p>Your booking is now fully secured.</p>
        
        <h3>Payment Details</h3>
        <ul>
          <li><strong>Amount Paid:</strong> $${amount.toFixed(2)}</li>
          <li><strong>Payment Method:</strong> ${paymentMethod}</li>
          <li><strong>DJ Name:</strong> ${djName}</li>
          <li><strong>Event Type:</strong> ${eventType}</li>
          <li><strong>Event Date:</strong> ${new Date(date).toLocaleString()}</li>
          <li><strong>Booking ID:</strong> ${bookingId}</li>
        </ul>
        
        <p>Please keep this email as proof of your payment.</p>
      </div>
    `;
  }

  // Case 13: Booking Payment Received Alert (To DJ)
  static getPaymentReceivedAlertTemplate(clientName: string, amount: number): string {
    return `
      <h2>Payment Received! 💰</h2>
      <p>You have successfully received a payment of <strong>$${amount}</strong> from <strong>${clientName}</strong>.</p>
      <p>The booking status is now complete and secured.</p>
    `;
  }

  // Case 14: Subscription Activated
  static getSubscriptionActivatedTemplate(planName: string, nextBillingDate: string): string {
    return `
      <h2>Subscription Activated 🚀</h2>
      <p>Thank you for subscribing to the <strong>${planName}</strong> plan.</p>
      <p>Your premium features are now unlocked.</p>
      <p><strong>Next Billing Date:</strong> ${new Date(nextBillingDate).toLocaleDateString()}</p>
    `;
  }

  // Case 15: New Subscription Alert for Admin
  static getNewSubscriptionAdminAlertTemplate(djEmail: string, planId: number): string {
    return `
      <h2>New Subscription Alert 💸</h2>
      <p>A DJ (<strong>${djEmail}</strong>) has successfully subscribed.</p>
      <p><strong>Plan ID:</strong> ${planId}</p>
    `;
  }

  // Case 16: Subscription Canceled
  static getSubscriptionCanceledTemplate(): string {
    return `
      <h2>Subscription Canceled</h2>
      <p>Your subscription has been canceled successfully.</p>
      <p>You will continue to have access until the end of your current billing cycle.</p>
    `;
  }

  // Case 17: Payment Failed (Subscription Invoice)
  static getPaymentFailedTemplate(): string {
    return `
      <h2>Payment Failed ⚠️</h2>
      <p>We attempted to process your subscription renewal payment, but the payment was unsuccessful.</p>
      <p>Please update your billing details as soon as possible to avoid any interruption to your service.</p>
    `;
  }

  // Case 18: Subscription Expiring Soon
  static getSubscriptionExpiryWarningTemplate(daysLeft: number): string {
    return `
      <h2>Subscription Expiring Soon!</h2>
      <p>Your subscription will expire in <strong>${daysLeft} days</strong>.</p>
      <p>Please ensure your payment method is up to date to avoid interruption and keep your portfolio online.</p>
    `;
  }

  // Case 19: Subscription Expired
  static getSubscriptionExpiredTemplate(): string {
    return `
      <h2>Subscription Expired - Portfolio Offline ⚠️</h2>
      <p>Your subscription has officially expired.</p>
      <p>Your public portfolio is now offline, and your premium features have been disabled.</p>
      <p>Please log in and renew your subscription to reactivate your profile.</p>
    `;
  }

  // Case 20: Subscription Changed
  static getSubscriptionChangedTemplate(planId: number): string {
    return `
      <h2>Subscription Updated</h2>
      <p>Your subscription has been successfully updated.</p>
      <p><strong>New Plan ID:</strong> ${planId}</p>
    `;
  }

  // Case 21: Portfolio Live Notification
  static getPortfolioLiveTemplate(url: string): string {
    return `
      <h2>Your Portfolio is Live! 🌐</h2>
      <p>Congratulations!</p>
      <p>Your personal DJ portfolio is now live and accessible at:</p>
      <p><a href="${url}">${url}</a></p>
      <p>Share this link with your clients so they can view your profile and book you directly.</p>
    `;
  }

  // Case 22: Account Suspended
  static getAccountSuspendedTemplate(): string {
    return `
      <h2>Account Suspended 🚫</h2>
      <p>Your account has been suspended by an administrator.</p>
      <p>If you believe this was done in error, please contact our support team.</p>
    `;
  }

  // Case 23: New Support Ticket Alert for Admin
  static getNewSupportTicketAdminAlertTemplate(djName: string, subject: string, issue: string): string {
    return `
      <h2>New Support Ticket</h2>
      <p>A new support request has been submitted.</p>
      <p><strong>Customer:</strong> ${djName}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Issue Description:</strong></p>
      <p>${issue}</p>
    `;
  }

  // Case 24: Support Ticket Received Auto-reply
  static getSupportTicketReceivedTemplate(subject: string): string {
    return `
      <h2>Support Request Received</h2>
      <p>We have received your support request regarding:</p>
      <p><strong>${subject}</strong></p>
      <p>Our support team will review your request and get back to you shortly.</p>
    `;
  }

  // Case 25: Support Ticket Resolved
  static getSupportTicketResolvedTemplate(subject: string): string {
    return `
      <h2>Support Ticket Resolved ✅</h2>
      <p>Your support ticket regarding "<strong>${subject}</strong>" has been marked as resolved.</p>
      <p>If you need any further assistance, please open a new support ticket.</p>
    `;
  }

  // Case 26: Upcoming Event Reminder (Client or DJ)
  static getUpcomingEventReminderTemplate(eventType: string, date: string, isDJ: boolean): string {
    const message = isDJ ? 'Good luck with the gig!' : 'We hope you enjoy the event!';
    return `
      <h2>Upcoming Event Reminder 📅</h2>
      <p>This is a reminder that your <strong>${eventType}</strong> is scheduled for tomorrow.</p>
      <p><strong>Date & Time:</strong> ${new Date(date).toLocaleString()}</p>
      <p>${message}</p>
    `;
  }
}
