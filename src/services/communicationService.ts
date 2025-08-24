import nodemailer from 'nodemailer';
import database from '../config/database';
import { MessageLog } from '../entities/MessageLog';
import { InvitationMethod, DeliveryStatus } from '../entities/enums';
import { Repository } from 'typeorm';
import config from '../config';
import { AppError } from '../middleware/errorHandler';

import { EmailRequest, SMSRequest, WhatsAppRequest, MessageResponse } from '../types';
import logger from '../config/logger';

export class CommunicationService {
  private emailTransporter!: nodemailer.Transporter;
  private messageLogRepository: Repository<MessageLog>;

  constructor() {
    this.messageLogRepository = database.getRepository(MessageLog) as Repository<MessageLog>;
    this.setupEmailTransporter();
  }

  /**
   * Setup email transporter
   */
  private setupEmailTransporter(): void {
    try {
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
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000, // 5 seconds
        socketTimeout: 30000, // 30 seconds
      });

      // Verify connection (but don't block app startup)
      this.emailTransporter.verify((error, success) => {
        if (error) {
          logger.error('Email transporter verification failed:', {
            message: error.message,
            host: config.smtp.host,
            port: config.smtp.port,
            user: config.smtp.user,
          });
        } else {
          logger.info('Email transporter is ready');
        }
      });
    } catch (error) {
      logger.error('Failed to setup email transporter:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        host: config.smtp.host,
        port: config.smtp.port,
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

    for (const recipient of recipients) {
      try {
        // Use phone number as provided (no validation)
        const formattedPhone = recipient.trim();
        let response;

        // Choose SMS provider based on configuration
        if (config.sms.provider === 'beem') {
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

        logger.info(`SMS ${response.success ? 'sent' : 'failed'} to ${formattedPhone}`);
      } catch (error) {
        // Log failed message
        const messageLog = await this.messageLogRepository.save(
          this.messageLogRepository.create({
            recipientType: 'phone',
            recipient,
            method: InvitationMethod.SMS,
            content: smsData.message,
            status: DeliveryStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
        );

        results.push({
          id: messageLog.id,
          status: DeliveryStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        logger.error(`Failed to send SMS to ${recipient}:`, error);
      }
    }

    return results;
  }

  /**
   * Send WhatsApp message
   */
  async sendWhatsApp(whatsappData: WhatsAppRequest): Promise<MessageResponse[]> {
    const recipients = Array.isArray(whatsappData.to) ? whatsappData.to : [whatsappData.to];
    const results: MessageResponse[] = [];

    for (const recipient of recipients) {
      try {
        // Use phone number as provided (no validation)
        const formattedPhone = recipient.trim().replace('+', ''); // Remove + for WhatsApp API
        const response = await this.sendWhatsAppMessage(formattedPhone, whatsappData);

        // Log message
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
  ): Promise<{ success: boolean; error?: string; metadata?: any }> {
    try {
      if (!config.whatsapp.token || !config.whatsapp.phoneId) {
        throw new Error('WhatsApp Business API credentials not configured');
      }

      // Note: This is a mock implementation
      // In production, you would integrate with actual WhatsApp Business API
      const mockResponse = {
        success: true,
        messageId: `wa_${Date.now()}`,
        status: 'sent',
      };

      logger.info(`Mock WhatsApp sent to ${phone}: ${data.message}`);

      return {
        success: true,
        metadata: mockResponse,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp API error',
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
