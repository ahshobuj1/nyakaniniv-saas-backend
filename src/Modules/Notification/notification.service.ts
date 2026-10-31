import { PrismaClient, NotificationType, UserRole } from '@/prisma/generated/client';
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
          referenceId: data.referenceId,
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
        referenceId: data.referenceId,
      })),
    });

    return { success: true, count: users.length };
  }

  async getMyNotifications(userId: string, query: Record<string, unknown> = {}) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN;

    const { category, isRead, ...restQuery } = query;

    const notificationQuery = new QueryBuilder(this.prisma.notification, restQuery)
      .search(['title', 'message', 'referenceId'])
      .filter()
      .sort()
      .pagination()
      .fields();

    // Build scoped criteria: Admin sees platform/admin notifications; DJ only sees own notifications
    const andConditions: any[] = [];

    if (isAdmin) {
      andConditions.push({
        OR: [
          { userId: null },
          { userId: userId },
        ],
      });
    } else {
      andConditions.push({ userId });
    }

    // Read status filter
    if (isRead !== undefined && isRead !== '' && isRead !== 'all') {
      andConditions.push({ isRead: isRead === 'true' || isRead === true });
    }

    // Category filtering
    if (category && category !== 'all') {
      const cat = String(category).toLowerCase();
      if (cat === 'bookings' || cat === 'booking') {
        andConditions.push({ type: NotificationType.booking_request });
      } else if (cat === 'payments' || cat === 'payment') {
        andConditions.push({
          OR: [
            { type: NotificationType.payment },
            { message: { contains: 'payment', mode: 'insensitive' } },
            { title: { contains: 'payment', mode: 'insensitive' } },
            { message: { contains: 'subscription', mode: 'insensitive' } },
            { title: { contains: 'subscription', mode: 'insensitive' } },
          ],
        });
      } else if (cat === 'support' || cat === 'ticket') {
        andConditions.push({
          OR: [
            { title: { contains: 'ticket', mode: 'insensitive' } },
            { message: { contains: 'ticket', mode: 'insensitive' } },
            { message: { contains: 'support', mode: 'insensitive' } },
          ],
        });
      } else if (cat === 'tenants' || cat === 'tenant' || cat === 'dj') {
        andConditions.push({
          OR: [
            { title: { contains: 'tenant', mode: 'insensitive' } },
            { title: { contains: 'dj', mode: 'insensitive' } },
            { message: { contains: 'profile', mode: 'insensitive' } },
          ],
        });
      }
    }

    if (andConditions.length > 0) {
      notificationQuery.prismaArgs.where = {
        ...notificationQuery.prismaArgs.where,
        AND: [
          ...(notificationQuery.prismaArgs.where?.AND || []),
          ...andConditions,
        ],
      };
    }

    // Ensure default ordering is newest first
    if (!notificationQuery.prismaArgs.orderBy) {
      notificationQuery.prismaArgs.orderBy = [{ createdAt: 'desc' }];
    }

    const notifications = await notificationQuery.model.findMany(notificationQuery.prismaArgs);
    const meta = await notificationQuery.countTotal();

    return { notifications, meta };
  }

  async markAsRead(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN;

    const whereClause: any = { id };
    if (!isAdmin) {
      whereClause.userId = userId;
    }

    const notification = await this.prisma.notification.findFirst({
      where: whereClause,
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN;

    const whereClause: any = { isRead: false };
    if (isAdmin) {
      whereClause.OR = [
        { userId: null },
        { userId: userId },
      ];
    } else {
      whereClause.userId = userId;
    }

    await this.prisma.notification.updateMany({
      where: whereClause,
      data: { isRead: true },
    });

    return { success: true };
  }

  async getUnreadCount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN;

    const whereClause: any = { isRead: false };
    if (isAdmin) {
      whereClause.OR = [
        { userId: null },
        { userId: userId },
      ];
    } else {
      whereClause.userId = userId;
    }

    const count = await this.prisma.notification.count({
      where: whereClause,
    });
    return { count };
  }
}
