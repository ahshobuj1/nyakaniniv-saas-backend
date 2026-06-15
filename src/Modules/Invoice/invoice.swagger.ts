// src/Modules/Invoice/invoice.swagger.ts

/**
 * @swagger
 * /subscription-invoices/v1/all:
 *   get:
 *     summary: Get all subscription invoices (Admin only)
 *     tags: [SubscriptionInvoice]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all subscription invoices
 */

/**
 * @swagger
 * /subscription-invoices/v1/my-invoices:
 *   get:
 *     summary: Get all subscription invoices for the authenticated DJ
 *     tags: [SubscriptionInvoice]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of subscription invoices for the DJ
 */

/**
 * @swagger
 * /booking-payments/v1/{id}/pay:
 *   post:
 *     summary: Pay a booking payment (Stripe Checkout)
 *     tags: [BookingPayment]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               successUrl:
 *                 type: string
 *               cancelUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment session URL returned
 */

/**
 * @swagger
 * /booking-payments/v1/{id}/mark-paid:
 *   patch:
 *     summary: Mark a booking payment as paid (DJ only, for cash bookings)
 *     tags: [BookingPayment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invoice marked as paid
 */
