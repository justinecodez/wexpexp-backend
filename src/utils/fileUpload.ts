import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import config from '../config';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';

// Ensure upload directories exist
const createUploadDirs = () => {
  const dirs = [
    path.join(config.uploadDir, 'profiles'),
    path.join(config.uploadDir, 'events'),
    path.join(config.uploadDir, 'ecards'),
    path.join(config.uploadDir, 'services'),
    path.join(config.uploadDir, 'landing'),
    path.join(config.uploadDir, 'temp'),
    path.join(config.uploadDir, 'cards'), // For generated invitation cards
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created upload directory: ${dir}`);
    }
  });
};

// Initialize upload directories
createUploadDirs();

// File filter function
const fileFilter = (allowedTypes: string[]) => {
  return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
        400,
        'INVALID_FILE_TYPE'
      ));
    }
  };
};

// Storage configuration
const createStorage = (subfolder: string) => {
  return multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb) => {
      const uploadPath = path.join(config.uploadDir, subfolder);
      cb(null, uploadPath);
    },
    filename: (req: Request, file: Express.Multer.File, cb) => {
      // Generate unique filename
      const uniqueSuffix = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
      cb(null, `${sanitizedName}_${uniqueSuffix}${ext}`);
    },
  });
};

// Common file type groups
export const FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  SPREADSHEETS: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  CSV: ['text/csv', 'application/csv'],
  ALL_DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv',
  ],
};

// Profile image upload
export const uploadProfileImage = multer({
  storage: createStorage('profiles'),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: fileFilter(FILE_TYPES.IMAGES),
});

// Event images upload
export const uploadEventImages = multer({
  storage: createStorage('events'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Maximum 10 files
  },
  fileFilter: fileFilter(FILE_TYPES.IMAGES),
});

// E-card assets upload
export const uploadECardAssets = multer({
  storage: createStorage('ecards'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Maximum 5 files
  },
  fileFilter: fileFilter(FILE_TYPES.IMAGES),
});

// Service images upload
export const uploadServiceImages = multer({
  storage: createStorage('services'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 20, // Maximum 20 files
  },
  fileFilter: fileFilter(FILE_TYPES.IMAGES),
});

// Landing page assets upload
export const uploadLandingAssets = multer({
  storage: createStorage('landing'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Maximum 10 files
  },
  fileFilter: fileFilter(FILE_TYPES.IMAGES),
});

// CSV upload for guest lists
export const uploadCSV = multer({
  storage: createStorage('temp'),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: fileFilter(FILE_TYPES.CSV),
});

// Excel upload for guest lists
export const uploadExcel = multer({
  storage: createStorage('temp'),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: fileFilter(FILE_TYPES.SPREADSHEETS),
});

// General document upload
export const uploadDocuments = multer({
  storage: createStorage('temp'),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 5,
  },
  fileFilter: fileFilter(FILE_TYPES.ALL_DOCUMENTS),
});

// Utility functions
export const getFileUrl = (filename: string, subfolder: string = ''): string => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${config.port}`;
  const path = subfolder ? `uploads/${subfolder}/${filename}` : `uploads/${filename}`;
  return `${baseUrl}/${path}`;
};

export const deleteFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`File deleted: ${filePath}`);
    }
  } catch (error) {
    logger.error(`Error deleting file ${filePath}:`, error);
  }
};

export const deleteFileByUrl = (fileUrl: string): void => {
  try {
    const baseUrl = process.env.BASE_URL || `http://localhost:${config.port}`;
    const relativePath = fileUrl.replace(`${baseUrl}/`, '');
    const fullPath = path.join(process.cwd(), relativePath);
    deleteFile(fullPath);
  } catch (error) {
    logger.error(`Error deleting file by URL ${fileUrl}:`, error);
  }
};

export const getFileInfo = (file: Express.Multer.File, subfolder: string = '') => {
  return {
    filename: file.filename,
    originalName: file.originalname,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    url: getFileUrl(file.filename, subfolder),
  };
};

export const validateFileSize = (file: Express.Multer.File, maxSizeBytes: number): boolean => {
  return file.size <= maxSizeBytes;
};

export const validateFileType = (file: Express.Multer.File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.mimetype);
};

// Clean up temporary files older than 24 hours
export const cleanupTempFiles = () => {
  const tempDir = path.join(config.uploadDir, 'temp');
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  if (!fs.existsSync(tempDir)) return;

  fs.readdir(tempDir, (err, files) => {
    if (err) {
      logger.error('Error reading temp directory:', err);
      return;
    }

    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        const now = Date.now();
        const fileAge = now - stats.mtime.getTime();

        if (fileAge > maxAge) {
          deleteFile(filePath);
        }
      });
    });
  });
};

// Schedule cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);

export default {
  uploadProfileImage,
  uploadEventImages,
  uploadECardAssets,
  uploadServiceImages,
  uploadLandingAssets,
  uploadCSV,
  uploadExcel,
  uploadDocuments,
  getFileUrl,
  deleteFile,
  deleteFileByUrl,
  getFileInfo,
  FILE_TYPES,
};
