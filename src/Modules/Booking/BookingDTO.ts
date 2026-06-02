import { z } from 'zod';
import { BookingStatus } from '@/prisma/generated/client';

export const createBookingSchema = {
  body: z.object({
    tenantId: z.string().uuid("Invalid Tenant ID"),
    clientName: z.string().min(2, "Name must be at least 2 characters"),
    clientEmail: z.string().email("Invalid email address"),
    eventType: z.string().min(2, "Event type is required"),
    eventDetails: z.string().optional(),
    clientPhone: z.string().optional(),
    eventDate: z.string().datetime("Invalid event date format"),
    address: z.string().min(5, "Address must be at least 5 characters"),
  }),
};

export const updateBookingStatusSchema = {
  body: z.object({
    status: z.nativeEnum(BookingStatus),
    totalAmount: z.number().positive("Total amount must be positive").optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid Booking ID"),
  }),
};

export type CreateBookingDTO = z.infer<typeof createBookingSchema.body>;
export type UpdateBookingStatusDTO = z.infer<typeof updateBookingStatusSchema.body>;
