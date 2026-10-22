import {z} from 'zod';
import {BookingStatus} from '@/prisma/generated/client';

export const createBookingSchema = {
  body: z.object({
    tenantId: z.string().uuid('Invalid Tenant ID'),
    clientName: z.string().min(2, 'Name must be at least 2 characters'),
    clientEmail: z.string().email('Invalid email address'),
    eventType: z.string().min(2, 'Event type is required'),
    eventDetails: z.string().optional(),
    clientPhone: z.string().optional(),
    eventDate: z
      .string()
      .datetime({offset: true, message: 'Invalid event date format'}),
    eventTimezone: z.string().optional(),
    currencyCode: z.string().length(3).optional(),
    address: z.string().min(5, 'Address must be at least 5 characters'),
  }),
};

export const initiateBookingSchema = createBookingSchema;

export const verifyBookingOtpSchema = {
  body: z.object({
    verificationToken: z.string().min(10, 'Invalid verification token'),
    otp: z.string().length(6, 'Verification code must be 6 digits'),
  }),
};

export const resendBookingOtpSchema = {
  body: z.object({
    verificationToken: z.string().min(10, 'Invalid verification token'),
  }),
};

const bookingStatusEnum = z.preprocess((val) => {
  if (typeof val === 'string') {
    const u = val.trim().toUpperCase();
    if (u === 'CANCELED') return BookingStatus.CANCELLED;
    return u;
  }
  return val;
}, z.nativeEnum(BookingStatus));

export const updateBookingStatusSchema = {
  body: z.object({
    status: bookingStatusEnum,
    totalAmount: z
      .number()
      .positive('Total amount must be positive')
      .optional(),
    currencyCode: z.string().length(3).optional(),
    reason: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid Booking ID'),
  }),
};

// Portal Access OTP Schemas
export const requestBookingAccessOtpSchema = {
  body: z.object({
    orderReference: z.string().min(3, 'Booking reference is required').max(60),
    email: z.string().email().optional(),
  }),
};

export const verifyBookingAccessOtpSchema = {
  body: z.object({
    sessionToken: z.string().min(10, 'Invalid session token'),
    otp: z
      .string()
      .min(6, 'Verification code must be 6 digits')
      .max(10, 'Verification code cannot exceed 10 characters'),
  }),
};

export const resendBookingAccessOtpSchema = {
  body: z.object({
    sessionToken: z.string().min(10, 'Invalid session token'),
  }),
};

// Booking Message Schema
export const createBookingMessageSchema = {
  body: z.object({
    content: z
      .string()
      .min(1, 'Message cannot be empty')
      .max(2000, 'Message cannot exceed 2000 characters'),
  }),
};

// Quote Negotiation Schemas
export const proposeQuoteSchema = {
  body: z.object({
    amount: z.number().positive('Quote amount must be positive'),
    currency: z
      .string()
      .length(3, 'Currency code must be 3 characters')
      .optional(),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  }),
};

export const acceptQuoteSchema = {
  params: z.object({
    id: z.string().uuid('Invalid Booking ID'),
    quoteId: z.string().uuid('Invalid Quote ID'),
  }),
};

export const rejectQuoteSchema = {
  params: z.object({
    id: z.string().uuid('Invalid Booking ID'),
    quoteId: z.string().uuid('Invalid Quote ID'),
  }),
  body: z
    .object({
      reason: z.string().max(500).optional(),
    })
    .optional(),
};

// Direct Payment Schemas
export const reportDirectPaymentSchema = {
  body: z.object({
    method: z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER']),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  }),
};

// Completion & Issue Schemas
export const reportIssueSchema = {
  body: z.object({
    description: z
      .string()
      .min(5, 'Issue description must be at least 5 characters')
      .max(2000),
  }),
};

export const submitReviewSchema = {
  body: z.object({
    rating: z
      .number()
      .int()
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5'),
    reviewText: z
      .string()
      .max(2000, 'Review cannot exceed 2000 characters')
      .optional(),
  }),
};

export type CreateBookingDTO = z.infer<typeof createBookingSchema.body>;
export type InitiateBookingDTO = CreateBookingDTO;
export type VerifyBookingOtpDTO = z.infer<typeof verifyBookingOtpSchema.body>;
export type ResendBookingOtpDTO = z.infer<typeof resendBookingOtpSchema.body>;
export type UpdateBookingStatusDTO = z.infer<
  typeof updateBookingStatusSchema.body
>;
export type RequestBookingAccessOtpDTO = z.infer<
  typeof requestBookingAccessOtpSchema.body
>;
export type VerifyBookingAccessOtpDTO = z.infer<
  typeof verifyBookingAccessOtpSchema.body
>;
export type ResendBookingAccessOtpDTO = z.infer<
  typeof resendBookingAccessOtpSchema.body
>;
export type CreateBookingMessageDTO = z.infer<
  typeof createBookingMessageSchema.body
>;
export type ProposeQuoteDTO = z.infer<typeof proposeQuoteSchema.body>;
export type ReportDirectPaymentDTO = z.infer<
  typeof reportDirectPaymentSchema.body
>;
export type ReportIssueDTO = z.infer<typeof reportIssueSchema.body>;
export type SubmitReviewDTO = z.infer<typeof submitReviewSchema.body>;
