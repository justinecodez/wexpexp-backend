import { format } from 'date-fns';

export interface UserData {
  name?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface EventData {
  title: string;
  description?: string;
  date: Date;
  time?: string;
  location?: string;
  organizerName?: string;
  rsvpLink?: string;
  qrCodeUrl?: string;
  eventType?: string;
}

export interface VerificationData {
  code: string;
  expiryMinutes?: number;
  purpose?: string;
}

export interface PaymentData {
  amount: number;
  currency?: string;
  eventTitle?: string;
  transactionId?: string;
  paymentMethod?: string;
}

export interface InvitationData extends EventData {
  inviteeNames?: string[];
  personalMessage?: string;
}

/**
 * SMS Message Templates
 */
export class SMSTemplates {
  
  /**
   * Welcome message for new users
   */
  static welcome(userData: UserData): string {
    const name = userData.firstName || userData.name || 'User';
    return `Karibu ${name}! Welcome to WEXP - your premier event planning platform in Tanzania. Start creating amazing events today! Visit wexp.co.tz`;
  }

  /**
   * Account verification code
   */
  static verification(data: VerificationData): string {
    const expiry = data.expiryMinutes || 10;
    const purpose = data.purpose || 'account verification';
    return `Your WEXP ${purpose} code is: ${data.code}. This code expires in ${expiry} minutes. Do not share this code with anyone.`;
  }

  /**
   * Password reset code
   */
  static passwordReset(data: VerificationData): string {
    const expiry = data.expiryMinutes || 15;
    return `Your WEXP password reset code is: ${data.code}. This code expires in ${expiry} minutes. If you didn't request this, ignore this message.`;
  }

  /**
   * Event invitation via SMS
   */
  static eventInvitation(data: InvitationData): string {
    const dateStr = format(data.date, 'dd/MM/yyyy');
    const timeStr = data.time || format(data.date, 'HH:mm');
    const location = data.location || 'Location TBA';
    
    let message = `🎉 Karibu! You're invited to "${data.title}" on ${dateStr} at ${timeStr}. Location: ${location}`;
    
    if (data.rsvpLink) {
      message += `. RSVP: ${data.rsvpLink}`;
    }
    
    if (data.organizerName) {
      message += ` - ${data.organizerName}`;
    }
    
    return message;
  }

  /**
   * Event reminder (24 hours before)
   */
  static eventReminder24h(data: EventData): string {
    const dateStr = format(data.date, 'dd/MM/yyyy');
    const timeStr = data.time || format(data.date, 'HH:mm');
    
    return `⏰ Reminder: "${data.title}" is tomorrow (${dateStr}) at ${timeStr}. Location: ${data.location || 'TBA'}. See you there!`;
  }

  /**
   * Event reminder (1 hour before)
   */
  static eventReminder1h(data: EventData): string {
    const timeStr = data.time || format(data.date, 'HH:mm');
    
    return `🔔 Final reminder: "${data.title}" starts in 1 hour at ${timeStr}. Location: ${data.location || 'TBA'}. Don't miss it!`;
  }

  /**
   * Event cancellation notification
   */
  static eventCancellation(data: EventData): string {
    return `❌ Event Update: "${data.title}" scheduled for ${format(data.date, 'dd/MM/yyyy')} has been cancelled. ${data.organizerName ? 'Organizer: ' + data.organizerName : ''} Sorry for any inconvenience.`;
  }

  /**
   * Event update notification
   */
  static eventUpdate(data: EventData, changes: string): string {
    return `📝 Event Update: "${data.title}" has been updated. Changes: ${changes}. Check your email or the WEXP app for full details.`;
  }

  /**
   * Payment confirmation
   */
  static paymentConfirmation(data: PaymentData): string {
    const amount = data.currency === 'USD' ? `$${data.amount}` : `TZS ${data.amount.toLocaleString()}`;
    
    return `✅ Payment confirmed! ${amount} received for "${data.eventTitle}". Transaction ID: ${data.transactionId}. Thank you for using WEXP!`;
  }

  /**
   * Payment reminder
   */
  static paymentReminder(data: PaymentData): string {
    const amount = data.currency === 'USD' ? `$${data.amount}` : `TZS ${data.amount.toLocaleString()}`;
    
    return `💳 Payment reminder: ${amount} payment pending for "${data.eventTitle}". Complete payment to secure your booking. Visit wexp.co.tz`;
  }

  /**
   * Ticket delivery notification
   */
  static ticketDelivery(data: EventData & { ticketUrl?: string }): string {
    let message = `🎫 Your ticket for "${data.title}" is ready! `;
    
    if (data.ticketUrl) {
      message += `Download: ${data.ticketUrl}`;
    } else if (data.qrCodeUrl) {
      message += `Show this QR code at the event: ${data.qrCodeUrl}`;
    } else {
      message += 'Check your email for ticket details.';
    }
    
    return message;
  }

  /**
   * RSVP confirmation
   */
  static rsvpConfirmation(data: EventData, status: 'attending' | 'not_attending' | 'maybe'): string {
    const statusEmoji = {
      attending: '✅',
      not_attending: '❌',
      maybe: '🤔'
    };
    
    const statusText = {
      attending: 'confirmed your attendance',
      not_attending: 'declined',
      maybe: 'marked as maybe'
    };
    
    return `${statusEmoji[status]} You have ${statusText[status]} for "${data.title}" on ${format(data.date, 'dd/MM/yyyy')}. Thank you for responding!`;
  }

  /**
   * Event capacity alert
   */
  static eventCapacityAlert(eventTitle: string, spotsLeft: number): string {
    if (spotsLeft <= 5) {
      return `⚠️ Last ${spotsLeft} spots remaining for "${eventTitle}"! Book now to avoid disappointment. Visit wexp.co.tz`;
    } else {
      return `📊 "${eventTitle}" is filling up fast! ${spotsLeft} spots left. Secure your place now at wexp.co.tz`;
    }
  }

  /**
   * Custom message template
   */
  static custom(message: string, data?: Record<string, any>): string {
    if (!data) return message;
    
    // Simple template replacement
    let processedMessage = message;
    Object.keys(data).forEach(key => {
      const value = data[key];
      processedMessage = processedMessage.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    return processedMessage;
  }
}

/**
 * Email Templates (HTML)
 */
export class EmailTemplates {
  
  /**
   * Generate email header HTML
   */
  private static getEmailHeader(title: string): string {
    return `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
      <h1 style="margin: 0; font-size: 28px;">🎉 ${title}</h1>
    </div>`;
  }

  /**
   * Generate email footer HTML
   */
  private static getEmailFooter(): string {
    return `
    <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px; padding: 20px;">
      <p style="margin: 5px 0;">WEXP - Tanzania Events Platform</p>
      <p style="margin: 5px 0;">Making your events memorable</p>
      <p style="margin: 5px 0;">
        <a href="https://wexp.co.tz" style="color: #667eea; text-decoration: none;">Visit wexp.co.tz</a> | 
        <a href="mailto:support@wexp.co.tz" style="color: #667eea; text-decoration: none;">Support</a>
      </p>
    </div>`;
  }

  /**
   * Base email template wrapper
   */
  private static wrapInEmailTemplate(content: string, title: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            .content { padding: 30px; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; text-align: center; }
            .info-box { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .event-details { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; padding: 20px; margin: 20px 0; }
            .event-details h3 { color: #495057; margin-top: 0; }
            .highlight { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 10px; margin: 10px 0; }
            ul { padding-left: 20px; }
            li { margin: 8px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            ${this.getEmailHeader(title)}
            <div class="content">
                ${content}
            </div>
            ${this.getEmailFooter()}
        </div>
    </body>
    </html>`;
  }

  /**
   * Welcome email template
   */
  static welcome(userData: UserData): string {
    const name = userData.firstName || userData.name || 'Friend';
    const content = `
      <h2>Karibu ${name}!</h2>
      <p>Welcome to WEXP, Tanzania's premier event planning and services platform!</p>
      
      <div class="info-box">
        <h3>🎯 What you can do with WEXP:</h3>
        <ul>
          <li>📅 Create and manage events of all sizes</li>
          <li>🎫 Send invitations and track RSVPs</li>
          <li>💳 Handle payments and ticketing</li>
          <li>📊 Get detailed event analytics</li>
          <li>🤝 Connect with local service providers</li>
        </ul>
      </div>
      
      <p>Ready to create your first event? Click the button below to get started!</p>
      
      <a href="https://wexp.co.tz/dashboard" class="button">Start Planning Events</a>
      
      <p>If you have any questions, our support team is here to help at <a href="mailto:support@wexp.co.tz">support@wexp.co.tz</a></p>
      
      <p>Asante sana for joining WEXP!</p>
    `;
    
    return this.wrapInEmailTemplate(content, 'Welcome to WEXP');
  }

  /**
   * Event invitation email template
   */
  static eventInvitation(data: InvitationData): string {
    const dateStr = format(data.date, 'EEEE, MMMM do, yyyy');
    const timeStr = data.time || format(data.date, 'HH:mm');
    
    const content = `
      <h2>You're Invited to ${data.title}!</h2>
      
      ${data.personalMessage ? `<div class="highlight"><p><em>"${data.personalMessage}"</em></p></div>` : ''}
      
      <p>Habari! You have been invited to an exciting event, and we would love to have you join us.</p>
      
      <div class="event-details">
        <h3>📋 Event Details</h3>
        <ul>
          <li><strong>Event:</strong> ${data.title}</li>
          <li><strong>Date:</strong> ${dateStr}</li>
          <li><strong>Time:</strong> ${timeStr}</li>
          <li><strong>Location:</strong> ${data.location || 'Location will be shared soon'}</li>
          ${data.organizerName ? `<li><strong>Organized by:</strong> ${data.organizerName}</li>` : ''}
          ${data.eventType ? `<li><strong>Type:</strong> ${data.eventType}</li>` : ''}
        </ul>
        
        ${data.description ? `<p><strong>About this event:</strong><br>${data.description}</p>` : ''}
      </div>
      
      <p style="text-align: center;">
        <strong>Please confirm your attendance by clicking below:</strong>
      </p>
      
      ${data.rsvpLink ? `<div style="text-align: center;"><a href="${data.rsvpLink}" class="button">RSVP Now</a></div>` : ''}
      
      <p>We're excited to see you there and make this event memorable together!</p>
      
      <p>Best regards,<br>${data.organizerName || 'WEXP Events Team'}</p>
    `;
    
    return this.wrapInEmailTemplate(content, `Invitation: ${data.title}`);
  }

  /**
   * Event reminder email template
   */
  static eventReminder(data: EventData, reminderType: '24h' | '1h'): string {
    const dateStr = format(data.date, 'EEEE, MMMM do, yyyy');
    const timeStr = data.time || format(data.date, 'HH:mm');
    const reminderText = reminderType === '24h' ? 'tomorrow' : 'in 1 hour';
    const urgency = reminderType === '1h' ? 'Final ' : '';
    
    const content = `
      <h2>⏰ ${urgency}Event Reminder</h2>
      
      <p>This is a friendly reminder that you have an upcoming event ${reminderText}!</p>
      
      <div class="event-details">
        <h3>📋 Event Details</h3>
        <ul>
          <li><strong>Event:</strong> ${data.title}</li>
          <li><strong>Date:</strong> ${dateStr}</li>
          <li><strong>Time:</strong> ${timeStr}</li>
          <li><strong>Location:</strong> ${data.location || 'Check your original invitation'}</li>
        </ul>
      </div>
      
      ${data.qrCodeUrl ? `
      <div class="info-box" style="text-align: center;">
        <h3>🎫 Your Ticket QR Code</h3>
        <img src="${data.qrCodeUrl}" alt="Event QR Code" style="max-width: 200px; height: auto;" />
        <p><small>Show this QR code at the event entrance</small></p>
      </div>
      ` : ''}
      
      <div class="highlight">
        <p><strong>📍 Getting there:</strong> Please plan to arrive 15 minutes early to ensure smooth check-in.</p>
      </div>
      
      <p>We're looking forward to seeing you there!</p>
      
      <p>Best regards,<br>${data.organizerName || 'WEXP Events Team'}</p>
    `;
    
    return this.wrapInEmailTemplate(content, `Reminder: ${data.title}`);
  }

  /**
   * Payment confirmation email template
   */
  static paymentConfirmation(data: PaymentData): string {
    const amount = data.currency === 'USD' ? `$${data.amount}` : `TZS ${data.amount.toLocaleString()}`;
    
    const content = `
      <h2>✅ Payment Confirmed!</h2>
      
      <p>Your payment has been successfully processed. Thank you for using WEXP!</p>
      
      <div class="event-details">
        <h3>💳 Payment Details</h3>
        <ul>
          <li><strong>Amount:</strong> ${amount}</li>
          <li><strong>Event:</strong> ${data.eventTitle || 'Event booking'}</li>
          <li><strong>Transaction ID:</strong> ${data.transactionId}</li>
          <li><strong>Payment Method:</strong> ${data.paymentMethod || 'Mobile Money'}</li>
          <li><strong>Date:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</li>
        </ul>
      </div>
      
      <div class="info-box">
        <h3>📋 What's Next?</h3>
        <ul>
          <li>Your booking is now confirmed</li>
          <li>You will receive your ticket shortly</li>
          <li>Event reminders will be sent before the event</li>
        </ul>
      </div>
      
      <p>If you have any questions about your payment or booking, please contact our support team at <a href="mailto:support@wexp.co.tz">support@wexp.co.tz</a></p>
      
      <p>Asante sana for choosing WEXP!</p>
    `;
    
    return this.wrapInEmailTemplate(content, 'Payment Confirmation');
  }
}

/**
 * Utility functions for message formatting
 */
export class MessageUtils {
  
  /**
   * Format phone number for Tanzania
   */
  static formatTanzanianPhone(phone: string): string {
    const cleaned = phone.replace(/[\s-+()]/g, '');
    
    if (cleaned.startsWith('255')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '255' + cleaned.substring(1);
    } else if (cleaned.length === 9 && /^[67]/.test(cleaned)) {
      return '255' + cleaned;
    }
    
    return cleaned; // Return as-is if format is unclear
  }

  /**
   * Truncate SMS message to fit character limits
   */
  static truncateSMS(message: string, maxLength: number = 160): string {
    if (message.length <= maxLength) {
      return message;
    }
    
    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate verification code
   */
  static generateVerificationCode(length: number = 6): string {
    const digits = '0123456789';
    let code = '';
    
    for (let i = 0; i < length; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    
    return code;
  }

  /**
   * Generate unique reference ID
   */
  static generateReference(prefix: string = 'WEXP'): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate Tanzanian phone number
   */
  static isValidTanzanianPhone(phone: string): boolean {
    const cleaned = phone.replace(/[\s-+()]/g, '');
    const patterns = [
      /^255[67]\d{8}$/, // International format
      /^0[67]\d{8}$/,   // Local format
      /^[67]\d{8}$/     // Without country code
    ];
    
    return patterns.some(pattern => pattern.test(cleaned));
  }

  /**
   * Extract template variables from message
   */
  static extractTemplateVariables(template: string): string[] {
    const regex = /{{([^}]+)}}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1]);
    }
    
    return variables;
  }

  /**
   * Replace template variables in message
   */
  static replaceTemplateVariables(template: string, data: Record<string, any>): string {
    let result = template;
    
    Object.keys(data).forEach(key => {
      const value = data[key];
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    });
    
    return result;
  }
}

export default {
  SMS: SMSTemplates,
  Email: EmailTemplates,
  Utils: MessageUtils
};
