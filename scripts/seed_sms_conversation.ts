
import { AppDataSource } from '../src/config/database';
import { Conversation } from '../src/entities/Conversation';
import { Message, MessageDirection, MessageStatus } from '../src/entities/Message';
import { User } from '../src/entities/User';
import logger from '../src/config/logger';

async function seedSMSConversation() {
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        const conversationRepo = AppDataSource.getRepository(Conversation);
        const messageRepo = AppDataSource.getRepository(Message);
        const userRepo = AppDataSource.getRepository(User);

        // Target the specific user "John Doe" who has the WhatsApp conversations
        // ID from debug output: b6e6df4d-cdb5-481f-9671-99ffc1cdea95
        const targetUserId = 'b6e6df4d-cdb5-481f-9671-99ffc1cdea95';

        const user = await userRepo.findOne({ where: { id: targetUserId } });

        if (!user) {
            logger.error(`Target user ${targetUserId} not found. Cannot seed.`);
            process.exit(1);
        }

        const testUser = user.id;

        logger.info(`Using user ID via valid user: ${testUser}`);

        // Create a specific test number
        const testPhone = '255754111222';

        // Check if conversation exists for this SPECIFIC user
        let conversation = await conversationRepo.findOne({
            where: {
                phoneNumber: testPhone,
                channel: 'SMS',
                userId: testUser
            }
        });

        if (!conversation) {
            logger.info('Creating new SMS conversation...');
            conversation = conversationRepo.create({
                userId: testUser,
                phoneNumber: testPhone,
                contactName: 'Test SMS User',
                channel: 'SMS',
                unreadCount: 1,
                lastMessageAt: new Date()
            });
            conversation = await conversationRepo.save(conversation);
        } else {
            logger.info('SMS conversation already exists.');
        }

        // Add a test message
        const message = messageRepo.create({
            conversationId: conversation.id,
            direction: MessageDirection.INBOUND,
            content: 'This is a test SMS message for verification.',
            messageType: 'text',
            channel: 'SMS',
            status: MessageStatus.DELIVERED,
            sentAt: new Date(),
            deliveredAt: new Date()
        });

        await messageRepo.save(message);

        logger.info(`Successfully seeded SMS message to conversation ${conversation.id}`);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

seedSMSConversation();
