// src/Modules/LandingPage/landingPage.swagger.ts

/**
 * @swagger
 * /landing-page/v1/content:
 *   get:
 *     summary: Get all landing page content (Public)
 *     tags: [Landing Page]
 *     responses:
 *       200:
 *         description: Landing page content
 */

/**
 * @swagger
 * /landing-page/v1/hero:
 *   post:
 *     summary: Create Hero section (Admin)
 *     tags: [Landing Page]
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
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Hero created
 */

/**
 * @swagger
 * /landing-page/v1/step:
 *   post:
 *     summary: Create a Step (Admin)
 *     tags: [Landing Page]
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
 *               description:
 *                 type: string
 *               order:
 *                 type: number
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Step created
 */

// We could add Swagger documentation for all other endpoints (service, faq, marquee, patch/delete)
// but they follow the exact same pattern.
