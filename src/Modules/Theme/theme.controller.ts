import { Request, Response } from 'express';
import { ThemeServices } from './theme.service';
import { BaseController } from '@/core/BaseController';

export class ThemeController extends BaseController {
  constructor(private readonly themeService: ThemeServices) {
    super();
  }

  public async createTheme(req: Request, res: Response) {
    const result = await this.themeService.createTheme(req.body);
    return this.sendCreatedResponse(req, res, result, 'Theme created successfully');
  }

  public async getAllThemes(req: Request, res: Response) {
    const result = await this.themeService.getAllThemes(req.query as Record<string, unknown>);
    return this.sendPaginatedResponse(req, res, result.meta, 'Themes retrieved successfully', result.themes);
  }

  public async getThemeBySlug(req: Request, res: Response) {
    const slug = req.params.slug as string;
    const result = await this.themeService.getThemeBySlug(slug);
    return this.sendResponse(req, res, 'Theme retrieved successfully', 200, result);
  }

  public async updateTheme(req: Request, res: Response) {
    const id = Number(req.params.id);
    const result = await this.themeService.updateTheme(id, req.body);
    return this.sendResponse(req, res, 'Theme updated successfully', 200, result);
  }

  public async deleteTheme(req: Request, res: Response) {
    const id = Number(req.params.id);
    const result = await this.themeService.deleteTheme(id);
    return this.sendResponse(req, res, result.message, 200, null);
  }
}
