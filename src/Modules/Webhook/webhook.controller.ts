import { Request, Response, NextFunction } from 'express';
import { WebhookServices } from './webhook.service';

export class WebhookController {
  constructor(private webhookServices: WebhookServices) { }

  stripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('🔔 [WEBHOOK] Received Stripe webhook request');
      const signature = req.headers['stripe-signature'] as string;
      
      // Need raw body for stripe webhook
      const rawBody = (req as any).rawBody || req.body;
      
      console.log('🔔 [WEBHOOK] Request details:', {
        hasSignature: !!signature,
        signaturePreview: signature ? signature.substring(0, 10) + '...' : null,
        hasRawBody: !!(req as any).rawBody,
        isRawBodyBuffer: Buffer.isBuffer((req as any).rawBody),
        hasBody: !!req.body,
        bodyType: typeof req.body,
        secretExists: !!process.env.STRIPE_WEBHOOK_SECRET
      });

      const result = await this.webhookServices.handleStripeWebhook(signature, rawBody);
      console.log('✅ [WEBHOOK] Processed successfully', result);
      res.status(200).json(result);
    } catch (error) {
      console.error('❌ [WEBHOOK] Controller Error Details:', (error as Error).message);
      // Return 400 for stripe webhook errors
      res.status(400).send(`Webhook Error: ${(error as Error).message}`);
    }
  };

  paystackWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('🔔 [WEBHOOK] Received Paystack webhook request');
      const signature = req.headers['x-paystack-signature'] as string;
      const rawBody = (req as any).rawBody || req.body;
      
      const result = await this.webhookServices.handlePaystackWebhook(signature, rawBody);
      console.log('✅ [WEBHOOK] Paystack processed successfully', result);
      res.status(200).json(result);
    } catch (error) {
      console.error('❌ [WEBHOOK] Paystack Controller Error Details:', (error as Error).message);
      res.status(400).send(`Webhook Error: ${(error as Error).message}`);
    }
  };
}
