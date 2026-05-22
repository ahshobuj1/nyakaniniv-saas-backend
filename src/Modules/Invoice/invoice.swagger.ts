// src/Modules/Invoice/invoice.swagger.ts

/**
 * @swagger
 * /invoices/v1/all:
 *   get:
 *     summary: Get all invoices (Admin only)
 *     tags: [Invoice]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all invoices
 */

/**
 * @swagger
 * /invoices/v1/my-invoices:
 *   get:
 *     summary: Get all invoices for the authenticated DJ
 *     tags: [Invoice]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of invoices for the DJ
 */

/**
 * @swagger
 * /invoices/v1/{id}/pay:
 *   post:
 *     summary: Pay an invoice (Stripe Checkout)
 *     tags: [Invoice]
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
 * /invoices/v1/{id}/mark-paid:
 *   patch:
 *     summary: Mark an invoice as paid (DJ only, for cash bookings)
 *     tags: [Invoice]
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
