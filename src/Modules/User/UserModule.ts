import { BaseModule } from '@/core/BaseModule';
import { AppLogger } from '@/core/logging/logger';
import { UserServices } from './user.service';
import { UserController } from './user.controller';
import { validateRequest } from '@/middleware/validation';
import { authenticateUser, authorizeRole } from '@/middleware/auth';
import { UpdateProfileDTOSchema, UpdateUserRoleDTOSchema, UpdateUserStatusDTOSchema } from './UserDTO';
import { UserRole } from '@/prisma/generated/client';

export class UserModule extends BaseModule {
  public name: string = 'UserModule';
  public version: string = '1.0.0';
  public basePath: string = '/users/v1';
  public dependencies?: string[] | undefined;

  private logger = new AppLogger('UserModule');

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService('prisma');
    this.registerService('UserService', new UserServices(prisma));
  }

  protected async setupControllers(): Promise<void> {
    const userService = this.getService<UserServices>('UserService');
    this.registerController('UserController', new UserController(userService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<UserController>('UserController');

    // Current user profile routes
    this.router.get('/me', authenticateUser, controller.getMe.bind(controller));
    this.router.patch('/me', authenticateUser, validateRequest(UpdateProfileDTOSchema), controller.updateMe.bind(controller));

    // Admin routes
    this.router.get('/', authenticateUser, authorizeRole([UserRole.SUPER_ADMIN]), controller.getAllUsers.bind(controller));
    this.router.patch('/:id/status', authenticateUser, authorizeRole([UserRole.SUPER_ADMIN]), validateRequest(UpdateUserStatusDTOSchema), controller.updateUserStatus.bind(controller));
    this.router.patch('/:id/role', authenticateUser, authorizeRole([UserRole.SUPER_ADMIN]), validateRequest(UpdateUserRoleDTOSchema), controller.updateUserRole.bind(controller));
    this.router.delete('/:id', authenticateUser, authorizeRole([UserRole.SUPER_ADMIN]), controller.deleteUser.bind(controller));
  }
}
