import { AppDataSource } from '../config/database';
import { Campaign } from '../entities/Campaign';
import { CampaignRecipient } from '../entities/CampaignRecipient';
import { CampaignStatus, RecipientStatus } from '../entities/enums';
import { WhatsAppService } from './whatsapp.service';
import conversationService from './conversationService';
import logger from '../config/logger';
import * as XLSX from 'xlsx';
import { normalizePhone } from '../utils/phoneUtils';

const whatsAppService = new WhatsAppService();

interface ImportResult {
    total: number;
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
}

export class CampaignService {
    /**
     * Import recipients from Excel file
     */
    async importRecipientsFromExcel(
        campaignId: string,
        fileBuffer: Buffer
    ): Promise<ImportResult> {
        const campaignRepo = AppDataSource.getRepository(Campaign);
        const recipientRepo = AppDataSource.getRepository(CampaignRecipient);

        const campaign = await campaignRepo.findOne({ where: { id: campaignId } });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.status !== CampaignStatus.DRAFT) {
            throw new Error('Cannot import recipients to campaign that is not in DRAFT status');
        }

        const result: ImportResult = {
            total: 0,
            imported: 0,
            failed: 0,
            errors: [],
        };

        try {
            // Parse Excel file
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);

            result.total = data.length;

            // Process each row
            for (let i = 0; i < data.length; i++) {
                const row: any = data[i];
                const rowNumber = i + 2; // Excel rows start at 1, header is row 1

                try {
                    // Get phone from various possible column names
                    const phone = row['Phone'] || row['phone'] || row['PHONE'] || row['Phone Number'] || row['phone_number'];
                    const name = row['Name'] || row['name'] || row['NAME'] || '';

                    if (!phone) {
                        result.errors.push({ row: rowNumber, error: 'Missing phone number' });
                        result.failed++;
                        continue;
                    }

                    // Clean and validate phone number using centralized utility
                    const cleanPhone = normalizePhone(phone);

                    if (!cleanPhone) {
                        result.errors.push({
                            row: rowNumber,
                            error: `Invalid phone format: ${phone}.`
                        });
                        result.failed++;
                        continue;
                    }

                    // Check for duplicate in this campaign
                    const existing = await recipientRepo.findOne({
                        where: { campaign: { id: campaignId }, phone: cleanPhone },
                    });

                    if (existing) {
                        result.errors.push({ row: rowNumber, error: 'Duplicate phone number' });
                        result.failed++;
                        continue;
                    }

                    // Create recipient
                    const recipient = recipientRepo.create({
                        campaign: { id: campaignId },
                        name: String(name || '').trim(),
                        phone: cleanPhone,
                        status: RecipientStatus.PENDING,
                    });

                    await recipientRepo.save(recipient);
                    result.imported++;
                } catch (error) {
                    logger.error(`Error processing row ${rowNumber}`, { error });
                    result.errors.push({ row: rowNumber, error: (error as Error).message });
                    result.failed++;
                }
            }

            // Update campaign total recipients count
            campaign.totalRecipients = await recipientRepo.count({
                where: { campaign: { id: campaignId } },
            });
            await campaignRepo.save(campaign);

            logger.info(`Excel import completed for campaign ${campaignId}`, result);
            return result;
        } catch (error) {
            logger.error('Error importing Excel file', { error });
            throw new Error('Failed to parse Excel file');
        }
    }

    /**
     * Send campaign to all recipients
     */
    async sendCampaign(campaignId: string, userId: string): Promise<any> {
        const campaignRepo = AppDataSource.getRepository(Campaign);
        const recipientRepo = AppDataSource.getRepository(CampaignRecipient);

        const campaign = await campaignRepo.findOne({
            where: { id: campaignId },
            relations: ['createdBy'],
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        // Only send campaigns in DRAFT status
        if (campaign.status !== CampaignStatus.DRAFT) {
            throw new Error('Campaign can only be sent from DRAFT status');
        }

        // Fetch recipients explicitly by campaign relation and ensure status is PENDING
        const recipients = await recipientRepo.find({
            where: {
                campaign: { id: campaignId },
                status: RecipientStatus.PENDING
            },
        });

        if (recipients.length === 0) {
            throw new Error('No recipients to send to. Please make sure recipients are in PENDING status.');
        }

        // Update campaign status
        campaign.status = CampaignStatus.SENDING;
        campaign.startedAt = new Date();
        await campaignRepo.save(campaign);

        // Send messages in background (don't await)
        this.sendMessagesToRecipients(campaign, recipients).catch((error) => {
            logger.error('Error in campaign sending process', { campaignId, error });
        });

        return {
            message: 'Campaign sending started',
            campaignId,
            recipientCount: recipients.length,
        };
    }

    /**
     * Send messages to all recipients (background process)
     */
    private async sendMessagesToRecipients(
        campaign: Campaign,
        recipients: CampaignRecipient[]
    ): Promise<void> {
        const campaignRepo = AppDataSource.getRepository(Campaign);
        const recipientRepo = AppDataSource.getRepository(CampaignRecipient);

        let sentCount = 0;
        let failedCount = 0;

        for (const recipient of recipients) {
            try {
                // Prepare template components
                const components: any[] = [];

                // Extract or infer attachment type
                let mediaType = campaign.attachmentType;
                if (!mediaType && campaign.attachmentUrl) {
                    const url = campaign.attachmentUrl.toLowerCase();
                    if (url.match(/\.(jpeg|jpg|gif|png|webp)$/)) mediaType = 'image';
                    else if (url.match(/\.(mp4|3gp|mov)$/)) mediaType = 'video';
                    else if (url.match(/\.(pdf|doc|docx|xls|xlsx)$/)) mediaType = 'document';

                    if (mediaType) {
                        logger.info(`Inferred media type "${mediaType}" for campaign ${campaign.id} from URL`);
                    }
                }

                // Add header component if attachment is provided
                if (campaign.attachmentUrl && mediaType) {
                    const headerComponent: any = {
                        type: 'header',
                        parameters: [{
                            type: mediaType,
                            [mediaType]: { link: campaign.attachmentUrl }
                        }],
                    };
                    components.push(headerComponent);
                    logger.info(`Added ${mediaType} header to payload for recipient ${recipient.phone}`);
                } else if (campaign.attachmentUrl) {
                    logger.warn(`Campaign has attachmentUrl but could not determine mediaType. Header skipped.`, {
                        url: campaign.attachmentUrl,
                        type: campaign.attachmentType
                    });
                }

                // ALWAYS include body component even if empty (required by some templates)
                components.push({
                    type: 'body',
                    parameters: []
                });

                // Send WhatsApp template message
                const response = await whatsAppService.sendTemplateMessage(
                    recipient.phone,
                    campaign.templateName,
                    campaign.language || 'en',
                    components,
                    recipient.name || undefined
                );

                const messageId = response.messages?.[0]?.id;

                // Update recipient status
                recipient.status = RecipientStatus.SENT;
                recipient.messageId = messageId;
                recipient.sentAt = new Date();
                recipient.errorMessage = null; // Clear any previous errors
                await recipientRepo.save(recipient);

                // Store in conversation table
                if (messageId) {
                    await conversationService.storeTemplateMessage(
                        recipient.phone,
                        messageId,
                        campaign.templateName,
                        campaign.language || 'en', // Use campaign's language
                        { components },
                        recipient.name || undefined
                    );
                }

                sentCount++;

                // Update campaign counts
                campaign.sentCount = sentCount;
                await campaignRepo.save(campaign);

                // Add delay between messages (rate limiting)
                await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5 seconds
            } catch (error: any) {
                // Extract detailed error message from WhatsApp API
                let errorMessage = (error as Error).message;

                if (error.response?.data?.error?.message) {
                    errorMessage = error.response.data.error.message;
                    if (error.response.data.error.error_data?.details) {
                        errorMessage += `: ${error.response.data.error.error_data.details}`;
                    }
                }

                logger.error(`Failed to send to recipient ${recipient.id}`, {
                    error: errorMessage,
                    phone: recipient.phone
                });

                // Update recipient status
                recipient.status = RecipientStatus.FAILED;
                recipient.errorMessage = errorMessage;
                await recipientRepo.save(recipient);

                failedCount++;
                campaign.failedCount = failedCount;
                await campaignRepo.save(campaign);
            }
        }

        // Mark campaign as completed
        campaign.status = CampaignStatus.COMPLETED;
        campaign.completedAt = new Date();
        await campaignRepo.save(campaign);

        logger.info(`Campaign ${campaign.id} completed`, {
            sentCount,
            failedCount,
            totalRecipients: recipients.length,
        });
    }
}

export default new CampaignService();
