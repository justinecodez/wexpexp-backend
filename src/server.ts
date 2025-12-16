import 'reflect-metadata';
import dotenv from "dotenv"
// Load environment variables first
dotenv.config();
import App from './app';
import logger from './config/logger';
async function startServer() {
  try {
    const app = new App();
    await app.start();
  } catch (error) {
    logger.error('Failed to start application:', error);
  }
}
// Start the server
startServer();
