import axios from 'axios';
import logger from '../config/logger';
import config from '../config';
import FormData from 'form-data';
import { Readable } from 'stream';
import conversationService from './conversationService';
import { MessageStatus } from '../entities/Message';
import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Invitation } from '../entities/Invitation';
import { RSVPStatus } from '../entities/enums';


interface WhatsAppMessage {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: {
        body: string;
    };
    button?: {
        payload: string;
        text: string;
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
    private invitationRepository: Repository<Invitation>;

    constructor() {
        this.apiUrl = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v18.0'}`;
        this.phoneNumberId = config.whatsapp.phoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
        this.accessToken = config.whatsapp.token || process.env.WHATSAPP_ACCESS_TOKEN || '';
        this.invitationRepository = AppDataSource.getRepository(Invitation);

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
            logger.info('🔄 Processing Webhook Change - Full Payload', {
                changeField: change.field,
                changeValue: JSON.stringify(change.value, null, 2),
                changeFull: JSON.stringify(change, null, 2),
            });

            const value = change.value;

            // Log metadata if available
            if (value.metadata) {
                logger.info('📊 Webhook Metadata', {
                    metadata: JSON.stringify(value.metadata, null, 2),
                });
            }

            // Extract contact information from webhook
            const contactsMap = new Map<string, string>();
            if (value.contacts && Array.isArray(value.contacts)) {
                logger.info(`📇 Processing ${value.contacts.length} contact(s) from webhook`, {
                    contacts: JSON.stringify(value.contacts, null, 2),
                });
                for (const contact of value.contacts) {
                    if (contact.wa_id && contact.profile?.name) {
                        contactsMap.set(contact.wa_id, contact.profile.name);
                        logger.info(`📇 Contact info extracted: ${contact.wa_id} -> "${contact.profile.name}"`);
                    } else {
                        logger.debug(`Contact missing info:`, {
                            wa_id: contact.wa_id,
                            hasProfile: !!contact.profile,
                            profileName: contact.profile?.name,
                            fullContact: JSON.stringify(contact, null, 2),
                        });
                    }
                }
            } else {
                logger.debug('No contacts array in webhook value');
            }

            // Handle incoming messages
            if (value.messages && value.messages.length > 0) {
                logger.info(`📨 Processing ${value.messages.length} incoming message(s)`, {
                    messages: JSON.stringify(value.messages, null, 2),
                });
                for (const message of value.messages) {
                    // Get contact name if available
                    const contactName = contactsMap.get(message.from) || undefined;
                    logger.info(`📨 Processing message from ${message.from}, contactName: ${contactName || 'not found in contacts map'}`, {
                        messageId: message.id,
                        messageType: message.type,
                        messageTimestamp: message.timestamp,
                        fullMessage: JSON.stringify(message, null, 2),
                    });
                    await this.handleIncomingMessage(message, contactName);
                }
            }

            // Handle message status updates
            if (value.statuses && value.statuses.length > 0) {
                logger.info(`📊 Processing ${value.statuses.length} status update(s)`, {
                    statuses: JSON.stringify(value.statuses, null, 2),
                });
                for (const status of value.statuses) {
                    logger.info(`📊 Processing status update for message: ${status.id}`, {
                        statusId: status.id,
                        status: status.status,
                        recipient: status.recipient_id,
                        timestamp: status.timestamp,
                        errors: status.errors,
                        fullStatus: JSON.stringify(status, null, 2),
                    });
                    await this.handleMessageStatus(status);
                }
            } else {
                logger.debug('No statuses array in webhook value');
            }
        } catch (error) {
            logger.error('Error processing WhatsApp webhook change:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                change: JSON.stringify(change, null, 2),
            });
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
            } else if (message.type === 'button' && message.button) {
                // Handle button messages (e.g., attendance confirmation or decline)
                logger.info('🔘 Button message received', {
                    from: message.from,
                    payload: message.button.payload,
                    text: message.button.text
                });

                // Check button type and handle accordingly (supports English & Swahili)
                const payload = message.button.payload.toLowerCase();
                const text = message.button.text.toLowerCase();

                // Check if this is a decline button
                // English: "I will not attend" OR Swahili: "Sitashashiriki"
                if (text.includes('not attend') ||
                    text.includes('sitashashiriki') ||
                    payload.includes('not attend') ||
                    payload.includes('sitashashiriki')) {
                    const language = (text.includes('sitashashiriki') || payload.includes('sitashashiriki')) ? 'sw' : 'en';
                    await this.handleAttendanceDecline(message.from, contactName, language);
                }
                // Check if this is a confirmation button
                // English: "I will attend" OR Swahili: "Nitashashiriki"
                else if (text.includes('will attend') ||
                    text.includes('nitashashiriki') ||
                    payload.includes('will attend') ||
                    payload.includes('nitashashiriki') ||
                    payload === 'confirm your attandance') {
                    const language = (text.includes('nitashashiriki') || payload.includes('nitashashiriki')) ? 'sw' : 'en';
                    await this.handleAttendanceConfirmation(message.from, contactName, language);
                }

                // Store button message with just the button text (clean display)
                const content = message.button.text; // Just the button text, no brackets
                const storedMessage = await conversationService.storeIncomingMessage(
                    message.from,
                    message.id,
                    content,
                    'button_reply', // Special type for button replies
                    {
                        timestamp: message.timestamp,
                        from: message.from,
                        type: message.type,
                        buttonPayload: message.button.payload,
                        buttonText: message.button.text,
                    },
                    contactName
                );
                logger.info(`✅ Successfully stored incoming button message: ${storedMessage.id}`);
            } else if (message.type === 'interactive' && (message as any).interactive?.type === 'nfm_reply') {
                // Handle Flow response
                logger.info('📋 Flow response received', {
                    from: message.from,
                    interactive: (message as any).interactive
                });
                await this.handleFlowResponse(message as any, contactName);
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
     * Handle attendance confirmation from button click
     */
    private async handleAttendanceConfirmation(phone: string, contactName?: string, language: 'en' | 'sw' = 'en'): Promise<void> {
        try {
            logger.info('🎉 Attendance confirmation button clicked', {
                phone,
                contactName,
                language
            });

            // Find invitation by phone number
            const invitation = await this.invitationRepository.findOne({
                where: { guestPhone: phone },
                relations: ['event'],
                order: { createdAt: 'DESC' } // Get most recent invitation
            });

            if (!invitation) {
                logger.warn('⚠️ No invitation found for phone number', { phone });
                const msg = language === 'sw'
                    ? "Hatukuweza kupata mwaliko wako. Tafadhali wasiliana na mwandaaji wa hafla kwa msaada."
                    : "We couldn't find your invitation. Please contact the event organizer for assistance.";
                await this.sendTextMessage(phone, msg);
                return;
            }

            // Check if already confirmed
            if (invitation.rsvpStatus === RSVPStatus.ACCEPTED) {
                logger.info('✅ Attendance already confirmed', {
                    invitationId: invitation.id,
                    guestName: invitation.guestName
                });
                const msg = language === 'sw'
                    ? `Asante ${invitation.guestName}! Tulishapokea uthibitisho wako kwa ajili ya ${invitation.event.title}. Tunatazamia kukuona!`
                    : `Thank you ${invitation.guestName}! Your attendance was already confirmed for ${invitation.event.title}. We look forward to seeing you!`;
                await this.sendTextMessage(phone, msg);
                return;
            }

            // Check if user previously declined - Now ALLOW changing RSVP
            if (invitation.rsvpStatus === RSVPStatus.DECLINED) {
                logger.info('🔄 User changing RSVP from Declined to Accepted', {
                    invitationId: invitation.id,
                    guestName: invitation.guestName
                });
                // We allow the update
            }

            // Update RSVP status
            invitation.rsvpStatus = RSVPStatus.ACCEPTED;
            invitation.rsvpAt = new Date();
            await this.invitationRepository.save(invitation);

            logger.info('✅ Attendance confirmed successfully', {
                invitationId: invitation.id,
                guestName: invitation.guestName,
                phone,
                eventTitle: invitation.event.title
            });

            // Send confirmation message
            const msg = language === 'sw'
                ? `Asante ${invitation.guestName}! Uthibitisho wako umepokelewa kwa ajili ya ${invitation.event.title}. Tunatazamia kukuona! 🎉`
                : `Thank you ${invitation.guestName}! Your attendance has been confirmed for ${invitation.event.title}. We look forward to seeing you! 🎉`;

            const response = await this.sendTextMessage(phone, msg);

            // Store the automated response in conversation
            if (response && response.messages && response.messages[0]) {
                await conversationService.storeOutgoingMessage(
                    invitation.event.userId, // userId (was missing!)
                    phone, // phoneNumber  
                    msg, // content
                    response.messages[0].id, // whatsappMessageId
                    'text', // messageType
                    { contactName }, // metadata
                    'WHATSAPP' // channel
                );
            }

        } catch (error) {
            logger.error('❌ Error handling attendance confirmation:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                phone
            });
            const msg = language === 'sw'
                ? "Pole, kulikuwa na hitilafu wakati wa kushughulikia ombi lako. Tafadhali jaribu tena."
                : "Sorry, there was an error processing your confirmation. Please try again or contact the event organizer.";
            await this.sendTextMessage(phone, msg);
        }
    }

    /**
     * Handle attendance decline from button click
     */
    private async handleAttendanceDecline(phone: string, contactName?: string, language: 'en' | 'sw' = 'en'): Promise<void> {
        try {
            logger.info('❌ Attendance decline button clicked', {
                phone,
                contactName,
                language
            });

            // Find invitation by phone number
            const invitation = await this.invitationRepository.findOne({
                where: { guestPhone: phone },
                relations: ['event'],
                order: { createdAt: 'DESC' }
            });

            if (!invitation) {
                logger.warn('⚠️ No invitation found for phone number', { phone });
                const msg = language === 'sw'
                    ? "Hatukuweza kupata mwaliko wako. Tafadhali wasiliana na mwandaaji wa hafla kwa msaada."
                    : "We couldn't find your invitation. Please contact the event organizer for assistance.";
                await this.sendTextMessage(phone, msg);
                return;
            }

            // Check if already declined
            if (invitation.rsvpStatus === RSVPStatus.DECLINED) {
                logger.info('Already declined', {
                    invitationId: invitation.id,
                    guestName: invitation.guestName
                });
                const msg = language === 'sw'
                    ? `Asante ${invitation.guestName}. Tayari tumepokea taarifa kuwa hutaweza kuhudhuria ${invitation.event.title}. Tunatumai kukuona katika hafla zijazo!`
                    : `Thank you ${invitation.guestName}. We already have your response that you won't be able to attend ${invitation.event.title}. We hope to see you at future events!`;
                await this.sendTextMessage(phone, msg);
                return;
            }

            // Check if user previously confirmed - Now ALLOW changing RSVP
            if (invitation.rsvpStatus === RSVPStatus.ACCEPTED) {
                logger.info('🔄 User changing RSVP from Accepted to Declined', {
                    invitationId: invitation.id,
                    guestName: invitation.guestName
                });
                // We allow the update
            }

            // Update RSVP status to declined
            invitation.rsvpStatus = RSVPStatus.DECLINED;
            invitation.rsvpAt = new Date();
            await this.invitationRepository.save(invitation);

            logger.info('✅ Attendance declined successfully', {
                invitationId: invitation.id,
                guestName: invitation.guestName,
                phone,
                eventTitle: invitation.event.title
            });

            // Send acknowledgment message
            const msg = language === 'sw'
                ? `Asante kwa taarifa, ${invitation.guestName}. Tunasikitika kuwa hutaweza kuhudhuria ${invitation.event.title}. Tunatumai kukuona katika hafla zijazo!`
                : `Thank you for letting us know, ${invitation.guestName}. We're sorry you won't be able to attend ${invitation.event.title}. We hope to see you at future events!`;

            const response = await this.sendTextMessage(phone, msg);

            // Store the automated response in conversation
            if (response && response.messages && response.messages[0]) {
                await conversationService.storeOutgoingMessage(
                    invitation.event.userId, // userId (was missing!)
                    phone, // phoneNumber
                    msg, // content
                    response.messages[0].id, // whatsappMessageId
                    'text', // messageType
                    { contactName }, // metadata
                    'WHATSAPP' // channel
                );
            }


        } catch (error) {
            logger.error('❌ Error handling attendance decline:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                phone
            });
            const msg = language === 'sw'
                ? "Pole, kulikuwa na hitilafu wakati wa kushughulikia ombi lako. Tafadhali jaribu tena."
                : "Sorry, there was an error processing your response. Please try again or contact the event organizer.";
            await this.sendTextMessage(phone, msg);
        }
    }

    /**
     * Handle WhatsApp Flow response
     */
    private async handleFlowResponse(message: any, contactName?: string): Promise<void> {
        try {
            const flowData = message.interactive.nfm_reply;
            const responseJson = JSON.parse(flowData.response_json);

            logger.info('📋 Processing Flow response', {
                from: message.from,
                flowToken: flowData.flow_token,
                response: responseJson,
                contactName
            });

            // Extract invitation ID from flow_token (format: eventId_invitationId)
            const flowToken = flowData.flow_token;
            const tokenParts = flowToken.split('_');

            if (tokenParts.length < 2) {
                logger.warn('⚠️ Invalid flow token format', { flowToken });
                return;
            }

            const invitationId = tokenParts[1];

            // Find invitation
            const invitation = await this.invitationRepository.findOne({
                where: { id: invitationId },
                relations: ['event']
            });

            if (!invitation) {
                logger.warn('⚠️ No invitation found for Flow response', { invitationId });
                await this.sendTextMessage(
                    message.from,
                    "We couldn't find your invitation. Please contact the event organizer."
                );
                return;
            }

            // Extract response data
            const attendanceResponse = responseJson.attendance_response;
            const additionalNotes = responseJson.additional_notes;

            // Check if already responded
            if (invitation.rsvpStatus !== RSVPStatus.PENDING) {
                logger.info('⚠️ User already responded via Flow', {
                    invitationId,
                    currentStatus: invitation.rsvpStatus
                });
                await this.sendTextMessage(
                    message.from,
                    `${invitation.guestName}, we already have your RSVP for ${invitation.event.title}. If you need to change it, please contact the event organizer.`
                );
                return;
            }

            // Update RSVP based on response
            if (attendanceResponse === 'accept') {
                invitation.rsvpStatus = RSVPStatus.ACCEPTED;
            } else if (attendanceResponse === 'decline') {
                invitation.rsvpStatus = RSVPStatus.DECLINED;
            } else {
                logger.warn('⚠️ Unknown attendance response', { attendanceResponse });
                return;
            }

            invitation.rsvpAt = new Date();

            // Save additional notes if provided
            if (additionalNotes && additionalNotes.trim()) {
                invitation.specialRequirements = additionalNotes.trim();
            }

            await this.invitationRepository.save(invitation);

            logger.info('✅ RSVP updated from Flow', {
                invitationId,
                status: invitation.rsvpStatus,
                hasNotes: !!additionalNotes,
                eventTitle: invitation.event.title
            });

            // Send confirmation message
            const confirmationMessage = attendanceResponse === 'accept'
                ? `Thank you ${invitation.guestName}! Your attendance has been confirmed for ${invitation.event.title}. We look forward to seeing you! 🎉`
                : `Thank you for letting us know, ${invitation.guestName}. We're sorry you won't be able to attend ${invitation.event.title}. We hope to see you at future events!`;

            await this.sendTextMessage(message.from, confirmationMessage);

        } catch (error) {
            logger.error('❌ Error handling Flow response:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                message: message
            });
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

        console.log('WhatsApp status==========================================>', status);

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

            // Extract error message if status is failed
            let errorDetails: string | undefined;
            if (status.status === 'failed' && status.errors && status.errors.length > 0) {
                const error = status.errors[0];
                errorDetails = error.error_data?.details || error.message || `Error ${error.code}: ${error.title}`;
            }

            logger.info(`🔍 Attempting to update message status in database`, {
                whatsappMessageId: status.id,
                targetStatus: messageStatus,
                timestamp: timestamp.toISOString(),
                recipient: status.recipient_id,
                errorDetails,
                statusObject: JSON.stringify(status, null, 2),
            });

            const updated = await conversationService.updateMessageStatus(
                status.id,
                messageStatus,
                timestamp,
                errorDetails
            );

            if (!updated) {
                logger.warn(`⚠️ Could not update message status for ${status.id}`, {
                    whatsappMessageId: status.id,
                    status: status.status,
                    recipient: status.recipient_id,
                    timestamp: status.timestamp,
                    errors: status.errors,
                    fullStatusPayload: JSON.stringify(status, null, 2),
                    reason: 'Message may not exist in database yet or was sent from outside the chat interface',
                    suggestion: 'This is normal for messages sent from the Communications page before chat integration, or for messages sent via template API',
                });
            } else {
                logger.info(`✅ Successfully updated message status`, {
                    whatsappMessageId: status.id,
                    newStatus: messageStatus,
                    messageId: updated.id,
                });
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

        console.log('WhatsApp URL==========================================>', url);
        console.log('WhatsApp phone number ID==========================================>', this.phoneNumberId);
        console.log('WhatsApp access token==========================================>', this.accessToken);
        console.log('WhatsApp request payload==========================================>', requestPayload);

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

            console.log('WhatsApp error==========================================>', error.response?.data);

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
     * Send English wedding invitation with card image via template
     * Template: 'wedding_invitation_with_image'
     * 
     * Uses named variables (lowercase) that match database fields for plug-and-play mapping:
     * {{guestname}} = invitation.guestName
     * {{hostname}} = event.user.firstName + lastName
     * {{bridename}} = event.brideName or custom field
     * {{groomname}} = event.groomName or custom field
     * {{eventdate}} = event.eventDate (formatted)
     * {{venue}} = event.venueName + event.venueAddress
     * {{starttime}} = event.startTime
     * {{endtime}} = event.endTime
     * 
     * Note: WhatsApp requires lowercase variable names in templates
     */
    async sendWeddingInvitationWithImage(
        to: string,
        invitation: { guestName: string; cardUrl?: string },
        event: {
            title?: string;
            eventDate: Date | string;
            startTime: string;
            endTime?: string;
            venueName?: string;
            venueAddress?: string;
            user?: { firstName?: string; lastName?: string };
            hostname?: string;
            brideName?: string;
            groomName?: string;
        },
        cardImageUrl: string | undefined, // Optional - can be empty string or undefined
        rsvpLink?: string,
        languageCode: string = 'en', // English (use 'en' to match working format)
        customVariables?: {
            hostname?: string;
            eventdate?: string;
            venue?: string;
        }
    ): Promise<any> {
        // Format event date to readable format
        const formatDate = (date: Date | string): string => {
            const d = typeof date === 'string' ? new Date(date) : date;
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        };

        // Format time (keep as is or add AM/PM if needed)
        const formatTime = (time: string): string => {
            // If time is in 24h format, convert to 12h format
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            if (hour === 0) {
                return `12:${minutes} AM`;
            } else if (hour < 12) {
                return `${hour}:${minutes} AM`;
            } else if (hour === 12) {
                return `12:${minutes} PM`;
            } else {
                return `${hour - 12}:${minutes} PM`;
            }
        };

        // Build venue string - use custom if provided, otherwise from venueName and venueAddress
        const venue = customVariables?.venue || [event.venueName, event.venueAddress]
            .filter(Boolean)
            .join(', ');

        // Build host name - prioritize: custom var > event hostname > user name > fallback
        const hostName = customVariables?.hostname ||
            (event as any).hostname ||
            (event.user ? [event.user.firstName, event.user.lastName].filter(Boolean).join(' ') : 'Family');

        // Use brideName/groomName from event, or fallback to defaults
        const brideName = event.brideName || 'Bride';
        const groomName = event.groomName || 'Groom';

        // Use custom event date if provided, otherwise format from event
        const formattedEventDate = customVariables?.eventdate || formatDate(event.eventDate);

        const components: any[] = [];

        // Header: Card Image (MANDATORY for wedding_invitation_with_image template)
        // WhatsApp cannot access localhost URLs, so we use a fallback if needed
        const hasValidCardUrl = cardImageUrl &&
            cardImageUrl.trim() &&
            !cardImageUrl.includes('localhost') &&
            !cardImageUrl.includes('127.0.0.1') &&
            !cardImageUrl.includes('::1') &&
            (cardImageUrl.startsWith('http://') || cardImageUrl.startsWith('https://'));

        const finalCardImageUrl = hasValidCardUrl ? cardImageUrl : 'https://wexpevents.co.tz/logo.png';

        logger.info(`📷 Including card image in template header: ${finalCardImageUrl}`);
        components.push({
            type: 'header',
            parameters: [
                {
                    type: 'image',
                    image: { link: finalCardImageUrl }
                }
            ]
        });

        // Body: Text with named variables (lowercase) matching database fields
        // Template: "Dear {{guestname}}, The family of Mr. and Mrs. {{hostname}} would like to invite you..."
        components.push({
            type: 'body',
            parameters: [
                { type: 'text', parameter_name: 'guestname', text: invitation.guestName },
                { type: 'text', parameter_name: 'hostname', text: hostName },
                { type: 'text', parameter_name: 'bridename', text: brideName },
                { type: 'text', parameter_name: 'groomname', text: groomName },
                { type: 'text', parameter_name: 'eventdate', text: formattedEventDate },
                { type: 'text', parameter_name: 'venue', text: venue || 'Event Venue' },
                { type: 'text', parameter_name: 'starttime', text: formatTime(event.startTime) },
                { type: 'text', parameter_name: 'endtime', text: event.endTime ? formatTime(event.endTime) : 'End' }
            ]
        });

        // Add URL button for RSVP if provided and not localhost
        // WhatsApp recipients cannot access localhost URLs
        const hasValidRsvpLink = rsvpLink &&
            !rsvpLink.includes('localhost') &&
            !rsvpLink.includes('127.0.0.1') &&
            !rsvpLink.includes('::1');

        if (hasValidRsvpLink) {
            components.push({
                type: 'button',
                sub_type: 'url',
                index: 0,
                parameters: [{ type: 'text', text: rsvpLink }]
            });
        }

        return this.sendTemplateMessage(
            to,
            'wedding_invitation_with_image',
            'en',
            components,
            invitation.guestName // Pass guest name for tracking
        );
    }

    /**
     * Send wedding invitation template WITHOUT image (wedding_invite)
     * Template: 'wedding_invite'
     * 
     * @param to - Recipient phone number
     * @param invitation - Invitation data with guest name
     * @param event - Event data
     * @param rsvpLink - Optional RSVP link
     * @param languageCode - Language code (default: 'en')
     * @param customVariables - Optional custom variable overrides
     */
    async sendWeddingInvite(
        to: string,
        invitation: { guestName: string },
        event: {
            title?: string;
            eventDate: Date | string;
            startTime: string;
            endTime?: string;
            venueName?: string;
            venueAddress?: string;
            user?: { firstName?: string; lastName?: string };
            hostname?: string;
            brideName?: string;
            groomName?: string;
        },
        rsvpLink?: string,
        languageCode: string = 'en', // English (use 'en' to match working format)
        customVariables?: {
            guestname?: string;
            hostname?: string;
            bridename?: string;
            groomname?: string;
            eventdate?: string;
            venue?: string;
            starttime?: string;
            endtime?: string;
        }
    ): Promise<any> {
        // Format event date to readable format
        const formatDate = (date: Date | string): string => {
            const d = typeof date === 'string' ? new Date(date) : date;
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        };

        // Format time (keep as is or add AM/PM if needed)
        const formatTime = (time: string): string => {
            // If time is in 24h format, convert to 12h format
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            if (hour === 0) {
                return `12:${minutes} AM`;
            } else if (hour < 12) {
                return `${hour}:${minutes} AM`;
            } else if (hour === 12) {
                return `12:${minutes} PM`;
            } else {
                return `${hour - 12}:${minutes} PM`;
            }
        };

        // Build venue string - use custom if provided, otherwise from venueName and venueAddress
        const venue = customVariables?.venue || [event.venueName, event.venueAddress]
            .filter(Boolean)
            .join(', ');

        // Build host name - prioritize: custom var > event hostname > user name > fallback
        const hostName = customVariables?.hostname ||
            (event as any).hostname ||
            (event.user ? [event.user.firstName, event.user.lastName].filter(Boolean).join(' ') : 'Family');

        // Use brideName/groomName from event or custom variables, or fallback to defaults
        const brideName = customVariables?.bridename || event.brideName || 'Bride';
        const groomName = customVariables?.groomname || event.groomName || 'Groom';

        // Use custom event date if provided, otherwise format from event
        const formattedEventDate = customVariables?.eventdate || formatDate(event.eventDate);

        // Use custom guest name if provided
        const guestName = customVariables?.guestname || invitation.guestName;

        const components: any[] = [];

        // Body: Text with named variables (lowercase) matching database fields
        // Template: "Dear {{guestname}}, The family of Mr. and Mrs. {{hostname}} would like to invite you..."
        components.push({
            type: 'body',
            parameters: [
                { type: 'text', parameter_name: 'guestname', text: guestName },
                { type: 'text', parameter_name: 'hostname', text: hostName },
                { type: 'text', parameter_name: 'bridename', text: brideName },
                { type: 'text', parameter_name: 'groomname', text: groomName },
                { type: 'text', parameter_name: 'eventdate', text: formattedEventDate },
                { type: 'text', parameter_name: 'venue', text: venue || 'Event Venue' },
                { type: 'text', parameter_name: 'starttime', text: customVariables?.starttime || formatTime(event.startTime) },
                { type: 'text', parameter_name: 'endtime', text: customVariables?.endtime || (event.endTime ? formatTime(event.endTime) : 'End') }
            ]
        });

        // NOTE: The wedding_invite template does NOT have a URL button
        // It only has body parameters, no button component
        // If you need RSVP functionality, use wedding_invitation_with_image template instead

        logger.info(`📧 Sending wedding_invite template (no image) to ${to}`, {
            guestName,
            hostName,
            brideName,
            groomName,
            eventDate: formattedEventDate,
            venue,
            hasRsvpLink: !!rsvpLink
        });

        return this.sendTemplateMessage(
            to,
            'wedding_invite', // Template name (without image)
            'en', // Use 'en' instead of 'en_US' to match working format
            components
        );
    }

    /**
     * Send Swahili wedding invitation via template
     * Templates: 'wedding_invitation_with_image' (with card) or 'wedding_invite' (without card)
     * Language: 'sw' (Swahili)
     * 
     * Uses named variables (lowercase) that match database fields for plug-and-play mapping:
     * {{guestname}} = invitation.guestName
     * {{hostname}} = event.user.firstName + lastName
     * {{bridename}} = event.brideName or custom field
     * {{groomname}} = event.groomName or custom field
     * {{eventdate}} = event.eventDate (formatted in Swahili)
     * {{venue}} = event.venueName + event.venueAddress
     * {{starttime}} = event.startTime (formatted in Swahili)
     * {{endtime}} = event.endTime (formatted in Swahili)
     * 
     * Note: WhatsApp requires lowercase variable names in templates
     */
    async sendSwahiliWeddingInvitation(
        to: string,
        invitation: { guestName: string; cardUrl?: string },
        event: {
            title?: string;
            eventDate: Date | string;
            startTime: string;
            endTime?: string;
            venueName?: string;
            venueAddress?: string;
            user?: { firstName?: string; lastName?: string };
            hostname?: string;
            brideName?: string;
            groomName?: string;
        },
        cardImageUrl: string,
        rsvpLink?: string,
        languageCode: string = 'sw' // Swahili
    ): Promise<any> {
        // Format event date to Swahili format
        const formatSwahiliDate = (date: Date | string): string => {
            const d = typeof date === 'string' ? new Date(date) : date;
            const months = [
                'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
                'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'
            ];
            return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
        };

        // Format time to Swahili format
        const formatSwahiliTime = (time: string): string => {
            // If time is in 24h format, convert to Swahili format
            const hour = parseInt(time.split(':')[0]);
            if (hour < 12) {
                return `${time} asubuhi`;
            } else if (hour < 18) {
                return `${time} mchana`;
            } else {
                return `${time} jioni`;
            }
        };

        // Build venue string from venueName and venueAddress
        const venue = [event.venueName, event.venueAddress]
            .filter(Boolean)
            .join(', ');

        // Build host name - prioritize: event hostname > user name (with 'na' in Swahili) > fallback
        const hostName = (event as any).hostname ||
            (event.user ? [event.user.firstName, event.user.lastName].filter(Boolean).join(' na ') : 'Familia');

        // Use brideName/groomName from event, or fallback to Swahili defaults
        const brideName = event.brideName || 'Bibi';
        const groomName = event.groomName || 'Bwana';

        // Check if we have a valid card URL (not empty, not localhost)
        const hasValidCardUrl = cardImageUrl &&
            cardImageUrl.trim() &&
            !cardImageUrl.includes('localhost') &&
            !cardImageUrl.includes('127.0.0.1') &&
            !cardImageUrl.includes('::1') &&
            (cardImageUrl.startsWith('http://') || cardImageUrl.startsWith('https://'));

        // 🎯 Hardcoded: Always use wedding_invitation_with_image as specifically requested by user.
        // This template supports URL buttons, whereas wedding_invite (sw) may not or uses QuickReply.
        const templateName = 'wedding_invitation_with_image';
        const finalCardImageUrl = hasValidCardUrl ? cardImageUrl : 'https://wexpevents.co.tz/logo.png';

        const components: any[] = [];

        // Header: Card Image (MANDATORY for wedding_invitation_with_image template)
        logger.info(`📷 Including card image in Swahili template header: ${finalCardImageUrl}`);
        components.push({
            type: 'header',
            parameters: [
                {
                    type: 'image',
                    image: { link: finalCardImageUrl }
                }
            ]
        });

        // Body: Text with named variables (lowercase) matching database fields
        // Note: Template uses lowercase {{guestname}}, {{hostname}}, etc. as required by WhatsApp
        components.push({
            type: 'body',
            parameters: [
                { type: 'text', parameter_name: 'guestname', text: invitation.guestName },
                { type: 'text', parameter_name: 'hostname', text: hostName },
                { type: 'text', parameter_name: 'bridename', text: brideName },
                { type: 'text', parameter_name: 'groomname', text: groomName },
                { type: 'text', parameter_name: 'eventdate', text: formatSwahiliDate(event.eventDate) },
                { type: 'text', parameter_name: 'venue', text: venue || 'Mahali pa kusherehekea' },
                { type: 'text', parameter_name: 'starttime', text: formatSwahiliTime(event.startTime) },
                { type: 'text', parameter_name: 'endtime', text: event.endTime ? formatSwahiliTime(event.endTime) : 'Mwisho' }
            ]
        });

        // Add URL button for RSVP if provided and not localhost
        // WhatsApp recipients cannot access localhost URLs
        const hasValidRsvpLink = rsvpLink &&
            !rsvpLink.includes('localhost') &&
            !rsvpLink.includes('127.0.0.1') &&
            !rsvpLink.includes('::1');

        if (hasValidRsvpLink) {
            components.push({
                type: 'button',
                sub_type: 'url',
                index: 0,
                parameters: [{ type: 'text', text: rsvpLink }]
            });
        }

        logger.info(`📧 Sending Swahili template: ${templateName}`, {
            to,
            templateName,
            hasCard: hasValidCardUrl,
            usingFallback: !hasValidCardUrl,
            hasRsvpButton: hasValidRsvpLink,
            languageCode
        });

        return this.sendTemplateMessage(
            to,
            templateName, // 'wedding_invitation_with_image'
            languageCode, // 'sw'
            components,
            invitation.guestName // Pass guest name for tracking
        );
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
        languageCode: string = 'en' // Use 'en' to match working format
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
        // If using URL button for RSVP (but not localhost):
        // WhatsApp recipients cannot access localhost URLs
        const hasValidRsvpLink = rsvpLink &&
            !rsvpLink.includes('localhost') &&
            !rsvpLink.includes('127.0.0.1') &&
            !rsvpLink.includes('::1');

        if (hasValidRsvpLink) {
            components.push({
                type: 'button',
                sub_type: 'url',
                index: 0,
                parameters: [{ type: 'text', text: rsvpLink }]
            });
        }

        return this.sendTemplateMessage(
            to,
            'event_invitation_with_rsvp',
            languageCode,
            components,
            guestName // Pass guest name for tracking
        );
    }

    /**
     * Send event invitation with WhatsApp Flow for RSVP
     */
    async sendEventInvitationWithFlow(
        to: string,
        invitationData: {
            guestName: string;
            invitationId: string;
        },
        eventData: {
            id: string;
            title: string;
            eventDate: Date | string;
            startTime: string;
            venueName?: string;
            venueAddress?: string;
            cardUrl?: string;
        },
        languageCode: string = 'en'
    ): Promise<any> {
        const flowId = process.env.WHATSAPP_FLOW_ID || config.whatsapp.flowId;

        if (!flowId) {
            throw new Error('WhatsApp Flow ID not configured. Set WHATSAPP_FLOW_ID in environment variables.');
        }

        // Format event date
        const formatDate = (date: Date | string): string => {
            const d = typeof date === 'string' ? new Date(date) : date;
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        };

        const formattedDate = formatDate(eventData.eventDate);
        const venue = [eventData.venueName, eventData.venueAddress].filter(Boolean).join(', ') || 'TBA';

        const components: any[] = [];

        // Add header image if card URL exists
        if (eventData.cardUrl) {
            components.push({
                type: 'header',
                parameters: [
                    {
                        type: 'image',
                        image: { link: eventData.cardUrl }
                    }
                ]
            });
        }

        // Body parameters
        components.push({
            type: 'body',
            parameters: [
                { type: 'text', text: invitationData.guestName },
                { type: 'text', text: eventData.title },
                { type: 'text', text: formattedDate },
                { type: 'text', text: venue }
            ]
        });

        // Flow button
        components.push({
            type: 'button',
            sub_type: 'flow',
            index: 0,
            parameters: [
                {
                    type: 'action',
                    action: {
                        flow_token: `${eventData.id}_${invitationData.invitationId}`,
                        flow_id: flowId,
                        flow_cta: languageCode === 'sw' ? 'Toa Majibu' : 'RSVP Now',
                        flow_action: 'navigate',
                        flow_action_payload: {
                            screen: 'RSVP_SCREEN',
                            data: {
                                guest_name: invitationData.guestName,
                                event_title: eventData.title,
                                event_date: formattedDate,
                                event_venue: venue
                            }
                        }
                    }
                }
            ]
        });

        logger.info('📋 Sending event invitation with Flow', {
            to,
            flowId,
            invitationId: invitationData.invitationId,
            eventId: eventData.id
        });

        return this.sendTemplateMessage(
            to,
            'wedding_invitation_flow',
            languageCode,
            components,
            invitationData.guestName // Pass guest name for tracking
        );
    }

    /**
     * Send a template message via WhatsApp
     */
    async sendTemplateMessage(
        to: string,
        templateName: string,
        languageCode: string = 'en', // Use 'en' to match working format
        components: any[] = [],
        contactName?: string // Optional contact name for tracking
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
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📤 SENDING WHATSAPP TEMPLATE MESSAGE');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📞 To:', to);
            console.log('📋 Template:', templateName);
            console.log('🌐 Language:', languageCode);
            console.log('🔗 API URL:', url);
            console.log('📦 Full Request Payload:');
            console.log(JSON.stringify(requestPayload, null, 2));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
            const whatsappMessageId = response.data.messages?.[0]?.id;

            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ WHATSAPP TEMPLATE MESSAGE SUCCESS');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📞 To:', to);
            console.log('📋 Template:', templateName);
            console.log('⏱️  Response Time:', `${responseTime}ms`);
            console.log('📨 Message ID:', whatsappMessageId);
            console.log('📊 Message Status:', response.data.messages?.[0]?.message_status);
            console.log('📦 Full Response:');
            console.log(JSON.stringify(response.data, null, 2));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            logger.info('✅ WhatsApp API Response - Template Message Success', {
                to,
                templateName,
                status: response.status,
                statusText: response.statusText,
                responseTime: `${responseTime}ms`,
                responseHeaders: JSON.stringify(response.headers),
                responseData: JSON.stringify(response.data, null, 2),
                messageId: whatsappMessageId,
                messageStatus: response.data.messages?.[0]?.message_status,
            });

            // Store message in conversation table for tracking
            if (whatsappMessageId) {
                try {
                    await conversationService.storeTemplateMessage(
                        to,
                        whatsappMessageId,
                        templateName,
                        languageCode,
                        { components },
                        contactName
                    );
                    logger.info(`💾 Template message saved to conversation table: ${whatsappMessageId}`);
                } catch (storageError) {
                    // Log but don't fail the send
                    logger.error('Failed to store template message in conversation table:', storageError);
                }
            }

            return response.data;
        } catch (error: any) {
            const responseTime = Date.now() - startTime;

            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('❌ WHATSAPP TEMPLATE MESSAGE FAILED');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📞 To:', to);
            console.log('📋 Template:', templateName);
            console.log('⏱️  Response Time:', `${responseTime}ms`);
            console.log('❗ Error Message:', error.message);
            console.log('📊 HTTP Status:', error.response?.status);
            console.log('📄 Status Text:', error.response?.statusText);

            if (error.response?.data) {
                console.log('📦 Error Response Data:');
                console.log(JSON.stringify(error.response.data, null, 2));

                // Detailed error breakdown
                if (error.response.data.error) {
                    console.log('\n🔍 ERROR DETAILS:');
                    console.log('  Code:', error.response.data.error.code);
                    console.log('  Message:', error.response.data.error.message);
                    console.log('  Type:', error.response.data.error.type);
                    console.log('  Subcode:', error.response.data.error.error_subcode);
                    console.log('  Trace ID:', error.response.data.error.fbtrace_id);

                    if (error.response.data.error.error_data) {
                        console.log('  Additional Data:', JSON.stringify(error.response.data.error.error_data, null, 2));
                    }
                }
            }
            console.log('\n💡 TROUBLESHOOTING TIPS:');
            console.log('  1. Check if template "' + templateName + '" is APPROVED in Business Manager');
            console.log('  2. Verify template name spelling matches exactly');
            console.log('  3. Ensure language code "' + languageCode + '" is correct');
            console.log('  4. Check if all required parameters are provided');
            console.log('  5. Verify WhatsApp access token is valid');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
