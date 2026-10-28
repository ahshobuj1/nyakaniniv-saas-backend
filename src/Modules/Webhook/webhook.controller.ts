import { Request, Response, NextFunction } from 'express';
import { WebhookServices } from './webhook.service';

export class WebhookController {
  constructor(private webhookServices: WebhookServices) { }

  paystackWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('🔔 [WEBHOOK] Received Paystack webhook request');
      const signature = req.headers['x-paystack-signature'] as string;
      const rawBody = (req as any).rawBody || req.body;
      
      console.log('🔔 [WEBHOOK] Paystack Request details:', {
        hasSignature: !!signature,
        signaturePreview: signature ? signature.substring(0, 10) + '...' : null,
        hasRawBody: !!(req as any).rawBody,
        isRawBodyBuffer: Buffer.isBuffer((req as any).rawBody),
        hasBody: !!req.body,
        secretExists: !!process.env.PAYSTACK_SECRET_KEY
      });

      const result = await this.webhookServices.handlePaystackWebhook(signature, rawBody);
      console.log('✅ [WEBHOOK] Paystack processed successfully', result);
      res.status(200).json(result);
    } catch (error) {
      console.error('❌ [WEBHOOK] Paystack Controller Error Details:', (error as Error).message);
      res.status(400).send(`Webhook Error: ${(error as Error).message}`);
    }
  };

  pesapalIPN = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('🔔 [IPN] Received Pesapal IPN request');
      const orderTrackingId = ((req.query?.OrderTrackingId || req.body?.OrderTrackingId) as string) || '';
      const orderMerchantReference = ((req.query?.OrderMerchantReference || req.body?.OrderMerchantReference) as string) || '';
      const orderNotificationType = ((req.query?.OrderNotificationType || req.body?.OrderNotificationType) as string) || 'IPNCHANGE';

      console.log('🔔 [IPN] Pesapal IPN details:', {
        orderTrackingId,
        orderMerchantReference,
        orderNotificationType,
      });

      if (!orderTrackingId) {
        return res.status(400).json({ status: 400, message: 'Missing OrderTrackingId' });
      }

      await this.webhookServices.handlePesapalIPN(orderTrackingId, orderMerchantReference);

      // Return Pesapal-compliant acknowledgment
      res.status(200).json({
        orderNotificationType: orderNotificationType || 'IPNCHANGE',
        orderTrackingId,
        orderMerchantReference,
        status: 200,
      });
    } catch (error) {
      console.error('❌ [IPN] Pesapal IPN Error:', (error as Error).message);
      res.status(400).json({ status: 400, message: (error as Error).message });
    }
  };

  flutterwaveWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('🔔 [WEBHOOK] Received Flutterwave webhook request');
      const signature = (req.headers['verif-hash'] as string) || '';
      const rawBody = (req as any).rawBody || req.body;

      const result = await this.webhookServices.handleFlutterwaveWebhook(signature, rawBody, req.headers);
      console.log('✅ [WEBHOOK] Flutterwave processed successfully', result);
      res.status(200).json(result);
    } catch (error) {
      console.error('❌ [WEBHOOK] Flutterwave Controller Error:', (error as Error).message);
      res.status(400).send(`Webhook Error: ${(error as Error).message}`);
    }
  };
}
