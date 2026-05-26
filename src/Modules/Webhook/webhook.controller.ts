import { Request, Response, NextFunction } from 'express';
import { WebhookServices } from './webhook.service';

export class WebhookController {
  constructor(private webhookServices: WebhookServices) { }

  stripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      // Need raw body for stripe webhook
      const rawBody = (req as any).rawBody || req.body;

      // console.log('Webhook Debug:', {
      //   hasRawBody: !!(req as any).rawBody,
      //   isBuffer: Buffer.isBuffer(rawBody),
      //   bodyType: typeof rawBody,
      //   secretExists: !!process.env.STRIPE_WEBHOOK_SECRET
      // });

      const result = await this.webhookServices.handleStripeWebhook(signature, rawBody);
      res.status(200).json(result);
    } catch (error) {
      console.error('Webhook Error Details:', (error as Error).message);
      // Return 400 for stripe webhook errors
      res.status(400).send(`Webhook Error: ${(error as Error).message}`);
    }
  };
}
