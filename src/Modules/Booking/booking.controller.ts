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
}
