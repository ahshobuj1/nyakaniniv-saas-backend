// src/Modules/Booking/booking.swagger.ts

/**
 * @swagger
 * /bookings/v1/:
 *   post:
 *     summary: Create a booking request (Public)
 *     tags: [Booking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *               clientId:
 *                 type: string
 *                 format: uuid
 *               eventType:
 *                 type: string
 *               eventDetails:
 *                 type: string
 *               eventDate:
 *                 type: string
 *                 format: date-time
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Booking request submitted successfully
 */

/**
 * @swagger
 * /bookings/v1/my-bookings:
 *   get:
 *     summary: Get all bookings for the authenticated DJ
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bookings
 */

/**
 * @swagger
 * /bookings/v1/{id}:
 *   get:
 *     summary: Get a specific booking by ID
 *     tags: [Booking]
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
 *         description: Booking details retrieved successfully
 *       404:
 *         description: Booking not found
 */

/**
 * @swagger
 * /bookings/v1/{id}/status:
 *   patch:
 *     summary: Accept, reject, or complete a booking
 *     tags: [Booking]
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
 *                 enum: [pending, accepted, completed]
 *               totalAmount:
 *                 type: number
 *                 description: Required when status is accepted
 *     responses:
 *       200:
 *         description: Booking status updated successfully
 */

/**
 * @swagger
 * /bookings/v1/{id}/payment-link:
 *   get:
 *     summary: Generate a fresh Stripe Checkout Session for an accepted booking
 *     tags: [Booking]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Successfully generated checkout URL
 *       400:
 *         description: Booking not ready for payment or already paid
 */

/**
 * @swagger
 * /bookings/v1/{id}/remind-payment:
 *   post:
 *     summary: Send a manual payment reminder email to the client
 *     tags: [Booking]
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
 *         description: Payment reminder sent successfully
 *       400:
 *         description: Booking is not in a state waiting for payment
 */

/**
 * @swagger
 * /bookings/v1/{id}/request-cash:
 *   patch:
 *     summary: Request to pay a booking with Cash (Public)
 *     tags: [Booking]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cash payment requested successfully
 *       400:
 *         description: Booking is not ready for payment or already paid
 */
