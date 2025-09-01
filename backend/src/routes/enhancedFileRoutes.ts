import { Router } from 'express';
import multer from 'multer';
import fileUploadController from '../controllers/fileUploadController.js';
import fileUploadService from '../services/fileUploadService.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { csrfProtectUserData, sensitiveOperationCSRF } from '../middleware/csrf';
import { basicXSSProtection, fileUploadXSSProtection } from '../middleware/xss';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Rate limiting for different types of operations
const uploadLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per window
  message: 'Too many upload attempts. Please try again later.',
  keyGenerator: (req) => `upload:${req.user?.id}`
});

const generalLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 requests per window
  message: 'Too many requests. Please try again later.',
  keyGenerator: (req) => `file_ops:${req.user?.id}`
});

// Dynamic multer configuration based on file type
const dynamicUpload = (req: any, res: any, next: any) => {
  const fileType = req.body.type || req.query.type || 'OTHER';
  const upload = fileUploadService.getMulterConfig(fileType).single('file');
  upload(req, res, next);
};

// File management routes
router.get('/', generalLimiter, fileUploadController.getUserFiles);
router.get('/stats', generalLimiter, fileUploadController.getStorageStats);
router.get('/config', fileUploadController.getFileTypesConfig);

// File upload routes
router.post('/upload', uploadLimiter, ...fileUploadXSSProtection, dynamicUpload, fileUploadController.uploadFile);
router.post('/upload-cv', uploadLimiter, ...fileUploadXSSProtection, fileUploadService.getMulterConfig('CV').single('file'), fileUploadController.uploadCV);

// File-specific routes
router.get('/type/:type', generalLimiter, fileUploadController.getFilesByType);
router.get('/cvs', generalLimiter, fileUploadController.getUserCVs);

// Individual file operations
router.get('/:fileId/download', generalLimiter, fileUploadController.getFileDownloadUrl);
router.put('/:fileId/metadata', generalLimiter, ...basicXSSProtection, fileUploadController.updateFileMetadata);
router.delete('/:fileId', generalLimiter, ...sensitiveOperationCSRF(), fileUploadController.deleteFile);

// Bulk operations
router.delete('/bulk/delete', generalLimiter, ...sensitiveOperationCSRF(), fileUploadController.bulkDeleteFiles);

export default router;
