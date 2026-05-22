import { z } from 'zod';
import { EventStatus } from '@/prisma/generated/client';

export const createEventSchema = {
  body: z.object({
    tenantId: z.string().uuid("Invalid tenant ID").optional(),
    title: z.string().min(2, "Event title must be at least 2 characters"),
    description: z.string().optional(),
    eventDate: z.string().datetime("Must be a valid ISO datetime"),
    venueName: z.string().min(2, "Venue name must be at least 2 characters"),
    venueAddress: z.string().optional(),
    capacity: z.number().int().positive("Capacity must be a positive number").optional(),
    price: z.number().nonnegative("Price cannot be negative").optional(),
    status: z.nativeEnum(EventStatus).optional().default(EventStatus.upcoming),
  }),
};

export const updateEventSchema = {
  body: z.object({
    title: z.string().min(2, "Event title must be at least 2 characters").optional(),
    description: z.string().optional(),
    eventDate: z.string().datetime("Must be a valid ISO datetime").optional(),
    venueName: z.string().min(2, "Venue name must be at least 2 characters").optional(),
    venueAddress: z.string().optional(),
    capacity: z.number().int().positive("Capacity must be a positive number").optional(),
    price: z.number().nonnegative("Price cannot be negative").optional(),
    status: z.nativeEnum(EventStatus).optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid event ID"),
  }),
};

export type CreateEventDTO = z.infer<typeof createEventSchema.body>;
export type UpdateEventDTO = z.infer<typeof updateEventSchema.body>;
