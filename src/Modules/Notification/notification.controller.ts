import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { NotificationServices } from './notification.service';

export class NotificationController extends BaseController {
  constructor(private notificationService: NotificationServices) {
    super();
  }

  public async broadcast(req: Request, res: Response): Promise<void> {
    const result = await this.notificationService.createNotification(req.body);
    this.sendCreatedResponse(req, res, result, 'Notification created/broadcasted successfully');
  }

  public async getMyNotifications(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { notifications, meta } = await this.notificationService.getMyNotifications(userId, req.query);
    this.sendPaginatedResponse(req, res, meta, 'Notifications retrieved successfully', notifications);
  }

  public async markAsRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const notification = await this.notificationService.markAsRead(userId, id);
    this.sendResponse(req, res, 'Notification marked as read', undefined, notification);
  }
}
