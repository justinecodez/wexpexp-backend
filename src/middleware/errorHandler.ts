import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
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

const handleTypeOrmQueryFailedError = (err: QueryFailedError): AppError => {
  // Handle SQLite/Database specific errors
  const sqliteError = err as any;

  // Unique constraint violation
  if (
    sqliteError.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    err.message.includes('UNIQUE constraint failed')
  ) {
    const match = err.message.match(/UNIQUE constraint failed: (\w+)\.(\w+)/);
    const field = match ? match[2] : 'field';
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    return new AppError(message, 409, 'DUPLICATE_ENTRY');
  }

  // Foreign key constraint violation
  if (
    sqliteError.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
    err.message.includes('FOREIGN KEY constraint failed')
  ) {
    return new AppError('Related record not found', 400, 'FOREIGN_KEY_VIOLATION');
  }

  // Check constraint violation
  if (
    sqliteError.code === 'SQLITE_CONSTRAINT_CHECK' ||
    err.message.includes('CHECK constraint failed')
  ) {
    return new AppError('Invalid data provided', 400, 'CHECK_CONSTRAINT_VIOLATION');
  }

  // Not null constraint violation
  if (
    sqliteError.code === 'SQLITE_CONSTRAINT_NOTNULL' ||
    err.message.includes('NOT NULL constraint failed')
  ) {
    const match = err.message.match(/NOT NULL constraint failed: (\w+)\.(\w+)/);
    const field = match ? match[2] : 'field';
    return new AppError(`${field} is required`, 400, 'REQUIRED_FIELD');
  }

  return new AppError('Database operation failed', 500, 'DATABASE_ERROR');
};

const handleTypeOrmEntityNotFoundError = (err: EntityNotFoundError): AppError => {
  return new AppError('Record not found', 404, 'NOT_FOUND');
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
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    statusCode: err.statusCode || 500,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // Zod validation error
  if (err instanceof ZodError) {
    error = handleZodError(err);
  }

  // TypeORM errors
  if (err instanceof QueryFailedError) {
    error = handleTypeOrmQueryFailedError(err);
  }

  if (err instanceof EntityNotFoundError) {
    error = handleTypeOrmEntityNotFoundError(err);
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
