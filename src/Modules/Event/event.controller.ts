import { Request, Response } from 'express';
import { EventServices } from './event.service';
import { BaseController } from '@/core/BaseController';

export class EventController extends BaseController {
  constructor(private readonly eventService: EventServices) {
    super();
  }

  public async createEvent(req: Request, res: Response) {
    // Requires authenticated user (DJ)
    const userId = req.user!.id;
    const result = await this.eventService.createEvent(userId, req.body);
    return this.sendCreatedResponse(req, res, result, 'Event created successfully');
  }

  public async getTenantEvents(req: Request, res: Response) {
    const tenantId = req.params.tenantId as string;
    const result = await this.eventService.getTenantEvents(tenantId, req.query as Record<string, unknown>);
    return this.sendPaginatedResponse(req, res, result.meta, 'Events retrieved successfully', result.events);
  }

  public async getEventById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await this.eventService.getEventById(id);
    return this.sendResponse(req, res, 'Event retrieved successfully', 200, result);
  }

  public async updateEvent(req: Request, res: Response) {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const result = await this.eventService.updateEvent(userId, id, req.body);
    return this.sendResponse(req, res, 'Event updated successfully', 200, result);
  }

  public async deleteEvent(req: Request, res: Response) {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const result = await this.eventService.deleteEvent(userId, id);
    return this.sendResponse(req, res, result.message, 200, null);
  }
}
