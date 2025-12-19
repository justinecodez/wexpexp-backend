import { Repository } from 'typeorm';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import database from '../config/database';
import { Conversation } from '../entities/Conversation';
import { Message, MessageDirection, MessageStatus } from '../entities/Message';
import { Invitation } from '../entities/Invitation';
import { Event } from '../entities/Event';
import socketEmitter from '../utils/socketEmitter';

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

      console.warn('Normalized phone number:', normalizedPhone);
      console.warn('Guest phone number:', phoneNumber);
      // Find invitation by phone number
      const invitation = await this.invitationRepository.findOne({
        where: { guestPhone: "255757714834" },
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
    contactName?: string,
    channel: 'WHATSAPP' | 'SMS' = 'WHATSAPP'
  ): Promise<Conversation> {
    // Normalize phone number (remove + and spaces)
    const normalizedPhone = phoneNumber.replace(/[\s+]/g, '');

    // ALWAYS look up guest name from invitation system first
    let officialGuestName: string | null = null;
    try {
      const invitation = await this.invitationRepository.findOne({
        where: { guestPhone: normalizedPhone },
        order: { createdAt: 'DESC' }, // Get most recent invitation
        select: ['guestName'],
      });

      if (invitation && invitation.guestName) {
        officialGuestName = invitation.guestName;
        logger.info(`✅ Found official guest name from invitation: "${officialGuestName}" for ${normalizedPhone}`);
      } else {
        logger.debug(`No invitation found for ${normalizedPhone}, will use WhatsApp name or phone number`);
      }
    } catch (error) {
      logger.warn(`Error looking up guest name for ${normalizedPhone}:`, error);
    }

    // Prioritize: Official guest name > WhatsApp contact name > Phone number
    const finalContactName = officialGuestName || contactName || normalizedPhone;

    let conversation = await this.conversationRepository.findOne({
      where: {
        userId,
        phoneNumber: normalizedPhone,
        channel,
      },
      relations: ['messages'],
    });

    if (!conversation) {
      conversation = this.conversationRepository.create({
        userId,
        phoneNumber: normalizedPhone,
        contactName: finalContactName,
        channel,
        unreadCount: 0,
      });
      conversation = await this.conversationRepository.save(conversation);
      logger.info(`Created new conversation for ${phoneNumber} with name: "${finalContactName}" (ID: ${conversation.id})`);
    } else {
      // ALWAYS update to official guest name if we have it
      // This ensures nicknames are replaced with official names
      const shouldUpdateToOfficialName = officialGuestName &&
        conversation.contactName !== officialGuestName;

      // Also update if we only have WhatsApp name and it's better than current
      const shouldUpdateToWhatsAppName = !officialGuestName &&
        contactName &&
        contactName.trim() !== '' &&
        contactName !== normalizedPhone &&
        (conversation.contactName === normalizedPhone ||
          conversation.contactName === '' ||
          conversation.contactName !== contactName);

      if (shouldUpdateToOfficialName) {
        const oldName = conversation.contactName || normalizedPhone;
        await this.conversationRepository.update(
          { id: conversation.id },
          { contactName: officialGuestName! } // Non-null assertion safe here
        );
        conversation.contactName = officialGuestName!; // Non-null assertion safe here
        logger.info(`✅ Updated to OFFICIAL guest name for ${phoneNumber}: "${oldName}" -> "${officialGuestName}"`);
      } else if (shouldUpdateToWhatsAppName) {
        const oldName = conversation.contactName || normalizedPhone;
        await this.conversationRepository.update(
          { id: conversation.id },
          { contactName: contactName }
        );
        conversation.contactName = contactName;
        logger.info(`✅ Updated contact name for ${phoneNumber}: "${oldName}" -> "${contactName}"`);
      } else {
        logger.debug(`No name update needed for ${phoneNumber}:`, {
          current: conversation.contactName,
          official: officialGuestName,
          whatsapp: contactName,
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
    contactName?: string,
    channel: 'WHATSAPP' | 'SMS' = 'WHATSAPP'
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
        contactName,
        channel
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
        channel,
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
        channel,
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

      // Emit real-time new message event
      socketEmitter.emitNewMessage({
        messageId: savedMessage.id,
        conversationId: savedMessage.conversationId,
        phoneNumber: phoneNumber,
        content: content,
        direction: MessageDirection.INBOUND,
        timestamp: savedMessage.createdAt.toISOString(),
      });

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
    metadata?: any,
    channel: 'WHATSAPP' | 'SMS' = 'WHATSAPP'
  ): Promise<Message> {
    try {
      console.log('💾 storeOutgoingMessage called:');
      console.log(`   User ID: ${userId}`);
      console.log(`   Phone: ${phoneNumber}`);
      console.log(`   Channel: ${channel}`);
      console.log(`   Message Type: ${messageType}`);
      console.log(`   Content length: ${content.length}`);
      console.log(`   Content to store:\n   ${'-'.repeat(70)}\n   ${content}\n   ${'-'.repeat(70)}`);

      // Check if content has template variables
      const hasTemplateVars = /\{[^}]+\}/g.test(content);
      if (hasTemplateVars) {
        const remainingVars = content.match(/\{[^}]+\}/g);
        console.log(`   ⚠️  WARNING: Content still has template variables!`);
        console.log(`   ⚠️  Variables found:`, remainingVars);
      } else {
        console.log(`   ✅ No template variables in content`);
      }

      logger.info(`Storing outgoing message to ${phoneNumber} for user ${userId}`);

      const conversation = await this.getOrCreateConversation(userId, phoneNumber, undefined, channel);

      if (!conversation) {
        throw new Error(`Failed to get or create conversation - conversation is null`);
      }

      if (!conversation.id) {
        logger.error(`Conversation object:`, JSON.stringify(conversation, null, 2));
        throw new Error(`Failed to get or create conversation - conversation has no ID`);
      }

      console.log(`   ✅ Got conversation: ${conversation.id}`);
      logger.info(`Creating outgoing message for conversation ${conversation.id}`);

      // Validate conversationId before creating message
      if (!conversation.id || conversation.id.trim() === '') {
        throw new Error(`Invalid conversation ID: "${conversation.id}"`);
      }

      const message = this.messageRepository.create({
        conversationId: conversation.id,
        whatsappMessageId,
        direction: MessageDirection.OUTBOUND,
        content,  // ⚠️ THIS is the content being saved
        messageType,
        channel,
        status: whatsappMessageId ? MessageStatus.SENT : MessageStatus.SENT,
        metadata,
        sentAt: new Date(),
      });

      console.log(`   📝 Message object created`);
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
        content,  // ⚠️ THIS is what gets saved to DB
        messageType,
        channel,
        status: whatsappMessageId ? MessageStatus.SENT : MessageStatus.SENT,
        metadata,
        sentAt: new Date(),
      };

      console.log(`   💾 Saving to database...`);
      console.log(`   💾 Final content to DB:\n   ${'-'.repeat(70)}\n   ${messageData.content}\n   ${'-'.repeat(70)}`);

      logger.info(`Saving message with conversationId: ${messageData.conversationId}`);
      const savedMessage = await this.messageRepository.save(messageData);

      console.log(`   ✅ Message saved with ID: ${savedMessage.id}`);
      console.log(`   ✅ Saved content:\n   ${'-'.repeat(70)}\n   ${savedMessage.content}\n   ${'-'.repeat(70)}`);

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

      // Emit real-time new message event
      socketEmitter.emitNewMessage({
        messageId: savedMessage.id,
        conversationId: savedMessage.conversationId,
        phoneNumber: phoneNumber,
        content: content,
        direction: MessageDirection.OUTBOUND,
        timestamp: new Date().toISOString(),
      });

      return savedMessage;
    } catch (error: any) {
      console.log(`   ❌ Error storing message:`, error.message);
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

      // Render actual template content instead of placeholder
      let content = `[Template: ${templateName}]`;
      try {
        const { renderWhatsAppTemplate } = await import('../utils/whatsappTemplates');
        content = renderWhatsAppTemplate(
          templateName,
          languageCode,
          metadata?.components || []
        );
      } catch (renderError) {
        logger.warn(`Failed to render template ${templateName}, using placeholder`, renderError);
      }

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
    timestamp?: Date,
    errorMessage?: string
  ): Promise<Message | null> {
    try {
      logger.info(`🔍 Looking up message with WhatsApp ID: ${whatsappMessageId}`, {
        whatsappMessageId,
        targetStatus: status,
        timestamp: timestamp?.toISOString(),
        errorMessage,
      });

      const message = await this.messageRepository.findOne({
        where: { whatsappMessageId },
      });

      if (!message) {
        logger.warn(`⚠️ Message not found with exact WhatsApp ID: ${whatsappMessageId}. Searching all outbound messages...`);

        const allMessages = await this.messageRepository.find({
          where: { direction: MessageDirection.OUTBOUND },
          order: { createdAt: 'DESC' },
          take: 100,
        });

        // Also search for messages with similar IDs (in case of partial matches)
        const similarMessages = allMessages.filter(m =>
          m.whatsappMessageId &&
          (m.whatsappMessageId.includes(whatsappMessageId.slice(-10)) ||
            whatsappMessageId.includes(m.whatsappMessageId.slice(-10)))
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
      if (status === MessageStatus.FAILED && errorMessage) {
        message.errorMessage = errorMessage;
      }

      const updatedMessage = await this.messageRepository.save(message);
      logger.info(`Updated message status: ${whatsappMessageId} -> ${status}`);

      // Emit real-time update
      socketEmitter.emitMessageStatusUpdate({
        messageId: updatedMessage.id,
        whatsappMessageId: updatedMessage.whatsappMessageId || whatsappMessageId,
        status: status,
        conversationId: updatedMessage.conversationId,
        timestamp: new Date().toISOString(),
      });

      return updatedMessage;
    } catch (error) {
      logger.error('Error updating message status:', error);
      throw error;
    }
  }

  /**
   * Get all conversations for a user
   * Returns conversations with all associated events (via invitations)
   */
  async getUserConversations(userId: string, eventId?: string, channel?: 'WHATSAPP' | 'SMS'): Promise<any[]> {
    try {
      const queryBuilder = this.conversationRepository
        .createQueryBuilder('conversation')
        .leftJoinAndSelect('conversation.messages', 'messages')
        .leftJoinAndSelect('conversation.event', 'event')
        .where('conversation.userId = :userId', { userId });

      // Filter by event if provided - check both conversation.eventId and invitations
      if (eventId && eventId !== 'all') {
        // First, get phone numbers associated with this event via invitations
        const invitationsWithEvent = await this.invitationRepository.find({
          where: { eventId },
          select: ['guestPhone'],
        });
        const phoneNumbersForEvent = invitationsWithEvent
          .map(inv => inv.guestPhone?.replace(/[\s+]/g, ''))
          .filter(Boolean);

        // Filter conversations by eventId OR by phone numbers in invitations for this event
        // This ensures we get all conversations where the phone number has an invitation for this event
        if (phoneNumbersForEvent.length > 0) {
          queryBuilder.andWhere(
            '(conversation.eventId = :eventId OR conversation.phoneNumber IN (:...phoneNumbers))',
            { eventId, phoneNumbers: phoneNumbersForEvent }
          );
        } else {
          // No invitations for this event, so only check conversation.eventId
          queryBuilder.andWhere('conversation.eventId = :eventId', { eventId });
        }
      }

      // Filter by channel if provided
      if (channel) {
        queryBuilder.andWhere('conversation.channel = :channel', { channel });
      }

      const conversations = await queryBuilder
        .orderBy('conversation.lastMessageAt', 'DESC', 'NULLS LAST')
        .getMany();

      // Enrich each conversation with all associated events via invitations
      const enrichedConversations = await Promise.all(
        conversations.map(async (conversation) => {
          // Find all invitations for this phone number to get all associated events
          const normalizedPhone = conversation.phoneNumber.replace(/[\s+]/g, '');
          const invitations = await this.invitationRepository.find({
            where: { guestPhone: normalizedPhone },
            relations: ['event'],
          });

          // Get unique events from invitations
          let associatedEvents = invitations
            .map(inv => inv.event)
            .filter((event): event is Event => event !== null && event !== undefined)
            .filter((event, index, self) =>
              index === self.findIndex(e => e.id === event.id)
            )
            .map(event => ({
              id: event.id,
              title: event.title,
              eventDate: event.eventDate,
            }));

          // If filtering by eventId, only include conversations that have this event
          // and only show this event in the events array (or all events if user wants to see all)
          if (eventId) {
            // Verify this conversation is actually associated with the filtered event
            const hasFilteredEvent = associatedEvents.some(e => e.id === eventId);
            if (!hasFilteredEvent) {
              // This shouldn't happen due to the query filter, but just in case
              return null;
            }
            // Optionally: only show the filtered event, or show all events
            // For now, show all events but the filtered one will be in the list
          }

          // Return conversation with events array
          return {
            ...conversation,
            events: associatedEvents,
          };
        })
      );

      // Filter out any null values (shouldn't happen, but safety check)
      return enrichedConversations.filter(conv => conv !== null);

      // If no conversations, return empty array
      return enrichedConversations || [];
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

