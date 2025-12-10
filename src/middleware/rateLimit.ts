import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import config from '../config';
import logger from '../config/logger';

// General rate limiter (excludes chat routes which have their own limiter)
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for chat routes (they have their own limiter)
    return req.path.startsWith('/api/conversations');
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
    });
  },
});

// Strict rate limiter for authentication endpoints
// export const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // Limit each IP to 5 requests per windowMs
//   message: {
//     success: false,
//     error: 'Too many authentication attempts, please try again later.',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   skipSuccessfulRequests: true, // Don't count successful requests
//   handler: (req: Request, res: Response) => {
//     logger.warn(`Auth rate limit exceeded for IP: ${req.ip} on ${req.path}`);
//     res.status(429).json({
//       success: false,
//       error: 'Too many authentication attempts, please try again later.',
//     });
//   },
// });

// Password reset rate limiter
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Password reset rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many password reset attempts, please try again later.',
    });
  },
});

// Email sending rate limiter
export const emailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 email requests per minute
  message: {
    success: false,
    error: 'Too many email requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Email rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many email requests, please try again later.',
    });
  },
});

// SMS sending rate limiter
export const smsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 SMS requests per minute
  message: {
    success: false,
    error: 'Too many SMS requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`SMS rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many SMS requests, please try again later.',
    });
  },
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 upload requests per 15 minutes
  message: {
    success: false,
    error: 'Too many file upload requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many file upload requests, please try again later.',
    });
  },
});

// API rate limiter for external integrations
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 API requests per minute
  message: {
    success: false,
    error: 'API rate limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`API rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      error: 'API rate limit exceeded, please try again later.',
    });
  },
});

// Messaging rate limiter (combines SMS and email)
export const messagingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 messaging requests per minute
  message: {
    success: false,
    error: 'Too many messaging requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Messaging rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many messaging requests, please try again later.',
    });
  },
});

// Create a custom rate limiter factory
export const createRateLimiter = (
  windowMs: number,
  max: number,
  message: string,
  skipSuccessfulRequests: boolean = false
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req: Request, res: Response) => {
      logger.warn(`Custom rate limit exceeded for IP: ${req.ip} on ${req.path}`);
      res.status(429).json({
        success: false,
        error: message,
      });
    },
  });
};

// Chat/Conversation rate limiter - more lenient for real-time chat
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Allow 60 requests per minute (1 per second average)
  message: {
    success: false,
    error: 'Too many chat requests, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Chat rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      error: 'Too many chat requests, please slow down.',
    });
  },
});

// Export grouped rate limiters for easier import
export const rateLimiter = {
  general: generalLimiter,
  passwordReset: passwordResetLimiter,
  email: emailLimiter,
  sms: smsLimiter,
  messaging: messagingLimiter,
  upload: uploadLimiter,
  api: apiLimiter,
  chat: chatLimiter,
};
