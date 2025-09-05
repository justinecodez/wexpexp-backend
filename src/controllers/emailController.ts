import { Request, Response } from 'express';
import { emailService } from '../services/emailService';
import { 
    getWelcomeEmailTemplate, 
    getPasswordResetTemplate, 
    getEventConfirmationTemplate, 
    getBookingConfirmationTemplate,
    getTestEmailTemplate,
    EmailTemplateData
} from '../utils/emailTemplates';
import { logger } from '../config/logger';

/**
 * Test email configuration by sending a test email
 */
export const testEmailConfiguration = async (req: Request, res: Response): Promise<void> => {
    try {
        const { to } = req.body;
        
        if (!to || !to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            res.status(400).json({
                success: false,
                message: 'Valid email address is required'
            });
            return;
        }

        // First verify the connection
        const connectionVerified = await emailService.verifyConnection();
        if (!connectionVerified) {
            res.status(500).json({
                success: false,
                message: 'Email service connection failed. Please check your configuration.'
            });
            return;
        }

        // Send test email
        const templateData: EmailTemplateData = {
            smtpHost: process.env.SMTP_HOST || 'mail.privateemail.com',
            smtpPort: process.env.SMTP_PORT || '465',
            smtpSecure: process.env.SMTP_SECURE === 'true',
            fromEmail: process.env.FROM_EMAIL || ''
        };

        const { html, subject } = getTestEmailTemplate(templateData);
        const success = await emailService.sendEmail({
            to,
            subject,
            html,
            text: 'Email configuration test successful! Your Namecheap Private Email integration is working.'
        });

        if (success) {
            logger.info('Test email sent successfully', { to });
            res.status(200).json({
                success: true,
                message: 'Test email sent successfully! Check your inbox.'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send test email. Please check logs for details.'
            });
        }

    } catch (error) {
        logger.error('Error in testEmailConfiguration:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Send welcome email to new user
 */
export const sendWelcomeEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const { to, userName } = req.body;
        
        if (!to || !userName) {
            res.status(400).json({
                success: false,
                message: 'Email address and user name are required'
            });
            return;
        }

        const { html, subject } = getWelcomeEmailTemplate({ userName });
        const success = await emailService.sendEmail({
            to,
            subject,
            html,
            text: `Welcome to WEXP, ${userName}! We're excited to have you join our event planning platform.`
        });

        if (success) {
            res.status(200).json({
                success: true,
                message: 'Welcome email sent successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send welcome email'
            });
        }

    } catch (error) {
        logger.error('Error in sendWelcomeEmail:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Verify email service connection
 */
export const verifyEmailConnection = async (req: Request, res: Response): Promise<void> => {
    try {
        const isConnected = await emailService.verifyConnection();
        
        if (isConnected) {
            res.status(200).json({
                success: true,
                message: 'Email service connection verified successfully',
                configuration: {
                    host: process.env.SMTP_HOST || 'mail.privateemail.com',
                    port: process.env.SMTP_PORT || '465',
                    secure: process.env.SMTP_SECURE === 'true',
                    user: process.env.SMTP_USER || '',
                    enabled: process.env.EMAIL_ENABLED !== 'false'
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Email service connection failed',
                configuration: {
                    host: process.env.SMTP_HOST || 'mail.privateemail.com',
                    port: process.env.SMTP_PORT || '465',
                    secure: process.env.SMTP_SECURE === 'true',
                    enabled: process.env.EMAIL_ENABLED !== 'false',
                    error: 'Connection verification failed'
                }
            });
        }

    } catch (error) {
        logger.error('Error in verifyEmailConnection:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get email service status
 */
export const getEmailServiceStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const isEnabled = process.env.EMAIL_ENABLED !== 'false';
        const hasCredentials = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
        
        res.status(200).json({
            success: true,
            status: {
                enabled: isEnabled,
                configured: hasCredentials,
                host: process.env.SMTP_HOST || 'mail.privateemail.com',
                port: process.env.SMTP_PORT || '465',
                secure: process.env.SMTP_SECURE === 'true',
                fromEmail: process.env.FROM_EMAIL || '',
                fromName: process.env.FROM_NAME || 'WEXP',
                debugMode: process.env.EMAIL_DEBUG === 'true'
            }
        });

    } catch (error) {
        logger.error('Error in getEmailServiceStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
