import { BaseModule } from '@/core/BaseModule';
import { AppLogger } from '@/core/logging/logger';
import { WebhookServices } from './webhook.service';
import { WebhookController } from './webhook.controller';
import express from 'express';

export class WebhookModule extends BaseModule {
  public name: string = 'WebhookModule';
  public version: string = '1.0.0';
  public basePath: string = '/webhooks/v1';
  public dependencies?: string[] | undefined;

  private logger = new AppLogger('WebhookModule');

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const emailProvider = this.context.getService("email");
    this.registerService("WebhookService", new WebhookServices(prisma, emailProvider));
  }

  protected async setupControllers(): Promise<void> {
    const webhookService = this.getService<WebhookServices>('WebhookService');
    this.registerController('WebhookController', new WebhookController(webhookService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<WebhookController>('WebhookController');

    this.router.post('/stripe', express.raw({ type: 'application/json' }), controller.stripeWebhook.bind(controller));
    this.router.post('/paystack', express.raw({ type: 'application/json' }), controller.paystackWebhook.bind(controller));
  }
}
