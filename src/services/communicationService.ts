import nodemailer from 'nodemailer';
import database from '../config/database';
import { MessageLog } from '../entities/MessageLog';
import { Invitation } from '../entities/Invitation';
import { Event } from '../entities/Event';
import { InvitationMethod, DeliveryStatus } from '../entities/enums';
import { Repository } from 'typeorm';
import config from '../config';
import { AppError } from '../middleware/errorHandler';
import { SMSService, initializeSMSService, getDefaultSMSService } from './smsService';
import MessageTemplates from '../utils/messageTemplates';
import { WhatsAppService } from './whatsapp.service';

import { EmailRequest, SMSRequest, WhatsAppRequest, MessageResponse } from '../types';
import logger from '../config/logger';

export class CommunicationService {
  private emailTransporter!: nodemailer.Transporter;
  private messageLogRepository: Repository<MessageLog>;
  private invitationRepository: Repository<Invitation>;
  private eventRepository: Repository<Event>;
  private whatsAppService: WhatsAppService;

  constructor() {
    this.messageLogRepository = database.getRepository(MessageLog) as Repository<MessageLog>;
    this.invitationRepository = database.getRepository(Invitation) as Repository<Invitation>;
    this.eventRepository = database.getRepository(Event) as Repository<Event>;
    this.setupEmailTransporter();
    this.initializeSMSService();
    this.whatsAppService = new WhatsAppService();
  }

  /**
   * Setup email transporter
   */
  private setupEmailTransporter(): void {
    try {
      // Check if SMTP is configured
      if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
        logger.warn('⚠️ Email transporter not configured - SMTP settings missing', {
          hasHost: !!config.smtp.host,
          hasUser: !!config.smtp.user,
          hasPass: !!config.smtp.pass,
          host: config.smtp.host || 'NOT SET',
          port: config.smtp.port,
        });
        return;
      }

      // Log configuration for debugging (without sensitive info)
      logger.info('📧 Setting up email transporter:', {
        host: config.smtp.host,
        port: config.smtp.port,
        user: config.smtp.user,
        hasPassword: !!config.smtp.pass,
        secure: config.smtp.port === 465,
      });

      this.emailTransporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465, // true for 465, false for other ports
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates
        },
        connectionTimeout: 30000, // Increased to 30 seconds
        greetingTimeout: 15000, // Increased to 15 seconds
        socketTimeout: 60000, // Increased to 60 seconds
        debug: config.nodeEnv === 'development', // Enable debug in dev
        logger: config.nodeEnv === 'development', // Enable logging in dev
      });

      // Verify connection (but don't block app startup)
      // Use a timeout to prevent hanging
      const verifyTimeout = setTimeout(() => {
        logger.warn('⏱️ Email transporter verification timed out after 35 seconds', {
          host: config.smtp.host,
          port: config.smtp.port,
          suggestion: 'Check SMTP server connectivity, firewall rules, or increase timeout',
        });
      }, 35000);

      this.emailTransporter.verify((error, success) => {
        clearTimeout(verifyTimeout);

        if (error) {
          const errorDetails: any = {
            message: error.message,
            code: (error as any).code,
            command: (error as any).command,
            response: (error as any).response,
            responseCode: (error as any).responseCode,
            host: config.smtp.host,
            port: config.smtp.port,
            user: config.smtp.user,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          };

          // Add specific error context
          if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
            errorDetails.errorType = 'CONNECTION_TIMEOUT';
            errorDetails.troubleshooting = [
              'Check if SMTP server is reachable: try telnet or ping',
              'Verify firewall rules allow outbound connections on port ' + config.smtp.port,
              'Check if SMTP host and port are correct',
              'Some networks block SMTP ports - try using port 587 with STARTTLS',
            ];
          } else if (error.message?.includes('ECONNREFUSED')) {
            errorDetails.errorType = 'CONNECTION_REFUSED';
            errorDetails.troubleshooting = [
              'SMTP server is not accepting connections',
              'Verify the host and port are correct',
              'Check if SMTP service is running on the server',
            ];
          } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('getaddrinfo')) {
            errorDetails.errorType = 'DNS_RESOLUTION_FAILED';
            errorDetails.troubleshooting = [
              'Cannot resolve SMTP hostname',
              'Check if host name is correct',
              'Verify DNS settings',
            ];
          } else if ((error as any).code === 'EAUTH') {
            errorDetails.errorType = 'AUTHENTICATION_FAILED';
            errorDetails.troubleshooting = [
              'SMTP credentials are incorrect',
              'Verify username and password',
              'For Gmail, use App Password instead of regular password',
            ];
          }

          // logger.error('❌ Email transporter verification failed:', errorDetails);
        } else {
          logger.info('✅ Email transporter is ready and verified', {
            host: config.smtp.host,
            port: config.smtp.port,
            user: config.smtp.user,
          });
        }
      });
    } catch (error) {
      logger.error('❌ Failed to setup email transporter:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        host: config.smtp.host,
        port: config.smtp.port,
        user: config.smtp.user,
      });
    }
  }

  /**
   * Initialize SMS service
   */
  private initializeSMSService(): void {
    try {
      if (config.sms.provider === 'messaging-service') {
        initializeSMSService({
          username: config.sms.messagingService.username,
          password: config.sms.messagingService.password,
          apiUrl: config.sms.messagingService.apiUrl,
          defaultFrom: config.sms.messagingService.defaultFrom
        });
        logger.info('✅ SMS service initialized successfully');
      } else {
        logger.warn('SMS service not configured for messaging-service provider');
      }
    } catch (error) {
      logger.error('Failed to initialize SMS service:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        provider: config.sms.provider
      });
    }
  }

  /**
   * Send email
   */
  async sendEmail(emailData: EmailRequest): Promise<MessageResponse[]> {
    const recipients = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
    const results: MessageResponse[] = [];

    for (const recipient of recipients) {
      try {
        const mailOptions = {
          from: `${config.fromName} <${config.fromEmail}>`,
          to: recipient,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          attachments: emailData.attachments,
        };

        const info = await this.emailTransporter.sendMail(mailOptions);

        // Log message
        const messageLog = await this.messageLogRepository.save(
          this.messageLogRepository.create({
            recipientType: 'email',
            recipient,
            method: InvitationMethod.EMAIL,
            subject: emailData.subject,
            content: emailData.html || emailData.text || '',
            status: DeliveryStatus.SENT,
            deliveredAt: new Date(),
            metadata: { messageId: info.messageId },
          })
        );

        results.push({
          id: messageLog.id,
          status: DeliveryStatus.SENT,
          deliveredAt: new Date(),
        });

        logger.info(`Email sent to ${recipient}`);
      } catch (error) {
        // Log failed message
        const messageLog = await this.messageLogRepository.save(
          this.messageLogRepository.create({
            recipientType: 'email',
            recipient,
            method: InvitationMethod.EMAIL,
            subject: emailData.subject,
            content: emailData.html || emailData.text || '',
            status: DeliveryStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
        );

        results.push({
          id: messageLog.id,
          status: DeliveryStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        logger.error(`Failed to send email to ${recipient}:`, error);
      }
    }

    return results;
  }

  /**
   * Send SMS (Tanzania providers)
   */
  async sendSMS(smsData: SMSRequest): Promise<MessageResponse[]> {
    const recipients = Array.isArray(smsData.to) ? smsData.to : [smsData.to];
    const results: MessageResponse[] = [];

    // Add delay between requests to avoid rate limiting (100ms delay)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      // Add delay between requests (except for the first one)
      if (i > 0) {
        await delay(100); // 100ms delay between requests
      }

      try {
        // Use phone number as provided (no validation)
        const formattedPhone = recipient.trim();

        if (!formattedPhone) {
          logger.warn(`Skipping empty phone number at index ${i}`);

          // Create a message log entry for the failed attempt
          const messageLog = await this.messageLogRepository.save(
            this.messageLogRepository.create({
              recipientType: 'phone',
              recipient: recipient || 'empty',
              method: InvitationMethod.SMS,
              content: smsData.message,
              status: DeliveryStatus.FAILED,
              errorMessage: 'Empty phone number',
            })
          );

          results.push({
            id: messageLog.id,
            status: DeliveryStatus.FAILED,
            errorMessage: 'Empty phone number',
          });
          continue;
        }

        let response;

        // Choose SMS provider based on configuration
        if (config.sms.provider === 'messaging-service') {
          response = await this.sendSMSMessagingService(formattedPhone, smsData.message);
        } else if (config.sms.provider === 'beem') {
          response = await this.sendSMSBeem(formattedPhone, smsData.message);
        } else if (config.sms.provider === 'ttcl') {
          response = await this.sendSMSTTCL(formattedPhone, smsData.message);
        } else {
          throw new AppError('SMS provider not configured', 500, 'SMS_PROVIDER_ERROR');
        }

        // Log message
        const messageLogData = {
          recipientType: 'phone',
          recipient: formattedPhone,
          method: InvitationMethod.SMS,
          content: smsData.message,
          status: response.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
          deliveredAt: response.success ? new Date() : undefined,
          errorMessage: response.success ? undefined : response.error,
          metadata: response.metadata,
        };
        const savedMessageLog = await this.messageLogRepository.save(messageLogData);

        results.push({
          id: savedMessageLog.id,
          status: response.success ? 'SENT' : 'FAILED',
          deliveredAt: response.success ? new Date() : undefined,
          errorMessage: response.success ? undefined : response.error,
        });

        logger.info(`SMS ${response.success ? 'sent' : 'failed'} to ${formattedPhone}${response.error ? `: ${response.error}` : ''}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorDetails = error instanceof Error ? error.stack : String(error);

        // Enhanced error logging
        logger.error(`Failed to send SMS to ${recipient}:`, {
          error: errorMessage,
          details: errorDetails,
          phone: recipient,
          messageLength: smsData.message?.length || 0,
        });

        // Log failed message
        const messageLog = await this.messageLogRepository.save(
          this.messageLogRepository.create({
            recipientType: 'phone',
            recipient,
            method: InvitationMethod.SMS,
            content: smsData.message,
            status: DeliveryStatus.FAILED,
            errorMessage: errorMessage,
          })
        );

        results.push({
          id: messageLog.id,
          status: DeliveryStatus.FAILED,
          errorMessage: errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * Send WhatsApp message
   */
  async sendWhatsApp(whatsappData: WhatsAppRequest, userId?: string): Promise<MessageResponse[]> {
    const recipients = Array.isArray(whatsappData.to) ? whatsappData.to : [whatsappData.to];
    const results: MessageResponse[] = [];

    for (const recipient of recipients) {
      try {
        // Use phone number as provided (no validation)
        const formattedPhone = recipient.trim().replace('+', ''); // Remove + for WhatsApp API
        const response = await this.sendWhatsAppMessage(formattedPhone, whatsappData);

        // Check if message failed due to 24-hour window restriction
        if (response.requiresTemplate) {
          logger.warn(`⏰ Cannot send regular message to ${recipient.trim()} - 24-hour window expired. Template required.`);

          // Log the failed attempt
          const messageLogData = {
            recipientType: 'phone',
            recipient: recipient.trim(),
            method: InvitationMethod.WHATSAPP,
            content: whatsappData.message,
            status: DeliveryStatus.FAILED,
            errorMessage: response.metadata?.errorMessage || '24-hour messaging window expired. Template message required.',
            metadata: {
              ...response.metadata,
              requiresTemplate: true,
              errorCode: 131047,
            },
          };
          const savedMessageLog = await this.messageLogRepository.save(messageLogData);

          results.push({
            id: savedMessageLog.id,
            status: 'FAILED',
            errorMessage: response.metadata?.errorMessage || 'More than 24 hours have passed since the customer last replied. Please use an approved WhatsApp template message instead.',
            metadata: {
              requiresTemplate: true,
              errorCode: 131047,
            },
          });

          logger.info(`WhatsApp message blocked (24-hour window) for ${recipient.trim()}`);
          continue; // Skip to next recipient
        }

        // Get WhatsApp message ID from response
        const whatsappMessageId = response.metadata?.messageId || response.metadata?.fullResponse?.messages?.[0]?.id;

        // Log message in MessageLog (for general communication history)
        const messageLogData = {
          recipientType: 'phone',
          recipient: recipient.trim(),
          method: InvitationMethod.WHATSAPP,
          content: whatsappData.message,
          status: response.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
          deliveredAt: response.success ? new Date() : undefined,
          errorMessage: response.success ? undefined : response.error,
          metadata: response.metadata,
        };
        const savedMessageLog = await this.messageLogRepository.save(messageLogData);

        // Also store in Message table (for chat system and webhook status updates) if userId is provided
        if (userId && response.success && whatsappMessageId) {
          try {
            // Lazy import to avoid circular dependency
            const conversationService = (await import('./conversationService')).default;
            await conversationService.storeOutgoingMessage(
              userId,
              formattedPhone,
              whatsappData.message,
              whatsappMessageId,
              whatsappData.mediaUrl ? 'image' : 'text',
              {
                mediaUrl: whatsappData.mediaUrl,
                sentFrom: 'communications_page',
              }
            );
            logger.info(`✅ Stored WhatsApp message in chat database for webhook tracking: ${whatsappMessageId}`);
          } catch (chatError: any) {
            // Don't fail the entire send if chat storage fails
            logger.warn(`⚠️ Failed to store message in chat database (non-critical): ${chatError.message}`);
          }
        }

        results.push({
          id: savedMessageLog.id,
          status: response.success ? 'SENT' : 'FAILED',
          deliveredAt: response.success ? new Date() : undefined,
          errorMessage: response.success ? undefined : response.error,
        });

        logger.info(`WhatsApp ${response.success ? 'sent' : 'failed'} to ${recipient.trim()}`);
      } catch (error) {
        // Log failed message
        const messageLog = await this.messageLogRepository.save(
          this.messageLogRepository.create({
            recipientType: 'phone',
            recipient,
            method: InvitationMethod.WHATSAPP,
            content: whatsappData.message,
            status: DeliveryStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
        );

        results.push({
          id: messageLog.id,
          status: DeliveryStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        logger.error(`Failed to send WhatsApp to ${recipient}:`, error);
      }
    }

    return results;
  }

  /**
   * Send SMS via messaging-service.co.tz
   */
  private async sendSMSMessagingService(
    phone: string,
    message: string
  ): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      const smsService = getDefaultSMSService();

      // Validate and format phone number
      const phoneValidation = smsService.validatePhoneNumber(phone);
      if (!phoneValidation.isValid) {
        throw new Error(phoneValidation.error || 'Invalid phone number format');
      }

      const result = await smsService.sendToSingle(
        phoneValidation.formatted!,
        message
      );

      if (result.success) {
        return {
          success: true,
          metadata: {
            messageId: result.messageId,
            reference: result.reference,
            cost: result.cost,
            provider: 'messaging-service'
          }
        };
      } else {
        return {
          success: false,
          error: result.error || 'SMS sending failed',
          metadata: result.details
        };
      }
    } catch (error) {
      logger.error('Messaging service SMS error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Messaging service SMS error'
      };
    }
  }

  /**
   * Send SMS via Beem (Tanzania SMS provider)
   */
  private async sendSMSBeem(
    phone: string,
    message: string
  ): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      if (!config.sms.beem.apiKey || !config.sms.beem.secretKey) {
        throw new Error('Beem SMS credentials not configured');
      }

      // Note: This is a mock implementation
      // In production, you would integrate with actual Beem SMS API
      const mockResponse = {
        success: true,
        messageId: `beem_${Date.now()}`,
        cost: 50, // TZS
      };

      logger.info(`Mock SMS sent via Beem to ${phone}: ${message}`);

      return {
        success: true,
        metadata: mockResponse,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Beem SMS error',
      };
    }
  }

  /**
   * Send SMS via TTCL (Tanzania SMS provider)
   */
  private async sendSMSTTCL(
    phone: string,
    message: string
  ): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      if (!config.sms.ttcl.username || !config.sms.ttcl.password) {
        throw new Error('TTCL SMS credentials not configured');
      }

      // Note: This is a mock implementation
      // In production, you would integrate with actual TTCL SMS API
      const mockResponse = {
        success: true,
        messageId: `ttcl_${Date.now()}`,
        cost: 45, // TZS
      };

      logger.info(`Mock SMS sent via TTCL to ${phone}: ${message}`);

      return {
        success: true,
        metadata: mockResponse,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'TTCL SMS error',
      };
    }
  }

  /**
   * Send WhatsApp message via WhatsApp Business API
   */
  private async sendWhatsAppMessage(
    phone: string,
    data: WhatsAppRequest
  ): Promise<{ success: boolean; error?: string; metadata?: any; requiresTemplate?: boolean }> {
    try {
      // Log incoming request for debugging
      logger.info(`📱 WhatsApp Send Request for ${phone}`, {
        phone,
        type: data.type,
        useTemplate: data.useTemplate,
        invitationId: data.invitationId,
        eventId: data.eventId,
        includeCardAttachment: data.includeCardAttachment,
        hasMessage: !!data.message,
        messageLength: data.message?.length || 0,
        hasMediaUrl: !!data.mediaUrl,
        hasTemplateVariables: !!data.templateVariables,
        fullRequest: JSON.stringify(data, null, 2),
      });

      // Check if WhatsApp service is configured (basic check)
      if (!config.whatsapp.token || !config.whatsapp.phoneId) {
        throw new Error('WhatsApp Business API credentials not configured');
      }

      // Check if we need to use a template message (24-hour window)
      let requiresTemplate = false;
      if (data.type !== 'template') {
        try {
          const conversationService = (await import('./conversationService')).default;
          requiresTemplate = await conversationService.requiresTemplateMessage(phone);

          if (requiresTemplate) {
            logger.warn(`⏰ 24-hour window expired for ${phone}. Template message required.`, {
              phone,
              message: 'Regular text messages cannot be sent. Use an approved template instead.',
            });

            return {
              success: false,
              error: 'MESSAGE_WINDOW_EXPIRED',
              metadata: {
                errorCode: 131047,
                errorMessage: 'More than 24 hours have passed since the customer last replied. Please use an approved WhatsApp template message instead.',
                requiresTemplate: true,
              },
              requiresTemplate: true,
            };
          }
        } catch (checkError: any) {
          // If we can't check, log but continue (might be a new conversation)
          logger.debug(`Could not check 24-hour window for ${phone}:`, checkError.message);
        }
      }

      let response;

      if (data.type === 'template' && data.templateName) {
        // Send template message
        response = await this.whatsAppService.sendTemplateMessage(
          phone,
          data.templateName,
          'en_US', // Default language, could be added to WhatsAppRequest
          data.templateParams || []
        );
      } else if (data.useTemplate && (data.invitationId || data.eventId)) {
        // Use wedding invitation template (card attachment is optional)
        logger.info(`📧 Processing template request for ${phone}`, {
          phone,
          useTemplate: data.useTemplate,
          invitationId: data.invitationId,
          eventId: data.eventId,
          includeCardAttachment: data.includeCardAttachment,
          hasMediaUrl: !!data.mediaUrl,
          hasTemplateVariables: !!data.templateVariables,
        });

        try {
          // Fetch invitation and event data
          let invitation: Invitation | null = null;
          let event: Event | null = null;

          if (data.invitationId) {
            invitation = await this.invitationRepository.findOne({
              where: { id: data.invitationId },
              relations: ['event', 'event.user']
            });
            if (invitation) {
              event = invitation.event;
            }
          } else if (data.eventId) {
            event = await this.eventRepository.findOne({
              where: { id: data.eventId },
              relations: ['user']
            });
          }

          if (invitation && event) {
            // Check if user wants to include card attachment
            // If includeCardAttachment is explicitly false, don't use card even if it exists
            const shouldIncludeCard = data.includeCardAttachment !== false; // Default to true if not specified

            // Card attachment is optional - only use if:
            // 1. User wants to include it (shouldIncludeCard is true)
            // 2. URL is publicly accessible (not localhost)
            // WhatsApp cannot access localhost URLs, so we filter them out
            let cardUrl: string | undefined = undefined;

            if (shouldIncludeCard) {
              // Check mediaUrl first (from current request)
              if (data.mediaUrl &&
                !data.mediaUrl.includes('localhost') &&
                !data.mediaUrl.includes('127.0.0.1') &&
                !data.mediaUrl.includes('::1')) {
                cardUrl = data.mediaUrl;
              }
              // Fallback to invitation cardUrl if no mediaUrl
              else if (invitation.cardUrl &&
                !invitation.cardUrl.includes('localhost') &&
                !invitation.cardUrl.includes('127.0.0.1') &&
                !invitation.cardUrl.includes('::1')) {
                cardUrl = invitation.cardUrl;
              }
            }

            const hasValidCardUrl = !!cardUrl;

            // Build RSVP link if invitation has QR code
            const rsvpLink = invitation.qrCode
              ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/rsvp/${invitation.qrCode}`
              : undefined;

            // Use custom template variables if provided, otherwise use defaults
            const customVars = data.templateVariables || {};

            // Choose template based on whether we have a valid card URL
            if (cardUrl) {
              // Use wedding_invitation_with_image template when card is available
              console.log('🔍 Template Selection Decision ==========================================>', {
                phone,
                templateName: 'wedding_invitation_with_image',
                hasCardUrl: true,
                cardUrl: cardUrl.substring(0, 50) + '...',
                includeCardAttachment: data.includeCardAttachment,
              });

              logger.info(`📧 Using wedding_invitation_with_image template for ${phone}`, {
                invitationId: invitation.id,
                eventId: event.id,
                guestName: invitation.guestName,
                hasCard: true,
                cardUrl: 'provided (public URL)',
                includeCardAttachment: data.includeCardAttachment,
                templateName: 'wedding_invitation_with_image'
              });

              response = await this.whatsAppService.sendWeddingInvitationWithImage(
                phone,
                {
                  guestName: customVars.guestname || invitation.guestName,
                  cardUrl: cardUrl
                },
                {
                  eventDate: event.eventDate,
                  startTime: customVars.starttime || event.startTime,
                  endTime: customVars.endtime || event.endTime,
                  venueName: event.venueName,
                  venueAddress: event.venueAddress,
                  user: event.user,
                  brideName: customVars.bridename || (event as any).brideName,
                  groomName: customVars.groomname || (event as any).groomName,
                },
                cardUrl,
                rsvpLink,
                'en', // Use 'en' to match working format
                {
                  hostname: customVars.hostname,
                  eventdate: customVars.eventdate,
                  venue: customVars.venue,
                }
              );

              console.log('✅ wedding_invitation_with_image template response ==========================================>', {
                phone,
                success: !!response.messages,
                messageId: response.messages?.[0]?.id,
                messageStatus: response.messages?.[0]?.message_status
              });
            } else {
              // Use wedding_invite template when no card is available
              console.log('🔍 Template Selection Decision ==========================================>', {
                phone,
                templateName: 'wedding_invite',
                hasCardUrl: false,
                includeCardAttachment: data.includeCardAttachment,
                mediaUrl: data.mediaUrl,
                invitationCardUrl: invitation.cardUrl
              });

              logger.info(`📧 Using wedding_invite template (no image) for ${phone}`, {
                invitationId: invitation.id,
                eventId: event.id,
                guestName: invitation.guestName,
                hasCard: false,
                includeCardAttachment: data.includeCardAttachment,
                templateName: 'wedding_invite',
                language: data.language || 'en',
                reason: data.includeCardAttachment === false
                  ? 'User disabled card attachment'
                  : 'No valid card URL available'
              });

              // Check language and use appropriate template
              const selectedLanguage = data.language || 'en';

              if (selectedLanguage === 'sw') {
                // Use Swahili template
                response = await this.whatsAppService.sendSwahiliWeddingInvitation(
                  phone,
                  {
                    guestName: customVars.guestname || invitation.guestName,
                    cardUrl: undefined
                  },
                  {
                    eventDate: event.eventDate,
                    startTime: customVars.starttime || event.startTime,
                    endTime: customVars.endtime || event.endTime,
                    venueName: event.venueName,
                    venueAddress: event.venueAddress,
                    user: event.user,
                    brideName: customVars.bridename || (event as any).brideName,
                    groomName: customVars.groomname || (event as any).groomName,
                  },
                  '', // No card image URL
                  rsvpLink,
                  'sw' // Swahili language code
                );
              } else {
                // Use English template
                response = await this.whatsAppService.sendWeddingInvite(
                  phone,
                  {
                    guestName: customVars.guestname || invitation.guestName,
                  },
                  {
                    eventDate: event.eventDate,
                    startTime: customVars.starttime || event.startTime,
                    endTime: customVars.endtime || event.endTime,
                    venueName: event.venueName,
                    venueAddress: event.venueAddress,
                    user: event.user,
                    brideName: customVars.bridename || (event as any).brideName,
                    groomName: customVars.groomname || (event as any).groomName,
                  },
                  rsvpLink,
                  selectedLanguage,
                  {
                    guestname: customVars.guestname,
                    hostname: customVars.hostname,
                    bridename: customVars.bridename,
                    groomname: customVars.groomname,
                    eventdate: customVars.eventdate,
                    venue: customVars.venue,
                    starttime: customVars.starttime,
                    endtime: customVars.endtime,
                  }
                );
              }

              console.log(`✅ wedding_invite template response (${selectedLanguage}) ==========================================>`, {
                phone,
                success: !!response.messages,
                messageId: response.messages?.[0]?.id,
                messageStatus: response.messages?.[0]?.message_status
              });
            }
          } else {
            // If useTemplate is true but data not found, return error instead of falling back
            if (data.useTemplate) {
              logger.error(`❌ Cannot use template for ${phone}: invitation/event data not found`, {
                phone,
                invitationId: data.invitationId,
                eventId: data.eventId,
                useTemplate: data.useTemplate,
              });
              throw new Error('Invitation or event data not found. Cannot send template message.');
            }

            // Fallback to regular message only if NOT using template
            logger.warn(`⚠️ Could not find invitation/event data for ${phone}, falling back to regular message`);
            if (data.mediaUrl && !data.mediaUrl.includes('localhost')) {
              // Try image message if mediaUrl exists and is not localhost
              let mediaIdOrUrl = data.mediaUrl;
              if (data.mediaUrl.startsWith('data:')) {
                logger.info(`Uploading media for ${phone}...`);
                mediaIdOrUrl = await this.whatsAppService.uploadMedia(data.mediaUrl);
              }
              response = await this.whatsAppService.sendImageMessage(
                phone,
                mediaIdOrUrl,
                data.message || ''
              );
            } else if (data.message && data.message.trim()) {
              // Only send text message if message is not empty
              response = await this.whatsAppService.sendTextMessage(
                phone,
                data.message
              );
            } else {
              throw new Error('Cannot send message: no template data found and message body is empty');
            }
          }
        } catch (templateError: any) {
          logger.error(`❌ Error using template for ${phone}:`, {
            error: templateError.message,
            stack: templateError.stack,
            phone,
            useTemplate: data.useTemplate,
            invitationId: data.invitationId,
            eventId: data.eventId,
            fullError: JSON.stringify(templateError, Object.getOwnPropertyNames(templateError)),
          });

          // If useTemplate is true, don't fall back to text message - return error
          if (data.useTemplate) {
            throw new Error(`Template message failed: ${templateError.message}`);
          }

          // Fallback to regular message only if NOT using template
          if (data.mediaUrl && !data.mediaUrl.includes('localhost')) {
            // Try image message if mediaUrl exists and is not localhost
            let mediaIdOrUrl = data.mediaUrl;
            if (data.mediaUrl.startsWith('data:')) {
              mediaIdOrUrl = await this.whatsAppService.uploadMedia(data.mediaUrl);
            }
            response = await this.whatsAppService.sendImageMessage(
              phone,
              mediaIdOrUrl,
              data.message || ''
            );
          } else if (data.message && data.message.trim()) {
            // Only send text message if message is not empty
            response = await this.whatsAppService.sendTextMessage(
              phone,
              data.message
            );
          } else {
            throw new Error('Cannot send message: template failed and message body is empty');
          }
        }
      } else if (data.mediaUrl) {
        // Send media message (regular, no template)
        let mediaIdOrUrl = data.mediaUrl;

        // If Data URL, upload first
        if (data.mediaUrl.startsWith('data:')) {
          logger.info(`Uploading media for ${phone}...`);
          mediaIdOrUrl = await this.whatsAppService.uploadMedia(data.mediaUrl);
        }

        response = await this.whatsAppService.sendImageMessage(
          phone,
          mediaIdOrUrl,
          data.message // Use message as caption
        );
      } else {
        // Send text message (default) - but only if message is not empty
        if (!data.message || !data.message.trim()) {
          throw new Error('Cannot send WhatsApp message: message body is required when not using template');
        }
        response = await this.whatsAppService.sendTextMessage(
          phone,
          data.message
        );
      }

      console.log('WhatsApp response==========================================>', response);

      logger.info(`✅ WhatsApp message sent successfully to ${phone}`, {
        phone,
        messageId: response.messages?.[0]?.id,
        messageStatus: response.messages?.[0]?.message_status,
        fullResponse: JSON.stringify(response, null, 2),
        requestType: data.type || 'text',
        hasMedia: !!data.mediaUrl,
      });

      return {
        success: true,
        metadata: {
          messageId: response.messages?.[0]?.id,
          messageStatus: response.messages?.[0]?.message_status,
          provider: 'whatsapp_business_api',
          fullResponse: response,
        },
      };
    } catch (error: any) {
      logger.error(`❌ WhatsApp API error for ${phone}:`, {
        phone,
        errorMessage: error.message,
        errorCode: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseHeaders: error.response?.headers ? JSON.stringify(error.response.headers) : 'No headers',
        responseData: error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No response data',
        errorDetails: error.response?.data?.error ? JSON.stringify(error.response.data.error, null, 2) : 'No error details',
        requestType: data.type || 'text',
        hasMedia: !!data.mediaUrl,
        fullError: error.stack,
      });
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'WhatsApp API error',
      };
    }
  }

  /**
   * Get message delivery status
   */
  async getDeliveryStatus(messageId: string): Promise<MessageResponse> {
    const message = await this.messageLogRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    return {
      id: message.id,
      status: message.status as any,
      deliveredAt: message.deliveredAt || undefined,
      errorMessage: message.errorMessage || undefined,
    };
  }

  /**
   * Bulk send messages
   */
  async bulkSend(
    messages: Array<{
      type: 'email' | 'sms' | 'whatsapp';
      data: EmailRequest | SMSRequest | WhatsAppRequest;
    }>
  ): Promise<MessageResponse[]> {
    const results: MessageResponse[] = [];

    for (const message of messages) {
      try {
        let messageResults: MessageResponse[] = [];

        switch (message.type) {
          case 'email':
            messageResults = await this.sendEmail(message.data as EmailRequest);
            break;
          case 'sms':
            messageResults = await this.sendSMS(message.data as SMSRequest);
            break;
          case 'whatsapp':
            messageResults = await this.sendWhatsApp(message.data as WhatsAppRequest);
            break;
        }

        results.push(...messageResults);
      } catch (error) {
        logger.error(`Bulk send error for ${message.type}:`, error);
      }
    }

    return results;
  }

  /**
   * Send invitation email template
   */
  async sendInvitationEmail(
    to: string,
    eventTitle: string,
    eventDate: Date,
    rsvpLink: string,
    organizerName: string
  ): Promise<MessageResponse[]> {
    const subject = `You're invited to ${eventTitle}`;
    const html = this.generateInvitationEmailTemplate(
      eventTitle,
      eventDate,
      rsvpLink,
      organizerName
    );

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send invitation SMS template
   */
  async sendInvitationSMS(
    to: string,
    eventTitle: string,
    eventDate: Date,
    rsvpLink: string,
    organizerName: string
  ): Promise<MessageResponse[]> {
    const message = `Karibu! You're invited to ${eventTitle} on ${eventDate.toLocaleDateString()}. RSVP: ${rsvpLink} - ${organizerName}`;

    return this.sendSMS({
      to,
      message,
    });
  }

  /**
   * Send welcome notification (SMS + Email)
   */
  async sendWelcomeNotification(
    userData: { name: string; email?: string; phone?: string }
  ): Promise<{ sms?: MessageResponse[]; email?: MessageResponse[] }> {
    const results: { sms?: MessageResponse[]; email?: MessageResponse[] } = {};

    // Send welcome SMS if phone provided
    if (userData.phone) {
      try {
        const smsMessage = MessageTemplates.SMS.welcome(userData);
        results.sms = await this.sendSMS({
          to: userData.phone,
          message: smsMessage
        });
      } catch (error) {
        logger.error('Failed to send welcome SMS:', error);
      }
    }

    // Send welcome email if email provided
    if (userData.email) {
      try {
        const emailHtml = MessageTemplates.Email.welcome(userData);
        results.email = await this.sendEmail({
          to: userData.email,
          subject: 'Welcome to WEXP!',
          html: emailHtml
        });
      } catch (error) {
        logger.error('Failed to send welcome email:', error);
      }
    }

    return results;
  }

  /**
   * Send verification code notification
   */
  async sendVerificationCode(
    contact: string,
    code: string,
    method: 'sms' | 'email' | 'whatsapp' = 'sms'
  ): Promise<MessageResponse[]> {
    if (method === 'sms') {
      const message = MessageTemplates.SMS.verification({ code });
      return this.sendSMS({
        to: contact,
        message
      });
    } else if (method === 'whatsapp') {
      const message = MessageTemplates.SMS.verification({ code }); // Use SMS template for now or create specific WA template
      return this.sendWhatsApp({
        to: contact,
        message,
        type: 'text' // Or template if you have one
      });
    } else {
      // For email verification, you might want to create an email template
      return this.sendEmail({
        to: contact,
        subject: 'Your WEXP Verification Code',
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`
      });
    }
  }

  /**
   * Send event notification to multiple recipients
   */
  async sendEventNotification(
    eventData: {
      title: string;
      date: Date;
      location?: string;
      organizerName?: string;
      rsvpLink?: string;
    },
    recipients: Array<{ phone?: string; email?: string; name?: string }>,
    notificationType: 'invitation' | 'reminder_24h' | 'reminder_1h' | 'cancellation',
    channel: 'sms' | 'email' | 'whatsapp' | 'all' = 'all'
  ): Promise<{ sms: MessageResponse[]; email: MessageResponse[]; whatsapp: MessageResponse[] }> {
    const smsResults: MessageResponse[] = [];
    const emailResults: MessageResponse[] = [];
    const whatsappResults: MessageResponse[] = [];

    for (const recipient of recipients) {
      // Send SMS notification
      if (recipient.phone && (channel === 'all' || channel === 'sms')) {
        try {
          let smsMessage = '';

          switch (notificationType) {
            case 'invitation':
              smsMessage = MessageTemplates.SMS.eventInvitation(eventData);
              break;
            case 'reminder_24h':
              smsMessage = MessageTemplates.SMS.eventReminder24h(eventData);
              break;
            case 'reminder_1h':
              smsMessage = MessageTemplates.SMS.eventReminder1h(eventData);
              break;
            case 'cancellation':
              smsMessage = MessageTemplates.SMS.eventCancellation(eventData);
              break;
          }

          const smsResult = await this.sendSMS({
            to: recipient.phone,
            message: smsMessage
          });
          smsResults.push(...smsResult);
        } catch (error) {
          logger.error(`Failed to send SMS to ${recipient.phone}:`, error);
        }
      }

      // Send WhatsApp notification
      if (recipient.phone && (channel === 'all' || channel === 'whatsapp')) {
        try {
          let whatsappMessage = '';
          // For now, using the same text templates as SMS. 
          // In the future, this should use specific WhatsApp templates.
          switch (notificationType) {
            case 'invitation':
              whatsappMessage = MessageTemplates.SMS.eventInvitation(eventData);
              break;
            case 'reminder_24h':
              whatsappMessage = MessageTemplates.SMS.eventReminder24h(eventData);
              break;
            case 'reminder_1h':
              whatsappMessage = MessageTemplates.SMS.eventReminder1h(eventData);
              break;
            case 'cancellation':
              whatsappMessage = MessageTemplates.SMS.eventCancellation(eventData);
              break;
          }

          const whatsappResult = await this.sendWhatsApp({
            to: recipient.phone,
            message: whatsappMessage,
            type: 'text'
          });
          whatsappResults.push(...whatsappResult);
        } catch (error) {
          logger.error(`Failed to send WhatsApp to ${recipient.phone}:`, error);
        }
      }

      // Send email notification
      if (recipient.email && (channel === 'all' || channel === 'email')) {
        try {
          let emailHtml = '';
          let subject = '';

          switch (notificationType) {
            case 'invitation':
              emailHtml = MessageTemplates.Email.eventInvitation(eventData);
              subject = `Invitation: ${eventData.title}`;
              break;
            case 'reminder_24h':
              emailHtml = MessageTemplates.Email.eventReminder(eventData, '24h');
              subject = `Reminder: ${eventData.title} - Tomorrow`;
              break;
            case 'reminder_1h':
              emailHtml = MessageTemplates.Email.eventReminder(eventData, '1h');
              subject = `Final Reminder: ${eventData.title} - 1 Hour`;
              break;
            default:
              // For cancellation, create a simple email
              emailHtml = `<h2>Event Cancelled</h2><p>The event "${eventData.title}" has been cancelled. We apologize for any inconvenience.</p>`;
              subject = `Event Cancelled: ${eventData.title}`;
          }

          const emailResult = await this.sendEmail({
            to: recipient.email,
            subject,
            html: emailHtml
          });
          emailResults.push(...emailResult);
        } catch (error) {
          logger.error(`Failed to send email to ${recipient.email}:`, error);
        }
      }
    }

    return { sms: smsResults, email: emailResults, whatsapp: whatsappResults };
  }

  /**
   * Send payment confirmation notification
   */
  async sendPaymentConfirmation(
    contact: { phone?: string; email?: string },
    paymentData: {
      amount: number;
      currency?: string;
      eventTitle?: string;
      transactionId?: string;
    }
  ): Promise<{ sms?: MessageResponse[]; email?: MessageResponse[] }> {
    const results: { sms?: MessageResponse[]; email?: MessageResponse[] } = {};

    if (contact.phone) {
      const smsMessage = MessageTemplates.SMS.paymentConfirmation(paymentData);
      results.sms = await this.sendSMS({
        to: contact.phone,
        message: smsMessage
      });
    }

    if (contact.email) {
      const emailHtml = MessageTemplates.Email.paymentConfirmation(paymentData);
      results.email = await this.sendEmail({
        to: contact.email,
        subject: 'Payment Confirmation - WEXP',
        html: emailHtml
      });
    }

    return results;
  }

  /**
   * Send wedding invitation via WhatsApp template
   */
  async sendWeddingInvitation(
    to: string,
    data: {
      guestName: string;
      parentsName: string;
      groomName: string;
      brideName: string;
      location: string;
      date: string;
      startTime: string;
      endTime: string;
      imageUrl?: string;
    }
  ): Promise<MessageResponse[]> {
    const defaultImage = 'https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=800&auto=format&fit=crop';

    const components = [
      {
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: {
              link: data.imageUrl || defaultImage
            }
          }
        ]
      },
      {
        type: 'body',
        parameters: [
          { type: 'text', text: data.guestName },
          { type: 'text', text: data.parentsName },
          { type: 'text', text: data.groomName },
          { type: 'text', text: data.brideName },
          { type: 'text', text: data.location },
          { type: 'text', text: data.date },
          { type: 'text', text: data.startTime },
          { type: 'text', text: data.endTime }
        ]
      }
    ];

    return this.sendWhatsApp({
      to,
      message: '', // Template message
      type: 'template',
      templateName: 'wedding_invitation_with_image',
      templateParams: components
    });
  }

  /**
   * Send invitation WhatsApp template
   */
  async sendInvitationWhatsApp(
    to: string,
    eventTitle: string,
    eventDate: Date,
    rsvpLink: string,
    organizerName: string
  ): Promise<MessageResponse[]> {
    const message = `🎉 Karibu! You're invited to *${eventTitle}*\n\n📅 Date: ${eventDate.toLocaleDateString()}\n\n👇 Please confirm your attendance:\n${rsvpLink}\n\nFrom: ${organizerName}`;

    return this.sendWhatsApp({
      to,
      message,
    });
  }

  /**
   * Email health check
   */
  async emailHealthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    try {
      if (!this.emailTransporter) {
        return {
          healthy: false,
          message: 'Email transporter not initialized',
        };
      }

      // Test SMTP connection
      const isConnected = await new Promise(resolve => {
        this.emailTransporter.verify((error, success) => {
          if (error) {
            resolve(false);
          } else {
            resolve(success);
          }
        });
      });

      if (isConnected) {
        return {
          healthy: true,
          message: 'Email service is operational',
          details: {
            host: config.smtp.host,
            port: config.smtp.port,
            user: config.smtp.user,
          },
        };
      } else {
        return {
          healthy: false,
          message: 'SMTP connection failed',
          details: {
            host: config.smtp.host,
            port: config.smtp.port,
            user: config.smtp.user,
          },
        };
      }
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Email health check failed',
        details: {
          host: config.smtp.host,
          port: config.smtp.port,
          user: config.smtp.user,
        },
      };
    }
  }

  /**
   * Generate invitation email template
   */
  private generateInvitationEmailTemplate(
    eventTitle: string,
    eventDate: Date,
    rsvpLink: string,
    organizerName: string
  ): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Invitation</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 You're Invited!</h1>
                <h2>${eventTitle}</h2>
            </div>
            <div class="content">
                <p>Habari! You have been invited to an exciting event.</p>
                
                <h3>📅 Event Details:</h3>
                <ul>
                    <li><strong>Event:</strong> ${eventTitle}</li>
                    <li><strong>Date:</strong> ${eventDate.toLocaleDateString('en-TZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}</li>
                    <li><strong>Time:</strong> ${eventDate.toLocaleTimeString('en-TZ', {
      hour: '2-digit',
      minute: '2-digit',
    })}</li>
                </ul>

                <p>Please confirm your attendance by clicking the button below:</p>
                
                <a href="${rsvpLink}" class="button">RSVP Now</a>
                
                <p>We look forward to seeing you there!</p>
                
                <p>Best regards,<br>${organizerName}</p>
            </div>
            <div class="footer">
                <p>Tanzania Events Platform | Making your events memorable</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

export default new CommunicationService();
