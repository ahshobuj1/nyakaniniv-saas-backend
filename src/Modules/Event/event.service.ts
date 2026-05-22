import { PrismaClient, EventStatus } from '@/prisma/generated/client';
import { AppLogger } from '@/core/logging/logger';
import { NotFoundError, ConflictError } from '@/core/errors/AppError';
import { CreateEventDTO, UpdateEventDTO } from './EventDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';

export class EventServices {
  private logger = new AppLogger('EventServices');

  constructor(private readonly prisma: PrismaClient) { }

  public async createEvent(userId: string, data: CreateEventDTO) {
    this.logger.info('Creating new event', { userId });

    // First find the tenant associated with this user
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant profile not found for this user');
    }

    const newEvent = await this.prisma.event.create({
      data: {
        tenantId: tenant.id,
        title: data.title,
        description: data.description,
        eventDate: new Date(data.eventDate),
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        capacity: data.capacity,
        price: data.price,
        status: data.status,
      },
      include: {
        tenant: {
          select: {
            id: true,
            subdomain: true,
            stageName: true,
            city: true,
            country: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return newEvent;
  }

  public async getTenantEvents(tenantId: string, query: Record<string, unknown>) {
    this.logger.info('Fetching tenant events', { tenantId, query });

    // Ensure we only fetch events for this tenant
    const safeQuery = { ...query, tenantId };

    const eventQuery = new QueryBuilder(this.prisma.event, safeQuery)
      .search(['title', 'venueName'])
      .filter()
      .sort()
      .pagination()
      .fields();

    const events = await eventQuery.model.findMany(eventQuery.prismaArgs);
    const meta = await eventQuery.countTotal();

    return {
      events,
      meta,
    };
  }

  public async getEventById(id: string) {
    this.logger.info('Fetching event by ID', { id });

    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    return event;
  }

  public async updateEvent(userId: string, id: string, data: UpdateEventDTO) {
    this.logger.info('Updating event', { id, userId });

    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant profile not found for this user');
    }

    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Ensure the event belongs to the tenant
    if (event.tenantId !== tenant.id) {
      throw new ConflictError('You do not have permission to update this event');
    }

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        capacity: data.capacity,
        price: data.price,
        status: data.status,
      },
    });

    return updatedEvent;
  }

  public async deleteEvent(userId: string, id: string) {
    this.logger.info('Deleting event', { id, userId });

    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant profile not found for this user');
    }

    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Ensure the event belongs to the tenant
    if (event.tenantId !== tenant.id) {
      throw new ConflictError('You do not have permission to delete this event');
    }

    await this.prisma.event.delete({
      where: { id },
    });

    return { message: 'Event deleted successfully' };
  }
}
