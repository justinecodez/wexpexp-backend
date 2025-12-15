import { DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import s3Client, { s3Config } from '../config/s3.config';
import logger from '../config/logger';

/**
 * R2 Storage Service for managing file operations in Cloudflare R2
 */
class R2StorageService {
    /**
     * Delete a single card file from R2 storage
     */
    async deleteCardFile(cardUrl: string): Promise<void> {
        if (!cardUrl) {
            logger.warn('Attempted to delete card with empty URL');
            return;
        }

        try {
            const key = this.extractKeyFromUrl(cardUrl);

            const command = new DeleteObjectCommand({
                Bucket: s3Config.bucketName,
                Key: key,
            });

            await s3Client.send(command);
            logger.info(`🗑️ Deleted card from R2: ${key}`);
        } catch (error: any) {
            logger.error(`Failed to delete card from R2: ${cardUrl}`, error);
            // Don't throw - continue with other deletions
        }
    }

    /**
     * Delete multiple card files from R2 storage
     */
    async deleteMultipleCards(cardUrls: string[]): Promise<{ deleted: number; failed: number }> {
        if (!cardUrls || cardUrls.length === 0) {
            return { deleted: 0, failed: 0 };
        }

        logger.info(`🗑️ Deleting ${cardUrls.length} cards from R2...`);

        const results = await Promise.allSettled(
            cardUrls.map(url => this.deleteCardFile(url))
        );

        const deleted = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        logger.info(`✅ Deleted ${deleted} cards, ${failed} failed`);

        return { deleted, failed };
    }

    /**
     * Extract object key from R2 public URL
     * Example: https://pub-xxx.r2.dev/cards/event-123/inv-456.png -> cards/event-123/inv-456.png
     */
    private extractKeyFromUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            // Remove leading slash from pathname
            return urlObj.pathname.substring(1);
        } catch (error) {
            logger.error(`Invalid URL format: ${url}`);
            throw new Error(`Invalid card URL: ${url}`);
        }
    }
}

export default new R2StorageService();
