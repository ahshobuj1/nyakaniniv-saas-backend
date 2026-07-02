// src/Modules/Tenant/tenant.service.ts
import { PrismaClient } from '@/prisma/generated/client';
import { AppLogger } from '@/core/logging/logger';
import { ConflictError, NotFoundError } from '@/core/errors/AppError';
import { CreateTenantDTO, UpdateTenantDTO } from './TenantDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { UpdateTenantStatusDTO } from './TenantDTO';

export class TenantServices {
  private logger = new AppLogger('TenantServices');

  constructor(
    private readonly prisma: PrismaClient,
    private readonly emailProvider: IEmailProvider
  ) { }

  public async createTenant(userId: string, data: CreateTenantDTO) {
    this.logger.info('Attempting to onboard tenant', {
      userId,
      subdomain: data.subdomain,
    });

    // 1. Check if user already has a tenant profile
    const existingUserTenant = await this.prisma.tenant.findUnique({
      where: { userId },
    });

    if (existingUserTenant) {
      throw new ConflictError('User already has a tenant profile');
    }

    // 2. Check if subdomain is taken
    const existingSubdomain = await this.prisma.tenant.findUnique({
      where: { subdomain: data.subdomain },
    });

    if (existingSubdomain) {
      throw new ConflictError('Subdomain is already taken');
    }

    const newTenant = await this.prisma.tenant.create({
      data: {
        userId,
        subdomain: data.subdomain,
        stageName: data.stageName,
        country: data.country,
        city: data.city,
        genres: data.genres ?? [],
        isActive: true, // Assuming active by default, or depends on subscription later
      },
      include: { user: true }
    });

    if (newTenant.user && newTenant.user.email) {
      const url = `https://${newTenant.subdomain}.upbeatafrica.com`;
      this.emailProvider.sendEmail(
        newTenant.user.email,
        "Your Portfolio is Live! 🌐 - UpbeatAfrica",
        EmailTemplates.getPortfolioLiveTemplate(url)
      );
    }

    return newTenant;
  }

  public async getAllTenants(query: Record<string, unknown>) {
    this.logger.info('Fetching all tenants (Admin)', { query });

    const tenantQuery = new QueryBuilder(this.prisma.tenant, query)
      .search(['subdomain', 'stageName', 'country', 'city'])
      .filter()
      .sort()
      .pagination()
      .fields();

    // In Prisma, if we use select via fields(), we can't easily merge includes
    // So we'll conditionally add our include if fields() wasn't used
    if (!tenantQuery.prismaArgs.select) {
      tenantQuery.prismaArgs.include = {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      };
    }

    const tenants = await tenantQuery.model.findMany(tenantQuery.prismaArgs);
    const meta = await tenantQuery.countTotal();

    return {
      tenants,
      meta,
    };
  }

  public async getTenantBySubdomain(subdomain: string) {
    this.logger.info('Fetching tenant profile publicly', { subdomain });

    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
      include: {
        theme: true,
        mixTapes: {
          orderBy: { order: 'asc' },
        },
        events: {
          orderBy: { eventDate: 'asc' },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant profile not found');
    }

    return tenant;
  }

  public async updateTenantProfile(userId: string, data: UpdateTenantDTO) {
    this.logger.info('Updating tenant profile', { userId });

    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant profile not found');
    }

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        stageName: data.stageName,
        country: data.country,
        city: data.city,
        genres: data.genres ?? tenant.genres ?? [],
        bio: data.bio,
        logoUrl: data.logoUrl,
        timezone: data.timezone,
        socialLinks: data.socialLinks,
      },
    });

    return updatedTenant;
  }

  public async assignTheme(userId: string, themeSlug: string, config?: any) {
    this.logger.info('Assigning theme to tenant', { userId, themeSlug });

    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant profile not found');
    }

    const theme = await this.prisma.theme.findFirst({
      where: { slug: themeSlug },
    });

    if (!theme) {
      throw new NotFoundError('Theme not found');
    }

    // When assigning a theme, we might want to copy its default config
    // into the tenant's config to allow them to override it later.
    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        themeId: theme.id,
        config: config ? config : (theme.defaultConfig || {}),
      },
      include: {
        theme: true,
      },
    });

    return updatedTenant;
  }

  public async updateTenantStatus(tenantId: string, data: UpdateTenantStatusDTO) {
    this.logger.info('Updating tenant status', { tenantId, isActive: data.isActive });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user: true }
    });

    if (!tenant) {
      throw new NotFoundError('Tenant profile not found');
    }

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: data.isActive }
    });

    // Send Account Suspended email if isActive changes to false
    if (!data.isActive && tenant.isActive && tenant.user?.email) {
      this.emailProvider.sendEmail(
        tenant.user.email,
        "Account Suspended 🚫 - UpbeatAfrica",
        EmailTemplates.getAccountSuspendedTemplate()
      );
    }

    return updatedTenant;
  }
}
