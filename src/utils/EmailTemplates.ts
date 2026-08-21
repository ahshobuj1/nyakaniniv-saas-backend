export class EmailTemplates {
  private static getHtmlShell(title: string, content: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); max-width: 600px; margin: 0 auto; overflow: hidden;">
                <!-- Header -->
                <tr>
                  <td style="background-color: #dc2626; padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">UpBeat Entertainment Africa</h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px; color: #333333; line-height: 1.6; font-size: 16px;">
                    ${content}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0;">&copy; ${new Date().getFullYear()} UpBeat Entertainment Africa. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  // Case 1 & 3: User Registration OTP / Resend OTP
  static getOtpTemplate(otp: string): string {
    const content = `
      <p>Here is your One-Time Password (OTP) to verify your account.</p>
      <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 6px; margin: 25px 0;">
        <span style="color: #dc2626; font-size: 32px; font-weight: bold; letter-spacing: 4px;">${otp}</span>
      </div>
      <p>This code will expire in <strong>15 minutes</strong>.</p>
    `;
    return this.getHtmlShell("Verify your Email Address", content);
  }

  // Case 2: Successful Verification (Welcome Email)
  static getWelcomeTemplate(name: string): string {
    const content = `
      <p>Your email has been successfully verified, and your account is now active on <strong>UpBeat Entertainment Africa</strong>.</p>
      <p>Log in to your DJ dashboard to set up your portfolio, manage themes, and start taking bookings.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://deejay.africa/login" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
      </div>
    `;
    return this.getHtmlShell("Welcome to UpBeat Entertainment Africa", content);
  }

  // Case 4: Forgot Password Request
  static getPasswordResetTemplate(link: string): string {
    const content = `
      <p>You recently requested to reset your password for your UpBeat Entertainment Africa account.</p>
      <p>Click the <strong>Reset Password</strong> button below to create a new password.</p>
      <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
      </div>
      <p style="font-size: 14px; color: #6b7280;">If you did not request a password reset, please ignore this email.</p>
    `;
    return this.getHtmlShell("Reset Your Password", content);
  }

  // Case 5: New Booking Request Alert for DJ
  static getNewBookingAlertTemplate(clientName: string, eventType: string, date: string): string {
    const content = `
      <p>You have received a new booking request from <strong>${clientName}</strong>.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #334155; font-size: 18px;">Booking Details</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li style="margin-bottom: 10px;"><strong>Event Type:</strong> ${eventType}</li>
          <li><strong>Date:</strong> ${new Date(date).toLocaleString()}</li>
        </ul>
      </div>
      <p>Please log in to your dashboard to review and accept the booking.</p>
    `;
    return this.getHtmlShell("New Booking Request", content);
  }

  // Case 6: Auto-reply to Client for New Booking Request
  static getBookingAutoReplyTemplate(djName: string, eventType: string): string {
    const content = `
      <p>Thank you for submitting your booking request for <strong>${djName}</strong> on UpBeat Entertainment Africa.</p>
      <p>Your request for a <strong>${eventType}</strong> is currently pending review.</p>
      <p>The DJ will review your request and get back to you shortly.</p>
    `;
    return this.getHtmlShell("Booking Request Received", content);
  }

  // Case 7: Booking Request Accepted
  static getBookingAcceptedTemplate(djName: string, eventType: string, paymentUrl: string, requestCashUrl: string): string {
    const content = `
      <p>Great news! <strong>${djName}</strong> has accepted your booking request for a <strong>${eventType}</strong>.</p>
      <p>To finalize the booking and secure your event date, please complete your payment using one of the following options:</p>
      <div style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
        <a href="${paymentUrl}" style="display: inline-block; padding: 12px 24px; margin-right: 15px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 10px;">Pay Now</a>
        <a href="${requestCashUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1f2937; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 10px;">Request Cash on Payment</a>
      </div>
    `;
    return this.getHtmlShell("Booking Request Accepted", content);
  }

  // Case 8: Booking Canceled / Rejected
  static getBookingRejectedTemplate(djName: string, eventType: string): string {
    const content = `
      <p>Unfortunately, <strong>${djName}</strong> is unable to accept your booking request for a <strong>${eventType}</strong> at this time.</p>
      <p>We encourage you to explore other talented DJs on UpBeat Entertainment Africa for your event.</p>
    `;
    return this.getHtmlShell("Booking Update", content);
  }

  // Case 9: Booking Details Updated
  static getBookingUpdatedTemplate(djName: string, eventType: string, date: string): string {
    const content = `
      <p><strong>${djName}</strong> has updated the details for your <strong>${eventType}</strong> booking.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Updated Event Date & Time:</strong><br/> ${new Date(date).toLocaleString()}</p>
      </div>
      <p>Please contact the DJ if you have any questions.</p>
    `;
    return this.getHtmlShell("Booking Details Updated", content);
  }

  // Case 10: Cash Payment Requested by Client
  static getCashPaymentRequestedTemplate(clientName: string, eventType: string): string {
    const content = `
      <p><strong>${clientName}</strong> has requested a cash payment for their <strong>${eventType}</strong> booking.</p>
      <p>Once you receive the cash payment, you can mark the booking as paid from your UpBeat Entertainment Africa dashboard.</p>
    `;
    return this.getHtmlShell("Cash Payment Requested", content);
  }

  // Case 11: Payment Reminder for Booking
  static getPaymentReminderTemplate(djName: string, eventType: string, paymentUrl: string): string {
    const content = `
      <p>This is a friendly reminder from <strong>${djName}</strong> regarding your <strong>${eventType}</strong> booking.</p>
      <p>Your payment is still pending. Please complete your payment to fully secure your event date.</p>
      <div style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
        <a href="${paymentUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Complete Payment</a>
      </div>
      <p>If you have any questions, please contact the DJ.</p>
    `;
    return this.getHtmlShell("Payment Reminder", content);
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
    const content = `
      <p>Thank you! Your payment for the booking has been successfully processed.</p>
      <p>Your booking is now fully secured.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 25px 0;">
        <h3 style="margin-top: 0; color: #334155; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Payment Details</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li style="margin-bottom: 10px;"><strong>Amount Paid:</strong> $${amount.toFixed(2)}</li>
          <li style="margin-bottom: 10px;"><strong>Payment Method:</strong> ${paymentMethod}</li>
          <li style="margin-bottom: 10px;"><strong>DJ Name:</strong> ${djName}</li>
          <li style="margin-bottom: 10px;"><strong>Event Type:</strong> ${eventType}</li>
          <li style="margin-bottom: 10px;"><strong>Event Date:</strong> ${new Date(date).toLocaleString()}</li>
          <li><strong>Booking ID:</strong> ${bookingId}</li>
        </ul>
      </div>
      
      `;
    return this.getHtmlShell("Payment Receipt", content);
  }

  // Case 13: Booking Payment Received Alert (To DJ)
  static getPaymentReceivedAlertTemplate(clientName: string, amount: number): string {
    const content = `
      <p>You have successfully received a payment of <strong>$${amount.toFixed(2)}</strong> from <strong>${clientName}</strong>.</p>
      <p>The booking status is now complete and secured.</p>
    `;
    return this.getHtmlShell("Payment Received", content);
  }

  // Case 14: Subscription Activated
  static getSubscriptionActivatedTemplate(planName: string, nextBillingDate: string): string {
    const content = `
      <p>Thank you for subscribing to the <strong>${planName}</strong> plan on UpBeat Entertainment Africa.</p>
      <p>Your premium features are now unlocked.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Next Billing Date:</strong> ${new Date(nextBillingDate).toLocaleDateString()}</p>
      </div>
    `;
    return this.getHtmlShell("Subscription Activated", content);
  }

  // Case 15: New Subscription Alert for Admin
  static getNewSubscriptionAdminAlertTemplate(djEmail: string, planId: number): string {
    const content = `
      <p>A DJ (<strong>${djEmail}</strong>) has successfully subscribed on UpBeat Entertainment Africa.</p>
      <p><strong>Plan ID:</strong> ${planId}</p>
    `;
    return this.getHtmlShell("New Subscription Alert", content);
  }

  // Case 16: Subscription Canceled
  static getSubscriptionCanceledTemplate(): string {
    const content = `
      <p>Your subscription has been canceled successfully.</p>
      <p>You will continue to have access to your premium features until the end of your current billing cycle.</p>
    `;
    return this.getHtmlShell("Subscription Canceled", content);
  }

  // Case 17: Payment Failed (Subscription Invoice)
  static getPaymentFailedTemplate(): string {
    const content = `
      <p>We attempted to process your subscription renewal payment, but the payment was unsuccessful.</p>
      <p>Please update your billing details as soon as possible to avoid any interruption to your service.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://deejay.africa/dashboard/billing" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Update Billing Details</a>
      </div>
    `;
    return this.getHtmlShell("Payment Failed", content);
  }

  // Case 18: Subscription Expiring Soon
  static getSubscriptionExpiryWarningTemplate(daysLeft: number): string {
    const content = `
      <p>Your subscription will expire in <strong>${daysLeft} days</strong>.</p>
      <p>Please ensure your payment method is up to date to avoid interruption and keep your portfolio online.</p>
    `;
    return this.getHtmlShell("Subscription Expiring Soon", content);
  }

  // Case 19: Subscription Expired
  static getSubscriptionExpiredTemplate(): string {
    const content = `
      <p>Your subscription has officially expired.</p>
      <p>Your public portfolio is now offline, and your premium features have been disabled.</p>
      <p>Please log in and renew your subscription to reactivate your profile.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://deejay.africa/dashboard/billing" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Renew Subscription</a>
      </div>
    `;
    return this.getHtmlShell("Subscription Expired", content);
  }

  // Case 20: Subscription Changed
  static getSubscriptionChangedTemplate(planId: number): string {
    const content = `
      <p>Your subscription has been successfully updated.</p>
      <p><strong>New Plan ID:</strong> ${planId}</p>
    `;
    return this.getHtmlShell("Subscription Updated", content);
  }

  // Case 21: Portfolio Live Notification
  static getPortfolioLiveTemplate(url: string): string {
    const content = `
      <p>Congratulations!</p>
      <p>Your personal DJ portfolio is now live and accessible at:</p>
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center; border: 1px solid #e2e8f0;">
        <a href="${url}" style="color: #dc2626; font-weight: bold; text-decoration: none; font-size: 18px;">${url}</a>
      </div>
      <p>Share this link with your clients so they can view your profile and book you directly.</p>
    `;
    return this.getHtmlShell("Your Portfolio is Live", content);
  }

  // Case 22: Account Suspended
  static getAccountSuspendedTemplate(): string {
    const content = `
      <p>Your account has been suspended by an administrator.</p>
      <p>If you believe this was done in error, please contact our support team.</p>
    `;
    return this.getHtmlShell("Account Suspended", content);
  }

  // Case 23: New Support Ticket Alert for Admin
  static getNewSupportTicketAdminAlertTemplate(djName: string, subject: string, issue: string): string {
    const content = `
      <p>A new support request has been submitted.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <p style="margin-top: 0;"><strong>Customer:</strong> ${djName}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p style="margin-bottom: 5px;"><strong>Issue Description:</strong></p>
        <div style="background-color: #ffffff; padding: 15px; border: 1px solid #e2e8f0; border-radius: 4px;">
          ${issue}
        </div>
      </div>
    `;
    return this.getHtmlShell("New Support Ticket", content);
  }

  // Case 24: Support Ticket Received Auto-reply
  static getSupportTicketReceivedTemplate(subject: string): string {
    const content = `
      <p>We have received your support request regarding:</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 20px 0;">
        <strong>${subject}</strong>
      </div>
      <p>Our support team will review your request and get back to you shortly.</p>
    `;
    return this.getHtmlShell("Support Request Received", content);
  }

  // Case 25: Support Ticket Resolved
  static getSupportTicketResolvedTemplate(subject: string): string {
    const content = `
      <p>Your support ticket regarding "<strong>${subject}</strong>" has been marked as resolved.</p>
      <p>If you need any further assistance, please open a new support ticket.</p>
    `;
    return this.getHtmlShell("Support Ticket Resolved", content);
  }

  // Case 26: Upcoming Event Reminder (Client or DJ)
  static getUpcomingEventReminderTemplate(eventType: string, date: string, isDJ: boolean): string {
    const message = isDJ ? 'Good luck with the gig!' : 'We hope you enjoy the event!';
    const content = `
      <p>This is a reminder that your <strong>${eventType}</strong> is scheduled for tomorrow.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Date & Time:</strong><br/> ${new Date(date).toLocaleString()}</p>
      </div>
      <p>${message}</p>
    `;
    return this.getHtmlShell("Upcoming Event Reminder", content);
  }
}
