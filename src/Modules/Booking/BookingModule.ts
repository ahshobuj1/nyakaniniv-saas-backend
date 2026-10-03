import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { BookingServices } from "./booking.service";
import { BookingController } from "./booking.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser, authorizeRole, optionalAuth } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import {
  createBookingSchema,
  initiateBookingSchema,
  verifyBookingOtpSchema,
  resendBookingOtpSchema,
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

    // Public Routes for Booking Client Verification & Submission
    this.router.post(
      "/initiate",
      validateRequest(initiateBookingSchema),
      controller.initiateBooking.bind(controller),
    );

    this.router.post(
      "/verify-otp",
      validateRequest(verifyBookingOtpSchema),
      controller.verifyBookingOtp.bind(controller),
    );

    this.router.post(
      "/resend-otp",
      validateRequest(resendBookingOtpSchema),
      controller.resendBookingOtp.bind(controller),
    );

    // Direct create route (fallback)
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
      optionalAuth,
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

    this.router.post(
      "/:id/refund",
      authenticateUser,
      authorizeRole([UserRole.DJ]), // Only DJ can initiate refund for now
      controller.refundBooking.bind(controller),
    );

    // Client/Public route to generate fresh checkout session
    this.router.get(
      "/:id/payment-link",
      controller.getPaymentLink.bind(controller),
    );

    // Client/Public route to automatically redirect to checkout
    this.router.get(
      "/:id/checkout-redirect",
      controller.checkoutRedirect.bind(controller),
    );

    // Client/Public route to request cash payment
    this.router.patch(
      "/:id/request-cash",
      controller.requestCashPayment.bind(controller),
    );

    // Client/Public route to request cash payment via email button (redirects to success page)
    this.router.get(
      "/:id/request-cash-redirect",
      controller.requestCashRedirect.bind(controller),
    );

    // DJ Action: Approve/Reject cash payment
    this.router.post(
      "/:id/cash-decision",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.handleCashRequestDecision.bind(controller),
    );

    // DJ Action: Mark cash as paid (fulfill)
    this.router.post(
      "/:id/mark-cash-paid",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.markCashAsPaid.bind(controller),
    );

    // Client Portal Routes (Magic Link)
    this.router.get(
      "/client/:id",
      controller.getClientBooking.bind(controller),
    );

    this.router.post(
      "/client/:id/cancel",
      controller.clientCancelBooking.bind(controller),
    );
  }
}
