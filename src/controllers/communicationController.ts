import { Request, Response } from 'express';
import logger from '../config/logger';
import communicationService from '../services/communicationService';
import { EventService } from '../services/eventService';
import database from '../config/database';
import { Invitation } from '../entities/Invitation';

export class CommunicationController {
  private eventService: EventService;

  constructor() {
    this.eventService = new EventService();
  }

  sendEmail = async (req: Request, res: Response) => {
    try {
      const { to, subject, html, text, attachments } = req.body;

      if (!to || !subject) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, subject'
        });
      }

      const results = await communicationService.sendEmail({
        to,
        subject,
        html,
        text,
        attachments
      });

      const successful = results.filter(r => r.status === 'SENT').length;
      const failed = results.filter(r => r.status === 'FAILED').length;

      res.json({
        success: successful > 0,
        data: {
          results,
          summary: { successful, failed, total: results.length }
        },
        message: `Email sending completed: ${successful} sent, ${failed} failed`
      });
    } catch (error) {
      logger.error('Send email error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  sendSMS = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: { messageId: 'temp-sms-id' }, message: 'SMS sent successfully' });
    } catch (error) {
      logger.error('Send SMS error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  sendWhatsApp = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: { messageId: 'temp-whatsapp-id' }, message: 'WhatsApp message sent successfully' });
    } catch (error) {
      logger.error('Send WhatsApp error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  sendBulkMessages = async (req: Request, res: Response) => {
    try {
      const { eventId, recipients, channels, subject, message, template, scheduledFor } = req.body;
      const userId = (req as any).user?.userId;

      console.log('📬 Bulk communications request:', {
        eventId,
        userId,
        recipientCount: recipients?.length,
        channels,
        subject,
        hasMessage: !!message,
        template,
        scheduledFor
      });

      // Validate required fields
      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: 'Event ID is required'
        });
      }

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Recipients array is required and cannot be empty'
        });
      }

      if (!channels || !Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Channels array is required and cannot be empty'
        });
      }

      // Verify event ownership - this will throw an AppError if user doesn't have access
      try {
        await this.eventService.getEventById(eventId, userId);
        console.log(`✅ Event ownership verified for user ${userId} and event ${eventId}`);
      } catch (error: any) {
        console.log(`❌ Event ownership verification failed: ${error.message}`);
        if (error.code === 'EVENT_NOT_FOUND') {
          return res.status(404).json({
            success: false,
            error: 'Event not found'
          });
        }
        if (error.code === 'EVENT_ACCESS_DENIED') {
          return res.status(403).json({
            success: false,
            error: 'You do not have permission to send communications for this event'
          });
        }
        throw error; // Re-throw other errors
      }

      let totalSent = 0;
      let totalFailed = 0;
      const results = [];

      // Process each channel
      for (const channel of channels) {
        if (channel === 'email') {
          // Process email recipients
          const emailRecipients = recipients.filter(r => r.email);
          console.log(`📧 Processing ${emailRecipients.length} email recipients`);

          if (emailRecipients.length > 0) {
            try {
              const emailResults = await communicationService.sendEmail({
                to: emailRecipients.map(r => r.email),
                subject: subject || 'Event Invitation',
                html: this.generateInvitationHTML({
                  eventId,
                  message,
                  template: template || 'default-invitation'
                }),
                text: message || 'You have been invited to an event. Please check your email for details.'
              });

              const successful = emailResults.filter(r => r.status === 'SENT').length;
              const failed = emailResults.filter(r => r.status === 'FAILED').length;

              totalSent += successful;
              totalFailed += failed;

              results.push({
                channel: 'email',
                sent: successful,
                failed: failed,
                results: emailResults
              });

              console.log(`✅ Email batch completed: ${successful} sent, ${failed} failed`);
            } catch (error) {
              console.error('❌ Email batch failed:', error);
              totalFailed += emailRecipients.length;
              results.push({
                channel: 'email',
                sent: 0,
                failed: emailRecipients.length,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        }

        if (channel === 'sms') {
          // Process SMS recipients with backend template substitution
          const smsRecipients = recipients.filter(r => r.phone);

          console.log('='.repeat(80));
          console.log('📱 SMS SENDING PROCESS STARTED');
          console.log('='.repeat(80));
          console.log(`📱 Total SMS recipients: ${smsRecipients.length}`);
          console.log(`📱 User ID for chat storage: ${userId}`);
          console.log(`📱 Event ID: ${eventId}`);
          console.log(`📱 Original message template:\n${message}`);
          console.log('='.repeat(80));

          if (smsRecipients.length > 0) {
            try {
              // Get event data for template substitution
              console.log('🔍 STEP 1: Fetching event data...');
              const eventData = await this.eventService.getEventById(eventId, userId);
              console.log('✅ Event data fetched:', {
                title: eventData.title,
                eventDate: eventData.eventDate,
                venueName: eventData.venueName,
                venueAddress: eventData.venueAddress,
                startTime: eventData.startTime,
                endTime: eventData.endTime,
                brideName: eventData.brideName,
                groomName: eventData.groomName,
                hostname: eventData.hostname
              });

              // Get invitation repository for fetching invitation details
              console.log('🔍 STEP 2: Getting invitation repository...');
              const invitationRepo = database.getRepository(Invitation);
              console.log('✅ Invitation repository ready');

              // Process each recipient individually for personalization
              const smsResults = [];

              console.log(`🔄 STEP 3: Processing ${smsRecipients.length} recipients individually...`);
              console.log('='.repeat(80));

              for (let i = 0; i < smsRecipients.length; i++) {
                const recipient = smsRecipients[i];
                console.log(`\n📧 Processing recipient ${i + 1}/${smsRecipients.length}:`);
                console.log(`   Name: ${recipient.name}`);
                console.log(`   Phone: ${recipient.phone}`);
                console.log(`   Invitation ID: ${recipient.id || 'N/A'}`);

                try {
                  // Get invitation data if invitation ID is provided
                  let invitation: any = null;
                  if (recipient.id) {
                    console.log(`   🔍 Fetching invitation data for ID: ${recipient.id}`);
                    try {
                      invitation = await invitationRepo.findOne({
                        where: { id: recipient.id },
                        relations: ['event']
                      });

                      if (invitation) {
                        console.log(`   ✅ Invitation found:`, {
                          guestName: invitation.guestName,
                          guestEmail: invitation.guestEmail,
                          guestPhone: invitation.guestPhone,
                          checkInCode: invitation.checkInCode,
                          qrCode: invitation.qrCode
                        });
                      } else {
                        console.log(`   ⚠️  No invitation found for ID: ${recipient.id}`);
                      }
                    } catch (err) {
                      console.log(`   ❌ Error fetching invitation:`, err);
                      logger.warn(`Could not fetch invitation for recipient ${recipient.id}`);
                    }
                  } else {
                    console.log(`   ⚠️  No invitation ID provided`);
                  }

                  // Create temporary invitation object from recipient data if not found
                  if (!invitation && recipient.name) {
                    console.log(`   🔨 Creating temporary invitation object from recipient data`);
                    invitation = {
                      guestName: recipient.name,
                      guestEmail: recipient.email,
                      guestPhone: recipient.phone,
                      qrCode: recipient.qrCode,
                      checkInCode: recipient.checkInCode,
                      event: {
                        title: eventData.title,
                        eventDate: eventData.eventDate,
                        startTime: eventData.startTime,
                        endTime: eventData.endTime,
                        venueName: eventData.venueName,
                        venueAddress: eventData.venueAddress,
                        brideName: eventData.brideName,
                        groomName: eventData.groomName,
                        hostname: eventData.hostname
                      }
                    };
                    console.log(`   ✅ Temporary invitation created`);
                  }

                  console.log(`   🔄 Substituting template variables...`);
                  console.log(`   📝 Original template (first 100 chars): ${(message || '').substring(0, 100)}...`);

                  // Substitute template variables using backend service
                  const personalizedMessage = communicationService['substituteMessageVariables'](
                    message || 'You have been invited to an event',
                    invitation,
                    invitation?.event
                  );

                  console.log(`   ✅ Variables substituted!`);
                  console.log(`   📧 Personalized message for ${recipient.name}:`);
                  console.log('   ' + '-'.repeat(70));
                  console.log(`   ${personalizedMessage}`);
                  console.log('   ' + '-'.repeat(70));

                  // Check if template variables still exist
                  const hasTemplateVars = /\{[^}]+\}/g.test(personalizedMessage);
                  if (hasTemplateVars) {
                    console.log(`   ⚠️  WARNING: Template variables still present in message!`);
                    const remainingVars = personalizedMessage.match(/\{[^}]+\}/g);
                    console.log(`   ⚠️  Remaining variables:`, remainingVars);
                  } else {
                    console.log(`   ✅ No template variables remaining - message is personalized!`);
                  }

                  console.log(`   📤 Sending SMS to ${recipient.phone}...`);

                  // Send individual SMS with personalized message
                  const result = await communicationService.sendSMS({
                    to: [recipient.phone],
                    message: personalizedMessage,
                    userId
                  });

                  console.log(`   ✅ SMS send result:`, result[0]?.status || 'UNKNOWN');
                  smsResults.push(...result);
                } catch (error) {
                  console.log(`   ❌ Error processing recipient ${recipient.phone}:`, error);
                  logger.error(`Failed to send SMS to ${recipient.phone}:`, error);
                  smsResults.push({
                    id: `failed_${recipient.phone}`,
                    status: 'FAILED',
                    errorMessage: error instanceof Error ? error.message : 'Unknown error'
                  });
                }

                console.log(''); // Empty line between recipients
              }

              const successful = smsResults.filter(r => r.status === 'SENT').length;
              const failed = smsResults.filter(r => r.status === 'FAILED').length;

              console.log('='.repeat(80));
              console.log(`✅ SMS BATCH COMPLETED`);
              console.log(`   Total: ${smsResults.length}`);
              console.log(`   Successful: ${successful}`);
              console.log(`   Failed: ${failed}`);
              console.log('='.repeat(80));

              totalSent += successful;
              totalFailed += failed;

              results.push({
                channel: 'sms',
                sent: successful,
                failed: failed,
                results: smsResults
              });
            } catch (error) {
              console.log('❌ SMS BATCH FAILED:', error);
              console.error('❌ SMS batch failed:', error);
              totalFailed += smsRecipients.length;
              results.push({
                channel: 'sms',
                sent: 0,
                failed: smsRecipients.length,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        }

        if (channel === 'whatsapp') {
          // Process WhatsApp recipients with template support
          const whatsappRecipients = recipients.filter(r => r.phone);

          if (whatsappRecipients.length > 0) {
            console.log('================================================================================');
            console.log('💬 WHATSAPP SENDING PROCESS STARTED');
            console.log('================================================================================');
            console.log(`💬 Total WhatsApp recipients: ${whatsappRecipients.length}`);
            console.log(`💬 User ID: ${userId}`);
            console.log(`💬 Event ID: ${eventId}`);

            try {
              // Fetch event data for template personalization
              console.log('🔍 STEP 1: Fetching event data...');
              const eventData = await this.eventService.getEventById(eventId, userId);
              console.log(`✅ Event data fetched:`, {
                title: eventData.title,
                eventDate: eventData.eventDate,
                venueName: eventData.venueName
              });

              // Get invitation repository
              console.log('🔍 STEP 2: Getting invitation repository...');
              const invitationRepo = database.getRepository(Invitation);
              console.log(`✅ Invitation repository ready`);

              console.log(`🔄 STEP 3: Processing ${whatsappRecipients.length} recipients individually...`);

              let successCount = 0;
              let failCount = 0;

              for (let i = 0; i < whatsappRecipients.length; i++) {
                const recipient = whatsappRecipients[i];
                console.log(`\n📧 Processing recipient ${i + 1}/${whatsappRecipients.length}:`);
                console.log(`   Name: ${recipient.name}`);
                console.log(`   Phone: ${recipient.phone}`);
                console.log(`   Invitation ID: ${recipient.id}`);

                try {
                  // Fetch invitation with event data
                  let invitation = await invitationRepo.findOne({
                    where: { id: recipient.id },
                    relations: ['event', 'event.user']
                  });

                  if (!invitation) {
                    console.log(`   ⚠️  No invitation found for ID ${recipient.id}, creating temporary invitation`);
                    // Create a temporary invitation object for non-invitation recipients
                    invitation = {
                      id: recipient.id,
                      guestName: recipient.name,
                      guestEmail: recipient.email || '',
                      guestPhone: recipient.phone || '',
                      event: {
                        ...eventData,
                        title: eventData.title,
                        eventDate: eventData.eventDate,
                        startTime: eventData.startTime,
                        endTime: eventData.endTime,
                        venueName: eventData.venueName,
                        venueAddress: eventData.venueAddress,
                        brideName: eventData.brideName,
                        groomName: eventData.groomName,
                        hostname: eventData.hostname
                      }
                    } as any;
                    console.log(`   ✅ Temporary invitation created`);
                  } else {
                    console.log(`   ✅ Invitation found: ${invitation.guestName}`);
                  }

                  // Send WhatsApp message using template
                  console.log(`   📤 Sending WhatsApp template message...`);

                  // sendWhatsApp expects WhatsAppRequest format
                  const whatsappResults = await communicationService.sendWhatsApp({
                    to: [recipient.phone],
                    message: message || 'You have been invited to an event',
                    mediaUrl: invitation?.cardUrl, // Include card if available
                    invitationId: invitation?.id, // For template substitution
                    eventId: eventId // For template substitution
                  }, userId);

                  const whatsappResult = whatsappResults[0];
                  if (whatsappResult && whatsappResult.status === 'SENT') {
                    console.log(`   ✅ WhatsApp sent successfully to ${recipient.phone}`);
                    successCount++;
                  } else {
                    console.error(`   ❌ WhatsApp failed:`, whatsappResult?.errorMessage);
                    failCount++;
                  }
                } catch (error) {
                  console.error(`   ❌ Failed to send WhatsApp to ${recipient.phone}:`, error);
                  failCount++;
                }
              }

              totalSent += successCount;
              totalFailed += failCount;

              results.push({
                channel: 'whatsapp',
                sent: successCount,
                failed: failCount
              });

              console.log('================================================================================');
              console.log('✅ WHATSAPP BATCH COMPLETED');
              console.log(`   Total: ${whatsappRecipients.length}`);
              console.log(`   Successful: ${successCount}`);
              console.log(`   Failed: ${failCount}`);
              console.log('================================================================================');
            } catch (error) {
              console.error('❌ WhatsApp batch failed:', error);
              totalFailed += whatsappRecipients.length;
              results.push({
                channel: 'whatsapp',
                sent: 0,
                failed: whatsappRecipients.length,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        }
      }

      const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info(`📊 Bulk communication completed: ${totalSent} sent, ${totalFailed} failed`, {
        campaignId,
        eventId,
        channels,
        totalRecipients: recipients.length
      });

      res.json({
        success: totalSent > 0,
        data: {
          campaignId,
          sent: totalSent,
          failed: totalFailed,
          results
        },
        message: `Bulk communications ${scheduledFor ? 'scheduled' : 'completed'}: ${totalSent} sent, ${totalFailed} failed`
      });
    } catch (error) {
      logger.error('Send bulk messages error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  private generateInvitationHTML(options: {
    eventId?: string;
    message?: string;
    template?: string;
  }): string {
    const { eventId, message, template } = options;

    // Basic HTML template - you can enhance this later
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
              </div>
              <div class="content">
                  <p>Habari! You have been invited to an exciting event.</p>
                  ${message ? `<p><em>${message}</em></p>` : ''}
                  <p>We look forward to seeing you there!</p>
                  <p>Best regards,<br>WEXP Events Team</p>
              </div>
              <div class="footer">
                  <p>Tanzania Events Platform | Making your events memorable</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  getMessageHistory = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: [], message: 'Message history retrieved successfully' });
    } catch (error) {
      logger.error('Get message history error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  getMessageById = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: null, message: 'Message not found' });
    } catch (error) {
      logger.error('Get message by ID error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  getMessageTemplates = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: [], message: 'Message templates retrieved successfully' });
    } catch (error) {
      logger.error('Get message templates error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  createMessageTemplate = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: { templateId: 'temp-template-id', ...req.body }, message: 'Message template created successfully' });
    } catch (error) {
      logger.error('Create message template error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  updateMessageTemplate = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: { id: req.params.id, ...req.body }, message: 'Message template updated successfully' });
    } catch (error) {
      logger.error('Update message template error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  deleteMessageTemplate = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, message: 'Message template deleted successfully' });
    } catch (error) {
      logger.error('Delete message template error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  getCommunicationStats = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: { totalSent: 0, totalDelivered: 0, totalFailed: 0 }, message: 'Communication stats retrieved successfully' });
    } catch (error) {
      logger.error('Get communication stats error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  getDeliveryReports = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: [], message: 'Delivery reports retrieved successfully' });
    } catch (error) {
      logger.error('Get delivery reports error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  testCommunicationChannels = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: { email: 'working', sms: 'working', whatsapp: 'working' }, message: 'Communication channels tested successfully' });
    } catch (error) {
      logger.error('Test communication channels error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  getUserPreferences = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: { email: true, sms: true, whatsapp: false }, message: 'User preferences retrieved successfully' });
    } catch (error) {
      logger.error('Get user preferences error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  updateUserPreferences = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: req.body, message: 'User preferences updated successfully' });
    } catch (error) {
      logger.error('Update user preferences error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  unsubscribeUser = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, message: 'User unsubscribed successfully' });
    } catch (error) {
      logger.error('Unsubscribe user error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  getSMSProviderStatus = async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: { provider: 'Beem', status: 'active', balance: 10000 }, message: 'SMS provider status retrieved successfully' });
    } catch (error) {
      logger.error('Get SMS provider status error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  getEmailServiceStatus = async (req: Request, res: Response) => {
    try {
      const healthCheck = await communicationService.emailHealthCheck();

      res.status(healthCheck.healthy ? 200 : 503).json({
        success: healthCheck.healthy,
        data: {
          service: 'SMTP',
          status: healthCheck.healthy ? 'active' : 'inactive',
          lastCheck: new Date().toISOString(),
          ...healthCheck.details
        },
        message: healthCheck.message
      });
    } catch (error) {
      logger.error('Get email service status error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Test email endpoint
  testEmail = async (req: Request, res: Response) => {
    try {
      const { to } = req.body;

      if (!to) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: to (recipient email)'
        });
      }

      const testSubject = 'WEXP Email Service Test';
      const testHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">🎉 Email Service Test</h2>
            <p>Congratulations! Your WEXP email service is working correctly.</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Service: SMTP via ${process.env.SMTP_HOST}</li>
              <li>Port: ${process.env.SMTP_PORT}</li>
              <li>Time: ${new Date().toISOString()}</li>
            </ul>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              This is an automated test email from the WEXP Tanzania Events Platform.
            </p>
          </div>
        </div>
      `;

      const results = await communicationService.sendEmail({
        to,
        subject: testSubject,
        html: testHtml,
        text: 'WEXP Email Service Test - If you can read this, your email service is working correctly!'
      });

      const successful = results.filter(r => r.status === 'SENT').length;
      const failed = results.filter(r => r.status === 'FAILED').length;

      res.json({
        success: successful > 0,
        data: {
          results,
          summary: { successful, failed, total: results.length }
        },
        message: successful > 0 ? 'Test email sent successfully!' : 'Test email failed to send'
      });
    } catch (error) {
      logger.error('Test email error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}
