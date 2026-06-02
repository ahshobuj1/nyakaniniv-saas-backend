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

/**
 * @swagger
 * /analytics/v1/admin/charts:
 *   get:
 *     summary: Get platform-wide chart data (Admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin charts retrieved successfully
 */

/**
 * @swagger
 * /analytics/v1/tenant/charts:
 *   get:
 *     summary: Get dashboard chart data for a DJ (Tenant)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant charts retrieved successfully
 */
