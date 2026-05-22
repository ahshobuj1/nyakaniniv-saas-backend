// src/Modules/MixTape/mixtape.swagger.ts

/**
 * @swagger
 * /mixtapes/v1/tenant/{tenantId}:
 *   get:
 *     summary: Get all MixTapes for a specific tenant
 *     tags: [MixTape]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of MixTapes
 */

/**
 * @swagger
 * /mixtapes/v1/:
 *   post:
 *     summary: Create a MixTape (DJ Only)
 *     tags: [MixTape]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               audioUrl:
 *                 type: string
 *               order:
 *                 type: number
 *               coverImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: MixTape created successfully
 */

/**
 * @swagger
 * /mixtapes/v1/{id}:
 *   patch:
 *     summary: Update a MixTape (DJ Only)
 *     tags: [MixTape]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               audioUrl:
 *                 type: string
 *               order:
 *                 type: number
 *               coverImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: MixTape updated successfully
 *   delete:
 *     summary: Delete a MixTape (DJ Only)
 *     tags: [MixTape]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: MixTape deleted successfully
 */

/**
 * @swagger
 * /mixtapes/v1/reorder:
 *   post:
 *     summary: Reorder MixTapes (DJ Only)
 *     tags: [MixTape]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     order:
 *                       type: number
 *     responses:
 *       200:
 *         description: MixTapes reordered successfully
 */
