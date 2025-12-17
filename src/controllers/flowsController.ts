import { Request, Response } from 'express';
import flowsEncryption from '../services/flows/encryption';
import logger from '../config/logger';
import { AppDataSource } from '../config/database';
import { Invitation } from '../entities/Invitation';
import { RSVPStatus } from '../entities/enums';
import config from '../config';

/**
 * WhatsApp Flows Controller
 * Handles RSVP Flow interactions
 */

export class FlowsController {
    /**
     * Main RSVP Flow endpoint
     * Handles all Flow requests: INIT, data_exchange, BACK, ping
     */
    async handleRSVPFlow(req: Request, res: Response): Promise<void> {
        try {
            // Validate signature
            if (!flowsEncryption.validateSignature(req, config.meta.appSecret)) {
                logger.warn('Invalid Flow signature');
                res.status(432).send('Invalid signature');
                return;
            }

            // Decrypt the request
            let decryptedData;
            try {
                decryptedData = flowsEncryption.decryptRequest(req.body);
            } catch (error) {
                logger.error('Flow decryption error', { error });
                res.status(421).send('Decryption failed');
                return;
            }

            const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptedData;
            const { version, action, screen, data, flow_token } = decryptedBody;

            logger.info('📲 Flow request received', {
                version,
                action,
                screen,
                flow_token,
            });

            let responsePayload: any;

            // Handle different actions
            switch (action) {
                case 'ping':
                    // Health check
                    responsePayload = { data: { status: 'active' } };
                    break;

                case 'INIT':
                    // Flow opened - show RSVP screen
                    responsePayload = await this.handleFlowInit(flow_token, data);
                    break;

                case 'data_exchange':
                    // Screen submitted - process RSVP
                    responsePayload = await this.handleRSVPSubmit(flow_token, data, screen);
                    break;

                case 'BACK':
                    // Back button pressed - refresh screen
                    responsePayload = await this.handleFlowInit(flow_token, data);
                    break;

                default:
                    logger.warn(`Unknown Flow action: ${action}`);
                    responsePayload = {
                        data: {
                            acknowledged: true,
                        },
                    };
            }

            // Encrypt and send response
            const encryptedResponse = flowsEncryption.encryptResponse(
                responsePayload,
                aesKeyBuffer,
                initialVectorBuffer
            );

            res.set('Content-Type', 'text/plain');
            res.send(encryptedResponse);
        } catch (error) {
            logger.error('Flow controller error', { error });
            res.status(500).send('Internal server error');
        }
    }

    /**
     * Handle Flow initialization (INIT action)
     * Returns the RSVP screen with pre-filled data
     */
    private async handleFlowInit(flow_token: string, data: any): Promise<any> {
        // Parse flow_token to get event and invitation IDs
        const [eventId, invitationId] = flow_token.split('_');

        // Fetch invitation details
        const invitationRepo = AppDataSource.getRepository(Invitation);
        const invitation = await invitationRepo.findOne({
            where: { id: invitationId },
            relations: ['event', 'user'],
        });

        if (!invitation) {
            logger.error('Invitation not found for Flow', { invitationId });
            return {
                screen: 'RSVP_SCREEN',
                data: {
                    guest_name: 'Guest',
                    event_title: 'Event',
                    event_date: '',
                    error_message: 'Invitation not found',
                },
            };
        }

        // Format event date
        const eventDate = new Date(invitation.event.eventDate);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });

        return {
            screen: 'RSVP_SCREEN',
            data: {
                guest_name: invitation.guestName,
                event_title: invitation.event.title,
                event_date: formattedDate,
                venue: invitation.event.venueName || 'TBA',
                current_rsvp_status: invitation.rsvpStatus || 'PENDING',
            },
        };
    }

    /**
     * Handle RSVP submission (data_exchange action)
     * Updates invitation status and sends completion message
     */
    private async handleRSVPSubmit(
        flow_token: string,
        data: any,
        screen: string
    ): Promise<any> {
        const [eventId, invitationId] = flow_token.split('_');

        // Extract RSVP data
        const { rsvp_status, guest_count, dietary_restrictions } = data;

        logger.info('Processing RSVP submission', {
            invitationId,
            rsvp_status,
            guest_count,
        });

        // Update invitation in database
        const invitationRepo = AppDataSource.getRepository(Invitation);
        const invitation = await invitationRepo.findOne({
            where: { id: invitationId },
        });

        if (invitation) {
            invitation.rsvpStatus =
                rsvp_status === 'ATTENDING'
                    ? RSVPStatus.ACCEPTED
                    : RSVPStatus.DECLINED;

            if (guest_count) {
                invitation.plusOneCount = parseInt(guest_count);
            }

            await invitationRepo.save(invitation);
            logger.info('✅ Invitation updated', { invitationId, status: invitation.rsvpStatus });
        }

        // Return SUCCESS screen to close Flow and trigger completion message
        return {
            screen: 'SUCCESS',
            data: {
                extension_message_response: {
                    params: {
                        flow_token,
                        rsvp_status,
                        guest_count: guest_count || '0',
                        invitation_id: invitationId,
                    },
                },
            },
        };
    }
}

export default new FlowsController();
