import { AppDataSource } from '../src/config/database';
import logger from '../src/config/logger';
import { AddChannelToConversationsAndMessages1714000000000 } from '../src/migrations/1714000000001-AddChannelMessage';

async function runMigrations() {
    try {
        logger.info('Initializing data source...');
        // Override migrations and disable sync
        AppDataSource.setOptions({
            migrations: [AddChannelToConversationsAndMessages1714000000000],
            synchronize: false,
            logging: ['error', 'warn', 'migration']
        });

        await AppDataSource.initialize();
        logger.info('Data source initialized.');

        logger.info('Running specific migration: AddChannelToConversationsAndMessages1714000000000');
        const migrations = await AppDataSource.runMigrations();
        logger.info(`Migrations executed: ${migrations.length}`);

        migrations.forEach(m => logger.info(`- ${m.name}`));

        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        logger.error('Error running migrations:', error);
        process.exit(1);
    }
}

runMigrations();
