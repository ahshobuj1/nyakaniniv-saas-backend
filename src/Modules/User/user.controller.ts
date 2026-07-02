import { Request, Response, NextFunction } from 'express';
import { UserServices } from './user.service';
import { BaseController } from '@/core/BaseController';
import { IFileUploader } from '@/utils/IFileUploader';

export class UserController extends BaseController {
  constructor(
    private userServices: UserServices,
    private readonly fileUploader?: IFileUploader
  ) {
    super();
  }

  getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;

      const result = await this.userServices.getAllUsers(page, limit, search);
      return this.sendPaginatedResponse(req, res, result.meta, 'Users retrieved successfully', result.data);
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;
      const user = await this.userServices.getUserProfile(userId);
      return this.sendResponse(req, res, 'Profile retrieved successfully', 200, user);
    } catch (error) {
      next(error);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;

      if (req.file && this.fileUploader) {
        const url = await this.fileUploader.upload(req.file);
        req.body.profileImg = url;
      }

      const updatedUser = await this.userServices.updateProfile(userId, req.body);
      return this.sendResponse(req, res, 'Profile updated successfully', 200, updatedUser);
    } catch (error) {
      next(error);
    }
  };

  updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.id as string;
      const result = await this.userServices.updateUserStatus(userId, req.body);
      return this.sendResponse(req, res, 'User status updated successfully', 200, result);
    } catch (error) {
      next(error);
    }
  };

  updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.id as string;
      const result = await this.userServices.updateUserRole(userId, req.body);
      return this.sendResponse(req, res, 'User role updated successfully', 200, result);
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.id as string;
      const result = await this.userServices.deleteUser(userId);
      return this.sendResponse(req, res, 'User deleted successfully', 200, result);
    } catch (error) {
      next(error);
    }
  };
}
