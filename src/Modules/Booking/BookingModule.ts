import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { BookingServices } from "./booking.service";
import { BookingController } from "./booking.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import {
  createBookingSchema,
  updateBookingStatusSchema,
} from "./BookingDTO";

export class BookingModule extends BaseModule {
  public name: string = "BookingModule";
  public version: string = "1.0.0";
  public basePath: string = "/bookings/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("BookingModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const emailProvider = this.context.getService("email");
    this.registerService("BookingService", new BookingServices(prisma, emailProvider));
  }

  protected async setupControllers(): Promise<void> {
    const bookingService = this.getService<BookingServices>("BookingService");
    this.registerController("BookingController", new BookingController(bookingService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<BookingController>("BookingController");

    // Public Route (Client submitting a booking request)
    this.router.post(
      "/",
      validateRequest(createBookingSchema),
      controller.createBooking.bind(controller),
    );

    // DJ Routes
    this.router.get(
      "/my-bookings",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.getMyBookings.bind(controller),
    );

    this.router.get(
      "/:id",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.getBookingById.bind(controller),
    );

    this.router.patch(
      "/:id/status",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      validateRequest(updateBookingStatusSchema),
      controller.updateBookingStatus.bind(controller),
    );

    this.router.post(
      "/:id/remind-payment",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.resendPaymentReminder.bind(controller),
    );

    // Client/Public route to generate fresh checkout session
    this.router.get(
      "/:id/payment-link",
      controller.getPaymentLink.bind(controller),
    );
  }
}
