import { PrismaClient } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import { IFileUploader } from '@/utils/IFileUploader';
import { CreateMixTapeDTO, UpdateMixTapeDTO, ReorderMixTapesDTO } from './MixTapeDTO';

export class MixTapeServices {
  constructor(
    private prisma: PrismaClient,
    private fileUploader: IFileUploader
  ) {}

  private async getTenantIdByUserId(userId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) {
      throw new AuthorizationError();
    }
    return tenant.id;
  }

  async createMixTape(userId: string, data: CreateMixTapeDTO, coverFile?: Express.Multer.File) {
    const tenantId = await this.getTenantIdByUserId(userId);
    let coverUrl = undefined;
    if (coverFile) {
      coverUrl = await this.fileUploader.upload(coverFile);
    }

    let order = data.order;
    if (order === undefined) {
      const lastMixTape = await this.prisma.mixTape.findFirst({
        where: { tenantId },
        orderBy: { order: 'desc' },
      });
      order = lastMixTape && lastMixTape.order !== null ? lastMixTape.order + 1 : 0;
    }

    return this.prisma.mixTape.create({
      data: {
        tenantId,
        title: data.title,
        audioUrl: data.audioUrl,
        coverUrl,
        order,
      },
    });
  }

  async getTenantMixTapes(tenantId: string) {
    return this.prisma.mixTape.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    });
  }

  async updateMixTape(userId: string, id: string, data: UpdateMixTapeDTO, coverFile?: Express.Multer.File) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const existing = await this.prisma.mixTape.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError();
    }

    let coverUrl = existing.coverUrl;
    if (coverFile) {
      coverUrl = await this.fileUploader.upload(coverFile);
    }

    return this.prisma.mixTape.update({
      where: { id },
      data: {
        title: data.title !== undefined ? data.title : existing.title,
        audioUrl: data.audioUrl !== undefined ? data.audioUrl : existing.audioUrl,
        order: data.order !== undefined ? data.order : existing.order,
        coverUrl,
      },
    });
  }

  async deleteMixTape(userId: string, id: string) {
    const tenantId = await this.getTenantIdByUserId(userId);
    const existing = await this.prisma.mixTape.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError();
    }

    await this.prisma.mixTape.delete({ where: { id } });
    return { success: true };
  }

  async reorderMixTapes(userId: string, data: ReorderMixTapesDTO) {
    const tenantId = await this.getTenantIdByUserId(userId);
    // Validate all mixtapes belong to tenant
    const ids = data.orders.map(o => o.id);
    const existing = await this.prisma.mixTape.findMany({
      where: { id: { in: ids }, tenantId },
    });

    if (existing.length !== ids.length) {
      throw new BadRequestError();
    }

    // Perform bulk update in a transaction
    await this.prisma.$transaction(
      data.orders.map((item) =>
        this.prisma.mixTape.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );

    return { success: true };
  }
}
