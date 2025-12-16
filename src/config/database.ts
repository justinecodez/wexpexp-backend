import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import path from 'path';
import config from './index';
import logger from './logger';
import { entityClasses } from '../entities';

// PostgreSQL Database Configuration
const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'wexpevents',
  password: process.env.DATABASE_PASSWORD || 'wexpevents123',
  database: process.env.DATABASE_NAME || 'wexpevents',
  synchronize: true, // Auto-create tables (safe for now, disable in production later)
  logging: config.nodeEnv === 'development' ? ['error', 'warn', 'migration'] : false,
  entities: entityClasses,
  migrations: [path.join(__dirname, '../migrations/*.ts')],
  subscribers: [path.join(__dirname, '../subscribers/*.ts')],
  migrationsTableName: 'typeorm_migrations',
  // PostgreSQL specific options
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

export const AppDataSource = new DataSource(dataSourceOptions);

class Database {
  private static instance: Database;
  private dataSource: DataSource;

  private constructor() {
    this.dataSource = AppDataSource;
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public getDataSource(): DataSource {
    return this.dataSource;
  }

  public async connect(): Promise<void> {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
        logger.info('Successfully connected to PostgreSQL database');

        // Run migrations in production
        if (config.nodeEnv === 'production') {
          try {
            await this.dataSource.runMigrations();
            logger.info('Database migrations completed');
          } catch (migrationError) {
            logger.warn('Migration warning:', migrationError);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
        logger.info('Disconnected from database');
      }
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        return false;
      }

      // Simple query to check connection
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  // Helper method to get repository
  public getRepository<T>(entity: new () => T) {
    return this.dataSource.getRepository(entity);
  }

  // Helper method to get entity manager
  public getEntityManager() {
    return this.dataSource.manager;
  }
}

export default Database.getInstance();

// Export commonly used items
export const database = Database.getInstance();
export { AppDataSource as dataSource };
