import axios from 'axios';
import logger from '../config/logger';
import config from '../config';
import FormData from 'form-data';
import { Readable } from 'stream';
import conversationService from './conversationService';
import { MessageStatus } from '../entities/Message';

interface WhatsAppMessage {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: {
        body: string;
    };
}

interface WhatsAppStatus {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp?: string;
    recipient_id: string;
    errors?: Array<{
        code: number;
        title: string;
        message: string;
        error_data?: {
            details?: string;
        };
    }>;
}

export class WhatsAppService {
    private readonly apiUrl: string;
    private readonly phoneNumberId: string;
    private readonly accessToken: string;

    constructor() {
        this.apiUrl = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v18.0'}`;
        this.phoneNumberId = config.whatsapp.phoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
        this.accessToken = config.whatsapp.token || process.env.WHATSAPP_ACCESS_TOKEN || '';

        logger.info('WhatsAppService initialized', {
            apiUrl: this.apiUrl,
            phoneNumberId: this.phoneNumberId ? '***' + this.phoneNumberId.slice(-4) : 'MISSING',
            accessToken: this.accessToken ? '***' + this.accessToken.slice(-4) : 'MISSING',
        });
    }

    /**
     * Process incoming webhook changes from WhatsApp
     */
    async processWebhookChange(change: any): Promise<void> {
        try {
            const value = change.value;

            // Extract contact information from webhook
            const contactsMap = new Map<string, string>();
            if (value.contacts && Array.isArray(value.contacts)) {
                logger.info(`📇 Processing ${value.contacts.length} contact(s) from webhook`);
                for (const contact of value.contacts) {
                    if (contact.wa_id && contact.profile?.name) {
                        contactsMap.set(contact.wa_id, contact.profile.name);
                        logger.info(`📇 Contact info extracted: ${contact.wa_id} -> "${contact.profile.name}"`);
                    } else {
                        logger.debug(`Contact missing info:`, {
                            wa_id: contact.wa_id,
                            hasProfile: !!contact.profile,
                            profileName: contact.profile?.name,
                        });
                    }
                }
            } else {
                logger.debug('No contacts array in webhook value');
            }

            // Handle incoming messages
            if (value.messages && value.messages.length > 0) {
                for (const message of value.messages) {
                    // Get contact name if available
                    const contactName = contactsMap.get(message.from) || undefined;
                    logger.info(`📨 Processing message from ${message.from}, contactName: ${contactName || 'not found in contacts map'}`);
                    await this.handleIncomingMessage(message, contactName);
                }
            }

            // Handle message status updates
            if (value.statuses && value.statuses.length > 0) {
                for (const status of value.statuses) {
                    await this.handleMessageStatus(status);
                }
            }
        } catch (error) {
            logger.error('Error processing WhatsApp webhook change:', error);
        }
    }

    /**
     * Handle incoming messages from users
     */
    private async handleIncomingMessage(message: WhatsAppMessage, contactName?: string): Promise<void> {
        logger.info('💬 Received WhatsApp Incoming Message', {
            from: message.from,
            contactName: contactName || 'Unknown',
            type: message.type,
            messageId: message.id,
            timestamp: message.timestamp,
            fullMessage: JSON.stringify(message, null, 2),
        });

        try {
            // Store message in database
            if (message.type === 'text' && message.text) {
                const storedMessage = await conversationService.storeIncomingMessage(
                    message.from,
                    message.id,
                    message.text.body,
                    'text',
                    {
                        timestamp: message.timestamp,
                        from: message.from,
                    },
                    contactName
                );
                logger.info(`✅ Successfully stored incoming text message: ${storedMessage.id}`);
            } else {
                // Handle other message types (image, audio, etc.)
                const content = `[${message.type} message]`;
                const storedMessage = await conversationService.storeIncomingMessage(
                    message.from,
                    message.id,
                    content,
                    message.type,
                    {
                        timestamp: message.timestamp,
                        from: message.from,
                        type: message.type,
                    },
                    contactName
                );
                logger.info(`✅ Successfully stored incoming ${message.type} message: ${storedMessage.id}`);
            }

            // Optional: Auto-reply logic (can be disabled)
        if (message.type === 'text' && message.text) {
            const messageText = message.text.body.toLowerCase();
                const fullText = message.text.body;

                logger.info('📝 Processing text message', {
                    from: message.from,
                    messageText: fullText,
                    messageLength: fullText.length,
                });

                // Simple RSVP handling (optional - can be removed if you want manual replies only)
            if (messageText.includes('yes') || messageText.includes('confirm')) {
                    logger.info('✅ RSVP confirmation detected, sending auto-reply');
                await this.sendTextMessage(
                    message.from,
                    'Thank you for confirming! We look forward to seeing you at the event. 🎉'
                );
            } else if (messageText.includes('no') || messageText.includes('decline')) {
                    logger.info('❌ RSVP decline detected, sending auto-reply');
                await this.sendTextMessage(
                    message.from,
                    'Thank you for letting us know. We hope to see you at future events!'
                );
            }
            }
        } catch (error) {
            logger.error('Error handling incoming message:', error);
            // Don't throw - we still want to log the message even if storage fails
        }
    }

    /**
     * Handle message delivery status updates
     */
    private async handleMessageStatus(status: WhatsAppStatus): Promise<void> {
        logger.info('📊 WhatsApp Message Status Update', {
            messageId: status.id,
            status: status.status,
            recipient: status.recipient_id,
            timestamp: status.timestamp,
            fullStatus: JSON.stringify(status, null, 2),
        });

        try {
            // Map WhatsApp status to our MessageStatus enum
            let messageStatus: MessageStatus;
            switch (status.status) {
                case 'sent':
                    messageStatus = MessageStatus.SENT;
                    logger.info('✅ Message sent to WhatsApp servers', { messageId: status.id });
                    break;
                case 'delivered':
                    messageStatus = MessageStatus.DELIVERED;
                    logger.info('📬 Message delivered to recipient', { messageId: status.id, recipient: status.recipient_id });
                    break;
                case 'read':
                    messageStatus = MessageStatus.READ;
                    logger.info('👁️ Message read by recipient', { messageId: status.id, recipient: status.recipient_id });
                    break;
                case 'failed':
                    messageStatus = MessageStatus.FAILED;
                    
                    // Check for 24-hour window error (error code 131047)
                    const is24HourWindowError = status.errors?.some(
                        (error) => error.code === 131047 || 
                        error.message?.toLowerCase().includes('re-engagement') ||
                        error.error_data?.details?.toLowerCase().includes('24 hours')
                    );
                    
                    if (is24HourWindowError) {
                        logger.warn('⏰ Message failed due to 24-hour window restriction', {
                            messageId: status.id,
                            recipient: status.recipient_id,
                            errorCode: status.errors?.[0]?.code,
                            errorMessage: status.errors?.[0]?.message,
                            details: status.errors?.[0]?.error_data?.details,
                            suggestion: 'Use an approved WhatsApp template message instead of a regular text message'
                        });
                        
                        // Store this information in the message metadata for future reference
                        try {
                            const conversationService = (await import('./conversationService')).default;
                            await conversationService.markConversationRequiresTemplate(
                                status.recipient_id,
                                true
                            );
                        } catch (error) {
                            logger.warn('Failed to mark conversation as requiring template:', error);
                        }
                    } else {
                        logger.error('❌ Message delivery failed', { 
                            messageId: status.id, 
                            recipient: status.recipient_id,
                            errors: status.errors,
                            statusData: JSON.stringify(status)
                        });
                    }
                    break;
                default:
                    logger.warn('⚠️ Unknown message status', { status: status.status, messageId: status.id });
                    return; // Don't update if status is unknown
            }

            // Update message status in database
            const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();
            const updated = await conversationService.updateMessageStatus(status.id, messageStatus, timestamp);
            
            if (!updated) {
                logger.warn(`Could not update message status for ${status.id} - message may not exist in database yet or was sent from outside the chat interface`);
            }
        } catch (error) {
            logger.error('Error updating message status:', error);
            // Don't throw - status updates are not critical
        }
    }

    /**
     * Send a text message via WhatsApp
     */
    async sendTextMessage(to: string, text: string): Promise<any> {
        const startTime = Date.now();
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
        const requestPayload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: { body: text },
        };

        try {
            logger.info('📤 WhatsApp API Request - Send Text Message', {
                url,
                to,
                phoneNumberId: this.phoneNumberId,
                hasToken: !!this.accessToken,
                tokenPreview: this.accessToken ? `***${this.accessToken.slice(-8)}` : 'MISSING',
                requestPayload: JSON.stringify(requestPayload),
                messageLength: text.length,
            });

            const response = await axios.post(
                url,
                requestPayload,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const responseTime = Date.now() - startTime;

            logger.info('✅ WhatsApp API Response - Text Message Success', {
                to,
                status: response.status,
                statusText: response.statusText,
                responseTime: `${responseTime}ms`,
                responseHeaders: JSON.stringify(response.headers),
                responseData: JSON.stringify(response.data),
                messageId: response.data.messages?.[0]?.id,
                messageStatus: response.data.messages?.[0]?.message_status,
            });

            return response.data;
        } catch (error: any) {
            const responseTime = Date.now() - startTime;
            
            logger.error('❌ WhatsApp API Error - Text Message Failed', {
                to,
                url,
                responseTime: `${responseTime}ms`,
                errorMessage: error.message,
                errorCode: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseHeaders: error.response?.headers ? JSON.stringify(error.response.headers) : 'No headers',
                responseData: error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No response data',
                requestPayload: JSON.stringify(requestPayload),
                fullError: error.stack,
            });
            throw error;
        }
    }

    /**
     * Send event invitation using template
     */
    async sendEventInvitation(
        to: string,
        eventName: string,
        eventDate: string,
        rsvpLink: string
    ): Promise<any> {
        try {
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

            const response = await axios.post(
                url,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'template',
                    template: {
                        name: 'event_invitation', // Must be pre-approved by Meta
                        language: { code: 'en' },
                        components: [
                            {
                                type: 'body',
                                parameters: [
                                    { type: 'text', text: eventName },
                                    { type: 'text', text: eventDate },
                                ],
                            },
                            {
                                type: 'button',
                                sub_type: 'url',
                                index: 0,
                                parameters: [{ type: 'text', text: rsvpLink }],
                            },
                        ],
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            logger.info('WhatsApp invitation sent successfully', {
                to,
                eventName,
                messageId: response.data.messages[0].id,
            });

            return response.data;
        } catch (error: any) {
            logger.error('Error sending WhatsApp invitation:', {
                error: error.response?.data || error.message,
                to,
                eventName,
            });
            throw error;
        }
    }
    /**
     * Send event invitation with card image and RSVP button via template
     * This requires an approved template named 'event_invitation_with_rsvp'
     * 
     * Simplified version - uses only 3 variables:
     * 1. Guest Name
     * 2. Event Name
     * 3. Event Details (date + location combined)
     */
    async sendEventInvitationWithRSVP(
        to: string,
        guestName: string,
        eventName: string,
        eventDetails: string, // Combined date and location, e.g., "Dec 25, 2024 at Main Hall"
        cardImageUrl: string,
        rsvpLink?: string,
        contactInfo?: string,
        languageCode: string = 'en_US'
    ): Promise<any> {
        const components: any[] = [
            // Header: Card Image
            {
                type: 'header',
                parameters: [
                    {
                        type: 'image',
                        image: { link: cardImageUrl }
                    }
                ]
            },
            // Body: Text with 3 simple variables
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: guestName },
                    { type: 'text', text: eventName },
                    { type: 'text', text: eventDetails }
                ]
            }
        ];

        // Footer: Contact info (if provided)
        if (contactInfo) {
            components.push({
                type: 'footer',
                parameters: [
                    { type: 'text', text: contactInfo }
                ]
            });
        }

        // Buttons: RSVP buttons
        // Note: Button structure depends on your approved template
        // If using URL button for RSVP:
        if (rsvpLink) {
            components.push({
                type: 'button',
                sub_type: 'url',
                index: 0,
                parameters: [{ type: 'text', text: rsvpLink }]
            });
        }

        return this.sendTemplateMessage(
            to,
            'event_invitation_with_rsvp', // Template name - update after approval
            languageCode,
            components
        );
    }

    /**
     * Send a template message via WhatsApp
     */
    async sendTemplateMessage(
        to: string,
        templateName: string,
        languageCode: string = 'en_US',
        components: any[] = []
    ): Promise<any> {
        const startTime = Date.now();
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
        const requestPayload = {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'template',
                    template: {
                        name: templateName,
                        language: {
                            code: languageCode
                        },
                        components: components
                    }
        };

        try {
            logger.info('📤 WhatsApp API Request - Send Template Message', {
                url,
                to,
                phoneNumberId: this.phoneNumberId,
                hasToken: !!this.accessToken,
                tokenPreview: this.accessToken ? `***${this.accessToken.slice(-8)}` : 'MISSING',
                requestPayload: JSON.stringify(requestPayload, null, 2),
                templateName,
                languageCode,
                componentsCount: components.length,
            });

            const response = await axios.post(
                url,
                requestPayload,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const responseTime = Date.now() - startTime;

            logger.info('✅ WhatsApp API Response - Template Message Success', {
                to,
                templateName,
                status: response.status,
                statusText: response.statusText,
                responseTime: `${responseTime}ms`,
                responseHeaders: JSON.stringify(response.headers),
                responseData: JSON.stringify(response.data, null, 2),
                messageId: response.data.messages?.[0]?.id,
                messageStatus: response.data.messages?.[0]?.message_status,
            });

            return response.data;
        } catch (error: any) {
            const responseTime = Date.now() - startTime;
            
            logger.error('❌ WhatsApp API Error - Template Message Failed', {
                to,
                templateName,
                url,
                responseTime: `${responseTime}ms`,
                errorMessage: error.message,
                errorCode: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseHeaders: error.response?.headers ? JSON.stringify(error.response.headers) : 'No headers',
                responseData: error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No response data',
                requestPayload: JSON.stringify(requestPayload, null, 2),
                fullError: error.stack,
            });
            throw error;
        }
    }
    /**
     * Upload media to WhatsApp
     */
    async uploadMedia(mediaData: string | Buffer, mimeType: string = 'image/png'): Promise<string> {
        const startTime = Date.now();
        const url = `${this.apiUrl}/${this.phoneNumberId}/media`;

        try {
            const formData = new FormData();

            let buffer: Buffer;
            if (typeof mediaData === 'string' && mediaData.startsWith('data:')) {
                // Convert Data URL to Buffer
                const base64Data = mediaData.split(',')[1];
                buffer = Buffer.from(base64Data, 'base64');
            } else if (Buffer.isBuffer(mediaData)) {
                buffer = mediaData;
            } else {
                throw new Error('Invalid media data format');
            }

            // Create a readable stream from buffer
            const stream = Readable.from(buffer);
            
            formData.append('file', stream, {
                filename: 'image.png',
                contentType: mimeType
            });
            formData.append('messaging_product', 'whatsapp');

            logger.info('📤 WhatsApp API Request - Upload Media', {
                url,
                phoneNumberId: this.phoneNumberId,
                hasToken: !!this.accessToken,
                tokenPreview: this.accessToken ? `***${this.accessToken.slice(-8)}` : 'MISSING',
                mimeType,
                size: buffer.length,
                sizeKB: `${(buffer.length / 1024).toFixed(2)} KB`,
            });

            const response = await axios.post(url, formData, {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${this.accessToken}`,
                },
            });

            const responseTime = Date.now() - startTime;

            logger.info('✅ WhatsApp API Response - Media Upload Success', {
                status: response.status,
                statusText: response.statusText,
                responseTime: `${responseTime}ms`,
                responseHeaders: JSON.stringify(response.headers),
                responseData: JSON.stringify(response.data),
                mediaId: response.data.id,
            });

            return response.data.id;
        } catch (error: any) {
            const responseTime = Date.now() - startTime;
            
            logger.error('❌ WhatsApp API Error - Media Upload Failed', {
                url,
                responseTime: `${responseTime}ms`,
                errorMessage: error.message,
                errorCode: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseHeaders: error.response?.headers ? JSON.stringify(error.response.headers) : 'No headers',
                responseData: error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No response data',
                mimeType,
                fullError: error.stack,
            });
            throw error;
        }
    }

    /**
     * Send an image message via WhatsApp
     */
    async sendImageMessage(to: string, mediaIdOrUrl: string, caption?: string): Promise<any> {
        const startTime = Date.now();
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
            const isUrl = mediaIdOrUrl.startsWith('http');

            const imageObject = isUrl
                ? { link: mediaIdOrUrl }
                : { id: mediaIdOrUrl };

            if (caption) {
                (imageObject as any).caption = caption;
            }

        const requestPayload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'image',
            image: imageObject,
        };

        try {
            logger.info('📤 WhatsApp API Request - Send Image Message', {
                url,
                to,
                phoneNumberId: this.phoneNumberId,
                hasToken: !!this.accessToken,
                tokenPreview: this.accessToken ? `***${this.accessToken.slice(-8)}` : 'MISSING',
                requestPayload: JSON.stringify(requestPayload),
                isUrl,
                mediaIdOrUrl: isUrl ? mediaIdOrUrl : `***${mediaIdOrUrl.slice(-8)}`,
                hasCaption: !!caption,
                captionLength: caption?.length || 0,
            });

            const response = await axios.post(
                url,
                requestPayload,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const responseTime = Date.now() - startTime;

            logger.info('✅ WhatsApp API Response - Image Message Success', {
                to,
                status: response.status,
                statusText: response.statusText,
                responseTime: `${responseTime}ms`,
                responseHeaders: JSON.stringify(response.headers),
                responseData: JSON.stringify(response.data),
                messageId: response.data.messages?.[0]?.id,
                messageStatus: response.data.messages?.[0]?.message_status,
            });

            return response.data;
        } catch (error: any) {
            const responseTime = Date.now() - startTime;
            
            logger.error('❌ WhatsApp API Error - Image Message Failed', {
                to,
                url,
                responseTime: `${responseTime}ms`,
                errorMessage: error.message,
                errorCode: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseHeaders: error.response?.headers ? JSON.stringify(error.response.headers) : 'No headers',
                responseData: error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No response data',
                requestPayload: JSON.stringify(requestPayload),
                mediaIdOrUrl: isUrl ? mediaIdOrUrl : `***${mediaIdOrUrl.slice(-8)}`,
                fullError: error.stack,
            });
            throw error;
        }
    }
}
