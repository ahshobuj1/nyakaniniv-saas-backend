import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { BookingServices } from './booking.service';

export class BookingController extends BaseController {
  constructor(private bookingService: BookingServices) {
    super();
  }

  // 1. Initial Booking Request & Guest OTP
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

  // 2. Booking Portal Access (Order Ref + OTP)
  public async requestBookingAccessOtp(req: Request, res: Response): Promise<void> {
    const { orderReference, email } = req.body;
    const result = await this.bookingService.requestBookingAccessOtp(orderReference, email);
    this.sendResponse(req, res, result.message, undefined, result);
  }

  public async verifyBookingAccessOtp(req: Request, res: Response): Promise<void> {
    const { sessionToken, otp } = req.body;
    const result = await this.bookingService.verifyBookingAccessOtp(sessionToken, otp);
    this.sendResponse(req, res, 'Access verified successfully', undefined, result);
  }

  public async resendBookingAccessOtp(req: Request, res: Response): Promise<void> {
    const { sessionToken } = req.body;
    const result = await this.bookingService.resendBookingAccessOtp(sessionToken);
    this.sendResponse(req, res, result.message, undefined, result);
  }

  // 3. Portal Details
  public async getBookingPortalDetails(req: Request, res: Response): Promise<void> {
    const idOrRef = String(req.params.id);
    const actor = req.user
      ? {
          role: (req.user.role === 'ADMIN' ? 'ADMIN' : 'DJ') as const,
          userId: req.user.id,
        }
      : req.bookingAccess
        ? { role: 'CLIENT' as const, clientBookingId: req.bookingAccess.bookingId }
        : undefined;

    const booking = await this.bookingService.getBookingPortalDetails(idOrRef, actor);
    this.sendResponse(req, res, 'Booking portal details retrieved', undefined, booking);
  }

  // 4. DJ Booking Management
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

  // 5. Asynchronous Messaging
  public async getBookingMessages(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const messages = await this.bookingService.getBookingMessages(id);
    this.sendResponse(req, res, 'Messages retrieved', undefined, messages);
  }

  public async sendBookingMessage(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const { content } = req.body;
    const senderType = req.user ? 'DJ' : 'CLIENT';
    const senderId = req.user ? req.user.id : null;

    const message = await this.bookingService.sendBookingMessage(id, senderType, senderId, content);
    this.sendCreatedResponse(req, res, message, 'Message sent successfully');
  }

  // 6. Quotes & Negotiation
  public async proposeQuote(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const proposer = req.user ? 'DJ' : 'CLIENT';
    const proposerId = req.user ? req.user.id : null;

    const quote = await this.bookingService.proposeQuote(id, proposer, proposerId, req.body);
    this.sendCreatedResponse(req, res, quote, 'Quote proposed successfully');
  }

  public async acceptQuote(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const quoteId = String(req.params.quoteId);
    const actor = req.user ? 'DJ' : 'CLIENT';
    const actorId = req.user ? req.user.id : null;

    const agreement = await this.bookingService.acceptQuote(id, quoteId, actor, actorId);
    this.sendResponse(req, res, 'Quote accepted and agreement confirmed', undefined, agreement);
  }

  public async rejectQuote(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const quoteId = String(req.params.quoteId);
    const actor = req.user ? 'DJ' : 'CLIENT';
    const actorId = req.user ? req.user.id : null;
    const reason = req.body?.reason;

    const result = await this.bookingService.rejectQuote(id, quoteId, actor, actorId, reason);
    this.sendResponse(req, res, result.message, undefined, result);
  }

  // 7. Direct Payment Reporting
  public async reportDirectPayment(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const result = await this.bookingService.reportDirectPayment(id, req.body);
    this.sendResponse(req, res, 'Direct payment reported to the artist', undefined, result);
  }

  public async confirmDirectPayment(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const userId = req.user!.id;
    const result = await this.bookingService.confirmDirectPaymentReceived(id, userId);
    this.sendResponse(req, res, 'Direct payment confirmed as received', undefined, result);
  }

  // 8. Completion, Issues & Reviews
  public async requestCompletion(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const result = await this.bookingService.requestCompletion(id);
    this.sendResponse(req, res, result.message, undefined, result);
  }

  public async confirmCompletion(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const result = await this.bookingService.confirmCompletion(id);
    this.sendResponse(req, res, 'Event completion confirmed', undefined, result);
  }

  public async reportIssue(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const result = await this.bookingService.reportIssue(id, req.body);
    this.sendResponse(req, res, 'Issue reported successfully for review', undefined, result);
  }

  public async submitReview(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const review = await this.bookingService.submitReview(id, req.body);
    this.sendCreatedResponse(req, res, review, 'Review submitted successfully');
  }

  // 9. DJ Schedule Query
  public async getDjSchedule(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const view = (req.query.view as any) || 'upcoming';
    const schedule = await this.bookingService.getDjSchedule(userId, view);
    this.sendResponse(req, res, 'Schedule retrieved successfully', undefined, schedule);
  }

  // 10. Legacy compatibility
  public async getClientBooking(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const result = await this.bookingService.getClientBooking(id);
    this.sendResponse(req, res, 'Client booking fetched successfully', undefined, result);
  }

  public async clientCancelBooking(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const { reason } = req.body;
    const result = await this.bookingService.clientCancelBooking(id, reason);
    this.sendResponse(req, res, result.message, undefined, result);
  }
}
