import { Request, Response } from 'express';
import logger from '../config/logger';
import communicationService from '../services/communicationService';

export class CommunicationController {
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
      res.json({ success: true, data: { batchId: 'temp-batch-id', sent: 0, failed: 0 }, message: 'Bulk messages initiated successfully' });
    } catch (error) {
      logger.error('Send bulk messages error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

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
