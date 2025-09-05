import nodemailer from 'nodemailer';
import logger  from '../config/logger';

interface EmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
        filename: string;
        content?: Buffer | string;
        path?: string;
        contentType?: string;
    }>;
}

interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
    enabled: boolean;
    debug: boolean;
}

class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private config: EmailConfig;

    constructor() {
        this.config = {
            host: process.env.SMTP_HOST || 'mail.privateemail.com',
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
            fromEmail: process.env.FROM_EMAIL || '',
            fromName: process.env.FROM_NAME || 'WEXP',
            enabled: process.env.EMAIL_ENABLED !== 'false',
            debug: process.env.EMAIL_DEBUG === 'true'
        };

        this.initializeTransporter();
    }

    private initializeTransporter(): void {
        if (!this.config.enabled) {
            logger.warn('Email service is disabled');
            return;
        }

        if (!this.config.user || !this.config.pass) {
            logger.error('Email configuration is incomplete. SMTP_USER and SMTP_PASS are required.');
            return;
        }

        try {
            // Create transporter using Namecheap Private Email settings
            this.transporter = nodemailer.createTransport({
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure, // true for port 465, false for port 587
                auth: {
                    user: this.config.user, // Full email address
                    pass: this.config.pass  // Email password
                },
                // Additional security settings for better compatibility
                tls: {
                    // Don't fail on invalid certificates
                    rejectUnauthorized: false,
                    // Use modern TLS versions
                    minVersion: 'TLSv1.2'
                },
                // Connection timeout
                connectionTimeout: 60000, // 60 seconds
                greetingTimeout: 30000,   // 30 seconds
                socketTimeout: 60000,     // 60 seconds
                
                // Debug logging
                debug: this.config.debug,
                logger: this.config.debug
            });

            if (this.config.debug) {
                logger.info('Email transporter initialized with configuration:', {
                    host: this.config.host,
                    port: this.config.port,
                    secure: this.config.secure,
                    user: this.config.user
                });
            }

        } catch (error) {
            logger.error('Failed to initialize email transporter:', error);
            this.transporter = null;
        }
    }

    /**
     * Verify the email connection
     */
    async verifyConnection(): Promise<boolean> {
        if (!this.transporter) {
            logger.error('Email transporter not initialized');
            return false;
        }

        try {
            await this.transporter.verify();
            logger.info('Email server connection verified successfully');
            return true;
        } catch (error) {
            logger.error('Email server connection failed:', error);
            return false;
        }
    }

    /**
     * Send an email
     */
    async sendEmail(options: EmailOptions): Promise<boolean> {
        if (!this.config.enabled) {
            logger.warn('Email service is disabled. Email not sent:', options.subject);
            return false;
        }

        if (!this.transporter) {
            logger.error('Email transporter not available');
            return false;
        }

        try {
            const mailOptions = {
                from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
                to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
                attachments: options.attachments
            };

            const info = await this.transporter.sendMail(mailOptions);
            
            logger.info('Email sent successfully:', {
                messageId: info.messageId,
                to: options.to,
                subject: options.subject
            });

            return true;
        } catch (error:any) {
            logger.error('Failed to send email:', {
                error: error.message,
                to: options.to,
                subject: options.subject
            });
            return false;
        }
    }

    /**
     * Send a welcome email
     */
    async sendWelcomeEmail(to: string, userName: string): Promise<boolean> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Welcome to WEXP!</h2>
                <p>Hello ${userName},</p>
                <p>Welcome to the WEXP Event Planning Platform! We're excited to have you join our community.</p>
                <p>You can now:</p>
                <ul>
                    <li>Create and manage events</li>
                    <li>Browse and book services</li>
                    <li>Connect with vendors</li>
                    <li>Plan your perfect event</li>
                </ul>
                <p>If you have any questions, feel free to reach out to our support team.</p>
                <p>Best regards,<br>The WEXP Team</p>
            </div>
        `;

        return this.sendEmail({
            to,
            subject: 'Welcome to WEXP - Let\'s Start Planning!',
            html,
            text: `Welcome to WEXP, ${userName}! We're excited to have you join our event planning platform.`
        });
    }

    /**
     * Send a password reset email
     */
    async sendPasswordResetEmail(to: string, resetToken: string, resetUrl: string): Promise<boolean> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Password Reset Request</h2>
                <p>You requested a password reset for your WEXP account.</p>
                <p>Click the button below to reset your password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" 
                       style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p>If you didn't request this password reset, you can safely ignore this email.</p>
                <p>This link will expire in 1 hour for security reasons.</p>
                <p>Best regards,<br>The WEXP Team</p>
            </div>
        `;

        return this.sendEmail({
            to,
            subject: 'WEXP - Password Reset Request',
            html,
            text: `Password reset requested. Visit: ${resetUrl} (This link expires in 1 hour)`
        });
    }

    /**
     * Send event confirmation email
     */
    async sendEventConfirmationEmail(to: string, eventDetails: any): Promise<boolean> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Event Confirmation</h2>
                <p>Your event has been confirmed!</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">${eventDetails.title}</h3>
                    <p><strong>Date:</strong> ${eventDetails.date}</p>
                    <p><strong>Time:</strong> ${eventDetails.time}</p>
                    <p><strong>Location:</strong> ${eventDetails.location}</p>
                    <p><strong>Event ID:</strong> ${eventDetails.id}</p>
                </div>
                <p>Thank you for choosing WEXP for your event planning needs!</p>
                <p>Best regards,<br>The WEXP Team</p>
            </div>
        `;

        return this.sendEmail({
            to,
            subject: `Event Confirmed: ${eventDetails.title}`,
            html,
            text: `Your event "${eventDetails.title}" has been confirmed for ${eventDetails.date} at ${eventDetails.time}.`
        });
    }

    /**
     * Send email verification email
     */
    async sendEmailVerificationEmail(to: string, userName: string, verificationToken: string): Promise<boolean> {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Verify Your Email Address ✉️</h2>
                <p>Hello ${userName},</p>
                <p>Thank you for registering with WEXP! To complete your account setup, please verify your email address.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" 
                       style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Verify Email Address
                    </a>
                </div>
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 12px; border-radius: 4px; margin: 20px 0;">
                    <strong>⏰ Important:</strong> This verification link will expire in 24 hours for security reasons.
                </div>
                <p>Once your email is verified, you'll be able to access all platform features.</p>
                <p>If you didn't create an account with us, you can safely ignore this email.</p>
                <p>Best regards,<br>The WEXP Team</p>
            </div>
        `;

        return this.sendEmail({
            to,
            subject: 'Welcome to WEXP - Please Verify Your Email 📧',
            html,
            text: `Welcome to WEXP, ${userName}! Please verify your email by visiting: ${verificationUrl} (This link expires in 24 hours)`
        });
    }

    /**
     * Send a test email to verify configuration
     */
    async sendTestEmail(to: string): Promise<boolean> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Email Configuration Test</h2>
                <p>This is a test email from your WEXP application.</p>
                <p>If you're receiving this email, your Namecheap Private Email integration is working correctly!</p>
                <div style="background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 12px; border-radius: 4px; margin: 20px 0;">
                    ✅ Email service is configured and working properly
                </div>
                <p>Configuration details:</p>
                <ul>
                    <li>SMTP Host: ${this.config.host}</li>
                    <li>SMTP Port: ${this.config.port}</li>
                    <li>Secure Connection: ${this.config.secure ? 'SSL' : 'TLS'}</li>
                    <li>From Email: ${this.config.fromEmail}</li>
                </ul>
                <p>Timestamp: ${new Date().toISOString()}</p>
            </div>
        `;

        return this.sendEmail({
            to,
            subject: 'WEXP - Email Configuration Test',
            html,
            text: 'Email configuration test successful! Your Namecheap Private Email integration is working.'
        });
    }
}

// Export a singleton instance
export const emailService = new EmailService();
export { EmailOptions, EmailService };
