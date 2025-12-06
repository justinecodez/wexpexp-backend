import { Request, Response, NextFunction } from 'express';
import cardGenerationService from '../services/cardGenerationService';
import invitationService from '../services/invitationService';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types';
import logger from '../config/logger';

export class CardGenerationController {
  /**
   * Queue batch card generation for an event
   * POST /api/card-generation/batch
   */
  async queueBatchGeneration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { eventId, invitationIds, templateConfig } = req.body;

      if (!eventId || !templateConfig) {
        throw new AppError('Event ID and template config are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      // Get invitations for this event (with pagination - get all)
      const pagination = { page: 1, limit: 10000 }; // Get all invitations
      const invitationsResponse = await invitationService.getEventInvitations(
        eventId, 
        req.user.userId,
        pagination
      );
      
      // Extract invitations array from paginated response
      let invitations = invitationsResponse.invitations;
      
      // Filter to selected invitations if provided
      if (invitationIds && invitationIds.length > 0) {
        invitations = invitations.filter((inv: any) => invitationIds.includes(inv.id));
      }

      if (invitations.length === 0) {
        throw new AppError('No invitations found', 404, 'NO_INVITATIONS');
      }

      logger.info(`🎨 Queueing batch card generation for ${invitations.length} guests`);

      // Queue the batch generation
      const result = await cardGenerationService.queueBatchCardGeneration(
        eventId,
        invitations,
        templateConfig
      );

      res.status(200).json({
        success: true,
        message: `Queued ${result.queuedCount} card generation jobs`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get batch generation status
   * GET /api/card-generation/batch/:batchId/status
   */
  async getBatchStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const { batchId } = req.params;

      const status = await cardGenerationService.getBatchStatus(batchId);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get queue statistics
   * GET /api/card-generation/queue/stats
   */
  async getQueueStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      const queueLength = await cardGenerationService.getQueueLength();

      res.status(200).json({
        success: true,
        data: {
          queueLength,
          status: queueLength > 0 ? 'processing' : 'idle',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clear queue (admin only)
   * DELETE /api/card-generation/queue
   */
  async clearQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      // TODO: Add admin check
      // if (req.user.role !== 'admin') {
      //   throw new AppError('Unauthorized', 403, 'UNAUTHORIZED');
      // }

      const removed = await cardGenerationService.clearQueue();

      res.status(200).json({
        success: true,
        message: `Cleared queue: ${removed} jobs removed`,
        data: { removed },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new CardGenerationController();

