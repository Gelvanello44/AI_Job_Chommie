import express from 'express';
import fileController from '../controllers/fileController.js';
import { auth } from '../middleware/auth.js';
import { csrfProtectUserData, sensitiveOperationCSRF } from '../middleware/csrf';
import { fileUploadXSSProtection } from '../middleware/xss';
import { 
  uploadCV, 
  uploadProfilePicture, 
  uploadDocuments,
  handleUploadError 
} from '../middleware/upload.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply authentication to all file routes
router.use(auth);

// Rate limiting for upload endpoints - more restrictive
const uploadRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per 15 minutes per user
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Too many upload requests. Please try again later.',
    code: 'UPLOAD_RATE_LIMIT'
  }
});

// Rate limiting for general file operations
const fileRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 file operations per 15 minutes per user
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Too many file requests. Please try again later.',
    code: 'FILE_RATE_LIMIT'
  }
});

/**
 * @swagger
 * tags:
 *   name: Files
 *   description: File upload and management endpoints
 */

/**
 * @swagger
 * /api/files/cv:
 *   post:
 *     summary: Upload CV file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cv:
 *                 type: string
 *                 format: binary
 *                 description: CV file (PDF, DOC, DOCX, or TXT)
 *     responses:
 *       201:
 *         description: CV uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/CVProcessingResult'
 *       400:
 *         description: Invalid file or validation error
 *       401:
 *         description: Authentication required
 */
router.post('/cv', uploadRateLimit, ...fileUploadXSSProtection, uploadCV, handleUploadError, fileController.uploadCV);

/**
 * @swagger
 * /api/files/cv:
 *   put:
 *     summary: Replace existing CV file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cv:
 *                 type: string
 *                 format: binary
 *                 description: New CV file (PDF, DOC, DOCX, or TXT)
 *     responses:
 *       200:
 *         description: CV replaced successfully
 *       400:
 *         description: Invalid file or validation error
 *       401:
 *         description: Authentication required
 */
router.put('/cv', uploadRateLimit, ...fileUploadXSSProtection, uploadCV, handleUploadError, fileController.replaceCv);

/**
 * @swagger
 * /api/files/cv/text:
 *   get:
 *     summary: Get extracted text from user's CV
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CV text content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     extractedText:
 *                       type: string
 *                       nullable: true
 *                     parsedData:
 *                       type: object
 *                       nullable: true
 *                     filename:
 *                       type: string
 *                     uploadDate:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: No CV found
 *       401:
 *         description: Authentication required
 */
router.get('/cv/text', fileRateLimit, fileController.getCvText);

/**
 * @swagger
 * /api/files/profile-picture:
 *   post:
 *     summary: Upload profile picture
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture (JPEG, PNG, or WebP)
 *     responses:
 *       201:
 *         description: Profile picture uploaded successfully
 *       400:
 *         description: Invalid image file
 *       401:
 *         description: Authentication required
 */
router.post('/profile-picture', uploadRateLimit, ...fileUploadXSSProtection, uploadProfilePicture, handleUploadError, fileController.uploadProfilePicture);

/**
 * @swagger
 * /api/files/documents:
 *   post:
 *     summary: Upload multiple documents
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Document files (up to 5 files)
 *     responses:
 *       201:
 *         description: Documents uploaded successfully
 *       400:
 *         description: Invalid files or validation error
 *       401:
 *         description: Authentication required
 */
router.post('/documents', uploadRateLimit, ...fileUploadXSSProtection, uploadDocuments, handleUploadError, fileController.uploadDocuments);

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Get user's uploaded files
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CV, DOCUMENT, PROFILE_PICTURE]
 *         description: Filter files by type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of files per page
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     files:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FileUploadResult'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Authentication required
 */
router.get('/', fileRateLimit, fileController.getUserFiles);

/**
 * @swagger
 * /api/files/analytics:
 *   get:
 *     summary: Get file usage analytics for user
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: File analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalFiles:
 *                       type: integer
 *                     filesByType:
 *                       type: object
 *                       properties:
 *                         cv:
 *                           type: integer
 *                         documents:
 *                           type: integer
 *                         profilePictures:
 *                           type: integer
 *                     totalSizeMB:
 *                       type: number
 *       401:
 *         description: Authentication required
 */
router.get('/analytics', fileRateLimit, fileController.getFileAnalytics);

/**
 * @swagger
 * /api/files/{fileId}:
 *   get:
 *     summary: Get file details by ID
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File details retrieved successfully
 *       404:
 *         description: File not found
 *       401:
 *         description: Authentication required
 */
router.get('/:fileId', fileRateLimit, fileController.getFileById);

/**
 * @swagger
 * /api/files/{fileId}/download:
 *   get:
 *     summary: Download file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 *       401:
 *         description: Authentication required
 */
router.get('/:fileId/download', fileRateLimit, fileController.downloadFile);

/**
 * @swagger
 * /api/files/{fileId}:
 *   delete:
 *     summary: Delete file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       404:
 *         description: File not found
 *       401:
 *         description: Authentication required
 */
router.delete('/:fileId', fileRateLimit, ...sensitiveOperationCSRF(), fileController.deleteFile);

/**
 * @swagger
 * /api/files/bulk/delete:
 *   post:
 *     summary: Delete multiple files
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of file IDs to delete (max 50)
 *             required:
 *               - fileIds
 *     responses:
 *       200:
 *         description: Bulk deletion completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fileId:
 *                             type: string
 *                           success:
 *                             type: boolean
 *                           error:
 *                             type: string
 *                             nullable: true
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         successful:
 *                           type: integer
 *                         failed:
 *                           type: integer
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 */
router.post('/bulk/delete', fileRateLimit, ...sensitiveOperationCSRF(), fileController.bulkDeleteFiles);

export default router;
