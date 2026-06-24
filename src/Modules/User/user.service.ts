import { PrismaClient } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError } from '@/core/errors/AppError';
import { UpdateProfileDTO, UpdateUserRoleDTO, UpdateUserStatusDTO } from './UserDTO';

export class UserServices {
  constructor(private prisma: PrismaClient) {}

  async getAllUsers(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;
    
    const whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.user.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    };
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        profileImg: true,
        isVerified: true,
        createdAt: true,
        tenant: {
          include: {
            mixTapes: { orderBy: { order: 'asc' } },
            events: { orderBy: { eventDate: 'asc' } },
            theme: true,
          }
        },
      }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, data: UpdateProfileDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName !== undefined ? data.firstName : user.firstName,
        lastName: data.lastName !== undefined ? data.lastName : user.lastName,
        profileImg: data.profileImg !== undefined ? data.profileImg : user.profileImg,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        profileImg: true,
      }
    });
  }

  async updateUserStatus(userId: string, data: UpdateUserStatusDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: data.isVerified !== undefined ? data.isVerified : user.isVerified,
      },
      select: { id: true, email: true, isVerified: true }
    });
  }

  async updateUserRole(userId: string, data: UpdateUserRoleDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        role: data.role,
      },
      select: { id: true, email: true, role: true }
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Attempting a hard delete - note this might fail if there are FK constraints.
    // A soft delete might be preferred for production, but this aligns with the requirement.
    await this.prisma.user.delete({
      where: { id: userId }
    });

    return { success: true, message: 'User deleted successfully' };
  }
}
