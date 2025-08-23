import { Request, Response, NextFunction } from 'express';
import { ZodSchema, z } from 'zod';
import { AppError } from './errorHandler';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(error);
      } else {
        next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'));
      }
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(error);
      } else {
        next(new AppError('Query validation failed', 400, 'QUERY_VALIDATION_ERROR'));
      }
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.params);
      req.params = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(error);
      } else {
        next(new AppError('Params validation failed', 400, 'PARAMS_VALIDATION_ERROR'));
      }
    }
  };
};

export const validateFile = (
  required: boolean = false,
  allowedTypes: string[] = [],
  maxSize: number = 10 * 1024 * 1024 // 10MB default
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    const files = req.files;

    // Check if file is required
    if (required && !file && (!files || (Array.isArray(files) && files.length === 0))) {
      return next(new AppError('File is required', 400, 'FILE_REQUIRED'));
    }

    // Validate single file
    if (file) {
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        return next(new AppError(
          `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
          400,
          'INVALID_FILE_TYPE'
        ));
      }

      if (file.size > maxSize) {
        return next(new AppError(
          `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`,
          400,
          'FILE_TOO_LARGE'
        ));
      }
    }

    // Validate multiple files
    if (files && Array.isArray(files)) {
      for (const uploadedFile of files) {
        if (allowedTypes.length > 0 && !allowedTypes.includes(uploadedFile.mimetype)) {
          return next(new AppError(
            `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
            400,
            'INVALID_FILE_TYPE'
          ));
        }

        if (uploadedFile.size > maxSize) {
          return next(new AppError(
            `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`,
            400,
            'FILE_TOO_LARGE'
          ));
        }
      }
    }

    next();
  };
};

// Common validation schemas
export const idParamSchema = z.object({
  id: z.string().cuid('Invalid ID format'),
});

export const paginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, { message: 'Page must be positive' }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val > 0 && val <= 100, { message: 'Limit must be between 1 and 100' }),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const searchQuerySchema = z.object({
  search: z.string().optional(),
  ...paginationQuerySchema.shape,
});
