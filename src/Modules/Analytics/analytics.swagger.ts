/**
 * @swagger
 * /analytics/v1/admin:
 *   get:
 *     summary: Get platform-wide analytics (Admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin analytics retrieved successfully
 */

/**
 * @swagger
 * /analytics/v1/tenant:
 *   get:
 *     summary: Get dashboard analytics for a DJ (Tenant)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant analytics retrieved successfully
 */
