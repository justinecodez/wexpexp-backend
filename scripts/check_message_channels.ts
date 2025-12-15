import { DataSource } from 'typeorm';
import { Conversation } from '../src/entities/Conversation';
import { Message } from '../src/entities/Message';
import path from 'path';

const dbPath = path.resolve(__dirname, '../database.sqlite');

const AppDataSource = new DataSource({
    type: 'sqlite',
    database: dbPath,
    entities: [Conversation, Message],
    synchronize: false,
});

async function checkMessageChannels() {
    console.log('🔍 Checking message channels in database...\n');

    try {
        await AppDataSource.initialize();
        console.log('✅ Database connected\n');

        const conversationRepo = AppDataSource.getRepository(Conversation);
        const messageRepo = AppDataSource.getRepository(Message);

        // Check for specific template message
        const templateMessages = await messageRepo
            .createQueryBuilder('msg')
            .where('msg.content LIKE :pattern', { pattern: '%You are cordially invited to%' })
            .getMany();

        console.log(`\n📝 Found ${templateMessages.length} messages with template text:`);
        for (const msg of templateMessages) {
            const conv = await conversationRepo.findOne({ where: { id: msg.conversationId } });
            console.log(`\n  Message ${msg.id}:`);
            console.log(`    Message Channel: ${msg.channel}`);
            console.log(`    Conversation ID: ${msg.conversationId}`);
            console.log(`    Conversation Channel: ${conv?.channel}`);
            console.log(`    Phone: ${conv?.phoneNumber}`);
            console.log(`    Content: "${msg.content?.substring(0, 80)}..."`);
            console.log(`    Direction: ${msg.direction}`);
            console.log(`    Sent At: ${msg.sentAt}`);

            // Check if there's a mismatch
            if (msg.channel !== conv?.channel) {
                console.log(`    ⚠️  MISMATCH: Message channel (${msg.channel}) != Conversation channel (${conv?.channel})`);
            }
        }

        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkMessageChannels();
