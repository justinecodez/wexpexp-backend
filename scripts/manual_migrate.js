"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../src/config/database");
const logger_1 = __importDefault(require("../src/config/logger"));
const _1714000000001_AddChannelMessage_1 = require("../src/migrations/1714000000001-AddChannelMessage");
async function runMigrations() {
    try {
        logger_1.default.info('Initializing data source...');
        // Override migrations and disable sync
        database_1.AppDataSource.setOptions({
            migrations: [_1714000000001_AddChannelMessage_1.AddChannelToConversationsAndMessages1714000000000],
            synchronize: false,
            logging: ['error', 'warn', 'migration']
        });
        await database_1.AppDataSource.initialize();
        logger_1.default.info('Data source initialized.');
        logger_1.default.info('Running specific migration: AddChannelToConversationsAndMessages1714000000000');
        const migrations = await database_1.AppDataSource.runMigrations();
        logger_1.default.info(`Migrations executed: ${migrations.length}`);
        migrations.forEach(m => logger_1.default.info(`- ${m.name}`));
        await database_1.AppDataSource.destroy();
        process.exit(0);
    }
    catch (error) {
        logger_1.default.error('Error running migrations:', error);
        process.exit(1);
    }
}
runMigrations();
//# sourceMappingURL=manual_migrate.js.map