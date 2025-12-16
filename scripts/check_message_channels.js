"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const Conversation_1 = require("../src/entities/Conversation");
const Message_1 = require("../src/entities/Message");
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.resolve(__dirname, '../database.sqlite');
const AppDataSource = new typeorm_1.DataSource({
    type: 'sqlite',
    database: dbPath,
    entities: [Conversation_1.Conversation, Message_1.Message],
    synchronize: false,
});
async function checkMessageChannels() {
    console.log('🔍 Checking message channels in database...\n');
    try {
        await AppDataSource.initialize();
        console.log('✅ Database connected\n');
        const conversationRepo = AppDataSource.getRepository(Conversation_1.Conversation);
        const messageRepo = AppDataSource.getRepository(Message_1.Message);
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
    }
    catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}
checkMessageChannels();
//# sourceMappingURL=check_message_channels.js.map