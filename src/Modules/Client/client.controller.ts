import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { ClientServices } from './client.service';

export class ClientController extends BaseController {
  constructor(private clientService: ClientServices) {
    super();
  }

  /**
   * @swagger
   * /clients/v1:
   *   get:
   *     summary: Get my clients (Mini-CRM)
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of clients retrieved successfully
   */
  public async getMyClients(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { clients, meta } = await this.clientService.getMyClients(userId, req.query);
    this.sendPaginatedResponse(req, res, meta, 'Clients retrieved successfully', clients);
  }

  /**
   * @swagger
   * /clients/v1/{id}:
   *   get:
   *     summary: Get a specific client by ID
   *     tags: [Clients]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Client ID
   *     responses:
   *       200:
   *         description: Client details retrieved successfully
   *       404:
   *         description: Client not found
   */
  public async getClientById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const client = await this.clientService.getClientById(userId, id);
    this.sendResponse(req, res, 'Client retrieved successfully', undefined, client);
  }
}
