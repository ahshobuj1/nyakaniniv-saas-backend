/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Webhooks for payment gateways (Stripe, Paystack)
 */

/**
 * @swagger
 * /api/v1/webhooks/paystack:
 *   post:
 *     summary: Paystack Webhook Event Handler
 *     description: Handles incoming events from Paystack (e.g. charge.success) to update invoice and booking statuses.
 *     tags: [Webhooks]
 *     parameters:
 *       - in: header
 *         name: x-paystack-signature
 *         schema:
 *           type: string
 *         required: true
 *         description: HMAC SHA512 signature for verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: The raw event payload from Paystack
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received:
 *                   type: boolean
 *       400:
 *         description: Invalid signature or error processing webhook
 */
