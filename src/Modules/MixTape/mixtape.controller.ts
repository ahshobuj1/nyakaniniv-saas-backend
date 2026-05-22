import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { MixTapeServices } from './mixtape.service';
import { IFileUploader } from '@/utils/IFileUploader';

export class MixTapeController extends BaseController {
  constructor(
    private mixTapeService: MixTapeServices,
    private readonly fileUploader: IFileUploader
  ) {
    super();
  }

  public async createMixTape(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    console.log('file', req.file)

    if (req.file) {
      const url = await this.fileUploader.upload(req.file);
      req.body.coverUrl = url;
    }

    const mixTape = await this.mixTapeService.createMixTape(userId, req.body);
    this.sendCreatedResponse(req, res, mixTape, 'MixTape created successfully');
  }

  public async getTenantMixTapes(req: Request, res: Response): Promise<void> {
    const tenantId = String(req.params.tenantId);
    const mixTapes = await this.mixTapeService.getTenantMixTapes(tenantId);
    this.sendResponse(req, res, 'MixTapes retrieved successfully', undefined, mixTapes);
  }

  public async updateMixTape(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const coverFile = req.file;
    const mixTape = await this.mixTapeService.updateMixTape(userId, id, req.body, coverFile);
    this.sendResponse(req, res, 'MixTape updated successfully', undefined, mixTape);
  }

  public async deleteMixTape(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    await this.mixTapeService.deleteMixTape(userId, id);
    this.sendResponse(req, res, 'MixTape deleted successfully', undefined, null);
  }

  public async reorderMixTapes(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await this.mixTapeService.reorderMixTapes(userId, req.body);
    this.sendResponse(req, res, 'MixTapes reordered successfully', undefined, result);
  }
}
