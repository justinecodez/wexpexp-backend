import axios from 'axios';
import logger from '../config/logger';
import config from '../config';
import FormData from 'form-data';
import { Readable } from 'stream';

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
    timestamp: string;
    recipient_id: string;
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

            // Handle incoming messages
            if (value.messages && value.messages.length > 0) {
                for (const message of value.messages) {
                    await this.handleIncomingMessage(message);
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
    private async handleIncomingMessage(message: WhatsAppMessage): Promise<void> {
        logger.info('Received WhatsApp message', {
            from: message.from,
            type: message.type,
            messageId: message.id,
        });

        // TODO: Implement your business logic here
        // For example:
        // - Store message in database
        // - Send auto-reply
        // - Notify event organizers
        // - Process RSVP responses

        // Example: Send auto-reply
        if (message.type === 'text' && message.text) {
            const messageText = message.text.body.toLowerCase();

            // Simple RSVP handling
            if (messageText.includes('yes') || messageText.includes('confirm')) {
                await this.sendTextMessage(
                    message.from,
                    'Thank you for confirming! We look forward to seeing you at the event. 🎉'
                );
            } else if (messageText.includes('no') || messageText.includes('decline')) {
                await this.sendTextMessage(
                    message.from,
                    'Thank you for letting us know. We hope to see you at future events!'
                );
            }
        }
    }

    /**
     * Handle message delivery status updates
     */
    private async handleMessageStatus(status: WhatsAppStatus): Promise<void> {
        logger.info('WhatsApp message status update', {
            messageId: status.id,
            status: status.status,
            recipient: status.recipient_id,
        });

        // TODO: Update message status in your database
        // For example:
        // - Mark invitation as delivered
        // - Track read receipts
        // - Handle failed messages
    }

    /**
     * Send a text message via WhatsApp
     */
    async sendTextMessage(to: string, text: string): Promise<any> {
        try {
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

            logger.info('Sending WhatsApp text message', {
                url,
                to,
                hasToken: !!this.accessToken
            });

            const response = await axios.post(
                url,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'text',
                    text: { body: text },
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            logger.info('WhatsApp message sent successfully', {
                to,
                messageId: response.data.messages[0].id,
            });

            return response.data;
        } catch (error: any) {
            logger.error('Error sending WhatsApp message:', {
                error: error.response?.data || error.message,
                to,
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
     * Send a template message via WhatsApp
     */
    async sendTemplateMessage(
        to: string,
        templateName: string,
        languageCode: string = 'en_US',
        components: any[] = []
    ): Promise<any> {
        try {
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

            logger.info('Sending WhatsApp template message', {
                url,
                to,
                templateName,
                hasToken: !!this.accessToken
            });

            const response = await axios.post(
                url,
                {
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
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            logger.info('WhatsApp template message sent successfully', {
                to,
                templateName,
                messageId: response.data.messages[0].id,
            });

            return response.data;
        } catch (error: any) {
            logger.error('Error sending WhatsApp template message:', {
                error: error.response?.data || error.message,
                to,
                templateName,
            });
            throw error;
        }
    }
    /**
     * Upload media to WhatsApp
     */
    async uploadMedia(mediaData: string | Buffer, mimeType: string = 'image/png'): Promise<string> {
        try {
            const url = `${this.apiUrl}/${this.phoneNumberId}/media`;
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

            logger.info('Uploading media to WhatsApp', {
                url,
                mimeType,
                size: buffer.length
            });

            const response = await axios.post(url, formData, {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${this.accessToken}`,
                },
            });

            logger.info('Media uploaded successfully', {
                mediaId: response.data.id
            });

            return response.data.id;
        } catch (error: any) {
            logger.error('Error uploading media to WhatsApp:', {
                error: error.response?.data || error.message,
            });
            throw error;
        }
    }

    /**
     * Send an image message via WhatsApp
     */
    async sendImageMessage(to: string, mediaIdOrUrl: string, caption?: string): Promise<any> {
        try {
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
            const isUrl = mediaIdOrUrl.startsWith('http');

            const imageObject = isUrl
                ? { link: mediaIdOrUrl }
                : { id: mediaIdOrUrl };

            if (caption) {
                (imageObject as any).caption = caption;
            }

            logger.info('Sending WhatsApp image message', {
                to,
                isUrl,
                hasCaption: !!caption
            });

            const response = await axios.post(
                url,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'image',
                    image: imageObject,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            logger.info('WhatsApp image message sent successfully', {
                to,
                messageId: response.data.messages[0].id,
            });

            return response.data;
        } catch (error: any) {
            logger.error('Error sending WhatsApp image message:', {
                error: error.response?.data || error.message,
                to,
            });
            throw error;
        }
    }
}
