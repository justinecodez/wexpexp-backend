import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import path from 'path';
import config from './index';
import logger from './logger';
import { entityClasses } from '../entities';

// Get database configuration based on environment
const getDatabaseConfig = (): DataSourceOptions => {
  // Use SQLite for local development
  if (config.nodeEnv === 'development') {
    logger.info('Using SQLite database for development');
    return {
      type: 'sqlite',
      database: path.join(process.cwd(), 'database.sqlite'),
      synchronize: true,
      logging: ['error', 'warn', 'migration'],
      entities: entityClasses,
      migrations: [path.join(__dirname, '../migrations/*.ts')],
      subscribers: [path.join(__dirname, '../subscribers/*.ts')],
      migrationsTableName: 'typeorm_migrations',
      cache: {
        duration: 30000,
      },
    };
  }

  // Use PostgreSQL for production
  logger.info('Using PostgreSQL database for production');
  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'shared-postgres',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'wexpevents',
    password: process.env.DATABASE_PASSWORD || 'wexpevents123',
    database: process.env.DATABASE_NAME || 'wexpevents',
    synchronize: true, // Auto-create tables
    logging: ['error', 'warn'],
    entities: entityClasses,
    migrations: [path.join(__dirname, '../migrations/*.ts')],
    subscribers: [path.join(__dirname, '../subscribers/*.ts')],
    migrationsTableName: 'typeorm_migrations',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
};

const dataSourceOptions = getDatabaseConfig();

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
        const dbType = config.nodeEnv === 'development' ? 'SQLite' : 'PostgreSQL';
        logger.info(`Successfully connected to ${dbType} database`);

        // Run migrations in production
        if (config.nodeEnv === 'production') {
          try {
            await this.dataSource.runMigrations();
            logger.info('Database migrations completed');
          } catch (migrationError) {
            logger.warn('Migration warning:', migrationError);
          }
        }

        // Service test - verify database is responding
        await this.runServiceTest();
      }
    } catch (error: any) {
      logger.error('Failed to connect to database:');
      logger.error('Error message:', error?.message || error);
      logger.error('Error stack:', error?.stack);
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

  private async runServiceTest(): Promise<void> {
    try {
      // Run a simple test query
      const result = await this.dataSource.query('SELECT 1 as test');
      logger.info('✅ Database service test PASSED');
      logger.info(`   - Database type: ${this.dataSource.options.type}`);
      if (this.dataSource.options.type === 'postgres') {
        const opts = this.dataSource.options as any;
        logger.info(`   - Host: ${opts.host}:${opts.port}`);
        logger.info(`   - Database: ${opts.database}`);
      }
      logger.info(`   - Query result: ${JSON.stringify(result)}`);
    } catch (error: any) {
      logger.error('❌ Database service test FAILED:', error?.message);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        return false;
      }

      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  public getRepository<T>(entity: new () => T) {
    return this.dataSource.getRepository(entity);
  }

  public getEntityManager() {
    return this.dataSource.manager;
  }
}

export default Database.getInstance();

export const database = Database.getInstance();
export { AppDataSource as dataSource };
