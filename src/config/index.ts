import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

interface Config {
  // Server
  port: number;
  nodeEnv: string;
  corsOrigin: string;

  // Database
  databasePath: string;

  // JWT
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtExpireTime: string;
  jwtRefreshExpireTime: string;

  // File Upload
  maxFileSize: number;
  uploadDir: string;

  // Email
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  fromEmail: string;
  fromName: string;

  // SMS (Tanzania)
  sms: {
    provider: string;
    messagingService: {
      username: string;
      password: string;
      apiUrl: string;
      defaultFrom: string;
    };
    beem: {
      apiKey: string;
      secretKey: string;
    };
    ttcl: {
      username: string;
      password: string;
    };
  };

  // WhatsApp
  whatsapp: {
    token: string;
    phoneId: string;
    verifyToken: string;
  };

  // Payment Gateways (Tanzania)
  payments: {
    mpesa: {
      consumerKey: string;
      consumerSecret: string;
    };
    tigoPesa: {
      clientId: string;
      clientSecret: string;
    };
    airtelMoney: {
      clientId: string;
      clientSecret: string;
    };
  };

  // Cloud Storage
  aws?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
  };

  cloudinary?: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };

  backblaze?: {
    applicationKeyId: string;
    applicationKey: string;
    bucketId: string;
    bucketName: string;
    endpoint: string;
  };

  // Google Maps
  googleMapsApiKey: string;

  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };

  // Tanzania Specific
  tanzania: {
    timezone: string;
    currency: string;
    phoneCountryCode: string;
  };

  // Admin
  admin: {
    email: string;
    password: string;
  };
}

const config: Config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Database
  databasePath: process.env.DATABASE_PATH || './database.sqlite',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-here',
  jwtExpireTime: process.env.JWT_EXPIRE_TIME || '1h',
  jwtRefreshExpireTime: process.env.JWT_REFRESH_EXPIRE_TIME || '7d',

  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  uploadDir: process.env.UPLOAD_DIR || './uploads',

  // Email
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  fromEmail: process.env.FROM_EMAIL || 'noreply@tanzaniaevents.com',
  fromName: process.env.FROM_NAME || 'Tanzania Events Platform',

  // SMS
  sms: {
    provider: process.env.SMS_PROVIDER || 'messaging-service',
    messagingService: {
      username: process.env.MESSAGING_SERVICE_USERNAME || 'justinecodez',
      password: process.env.MESSAGING_SERVICE_PASSWORD || 'YTj5BM8wtaTJHA@',
      apiUrl: process.env.MESSAGING_SERVICE_API_URL || 'https://messaging-service.co.tz/api/sms/v1/text/single',
      defaultFrom: process.env.MESSAGING_SERVICE_DEFAULT_FROM || 'Wexp Card',
    },
    beem: {
      apiKey: process.env.BEEM_API_KEY || '',
      secretKey: process.env.BEEM_SECRET_KEY || '',
    },
    ttcl: {
      username: process.env.TTCL_USERNAME || '',
      password: process.env.TTCL_PASSWORD || '',
    },
  },

  // WhatsApp
  whatsapp: {
    token: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  },

  // Payments
  payments: {
    mpesa: {
      consumerKey: process.env.MPESA_CONSUMER_KEY || '',
      consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    },
    tigoPesa: {
      clientId: process.env.TIGO_PESA_CLIENT_ID || '',
      clientSecret: process.env.TIGO_PESA_CLIENT_SECRET || '',
    },
    airtelMoney: {
      clientId: process.env.AIRTEL_MONEY_CLIENT_ID || '',
      clientSecret: process.env.AIRTEL_MONEY_CLIENT_SECRET || '',
    },
  },

  // Cloud Storage
  aws: process.env.AWS_ACCESS_KEY_ID
    ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1',
      bucketName: process.env.AWS_BUCKET_NAME || '',
    }
    : undefined,

  backblaze: process.env.BACKBLAZE_B2_APPLICATION_KEY
    ? {
      applicationKeyId: process.env.BACKBLAZE_B2_KEY_ID || '',
      applicationKey: process.env.BACKBLAZE_B2_APPLICATION_KEY || '',
      bucketId: process.env.BACKBLAZE_B2_BUCKET_ID || '',
      bucketName: process.env.BACKBLAZE_B2_BUCKET || '',
      endpoint: process.env.BACKBLAZE_B2_ENDPOINT || '',
    }
    : undefined,

  cloudinary: process.env.CLOUDINARY_CLOUD_NAME
    ? {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    }
    : undefined,

  // Google Maps
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Tanzania Specific
  tanzania: {
    timezone: process.env.DEFAULT_TIMEZONE || 'Africa/Dar_es_Salaam',
    currency: process.env.DEFAULT_CURRENCY || 'TZS',
    phoneCountryCode: process.env.DEFAULT_PHONE_COUNTRY_CODE || '+255',
  },

  // Admin
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@tanzaniaevents.com',
    password: process.env.ADMIN_PASSWORD || 'SecurePassword123!',
  },
};

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0 && config.nodeEnv === 'production') {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

export default config;
