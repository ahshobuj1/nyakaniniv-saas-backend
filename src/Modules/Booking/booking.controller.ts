import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { BookingServices } from './booking.service';
import { BadRequestError } from "@/core/errors/AppError";
import config from '@/core/config';

export class BookingController extends BaseController {
  constructor(private bookingService: BookingServices) {
    super();
  }

  public async initiateBooking(req: Request, res: Response): Promise<void> {
    const result = await this.bookingService.initiateBooking(req.body);
    this.sendResponse(req, res, 'Verification code sent to your email', undefined, result);
  }

  public async verifyBookingOtp(req: Request, res: Response): Promise<void> {
    const { verificationToken, otp } = req.body;
    const booking = await this.bookingService.verifyBookingOtp(verificationToken, otp);
    this.sendCreatedResponse(req, res, booking, 'Booking request verified and submitted successfully');
  }

  public async resendBookingOtp(req: Request, res: Response): Promise<void> {
    const { verificationToken } = req.body;
    const result = await this.bookingService.resendBookingOtp(verificationToken);
    this.sendResponse(req, res, 'New verification code sent', undefined, result);
  }

  public async createBooking(req: Request, res: Response): Promise<void> {
    const booking = await this.bookingService.createBooking(req.body);
    this.sendCreatedResponse(req, res, booking, 'Booking request submitted successfully');
  }

  public async getMyBookings(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { bookings, meta } = await this.bookingService.getMyBookings(userId, req.query);
    this.sendPaginatedResponse(req, res, meta, 'Bookings retrieved successfully', bookings);
  }

  public async getBookingById(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    const id = String(req.params.id);
    const booking = await this.bookingService.getBookingById(userId, id);
    this.sendResponse(req, res, 'Booking retrieved successfully', undefined, booking);
  }

  public async updateBookingStatus(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const booking = await this.bookingService.updateBookingStatus(userId, id, req.body);
    this.sendResponse(req, res, 'Booking status updated successfully', undefined, booking);
  }

  public async getPaymentLink(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const gateway = req.query.gateway as string | undefined;
    const result = await this.bookingService.getBookingPaymentLink(id, gateway);
    this.sendResponse(req, res, 'Payment link generated successfully', undefined, result);
  }

  public async resendPaymentReminder(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const result = await this.bookingService.resendPaymentReminder(userId, id);
    this.sendResponse(req, res, 'Payment reminder sent successfully', undefined, result);
  }

  public async requestCashPayment(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const result = await this.bookingService.requestCashPayment(id);
    this.sendResponse(req, res, 'Cash payment requested successfully', undefined, result);
  }

  public async checkoutRedirect(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const gateway = req.query.gateway as string | undefined;
      const result = await this.bookingService.getBookingPaymentLink(id, gateway);
      if (!result.checkoutUrl) {
        throw new Error('Failed to generate payment link');
      }
      res.redirect(result.checkoutUrl);
    } catch (error: any) {
      if (error.message === 'Booking is already paid') {
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Already Paid</title>
            <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8f9fa; }
              .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
              .icon { font-size: 48px; color: #28a745; margin-bottom: 20px; }
              h1 { color: #333; }
              p { color: #666; font-size: 18px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">✅</div>
              <h1>Payment Completed</h1>
              <p>You have already successfully paid for this booking.</p>
            </div>
          </body>
          </html>
        `);
      } else {
        res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Error</title>
            <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8f9fa; }
              .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
              .icon { font-size: 48px; color: #dc3545; margin-bottom: 20px; }
              h1 { color: #333; }
              p { color: #666; font-size: 18px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">⚠️</div>
              <h1>Checkout Error</h1>
              <p>${error.message || 'An error occurred while generating the payment link.'}</p>
            </div>
          </body>
          </html>
        `);
      }
    }
  }
  public async requestCashRedirect(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await this.bookingService.requestCashPayment(id);
      const baseDomain = config.clientUrl.includes('localhost') ? 'localhost:3000' : 'deejay.africa';
      const protocol = config.clientUrl.startsWith('https') ? 'https' : 'http';
      const djUrl = `${protocol}://${result.subdomain}.${baseDomain}`;
      
      res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Cash Payment Requested - UpBeat Entertainment Africa</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
            body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #0f172a; color: #f8fafc; padding: 20px; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 48px 36px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
            .icon-wrapper { width: 72px; height: 72px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 32px; }
            h1 { font-size: 24px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
            p { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
            .info-box { background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 32px; font-size: 14px; color: #cbd5e1; text-align: left; }
            .btn { display: inline-block; width: 100%; background: #e11d48; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 12px; font-weight: 600; font-size: 15px; transition: all 0.2s ease; box-shadow: 0 10px 15px -3px rgba(225, 29, 72, 0.3); }
            .btn:hover { background: #be123c; transform: translateY(-1px); }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon-wrapper">💵</div>
            <h1>Cash Payment Requested</h1>
            <p>You have chosen to pay by cash. <strong>${result.stageName || 'The DJ'}</strong> has been notified of your cash payment request.</p>
            <div class="info-box">
              📌 <strong>Next Step:</strong> Please coordinate with the DJ and prepare the cash amount on or before the event date.
            </div>
            <a href="${djUrl}" class="btn">← Back to DJ Profile</a>
          </div>
        </body>
        </html>
      `);
    } catch (error: any) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Request Status</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
            body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #0f172a; color: #f8fafc; padding: 20px; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 48px 36px; max-width: 480px; width: 100%; text-align: center; }
            .icon-wrapper { width: 72px; height: 72px; background: rgba(239, 68, 68, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 32px; }
            h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
            p { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 28px; }
            .btn { display: inline-block; background: #334155; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon-wrapper">⚠️</div>
            <h1>Cash Request Notice</h1>
            <p>${error.message || 'An error occurred while processing cash payment request.'}</p>
            <a href="javascript:history.back()" class="btn">Go Back</a>
          </div>
        </body>
        </html>
      `);
    }
  }

  public async handleCashRequestDecision(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const { decision } = req.body;
    if (decision !== 'approve' && decision !== 'reject') {
      throw new BadRequestError('Invalid decision');
    }
    const result = await this.bookingService.handleCashRequestDecision(userId, id, decision);
    this.sendResponse(req, res, result.message, undefined, result);
  }

  public async markCashAsPaid(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const result = await this.bookingService.markCashAsPaid(userId, id);
    this.sendResponse(req, res, result.message, undefined, result);
  }
  public async refundBooking(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const result = await this.bookingService.refundBooking(userId, id);
    this.sendResponse(req, res, result.message, undefined, result);
  }
}
