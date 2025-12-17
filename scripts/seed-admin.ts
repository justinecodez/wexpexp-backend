import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../src/config/database';
import { User } from '../src/entities/User';
import { UserRole } from '../src/entities/enums';

async function seedAdmin() {
    console.log('🌱 Starting admin user seed...');

    try {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log('✅ Database connected');
        }

        const userRepository = AppDataSource.getRepository(User);

        // Check if admin already exists
        const existingAdmin = await userRepository.findOne({
            where: { email: 'admin@wexpevents.co.tz' }
        });

        if (existingAdmin) {
            console.log('⚠️  Admin user already exists!');
            console.log('   Email: admin@wexpevents.co.tz');
            return;
        }

        // Create admin user
        const passwordHash = await bcrypt.hash('Admin123!', 10);

        const admin = userRepository.create({
            email: 'admin@wexpevents.co.tz',
            passwordHash: passwordHash,
            firstName: 'Admin',
            lastName: 'User',
            role: UserRole.ADMIN,
            isVerified: true,
            phone: '+255750451936',
        });

        await userRepository.save(admin);

        console.log('✅ Admin user created successfully!');
        console.log('');
        console.log('   📧 Email:    admin@wexpevents.co.tz');
        console.log('   🔑 Password: Admin123!');
        console.log('   👤 Role:     ADMIN');
        console.log('');
        console.log('⚠️  IMPORTANT: Change this password after first login!');

    } catch (error) {
        console.error('❌ Error seeding admin:', error);
        throw error;
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log('✅ Database connection closed');
        }
    }
}

seedAdmin();
