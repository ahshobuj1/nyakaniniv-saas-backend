// src/Modules/Subscription/subscription.swagger.ts

/**
 * @swagger
 * /subscriptions/v1/plans:
 *   get:
 *     summary: Get all subscription plans
 *     tags: [Subscription]
 *     responses:
 *       200:
 *         description: Successful response
 *   post:
 *     summary: Create a subscription plan
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               priceMonthly:
 *                 type: number
 *               priceAnnually:
 *                 type: number
 *               stripeMonthlyPriceId:
 *                 type: string
 *               stripeAnnualPriceId:
 *                 type: string
 *               discountPercentage:
 *                 type: number
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - CUSTOM_SUBDOMAIN
 *                   - ONLINE_PAYMENTS
 *     responses:
 *       201:
 *         description: Plan created
 */

/**
 * @swagger
 * /subscriptions/v1/plans/{id}:
 *   patch:
 *     summary: Update a subscription plan
 *     tags: [Subscription]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               priceMonthly:
 *                 type: number
 *               priceAnnually:
 *                 type: number
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - CUSTOM_SUBDOMAIN
 *                   - ONLINE_PAYMENTS
 *     responses:
 *       200:
 *         description: Plan updated
 *   delete:
 *     summary: Delete a subscription plan
 *     tags: [Subscription]
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
 *         description: Plan deleted
 */

/**
 * @swagger
 * /subscriptions/v1/subscribe:
 *   post:
 *     summary: Subscribe to a plan
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planId:
 *                 type: number
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, annually]
 *               successUrl:
 *                 type: string
 *               cancelUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription initiated
 */

/**
 * @swagger
 * /subscriptions/v1/cancel:
 *   post:
 *     summary: Cancel subscription
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription canceled
 */

