import { Request, Response } from 'express';
import logger from '../config/logger';
import { WhatsAppService } from '../services/whatsapp.service';
import config from '../config';

export class WhatsAppController {
    private whatsAppService: WhatsAppService;

    constructor() {
        this.whatsAppService = new WhatsAppService();
    }

    /**
     * Verify webhook - Meta calls this to verify your webhook URL
     * GET /webhooks/whatsapp?hub.mode=subscribe&hub.challenge=CHALLENGE&hub.verify_token=TOKEN
     */
    verifyWebhook = (req: Request, res: Response): void => {
        // Extract query parameters and ensure they're strings
        const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : undefined;
        const token = typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : undefined;
        const challenge = typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : undefined;

        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || config.whatsapp.verifyToken || 'wexp_webhook_secret_2024';

        logger.info('🔐 WhatsApp Webhook Verification Request', {
            mode,
            receivedToken: token ? `***${token.slice(-4)}` : 'MISSING',
            expectedToken: verifyToken ? `***${verifyToken.slice(-4)}` : 'MISSING',
            tokenMatch: token === verifyToken,
            challenge: challenge,
            queryParams: JSON.stringify(req.query),
        });

        // Check if mode and token are correct
        if (mode === 'subscribe' && token === verifyToken && challenge) {
            logger.info('✅ WhatsApp webhook verified successfully - Challenge returned', {
                challenge: challenge,
            });
            // Return challenge as plain text (not JSON)
            res.status(200).type('text/plain').send(challenge);
        } else {
            logger.warn('❌ WhatsApp webhook verification failed', {
                reason: mode !== 'subscribe' ? 'Invalid mode' : token !== verifyToken ? 'Token mismatch' : 'Missing challenge',
                mode,
                receivedToken: token || 'MISSING',
                expectedToken: verifyToken,
                tokenMatch: token === verifyToken,
                hasChallenge: !!challenge,
            });
            res.sendStatus(403);
        }
    };

    /**
     * Handle incoming webhook events from WhatsApp
     * POST /webhooks/whatsapp
     */
    handleWebhook = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        try {
            const body = req.body;

            logger.info('📥 WhatsApp Webhook Event Received - Full Payload', {
                object: body.object,
                entriesCount: body.entry?.length || 0,
                fullBody: JSON.stringify(body, null, 2),
                headers: {
                    'content-type': req.headers['content-type'],
                    'x-hub-signature-256': req.headers['x-hub-signature-256'],
                    'user-agent': req.headers['user-agent'],
                },
                requestMethod: req.method,
                requestUrl: req.url,
                requestIp: req.ip,
            });

            // Respond quickly to Meta (they expect 200 within 20 seconds)
            res.sendStatus(200);

            // Process webhook asynchronously
            if (body.object === 'whatsapp_business_account') {
                logger.info(`📋 Processing ${body.entry?.length || 0} webhook entry/entries`);
                
                for (const entry of body.entry || []) {
                    logger.info('📋 Processing webhook entry', {
                        entryId: entry.id,
                        changesCount: entry.changes?.length || 0,
                        fullEntry: JSON.stringify(entry, null, 2),
                    });

                    for (const change of entry.changes || []) {
                        logger.info('🔄 Processing webhook change', {
                            field: change.field,
                            changeId: change.id || 'N/A',
                            valueKeys: change.value ? Object.keys(change.value) : [],
                            hasMessages: !!(change.value?.messages && change.value.messages.length > 0),
                            hasStatuses: !!(change.value?.statuses && change.value.statuses.length > 0),
                            hasContacts: !!(change.value?.contacts && change.value.contacts.length > 0),
                            hasMetadata: !!change.value?.metadata,
                            fullChange: JSON.stringify(change, null, 2),
                        });

                        await this.whatsAppService.processWebhookChange(change);
                    }
                }
            } else {
                logger.warn('⚠️ Unknown webhook object type', {
                    object: body.object,
                    fullBody: JSON.stringify(body, null, 2),
                });
            }

            const processingTime = Date.now() - startTime;
            logger.info('✅ WhatsApp webhook processed successfully', {
                processingTime: `${processingTime}ms`,
                object: body.object,
                entriesProcessed: body.entry?.length || 0,
            });
        } catch (error: any) {
            const processingTime = Date.now() - startTime;
            logger.error('❌ Error handling WhatsApp webhook:', {
                error: error.message,
                stack: error.stack,
                processingTime: `${processingTime}ms`,
                fullBody: JSON.stringify(req.body, null, 2),
                headers: JSON.stringify(req.headers),
            });
            // Still send 200 to Meta to avoid retries
            res.sendStatus(200);
        }
    };
    /**
     * Send a template message
     * POST /api/whatsapp/send-template
     */
    sendTemplate = async (req: Request, res: Response): Promise<void> => {
        try {
            const { to, templateName, languageCode, components } = req.body;

            if (!to || !templateName) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields: to, templateName'
                });
                return;
            }

            const result = await this.whatsAppService.sendTemplateMessage(
                to,
                templateName,
                languageCode,
                components
            );

            res.status(200).json({
                success: true,
                message: 'Template message sent successfully',
                data: result
            });
        } catch (error: any) {
            logger.error('Error in sendTemplate controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send template message',
                error: error.response?.data || error.message
            });
        }
    };
}
