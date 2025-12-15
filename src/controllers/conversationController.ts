import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import conversationService from '../services/conversationService';
import { WhatsAppService } from '../services/whatsapp.service';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import database from '../config/database';
import { Event } from '../entities/Event';
import { Invitation } from '../entities/Invitation';
import { Conversation } from '../entities/Conversation';
import { InvitationMethod, DeliveryStatus } from '../entities/enums';

export class ConversationController {
  private whatsAppService: WhatsAppService;

  constructor() {
    this.whatsAppService = new WhatsAppService();
  }

  /**
   * Get all conversations for the authenticated user
   * GET /api/conversations
   * Query params: eventId (optional) - filter by event
   */
  getConversations = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401, 'UNAUTHORIZED');
      }

      const eventId = req.query.eventId as string | undefined;
      const channel = req.query.channel as 'WHATSAPP' | 'SMS' | undefined;

      logger.info(`Fetching conversations for user: ${req.user.userId}${eventId ? ` filtered by event: ${eventId}` : ''}${channel ? ` filtered by channel: ${channel}` : ''}`);
      const conversations = await conversationService.getUserConversations(req.user.userId, eventId, channel);

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

  /**
   * Resend invitation to a contact
   * POST /api/conversations/:id/resend-invitation
   * Body: { eventId: string, includeCard?: boolean, language?: 'en' | 'sw' }
   */
  resendInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401, 'UNAUTHORIZED');
      }

      const { id } = req.params;
      const { eventId, includeCard = true, language = 'en' } = req.body;

      if (!eventId) {
        throw new AppError('Event ID is required', 400, 'MISSING_EVENT_ID');
      }

      // Get conversation
      const conversationRepository = database.getRepository(Conversation);
      const conversation = await conversationRepository.findOne({
        where: { id, userId: req.user.userId },
      });

      if (!conversation) {
        throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
      }

      // Get event with user info
      const eventRepository = database.getRepository(Event);
      const event = await eventRepository.findOne({
        where: { id: eventId, userId: req.user.userId },
        relations: ['user'],
      });

      if (!event) {
        throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
      }

      // Find invitation for this phone number and event
      const invitationRepository = database.getRepository(Invitation);
      let invitation = await invitationRepository.findOne({
        where: {
          eventId,
          guestPhone: conversation.phoneNumber,
        },
      });

      // Create invitation if doesn't exist
      if (!invitation) {
        invitation = invitationRepository.create({
          eventId,
          guestName: conversation.contactName || 'Guest',
          guestPhone: conversation.phoneNumber,
          invitationMethod: InvitationMethod.WHATSAPP,
        });
        invitation = await invitationRepository.save(invitation);
        logger.info(`Created new invitation for resend: ${invitation.id}`);
      }

      const phoneNumber = conversation.phoneNumber;
      let result: any;

      logger.info(`Resending invitation to ${phoneNumber} for event ${eventId}`, {
        includeCard,
        language,
        hasCardUrl: !!invitation.cardUrl,
        contactName: conversation.contactName,
      });

      // Use the appropriate template based on options
      if (includeCard && invitation.cardUrl) {
        // Send with card image
        result = await this.whatsAppService.sendWeddingInvitationWithImage(
          phoneNumber,
          { guestName: invitation.guestName, cardUrl: invitation.cardUrl },
          {
            eventDate: event.eventDate,
            startTime: event.startTime,
            endTime: event.endTime,
            venueName: event.venueName,
            venueAddress: event.venueAddress,
            user: event.user,
            brideName: event.brideName,
            groomName: event.groomName,
          },
          invitation.cardUrl
        );
      } else {
        // Send text-only template
        result = await this.whatsAppService.sendWeddingInvite(
          phoneNumber,
          { guestName: invitation.guestName },
          {
            eventDate: event.eventDate,
            startTime: event.startTime,
            endTime: event.endTime,
            venueName: event.venueName,
            venueAddress: event.venueAddress,
            user: event.user,
            brideName: event.brideName,
            groomName: event.groomName,
          },
          undefined,
          language
        );
      }

      // Update invitation sent timestamp
      await invitationRepository.update(
        { id: invitation.id },
        { sentAt: new Date(), deliveryStatus: DeliveryStatus.SENT }
      );

      // Associate conversation with event if not already
      if (!conversation.eventId) {
        await conversationRepository.update(
          { id: conversation.id },
          { eventId }
        );
      }

      logger.info(`Invitation resent successfully to ${phoneNumber}`);

      res.status(200).json({
        success: true,
        message: 'Invitation resent successfully',
        data: {
          messageId: result.messages?.[0]?.id,
          templateUsed: includeCard && invitation.cardUrl ? 'wedding_invitation_with_image' : 'wedding_invite',
        },
      });
    } catch (error: any) {
      logger.error('Error resending invitation:', error);
      next(error);
    }
  };

  /**
   * Update all conversation names from invitation system
   * POST /api/conversations/update-names
   */
  updateConversationNames = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401, 'UNAUTHORIZED');
      }

      logger.info(`Updating conversation names for user: ${req.user.userId}`);

      const conversationRepo = database.getRepository(Conversation);
      const invitationRepo = database.getRepository(Invitation);

      // Get all conversations for this user
      const conversations = await conversationRepo.find({
        where: { userId: req.user.userId },
      });

      let updatedCount = 0;

      for (const conversation of conversations) {
        // Find invitation for this phone number
        const invitation = await invitationRepo.findOne({
          where: { guestPhone: conversation.phoneNumber },
          order: { createdAt: 'DESC' },
          select: ['guestName'],
        });

        if (invitation && invitation.guestName && invitation.guestName !== conversation.contactName) {
          await conversationRepo.update(
            { id: conversation.id },
            { contactName: invitation.guestName }
          );
          updatedCount++;
          logger.info(`Updated conversation ${conversation.id}: "${conversation.contactName}" -> "${invitation.guestName}"`);
        }
      }

      logger.info(`Successfully updated ${updatedCount} conversation names`);

      res.status(200).json({
        success: true,
        message: `Updated ${updatedCount} conversation name(s) to use official guest names`,
        data: {
          totalConversations: conversations.length,
          updatedCount,
        },
      });
    } catch (error: any) {
      logger.error('Error updating conversation names:', error);
      next(error);
    }
  };
}

export default new ConversationController();

