// src/Modules/Tenant/tenant.swagger.ts

/**
 * @swagger
 * /tenant/v1/onboard:
 *   post:
 *     summary: Create Tenant Profile (DJ Onboarding)
 *     tags: [Tenant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subdomain
 *               - stageName
 *               - country
 *               - city
 *             properties:
 *               subdomain:
 *                 type: string
 *                 example: dj-alex
 *               stageName:
 *                 type: string
 *                 example: Alex Vibes
 *               country:
 *                 type: string
 *                 example: USA
 *               city:
 *                 type: string
 *                 example: New York
 *               genres:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["House", "Techno"]
 *     responses:
 *       201:
 *         description: Tenant profile created successfully
 *       400:
 *         description: Bad request (validation error)
 *       409:
 *         description: Subdomain is already taken or user already has a tenant profile
 */

/**
 * @swagger
 * /tenant/v1/:
 *   get:
 *     summary: Get All Tenants (Admin Only)
 *     tags: [Tenant]
 *     security:
 *       - bearerAuth: []
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
 *         description: A paginated list of tenants
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not an admin)
 */

/**
 * @swagger
 * /tenant/v1/{subdomain}:
 *   get:
 *     summary: Get Public Tenant Profile
 *     tags: [Tenant]
 *     parameters:
 *       - in: path
 *         name: subdomain
 *         required: true
 *         schema:
 *           type: string
 *         description: The DJ's subdomain (e.g., dj-alex)
 *     responses:
 *       200:
 *         description: Tenant profile retrieved successfully
 *       404:
 *         description: Tenant not found
 */

/**
 * @swagger
 * /tenant/v1/profile:
 *   put:
 *     summary: Update Tenant Profile
 *     tags: [Tenant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stageName:
 *                 type: string
 *               country:
 *                 type: string
 *               city:
 *                 type: string
 *               genres:
 *                 type: array
 *                 items:
 *                   type: string
 *               bio:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *               timezone:
 *                 type: string
 *               socialLinks:
 *                 type: object
 *                 properties:
 *                   facebook:
 *                     type: string
 *                   instagram:
 *                     type: string
 *                   twitter:
 *                     type: string
 *     responses:
 *       200:
 *         description: Tenant profile updated successfully
 *       400:
 *         description: Bad request (validation error)
 *       404:
 *         description: Tenant not found
 */

/**
 * @swagger
 * /tenant/v1/theme:
 *   put:
 *     summary: Assign Theme to Tenant
 *     tags: [Tenant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - themeId
 *             properties:
 *               themeId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Theme assigned successfully
 *       404:
 *         description: Theme or Tenant not found
 */
