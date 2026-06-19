import { PrismaClient, TicketStatus } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { CreateSupportTicketDTO, UpdateTicketStatusDTO } from './SupportTicketDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { config } from '@/core/config';

export class SupportTicketServices {
  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) { }

  async createTicket(data: CreateSupportTicketDTO, userId?: string) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId, // optional
        fullName: data.fullName,
        email: data.email,
        subject: data.subject,
        issue: data.issue,
        status: TicketStatus.open,
      },
    });

    // Alert Admin
    this.emailProvider.sendEmail(
      config.defaultAdmin.email || "admin@upbeatafrica.com",
      `New Support Ticket: ${data.subject}`,
      EmailTemplates.getNewSupportTicketAdminAlertTemplate(data.fullName, data.subject, data.issue)
    );

    // Auto-reply to User
    if (data.email) {
      this.emailProvider.sendEmail(
        data.email,
        "Support Ticket Received - UpbeatAfrica",
        EmailTemplates.getSupportTicketReceivedTemplate(data.subject)
      );
    }

    return ticket;
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

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: { status: data.status },
    });

    if (data.status === TicketStatus.resolved && updated.email) {
      this.emailProvider.sendEmail(
        updated.email,
        "Support Ticket Resolved ✅ - UpbeatAfrica",
        EmailTemplates.getSupportTicketResolvedTemplate(updated.subject || "Your Ticket")
      );
    }

    return updated;
  }
}
