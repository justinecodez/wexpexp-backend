import { Router } from 'express';
import cardGenerationController from '../controllers/cardGenerationController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route POST /api/card-generation/batch
 * @desc Queue batch card generation for an event
 * @access Private
 */
router.post(
  '/batch',
  authenticate,
  cardGenerationController.queueBatchGeneration
);

/**
 * @route GET /api/card-generation/batch/:batchId/status
 * @desc Get batch generation status
 * @access Private
 */
router.get(
  '/batch/:batchId/status',
  authenticate,
  cardGenerationController.getBatchStatus
);

/**
 * @route GET /api/card-generation/queue/stats
 * @desc Get queue statistics
 * @access Private
 */
router.get(
  '/queue/stats',
  authenticate,
  cardGenerationController.getQueueStats
);

/**
 * @route DELETE /api/card-generation/queue
 * @desc Clear queue (admin only)
 * @access Private (Admin)
 */
router.delete(
  '/queue',
  authenticate,
  cardGenerationController.clearQueue
);

export default router;

