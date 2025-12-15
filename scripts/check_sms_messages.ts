import { AppDataSource } from '../src/config/database';
import { Conversation } from '../src/entities/Conversation';
import { Message } from '../src/entities/Message';
import logger from '../src/config/logger';

async function checkSMSMessages() {
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        const conversationRepo = AppDataSource.getRepository(Conversation);
        const messageRepo = AppDataSource.getRepository(Message);

        console.log('\n--- SMS CONVERSATIONS ---');
        const smsConversations = await conversationRepo.find({
            where: { channel: 'SMS' },
            select: ['id', 'userId', 'phoneNumber', 'contactName', 'createdAt', 'lastMessageAt'],
            order: { createdAt: 'DESC' }
        });

        console.log(`Total SMS Conversations: ${smsConversations.length}\n`);
        smsConversations.forEach(c => {
            console.log(`ID: ${c.id}`);
            console.log(`  User: ${c.userId}`);
            console.log(`  Phone: ${c.phoneNumber}`);
            console.log(`  Name: ${c.contactName}`);
            console.log(`  Created: ${c.createdAt}`);
            console.log(`  Last Message: ${c.lastMessageAt}`);
            console.log('');
        });

        // Check for specific phone numbers that were just sent to
        const targetPhones = ['255620451936', '255658123881', '255757714834'];
        console.log('\n--- CHECKING FOR RECENT SMS (last 5 minutes) ---');
        for (const phone of targetPhones) {
            const conv = await conversationRepo.findOne({
                where: { phoneNumber: phone, channel: 'SMS' }
            });
            if (conv) {
                console.log(`✅ Found SMS conversation for ${phone}: ${conv.id}`);
            } else {
                console.log(`❌ No SMS conversation for ${phone}`);
            }
        }

        console.log('\n--- SMS MESSAGES (Last 10) ---');
        const recentMessages = await messageRepo.find({
            where: { channel: 'SMS' },
            order: { createdAt: 'DESC' },
            take: 10
        });

        console.log(`Total Recent SMS Messages: ${recentMessages.length}\n`);
        recentMessages.forEach(m => {
            console.log(`[${m.direction}] ${m.content?.substring(0, 50)}... (${m.createdAt})`);
        });
        process.exit(0);
    } catch (error) {
        console.error('Error checking SMS messages:', error);
        process.exit(1);
    }
}

checkSMSMessages();
