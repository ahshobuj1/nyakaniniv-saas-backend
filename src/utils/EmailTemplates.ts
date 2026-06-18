export class EmailTemplates {
  static getOtpTemplate(otp: string): string {
    return `
      <h2>Verify your Email Address</h2>
      <p>Here is your One Time Password (OTP) to verify your account:</p>
      <h1 style="color: #4A90E2;">${otp}</h1>
      <p>This code will expire in 15 minutes.</p>
    `;
  }

  static getWelcomeTemplate(name: string): string {
    return `
      <h2>Welcome, ${name}! 🎉</h2>
      <p>Your email has been successfully verified, and your account is now fully active.</p>
      <p>Log in to your dashboard to set up your portfolio and start taking bookings.</p>
    `;
  }

  static getPasswordResetTemplate(link: string): string {
    return `
      <h2>Password Reset Request</h2>
      <p>You recently requested to reset your password. Click the link below to set a new password:</p>
      <a href="${link}" style="display:inline-block; padding:10px 20px; background-color:#4A90E2; color:#fff; text-decoration:none;">Reset Password</a>
      <p>If you did not request a password reset, please ignore this email.</p>
    `;
  }

  static getNewBookingAlertTemplate(clientName: string, eventType: string, date: string): string {
    return `
      <h2>New Booking Request!</h2>
      <p>You have received a new booking request from <strong>${clientName}</strong>.</p>
      <ul>
        <li><strong>Event Type:</strong> ${eventType}</li>
        <li><strong>Date:</strong> ${new Date(date).toLocaleString()}</li>
      </ul>
      <p>Log in to your dashboard to review and accept the booking.</p>
    `;
  }

  static getBookingAutoReplyTemplate(djName: string, eventType: string): string {
    return `
      <h2>Booking Request Received</h2>
      <p>Thank you for submitting your booking request for <strong>${djName}</strong>.</p>
      <p>Your request for a ${eventType} is currently pending review. The DJ will review your request and get back to you shortly.</p>
    `;
  }

  static getBookingAcceptedTemplate(djName: string, eventType: string, paymentUrl: string, requestCashUrl: string): string {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #28a745; border-bottom: 2px solid #eee; padding-bottom: 10px;">Booking Request Accepted! 🎉</h2>
        <p>Great news! <strong>${djName}</strong> has accepted your booking request for a ${eventType}.</p>
        <p>To finalize the booking and secure the date, please complete your payment using the link below:</p>
        <div style="margin-top: 20px;">
          <a href="${paymentUrl}" style="display:inline-block; padding:12px 24px; background-color:#28a745; color:#fff; text-decoration:none; border-radius:5px; margin-right: 10px;">Pay Now</a>
          <a href="${requestCashUrl}" style="display:inline-block; padding:12px 24px; background-color:#ffc107; color:#000; text-decoration:none; border-radius:5px;">Request Cash on Payment</a>
        </div>
      </div>
    `;
  }

  static getBookingUpdatedTemplate(djName: string, eventType: string, date: string): string {
    return `
      <h2>Booking Details Updated</h2>
      <p><strong>${djName}</strong> has updated the details for your ${eventType} booking.</p>
      <p><strong>New Event Date/Time:</strong> ${new Date(date).toLocaleString()}</p>
      <p>Please contact the DJ if you have any questions.</p>
    `;
  }

  static getBookingRejectedTemplate(djName: string, eventType: string): string {
    return `
      <h2>Booking Update</h2>
      <p>Unfortunately, <strong>${djName}</strong> is unable to accept your booking request for a ${eventType} at this time.</p>
    `;
  }

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
        <h2 style="color: #28a745; border-bottom: 2px solid #eee; padding-bottom: 10px;">Payment Receipt</h2>
        <p>Thank you! Your payment for the booking has been successfully processed.</p>
        <p>Your booking is completely secured. Below are the details of your payment and event.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Amount Paid:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">$${amount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Payment Method:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${paymentMethod}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>DJ Name:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${djName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Event Type:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${eventType}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Event Date:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${new Date(date).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Booking ID:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><span style="font-size: 0.9em; color: #666;">${bookingId}</span></td>
          </tr>
        </table>
        
        <p style="margin-top: 30px; font-size: 0.9em; color: #777;">Please keep this email as proof of your payment.</p>
      </div>
    `;
  }

  static getPaymentReceivedAlertTemplate(clientName: string, amount: number): string {
    return `
      <h2>Payment Received! 💰</h2>
      <p>You have successfully received a payment of <strong>$${amount}</strong> from ${clientName}.</p>
      <p>The booking status is now complete/secured.</p>
    `;
  }

  static getSubscriptionActivatedTemplate(planName: string, nextBillingDate: string): string {
    return `
      <h2>Subscription Activated 🚀</h2>
      <p>Thank you for subscribing to the <strong>${planName}</strong> plan!</p>
      <p>Your premium features are now unlocked. Your next billing date is ${new Date(nextBillingDate).toLocaleDateString()}.</p>
    `;
  }

  static getNewSubscriptionAdminAlertTemplate(djEmail: string, planId: number): string {
    return `
      <h2>New Subscription Alert 💸</h2>
      <p>A DJ (${djEmail}) has just subscribed to Plan ID: ${planId}.</p>
    `;
  }

  static getSubscriptionExpiryWarningTemplate(daysLeft: number): string {
    return `
      <h2>Subscription Expiring Soon!</h2>
      <p>Your subscription is set to expire in <strong>${daysLeft} days</strong>.</p>
      <p>Please ensure your payment method is up to date to avoid any interruption and keep your portfolio online.</p>
    `;
  }

  static getSubscriptionExpiredTemplate(): string {
    return `
      <h2>Subscription Expired - Portfolio Offline ⚠️</h2>
      <p>Your subscription has officially expired.</p>
      <p>Your public portfolio is now offline and premium features are disabled. Please log in and renew your subscription to reactivate your profile.</p>
    `;
  }

  static getSubscriptionCanceledTemplate(): string {
    return `
      <h2>Subscription Canceled</h2>
      <p>Your subscription has been canceled successfully. Your current access will remain until the end of your billing cycle.</p>
    `;
  }

  static getSubscriptionChangedTemplate(planId: number): string {
    return `
      <h2>Subscription Updated</h2>
      <p>Your subscription has been successfully updated to Plan ID: ${planId}.</p>
    `;
  }

  static getPaymentFailedTemplate(): string {
    return `
      <h2>Payment Failed ⚠️</h2>
      <p>We attempted to charge your card for your subscription renewal, but the payment failed.</p>
      <p>Please update your billing details in your dashboard as soon as possible.</p>
    `;
  }

  static getNewSupportTicketAdminAlertTemplate(djName: string, subject: string, issue: string): string {
    return `
      <h2>New Support Ticket</h2>
      <p><strong>From:</strong> ${djName}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Issue:</strong></p>
      <p>${issue}</p>
    `;
  }

  static getSupportTicketReceivedTemplate(subject: string): string {
    return `
      <h2>Support Request Received</h2>
      <p>We have received your support request regarding: <strong>${subject}</strong></p>
      <p>Our team will review this and get back to you shortly.</p>
    `;
  }

  static getSupportTicketResolvedTemplate(subject: string): string {
    return `
      <h2>Support Ticket Resolved ✅</h2>
      <p>Your support ticket regarding "<strong>${subject}</strong>" has been marked as resolved.</p>
      <p>If you need further assistance, please open a new ticket.</p>
    `;
  }

  static getPortfolioLiveTemplate(url: string): string {
    return `
      <h2>Your Portfolio is Live! 🌐</h2>
      <p>Congratulations! Your personal DJ portfolio is now live and accessible at:</p>
      <a href="${url}">${url}</a>
      <p>Share this link with your clients so they can view your mixtapes and book you directly!</p>
    `;
  }

  static getAccountSuspendedTemplate(): string {
    return `
      <h2>Account Suspended 🚫</h2>
      <p>Your account has been suspended by an administrator.</p>
      <p>If you believe this was in error, please contact support.</p>
    `;
  }

  static getUpcomingEventReminderTemplate(eventType: string, date: string, isDJ: boolean): string {
    return `
      <h2>Upcoming Event Reminder 📅</h2>
      <p>This is a reminder that your ${eventType} is scheduled for tomorrow.</p>
      <p><strong>Date & Time:</strong> ${new Date(date).toLocaleString()}</p>
      <p>${isDJ ? 'Good luck with the gig!' : 'We hope you enjoy the event!'}</p>
    `;
  }

  static getPaymentReminderTemplate(djName: string, eventType: string, paymentUrl: string): string {
    return `
      <h2>Payment Reminder ⚠️</h2>
      <p>This is a friendly reminder from <strong>${djName}</strong> regarding your ${eventType} booking.</p>
      <p>Your payment is still pending. Please complete the payment to fully secure your event date.</p>
      <br/>
      <a href="${paymentUrl}" style="display:inline-block; padding:12px 24px; background-color:#ffc107; color:#000; text-decoration:none; border-radius:5px;">Pay Now</a>
      <p>If you have any questions, please contact the DJ.</p>
    `;
  }
}
