import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import config from '../config';
import logger from '../config/logger';

class StorageService {
    private s3Client: S3Client | null = null;
    private bucketName: string = '';

    constructor() {
        if (config.backblaze) {
            this.s3Client = new S3Client({
                endpoint: config.backblaze.endpoint.startsWith('http')
                    ? config.backblaze.endpoint
                    : `https://${config.backblaze.endpoint}`,
                region: 'us-east-1', // Backblaze B2 uses us-east-1 signature version 4
                credentials: {
                    accessKeyId: config.backblaze.applicationKeyId,
                    secretAccessKey: config.backblaze.applicationKey,
                },
            });
            this.bucketName = config.backblaze.bucketName;
        } else if (config.aws) {
            this.s3Client = new S3Client({
                region: config.aws.region,
                credentials: {
                    accessKeyId: config.aws.accessKeyId,
                    secretAccessKey: config.aws.secretAccessKey,
                },
            });
            this.bucketName = config.aws.bucketName;
        }
    }

    async uploadFile(
        fileBuffer: Buffer,
        fileName: string,
        contentType: string
    ): Promise<string> {
        if (!this.s3Client) {
            throw new Error('Storage service is not configured');
        }

        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
                Body: fileBuffer,
                ContentType: contentType,
                // ACL: 'public-read', // Backblaze B2 buckets are private by default, but we can set public access on the bucket level or use presigned URLs. 
                // For this use case, we assume the bucket is configured to allow public read or we're generating public URLs.
            });

            await this.s3Client.send(command);

            // Construct public URL
            if (config.backblaze) {
                // Backblaze B2 friendly URL format: https://<bucketName>.<endpoint>/<fileName>
                // OR S3 compatible: https://<endpoint>/<bucketName>/<fileName>
                // Let's use the S3 compatible format which is safer
                const endpoint = config.backblaze.endpoint.startsWith('http')
                    ? config.backblaze.endpoint
                    : `https://${config.backblaze.endpoint}`;

                return `${endpoint}/${this.bucketName}/${fileName}`;
            } else {
                // AWS S3 standard URL
                return `https://${this.bucketName}.s3.${config.aws?.region}.amazonaws.com/${fileName}`;
            }
        } catch (error) {
            logger.error('Error uploading file to storage:', error);
            throw error;
        }
    }
}

export const storageService = new StorageService();
