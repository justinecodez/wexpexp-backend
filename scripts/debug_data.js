"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../src/config/database");
const User_1 = require("../src/entities/User");
const Conversation_1 = require("../src/entities/Conversation");
async function debugData() {
    try {
        if (!database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.initialize();
        }
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        const conversationRepo = database_1.AppDataSource.getRepository(Conversation_1.Conversation);
        console.log('\n--- USERS ---');
        const users = await userRepo.find({
            select: ['id', 'firstName', 'lastName', 'email', 'createdAt'],
            order: { createdAt: 'DESC' }
        });
        users.forEach(u => {
            console.log(`ID: ${u.id} | Name: ${u.firstName} ${u.lastName} | Email: ${u.email}`);
        });
        console.log('\n--- CONVERSATIONS ---');
        const conversations = await conversationRepo.find({
            select: ['id', 'userId', 'phoneNumber', 'contactName', 'channel'],
            order: { createdAt: 'DESC' }
        });
        conversations.forEach(c => {
            console.log(`ID: ${c.id} | UserID: ${c.userId} | Phone: ${c.phoneNumber} | Channel: ${c.channel} | Name: ${c.contactName}`);
        });
        process.exit(0);
    }
    catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}
debugData();
//# sourceMappingURL=debug_data.js.map