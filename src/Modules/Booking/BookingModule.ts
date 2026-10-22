import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { BookingServices } from "./booking.service";
import { BookingController } from "./booking.controller";
import { validateRequest } from "@/middleware/validation";
import {
  authenticateUser,
  authorizeRole,
  optionalAuth,
  authenticateBookingAccess,
} from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import {
  createBookingSchema,
  initiateBookingSchema,
  verifyBookingOtpSchema,
  resendBookingOtpSchema,
  updateBookingStatusSchema,
  requestBookingAccessOtpSchema,
  verifyBookingAccessOtpSchema,
  resendBookingAccessOtpSchema,
  createBookingMessageSchema,
  proposeQuoteSchema,
  acceptQuoteSchema,
  rejectQuoteSchema,
  reportDirectPaymentSchema,
  reportIssueSchema,
  submitReviewSchema,
} from "./BookingDTO";

export class BookingModule extends BaseModule {
  public name: string = "BookingModule";
  public version: string = "2.0.0";
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

    // ==========================================
    // 1. Public Routes: Booking Creation & Guest OTP
    // ==========================================
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

    this.router.post(
      "/",
      validateRequest(createBookingSchema),
      controller.createBooking.bind(controller),
    );

    // ==========================================
    // 2. Booking Portal Access (Order Ref + OTP)
    // ==========================================
    this.router.post(
      "/access/request-otp",
      validateRequest(requestBookingAccessOtpSchema),
      controller.requestBookingAccessOtp.bind(controller),
    );

    this.router.post(
      "/access/verify-otp",
      validateRequest(verifyBookingAccessOtpSchema),
      controller.verifyBookingAccessOtp.bind(controller),
    );

    this.router.post(
      "/access/resend-otp",
      validateRequest(resendBookingAccessOtpSchema),
      controller.resendBookingAccessOtp.bind(controller),
    );

    // ==========================================
    // 3. DJ Dashboard Routes
    // ==========================================
    this.router.get(
      "/my-bookings",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.getMyBookings.bind(controller),
    );

    this.router.get(
      "/schedule",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.getDjSchedule.bind(controller),
    );

    this.router.patch(
      "/:id/status",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      validateRequest(updateBookingStatusSchema),
      controller.updateBookingStatus.bind(controller),
    );

    this.router.post(
      "/:id/confirm-payment",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.confirmDirectPayment.bind(controller),
    );

    this.router.post(
      "/:id/request-completion",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.requestCompletion.bind(controller),
    );

    // ==========================================
    // 4. Secure Booking Portal Routes
    // Protected by authenticateBookingAccess (allows authenticated Client OR DJ)
    // ==========================================
    this.router.get(
      "/:id/portal",
      authenticateBookingAccess,
      controller.getBookingPortalDetails.bind(controller),
    );

    this.router.get(
      "/:id/messages",
      authenticateBookingAccess,
      controller.getBookingMessages.bind(controller),
    );

    this.router.post(
      "/:id/messages",
      authenticateBookingAccess,
      validateRequest(createBookingMessageSchema),
      controller.sendBookingMessage.bind(controller),
    );

    this.router.post(
      "/:id/quotes",
      authenticateBookingAccess,
      validateRequest(proposeQuoteSchema),
      controller.proposeQuote.bind(controller),
    );

    this.router.post(
      "/:id/quotes/:quoteId/accept",
      authenticateBookingAccess,
      validateRequest(acceptQuoteSchema),
      controller.acceptQuote.bind(controller),
    );

    this.router.post(
      "/:id/quotes/:quoteId/reject",
      authenticateBookingAccess,
      validateRequest(rejectQuoteSchema),
      controller.rejectQuote.bind(controller),
    );

    this.router.post(
      "/:id/report-payment",
      authenticateBookingAccess,
      validateRequest(reportDirectPaymentSchema),
      controller.reportDirectPayment.bind(controller),
    );

    this.router.post(
      "/:id/confirm-completion",
      authenticateBookingAccess,
      controller.confirmCompletion.bind(controller),
    );

    this.router.post(
      "/:id/report-issue",
      authenticateBookingAccess,
      validateRequest(reportIssueSchema),
      controller.reportIssue.bind(controller),
    );

    this.router.post(
      "/:id/review",
      authenticateBookingAccess,
      validateRequest(submitReviewSchema),
      controller.submitReview.bind(controller),
    );

    this.router.post(
      "/:id/cancel",
      authenticateBookingAccess,
      controller.clientCancelBooking.bind(controller),
    );

    // ==========================================
    // 5. General & Legacy Routes
    // ==========================================
    this.router.get(
      "/client/:id",
      optionalAuth,
      controller.getClientBooking.bind(controller),
    );

    this.router.post(
      "/client/:id/cancel",
      optionalAuth,
      controller.clientCancelBooking.bind(controller),
    );

    this.router.get(
      "/:id",
      optionalAuth,
      controller.getBookingById.bind(controller),
    );
  }
}
