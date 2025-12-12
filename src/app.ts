import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Import configuration and middleware
import config from './config';
import logger from './config/logger';
import database from './config/database';
import corsMiddleware from './middleware/cors';
import { generalLimiter } from './middleware/rateLimit';
import { errorHandler, notFound } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import invitationRoutes from './routes/invitations';
import tourRoutes from './routes/tours';
import vehicleRoutes from './routes/vehicles';
import accommodationRoutes from './routes/accommodations';
import testRoutes from './routes/test';
import templateRoutes from './routes/templates';
import budgetRoutes from './routes/budgets';
import calendarRoutes from './routes/calendar';
import draftRoutes from './routes/drafts';
// New routes
import userRoutes from './routes/users';
import ecardRoutes from './routes/ecards';
import venueRoutes from './routes/venues';
import decorationRoutes from './routes/decorations';
import carImportRoutes from './routes/car-import';
import insuranceRoutes from './routes/insurance';
import landingRoutes from './routes/landing';
import communicationRoutes from './routes/communications';
import messagingRoutes from './routes/messagingRoutes';
import webhookRoutes from './routes/webhooks';
import whatsappRoutes from './routes/whatsapp.routes';
import conversationRoutes from './routes/conversations';

// Import Socket.IO service
import SocketService from './services/socketService';
import communicationService from './services/communicationService';
import socketEmitter from './utils/socketEmitter';

class App {
  public app: express.Application;
  public server: any;
  public io: SocketIOServer;
  public socketService!: SocketService;

  constructor() {
    this.app = express();

    // Enable trust proxy to handle X-Forwarded-For header correctly
    // Required for rate limiting and accurate IP detection behind reverse proxies
    this.app.set('trust proxy', true);

    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeSocketIO();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:', 'http://localhost:3001', 'http://127.0.0.1:3001'],
          },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
      })
    );

    // CORS
    this.app.use(corsMiddleware);

    // Rate limiting
    this.app.use(generalLimiter);

    // JSON parsing middleware

    // Body parsing middleware
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Handle OPTIONS requests for static files
    this.app.options('/uploads/*', (req, res) => {
      const origin = req.headers.origin;
      if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      }
      res.status(200).end();
    });

    // Static files with CORS headers
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
      setHeaders: (res, path) => {
        // Set CORS headers for all static file responses
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
      }
    }));
    this.app.use('/public', express.static(path.join(process.cwd(), 'public')));

    // HTTP request logger
    const morganFormat = config.nodeEnv === 'development' ? 'dev' : 'combined';
    this.app.use(
      morgan(morganFormat, {
        stream: {
          write: (message: string) => {
            logger.http(message.trim());
          },
        },
      })
    );

    // Add request ID for tracking
    this.app.use((req, res, next) => {
      req.requestId = Math.random().toString(36).substring(2, 15);
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });

    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const isDbHealthy = await database.healthCheck();
      const emailHealth = await communicationService.emailHealthCheck();

      const overallHealthy = isDbHealthy && emailHealth.healthy;

      res.status(overallHealthy ? 200 : 503).json({
        success: overallHealthy,
        message: overallHealthy ? 'All services are healthy' : 'Some services are unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        services: {
          database: {
            status: isDbHealthy ? 'healthy' : 'unhealthy',
            message: isDbHealthy ? 'Connected' : 'Disconnected',
          },
          email: {
            status: emailHealth.healthy ? 'healthy' : 'unhealthy',
            message: emailHealth.message,
            details: emailHealth.details,
          },
        },
      });
    });

    // Email health check endpoint
    this.app.get('/health/email', async (req, res) => {
      const emailHealth = await communicationService.emailHealthCheck();

      res.status(emailHealth.healthy ? 200 : 503).json({
        success: emailHealth.healthy,
        message: emailHealth.message,
        timestamp: new Date().toISOString(),
        service: 'email',
        details: emailHealth.details,
      });
    });

    // API documentation endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Tanzania Event Planning Platform API',
        version: '1.0.0',
        description: 'Comprehensive event planning and services platform for Tanzania',
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          events: '/api/events',
          invitations: '/api/invitations',
          ecards: '/api/ecards',
          tours: '/api/tours',
          vehicles: '/api/vehicles',
          accommodations: '/api/accommodations',
          venues: '/api/venues',
          decorations: '/api/decorations',
          'car-import': '/api/car-import',
          insurance: '/api/insurance',
          budgeting: '/api/budgets',
          templates: '/api/templates',
          calendar: '/api/calendar',
          landing: '/api/landing',
          communications: '/api/communications',
          messaging: '/api/messaging',
          drafts: '/api/drafts',
          documentation: '/api/docs'
        }
      });
    });
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/events', eventRoutes);
    this.app.use('/api/invitations', invitationRoutes);
    this.app.use('/api/tours', tourRoutes);
    this.app.use('/api/vehicles', vehicleRoutes);
    this.app.use('/api/accommodations', accommodationRoutes);
    this.app.use('/api/test', testRoutes);
    this.app.use('/api/templates', templateRoutes);
    this.app.use('/api/budgets', budgetRoutes);
    this.app.use('/api/calendar', calendarRoutes);
    this.app.use('/api/drafts', draftRoutes);

    // Now implemented routes
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/ecards', ecardRoutes);
    this.app.use('/api/venues', venueRoutes);
    this.app.use('/api/decorations', decorationRoutes);
    this.app.use('/api/car-import', carImportRoutes);
    this.app.use('/api/insurance', insuranceRoutes);
    this.app.use('/api/landing', landingRoutes);
    this.app.use('/api/communications', communicationRoutes);
    this.app.use('/api/messaging', messagingRoutes);
    this.app.use('/api/whatsapp', whatsappRoutes);
    this.app.use('/api/conversations', conversationRoutes);
    this.app.use('/webhooks', webhookRoutes); // WhatsApp webhook (no /api prefix)

    // Card generation routes
    const cardGenerationRoutes = require('./routes/cardGenerationRoutes').default;
    this.app.use('/api/card-generation', cardGenerationRoutes);

    // Temporary placeholder for unimplemented routes
    this.app.get('/api/*', (req, res) => {
      res.status(501).json({
        success: false,
        message: 'This API endpoint is not yet implemented',
        endpoint: req.path,
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFound);

    // Global error handler
    this.app.use(errorHandler);
  }

  private initializeSocketIO(): void {
    // Initialize the socket service
    this.socketService = new SocketService(this.io);

    // Initialize global socket emitter for services
    socketEmitter.setIO(this.io);

    // Make io and socketService available to other parts of the application
    this.app.set('io', this.io);
    this.app.set('socketService', this.socketService);

    logger.info('Socket.IO service initialized');
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await database.connect();
      logger.info('Database connected successfully');

      // Start server
      this.server.listen(config.port, () => {
        logger.info(`🚀 Server running on port ${config.port}`);
        logger.info(`📊 Environment: ${config.nodeEnv}`);
        logger.info(`🌐 CORS origin: ${config.corsOrigin}`);
        logger.info(`📍 Health check: http://localhost:${config.port}/health`);
        logger.info(`📚 API documentation: http://localhost:${config.port}/api`);
      });

      // Graceful shutdown handlers
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));
      process.on('uncaughtException', error => {
        logger.error('Uncaught Exception:', error);
        this.shutdown();
      });
      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        this.shutdown();
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    logger.info('Gracefully shutting down...');

    try {
      // Close Socket.IO connections
      this.io.close();
      logger.info('Socket.IO connections closed');

      // Close HTTP server
      this.server.close(() => {
        logger.info('HTTP server closed');
      });

      // Disconnect from database
      await database.disconnect();
      logger.info('Database disconnected');

      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export default App;
