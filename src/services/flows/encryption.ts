import crypto from 'crypto';
import { Request } from 'express';
import config from '../../config';
import logger from '../../config/logger';

/**
 * WhatsApp Flows Encryption/Decryption Utilities
 * Handles encryption and decryption of Flow payloads using AES-GCM and RSA-OAEP
 */

interface EncryptedRequest {
    encrypted_aes_key: string;
    encrypted_flow_data: string;
    initial_vector: string;
}

interface DecryptedData {
    decryptedBody: any;
    aesKeyBuffer: Buffer;
    initialVectorBuffer: Buffer;
}

export class FlowsEncryption {
    private privateKey: string;

    constructor() {
        this.privateKey = config.flows.privateKey;

        if (!this.privateKey) {
            logger.warn('⚠️ FLOWS_PRIVATE_KEY not configured - WhatsApp Flows will not work');
        }
    }

    /**
     * Decrypt incoming Flow request
     */
    decryptRequest(encryptedRequest: EncryptedRequest): DecryptedData {
        if (!this.privateKey) {
            throw new Error('FLOWS_PRIVATE_KEY not configured. Please add it to your .env file to use WhatsApp Flows.');
        }

        const { encrypted_aes_key, encrypted_flow_data, initial_vector } = encryptedRequest;

        try {
            // Decrypt the AES key using RSA private key
            const encryptedAesKeyBuffer = Buffer.from(encrypted_aes_key, 'base64');
            const aesKeyBuffer = crypto.privateDecrypt(
                {
                    key: crypto.createPrivateKey(this.privateKey),
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: 'sha256',
                },
                encryptedAesKeyBuffer
            );

            // Decrypt the Flow data using AES-GCM
            const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64');
            const initialVectorBuffer = Buffer.from(initial_vector, 'base64');

            const TAG_LENGTH = 16;
            const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH);
            const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH);

            const decipher = crypto.createDecipheriv(
                'aes-128-gcm',
                aesKeyBuffer,
                initialVectorBuffer
            );
            decipher.setAuthTag(encrypted_flow_data_tag);

            const decryptedJSONString = Buffer.concat([
                decipher.update(encrypted_flow_data_body),
                decipher.final(),
            ]).toString('utf-8');

            const decryptedBody = JSON.parse(decryptedJSONString);

            logger.info('✅ Flow request decrypted successfully', {
                action: decryptedBody.action,
                screen: decryptedBody.screen,
                version: decryptedBody.version,
            });

            return {
                decryptedBody,
                aesKeyBuffer,
                initialVectorBuffer,
            };
        } catch (error) {
            logger.error('❌ Flow decryption failed', { error });
            throw new Error('Failed to decrypt Flow request');
        }
    }

    /**
     * Encrypt outgoing Flow response
     */
    encryptResponse(
        response: any,
        aesKeyBuffer: Buffer,
        initialVectorBuffer: Buffer
    ): string {
        try {
            // Flip the initialization vector
            const flipped_iv = Buffer.from(initialVectorBuffer).map(byte => ~byte);

            // Encrypt the response data using AES-GCM
            const cipher = crypto.createCipheriv(
                'aes-128-gcm',
                aesKeyBuffer,
                flipped_iv
            );

            const encryptedData = Buffer.concat([
                cipher.update(JSON.stringify(response), 'utf-8'),
                cipher.final(),
                cipher.getAuthTag(),
            ]).toString('base64');

            logger.info('✅ Flow response encrypted successfully');

            return encryptedData;
        } catch (error) {
            logger.error('❌ Flow encryption failed', { error });
            throw new Error('Failed to encrypt Flow response');
        }
    }

    /**
     * Validate request signature
     */
    validateSignature(req: Request, appSecret: string): boolean {
        const signature = req.headers['x-hub-signature-256'] as string;

        if (!signature) {
            logger.warn('⚠️ No signature in Flow request headers');
            return false;
        }

        const signatureHash = signature.replace('sha256=', '');
        const body = JSON.stringify(req.body);

        const expectedHash = crypto
            .createHmac('sha256', appSecret)
            .update(body)
            .digest('hex');

        const isValid = crypto.timingSafeEqual(
            Buffer.from(signatureHash),
            Buffer.from(expectedHash)
        );

        if (!isValid) {
            logger.warn('⚠️ Invalid Flow request signature');
        }

        return isValid;
    }
}

export default new FlowsEncryption();
