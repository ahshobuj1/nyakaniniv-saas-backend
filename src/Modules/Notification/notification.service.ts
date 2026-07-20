import { PrismaClient, NotificationType } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { CreateNotificationDTO } from './NotificationDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';

export class NotificationServices {
  constructor(private prisma: PrismaClient) {}

  async createNotification(data: CreateNotificationDTO) {
    if (data.userId) {
      return this.prisma.notification.create({
        data: {
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type,
        },
      });
    }

    // Broadcast logic: get all user IDs and create notifications
    const users = await this.prisma.user.findMany({ select: { id: true } });
    if (users.length === 0) return { success: true, count: 0 };

    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title: data.title,
        message: data.message,
        type: data.type,
      })),
    });

    return { success: true, count: users.length };
  }

  async getMyNotifications(userId: string, query: Record<string, unknown> = {}) {
    const notificationQuery = new QueryBuilder(this.prisma.notification, query)
      .search(['title', 'message', 'type'])
      .filter()
      .sort()
      .pagination()
      .fields();

    // Ensure users only see their own notifications
    notificationQuery.prismaArgs.where = {
      ...notificationQuery.prismaArgs.where,
      userId,
    };

    const notifications = await notificationQuery.model.findMany(notificationQuery.prismaArgs);
    const meta = await notificationQuery.countTotal();

    return { notifications, meta };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundError();
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }
}
