import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { BookingServices } from './booking.service';

export class BookingController extends BaseController {
  constructor(private bookingService: BookingServices) {
    super();
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
    const userId = req.user!.id;
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
    const result = await this.bookingService.getBookingPaymentLink(id);
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
      const result = await this.bookingService.getBookingPaymentLink(id);
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
      await this.bookingService.requestCashPayment(id);
      
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Cash Payment Requested</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8f9fa; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 500px; }
            .icon { font-size: 48px; color: #ffc107; margin-bottom: 20px; }
            h1 { color: #333; }
            p { color: #666; font-size: 18px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">💵</div>
            <h1>Cash Payment Requested</h1>
            <p>You have successfully requested to pay for this booking with cash. The DJ has been notified.</p>
            <p>Please coordinate with the DJ to hand over the cash before or during the event.</p>
          </div>
        </body>
        </html>
      `);
    } catch (error: any) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8f9fa; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 500px; }
            .icon { font-size: 48px; color: #dc3545; margin-bottom: 20px; }
            h1 { color: #333; }
            p { color: #666; font-size: 18px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⚠️</div>
            <h1>Request Failed</h1>
            <p>${error.message || 'An error occurred while requesting cash payment.'}</p>
          </div>
        </body>
        </html>
      `);
    }
  }
}
