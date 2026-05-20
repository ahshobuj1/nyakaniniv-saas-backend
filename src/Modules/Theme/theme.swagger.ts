// src/Modules/Theme/theme.swagger.ts

/**
 * @swagger
 * /themes/v1/:
 *   get:
 *     summary: Get All Themes
 *     tags: [Theme]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: A paginated list of themes
 */

/**
 * @swagger
 * /themes/v1/slug/{slug}:
 *   get:
 *     summary: Get Theme by Slug
 *     tags: [Theme]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: The theme slug
 *     responses:
 *       200:
 *         description: Theme retrieved successfully
 *       404:
 *         description: Theme not found
 */

/**
 * @swagger
 * /themes/v1/:
 *   post:
 *     summary: Create Theme (Admin Only)
 *     tags: [Theme]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               previewImageUrl:
 *                 type: string
 *               defaultConfig:
 *                 type: object
 *     responses:
 *       201:
 *         description: Theme created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not an admin)
 *       409:
 *         description: Theme slug already exists
 */

/**
 * @swagger
 * /themes/v1/{id}:
 *   patch:
 *     summary: Update Theme (Admin Only)
 *     tags: [Theme]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Theme ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               previewImageUrl:
 *                 type: string
 *               defaultConfig:
 *                 type: object
 *     responses:
 *       200:
 *         description: Theme updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Theme not found
 */

/**
 * @swagger
 * /themes/v1/{id}:
 *   delete:
 *     summary: Delete Theme (Admin Only)
 *     tags: [Theme]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Theme ID
 *     responses:
 *       200:
 *         description: Theme deleted successfully
 *       404:
 *         description: Theme not found
 *       409:
 *         description: Theme is assigned to one or more tenants
 */
