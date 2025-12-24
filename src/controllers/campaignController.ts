import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Campaign } from '../entities/Campaign';
import { CampaignRecipient } from '../entities/CampaignRecipient';
import { CampaignStatus, RecipientStatus } from '../entities/enums';
import logger from '../config/logger';
import campaignService from '../services/campaignService';
import { normalizePhone } from '../utils/phoneUtils';

export class CampaignController {
    /**
     * Create a new campaign
     */
    async createCampaign(req: Request, res: Response): Promise<void> {
        try {
            const { name, templateName, attachmentUrl, attachmentType, language } = req.body;
            const userId = (req as any).user?.userId; // JWT payload has userId, not id

            // TEMPORARILY DISABLED - Auth middleware is off for testing
            // if (!userId) {
            //     res.status(401).json({ message: 'Unauthorized' });
            //     return;
            // }

            const campaignRepo = AppDataSource.getRepository(Campaign);
            const campaign = campaignRepo.create({
                name,
                templateName,
                attachmentUrl,
                attachmentType,
                language: language || 'en', // Default to English
                status: CampaignStatus.DRAFT,
                // Only set createdBy if userId exists
                ...(userId && { createdBy: { id: userId } }),
            });

            await campaignRepo.save(campaign);

            logger.info(`Campaign created: ${campaign.id}`, { userId, campaignName: name });
            res.status(201).json(campaign);
        } catch (error) {
            logger.error('Error creating campaign', { error, errorMessage: (error as Error).message });
            console.error('POST /campaigns error details:', error);
            res.status(500).json({ message: 'Failed to create campaign', error: (error as Error).message });
        }
    }

    /**
     * Get all campaigns
     */
    async getCampaigns(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId; // JWT payload has userId, not id
            const campaignRepo = AppDataSource.getRepository(Campaign);

            const campaigns = await campaignRepo.find({
                where: { createdBy: { id: userId } },
                relations: ['createdBy', 'recipients'],
                order: { createdAt: 'DESC' },
            });

            res.json(campaigns);
        } catch (error) {
            logger.error('Error fetching campaigns', { error, errorMessage: (error as Error).message, stack: (error as Error).stack });
            console.error('GET /campaigns error details:', error);
            res.status(500).json({ message: 'Failed to fetch campaigns' });
        }
    }

    /**
     * Get campaign by ID
     */
    async getCampaignById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const campaignRepo = AppDataSource.getRepository(Campaign);

            const campaign = await campaignRepo.findOne({
                where: { id },
                relations: ['createdBy', 'recipients'],
            });

            if (!campaign) {
                res.status(404).json({ message: 'Campaign not found' });
                return;
            }

            res.json(campaign);
        } catch (error) {
            logger.error('Error fetching campaign', { error });
            res.status(500).json({ message: 'Failed to fetch campaign' });
        }
    }

    /**
     * Update campaign
     */
    async updateCampaign(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { name, templateName, attachmentUrl, attachmentType, language } = req.body;
            const campaignRepo = AppDataSource.getRepository(Campaign);
            const recipientRepo = AppDataSource.getRepository(CampaignRecipient);

            const campaign = await campaignRepo.findOne({ where: { id } });

            if (!campaign) {
                res.status(404).json({ message: 'Campaign not found' });
                return;
            }

            // Update fields
            if (name) campaign.name = name;
            if (templateName) campaign.templateName = templateName;
            if (attachmentUrl !== undefined) campaign.attachmentUrl = attachmentUrl;
            if (attachmentType !== undefined) campaign.attachmentType = attachmentType;
            if (language) campaign.language = language as 'en' | 'sw';

            // Reset status to DRAFT if campaign was edited
            // This allows re-sending of completed/failed campaigns
            if (campaign.status === CampaignStatus.DRAFT || campaign.status === CampaignStatus.COMPLETED || campaign.status === CampaignStatus.FAILED) {
                if (campaign.status !== CampaignStatus.DRAFT) {
                    campaign.status = CampaignStatus.DRAFT;
                }

                // Also reset all recipients to PENDING status if they aren't already
                const recipients = await recipientRepo.find({
                    where: { campaign: { id } }
                });

                const needsReset = recipients.some(r => r.status !== RecipientStatus.PENDING);
                logger.info(`Campaign ${id} has ${recipients.length} recipients. Needs reset: ${needsReset}`);

                if (needsReset) {
                    logger.info(`Resetting ${recipients.length} recipients to PENDING for campaign ${id}`);
                    for (const recipient of recipients) {
                        recipient.status = RecipientStatus.PENDING;
                        recipient.sentAt = null;
                        recipient.deliveredAt = null;
                        recipient.errorMessage = null;
                        recipient.messageId = null;
                    }
                    const savedRecipients = await recipientRepo.save(recipients);
                    logger.info(`Successfully reset ${savedRecipients.length} recipients for campaign ${id}`);
                }

                // Reset campaign counts
                campaign.sentCount = 0;
                campaign.deliveredCount = 0;
                campaign.failedCount = 0;
                campaign.startedAt = null;
                campaign.completedAt = null;
            }

            await campaignRepo.save(campaign);

            logger.info(`Campaign updated: ${campaign.id}`);
            res.json(campaign);
        } catch (error) {
            logger.error('Error updating campaign', { error });
            res.status(500).json({ message: 'Failed to update campaign' });
        }
    }

    /**
     * Delete campaign
     */
    async deleteCampaign(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const campaignRepo = AppDataSource.getRepository(Campaign);

            const campaign = await campaignRepo.findOne({ where: { id } });

            if (!campaign) {
                res.status(404).json({ message: 'Campaign not found' });
                return;
            }

            await campaignRepo.remove(campaign);

            logger.info(`Campaign deleted: ${id}`);
            res.json({ message: 'Campaign deleted successfully' });
        } catch (error) {
            logger.error('Error deleting campaign', { error });
            res.status(500).json({ message: 'Failed to delete campaign' });
        }
    }

    /**
     * Add manual recipient
     */
    async addRecipient(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { name, phone } = req.body;

            const campaignRepo = AppDataSource.getRepository(Campaign);
            const recipientRepo = AppDataSource.getRepository(CampaignRecipient);

            const campaign = await campaignRepo.findOne({ where: { id } });

            if (!campaign) {
                res.status(404).json({ message: 'Campaign not found' });
                return;
            }

            if (campaign.status !== CampaignStatus.DRAFT) {
                res.status(400).json({ message: 'Cannot add recipients to campaign that is not in DRAFT status' });
                return;
            }

            // Use centralized phone normalization
            const cleanPhone = normalizePhone(phone);

            if (!cleanPhone) {
                res.status(400).json({ message: `Invalid phone number format: ${phone}.` });
                return;
            }

            // Check for duplicate
            const existing = await recipientRepo.findOne({
                where: { campaign: { id }, phone: cleanPhone },
            });

            if (existing) {
                res.status(400).json({ message: 'Recipient already exists in this campaign' });
                return;
            }

            const recipient = recipientRepo.create({
                campaign: { id },
                name,
                phone: cleanPhone,
                status: RecipientStatus.PENDING,
            });

            await recipientRepo.save(recipient);

            // Update total recipients count
            campaign.totalRecipients = (campaign.totalRecipients || 0) + 1;
            await campaignRepo.save(campaign);

            logger.info(`Recipient added to campaign ${id}`, { phone: cleanPhone });
            res.status(201).json(recipient);
        } catch (error) {
            logger.error('Error adding recipient', { error });
            res.status(500).json({ message: 'Failed to add recipient' });
        }
    }

    /**
     * Import recipients from Excel
     */
    async importRecipients(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const file = (req as any).file;

            if (!file) {
                res.status(400).json({ message: 'No file uploaded' });
                return;
            }

            const campaignRepo = AppDataSource.getRepository(Campaign);
            const campaign = await campaignRepo.findOne({ where: { id } });

            if (!campaign) {
                res.status(404).json({ message: 'Campaign not found' });
                return;
            }

            if (campaign.status !== CampaignStatus.DRAFT) {
                res.status(400).json({ message: 'Cannot import recipients to campaign that is not in DRAFT status' });
                return;
            }

            const result = await campaignService.importRecipientsFromExcel(id, file.buffer);

            logger.info(`Imported ${result.imported} recipients to campaign ${id}`, {
                total: result.total,
                imported: result.imported,
                failed: result.failed,
            });

            res.json(result);
        } catch (error) {
            logger.error('Error importing recipients', { error });
            res.status(500).json({ message: 'Failed to import recipients' });
        }
    }

    /**
     * Update an individual recipient
     */
    async updateRecipient(req: Request, res: Response): Promise<void> {
        try {
            const { id, recipientId } = req.params;
            const { name, phone } = req.body;
            const recipientRepo = AppDataSource.getRepository(CampaignRecipient);

            const recipient = await recipientRepo.findOne({
                where: { id: recipientId, campaign: { id } },
            });

            if (!recipient) {
                res.status(404).json({ message: 'Recipient not found' });
                return;
            }

            if (name !== undefined) recipient.name = name;

            if (phone !== undefined) {
                // Use centralized phone normalization
                const cleanPhone = normalizePhone(phone);

                if (!cleanPhone) {
                    res.status(400).json({ message: 'Invalid phone number format' });
                    return;
                }
                recipient.phone = cleanPhone;
            }

            await recipientRepo.save(recipient);
            res.json(recipient);
        } catch (error) {
            logger.error('Error updating recipient', { error });
            res.status(500).json({ message: 'Failed to update recipient' });
        }
    }

    /**
     * Remove recipient
     */
    async removeRecipient(req: Request, res: Response): Promise<void> {
        try {
            const { id, recipientId } = req.params;
            const recipientRepo = AppDataSource.getRepository(CampaignRecipient);
            const campaignRepo = AppDataSource.getRepository(Campaign);

            const recipient = await recipientRepo.findOne({
                where: { id: recipientId, campaign: { id } },
            });

            if (!recipient) {
                res.status(404).json({ message: 'Recipient not found' });
                return;
            }

            const campaign = await campaignRepo.findOne({ where: { id } });
            if (campaign && campaign.status === CampaignStatus.DRAFT) {
                await recipientRepo.remove(recipient);

                // Update total recipients count
                campaign.totalRecipients = Math.max(0, (campaign.totalRecipients || 0) - 1);
                await campaignRepo.save(campaign);

                logger.info(`Recipient removed from campaign ${id}`);
                res.json({ message: 'Recipient removed successfully' });
            } else {
                res.status(400).json({ message: 'Cannot remove recipients from campaign that is not in DRAFT status' });
            }
        } catch (error) {
            logger.error('Error removing recipient', { error });
            res.status(500).json({ message: 'Failed to remove recipient' });
        }
    }

    /**
     * Send campaign
     */
    async sendCampaign(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = (req as any).user?.userId || 'system'; // Default to 'system' if auth is disabled

            const result = await campaignService.sendCampaign(id, userId);

            logger.info(`Campaign send initiated: ${id}`);
            res.json(result);
        } catch (error) {
            const errorMessage = (error as Error).message || 'Failed to send campaign';
            logger.error('Error sending campaign', {
                campaignId: req.params.id,
                error: errorMessage,
                stack: (error as Error).stack
            });
            res.status(500).json({ message: errorMessage });
        }
    }

    /**
     * Get campaign statistics
     */
    async getCampaignStats(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const campaignRepo = AppDataSource.getRepository(Campaign);

            const campaign = await campaignRepo.findOne({
                where: { id },
                relations: ['recipients'],
            });

            if (!campaign) {
                res.status(404).json({ message: 'Campaign not found' });
                return;
            }

            const stats = {
                total: campaign.totalRecipients,
                sent: campaign.sentCount,
                delivered: campaign.deliveredCount,
                failed: campaign.failedCount,
                pending: campaign.totalRecipients - campaign.sentCount,
                status: campaign.status,
            };

            res.json(stats);
        } catch (error) {
            logger.error('Error fetching campaign stats', { error });
            res.status(500).json({ message: 'Failed to fetch campaign statistics' });
        }
    }
    /**
     * Upload campaign attachment
     */
    async uploadAttachment(req: Request, res: Response): Promise<void> {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No file uploaded' });
                return;
            }

            const { storageService } = await import('../services/storageService');
            const file = req.file;
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const fileName = `campaigns/${uniqueSuffix}-${file.originalname}`;

            const url = await storageService.uploadFile(
                file.buffer,
                fileName,
                file.mimetype
            );

            res.json({ url, filename: file.originalname, mimetype: file.mimetype });
        } catch (error) {
            logger.error('Error uploading campaign attachment', { error });
            res.status(500).json({ message: 'Failed to upload attachment' });
        }
    }
}

export default new CampaignController();
