import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { AppError } from './errorHandler.js';
import logger from '../config/logger.js';

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const CV_UPLOADS_DIR = path.join(UPLOADS_DIR, 'cvs');
const TEMP_UPLOADS_DIR = path.join(UPLOADS_DIR, 'temp');

// Create directories if they don't exist
async function ensureDirectories() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(CV_UPLOADS_DIR, { recursive: true });
    await fs.mkdir(TEMP_UPLOADS_DIR, { recursive: true });
  } catch (error) {
    logger.error('Failed to create upload directories', { error });
  }
}

// Initialize directories
ensureDirectories();

// File type validation
const ALLOWED_CV_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);

const ALLOWED_CV_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt']);

// File size limits
const MAX_CV_SIZE = (config.MAX_FILE_SIZE_MB || 10) * 1024 * 1024; // 10MB default

// Storage configuration for CVs
const cvStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    cb(null, CV_UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'anonymous';
    const fileExtension = path.extname(file.originalname);
    const filename = `${userId}_${uuidv4()}${fileExtension}`;
    cb(null, filename);
  }
});

// File filter for CVs
const cvFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  // Check file type and extension
  if (!ALLOWED_CV_TYPES.has(file.mimetype) || !ALLOWED_CV_EXTENSIONS.has(fileExtension)) {
    const error = new AppError(400, 
      `Invalid file type. Allowed types: ${Array.from(ALLOWED_CV_EXTENSIONS).join(', ')}`,
      'INVALID_FILE_TYPE'
    );
    return cb(error);
  }

  cb(null, true);
};

// CV upload middleware
export const uploadCV = multer({
  storage: cvStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: MAX_CV_SIZE,
    files: 1
  }
}).single('cv');

// Profile picture upload configuration
const profilePictureStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const profileDir = path.join(UPLOADS_DIR, 'profiles');
    await fs.mkdir(profileDir, { recursive: true });
    cb(null, profileDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'anonymous';
    const fileExtension = path.extname(file.originalname);
    const filename = `${userId}_profile_${uuidv4()}${fileExtension}`;
    cb(null, filename);
  }
});

const profilePictureFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (!allowedTypes.has(file.mimetype) || !allowedExtensions.has(fileExtension)) {
    const error = new AppError(400, 
      'Invalid image type. Allowed types: jpg, jpeg, png, webp',
      'INVALID_IMAGE_TYPE'
    );
    return cb(error);
  }

  cb(null, true);
};

// Profile picture upload middleware
export const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  fileFilter: profilePictureFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for images
    files: 1
  }
}).single('profilePicture');

// Company logo upload configuration
const companyLogoStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const companyDir = path.join(UPLOADS_DIR, 'company-logos');
    await fs.mkdir(companyDir, { recursive: true });
    cb(null, companyDir);
  },
  filename: (req, file, cb) => {
    const companyId = req.params.companyId || req.body.companyId || 'unknown';
    const fileExtension = path.extname(file.originalname);
    const filename = `${companyId}_logo_${uuidv4()}${fileExtension}`;
    cb(null, filename);
  }
});

// Company logo upload middleware
export const uploadCompanyLogo = multer({
  storage: companyLogoStorage,
  fileFilter: profilePictureFilter, // Same as profile picture
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for images
    files: 1
  }
}).single('logo');

// Generic document upload for various purposes
const documentStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const documentsDir = path.join(UPLOADS_DIR, 'documents');
    await fs.mkdir(documentsDir, { recursive: true });
    cb(null, documentsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'anonymous';
    const fileExtension = path.extname(file.originalname);
    const filename = `${userId}_doc_${uuidv4()}${fileExtension}`;
    cb(null, filename);
  }
});

const documentFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png'
  ]);
  
  const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png']);
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (!allowedTypes.has(file.mimetype) || !allowedExtensions.has(fileExtension)) {
    const error = new AppError(400, 
      'Invalid file type. Allowed types: pdf, doc, docx, txt, jpg, jpeg, png',
      'INVALID_FILE_TYPE'
    );
    return cb(error);
  }

  cb(null, true);
};

// Multiple documents upload middleware
export const uploadDocuments = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: MAX_CV_SIZE,
    files: 5 // Max 5 files at once
  }
}).array('documents', 5);

// Generic upload export for backward compatibility
export const upload = multer({
  storage: cvStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: MAX_CV_SIZE,
    files: 1
  }
});

// Upload error handler middleware
export const handleUploadError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${config.MAX_FILE_SIZE_MB || 10}MB`,
        code: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files uploaded',
        code: 'TOO_MANY_FILES'
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field',
        code: 'UNEXPECTED_FILE'
      });
    }
  }
  
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
  
  logger.error('Upload error', { error });
  return res.status(500).json({
    success: false,
    error: 'File upload failed',
    code: 'UPLOAD_ERROR'
  });
};

// Helper function to get file URL
export function getFileUrl(filename: string, type: 'cv' | 'profile' | 'logo' | 'document' = 'cv'): string {
  const baseUrl = config.BACKEND_URL || `http://localhost:${config.PORT}`;
  return `${baseUrl}/uploads/${type}s/${filename}`;
}

// Helper function to delete file
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    logger.info('File deleted successfully', { filePath });
  } catch (error) {
    logger.warn('Failed to delete file', { error, filePath });
  }
}

// Helper function to validate file exists
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Static file serving setup (call this in app.ts)
export function setupStaticFileServing(app: any, express: any) {
  // Serve uploaded files
  app.use('/uploads/cvs', express.static(CV_UPLOADS_DIR));
  app.use('/uploads/profiles', express.static(path.join(UPLOADS_DIR, 'profiles')));
  app.use('/uploads/company-logos', express.static(path.join(UPLOADS_DIR, 'company-logos')));
  app.use('/uploads/documents', express.static(path.join(UPLOADS_DIR, 'documents')));
}
