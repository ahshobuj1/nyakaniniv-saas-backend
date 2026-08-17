import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { LandingPageServices } from './landingPage.service';

export class LandingPageController extends BaseController {
  constructor(private landingPageService: LandingPageServices) {
    super();
  }

  public async getLandingPageContent(req: Request, res: Response): Promise<void> {
    const content = await this.landingPageService.getLandingPageContent();
    this.sendResponse(req, res, 'Landing page content retrieved successfully', undefined, content);
  }

  // --- Hero ---
  public async createHero(req: Request, res: Response): Promise<void> {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const hero = await this.landingPageService.createHero(req.body, files);
    this.sendCreatedResponse(req, res, hero, 'Hero created successfully');
  }

  public async updateHero(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const hero = await this.landingPageService.updateHero(Number(id), req.body, files);
    this.sendResponse(req, res, 'Hero updated successfully', undefined, hero);
  }

  public async deleteHero(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await this.landingPageService.deleteHero(Number(id));
    this.sendResponse(req, res, 'Hero deleted successfully', undefined, null);
  }

  // --- Step ---
  public async createStep(req: Request, res: Response): Promise<void> {
    const file = req.file;
    const step = await this.landingPageService.createStep(req.body, file);
    this.sendCreatedResponse(req, res, step, 'Step created successfully');
  }

  public async updateStep(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const file = req.file;
    const step = await this.landingPageService.updateStep(Number(id), req.body, file);
    this.sendResponse(req, res, 'Step updated successfully', undefined, step);
  }

  public async deleteStep(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await this.landingPageService.deleteStep(Number(id));
    this.sendResponse(req, res, 'Step deleted successfully', undefined, null);
  }

  // --- Service ---
  public async createService(req: Request, res: Response): Promise<void> {
    const file = req.file;
    const service = await this.landingPageService.createService(req.body, file);
    this.sendCreatedResponse(req, res, service, 'Service created successfully');
  }

  public async updateService(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const file = req.file;
    const service = await this.landingPageService.updateService(Number(id), req.body, file);
    this.sendResponse(req, res, 'Service updated successfully', undefined, service);
  }

  public async deleteService(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await this.landingPageService.deleteService(Number(id));
    this.sendResponse(req, res, 'Service deleted successfully', undefined, null);
  }

  // --- FAQ ---
  public async createFaq(req: Request, res: Response): Promise<void> {
    const faq = await this.landingPageService.createFaq(req.body);
    this.sendCreatedResponse(req, res, faq, 'FAQ created successfully');
  }

  public async updateFaq(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const faq = await this.landingPageService.updateFaq(Number(id), req.body);
    this.sendResponse(req, res, 'FAQ updated successfully', undefined, faq);
  }

  public async deleteFaq(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await this.landingPageService.deleteFaq(Number(id));
    this.sendResponse(req, res, 'FAQ deleted successfully', undefined, null);
  }

  // --- Social ---
  public async createSocial(req: Request, res: Response): Promise<void> {
    const social = await this.landingPageService.createSocial(req.body);
    this.sendCreatedResponse(req, res, social, 'Social link created successfully');
  }

  public async updateSocial(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const social = await this.landingPageService.updateSocial(Number(id), req.body);
    this.sendResponse(req, res, 'Social link updated successfully', undefined, social);
  }

  public async deleteSocial(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    await this.landingPageService.deleteSocial(Number(id));
    this.sendResponse(req, res, 'Social link deleted successfully', undefined, null);
  }
}
