// src/Modules/Notification/notification.swagger.ts

/**
 * @swagger
 * /notifications/v1/broadcast:
 *   post:
 *     summary: Broadcast a notification (Admin only)
 *     tags: [Notification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional. If empty, broadcasts to all users.
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [booking_request, payment, system]
 *     responses:
 *       201:
 *         description: Notification broadcasted successfully
 */

/**
 * @swagger
 * /notifications/v1/my-notifications:
 *   get:
 *     summary: Get all notifications for the authenticated user
 *     tags: [Notification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user notifications
 */

/**
 * @swagger
 * /notifications/v1/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notification]
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
 *         description: Notification marked as read
 */
