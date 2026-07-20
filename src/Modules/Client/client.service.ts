import { PrismaClient } from '@/prisma/generated/client';
import { NotFoundError } from '@/core/errors/AppError';
import { QueryBuilder } from '@/utils/QueryBuilder';

export class ClientServices {
  constructor(private prisma: PrismaClient) {}

  async getMyClients(userId: string, query: Record<string, unknown> = {}) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const clientQuery = new QueryBuilder(this.prisma.client, query)
      .search(['name', 'email', 'phone'])
      .filter()
      .sort()
      .pagination()
      .fields();

    clientQuery.prismaArgs.where = {
      ...clientQuery.prismaArgs.where,
      tenantId: tenant.id,
    };

    if (!clientQuery.prismaArgs.select) {
      clientQuery.prismaArgs.include = {
        _count: { select: { bookings: true } },
        bookings: { 
          select: { id: true, eventType: true, eventDate: true, status: true }, 
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      };
    }

    const clients = await clientQuery.model.findMany(clientQuery.prismaArgs);
    const meta = await clientQuery.countTotal();

    return { clients, meta };
  }

  async getClientById(userId: string, id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const client = await this.prisma.client.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        bookings: {
          include: { payment: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!client) {
      throw new NotFoundError('Client not found');
    }

    return client;
  }
}
