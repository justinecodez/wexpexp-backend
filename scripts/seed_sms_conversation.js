"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../src/config/database");
const Conversation_1 = require("../src/entities/Conversation");
const Message_1 = require("../src/entities/Message");
const User_1 = require("../src/entities/User");
const logger_1 = __importDefault(require("../src/config/logger"));
async function seedSMSConversation() {
    try {
        if (!database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.initialize();
        }
        const conversationRepo = database_1.AppDataSource.getRepository(Conversation_1.Conversation);
        const messageRepo = database_1.AppDataSource.getRepository(Message_1.Message);
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        // Target the specific user "John Doe" who has the WhatsApp conversations
        // ID from debug output: b6e6df4d-cdb5-481f-9671-99ffc1cdea95
        const targetUserId = 'b6e6df4d-cdb5-481f-9671-99ffc1cdea95';
        const user = await userRepo.findOne({ where: { id: targetUserId } });
        if (!user) {
            logger_1.default.error(`Target user ${targetUserId} not found. Cannot seed.`);
            process.exit(1);
        }
        const testUser = user.id;
        logger_1.default.info(`Using user ID via valid user: ${testUser}`);
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
            logger_1.default.info('Creating new SMS conversation...');
            conversation = conversationRepo.create({
                userId: testUser,
                phoneNumber: testPhone,
                contactName: 'Test SMS User',
                channel: 'SMS',
                unreadCount: 1,
                lastMessageAt: new Date()
            });
            conversation = await conversationRepo.save(conversation);
        }
        else {
            logger_1.default.info('SMS conversation already exists.');
        }
        // Add a test message
        const message = messageRepo.create({
            conversationId: conversation.id,
            direction: Message_1.MessageDirection.INBOUND,
            content: 'This is a test SMS message for verification.',
            messageType: 'text',
            channel: 'SMS',
            status: Message_1.MessageStatus.DELIVERED,
            sentAt: new Date(),
            deliveredAt: new Date()
        });
        await messageRepo.save(message);
        logger_1.default.info(`Successfully seeded SMS message to conversation ${conversation.id}`);
        process.exit(0);
    }
    catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}
seedSMSConversation();
//# sourceMappingURL=seed_sms_conversation.js.map