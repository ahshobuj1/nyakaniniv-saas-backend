import { PrismaClient, BookingStatus, InvoiceType, InvoiceMethod, InvoicePaymentStatus } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { CreateBookingDTO, UpdateBookingStatusDTO } from './BookingDTO';

export class BookingServices {
  constructor(private prisma: PrismaClient) {}

  private async getTenantIdByUserId(userId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) {
      throw new AuthorizationError();
    }
    return tenant.id;
  }

  async createBooking(data: CreateBookingDTO) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: data.tenantId } });
    if (!tenant) {
      throw new NotFoundError();
    }

    return this.prisma.booking.create({
      data: {
        tenantId: data.tenantId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        eventType: data.eventType,
        eventDetails: data.eventDetails,
        status: BookingStatus.pending,
      },
    });
  }

  async getMyBookings(userId: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    return this.prisma.booking.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: true,
      }
    });
  }

  async getBookingById(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
      include: { invoice: true },
    });

    if (!booking) {
      throw new NotFoundError();
    }
    return booking;
  }

  async updateBookingStatus(userId: string, id: string, data: UpdateBookingStatusDTO) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, tenantId },
    });

    if (!booking) {
      throw new NotFoundError();
    }

    // Logic for accepting a booking: create an invoice
    if (data.status === BookingStatus.accepted && booking.status !== BookingStatus.accepted) {
      if (!data.totalAmount) {
        throw new BadRequestError();
      }

      // Perform in transaction
      return this.prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id },
          data: {
            status: data.status,
            totalAmount: data.totalAmount,
          },
        });

        // Create Invoice
        await tx.invoice.create({
          data: {
            tenantId,
            bookingId: id,
            amount: data.totalAmount,
            type: InvoiceType.BOOKING,
            method: InvoiceMethod.STRIPE, // default to stripe, client pays online
            status: InvoicePaymentStatus.unpaid,
          }
        });

        return updatedBooking;
      });
    }

    // Otherwise just update status
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.totalAmount && { totalAmount: data.totalAmount }),
      },
    });
  }
}
