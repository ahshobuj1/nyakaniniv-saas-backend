import { prisma } from '@/lib/prisma';
import { UserRole } from '@/prisma/generated/client';
import { hashPassword } from '@/utils/password';
import { config } from '@/core/config';
import { AppLogger } from '@/core/logging/logger';

export const seedSuperAdmin = async () => {
  try {
    const email = config.defaultAdmin.email || 'admin@upbeat.africa';
    const rawPassword = config.defaultAdmin.password || 'Admin@123456';

    const isSuperAdminExist = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!isSuperAdminExist) {
      const hashedPassword = await hashPassword(rawPassword);

      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: 'Super',
          lastName: 'Admin',
          role: UserRole.SUPER_ADMIN,
          isVerified: true,
        },
      });

      AppLogger.info(`👑 Super Admin seeded successfully with email: ${email}`);
    } else {
      AppLogger.info(`✔ Super Admin (${email}) already exists`);
    }
  } catch (error) {
    AppLogger.error('Failed to seed Super Admin:', { error });
  }
};

export default seedSuperAdmin;
