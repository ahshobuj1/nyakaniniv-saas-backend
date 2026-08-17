import { PrismaClient } from '@/prisma/generated/client';
import { IFileUploader } from '@/utils/IFileUploader';

export class LandingPageServices {
  constructor(private prisma: PrismaClient, private fileUploader: IFileUploader) {}

  async getLandingPageContent() {
    const [heroes, steps, services, faqs, socials] = await Promise.all([
      this.prisma.landingPageHero.findMany({ where: { isActive: true } }),
      this.prisma.landingPageStep.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.landingPageService.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.landingPageFaq.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.landingPageSocial.findMany({ orderBy: { order: 'asc' } }),
    ]);

    return {
      hero: heroes[0] || null,
      steps,
      services,
      faqs,
      socials,
    };
  }

  // --- Hero ---
  async createHero(data: any, files?: { [fieldname: string]: Express.Multer.File[] }) {
    let imageUrl1 = data.defaultImageUrl1 || null;
    let imageUrl2 = data.defaultImageUrl2 || null;
    let imageUrl3 = data.defaultImageUrl3 || null;

    if (files) {
      if (files['image1'] && files['image1'][0]) imageUrl1 = await this.fileUploader.upload(files['image1'][0]);
      if (files['image2'] && files['image2'][0]) imageUrl2 = await this.fileUploader.upload(files['image2'][0]);
      if (files['image3'] && files['image3'][0]) imageUrl3 = await this.fileUploader.upload(files['image3'][0]);
    }
    
    // If isActive is true, set all others to false
    if (data.isActive) {
      await this.prisma.landingPageHero.updateMany({ data: { isActive: false } });
    }
    return this.prisma.landingPageHero.create({ data: { title: data.title, description: data.description, isActive: data.isActive === 'true' || data.isActive === true, imageUrl1, imageUrl2, imageUrl3 } });
  }

  async updateHero(id: number, data: any, files?: { [fieldname: string]: Express.Multer.File[] }) {
    if (data.isActive) {
      await this.prisma.landingPageHero.updateMany({ data: { isActive: false } });
    }
    
    const updateData: any = { title: data.title, description: data.description };
    if (data.isActive !== undefined) updateData.isActive = data.isActive === 'true' || data.isActive === true;
    
    if (data.defaultImageUrl1) updateData.imageUrl1 = data.defaultImageUrl1;
    if (data.defaultImageUrl2) updateData.imageUrl2 = data.defaultImageUrl2;
    if (data.defaultImageUrl3) updateData.imageUrl3 = data.defaultImageUrl3;

    if (files) {
      if (files['image1'] && files['image1'][0]) updateData.imageUrl1 = await this.fileUploader.upload(files['image1'][0]);
      if (files['image2'] && files['image2'][0]) updateData.imageUrl2 = await this.fileUploader.upload(files['image2'][0]);
      if (files['image3'] && files['image3'][0]) updateData.imageUrl3 = await this.fileUploader.upload(files['image3'][0]);
    }

    return this.prisma.landingPageHero.update({
      where: { id },
      data: updateData
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
    const createData = { ...data, imageUrl };
    if (createData.order !== undefined) createData.order = typeof createData.order === 'string' ? parseInt(createData.order, 10) : createData.order;
    return this.prisma.landingPageStep.create({ data: createData });
  }

  async updateStep(id: number, data: any, file?: Express.Multer.File) {
    let imageUrl = undefined;
    if (data.defaultImageUrl !== undefined) imageUrl = data.defaultImageUrl === 'null' ? null : data.defaultImageUrl;
    if (file) {
      imageUrl = await this.fileUploader.upload(file);
    }
    
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.order !== undefined) updateData.order = typeof data.order === 'string' ? parseInt(data.order) : data.order;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    
    return this.prisma.landingPageStep.update({
      where: { id },
      data: updateData
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
    const createData = { ...data, imageUrl };
    if (createData.order !== undefined) createData.order = typeof createData.order === 'string' ? parseInt(createData.order, 10) : createData.order;
    return this.prisma.landingPageService.create({ data: createData });
  }

  async updateService(id: number, data: any, file?: Express.Multer.File) {
    let imageUrl = undefined;
    if (data.defaultImageUrl !== undefined) imageUrl = data.defaultImageUrl === 'null' ? null : data.defaultImageUrl;
    if (file) {
      imageUrl = await this.fileUploader.upload(file);
    }
    
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.order !== undefined) updateData.order = typeof data.order === 'string' ? parseInt(data.order) : data.order;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    
    return this.prisma.landingPageService.update({
      where: { id },
      data: updateData
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

  // --- Social ---
  async createSocial(data: any) {
    const createData = { ...data };
    if (createData.order !== undefined) createData.order = typeof createData.order === 'string' ? parseInt(createData.order, 10) : createData.order;
    if (createData.isActive !== undefined) createData.isActive = createData.isActive === 'true' || createData.isActive === true;
    return this.prisma.landingPageSocial.create({ data: createData });
  }

  async updateSocial(id: number, data: any) {
    const updateData: any = {};
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.isActive !== undefined) updateData.isActive = data.isActive === 'true' || data.isActive === true;
    if (data.order !== undefined) updateData.order = typeof data.order === 'string' ? parseInt(data.order) : data.order;
    
    return this.prisma.landingPageSocial.update({
      where: { id },
      data: updateData
    });
  }

  async deleteSocial(id: number) {
    await this.prisma.landingPageSocial.delete({ where: { id } });
    return { success: true };
  }
}
