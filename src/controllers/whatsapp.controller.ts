import { Request, Response } from 'express';
import logger from '../config/logger';
import { WhatsAppService } from '../services/whatsapp.service';

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
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'wexp_webhook_secret_2024';

        logger.info('WhatsApp webhook verification attempt', {
            mode,
            tokenMatch: token === verifyToken,
        });

        // Check if mode and token are correct
        if (mode === 'subscribe' && token === verifyToken) {
            logger.info('WhatsApp webhook verified successfully');
            res.status(200).send(challenge);
        } else {
            logger.warn('WhatsApp webhook verification failed');
            res.sendStatus(403);
        }
    };

    /**
     * Handle incoming webhook events from WhatsApp
     * POST /webhooks/whatsapp
     */
    handleWebhook = async (req: Request, res: Response): Promise<void> => {
        try {
            const body = req.body;

            logger.info('WhatsApp webhook received', {
                object: body.object,
                entries: body.entry?.length || 0,
            });

            // Respond quickly to Meta (they expect 200 within 20 seconds)
            res.sendStatus(200);

            // Process webhook asynchronously
            if (body.object === 'whatsapp_business_account') {
                for (const entry of body.entry || []) {
                    for (const change of entry.changes || []) {
                        await this.whatsAppService.processWebhookChange(change);
                    }
                }
            }
        } catch (error) {
            logger.error('Error handling WhatsApp webhook:', error);
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
