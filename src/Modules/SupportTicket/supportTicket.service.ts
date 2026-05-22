import { PrismaClient, TicketStatus } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { CreateSupportTicketDTO, UpdateTicketStatusDTO } from './SupportTicketDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';

export class SupportTicketServices {
  constructor(private prisma: PrismaClient) { }

  async createTicket(data: CreateSupportTicketDTO, userId?: string) {
    return this.prisma.supportTicket.create({
      data: {
        userId, // optional
        fullName: data.fullName,
        email: data.email,
        subject: data.subject,
        issue: data.issue,
        status: TicketStatus.open,
      },
    });
  }

  async getAllTickets(query: Record<string, unknown> = {}) {
    const ticketQuery = new QueryBuilder(this.prisma.supportTicket, query)
      .search(['fullName', 'email', 'subject', 'issue', 'status'])
      .filter()
      .sort()
      .pagination()
      .fields();

    if (!ticketQuery.prismaArgs.select) {
      ticketQuery.prismaArgs.include = {
        user: true,
      };
    }

    const tickets = await ticketQuery.model.findMany(ticketQuery.prismaArgs);
    const meta = await ticketQuery.countTotal();

    return { tickets, meta };
  }

  async getMyTickets(userId: string, query: Record<string, unknown> = {}) {
    const ticketQuery = new QueryBuilder(this.prisma.supportTicket, query)
      .search(['fullName', 'email', 'subject', 'issue', 'status'])
      .filter()
      .sort()
      .pagination()
      .fields();

    ticketQuery.prismaArgs.where = {
      ...ticketQuery.prismaArgs.where,
      userId,
    };

    const tickets = await ticketQuery.model.findMany(ticketQuery.prismaArgs);
    const meta = await ticketQuery.countTotal();

    return { tickets, meta };
  }

  async updateTicketStatus(id: string, data: UpdateTicketStatusDTO) {
    const existing = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError();
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: { status: data.status },
    });
  }
}
