import { z } from 'zod';
import { TicketStatus } from '@/prisma/generated/client';

export const createSupportTicketSchema = {
  body: z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    subject: z.string().min(2, "Subject is required"),
    issue: z.string().min(10, "Please describe the issue in detail"),
  }),
};

export const updateTicketStatusSchema = {
  body: z.object({
    status: z.nativeEnum(TicketStatus),
  }),
  params: z.object({
    id: z.string().uuid("Invalid Ticket ID"),
  }),
};

export type CreateSupportTicketDTO = z.infer<typeof createSupportTicketSchema.body>;
export type UpdateTicketStatusDTO = z.infer<typeof updateTicketStatusSchema.body>;
