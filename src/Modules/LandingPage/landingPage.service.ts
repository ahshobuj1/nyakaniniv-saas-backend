import { PrismaClient } from '@/prisma/generated/client';
import { IFileUploader } from '@/utils/IFileUploader';

export class LandingPageServices {
  constructor(private prisma: PrismaClient, private fileUploader: IFileUploader) {}

  async getLandingPageContent() {
    const [heroes, steps, services, faqs, marquees] = await Promise.all([
      this.prisma.landingPageHero.findMany({ where: { isActive: true } }),
      this.prisma.landingPageStep.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.landingPageService.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.landingPageFaq.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.landingPageMarquee.findMany({ orderBy: { order: 'asc' } }),
    ]);

    return {
      hero: heroes[0] || null,
      steps,
      services,
      faqs,
      marquees,
    };
  }

  // --- Hero ---
  async createHero(data: any, file?: Express.Multer.File) {
    let imageUrl = null;
    if (file) {
      imageUrl = await this.fileUploader.upload(file);
    }
    // If isActive is true, set all others to false
    if (data.isActive) {
      await this.prisma.landingPageHero.updateMany({ data: { isActive: false } });
    }
    return this.prisma.landingPageHero.create({ data: { ...data, imageUrl } });
  }

  async updateHero(id: number, data: any, file?: Express.Multer.File) {
    if (data.isActive) {
      await this.prisma.landingPageHero.updateMany({ data: { isActive: false } });
    }
    let imageUrl = undefined;
    if (file) {
      imageUrl = await this.fileUploader.upload(file);
    }
    return this.prisma.landingPageHero.update({
      where: { id },
      data: { ...data, ...(imageUrl && { imageUrl }) }
    });
  }

  async deleteHero(id: number) {
    await this.prisma.landingPageHero.delete({ where: { id } });
    return { success: true };
  }

  // --- Step ---
  async createStep(data: any, file?: Express.Multer.File) {
    let imageUrl = null;
    if (file) {
      imageUrl = await this.fileUploader.upload(file);
    }
    return this.prisma.landingPageStep.create({ data: { ...data, imageUrl } });
  }

  async updateStep(id: number, data: any, file?: Express.Multer.File) {
    let imageUrl = undefined;
    if (file) {
      imageUrl = await this.fileUploader.upload(file);
    }
    return this.prisma.landingPageStep.update({
      where: { id },
      data: { ...data, ...(imageUrl && { imageUrl }) }
    });
  }

  async deleteStep(id: number) {
    await this.prisma.landingPageStep.delete({ where: { id } });
    return { success: true };
  }

  // --- Service ---
  async createService(data: any, file?: Express.Multer.File) {
    let imageUrl = null;
    if (file) {
      imageUrl = await this.fileUploader.upload(file);
    }
    return this.prisma.landingPageService.create({ data: { ...data, imageUrl } });
  }

  async updateService(id: number, data: any, file?: Express.Multer.File) {
    let imageUrl = undefined;
    if (file) {
      imageUrl = await this.fileUploader.upload(file);
    }
    return this.prisma.landingPageService.update({
      where: { id },
      data: { ...data, ...(imageUrl && { imageUrl }) }
    });
  }

  async deleteService(id: number) {
    await this.prisma.landingPageService.delete({ where: { id } });
    return { success: true };
  }

  // --- FAQ ---
  async createFaq(data: any) {
    return this.prisma.landingPageFaq.create({ data });
  }

  async updateFaq(id: number, data: any) {
    return this.prisma.landingPageFaq.update({
      where: { id },
      data
    });
  }

  async deleteFaq(id: number) {
    await this.prisma.landingPageFaq.delete({ where: { id } });
    return { success: true };
  }

  // --- Marquee ---
  async createMarquee(data: any, file?: Express.Multer.File) {
    let imageUrl = null;
    if (file) {
      imageUrl = await this.fileUploader.upload(file);
    }
    return this.prisma.landingPageMarquee.create({ data: { ...data, imageUrl } });
  }

  async updateMarquee(id: number, data: any, file?: Express.Multer.File) {
    let imageUrl = undefined;
    if (file) {
      imageUrl = await this.fileUploader.upload(file);
    }
    return this.prisma.landingPageMarquee.update({
      where: { id },
      data: { ...data, ...(imageUrl && { imageUrl }) }
    });
  }

  async deleteMarquee(id: number) {
    await this.prisma.landingPageMarquee.delete({ where: { id } });
    return { success: true };
  }
}
