// src/Modules/Theme/theme.service.ts
import { PrismaClient } from '@/prisma/generated/client';
import { AppLogger } from '@/core/logging/logger';
import { ConflictError, NotFoundError } from '@/core/errors/AppError';
import { CreateThemeDTO, UpdateThemeDTO } from './ThemeDTO';
import { QueryBuilder } from '@/utils/QueryBuilder';

export class ThemeServices {
  private logger = new AppLogger('ThemeServices');

  constructor(private readonly prisma: PrismaClient) { }

  public async createTheme(data: CreateThemeDTO) {
    this.logger.info('Creating new theme', { slug: data.slug });

    const existingTheme = await this.prisma.theme.findFirst({
      where: { slug: data.slug },
    });

    if (existingTheme) {
      throw new ConflictError('Theme with this slug already exists');
    }

    const newTheme = await this.prisma.theme.create({
      data: {
        name: data.name,
        slug: data.slug,
        previewImageUrl: data.previewImageUrl,
        defaultConfig: (data.defaultConfig ?? {}) as any,
      },
    });

    return newTheme;
  }

  public async getAllThemes(query: Record<string, unknown>) {
    this.logger.info('Fetching all themes', { query });

    const themeQuery = new QueryBuilder(this.prisma.theme, query)
      .search(['name', 'slug'])
      .filter()
      .sort()
      .pagination()
      .fields();

    const themes = await themeQuery.model.findMany(themeQuery.prismaArgs);
    const meta = await themeQuery.countTotal();

    return {
      themes,
      meta,
    };
  }

  public async getThemeBySlug(slug: string) {
    this.logger.info('Fetching theme by slug', { slug });

    const theme = await this.prisma.theme.findFirst({
      where: { slug },
    });

    if (!theme) {
      throw new NotFoundError('Theme not found');
    }

    return theme;
  }

  public async updateTheme(id: number, data: UpdateThemeDTO) {
    this.logger.info('Updating theme', { id });

    const theme = await this.prisma.theme.findUnique({
      where: { id },
    });

    if (!theme) {
      throw new NotFoundError('Theme not found');
    }

    if (data.slug && data.slug !== theme.slug) {
      const existingTheme = await this.prisma.theme.findFirst({
        where: { slug: data.slug },
      });

      if (existingTheme) {
        throw new ConflictError('Theme with this slug already exists');
      }
    }

    const updatedTheme = await this.prisma.theme.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        previewImageUrl: data.previewImageUrl,
        defaultConfig: data.defaultConfig as any,
      },
    });

    return updatedTheme;
  }

  public async deleteTheme(id: number) {
    this.logger.info('Deleting theme', { id });

    const theme = await this.prisma.theme.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tenants: true }
        }
      }
    });

    if (!theme) {
      throw new NotFoundError('Theme not found');
    }

    // We shouldn't delete themes that are currently used by tenants
    if (theme._count.tenants > 0) {
      throw new ConflictError('Cannot delete theme because it is assigned to one or more tenants');
    }

    await this.prisma.theme.delete({
      where: { id },
    });

    return { message: 'Theme deleted successfully' };
  }
}
