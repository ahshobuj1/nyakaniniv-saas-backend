import { config } from '@/core/config';

export class EmailTemplates {
  /**
   * Resolves a canonical client manage booking URL from either a direct URL,
   * a checkout URL, or a booking ID.
   */
  public static resolveManageUrl(bookingIdOrUrl?: string): string {
    if (!bookingIdOrUrl) return '';
    const trimmed = bookingIdOrUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (trimmed.includes('/booking/manage/')) {
        return trimmed;
      }
      if (trimmed.includes('/checkout/')) {
        return trimmed.replace('/checkout/', '/booking/manage/').split('?')[0];
      }
      return trimmed;
    }
    return `${config.clientUrl}/booking/manage/${trimmed}`;
  }

  public static getHtmlShell(title: string, content: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 30px 15px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); max-width: 600px; margin: 0 auto; overflow: hidden; border: 1px solid #e5e7eb;">
                <!-- Header -->
                <tr>
                  <td style="background-color: #111827; padding: 30px 24px; text-align: center; border-bottom: 3px solid #dc2626;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <img src="cid:upbeat-logo" alt="UpBeat Entertainment Africa" style="height: 46px; max-height: 46px; width: auto; display: block; margin: 0 auto 10px auto;" />
                          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">UpBeat Entertainment Africa</h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding: 36px 30px; color: #374151; line-height: 1.65; font-size: 15px;">
                    ${content}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 20px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 6px 0; font-weight: 600; color: #111827;">UpBeat Entertainment Africa</p>
                    <p style="margin: 0; line-height: 1.4;">&copy; ${new Date().getFullYear()} UpBeat Entertainment Africa. All rights reserved.</p>
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

  // Booking Client Verification OTP
  static getBookingVerificationOtpTemplate(clientName: string, otp: string, djName: string, eventType: string): string {
    const content = `
      <p>Hello <strong>${clientName}</strong>,</p>
      <p>Thank you for initiating a booking request for <strong>${djName}</strong> (${eventType}).</p>
      <p>To verify your email address and confirm your booking request, please enter the 6-digit verification code below:</p>
      <div style="background-color: #f3f4f6; padding: 18px; text-align: center; border-radius: 8px; margin: 25px 0; border: 1px dashed #dc2626;">
        <span style="color: #dc2626; font-size: 34px; font-weight: 800; letter-spacing: 6px;">${otp}</span>
      </div>
      <p style="font-size: 14px; color: #4b5563;">This code is valid for <strong>10 minutes</strong>. Once verified, your booking request will be officially submitted to ${djName}.</p>
      <p style="font-size: 13px; color: #9ca3af; margin-top: 20px;">If you did not initiate this booking, please disregard this email.</p>
    `;
    return this.getHtmlShell("Verify Your DJ Booking Request - UpBeat Entertainment Africa", content);
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
  static getNewBookingAlertTemplate(clientName: string, eventType: string, date: string, timezone?: string): string {
    const content = `
      <p>You have received a new booking request from <strong>${clientName}</strong>.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #334155; font-size: 18px;">Booking Details</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li style="margin-bottom: 10px;"><strong>Event Type:</strong> ${eventType}</li>
          <li><strong>Date:</strong> ${new Date(date).toLocaleString()}${timezone ? ` (${timezone})` : ''}</li>
        </ul>
      </div>
      <p>Please log in to your dashboard to review and accept the booking.</p>
    `;
    return this.getHtmlShell("New Booking Request", content);
  }

  // Case 6: Auto-reply to Client for New Booking Request
  static getBookingAutoReplyTemplate(
    optionsOrDjName: {
      clientName?: string;
      djName: string;
      eventType: string;
      eventDate?: string;
      eventTime?: string;
      manageUrl?: string;
    } | string,
    legacyEventType?: string
  ): string {
    if (typeof optionsOrDjName === 'string') {
      const djName = optionsOrDjName;
      const eventType = legacyEventType || 'Event';
      const content = `
        <p>Thank you for submitting your booking request for <strong>${djName}</strong> on UpBeat Entertainment Africa.</p>
        <p>Your request for a <strong>${eventType}</strong> is currently pending review.</p>
        <p>The DJ will review your request and get back to you shortly.</p>
      `;
      return this.getHtmlShell("Booking Request Received", content);
    }

    const { clientName, djName, eventType, eventDate, eventTime, manageUrl } = optionsOrDjName;
    const content = `
      <p>Hi <strong>${clientName || 'there'}</strong>,</p>
      <p>Thank you for submitting your booking request for <strong>${djName}</strong> on UpBeat Entertainment Africa.</p>
      <p>Your request for a <strong>${eventType}</strong> is currently pending review.</p>
      ${eventDate ? `<p><strong>Event Date:</strong> ${eventDate}${eventTime ? ` at ${eventTime}` : ''}</p>` : ''}
      ${manageUrl ? `
        <div style="text-align: center; margin: 25px 0;">
          <a href="${manageUrl}" style="display: inline-block; padding: 12px 24px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Manage Your Booking</a>
        </div>
      ` : ''}
    `;
    return this.getHtmlShell("Booking Request Received", content);
  }

  // Case 7: Booking Request Accepted
  static getBookingAcceptedTemplate(
    options: {
      clientName?: string;
      djName: string;
      eventType: string;
      eventDate?: string;
      eventTime?: string;
      venue?: string;
      currency?: string;
      amount?: number;
      paymentUrl: string;
      requestCashUrl?: string;
      manageUrl?: string;
    } | string,
    legacyEventType?: string,
    legacyPaymentUrl?: string,
    legacyRequestCashUrl?: string
  ): string {
    const data = typeof options === 'string'
      ? {
          clientName: 'there',
          djName: options,
          eventType: legacyEventType || 'Event',
          eventDate: '',
          eventTime: '',
          venue: '',
          currency: 'KES',
          amount: 0,
          paymentUrl: legacyPaymentUrl || '#',
          requestCashUrl: legacyRequestCashUrl || '#',
        }
      : options;

    const amountDisplay = data.amount && data.amount > 0
      ? `${data.currency || 'KES'} ${Number(data.amount).toLocaleString()}`
      : null;

    const manageUrl = this.resolveManageUrl(data.manageUrl || data.paymentUrl);

    const content = `
      <p style="margin-top: 0; font-size: 16px;">Hi <strong>${data.clientName || 'there'}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6;">
        Great news! <strong>${data.djName}</strong> has accepted your booking request for <strong>${data.eventType}</strong>.
      </p>
      
      <!-- Event & Quote Details Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 24px 0; overflow: hidden;">
        <tr>
          <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
            <strong style="color: #0f172a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Booking & Quotation Summary</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 18px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px; width: 38%;">Artist / DJ:</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${data.djName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Event Type:</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${data.eventType}</td>
              </tr>
              ${data.eventDate ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Event Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${data.eventDate}</td>
              </tr>
              ` : ''}
              ${data.eventTime ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Event Time:</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${data.eventTime}</td>
              </tr>
              ` : ''}
              ${data.venue ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Location / Venue:</td>
                <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${data.venue}</td>
              </tr>
              ` : ''}
              ${amountDisplay ? `
              <tr>
                <td style="padding: 14px 0 4px 0; color: #0f172a; font-size: 15px; font-weight: 700; border-top: 1px dashed #cbd5e1;">Performance Fee:</td>
                <td style="padding: 14px 0 4px 0; color: #dc2626; font-size: 20px; font-weight: 800; font-family: monospace; border-top: 1px dashed #cbd5e1;">${amountDisplay}</td>
              </tr>
              ` : ''}
            </table>
          </td>
        </tr>
      </table>

      <!-- Payment & Escrow Guarantee Box -->
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px; display: flex; align-items: center; gap: 6px;">
          🛡️ Payment Options & Escrow Protection:
        </h4>
        <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 13px; line-height: 1.65;">
          <li style="margin-bottom: 6px;"><strong>Pay Online (Instant Lock):</strong> Choose M-Pesa, Mobile Money, Visa, or Mastercard. Your date is reserved immediately.</li>
          <li style="margin-bottom: 6px;"><strong>100% Escrow Protection:</strong> Funds are locked securely in Escrow and are only released to the DJ after the performance is completed.</li>
          <li><strong>Prefer Cash on Arrival?</strong> You can request to pay cash directly to the DJ on the event day before the set begins.</li>
        </ul>
      </div>

      <!-- Action Buttons -->
      <div style="text-align: center; margin: 30px 0 12px 0;">
        <a href="${data.paymentUrl}" style="display: inline-block; padding: 14px 28px; margin: 6px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3);">
          Pay Online with Escrow &rarr;
        </a>
        <a href="${data.paymentUrl}?requestCash=true" style="display: inline-block; padding: 14px 24px; margin: 6px; background-color: #ffffff; color: #1e293b; border: 1.5px solid #cbd5e1; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Cash on Arrival
        </a>
      </div>

      ${manageUrl ? `
      <!-- View / Manage Booking Portal Button -->
      <div style="text-align: center; margin: 6px 0 20px 0;">
        <a href="${manageUrl}" style="display: inline-block; padding: 12px 28px; margin: 6px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);">
          📋 View & Manage Booking Portal &rarr;
        </a>
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 20px 0 14px 0; font-size: 13px; color: #475569; line-height: 1.6;">
        <p style="margin: 0 0 6px 0; font-weight: 700; color: #0f172a;">
          📌 Access Your Private Booking Portal:
        </p>
        <p style="margin: 0 0 8px 0; font-size: 13px;">
          Need to review your event schedule, check DJ contact details, or view the cancellation policy? Access your booking dashboard at:
        </p>
        <a href="${manageUrl}" style="color: #dc2626; font-weight: 600; word-break: break-all;">${manageUrl}</a>
      </div>
      ` : ''}

      <p style="text-align: center; margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        Having trouble with the buttons? Open your checkout page directly:<br/>
        <a href="${data.paymentUrl}" style="color: #dc2626; word-break: break-all;">${data.paymentUrl}</a>
      </p>
    `;
    return this.getHtmlShell("Booking Request Accepted", content);
  }

  // Case 8: Booking Canceled / Rejected
  static getBookingRejectedTemplate(djName: string, eventType: string, reason?: string, siteUrl?: string, manageUrl?: string): string {
    const platformUrl = siteUrl || "https://upbeat.africa";
    const portalUrl = this.resolveManageUrl(manageUrl);
    const reasonSection = reason && reason.trim().length > 0 ? `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Note from ${djName} (Reason for Decline):</p>
        <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; font-style: italic; white-space: pre-wrap;">"${reason.trim()}"</p>
      </div>
    ` : '';

    const content = `
      <p>Unfortunately, <strong>${djName}</strong> is unable to accept your booking request for a <strong>${eventType}</strong> at this time.</p>
      ${reasonSection}
      <p>Don't worry! There are many other talented, verified DJs available on UpBeat Entertainment Africa ready to perform at your event.</p>
      
      <!-- Action Buttons -->
      <div style="text-align: center; margin: 28px 0 18px 0;">
        <a href="${platformUrl}" style="display: inline-block; padding: 13px 28px; margin: 6px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.25);">
          Explore Other DJs on UpBeat Africa &rarr;
        </a>
        ${portalUrl ? `
        <a href="${portalUrl}" style="display: inline-block; padding: 13px 24px; margin: 6px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          📋 View Booking Details
        </a>
        ` : ''}
      </div>
      <p style="text-align: center; margin: 0; font-size: 12px; color: #94a3b8;">
        Visit: <a href="${platformUrl}" style="color: #dc2626; word-break: break-all;">${platformUrl}</a>
      </p>
    `;
    return this.getHtmlShell("Booking Declined", content);
  }

  // Case 8B: Booking Cancelled
  static getBookingCancelledTemplate(data: {
    clientName?: string;
    recipientName?: string;
    djName?: string;
    eventType?: string;
    cancelledBy?: string;
    reason?: string;
    refundAmount?: number;
    currency?: string;
    manageUrl?: string;
  }): string {
    const name = data.recipientName || data.clientName || 'there';
    const content = `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your booking for <strong>${data.eventType || 'Event'}</strong> with <strong>${data.djName || 'DJ'}</strong> has been cancelled${data.cancelledBy ? ` by ${data.cancelledBy.toLowerCase()}` : ''}.</p>
      ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
      ${data.refundAmount && data.refundAmount > 0 ? `<p><strong>Refund amount processed:</strong> ${data.currency || 'KES'} ${data.refundAmount.toLocaleString()}</p>` : ''}
      ${data.manageUrl ? `
        <div style="text-align: center; margin: 25px 0;">
          <a href="${data.manageUrl}" style="display: inline-block; padding: 12px 24px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">View Booking Details</a>
        </div>
      ` : ''}
    `;
    return this.getHtmlShell("Booking Cancelled", content);
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
      <p>Please log in to your dashboard to either <strong>Approve</strong> or <strong>Decline</strong> this cash request.</p>
    `;
    return this.getHtmlShell("Cash Payment Requested", content);
  }

  // Case 10A: Cash Request Approved by DJ (Sent to Client)
  static getCashRequestApprovedTemplate(
    clientName: string,
    djName: string,
    eventType: string,
    date: string,
    currency: string,
    amount: number,
    djUrl: string,
    manageUrl?: string
  ): string {
    const portalUrl = this.resolveManageUrl(manageUrl);
    const content = `
      <p>Hi <strong>${clientName}</strong>,</p>
      <p>Great news! <strong>${djName}</strong> has approved your request to pay in cash on the event day for your <strong>${eventType}</strong>.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Booking Summary</h3>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Artist:</strong> ${djName}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Event:</strong> ${eventType}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Date:</strong> ${date}</p>
        <p style="margin: 8px 0 0 0; font-size: 16px; color: #dc2626;"><strong>Cash to Prepare on Arrival:</strong> ${currency} ${amount.toLocaleString()}</p>
      </div>

      <p style="color: #475569; font-size: 14px;">Your event date is officially confirmed. Please coordinate directly with the DJ and prepare exact cash on arrival.</p>

      <div style="text-align: center; margin-top: 25px;">
        ${portalUrl ? `
        <a href="${portalUrl}" style="display: inline-block; padding: 13px 26px; margin: 6px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);">
          📋 Manage Your Booking &rarr;
        </a>
        ` : ''}
        <a href="${djUrl}" style="display: inline-block; padding: 13px 24px; margin: 6px; background-color: #ffffff; color: #1e293b; border: 1.5px solid #cbd5e1; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          View DJ Profile
        </a>
      </div>
      ${portalUrl ? `
      <p style="text-align: center; margin-top: 14px; font-size: 12px; color: #94a3b8;">
        Portal: <a href="${portalUrl}" style="color: #dc2626; word-break: break-all;">${portalUrl}</a>
      </p>
      ` : ''}
    `;
    return this.getHtmlShell("Cash Payment Approved - Booking Confirmed", content);
  }

  // Case 10B: Cash Request Declined by DJ (Sent to Client)
  static getCashRequestDeclinedTemplate(
    clientName: string,
    djName: string,
    eventType: string,
    currency: string,
    amount: number,
    checkoutUrl: string,
    manageUrl?: string
  ): string {
    const portalUrl = this.resolveManageUrl(manageUrl || checkoutUrl);
    const content = `
      <p>Hi <strong>${clientName}</strong>,</p>
      <p><strong>${djName}</strong> was unable to accept cash payment for your <strong>${eventType}</strong> booking.</p>
      <p>To secure your event date, the DJ requires online payment via UpBeat Secure Escrow.</p>

      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 18px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>Notice:</strong> Your date is currently on hold. Please complete payment online using Paystack, Pesapal, or Cards to lock in your reservation.</p>
        <p style="margin: 8px 0 0 0; font-size: 16px; color: #1e293b;"><strong>Total Due:</strong> ${currency} ${amount.toLocaleString()}</p>
      </div>

      <div style="text-align: center; margin-top: 25px;">
        <a href="${checkoutUrl}" style="display: inline-block; padding: 13px 28px; margin: 6px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.25);">
          Pay Online to Secure Date &rarr;
        </a>
        ${portalUrl ? `
        <a href="${portalUrl}" style="display: inline-block; padding: 13px 24px; margin: 6px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
          📋 Manage Booking
        </a>
        ` : ''}
      </div>
      ${portalUrl ? `
      <p style="text-align: center; margin-top: 14px; font-size: 12px; color: #94a3b8;">
        Booking Portal: <a href="${portalUrl}" style="color: #dc2626; word-break: break-all;">${portalUrl}</a>
      </p>
      ` : ''}
    `;
    return this.getHtmlShell("Action Required: Cash Request Declined", content);
  }

  // Case 11: Payment Reminder for Booking
  static getPaymentReminderTemplate(
    options: {
      clientName?: string;
      djName: string;
      eventType: string;
      eventDate?: string;
      eventTime?: string;
      currency?: string;
      amount?: number;
      paymentUrl: string;
      manageUrl?: string;
    } | string,
    legacyEventType?: string,
    legacyPaymentUrl?: string
  ): string {
    const data = typeof options === 'string'
      ? {
          clientName: 'there',
          djName: options,
          eventType: legacyEventType || 'Event',
          eventDate: '',
          eventTime: '',
          currency: 'KES',
          amount: 0,
          paymentUrl: legacyPaymentUrl || '#',
          manageUrl: '',
        }
      : options;

    const amountDisplay = data.amount && data.amount > 0
      ? `${data.currency || 'KES'} ${Number(data.amount).toLocaleString()}`
      : null;

    const manageUrl = this.resolveManageUrl(data.manageUrl || data.paymentUrl);

    const content = `
      <p style="margin-top: 0; font-size: 16px;">Hi <strong>${data.clientName || 'there'}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6;">
        This is a friendly reminder from <strong>${data.djName}</strong> regarding your pending booking for <strong>${data.eventType}</strong>.
      </p>
      
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 20px 0; overflow: hidden;">
        <tr>
          <td style="padding: 16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-size: 14px; width: 38%;">Artist:</td>
                <td style="padding: 5px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${data.djName}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-size: 14px;">Event:</td>
                <td style="padding: 5px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${data.eventType}</td>
              </tr>
              ${data.eventDate ? `
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-size: 14px;">Event Date:</td>
                <td style="padding: 5px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${data.eventDate}</td>
              </tr>
              ` : ''}
              ${data.eventTime ? `
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-size: 14px;">Event Time:</td>
                <td style="padding: 5px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${data.eventTime}</td>
              </tr>
              ` : ''}
              ${amountDisplay ? `
              <tr>
                <td style="padding: 12px 0 4px 0; color: #0f172a; font-size: 14px; font-weight: 700; border-top: 1px dashed #cbd5e1;">Amount Due:</td>
                <td style="padding: 12px 0 4px 0; color: #dc2626; font-size: 18px; font-weight: 800; font-family: monospace; border-top: 1px dashed #cbd5e1;">${amountDisplay}</td>
              </tr>
              ` : ''}
            </table>
          </td>
        </tr>
      </table>

      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Your date is currently on hold. Please finalize your payment through UpBeat Escrow to secure this date on ${data.djName}'s calendar. Your payment is held safely until the event is completed.
      </p>

      <div style="text-align: center; margin: 28px 0 12px 0;">
        <a href="${data.paymentUrl}" style="display: inline-block; padding: 14px 34px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3);">
          Complete Payment & Secure Date &rarr;
        </a>
      </div>

      ${manageUrl ? `
      <div style="text-align: center; margin: 6px 0 20px 0;">
        <a href="${manageUrl}" style="display: inline-block; padding: 11px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 13px;">
          📋 View & Manage Booking Details &rarr;
        </a>
      </div>
      <p style="text-align: center; margin: 10px 0; font-size: 12px; color: #64748b;">
        Booking Portal: <a href="${manageUrl}" style="color: #dc2626; word-break: break-all;">${manageUrl}</a>
      </p>
      ` : ''}

      <p style="text-align: center; margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        Direct checkout link: <a href="${data.paymentUrl}" style="color: #dc2626; word-break: break-all;">${data.paymentUrl}</a>
      </p>
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
    bookingId: string,
    currency: string = 'KES',
    manageUrl?: string
  ): string {
    const portalUrl = this.resolveManageUrl(manageUrl || bookingId);
    const content = `
      <p>Thank you! Your payment for the booking has been successfully processed.</p>
      <p>Your booking is now fully secured with 100% UpBeat Escrow Protection.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 25px 0;">
        <h3 style="margin-top: 0; color: #334155; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Payment Details</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li style="margin-bottom: 10px;"><strong>Amount Paid:</strong> ${currency} ${Number(amount).toLocaleString()}</li>
          <li style="margin-bottom: 10px;"><strong>Payment Method:</strong> ${paymentMethod}</li>
          <li style="margin-bottom: 10px;"><strong>DJ Name:</strong> ${djName}</li>
          <li style="margin-bottom: 10px;"><strong>Event Type:</strong> ${eventType}</li>
          <li style="margin-bottom: 10px;"><strong>Event Date:</strong> ${new Date(date).toLocaleString()}</li>
          <li><strong>Booking ID:</strong> ${bookingId}</li>
        </ul>
      </div>

      ${portalUrl ? `
      <div style="text-align: center; margin: 25px 0 10px 0;">
        <a href="${portalUrl}" style="display: inline-block; padding: 13px 28px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);">
          📋 View & Manage Booking Details &rarr;
        </a>
      </div>
      <p style="text-align: center; font-size: 12px; color: #94a3b8;">
        Portal Link: <a href="${portalUrl}" style="color: #dc2626; word-break: break-all;">${portalUrl}</a>
      </p>
      ` : ''}
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
  static getUpcomingEventReminderTemplate(
    eventType: string,
    date: string,
    isDJ: boolean,
    actionUrl?: string
  ): string {
    const message = isDJ ? 'Good luck with the gig!' : 'We hope you enjoy the event!';
    const portalUrl = this.resolveManageUrl(actionUrl);
    const buttonText = isDJ ? 'View Booking in Dashboard &rarr;' : '📋 View Booking & Artist Contacts &rarr;';
    const content = `
      <p>This is a reminder that your <strong>${eventType}</strong> is scheduled for tomorrow.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Date & Time:</strong><br/> ${new Date(date).toLocaleString()}</p>
      </div>
      ${portalUrl ? `
      <div style="text-align: center; margin: 25px 0 10px 0;">
        <a href="${portalUrl}" style="display: inline-block; padding: 12px 26px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);">
          ${buttonText}
        </a>
      </div>
      <p style="text-align: center; font-size: 12px; color: #94a3b8;">
        Link: <a href="${portalUrl}" style="color: #dc2626; word-break: break-all;">${portalUrl}</a>
      </p>
      ` : ''}
      <p>${message}</p>
    `;
    return this.getHtmlShell("Upcoming Event Reminder", content);
  }
}
