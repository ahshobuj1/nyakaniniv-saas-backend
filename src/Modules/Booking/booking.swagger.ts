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
 *               clientName:
 *                 type: string
 *               clientEmail:
 *                 type: string
 *               eventType:
 *                 type: string
 *               eventDetails:
 *                 type: string
 *               clientPhone:
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
