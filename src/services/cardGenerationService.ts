import Redis from 'ioredis';
import logger from '../config/logger';
import config from '../config';
import { v4 as uuidv4 } from 'uuid';

// Redis client for simple queue
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redis.on('connect', () => {
  logger.info('✅ Redis connected for card generation queue');
});

const QUEUE_NAME = 'invitation_queue';

export interface CardGenerationJob {
  jobId: string;
  eventId: string;
  invitationId: string;
  guestName: string;
  guestEmail?: string;
  guestData: Record<string, string>;
  templateConfig: {
    canvasSize: { width: number; height: number };
    backgroundImageSrc: string | null;
    fields: Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      width: number;
      text: string;
      fontSize: number;
      fontFamily: string;
      color: string;
      align: string;
      rotation?: number;
      opacity?: number;
      [key: string]: any;
    }>;
  };
  s3Config: {
    endpoint: string;
    bucketName: string;
    accessKeyId: string;
    secretAccessKey: string;
    useLocalStorage?: boolean;
  };
}

export class CardGenerationService {
  /**
   * Queue a single card generation job
   */
  async queueCardGeneration(job: CardGenerationJob): Promise<string> {
    try {
      const jobData = JSON.stringify(job);
      
      // Push to Redis list (FIFO queue)
      await redis.rpush(QUEUE_NAME, jobData);
      
      logger.info(`✅ Queued card generation job: ${job.jobId} for ${job.guestName}`);
      
      return job.jobId;
    } catch (error: any) {
      logger.error(`❌ Failed to queue card generation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Queue batch card generation for multiple guests
   */
  async queueBatchCardGeneration(
    eventId: string,
    invitations: Array<{
      id: string;
      guestName: string;
      guestEmail?: string;
      guestPhone?: string;
      [key: string]: any;
    }>,
    templateConfig: CardGenerationJob['templateConfig']
  ): Promise<{
    batchId: string;
    jobIds: string[];
    queuedCount: number;
  }> {
    try {
      const batchId = uuidv4();
      const jobIds: string[] = [];
      
      // Storage configuration - using local storage now (no longer needed for Backblaze)
      // Keeping s3Config structure for compatibility, but worker will use local storage
      const s3Config = {
        endpoint: '', // Not used for local storage
        bucketName: '', // Not used for local storage
        accessKeyId: '', // Not used for local storage
        secretAccessKey: '', // Not used for local storage
        useLocalStorage: true, // Flag to indicate local storage
      };
      
      logger.info(`🚀 Starting batch card generation: ${batchId} for ${invitations.length} guests`);
      
      // Queue a job for each invitation
      for (const invitation of invitations) {
        const jobId = `${batchId}-${invitation.id}`;
        
        // Prepare guest data for variable substitution
        const guestData: Record<string, string> = {
          name: invitation.guestName,
          email: invitation.guestEmail || '',
          phone: invitation.guestPhone || '',
          status: invitation.rsvpStatus || 'pending',
          // Add more fields as needed from invitation
        };
        
        const job: CardGenerationJob = {
          jobId,
          eventId,
          invitationId: invitation.id,
          guestName: invitation.guestName,
          guestEmail: invitation.guestEmail,
          guestData,
          templateConfig,
          s3Config,
        };
        
        await this.queueCardGeneration(job);
        jobIds.push(jobId);
      }
      
      // Store batch metadata
      const batchMetadata = {
        batchId,
        eventId,
        totalJobs: invitations.length,
        jobIds,
        status: 'queued',
        queuedAt: new Date().toISOString(),
      };
      
      await redis.setex(
        `batch:${batchId}`,
        3600, // TTL: 1 hour
        JSON.stringify(batchMetadata)
      );
      
      logger.info(`✅ Batch queued: ${batchId} - ${jobIds.length} jobs`);
      
      return {
        batchId,
        jobIds,
        queuedCount: jobIds.length,
      };
    } catch (error: any) {
      logger.error(`❌ Failed to queue batch generation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check batch status
   */
  async getBatchStatus(batchId: string): Promise<{
    batchId: string;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'not_found';
    results: Array<{ jobId: string; success: boolean; cardUrl?: string; error?: string }>;
  }> {
    try {
      // Get batch metadata
      const metadataStr = await redis.get(`batch:${batchId}`);
      
      if (!metadataStr) {
        return {
          batchId,
          totalJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          status: 'not_found',
          results: [],
        };
      }
      
      const metadata = JSON.parse(metadataStr);
      const results: Array<any> = [];
      let completedCount = 0;
      let failedCount = 0;
      
      // Check status of each job
      for (const jobId of metadata.jobIds) {
        const resultStr = await redis.get(`job_result:${jobId}`);
        
        if (resultStr) {
          const result = JSON.parse(resultStr);
          results.push({
            jobId,
            ...result,
          });
          
          if (result.success) {
            completedCount++;
          } else {
            failedCount++;
          }
        }
      }
      
      // Determine overall status
      let status: 'queued' | 'processing' | 'completed' | 'failed' = 'queued';
      
      if (completedCount + failedCount === metadata.totalJobs) {
        status = failedCount > 0 ? 'failed' : 'completed';
      } else if (completedCount + failedCount > 0) {
        status = 'processing';
      }
      
      return {
        batchId,
        totalJobs: metadata.totalJobs,
        completedJobs: completedCount,
        failedJobs: failedCount,
        status,
        results,
      };
    } catch (error: any) {
      logger.error(`❌ Failed to get batch status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get queue length
   */
  async getQueueLength(): Promise<number> {
    try {
      return await redis.llen(QUEUE_NAME);
    } catch (error: any) {
      logger.error(`❌ Failed to get queue length: ${error.message}`);
      return 0;
    }
  }

  /**
   * Clear queue (use with caution)
   */
  async clearQueue(): Promise<number> {
    try {
      const length = await redis.llen(QUEUE_NAME);
      await redis.del(QUEUE_NAME);
      logger.warn(`⚠️  Cleared queue: ${length} jobs removed`);
      return length;
    } catch (error: any) {
      logger.error(`❌ Failed to clear queue: ${error.message}`);
      throw error;
    }
  }
}

export default new CardGenerationService();

