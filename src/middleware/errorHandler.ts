import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import logger from '../config/logger';
import { ApiResponse } from '../types';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

const sendErrorDev = (err: any, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: err.message,
    data: {
      stack: err.stack,
      statusCode: err.statusCode,
      code: err.code,
    },
  };

  res.status(err.statusCode || 500).json(response);
};

const sendErrorProd = (err: any, res: Response) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response: ApiResponse = {
      success: false,
      error: err.message,
    };

    res.status(err.statusCode).json(response);
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('ERROR 💥', err);

    const response: ApiResponse = {
      success: false,
      error: 'Something went wrong!',
    };

    res.status(500).json(response);
  }
};

const handleZodError = (err: ZodError): AppError => {
  const errors = err.errors.map(error => ({
    field: error.path.join('.'),
    message: error.message,
  }));

  const message = `Validation error: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`;
  return new AppError(message, 400, 'VALIDATION_ERROR');
};

const handlePrismaValidationError = (err: any): AppError => {
  const message = 'Invalid data provided';
  return new AppError(message, 400, 'INVALID_DATA');
};

const handlePrismaKnownRequestError = (err: any): AppError => {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      const target = err.meta?.target as string[];
      const field = target ? target[0] : 'field';
      const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
      return new AppError(message, 409, 'DUPLICATE_ENTRY');

    case 'P2025':
      // Record not found
      return new AppError('Record not found', 404, 'NOT_FOUND');

    case 'P2003':
      // Foreign key constraint violation
      return new AppError('Related record not found', 400, 'FOREIGN_KEY_VIOLATION');

    case 'P2014':
      // Relation violation
      return new AppError('Invalid relation data', 400, 'RELATION_VIOLATION');

    default:
      return new AppError('Database operation failed', 500, 'DATABASE_ERROR');
  }
};

const handleJWTError = (): AppError =>
  new AppError('Invalid token. Please log in again!', 401, 'INVALID_TOKEN');

const handleJWTExpiredError = (): AppError =>
  new AppError('Your token has expired! Please log in again.', 401, 'TOKEN_EXPIRED');

const handleMulterError = (err: any): AppError => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large', 400, 'FILE_TOO_LARGE');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field', 400, 'UNEXPECTED_FILE');
  }
  return new AppError('File upload error', 400, 'UPLOAD_ERROR');
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(err);

  // Zod validation error
  if (err instanceof ZodError) {
    error = handleZodError(err);
  }

  // Prisma errors
  if (err.name === 'PrismaClientValidationError') {
    error = handlePrismaValidationError(err);
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    error = handlePrismaKnownRequestError(err);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Multer errors
  if (err.code && err.code.startsWith('LIMIT_')) {
    error = handleMulterError(err);
  }

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const err = new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(err);
};
