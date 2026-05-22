import { PrismaClient, TicketStatus } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { CreateSupportTicketDTO, UpdateTicketStatusDTO } from './SupportTicketDTO';

export class SupportTicketServices {
  constructor(private prisma: PrismaClient) {}

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

  async getAllTickets() {
    return this.prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true, // to see who submitted if it's a logged in user
      }
    });
  }

  async getMyTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
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
