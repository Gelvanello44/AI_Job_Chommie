import { Request, Response, NextFunction } from 'express';
import fileService from '../services/fileService.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import { z } from 'zod';

// Validation schemas
const fileTypeSchema = z.enum(['CV', 'DOCUMENT', 'PROFILE_PICTURE']);

const getFilesQuerySchema = z.object({
  type: fileTypeSchema.optional(),
  page: z.string().transform(val => parseInt(val) || 1).default('1'),
  limit: z.string().transform(val => Math.min(parseInt(val) || 20, 100)).default('20')
});

class FileController {
  /**
   * Upload CV file
   */
  async uploadCV(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      if (!req.file) {
        throw new AppError(400, 'No CV file provided', 'FILE_REQUIRED');
      }

      logger.info('CV upload requested', { 
        userId, 
        filename: req.file.originalname,
        size: req.file.size 
      });

      const result = await fileService.processCV(req.file, userId);

      res.status(201).json({
        success: true,
        message: 'CV uploaded successfully',
        data: result
      });

    } catch (error) {
      logger.error('CV upload failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      if (!req.file) {
        throw new AppError(400, 'No profile picture file provided', 'FILE_REQUIRED');
      }

      logger.info('Profile picture upload requested', { 
        userId, 
        filename: req.file.originalname,
        size: req.file.size 
      });

      const result = await fileService.processProfilePicture(req.file, userId);

      res.status(201).json({
        success: true,
        message: 'Profile picture uploaded successfully',
        data: result
      });

    } catch (error) {
      logger.error('Profile picture upload failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Upload multiple documents
   */
  async uploadDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        throw new AppError(400, 'No document files provided', 'FILES_REQUIRED');
      }

      logger.info('Documents upload requested', { 
        userId, 
        fileCount: req.files.length,
        files: req.files.map(f => ({ name: f.originalname, size: f.size }))
      });

      const results = await fileService.processDocuments(req.files, userId);

      res.status(201).json({
        success: true,
        message: `${results.length} documents uploaded successfully`,
        data: results
      });

    } catch (error) {
      logger.error('Documents upload failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get user files
   */
  async getUserFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      // Validate query parameters
      const query = getFilesQuerySchema.parse(req.query);
      
      const files = await fileService.getUserFiles(userId, query.type);

      // Apply pagination
      const startIndex = (query.page - 1) * query.limit;
      const endIndex = startIndex + query.limit;
      const paginatedFiles = files.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          files: paginatedFiles,
          pagination: {
            page: query.page,
            limit: query.limit,
            total: files.length,
            pages: Math.ceil(files.length / query.limit),
            hasNext: endIndex < files.length,
            hasPrev: query.page > 1
          }
        }
      });

    } catch (error) {
      logger.error('Get user files failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get specific file details
   */
  async getFileById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const fileId = req.params.fileId;

      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      if (!fileId) {
        throw new AppError(400, 'File ID is required', 'FILE_ID_REQUIRED');
      }

      const file = await fileService.getFileById(fileId, userId);

      res.json({
        success: true,
        data: file
      });

    } catch (error) {
      logger.error('Get file by ID failed', { error, fileId: req.params.fileId, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Delete user file
   */
  async deleteFile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const fileId = req.params.fileId;

      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      if (!fileId) {
        throw new AppError(400, 'File ID is required', 'FILE_ID_REQUIRED');
      }

      await fileService.deleteUserFile(fileId, userId);

      res.json({
        success: true,
        message: 'File deleted successfully'
      });

    } catch (error) {
      logger.error('Delete file failed', { error, fileId: req.params.fileId, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get file analytics
   */
  async getFileAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      const analytics = await fileService.getFileAnalytics(userId);

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Get file analytics failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Replace user's CV
   */
  async replaceCv(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      if (!req.file) {
        throw new AppError(400, 'No CV file provided', 'FILE_REQUIRED');
      }

      // Get current CV and delete it
      try {
        const userFiles = await fileService.getUserFiles(userId, 'CV');
        if (userFiles.length > 0) {
          await fileService.deleteUserFile(userFiles[0].id, userId);
        }
      } catch (error) {
        logger.warn('Failed to delete existing CV before replacement', { error, userId });
      }

      // Upload new CV
      const result = await fileService.processCV(req.file, userId);

      res.json({
        success: true,
        message: 'CV replaced successfully',
        data: result
      });

    } catch (error) {
      logger.error('CV replacement failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get CV text content (for previewing extracted text)
   */
  async getCvText(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      const cvFiles = await fileService.getUserFiles(userId, 'CV');
      if (cvFiles.length === 0) {
        throw new AppError(404, 'No CV found', 'CV_NOT_FOUND');
      }

      const cvFile = await fileService.getFileById(cvFiles[0].id, userId);

      res.json({
        success: true,
        data: {
          extractedText: cvFile.extractedText || null,
          parsedData: cvFile.metadata || null,
          filename: cvFile.originalName,
          uploadDate: cvFile.createdAt
        }
      });

    } catch (error) {
      logger.error('Get CV text failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Download file (protected endpoint)
   */
  async downloadFile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const fileId = req.params.fileId;

      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      if (!fileId) {
        throw new AppError(400, 'File ID is required', 'FILE_ID_REQUIRED');
      }

      const file = await fileService.getFileById(fileId, userId);

      // Set headers for file download
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.setHeader('Content-Type', file.mimetype);
      res.setHeader('Content-Length', file.size.toString());

      // Send file
      res.sendFile(file.path, (error) => {
        if (error) {
          logger.error('File download failed', { error, fileId, userId });
          if (!res.headersSent) {
            next(new AppError(500, 'File download failed', 'DOWNLOAD_ERROR'));
          }
        } else {
          logger.info('File downloaded successfully', { fileId, userId, filename: file.originalName });
        }
      });

    } catch (error) {
      logger.error('File download preparation failed', { error, fileId: req.params.fileId, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Bulk delete files
   */
  async bulkDeleteFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      const { fileIds } = req.body;
      
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        throw new AppError(400, 'File IDs array is required', 'FILE_IDS_REQUIRED');
      }

      if (fileIds.length > 50) {
        throw new AppError(400, 'Maximum 50 files can be deleted at once', 'TOO_MANY_FILES');
      }

      const deletionResults = [];
      let successCount = 0;
      let errorCount = 0;

      for (const fileId of fileIds) {
        try {
          await fileService.deleteUserFile(fileId, userId);
          deletionResults.push({ fileId, success: true });
          successCount++;
        } catch (error) {
          deletionResults.push({ 
            fileId, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: `${successCount} files deleted successfully, ${errorCount} failed`,
        data: {
          results: deletionResults,
          summary: {
            total: fileIds.length,
            successful: successCount,
            failed: errorCount
          }
        }
      });

    } catch (error) {
      logger.error('Bulk delete files failed', { error, userId: req.user?.id });
      next(error);
    }
  }
}

export default new FileController();
