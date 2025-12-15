import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
    'S3_ENDPOINT',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_BUCKET_NAME'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.warn(`⚠️ Missing S3/R2 environment variables: ${missingVars.join(', ')}`);
}

const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ''
    },
    forcePathStyle: true // Needed for R2 and generic S3-compatible endpoints
});

export const s3Config = {
    bucketName: process.env.S3_BUCKET_NAME || '',
    region: process.env.S3_REGION || 'auto'
};

export default s3Client;
