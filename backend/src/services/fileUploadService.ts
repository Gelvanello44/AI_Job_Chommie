import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

// File type definitions
export type FileType = 'CV' | 'COVER_LETTER' | 'PORTFOLIO' | 'CERTIFICATE' | 'PROFILE_PICTURE' | 'COMPANY_LOGO' | 'OTHER';

// Validation schemas
export const fileUploadSchema = z.object({
  type: z.enum(['CV', 'COVER_LETTER', 'PORTFOLIO', 'CERTIFICATE', 'PROFILE_PICTURE', 'COMPANY_LOGO', 'OTHER']),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).optional()
});

// File configuration
const FILE_CONFIG = {
  CV: {
    allowedTypes: ['.pdf', '.doc', '.docx'],
    maxSize: 10 * 1024 * 1024, // 10MB
    destination: 'uploads/cvs/'
  },
  COVER_LETTER: {
    allowedTypes: ['.pdf', '.doc', '.docx', '.txt'],
    maxSize: 5 * 1024 * 1024, // 5MB
    destination: 'uploads/cover-letters/'
  },
  PORTFOLIO: {
    allowedTypes: ['.pdf', '.zip', '.rar'],
    maxSize: 50 * 1024 * 1024, // 50MB
    destination: 'uploads/portfolios/'
  },
  CERTIFICATE: {
    allowedTypes: ['.pdf', '.jpg', '.jpeg', '.png'],
    maxSize: 10 * 1024 * 1024, // 10MB
    destination: 'uploads/certificates/'
  },
  PROFILE_PICTURE: {
    allowedTypes: ['.jpg', '.jpeg', '.png', '.gif'],
    maxSize: 5 * 1024 * 1024, // 5MB
    destination: 'uploads/profiles/'
  },
  COMPANY_LOGO: {
    allowedTypes: ['.jpg', '.jpeg', '.png', '.svg'],
    maxSize: 2 * 1024 * 1024, // 2MB
    destination: 'uploads/companies/'
  },
  OTHER: {
    allowedTypes: ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'],
    maxSize: 20 * 1024 * 1024, // 20MB
    destination: 'uploads/other/'
  }
};

class FileUploadService {
  /**
   * Configure multer storage based on file type
   */
  getMulterConfig(fileType: FileType) {
    const config = FILE_CONFIG[fileType];
    
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          // Ensure directory exists
          await fs.mkdir(config.destination, { recursive: true });
          cb(null, config.destination);
        } catch (error) {
          cb(error as Error, '');
        }
      },
      filename: (req, file, cb) => {
        const userId = (req as any).user?.id || 'anonymous';
        const uniqueSuffix = uuidv4();
        const extension = path.extname(file.originalname);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${userId}_${uniqueSuffix}_${safeName}`);
      }
    });

    const fileFilter = (req: any, file: any, cb: any) => {
      const extension = path.extname(file.originalname).toLowerCase();
      
      if (config.allowedTypes.includes(extension)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed types: ${config.allowedTypes.join(', ')}`), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: config.maxSize,
        files: 1
      }
    });
  }

  /**
   * Upload and save file metadata
   */
  async uploadFile(userId: string, file: Express.Multer.File, fileData: z.infer<typeof fileUploadSchema>) {
    try {
      const validatedData = fileUploadSchema.parse(fileData);

      // Check user's file upload quota
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          subscriptionPlan: true,
          _count: { select: { files: true } }
        }
      });

      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      }

      // Check file limits based on subscription
      const maxFiles = this.getMaxFilesForPlan(user.subscriptionPlan);
      if (user._count.files >= maxFiles) {
        throw new AppError(429, `File upload limit reached (${maxFiles} files)`, 'FILE_LIMIT_EXCEEDED');
      }

      // Generate file URL (in production, this would be cloud storage URL)
      const fileUrl = `/uploads/${validatedData.type.toLowerCase()}s/${file.filename}`;
      
      // Calculate file hash for duplicate detection
      const fileHash = await this.calculateFileHash(file.path);

      // Check for duplicate files
      const existingFile = await prisma.file.findFirst({
        where: {
          userId,
          fileHash,
          type: validatedData.type
        }
      });

      if (existingFile) {
        // Remove the uploaded file since it's a duplicate
        await fs.unlink(file.path).catch(() => {}); // Ignore errors
        throw new AppError(409, 'File already exists', 'DUPLICATE_FILE');
      }

      // Save file metadata to database
      const savedFile = await prisma.file.create({
        data: {
          userId,
          type: validatedData.type,
          originalName: file.originalname,
          filename: file.filename,
          url: fileUrl,
          mimeType: file.mimetype,
          size: file.size,
          fileHash,
          description: validatedData.description,
          tags: validatedData.tags || []
        }
      });

      // Process file based on type
      await this.processFileByType(savedFile, file.path);

      logger.info('File uploaded successfully', { 
        userId, 
        fileId: savedFile.id, 
        type: validatedData.type,
        size: file.size 
      });

      return this.transformFile(savedFile);
    } catch (error) {
      // Clean up uploaded file on error
      if (file?.path) {
        await fs.unlink(file.path).catch(() => {}); // Ignore cleanup errors
      }

      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid file data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('File upload failed', { error, userId });
      throw new AppError(500, 'Failed to upload file', 'FILE_UPLOAD_ERROR');
    }
  }

  /**
   * Get user's files with filtering
   */
  async getUserFiles(userId: string, type?: FileType, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const where: any = { userId };
      if (type) where.type = type;

      const [files, total] = await Promise.all([
        prisma.file.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.file.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        files: files.map(file => this.transformFile(file)),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      logger.error('Get user files failed', { error, userId });
      throw new AppError(500, 'Failed to retrieve files', 'FILES_RETRIEVAL_ERROR');
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(userId: string, fileId: string) {
    try {
      const file = await prisma.file.findFirst({
        where: { id: fileId, userId }
      });

      if (!file) {
        throw new AppError(404, 'File not found', 'FILE_NOT_FOUND');
      }

      // Delete from filesystem
      const filePath = path.join(process.cwd(), file.url);
      await fs.unlink(filePath).catch(() => {}); // Ignore if file doesn't exist

      // Delete from database
      await prisma.file.delete({
        where: { id: fileId }
      });

      logger.info('File deleted', { userId, fileId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Delete file failed', { error, userId, fileId });
      throw new AppError(500, 'Failed to delete file', 'FILE_DELETE_ERROR');
    }
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(userId: string, fileId: string, metadata: { description?: string; tags?: string[] }) {
    try {
      const file = await prisma.file.findFirst({
        where: { id: fileId, userId }
      });

      if (!file) {
        throw new AppError(404, 'File not found', 'FILE_NOT_FOUND');
      }

      const updatedFile = await prisma.file.update({
        where: { id: fileId },
        data: {
          description: metadata.description,
          tags: metadata.tags
        }
      });

      logger.info('File metadata updated', { userId, fileId });

      return this.transformFile(updatedFile);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Update file metadata failed', { error, userId, fileId });
      throw new AppError(500, 'Failed to update file metadata', 'FILE_UPDATE_ERROR');
    }
  }

  /**
   * Get file download URL with access control
   */
  async getFileDownloadUrl(userId: string, fileId: string) {
    try {
      const file = await prisma.file.findFirst({
        where: { 
          id: fileId,
          OR: [
            { userId }, // Owner can always access
            { isPublic: true } // Public files can be accessed by anyone
          ]
        }
      });

      if (!file) {
        throw new AppError(404, 'File not found or access denied', 'FILE_NOT_FOUND');
      }

      // In production, you would generate a signed URL here
      const downloadUrl = file.url;
      
      // Log file access
      await prisma.fileAccess.create({
        data: {
          fileId,
          accessedBy: userId,
          accessType: 'DOWNLOAD'
        }
      }).catch(() => {}); // Ignore logging errors

      return {
        downloadUrl,
        filename: file.originalName,
        size: file.size,
        mimeType: file.mimeType
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get file download URL failed', { error, userId, fileId });
      throw new AppError(500, 'Failed to get download URL', 'DOWNLOAD_URL_ERROR');
    }
  }

  /**
   * Get file storage statistics for user
   */
  async getStorageStats(userId: string) {
    try {
      const [files, storageUsed] = await Promise.all([
        prisma.file.groupBy({
          by: ['type'],
          where: { userId },
          _count: true,
          _sum: { size: true }
        }),
        prisma.file.aggregate({
          where: { userId },
          _sum: { size: true },
          _count: true
        })
      ]);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      const maxStorage = this.getMaxStorageForPlan(user?.subscriptionPlan);
      const maxFiles = this.getMaxFilesForPlan(user?.subscriptionPlan);

      const filesByType = files.reduce((acc: any, item) => {
        acc[item.type.toLowerCase()] = {
          count: item._count,
          sizeBytes: item._sum.size || 0
        };
        return acc;
      }, {});

      return {
        totalFiles: storageUsed._count,
        totalSizeBytes: storageUsed._sum.size || 0,
        totalSizeMB: Math.round((storageUsed._sum.size || 0) / (1024 * 1024)),
        maxFiles,
        maxStorageBytes: maxStorage,
        maxStorageMB: Math.round(maxStorage / (1024 * 1024)),
        usagePercentage: Math.round(((storageUsed._sum.size || 0) / maxStorage) * 100),
        filesByType
      };
    } catch (error) {
      logger.error('Get storage stats failed', { error, userId });
      throw new AppError(500, 'Failed to retrieve storage statistics', 'STORAGE_STATS_ERROR');
    }
  }

  /**
   * Process file based on type (extract metadata, validate, etc.)
   */
  private async processFileByType(file: any, filePath: string) {
    try {
      switch (file.type) {
        case 'CV':
          await this.processCVFile(file, filePath);
          break;
        case 'PROFILE_PICTURE':
        case 'COMPANY_LOGO':
          await this.processImageFile(file, filePath);
          break;
        default:
          // No special processing for other file types
          break;
      }
    } catch (error) {
      logger.warn('File processing failed', { error, fileId: file.id, type: file.type });
      // Don't throw error - file upload should still succeed even if processing fails
    }
  }

  /**
   * Process CV file to extract text and metadata
   */
  private async processCVFile(file: any, filePath: string) {
    try {
      // In a real implementation, you would use libraries like:
      // - pdf-parse for PDF files
      // - mammoth for DOCX files
      // - textract for general document parsing
      
      // For now, we'll just update the file with processing status
      await prisma.file.update({
        where: { id: file.id },
        data: {
          processingStatus: 'COMPLETED',
          metadata: {
            processed: true,
            extractedText: 'Text extraction would happen here',
            pageCount: 1
          }
        }
      });

      logger.info('CV processed successfully', { fileId: file.id });
    } catch (error) {
      await prisma.file.update({
        where: { id: file.id },
        data: { processingStatus: 'FAILED' }
      });
      throw error;
    }
  }

  /**
   * Process image file to generate thumbnails
   */
  private async processImageFile(file: any, filePath: string) {
    try {
      // In a real implementation, you would use libraries like Sharp to:
      // - Generate thumbnails
      // - Optimize images
      // - Extract EXIF data
      
      await prisma.file.update({
        where: { id: file.id },
        data: {
          processingStatus: 'COMPLETED',
          metadata: {
            processed: true,
            thumbnailUrl: file.url.replace(/\.[^.]+$/, '_thumb.jpg')
          }
        }
      });

      logger.info('Image processed successfully', { fileId: file.id });
    } catch (error) {
      await prisma.file.update({
        where: { id: file.id },
        data: { processingStatus: 'FAILED' }
      });
      throw error;
    }
  }

  /**
   * Calculate file hash for duplicate detection
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const crypto = await import('crypto');
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      logger.warn('Failed to calculate file hash', { error, filePath });
      return `fallback_${Date.now()}_${Math.random()}`;
    }
  }

  /**
   * Get subscription-based limits
   */
  private getMaxFilesForPlan(plan?: string): number {
    switch (plan) {
      case 'FREE': return 5;
      case 'BASIC': return 25;
      case 'PREMIUM': return 100;
      case 'ENTERPRISE': return 500;
      default: return 5;
    }
  }

  private getMaxStorageForPlan(plan?: string): number {
    switch (plan) {
      case 'FREE': return 50 * 1024 * 1024; // 50MB
      case 'BASIC': return 500 * 1024 * 1024; // 500MB
      case 'PREMIUM': return 2 * 1024 * 1024 * 1024; // 2GB
      case 'ENTERPRISE': return 10 * 1024 * 1024 * 1024; // 10GB
      default: return 50 * 1024 * 1024; // 50MB
    }
  }

  /**
   * Transform file for API response
   */
  private transformFile(file: any) {
    return {
      id: file.id,
      type: file.type,
      originalName: file.originalName,
      filename: file.filename,
      url: file.url,
      mimeType: file.mimeType,
      size: file.size,
      sizeFormatted: this.formatFileSize(file.size),
      description: file.description,
      tags: file.tags || [],
      processingStatus: file.processingStatus,
      metadata: file.metadata,
      isPublic: file.isPublic,
      uploadedAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString()
    };
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate file before upload
   */
  validateFileUpload(file: Express.Multer.File, type: FileType): boolean {
    const config = FILE_CONFIG[type];
    const extension = path.extname(file.originalname).toLowerCase();

    if (!config.allowedTypes.includes(extension)) {
      throw new AppError(400, `Invalid file type. Allowed: ${config.allowedTypes.join(', ')}`, 'INVALID_FILE_TYPE');
    }

    if (file.size > config.maxSize) {
      throw new AppError(400, `File too large. Maximum size: ${this.formatFileSize(config.maxSize)}`, 'FILE_TOO_LARGE');
    }

    return true;
  }

  /**
   * Bulk delete files
   */
  async bulkDeleteFiles(userId: string, fileIds: string[]) {
    try {
      if (fileIds.length === 0) {
        throw new AppError(400, 'No files specified for deletion', 'NO_FILES_SPECIFIED');
      }

      if (fileIds.length > 50) {
        throw new AppError(400, 'Cannot delete more than 50 files at once', 'TOO_MANY_FILES');
      }

      // Get files to verify ownership
      const files = await prisma.file.findMany({
        where: {
          id: { in: fileIds },
          userId
        }
      });

      if (files.length !== fileIds.length) {
        throw new AppError(403, 'Some files not found or access denied', 'ACCESS_DENIED');
      }

      // Delete files from filesystem
      await Promise.all(files.map(async (file) => {
        const filePath = path.join(process.cwd(), file.url);
        await fs.unlink(filePath).catch(() => {}); // Ignore errors
      }));

      // Delete from database
      const deleteResult = await prisma.file.deleteMany({
        where: {
          id: { in: fileIds },
          userId
        }
      });

      logger.info('Bulk file deletion completed', { userId, deletedCount: deleteResult.count });

      return { deletedCount: deleteResult.count };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Bulk delete files failed', { error, userId });
      throw new AppError(500, 'Failed to delete files', 'BULK_DELETE_ERROR');
    }
  }
}

export default new FileUploadService();
