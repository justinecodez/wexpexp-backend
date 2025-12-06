import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

// Create a Redis connection
export const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

// Initialize the queue
export const imageGenerationQueue = new Queue('image-generation', {
    connection: redisClient,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});
