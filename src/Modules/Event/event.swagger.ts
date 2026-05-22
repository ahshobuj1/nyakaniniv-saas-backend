// src/Modules/Event/event.swagger.ts

/**
 * @swagger
 * /events/v1/tenant/{tenantId}:
 *   get:
 *     summary: Get All Events for a Tenant
 *     tags: [Event]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
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
 *         description: A paginated list of events
 */

/**
 * @swagger
 * /events/v1/{id}:
 *   get:
 *     summary: Get Event by ID
 *     tags: [Event]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event retrieved successfully
 *       404:
 *         description: Event not found
 */

/**
 * @swagger
 * /events/v1/:
 *   post:
 *     summary: Create Event (DJ Only)
 *     tags: [Event]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - eventDate
 *               - venueName
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               eventDate:
 *                 type: string
 *                 format: date-time
 *               venueName:
 *                 type: string
 *               venueAddress:
 *                 type: string
 *               capacity:
 *                 type: integer
 *               price:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [upcoming, completed, canceled]
 *                 default: upcoming
 *     responses:
 *       201:
 *         description: Event created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not a DJ)
 *       404:
 *         description: Tenant profile not found
 */

/**
 * @swagger
 * /events/v1/{id}:
 *   patch:
 *     summary: Update Event (DJ Only)
 *     tags: [Event]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               eventDate:
 *                 type: string
 *                 format: date-time
 *               venueName:
 *                 type: string
 *               venueAddress:
 *                 type: string
 *               capacity:
 *                 type: integer
 *               price:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [upcoming, completed, canceled]
 *     responses:
 *       200:
 *         description: Event updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Event or tenant not found
 *       409:
 *         description: Not authorized to update this event
 */

/**
 * @swagger
 * /events/v1/{id}:
 *   delete:
 *     summary: Delete Event (DJ Only)
 *     tags: [Event]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       404:
 *         description: Event or tenant not found
 *       409:
 *         description: Not authorized to delete this event
 */
