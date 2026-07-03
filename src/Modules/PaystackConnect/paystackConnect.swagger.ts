/**
 * @swagger
 * tags:
 *   name: Paystack Connect
 *   description: Paystack onboarding and account management for African DJs
 */

/**
 * @swagger
 * /api/v1/paystack-connect/onboard:
 *   post:
 *     summary: Onboard DJ to Paystack
 *     description: Creates a Paystack subaccount for the DJ to receive split payments.
 *     tags: [Paystack Connect]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *               - bankCode
 *               - accountNumber
 *               - businessName
 *             properties:
 *               tenantId:
 *                 type: string
 *                 description: The unique ID of the DJ tenant
 *               bankCode:
 *                 type: string
 *                 description: The Paystack bank code (e.g. "058" for GTBank in Nigeria)
 *               accountNumber:
 *                 type: string
 *                 description: The DJ's local bank account number
 *               businessName:
 *                 type: string
 *                 description: The DJ's stage name or business name
 *     responses:
 *       200:
 *         description: Paystack onboarding initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     subaccountCode:
 *                       type: string
 *                       description: The created Paystack subaccount code
 *       400:
 *         description: Missing required fields or invalid details
 */

/**
 * @swagger
 * /api/v1/paystack-connect/status:
 *   get:
 *     summary: Check Paystack Account Status
 *     description: Checks whether the given tenant has successfully connected a Paystack subaccount.
 *     tags: [Paystack Connect]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         required: true
 *         description: The unique ID of the DJ tenant
 *     responses:
 *       200:
 *         description: Paystack connection status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     isConnected:
 *                       type: boolean
 *                     subaccountCode:
 *                       type: string
 *       400:
 *         description: Missing tenantId
 */
