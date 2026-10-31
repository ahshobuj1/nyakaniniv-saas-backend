import { PrismaClient, TicketStatus, NotificationType } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { CreateSupportTicketDTO, UpdateTicketStatusDTO } from './SupportTicketDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { config } from '@/core/config';

import { isValidUuid } from '@/utils/uuid';

export class SupportTicketServices {
  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) { }

  async createTicket(data: CreateSupportTicketDTO, userId?: string) {
    if (userId && !isValidUuid(userId)) {
      userId = undefined;
    }
    if (!userId && data.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingUser) {
        userId = existingUser.id;
      }
    }
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
      `New Support Ticket: ${ticket.id}`,
      EmailTemplates.getNewSupportTicketAdminAlertTemplate(data.fullName, data.subject, data.issue)
    );

    // Auto-reply to User
    if (data.email) {
      this.emailProvider.sendEmail(
        data.email,
        "Support Ticket Received - UpBeat Entertainment Africa",
        EmailTemplates.getSupportTicketReceivedTemplate(data.subject)
      );
    }

    // Create system notification for Admin
    await this.prisma.notification.create({
      data: {
        title: 'New Support Ticket',
        message: `${data.fullName} submitted a support ticket: "${data.subject}"`,
        type: NotificationType.system,
        referenceId: ticket.id,
      },
    }).catch(err => {
      console.error('Failed to create notification for support ticket:', err);
    });

    return ticket;
  }

  async getAllTickets(query: Record<string, unknown> = {}) {
    const { priority, plan, ...restQuery } = query;

    const ticketQuery = new QueryBuilder(this.prisma.supportTicket, restQuery)
      .search(['fullName', 'email', 'subject', 'issue'])
      .filter()
      .sort()
      .pagination()
      .fields();

    // Priority Support filter: Tickets submitted by DJs on plans with Priority Support (e.g. Elite)
    if (priority === 'priority' || priority === 'high') {
      ticketQuery.prismaArgs.where.user = {
        subscriptions: {
          some: {
            status: 'active',
            plan: {
              name: { in: ['Elite', 'elite', 'ELITE'] },
            },
          },
        },
      };
    } else if (priority === 'standard' || priority === 'regular') {
      ticketQuery.prismaArgs.where.OR = [
        { userId: null },
        {
          user: {
            subscriptions: {
              none: {
                status: 'active',
                plan: {
                  name: { in: ['Elite', 'elite', 'ELITE'] },
                },
              },
            },
          },
        },
      ];
    }

    // Plan name filter
    if (plan && plan !== 'all') {
      ticketQuery.prismaArgs.where.user = {
        subscriptions: {
          some: {
            status: 'active',
            plan: {
              name: { equals: String(plan), mode: 'insensitive' },
            },
          },
        },
      };
    }

    if (!ticketQuery.prismaArgs.select) {
      ticketQuery.prismaArgs.include = {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImg: true,
            role: true,
            tenant: {
              select: {
                id: true,
                stageName: true,
                subdomain: true,
              },
            },
            subscriptions: {
              where: {
                status: 'active',
              },
              take: 1,
              orderBy: {
                createdAt: 'desc',
              },
              include: {
                plan: true,
              },
            },
          },
        },
      };
    }

    const rawTickets = await ticketQuery.model.findMany(ticketQuery.prismaArgs);
    const meta = await ticketQuery.countTotal();

    // For any tickets without user linked, check if user exists by email
    const missingEmails = rawTickets
      .filter((t: any) => !t.user && t.email)
      .map((t: any) => t.email.toLowerCase());

    let usersByEmail: Record<string, any> = {};
    if (missingEmails.length > 0) {
      const foundUsers = await this.prisma.user.findMany({
        where: { email: { in: missingEmails } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          profileImg: true,
          role: true,
          tenant: {
            select: {
              id: true,
              stageName: true,
              subdomain: true,
            },
          },
          subscriptions: {
            where: {
              status: 'active',
            },
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
            include: {
              plan: true,
            },
          },
        },
      });
      usersByEmail = Object.fromEntries(foundUsers.map(u => [u.email.toLowerCase(), u]));
    }

    const tickets = rawTickets.map((ticket: any) => {
      const user = ticket.user || (ticket.email ? usersByEmail[ticket.email.toLowerCase()] : null);
      const activeSubscription = user?.subscriptions?.[0] || null;
      const activePlan = activeSubscription?.plan || null;
      const planName = activePlan?.name || null;
      const hasPrioritySupport =
        Boolean(activePlan?.features?.PRIORITY_SUPPORT) ||
        (typeof planName === 'string' && planName.toLowerCase() === 'elite');

      return {
        ...ticket,
        user,
        tenant: user?.tenant || null,
        activePlan,
        planName,
        priority: hasPrioritySupport ? 'priority' : 'standard',
        hasPrioritySupport,
      };
    });

    return { tickets, meta };
  }

  async getMyTickets(userId: string, query: Record<string, unknown> = {}) {
    if (!isValidUuid(userId)) {
      return { tickets: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrevious: false } };
    }
    const ticketQuery = new QueryBuilder(this.prisma.supportTicket, query)
      .search(['fullName', 'email', 'subject', 'issue'])
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
    if (!isValidUuid(id)) {
      throw new NotFoundError('Ticket not found');
    }
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
        "Support Ticket Resolved ✅ - UpBeat Entertainment Africa",
        EmailTemplates.getSupportTicketResolvedTemplate(updated.subject || "Your Ticket")
      );
    }

    return updated;
  }
}
