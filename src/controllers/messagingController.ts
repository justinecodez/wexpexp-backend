import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import communicationService from '../services/communicationService';
import { getDefaultSMSService } from '../services/smsService';
import MessageTemplates from '../utils/messageTemplates';
import logger from '../config/logger';
import { AuthenticatedRequest } from '../types';

export class MessagingController {

  /**
   * Send single SMS message
   * POST /api/messaging/sms/send
   */
  async sendSMS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { to, message, from } = req.body;

      if (!to || !message) {
        throw new AppError('Phone number and message are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const results = await communicationService.sendSMS({
        to: Array.isArray(to) ? to : [to],
        message
      });

      res.status(200).json({
        success: true,
        message: 'SMS sent successfully',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send bulk SMS messages
   * POST /api/messaging/sms/bulk
   */
  async sendBulkSMS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { recipients, message, from } = req.body;

      if (!recipients || !Array.isArray(recipients) || !message) {
        throw new AppError('Recipients array and message are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const smsService = getDefaultSMSService();
      const messages = recipients.map(phone => ({
        to: [phone],
        text: message,
        from
      }));

      const results = await smsService.sendBulkSMS(messages);

      res.status(200).json({
        success: true,
        message: 'Bulk SMS processing completed',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send email
   * POST /api/messaging/email/send
   */
  async sendEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { to, subject, html, text, attachments } = req.body;

      if (!to || !subject || (!html && !text)) {
        throw new AppError('Recipient, subject, and content (html or text) are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const results = await communicationService.sendEmail({
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        attachments
      });

      res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send welcome notification (SMS + Email)
   * POST /api/messaging/welcome
   */
  async sendWelcomeNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, phone } = req.body;

      if (!name || (!email && !phone)) {
        throw new AppError('Name and at least one contact method (email or phone) are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const results = await communicationService.sendWelcomeNotification({
        name,
        email,
        phone
      });

      res.status(200).json({
        success: true,
        message: 'Welcome notification sent successfully',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send verification code
   * POST /api/messaging/verification
   */
  async sendVerificationCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contact, method = 'sms' } = req.body;

      if (!contact) {
        throw new AppError('Contact (phone or email) is required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      // Generate verification code
      const code = MessageTemplates.Utils.generateVerificationCode(6);

      const results = await communicationService.sendVerificationCode(contact, code, method);

      res.status(200).json({
        success: true,
        message: 'Verification code sent successfully',
        data: {
          results,
          // In production, don't return the actual code for security
          ...(process.env.NODE_ENV === 'development' && { code })
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send event notifications
   * POST /api/messaging/event/notify
   */
  async sendEventNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventData, recipients, notificationType } = req.body;

      if (!eventData || !recipients || !notificationType) {
        throw new AppError('Event data, recipients, and notification type are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      if (!Array.isArray(recipients)) {
        throw new AppError('Recipients must be an array', 400, 'INVALID_RECIPIENTS_FORMAT');
      }

      const validTypes = ['invitation', 'reminder_24h', 'reminder_1h', 'cancellation'];
      if (!validTypes.includes(notificationType)) {
        throw new AppError(`Invalid notification type. Must be one of: ${validTypes.join(', ')}`, 400, 'INVALID_NOTIFICATION_TYPE');
      }

      // Convert date string to Date object if needed
      if (typeof eventData.date === 'string') {
        eventData.date = new Date(eventData.date);
      }

      const results = await communicationService.sendEventNotification(
        eventData,
        recipients,
        notificationType,
        req.body.channel // Pass channel from request
      );

      res.status(200).json({
        success: true,
        message: 'Event notifications sent successfully',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send payment confirmation
   * POST /api/messaging/payment/confirmation
   */
  async sendPaymentConfirmation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contact, paymentData } = req.body;

      if (!contact || !paymentData || !paymentData.amount) {
        throw new AppError('Contact information and payment data with amount are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const results = await communicationService.sendPaymentConfirmation(contact, paymentData);

      res.status(200).json({
        success: true,
        message: 'Payment confirmation sent successfully',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get message delivery status
   * GET /api/messaging/status/:messageId
   */
  async getMessageStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        throw new AppError('Message ID is required', 400, 'MISSING_MESSAGE_ID');
      }

      const status = await communicationService.getDeliveryStatus(messageId);

      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check for messaging services
   * GET /api/messaging/health
   */
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = {
        email: await communicationService.emailHealthCheck(),
        sms: { healthy: false, message: 'SMS service not available' }
      };

      // Check SMS service health if available
      try {
        const smsService = getDefaultSMSService();
        health.sms = await smsService.healthCheck();
      } catch (error) {
        health.sms = {
          healthy: false,
          message: error instanceof Error ? error.message : 'SMS service initialization error'
        };
      }

      const overallHealth = health.email.healthy && health.sms.healthy;

      res.status(overallHealth ? 200 : 503).json({
        success: overallHealth,
        message: overallHealth ? 'All messaging services are operational' : 'Some messaging services are experiencing issues',
        data: health
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate phone number
   * POST /api/messaging/validate/phone
   */
  async validatePhone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone } = req.body;

      if (!phone) {
        throw new AppError('Phone number is required', 400, 'MISSING_PHONE_NUMBER');
      }

      const smsService = getDefaultSMSService();
      const validation = smsService.validatePhoneNumber(phone);

      res.status(200).json({
        success: true,
        data: validation
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available message templates
   * GET /api/messaging/templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = {
        sms: {
          welcome: 'Welcome message for new users',
          verification: 'Account verification code',
          passwordReset: 'Password reset code',
          eventInvitation: 'Event invitation',
          eventReminder24h: 'Event reminder (24 hours before)',
          eventReminder1h: 'Event reminder (1 hour before)',
          eventCancellation: 'Event cancellation notice',
          paymentConfirmation: 'Payment confirmation',
          paymentReminder: 'Payment reminder',
          ticketDelivery: 'Ticket delivery notification',
          rsvpConfirmation: 'RSVP confirmation',
          eventCapacityAlert: 'Event capacity alert'
        },
        email: {
          welcome: 'Welcome email with WEXP features',
          eventInvitation: 'Detailed event invitation',
          eventReminder: 'Event reminder with details',
          paymentConfirmation: 'Payment confirmation with receipt'
        }
      };

      res.status(200).json({
        success: true,
        data: templates
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send custom message using templates
   * POST /api/messaging/template/send
   */
  async sendTemplateMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { templateType, templateData, recipient, method = 'sms' } = req.body;

      if (!templateType || !templateData || !recipient) {
        throw new AppError('Template type, template data, and recipient are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      let message = '';
      let results;

      if (method === 'sms') {
        // Generate SMS message using template
        switch (templateType) {
          case 'welcome':
            message = MessageTemplates.SMS.welcome(templateData);
            break;
          case 'verification':
            message = MessageTemplates.SMS.verification(templateData);
            break;
          case 'event_invitation':
            message = MessageTemplates.SMS.eventInvitation(templateData);
            break;
          case 'payment_confirmation':
            message = MessageTemplates.SMS.paymentConfirmation(templateData);
            break;
          case 'custom':
            message = MessageTemplates.SMS.custom(templateData.message, templateData);
            break;
          default:
            throw new AppError('Invalid SMS template type', 400, 'INVALID_TEMPLATE_TYPE');
        }

        results = await communicationService.sendSMS({
          to: recipient,
          message
        });
      } else if (method === 'whatsapp') {
        // Send WhatsApp template message
        results = await communicationService.sendWhatsApp({
          to: recipient,
          message: '', // Message is determined by template
          type: 'template',
          templateName: templateType === 'custom' ? templateData.templateName : templateType,
          templateParams: templateData.components || [] // Pass components/params
        });
      } else if (method === 'email') {
        let emailHtml = '';
        let subject = '';

        switch (templateType) {
          case 'welcome':
            emailHtml = MessageTemplates.Email.welcome(templateData);
            subject = 'Welcome to WEXP!';
            break;
          case 'event_invitation':
            emailHtml = MessageTemplates.Email.eventInvitation(templateData);
            subject = `Invitation: ${templateData.title}`;
            break;
          case 'payment_confirmation':
            emailHtml = MessageTemplates.Email.paymentConfirmation(templateData);
            subject = 'Payment Confirmation';
            break;
          default:
            throw new AppError('Invalid email template type', 400, 'INVALID_TEMPLATE_TYPE');
        }

        results = await communicationService.sendEmail({
          to: recipient,
          subject,
          html: emailHtml
        });
      } else {
        throw new AppError('Invalid method. Must be sms, email, or whatsapp', 400, 'INVALID_METHOD');
      }

      res.status(200).json({
        success: true,
        message: `Template message sent successfully via ${method}`,
        data: results
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Send wedding invitation
   * POST /api/messaging/wedding-invitation
   */
  async sendWeddingInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { to, data } = req.body;

      if (!to || !data) {
        throw new AppError('Recipient and invitation data are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const requiredFields = ['guestName', 'parentsName', 'groomName', 'brideName', 'location', 'date', 'startTime', 'endTime'];
      const missingFields = requiredFields.filter(field => !data[field]);

      if (missingFields.length > 0) {
        throw new AppError(`Missing required data fields: ${missingFields.join(', ')}`, 400, 'MISSING_DATA_FIELDS');
      }

      const results = await communicationService.sendWeddingInvitation(to, data);

      res.status(200).json({
        success: true,
        message: 'Wedding invitation sent successfully',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Send WhatsApp message directly
   * POST /api/messaging/whatsapp/direct
   */
  async sendWhatsAppDirect(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { to, message, mediaUrl, useTemplate, invitationId, eventId, templateVariables, language } = req.body;

      logger.info('📱 WhatsApp Direct Request:', {
        to,
        hasMessage: !!message,
        messageLength: message?.length || 0,
        hasMediaUrl: !!mediaUrl,
        useTemplate: useTemplate,
        invitationId,
        eventId,
        language: language || 'en', // Default to English if not specified
        hasTemplateVariables: !!templateVariables,
        requestBody: JSON.stringify(req.body, null, 2)
      });

      if (!to) {
        throw new AppError('Phone number is required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      // Message is only required if not using template
      // When using template, message is generated from template variables
      // Check useTemplate explicitly (could be true, false, or undefined)
      const isUsingTemplate = useTemplate === true;

      if (!isUsingTemplate && !message) {
        logger.warn('⚠️ Message validation failed:', {
          useTemplate,
          isUsingTemplate,
          hasMessage: !!message,
          messageValue: message
        });
        throw new AppError('Message is required when not using template', 400, 'MISSING_REQUIRED_FIELDS');
      }

      // Get userId from authenticated request
      const userId = req.user?.userId;

      const results = await communicationService.sendWhatsApp({
        to: Array.isArray(to) ? to : [to],
        message: message || '', // Provide empty string if using template
        type: useTemplate ? 'template' : 'text',
        mediaUrl,
        invitationId,
        eventId,
        useTemplate,
        language: language || 'en', // Pass language to service (default: English)
        templateVariables
      }, userId); // Pass userId to store message in chat database

      res.status(200).json({
        success: true,
        message: 'WhatsApp message sent successfully',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new MessagingController();
