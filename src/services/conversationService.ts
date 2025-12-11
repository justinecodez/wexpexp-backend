import { Repository } from 'typeorm';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import database from '../config/database';
import { Conversation } from '../entities/Conversation';
import { Message, MessageDirection, MessageStatus } from '../entities/Message';
import { Invitation } from '../entities/Invitation';
import { Event } from '../entities/Event';

export class ConversationService {
  private conversationRepository: Repository<Conversation>;
  private messageRepository: Repository<Message>;
  private invitationRepository: Repository<Invitation>;
  private eventRepository: Repository<Event>;

  constructor() {
    this.conversationRepository = database.getRepository(Conversation) as Repository<Conversation>;
    this.messageRepository = database.getRepository(Message) as Repository<Message>;
    this.invitationRepository = database.getRepository(Invitation) as Repository<Invitation>;
    this.eventRepository = database.getRepository(Event) as Repository<Event>;
  }

  /**
   * Find user ID from phone number by looking up invitations
   */
  private async findUserIdFromPhone(phoneNumber: string): Promise<string | null> {
    try {
      // Normalize phone number for lookup
      const normalizedPhone = phoneNumber.replace(/[\s+]/g, '');

      // Find invitation by phone number
      const invitation = await this.invitationRepository.findOne({
        where: { guestPhone: normalizedPhone },
        relations: ['event'],
      });

      if (invitation && invitation.event) {
        return invitation.event.userId;
      }

      // If no invitation found, try to find any event owner (fallback)
      // For now, return null and we'll use a default
      return null;
    } catch (error) {
      logger.error('Error finding user from phone number:', error);
      return null;
    }
  }

  /**
   * Get or create a conversation for a phone number
   */
  async getOrCreateConversation(
    userId: string,
    phoneNumber: string,
    contactName?: string
  ): Promise<Conversation> {
    // Normalize phone number (remove + and spaces)
    const normalizedPhone = phoneNumber.replace(/[\s+]/g, '');

    let conversation = await this.conversationRepository.findOne({
      where: {
        userId,
        phoneNumber: normalizedPhone,
      },
      relations: ['messages'],
    });

    if (!conversation) {
      conversation = this.conversationRepository.create({
        userId,
        phoneNumber: normalizedPhone,
        contactName: contactName || normalizedPhone,
        unreadCount: 0,
      });
      conversation = await this.conversationRepository.save(conversation);
      logger.info(`Created new conversation for ${phoneNumber} (${contactName || 'Unknown'}) with ID: ${conversation.id}`);
    } else {
      // Update contact name if provided and different
      // Also update if current name is just the phone number or empty
      const currentName = conversation.contactName || '';
      const shouldUpdate = contactName &&
        contactName.trim() !== '' &&
        contactName !== normalizedPhone &&
        (currentName === normalizedPhone ||
          currentName === '' ||
          currentName !== contactName);

      if (shouldUpdate) {
        const oldName = conversation.contactName || normalizedPhone;
        // Use update() to avoid relation cascade issues
        await this.conversationRepository.update(
          { id: conversation.id },
          { contactName: contactName }
        );
        conversation.contactName = contactName; // Update local object too
        logger.info(`✅ Updated contact name for ${phoneNumber}: "${oldName}" -> "${contactName}"`);
      } else if (contactName) {
        logger.debug(`Skipped contact name update for ${phoneNumber}:`, {
          provided: contactName,
          current: conversation.contactName,
          phone: normalizedPhone,
          shouldUpdate,
        });
      }
    }

    if (!conversation.id) {
      logger.error(`Conversation created but has no ID:`, conversation);
      throw new Error(`Failed to create conversation - no ID assigned`);
    }

    return conversation;
  }

  /**
   * Store an incoming message from webhook
   */
  async storeIncomingMessage(
    phoneNumber: string,
    whatsappMessageId: string,
    content: string,
    messageType: string = 'text',
    metadata?: any,
    contactName?: string
  ): Promise<Message> {
    try {
      logger.info(`Storing incoming message from ${phoneNumber}, type: ${messageType}`);

      // Find user ID from phone number by looking up invitations
      let userId = await this.findUserIdFromPhone(phoneNumber);

      // If no user found, try to get the first user (for single-user systems)
      // Or you could create a system user
      if (!userId) {
        // For now, we'll try to get any user from events
        // In a multi-tenant system, you'd want to handle this differently
        const events = await this.eventRepository.find({
          order: { createdAt: 'DESC' },
          take: 1,
        });
        userId = events[0]?.userId || 'system';
        logger.warn(`No user found for phone ${phoneNumber}, using fallback: ${userId}`);
      }

      logger.info(`Using userId: ${userId} for phone ${phoneNumber}, contactName: ${contactName || 'not provided'}`);

      const conversation = await this.getOrCreateConversation(
        userId,
        phoneNumber,
        contactName
      );

      if (!conversation) {
        throw new Error(`Failed to get or create conversation - conversation is null`);
      }

      if (!conversation.id) {
        logger.error(`Conversation object:`, JSON.stringify(conversation, null, 2));
        throw new Error(`Failed to get or create conversation - conversation has no ID`);
      }

      logger.info(`Creating message for conversation ${conversation.id}`);

      const message = this.messageRepository.create({
        conversationId: conversation.id,
        whatsappMessageId,
        direction: MessageDirection.INBOUND,
        content,
        messageType,
        status: MessageStatus.DELIVERED, // Incoming messages are already delivered
        metadata,
        sentAt: new Date(),
        deliveredAt: new Date(),
      });

      logger.info(`Message object created with conversationId: ${message.conversationId}, saving to database...`);

      // Save message as plain object to avoid TypeORM relation issues
      const messageData = {
        conversationId: conversation.id,
        whatsappMessageId,
        direction: MessageDirection.INBOUND,
        content,
        messageType,
        status: MessageStatus.DELIVERED,
        metadata,
        sentAt: new Date(),
        deliveredAt: new Date(),
      };

      logger.info(`Saving message with conversationId: ${messageData.conversationId}`);
      const savedMessage = await this.messageRepository.save(messageData);
      logger.info(`Message saved with ID: ${savedMessage.id}, conversationId: ${savedMessage.conversationId}`);

      // Update conversation last message time and increment unread (use update to avoid relation cascade issues)
      // First get current unread count, then update
      const currentConversation = await this.conversationRepository.findOne({
        where: { id: conversation.id },
        select: ['unreadCount'],
      });

      await this.conversationRepository.update(
        { id: conversation.id },
        {
          lastMessageAt: new Date(),
          unreadCount: (currentConversation?.unreadCount || 0) + 1
        }
      );

      logger.info(`Stored incoming message from ${phoneNumber}, message ID: ${savedMessage.id}`);

      return savedMessage;
    } catch (error: any) {
      logger.error('Error storing incoming message:', {
        error: error.message,
        stack: error.stack,
        phoneNumber,
        whatsappMessageId,
        messageType,
      });
      throw error;
    }
  }

  /**
   * Store an outgoing message
   */
  async storeOutgoingMessage(
    userId: string,
    phoneNumber: string,
    content: string,
    whatsappMessageId?: string,
    messageType: string = 'text',
    metadata?: any
  ): Promise<Message> {
    try {
      logger.info(`Storing outgoing message to ${phoneNumber} for user ${userId}`);

      const conversation = await this.getOrCreateConversation(userId, phoneNumber);

      if (!conversation) {
        throw new Error(`Failed to get or create conversation - conversation is null`);
      }

      if (!conversation.id) {
        logger.error(`Conversation object:`, JSON.stringify(conversation, null, 2));
        throw new Error(`Failed to get or create conversation - conversation has no ID`);
      }

      logger.info(`Creating outgoing message for conversation ${conversation.id}`);

      // Validate conversationId before creating message
      if (!conversation.id || conversation.id.trim() === '') {
        throw new Error(`Invalid conversation ID: "${conversation.id}"`);
      }

      const message = this.messageRepository.create({
        conversationId: conversation.id,
        whatsappMessageId,
        direction: MessageDirection.OUTBOUND,
        content,
        messageType,
        status: whatsappMessageId ? MessageStatus.SENT : MessageStatus.SENT,
        metadata,
        sentAt: new Date(),
      });

      logger.info(`Message object created with conversationId: ${message.conversationId}, saving to database...`);

      // Ensure conversationId is set before saving
      if (!message.conversationId || message.conversationId.trim() === '') {
        throw new Error(`Cannot save message: conversationId is missing or empty. Conversation ID was: "${conversation.id}"`);
      }

      // Save message as plain object to avoid TypeORM relation issues
      const messageData = {
        conversationId: conversation.id,
        whatsappMessageId,
        direction: MessageDirection.OUTBOUND,
        content,
        messageType,
        status: whatsappMessageId ? MessageStatus.SENT : MessageStatus.SENT,
        metadata,
        sentAt: new Date(),
      };

      logger.info(`Saving message with conversationId: ${messageData.conversationId}`);
      const savedMessage = await this.messageRepository.save(messageData);

      logger.info(`Message saved successfully with ID: ${savedMessage.id}, conversationId: ${savedMessage.conversationId}`);

      // Verify the saved message has the conversationId
      if (!savedMessage.conversationId) {
        logger.error(`CRITICAL: Saved message has no conversationId! Message ID: ${savedMessage.id}`);
        throw new Error(`Message was saved but conversationId is missing. This should not happen.`);
      }

      // Update conversation last message time (without loading relations to avoid cascade issues)
      await this.conversationRepository.update(
        { id: conversation.id },
        { lastMessageAt: new Date() }
      );

      logger.info(`Stored outgoing message to ${phoneNumber}, message ID: ${savedMessage.id}`);

      return savedMessage;
    } catch (error: any) {
      logger.error('Error storing outgoing message:', {
        error: error.message,
        stack: error.stack,
        phoneNumber,
        userId,
      });
      throw error;
    }
  }

  /**
   * Store an outgoing template message (auto-finds userId from phone)
   */
  async storeTemplateMessage(
    phoneNumber: string,
    whatsappMessageId: string,
    templateName: string,
    languageCode: string,
    metadata?: any,
    contactName?: string
  ): Promise<Message | null> {
    try {
      logger.info(`Storing outgoing template message to ${phoneNumber}, template: ${templateName}`);

      // Find user ID from phone number
      let userId = await this.findUserIdFromPhone(phoneNumber);

      // If no user found, get fallback user
      if (!userId) {
        const events = await this.eventRepository.find({
          order: { createdAt: 'DESC' },
          take: 1,
        });
        userId = events[0]?.userId || 'system';
        logger.warn(`No user found for phone ${phoneNumber}, using fallback: ${userId}`);
      }

      const conversation = await this.getOrCreateConversation(
        userId,
        phoneNumber,
        contactName
      );

      if (!conversation || !conversation.id) {
        throw new Error(`Failed to get or create conversation`);
      }

      const content = `[Template: ${templateName}]`;

      const messageData = {
        conversationId: conversation.id,
        whatsappMessageId,
        direction: MessageDirection.OUTBOUND,
        content,
        messageType: 'template',
        status: MessageStatus.SENT,
        metadata: {
          templateName,
          languageCode,
          ...metadata,
        },
        sentAt: new Date(),
      };

      const savedMessage = await this.messageRepository.save(messageData);

      logger.info(`Stored template message to ${phoneNumber}, message ID: ${savedMessage.id}, WhatsApp ID: ${whatsappMessageId}`);

      // Update conversation last message time
      await this.conversationRepository.update(
        { id: conversation.id },
        { lastMessageAt: new Date() }
      );

      return savedMessage;
    } catch (error: any) {
      logger.error('Error storing template message:', {
        error: error.message,
        stack: error.stack,
        phoneNumber,
        templateName,
      });
      // Don't throw - template sending already succeeded
      // Just log the error and return null
      return null;
    }
  }

  /**
   * Update message status (from webhook status updates)
   */
  async updateMessageStatus(
    whatsappMessageId: string,
    status: MessageStatus,
    timestamp?: Date
  ): Promise<Message | null> {
    try {
      logger.info(`🔍 Looking up message with WhatsApp ID: ${whatsappMessageId}`, {
        whatsappMessageId,
        targetStatus: status,
        timestamp: timestamp?.toISOString(),
      });

      const message = await this.messageRepository.findOne({
        where: { whatsappMessageId },
      });

      if (!message) {
        // Try to find by partial match (in case of encoding issues)
        const allMessages = await this.messageRepository.find({
          where: { direction: MessageDirection.OUTBOUND },
          order: { createdAt: 'DESC' },
          take: 20,
        });

        // Also search for messages with similar IDs (in case of partial matches)
        const similarMessages = allMessages.filter(m =>
          m.whatsappMessageId &&
          (m.whatsappMessageId.includes(whatsappMessageId.slice(-20)) ||
            whatsappMessageId.includes(m.whatsappMessageId.slice(-20)))
        );

        logger.warn(`⚠️ Message not found for WhatsApp ID: ${whatsappMessageId}`, {
          whatsappMessageId,
          searchedExact: true,
          totalOutboundMessages: allMessages.length,
          similarMessagesFound: similarMessages.length,
          recentMessages: allMessages.slice(0, 10).map(m => ({
            id: m.id,
            whatsappId: m.whatsappMessageId,
            content: m.content?.substring(0, 50) || '[no content]',
            status: m.status,
            createdAt: m.createdAt,
            conversationId: m.conversationId,
          })),
          similarMessages: similarMessages.map(m => ({
            id: m.id,
            whatsappId: m.whatsappMessageId,
            content: m.content?.substring(0, 50) || '[no content]',
            createdAt: m.createdAt,
          })),
          possibleReasons: [
            'Message was sent from Communications page (stored in MessageLog, not Message table)',
            'Message was sent via template API before chat integration',
            'Message ID mismatch or encoding issue',
            'Message was sent from outside the chat interface',
          ],
        });

        return null;
      }

      message.status = status;
      if (status === MessageStatus.DELIVERED && !message.deliveredAt) {
        message.deliveredAt = timestamp || new Date();
      }
      if (status === MessageStatus.READ && !message.readAt) {
        message.readAt = timestamp || new Date();
      }

      const updatedMessage = await this.messageRepository.save(message);
      logger.info(`Updated message status: ${whatsappMessageId} -> ${status}`);

      return updatedMessage;
    } catch (error) {
      logger.error('Error updating message status:', error);
      throw error;
    }
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(userId: string): Promise<Conversation[]> {
    try {
      const conversations = await this.conversationRepository
        .createQueryBuilder('conversation')
        .leftJoinAndSelect('conversation.messages', 'messages')
        .where('conversation.userId = :userId', { userId })
        .orderBy('conversation.lastMessageAt', 'DESC', 'NULLS LAST')
        .getMany();

      // If no conversations, return empty array
      return conversations || [];
    } catch (error: any) {
      // If tables don't exist yet, return empty array instead of throwing
      if (error.message?.includes('no such table') || error.message?.includes('does not exist')) {
        logger.warn('Conversation tables do not exist yet. Returning empty array.');
        return [];
      }
      logger.error('Error fetching conversations:', error);
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ messages: Message[]; total: number }> {
    try {
      // Verify conversation belongs to user
      const conversation = await this.conversationRepository.findOne({
        where: { id: conversationId, userId },
      });

      if (!conversation) {
        throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
      }

      const [messages, total] = await this.messageRepository.findAndCount({
        where: { conversationId },
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });

      // Mark messages as read
      conversation.unreadCount = 0;
      await this.conversationRepository.save(conversation);

      return {
        messages: messages.reverse(), // Return in chronological order
        total,
      };
    } catch (error: any) {
      // If tables don't exist yet, return empty result
      if (error.message?.includes('no such table') || error.message?.includes('does not exist')) {
        logger.warn('Message tables do not exist yet. Returning empty result.');
        return { messages: [], total: 0 };
      }
      logger.error('Error fetching conversation messages:', error);
      throw error;
    }
  }

  /**
   * Send a message (creates message and sends via WhatsApp)
   */
  async sendMessage(
    userId: string,
    phoneNumber: string,
    content: string,
    whatsappService: any
  ): Promise<Message> {
    try {
      logger.info(`Sending WhatsApp message to ${phoneNumber} from user ${userId}`);

      // First, ensure conversation exists before sending
      const conversation = await this.getOrCreateConversation(userId, phoneNumber);

      if (!conversation || !conversation.id) {
        throw new Error(`Failed to get or create conversation for phone ${phoneNumber} and user ${userId}`);
      }

      logger.info(`Conversation ready: ${conversation.id} for phone ${phoneNumber}`);

      // Send via WhatsApp
      const whatsappResponse = await whatsappService.sendTextMessage(phoneNumber, content);

      logger.info('WhatsApp API response:', {
        response: JSON.stringify(whatsappResponse, null, 2),
        messages: whatsappResponse.messages,
      });

      // Extract message ID - try different possible response structures
      const whatsappMessageId =
        whatsappResponse.messages?.[0]?.id ||
        whatsappResponse.data?.messages?.[0]?.id ||
        whatsappResponse.id ||
        null;

      logger.info(`Extracted WhatsApp message ID: ${whatsappMessageId}`);

      // Store in database (store even if no message ID, we'll update it later if needed)
      const message = await this.storeOutgoingMessage(
        userId,
        phoneNumber,
        content,
        whatsappMessageId || undefined,
        'text'
      );

      logger.info(`Message stored in database with ID: ${message.id}, WhatsApp ID: ${message.whatsappMessageId || 'none'}, Conversation ID: ${message.conversationId}`);

      return message;
    } catch (error: any) {
      logger.error('Error sending message:', {
        error: error.message,
        stack: error.stack,
        phoneNumber,
        userId,
      });
      throw error;
    }
  }

  /**
   * Mark a conversation as requiring template messages (24-hour window expired)
   */
  async markConversationRequiresTemplate(phoneNumber: string, requiresTemplate: boolean): Promise<void> {
    try {
      const normalizedPhone = phoneNumber.replace(/[\s+]/g, '');

      // Find all conversations with this phone number
      const conversations = await this.conversationRepository.find({
        where: { phoneNumber: normalizedPhone },
      });

      if (conversations.length > 0) {
        // Update metadata to indicate template requirement
        for (const conversation of conversations) {
          // We can store this in a separate field or in metadata
          // For now, we'll log it and could extend the Conversation entity if needed
          logger.info(`Marked conversation ${conversation.id} as requiring template messages: ${requiresTemplate}`);
        }
      }
    } catch (error: any) {
      logger.error('Error marking conversation as requiring template:', {
        error: error.message,
        phoneNumber,
      });
    }
  }

  /**
   * Check if a conversation requires template messages (24-hour window expired)
   * Returns true if last message was more than 24 hours ago
   */
  async requiresTemplateMessage(phoneNumber: string): Promise<boolean> {
    try {
      const normalizedPhone = phoneNumber.replace(/[\s+]/g, '');

      const conversation = await this.conversationRepository.findOne({
        where: { phoneNumber: normalizedPhone },
        order: { lastMessageAt: 'DESC' },
      });

      if (!conversation || !conversation.lastMessageAt) {
        // No conversation or no messages - template required
        return true;
      }

      const now = new Date();
      const lastMessageTime = new Date(conversation.lastMessageAt);
      const hoursSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

      // If more than 24 hours have passed, template is required
      return hoursSinceLastMessage > 24;
    } catch (error: any) {
      logger.error('Error checking if template message is required:', {
        error: error.message,
        phoneNumber,
      });
      // Default to requiring template if we can't determine
      return true;
    }
  }
}

export default new ConversationService();

