import { Router } from 'express';
import messagingController from '../controllers/messagingController';
import { authenticateToken } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply authentication to all messaging routes
router.use(authenticateToken);

/**
 * @swagger
 * components:
 *   schemas:
 *     SMSRequest:
 *       type: object
 *       required:
 *         - to
 *         - message
 *       properties:
 *         to:
 *           oneOf:
 *             - type: string
 *               description: Single phone number
 *             - type: array
 *               items:
 *                 type: string
 *               description: Array of phone numbers
 *         message:
 *           type: string
 *           description: Message content
 *         from:
 *           type: string
 *           description: Sender name (optional)
 *     
 *     EmailRequest:
 *       type: object
 *       required:
 *         - to
 *         - subject
 *       properties:
 *         to:
 *           oneOf:
 *             - type: string
 *             - type: array
 *               items:
 *                 type: string
 *         subject:
 *           type: string
 *         html:
 *           type: string
 *         text:
 *           type: string
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *     
 *     MessageResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 */

/**
 * @swagger
 * /api/messaging/sms/send:
 *   post:
 *     summary: Send SMS message
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SMSRequest'
 *     responses:
 *       200:
 *         description: SMS sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/sms/send', rateLimiter.messaging, messagingController.sendSMS);

/**
 * @swagger
 * /api/messaging/sms/bulk:
 *   post:
 *     summary: Send bulk SMS messages
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipients
 *               - message
 *             properties:
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               message:
 *                 type: string
 *               from:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk SMS processing completed
 */
router.post('/sms/bulk', rateLimiter.messaging, messagingController.sendBulkSMS);

/**
 * @swagger
 * /api/messaging/email/send:
 *   post:
 *     summary: Send email message
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailRequest'
 *     responses:
 *       200:
 *         description: Email sent successfully
 */
router.post('/email/send', rateLimiter.messaging, messagingController.sendEmail);

/**
 * @swagger
 * /api/messaging/welcome:
 *   post:
 *     summary: Send welcome notification (SMS + Email)
 *     tags: [Messaging]
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
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Welcome notification sent successfully
 */
router.post('/welcome', rateLimiter.messaging, messagingController.sendWelcomeNotification);

/**
 * @swagger
 * /api/messaging/verification:
 *   post:
 *     summary: Send verification code
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contact
 *             properties:
 *               contact:
 *                 type: string
 *                 description: Phone number or email address
 *               method:
 *                 type: string
 *                 enum: [sms, email]
 *                 default: sms
 *     responses:
 *       200:
 *         description: Verification code sent successfully
 */
router.post('/verification', rateLimiter.messaging, messagingController.sendVerificationCode);

/**
 * @swagger
 * /api/messaging/event/notify:
 *   post:
 *     summary: Send event notifications
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventData
 *               - recipients
 *               - notificationType
 *             properties:
 *               eventData:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date-time
 *                   location:
 *                     type: string
 *                   organizerName:
 *                     type: string
 *                   rsvpLink:
 *                     type: string
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *               notificationType:
 *                 type: string
 *                 enum: [invitation, reminder_24h, reminder_1h, cancellation]
 *     responses:
 *       200:
 *         description: Event notifications sent successfully
 */
router.post('/event/notify', rateLimiter.messaging, messagingController.sendEventNotification);

/**
 * @swagger
 * /api/messaging/payment/confirmation:
 *   post:
 *     summary: Send payment confirmation
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contact
 *               - paymentData
 *             properties:
 *               contact:
 *                 type: object
 *                 properties:
 *                   phone:
 *                     type: string
 *                   email:
 *                     type: string
 *               paymentData:
 *                 type: object
 *                 required:
 *                   - amount
 *                 properties:
 *                   amount:
 *                     type: number
 *                   currency:
 *                     type: string
 *                   eventTitle:
 *                     type: string
 *                   transactionId:
 *                     type: string
 *     responses:
 *       200:
 *         description: Payment confirmation sent successfully
 */
router.post('/payment/confirmation', rateLimiter.messaging, messagingController.sendPaymentConfirmation);

/**
 * @swagger
 * /api/messaging/template/send:
 *   post:
 *     summary: Send message using templates
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateType
 *               - templateData
 *               - recipient
 *             properties:
 *               templateType:
 *                 type: string
 *                 enum: [welcome, verification, event_invitation, payment_confirmation, custom]
 *               templateData:
 *                 type: object
 *                 description: Data to populate template
 *               recipient:
 *                 type: string
 *                 description: Phone number or email
 *               method:
 *                 type: string
 *                 enum: [sms, email]
 *                 default: sms
 *     responses:
 *       200:
 *         description: Template message sent successfully
 */
router.post('/template/send', rateLimiter.messaging, messagingController.sendTemplateMessage);

/**
 * @swagger
 * /api/messaging/status/{messageId}:
 *   get:
 *     summary: Get message delivery status
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message status retrieved successfully
 *       404:
 *         description: Message not found
 */
router.get('/status/:messageId', messagingController.getMessageStatus);

/**
 * @swagger
 * /api/messaging/validate/phone:
 *   post:
 *     summary: Validate phone number format
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Phone validation result
 */
router.post('/validate/phone', messagingController.validatePhone);

/**
 * @swagger
 * /api/messaging/templates:
 *   get:
 *     summary: Get available message templates
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available templates retrieved successfully
 */
router.get('/templates', messagingController.getTemplates);

/**
 * @swagger
 * /api/messaging/health:
 *   get:
 *     summary: Health check for messaging services
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All services operational
 *       503:
 *         description: Some services experiencing issues
 */
router.get('/health', messagingController.healthCheck);

/**
 * @swagger
 * /api/messaging/wedding-invitation:
 *   post:
 *     summary: Send wedding invitation via WhatsApp
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - data
 *             properties:
 *               to:
 *                 type: string
 *               data:
 *                 type: object
 *                 required:
 *                   - guestName
 *                   - parentsName
 *                   - groomName
 *                   - brideName
 *                   - location
 *                   - date
 *                   - startTime
 *                   - endTime
 *                 properties:
 *                   guestName:
 *                     type: string
 *                   parentsName:
 *                     type: string
 *                   groomName:
 *                     type: string
 *                   brideName:
 *                     type: string
 *                   location:
 *                     type: string
 *                   date:
 *                     type: string
 *                   startTime:
 *                     type: string
 *                   endTime:
 *                     type: string
 *                   imageUrl:
 *                     type: string
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 */
router.post('/wedding-invitation', rateLimiter.messaging, messagingController.sendWeddingInvitation);

/**
 * @swagger
 * /api/messaging/whatsapp/direct:
 *   post:
 *     summary: Send WhatsApp message directly
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - message
 *             properties:
 *               to:
 *                 type: string
 *               message:
 *                 type: string
 *               mediaUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: WhatsApp message sent successfully
 */
router.post('/whatsapp/direct', rateLimiter.messaging, messagingController.sendWhatsAppDirect);

export default router;
