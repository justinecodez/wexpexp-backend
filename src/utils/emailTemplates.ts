/**
 * Email templates utility for WEXP application
 * Provides reusable HTML email templates with consistent styling
 */

export interface EmailTemplateData {
    userName?: string;
    eventTitle?: string;
    eventDate?: string;
    eventTime?: string;
    eventLocation?: string;
    eventId?: string;
    resetUrl?: string;
    verificationUrl?: string;
    bookingId?: string;
    vendorName?: string;
    serviceName?: string;
    amount?: string;
    currency?: string;
    [key: string]: any;
}

/**
 * Base email template with WEXP branding
 */
const getBaseTemplate = (title: string, content: string): string => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
                <td style="padding: 20px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background-color: #2c3e50; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">WEXP</h1>
                                <p style="color: #ecf0f1; margin: 5px 0 0 0; font-size: 14px;">Event Planning Made Simple</p>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                ${content}
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #ecf0f1; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px;">
                                <p style="margin: 0; font-size: 12px; color: #7f8c8d;">
                                    This email was sent by WEXP - Ufumbuzi Labs<br>
                                    If you have any questions, please contact our support team.
                                </p>
                                <p style="margin: 10px 0 0 0; font-size: 10px; color: #95a5a6;">
                                    © ${new Date().getFullYear()} WEXP. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
};

/**
 * Button component for emails
 */
const getButton = (url: string, text: string, color: string = '#3498db'): string => {
    return `
    <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" 
           style="background-color: ${color}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
            ${text}
        </a>
    </div>
    `;
};

/**
 * Info box component for emails
 */
const getInfoBox = (content: string, type: 'success' | 'warning' | 'info' = 'info'): string => {
    const colors = {
        success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
        warning: { bg: '#fff3cd', border: '#ffeaa7', text: '#856404' },
        info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' }
    };
    
    const color = colors[type];
    
    return `
    <div style="background-color: ${color.bg}; border: 1px solid ${color.border}; color: ${color.text}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        ${content}
    </div>
    `;
};

/**
 * Welcome email template
 */
export const getWelcomeEmailTemplate = (data: EmailTemplateData): { html: string; subject: string } => {
    const content = `
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Welcome to WEXP!</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #555;">Hello ${data.userName || 'there'},</p>
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Welcome to the WEXP Event Planning Platform! We're thrilled to have you join our community of event enthusiasts and professionals.
        </p>
        
        ${getInfoBox(`
            <strong>🎉 You're all set!</strong> Your account is now active and ready to use.
        `, 'success')}
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">Here's what you can do with WEXP:</p>
        <ul style="font-size: 16px; line-height: 1.8; color: #555; padding-left: 20px;">
            <li><strong>Create Events:</strong> Plan and organize memorable events</li>
            <li><strong>Browse Services:</strong> Find the perfect vendors for your needs</li>
            <li><strong>Manage Bookings:</strong> Keep track of all your event services</li>
            <li><strong>Connect:</strong> Network with other event planners and vendors</li>
        </ul>
        
        ${getButton('${process.env.FRONTEND_URL}/dashboard', 'Get Started', '#e74c3c')}
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            If you have any questions or need assistance, our support team is here to help. Just reply to this email!
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Best regards,<br>
            <strong>The WEXP Team</strong>
        </p>
    `;
    
    return {
        html: getBaseTemplate('Welcome to WEXP', content),
        subject: 'Welcome to WEXP - Let\'s Start Planning Amazing Events! 🎉'
    };
};

/**
 * Password reset email template
 */
export const getPasswordResetTemplate = (data: EmailTemplateData): { html: string; subject: string } => {
    const content = `
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Password Reset Request</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            We received a request to reset the password for your WEXP account.
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Click the button below to create a new password:
        </p>
        
        ${getButton(data.resetUrl || '#', 'Reset Password', '#e74c3c')}
        
        ${getInfoBox(`
            <strong>⏰ Important:</strong> This link will expire in 1 hour for security reasons.
        `, 'warning')}
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #777;">
            For security, if the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${data.resetUrl || '#'}" style="color: #3498db; word-break: break-all;">${data.resetUrl || ''}</a>
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Best regards,<br>
            <strong>The WEXP Security Team</strong>
        </p>
    `;
    
    return {
        html: getBaseTemplate('Password Reset Request', content),
        subject: 'WEXP - Reset Your Password 🔒'
    };
};

/**
 * Event confirmation email template
 */
export const getEventConfirmationTemplate = (data: EmailTemplateData): { html: string; subject: string } => {
    const content = `
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Event Confirmation ✅</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Great news! Your event has been successfully created and confirmed.
        </p>
        
        ${getInfoBox(`
            <strong>🎉 Event Created Successfully!</strong> Your event is now live on the platform.
        `, 'success')}
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #3498db;">
            <h3 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50;">${data.eventTitle || 'Your Event'}</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #555; width: 100px;">📅 Date:</td>
                    <td style="padding: 8px 0; color: #555;">${data.eventDate || 'TBD'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #555;">🕐 Time:</td>
                    <td style="padding: 8px 0; color: #555;">${data.eventTime || 'TBD'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #555;">📍 Location:</td>
                    <td style="padding: 8px 0; color: #555;">${data.eventLocation || 'TBD'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #555;">🆔 Event ID:</td>
                    <td style="padding: 8px 0; color: #555; font-family: monospace;">${data.eventId || 'N/A'}</td>
                </tr>
            </table>
        </div>
        
        ${getButton(`${process.env.FRONTEND_URL}/events/${data.eventId}`, 'View Event Details')}
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Your event is now visible to potential vendors and service providers. You can manage all aspects of your event from your dashboard.
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Thank you for choosing WEXP for your event planning needs!
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Best regards,<br>
            <strong>The WEXP Team</strong>
        </p>
    `;
    
    return {
        html: getBaseTemplate('Event Confirmation', content),
        subject: `Event Confirmed: ${data.eventTitle || 'Your Event'} 🎉`
    };
};

/**
 * Booking confirmation email template
 */
export const getBookingConfirmationTemplate = (data: EmailTemplateData): { html: string; subject: string } => {
    const content = `
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Booking Confirmation 📋</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Your service booking has been confirmed! Here are the details:
        </p>
        
        ${getInfoBox(`
            <strong>✅ Booking Confirmed!</strong> Your service provider will contact you soon.
        `, 'success')}
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #27ae60;">
            <h3 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50;">Booking Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #555; width: 120px;">🔖 Booking ID:</td>
                    <td style="padding: 8px 0; color: #555; font-family: monospace;">${data.bookingId || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #555;">🏢 Vendor:</td>
                    <td style="padding: 8px 0; color: #555;">${data.vendorName || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #555;">🛍️ Service:</td>
                    <td style="padding: 8px 0; color: #555;">${data.serviceName || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #555;">💰 Amount:</td>
                    <td style="padding: 8px 0; color: #555; font-weight: bold;">${data.currency || 'TSH'} ${data.amount || '0'}</td>
                </tr>
            </table>
        </div>
        
        ${getButton(`${process.env.FRONTEND_URL}/bookings/${data.bookingId}`, 'View Booking Details')}
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            What happens next:
        </p>
        <ol style="font-size: 16px; line-height: 1.8; color: #555; padding-left: 20px;">
            <li>The vendor will review your booking request</li>
            <li>You'll receive further communication from the service provider</li>
            <li>Payment and final arrangements will be coordinated directly</li>
        </ol>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Thank you for using WEXP!
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Best regards,<br>
            <strong>The WEXP Team</strong>
        </p>
    `;
    
    return {
        html: getBaseTemplate('Booking Confirmation', content),
        subject: `Booking Confirmed: ${data.serviceName || 'Service'} 📋`
    };
};

/**
 * Email verification template
 */
export const getEmailVerificationTemplate = (data: EmailTemplateData): { html: string; subject: string } => {
    const content = `
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Verify Your Email Address ✉️</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Hello ${data.userName || 'there'},
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Thank you for registering with WEXP! To complete your account setup, please verify your email address by clicking the button below:
        </p>
        
        ${getButton(data.verificationUrl || '#', 'Verify Email Address', '#27ae60')}
        
        ${getInfoBox(`
            <strong>⏰ Important:</strong> This verification link will expire in 24 hours for security reasons.
        `, 'warning')}
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Once your email is verified, you'll be able to:
        </p>
        <ul style="font-size: 16px; line-height: 1.8; color: #555; padding-left: 20px;">
            <li>Access all platform features</li>
            <li>Create and manage events</li>
            <li>Book services from vendors</li>
            <li>Receive important notifications</li>
        </ul>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            If you didn't create an account with us, you can safely ignore this email.
        </p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #777;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${data.verificationUrl || '#'}" style="color: #3498db; word-break: break-all;">${data.verificationUrl || ''}</a>
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Welcome to WEXP!<br>
            <strong>The WEXP Team</strong>
        </p>
    `;
    
    return {
        html: getBaseTemplate('Verify Your Email Address', content),
        subject: 'Welcome to WEXP - Please Verify Your Email 📧'
    };
};

/**
 * Test email template
 */
export const getTestEmailTemplate = (data: EmailTemplateData): { html: string; subject: string } => {
    const content = `
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Email Configuration Test 🧪</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            This is a test email from your WEXP application to verify that your Namecheap Private Email integration is working correctly.
        </p>
        
        ${getInfoBox(`
            <strong>✅ Success!</strong> If you're reading this, your email configuration is working properly!
        `, 'success')}
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #3498db;">
            <h3 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50;">Configuration Details</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="padding: 5px 0; color: #555;">📧 <strong>SMTP Host:</strong> ${data.smtpHost || 'mail.privateemail.com'}</li>
                <li style="padding: 5px 0; color: #555;">🔌 <strong>SMTP Port:</strong> ${data.smtpPort || '465'}</li>
                <li style="padding: 5px 0; color: #555;">🔒 <strong>Connection:</strong> ${data.smtpSecure ? 'SSL' : 'TLS'}</li>
                <li style="padding: 5px 0; color: #555;">📮 <strong>From Email:</strong> ${data.fromEmail || 'N/A'}</li>
                <li style="padding: 5px 0; color: #555;">⏰ <strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
            </ul>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Your Namecheap Private Email service is now fully integrated and ready to send transactional emails for your WEXP application.
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Best regards,<br>
            <strong>The WEXP Development Team</strong>
        </p>
    `;
    
    return {
        html: getBaseTemplate('Email Configuration Test', content),
        subject: 'WEXP - Email Configuration Test ✅'
    };
};
