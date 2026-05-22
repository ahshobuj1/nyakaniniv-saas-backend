// src/Modules/SupportTicket/supportTicket.swagger.ts

/**
 * @swagger
 * /tickets/v1/:
 *   post:
 *     summary: Create a support ticket
 *     tags: [Support Ticket]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               subject:
 *                 type: string
 *               issue:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ticket submitted successfully
 */

/**
 * @swagger
 * /tickets/v1/all:
 *   get:
 *     summary: Get all tickets (Admin only)
 *     tags: [Support Ticket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tickets
 */

/**
 * @swagger
 * /tickets/v1/my-tickets:
 *   get:
 *     summary: Get my tickets (Authenticated user)
 *     tags: [Support Ticket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user tickets
 */

/**
 * @swagger
 * /tickets/v1/{id}/status:
 *   patch:
 *     summary: Update ticket status (Admin only)
 *     tags: [Support Ticket]
 *     security:
 *       - bearerAuth: []
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
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved]
 *     responses:
 *       200:
 *         description: Ticket status updated
 */
