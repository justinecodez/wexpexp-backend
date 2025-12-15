
import { AppDataSource } from '../src/config/database';
import { User } from '../src/entities/User';
import { Conversation } from '../src/entities/Conversation';
import logger from '../src/config/logger';

async function debugData() {
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        const userRepo = AppDataSource.getRepository(User);
        const conversationRepo = AppDataSource.getRepository(Conversation);

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
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

debugData();
