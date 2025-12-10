import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import conversationService from '../services/conversationService';
import { WhatsAppService } from '../services/whatsapp.service';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';

export class ConversationController {
  private whatsAppService: WhatsAppService;

  constructor() {
    this.whatsAppService = new WhatsAppService();
  }

  /**
   * Get all conversations for the authenticated user
   * GET /api/conversations
   */
  getConversations = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401, 'UNAUTHORIZED');
      }

      logger.info(`Fetching conversations for user: ${req.user.userId}`);
      const conversations = await conversationService.getUserConversations(req.user.userId);

      res.status(200).json({
        success: true,
        data: conversations || [],
      });
    } catch (error: any) {
      logger.error('Error in getConversations:', error);
      next(error);
    }
  };

  /**
   * Get messages for a specific conversation
   * GET /api/conversations/:id/messages
   */
  getConversationMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401, 'UNAUTHORIZED');
      }

      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await conversationService.getConversationMessages(
        id,
        req.user.userId,
        limit,
        offset
      );

      res.status(200).json({
        success: true,
        data: result.messages,
        pagination: {
          total: result.total,
          limit,
          offset,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Send a message
   * POST /api/conversations/send
   */
  sendMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401, 'UNAUTHORIZED');
      }

      const { phoneNumber, content } = req.body;

      if (!phoneNumber || !content) {
        throw new AppError('Phone number and content are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      logger.info(`Sending message to ${phoneNumber} from user ${req.user.userId}`);

      const message = await conversationService.sendMessage(
        req.user.userId,
        phoneNumber,
        content,
        this.whatsAppService
      );

      res.status(200).json({
        success: true,
        message: 'Message sent successfully',
        data: message,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Mark conversation as read
   * POST /api/conversations/:id/read
   */
  markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401, 'UNAUTHORIZED');
      }

      const { id } = req.params;

      // Get conversation messages (this automatically marks as read)
      await conversationService.getConversationMessages(id, req.user.userId, 1, 0);

      res.status(200).json({
        success: true,
        message: 'Conversation marked as read',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new ConversationController();

