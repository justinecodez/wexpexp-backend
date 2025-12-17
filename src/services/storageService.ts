import { PutObjectCommand } from '@aws-sdk/client-s3';
import s3Client, { s3Config } from '../config/s3.config';
import logger from '../config/logger';

class StorageService {
    /**
     * Upload a file to R2/S3 storage
     */
    async uploadFile(
        fileBuffer: Buffer,
        fileName: string,
        contentType: string
    ): Promise<string> {
        // Ensure bucket is set
        if (!s3Config.bucketName) {
            throw new Error('Storage bucket is not configured (S3_BUCKET_NAME missing)');
        }

        try {
            const command = new PutObjectCommand({
                Bucket: s3Config.bucketName,
                Key: fileName,
                Body: fileBuffer,
                ContentType: contentType,
            });

            await s3Client.send(command);
            logger.info(`🚀 File uploaded to R2/S3: ${fileName}`);

            // Construct public URL
            // Prioritize S3_PUBLIC_URL_BASE if defined (preferred for R2 custom domains)
            const publicBaseUrl = process.env.S3_PUBLIC_URL_BASE;

            if (publicBaseUrl) {
                // Ensure no trailing slash on base and ensure leading slash on filename
                const base = publicBaseUrl.endsWith('/') ? publicBaseUrl.slice(0, -1) : publicBaseUrl;
                const path = fileName.startsWith('/') ? fileName : `/${fileName}`;
                return `${base}${path}`;
            }

            // Fallback: Construct generic S3/R2 URL if endpoint is available
            const endpoint = process.env.S3_ENDPOINT;
            if (endpoint) {
                const cleanEndpoint = endpoint.replace(/^https?:\/\//, '');
                return `https://${s3Config.bucketName}.${cleanEndpoint}/${fileName}`;
            }

            throw new Error('Could not construct public URL: S3_PUBLIC_URL_BASE and S3_ENDPOINT are missing');
        } catch (error) {
            logger.error('Error uploading file to storage:', error);
            throw error;
        }
    }
}

export const storageService = new StorageService();
