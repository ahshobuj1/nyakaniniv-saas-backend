import { z } from 'zod';
import { NotificationType } from '@/prisma/generated/client';

export const createNotificationSchema = {
  body: z.object({
    userId: z.string().uuid("Invalid User ID").optional(), // if empty, broadcast to all
    title: z.string().min(2, "Title must be at least 2 characters"),
    message: z.string().min(5, "Message must be at least 5 characters"),
    type: z.nativeEnum(NotificationType).optional().default(NotificationType.system),
  }),
};

export type CreateNotificationDTO = z.infer<typeof createNotificationSchema.body>;
