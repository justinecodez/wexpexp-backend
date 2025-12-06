import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
    'BACKBLAZE_B2_ENDPOINT',
    'BACKBLAZE_B2_KEY_ID',
    'BACKBLAZE_B2_APPLICATION_KEY',
    'BACKBLAZE_B2_BUCKET',
    'BACKBLAZE_B2_BUCKET_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.warn(`⚠️ Missing Backblaze B2 environment variables: ${missingVars.join(', ')}`);
}

const s3Client = new S3Client({
    endpoint: `https://${process.env.BACKBLAZE_B2_ENDPOINT}`,
    region: 'eu-central-003', // Derived from endpoint or configurable
    credentials: {
        accessKeyId: process.env.BACKBLAZE_B2_KEY_ID || '',
        secretAccessKey: process.env.BACKBLAZE_B2_APPLICATION_KEY || ''
    },
    forcePathStyle: true // Needed for some S3 compatible storages, usually good for B2
});

export const s3Config = {
    bucketName: process.env.BACKBLAZE_B2_BUCKET || '',
    bucketId: process.env.BACKBLAZE_B2_BUCKET_ID || '',
    region: 'eu-central-003'
};

export default s3Client;
