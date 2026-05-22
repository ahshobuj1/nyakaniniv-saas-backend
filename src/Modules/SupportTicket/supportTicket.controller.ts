import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { SupportTicketServices } from './supportTicket.service';

export class SupportTicketController extends BaseController {
  constructor(private ticketService: SupportTicketServices) {
    super();
  }

  public async createTicket(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id; // Optional
    const ticket = await this.ticketService.createTicket(req.body, userId);
    this.sendCreatedResponse(req, res, ticket, 'Support ticket submitted successfully');
  }

  public async getAllTickets(req: Request, res: Response): Promise<void> {
    const tickets = await this.ticketService.getAllTickets();
    this.sendResponse(req, res, 'Tickets retrieved successfully', undefined, tickets);
  }

  public async getMyTickets(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const tickets = await this.ticketService.getMyTickets(userId);
    this.sendResponse(req, res, 'Tickets retrieved successfully', undefined, tickets);
  }

  public async updateTicketStatus(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const ticket = await this.ticketService.updateTicketStatus(id, req.body);
    this.sendResponse(req, res, 'Ticket status updated successfully', undefined, ticket);
  }
}
