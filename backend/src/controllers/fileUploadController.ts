import { Response, NextFunction } from 'express';
import { z } from 'zod';
import fileUploadService, { FileType, fileUploadSchema } from '../services/fileUploadService.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../types/auth.js';
import activityService from '../services/activityService.js';

// Validation schemas
const fileIdSchema = z.object({
  fileId: z.string().uuid()
});

const fileTypeSchema = z.object({
  type: z.enum(['CV', 'COVER_LETTER', 'PORTFOLIO', 'CERTIFICATE', 'PROFILE_PICTURE', 'COMPANY_LOGO', 'OTHER'])
});

const bulkDeleteSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(50)
});

const metadataUpdateSchema = z.object({
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).optional()
});

export class FileUploadController {
  /**
   * Upload a file
   */
  async uploadFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const file = req.file;
      const { type, description, tags } = req.body;

      if (!file) {
        throw new AppError(400, 'No file uploaded', 'NO_FILE');
      }

      // Validate file type parameter
      const { type: validatedType } = fileTypeSchema.parse({ type });

      // Validate file upload
      fileUploadService.validateFileUpload(file, validatedType);

      const fileData = {
        type: validatedType,
        description,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined
      };

      const uploadedFile = await fileUploadService.uploadFile(userId, file, fileData);

      // Log file upload activity
      await activityService.logUserActivity(userId, 'file_uploaded', {
        fileId: uploadedFile.id,
        fileName: uploadedFile.originalName,
        fileType: uploadedFile.type,
        fileSize: uploadedFile.size
      }).catch(err => logger.warn('Failed to log file upload activity', { error: err }));

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: uploadedFile
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid file type', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get user's files with optional filtering
   */
  async getUserFiles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const type = req.query.type as FileType;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      // Validate type if provided
      if (type) {
        fileTypeSchema.parse({ type });
      }

      const result = await fileUploadService.getUserFiles(userId, type, page, limit);

      res.json({
        success: true,
        data: result.files,
        pagination: result.pagination,
        meta: {
          type: type || 'all',
          count: result.files.length
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid file type', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get file download URL
   */
  async getFileDownloadUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { fileId } = fileIdSchema.parse(req.params);

      const downloadData = await fileUploadService.getFileDownloadUrl(userId, fileId);

      res.json({
        success: true,
        data: downloadData
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid file ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { fileId } = fileIdSchema.parse(req.params);
      const metadata = metadataUpdateSchema.parse(req.body);

      const updatedFile = await fileUploadService.updateFileMetadata(userId, fileId, metadata);

      // Log file metadata update activity
      await activityService.logUserActivity(userId, 'file_metadata_updated', {
        fileId,
        updatedFields: Object.keys(metadata)
      }).catch(err => logger.warn('Failed to log file metadata update activity', { error: err }));

      res.json({
        success: true,
        message: 'File metadata updated successfully',
        data: updatedFile
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid request data', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { fileId } = fileIdSchema.parse(req.params);

      await fileUploadService.deleteFile(userId, fileId);

      // Log file deletion activity
      await activityService.logUserActivity(userId, 'file_deleted', {
        fileId
      }).catch(err => logger.warn('Failed to log file deletion activity', { error: err }));

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid file ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Bulk delete files
   */
  async bulkDeleteFiles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { fileIds } = bulkDeleteSchema.parse(req.body);

      const result = await fileUploadService.bulkDeleteFiles(userId, fileIds);

      // Log bulk file deletion activity
      await activityService.logUserActivity(userId, 'files_bulk_deleted', {
        deletedCount: result.deletedCount,
        fileIds
      }).catch(err => logger.warn('Failed to log bulk deletion activity', { error: err }));

      res.json({
        success: true,
        message: `${result.deletedCount} files deleted successfully`,
        data: result
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid request data', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const stats = await fileUploadService.getStorageStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get files by type
   */
  async getFilesByType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { type } = fileTypeSchema.parse(req.params);
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const result = await fileUploadService.getUserFiles(userId, type, page, limit);

      res.json({
        success: true,
        data: result.files,
        pagination: result.pagination,
        meta: {
          type,
          count: result.files.length
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid file type', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get CVs specifically (convenience endpoint)
   */
  async getUserCVs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      const result = await fileUploadService.getUserFiles(userId, 'CV', page, limit);

      res.json({
        success: true,
        data: result.files,
        pagination: result.pagination,
        meta: {
          type: 'CV',
          count: result.files.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload CV specifically (convenience endpoint)
   */
  async uploadCV(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const file = req.file;
      const { description, tags } = req.body;

      if (!file) {
        throw new AppError(400, 'No CV file uploaded', 'NO_FILE');
      }

      // Validate CV file
      fileUploadService.validateFileUpload(file, 'CV');

      const fileData = {
        type: 'CV' as const,
        description,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined
      };

      const uploadedFile = await fileUploadService.uploadFile(userId, file, fileData);

      // Log CV upload activity
      await activityService.logUserActivity(userId, 'cv_uploaded', {
        fileId: uploadedFile.id,
        fileName: uploadedFile.originalName,
        fileSize: uploadedFile.size
      }).catch(err => logger.warn('Failed to log CV upload activity', { error: err }));

      res.status(201).json({
        success: true,
        message: 'CV uploaded successfully',
        data: uploadedFile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get file types configuration
   */
  async getFileTypesConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const config = {
        CV: {
          allowedTypes: ['.pdf', '.doc', '.docx'],
          maxSizeMB: 10,
          description: 'Upload your CV/Resume in PDF or Word format'
        },
        COVER_LETTER: {
          allowedTypes: ['.pdf', '.doc', '.docx', '.txt'],
          maxSizeMB: 5,
          description: 'Upload your cover letter'
        },
        PORTFOLIO: {
          allowedTypes: ['.pdf', '.zip', '.rar'],
          maxSizeMB: 50,
          description: 'Upload your portfolio or work samples'
        },
        CERTIFICATE: {
          allowedTypes: ['.pdf', '.jpg', '.jpeg', '.png'],
          maxSizeMB: 10,
          description: 'Upload certificates, qualifications, or awards'
        },
        PROFILE_PICTURE: {
          allowedTypes: ['.jpg', '.jpeg', '.png', '.gif'],
          maxSizeMB: 5,
          description: 'Upload your profile picture'
        },
        COMPANY_LOGO: {
          allowedTypes: ['.jpg', '.jpeg', '.png', '.svg'],
          maxSizeMB: 2,
          description: 'Upload your company logo'
        },
        OTHER: {
          allowedTypes: ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'],
          maxSizeMB: 20,
          description: 'Upload other relevant documents'
        }
      };

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new FileUploadController();
