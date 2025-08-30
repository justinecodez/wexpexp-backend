import { AppDataSource } from '../src/config/database';

AppDataSource.initialize()
  .then(async () => {
    try {
      await AppDataSource.runMigrations();
      console.log('Migrations completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error running migrations:', error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Error initializing database:', error);
    process.exit(1);
  });
