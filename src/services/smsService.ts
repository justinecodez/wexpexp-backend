import axios, { AxiosResponse } from 'axios';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler';

export interface SMSServiceConfig {
  username: string;
  password: string;
  apiUrl: string;
  defaultFrom: string;
}

export interface SMSMessage {
  to: string[];
  text: string;
  from?: string;
  reference?: string;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  reference?: string;
  cost?: number;
  error?: string;
  details?: any;
}

export interface SMSBulkResponse {
  totalMessages: number;
  successCount: number;
  failureCount: number;
  results: SMSResponse[];
}

export class SMSService {
  private config: SMSServiceConfig;
  private authToken: string;

  constructor(config: SMSServiceConfig) {
    this.config = config;
    this.authToken = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  }

  /**
   * Send single SMS message
   */
  async sendSMS(message: SMSMessage): Promise<SMSResponse> {
    try {
      const payload = {
        from: message.from || this.config.defaultFrom,
        to: message.to,
        text: message.text,
        reference: message.reference || this.generateReference()
      };

      logger.info('Sending SMS via messaging-service.co.tz:', {
        to: payload.to,
        from: payload.from,
        reference: payload.reference,
        messageLength: payload.text.length
      });

      const response: AxiosResponse = await axios.post(
        this.config.apiUrl,
        payload,
        {
          headers: {
            'Authorization': `Basic ${this.authToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000 // 30 seconds timeout
        }
      );

      logger.info('SMS API Response:', {
        status: response.status,
        data: response.data,
        reference: payload.reference
      });

      // Parse response based on messaging-service.co.tz API format
      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          messageId: response.data.id || response.data.messageId,
          reference: payload.reference,
          cost: response.data.cost,
          details: response.data
        };
      } else {
        return {
          success: false,
          error: `API returned status ${response.status}`,
          details: response.data
        };
      }

    } catch (error) {
      logger.error('SMS sending failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: message.to,
        reference: message.reference,
        stack: error instanceof Error ? error.stack : undefined
      });

      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.message || error.message,
          details: error.response?.data
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error sending SMS'
      };
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSBulkResponse> {
    const results: SMSResponse[] = [];
    let successCount = 0;
    let failureCount = 0;

    logger.info(`Starting bulk SMS send for ${messages.length} messages`);

    for (const message of messages) {
      try {
        const result = await this.sendSMS(message);
        results.push(result);

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Add small delay between requests to avoid rate limiting
        await this.delay(100);
      } catch (error) {
        failureCount++;
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Bulk SMS error'
        });
      }
    }

    const response: SMSBulkResponse = {
      totalMessages: messages.length,
      successCount,
      failureCount,
      results
    };

    logger.info('Bulk SMS completed:', response);

    return response;
  }

  /**
   * Send SMS to single recipient
   */
  async sendToSingle(to: string, text: string, from?: string): Promise<SMSResponse> {
    return this.sendSMS({
      to: [to],
      text,
      from,
      reference: this.generateReference()
    });
  }

  /**
   * Send SMS to multiple recipients
   */
  async sendToMultiple(to: string[], text: string, from?: string): Promise<SMSResponse> {
    return this.sendSMS({
      to,
      text,
      from,
      reference: this.generateReference()
    });
  }

  /**
   * Send notification SMS with predefined templates
   */
  async sendNotification(
    to: string | string[], 
    type: 'welcome' | 'verification' | 'event_reminder' | 'custom', 
    data: any
  ): Promise<SMSResponse> {
    const recipients = Array.isArray(to) ? to : [to];
    let message = '';

    switch (type) {
      case 'welcome':
        message = `Karibu ${data.name}! Welcome to WEXP. Your account has been created successfully. Start planning your events today!`;
        break;
      case 'verification':
        message = `Your WEXP verification code is: ${data.code}. This code expires in 10 minutes. Do not share with anyone.`;
        break;
      case 'event_reminder':
        message = `Reminder: You have an upcoming event "${data.eventTitle}" on ${data.eventDate}. Location: ${data.location || 'TBA'}. See you there!`;
        break;
      case 'custom':
        message = data.message;
        break;
      default:
        throw new AppError('Invalid notification type', 400, 'INVALID_NOTIFICATION_TYPE');
    }

    return this.sendSMS({
      to: recipients,
      text: message,
      reference: `${type}_${Date.now()}`
    });
  }

  /**
   * Validate phone number format (Tanzania)
   */
  validatePhoneNumber(phoneNumber: string): { isValid: boolean; formatted?: string; error?: string } {
    // Remove spaces and dashes
    const cleaned = phoneNumber.replace(/[\s-]/g, '');
    
    // Tanzania phone number patterns
    const patterns = [
      /^255[67]\d{8}$/, // 255XXXXXXXXX (international format)
      /^0[67]\d{8}$/,   // 0XXXXXXXXX (local format)
      /^\+255[67]\d{8}$/ // +255XXXXXXXXX (international with +)
    ];

    for (const pattern of patterns) {
      if (pattern.test(cleaned)) {
        // Convert to international format without +
        let formatted = cleaned;
        if (formatted.startsWith('+255')) {
          formatted = formatted.substring(1);
        } else if (formatted.startsWith('0')) {
          formatted = '255' + formatted.substring(1);
        }
        
        return { isValid: true, formatted };
      }
    }

    return { 
      isValid: false, 
      error: 'Invalid Tanzania phone number format. Use +255XXXXXXXXX or 0XXXXXXXXX' 
    };
  }

  /**
   * Health check for SMS service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    try {
      // Test with a small dry-run request (you might want to implement a ping endpoint)
      const testPayload = {
        from: this.config.defaultFrom,
        to: ['255000000000'], // Test number
        text: 'Health check test',
        reference: 'health_check_' + Date.now()
      };

      const response = await axios.post(
        this.config.apiUrl,
        testPayload,
        {
          headers: {
            'Authorization': `Basic ${this.authToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true // Don't throw on HTTP errors
        }
      );

      // Consider service healthy if we get any response (even error responses indicate the service is reachable)
      if (response.status < 500) {
        return {
          healthy: true,
          message: 'SMS service is operational',
          details: {
            apiUrl: this.config.apiUrl,
            responseStatus: response.status
          }
        };
      } else {
        return {
          healthy: false,
          message: 'SMS service returned server error',
          details: {
            apiUrl: this.config.apiUrl,
            responseStatus: response.status
          }
        };
      }
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'SMS service health check failed',
        details: {
          apiUrl: this.config.apiUrl
        }
      };
    }
  }

  /**
   * Generate unique reference ID
   */
  private generateReference(): string {
    return `wexp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Add delay for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function to create SMS service instance
export function createSMSService(config: SMSServiceConfig): SMSService {
  return new SMSService(config);
}

// Default instance (will be configured from environment variables)
let defaultSMSService: SMSService | null = null;

export function getDefaultSMSService(): SMSService {
  if (!defaultSMSService) {
    throw new AppError('SMS service not initialized', 500, 'SMS_SERVICE_NOT_INITIALIZED');
  }
  return defaultSMSService;
}

export function initializeSMSService(config: SMSServiceConfig): void {
  defaultSMSService = new SMSService(config);
  logger.info('SMS service initialized successfully');
}

export default SMSService;
