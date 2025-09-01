import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import { deleteFile, getFileUrl, fileExists } from '../middleware/upload.js';
import { config } from '../config/index.js';

const prisma = new PrismaClient();

export interface FileUploadResult {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  type: string;
}

export interface CVProcessingResult extends FileUploadResult {
  extractedText?: string;
  parsedData?: {
    name?: string;
    email?: string;
    phone?: string;
    skills?: string[];
    experience?: string;
    education?: string;
  };
}

class FileService {
  /**
   * Process uploaded CV file
   */
  async processCV(file: Express.Multer.File, userId: string): Promise<CVProcessingResult> {
    try {
      logger.info('Processing CV upload', { 
        filename: file.filename, 
        userId, 
        mimetype: file.mimetype,
        size: file.size 
      });

      // Validate file
      await this.validateFile(file.path, file.mimetype);

      // Save file record to database
      const fileRecord = await prisma.file.create({
        data: {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          type: 'CV',
          userId: userId,
          url: getFileUrl(file.filename, 'cv')
        }
      });

      // Extract text from CV if possible
      let extractedText: string | undefined;
      let parsedData: any = {};

      try {
        if (file.mimetype === 'application/pdf') {
          extractedText = await this.extractTextFromPDF(file.path);
        } else if (file.mimetype.includes('word')) {
          extractedText = await this.extractTextFromWord(file.path);
        } else if (file.mimetype === 'text/plain') {
          extractedText = await fs.readFile(file.path, 'utf-8');
        }

        if (extractedText) {
          parsedData = await this.parseCV(extractedText);
          
          // Update file record with extracted data
          await prisma.file.update({
            where: { id: fileRecord.id },
            data: {
              extractedText: extractedText.substring(0, 10000), // Limit to 10k chars
              metadata: parsedData
            }
          });
        }
      } catch (error) {
        logger.warn('Failed to extract text from CV', { error, filename: file.filename });
      }

      // Update user profile with CV reference
      await prisma.user.update({
        where: { id: userId },
        data: {
          cvFileId: fileRecord.id
        }
      });

      return {
        id: fileRecord.id,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: fileRecord.url,
        type: 'CV',
        extractedText,
        parsedData
      };

    } catch (error) {
      logger.error('CV processing failed', { error, userId });
      
      // Clean up file if processing failed
      try {
        await deleteFile(file.path);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup file after processing error', { cleanupError });
      }
      
      throw error;
    }
  }

  /**
   * Process profile picture upload
   */
  async processProfilePicture(file: Express.Multer.File, userId: string): Promise<FileUploadResult> {
    try {
      logger.info('Processing profile picture upload', { 
        filename: file.filename, 
        userId,
        mimetype: file.mimetype,
        size: file.size 
      });

      // Validate and potentially resize image
      const processedImagePath = await this.processImage(file.path, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 85
      });

      // Get file stats after processing
      const stats = await fs.stat(processedImagePath);

      // Save file record to database
      const fileRecord = await prisma.file.create({
        data: {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: stats.size,
          path: processedImagePath,
          type: 'PROFILE_PICTURE',
          userId: userId,
          url: getFileUrl(file.filename, 'profile')
        }
      });

      // Update user profile with new profile picture
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { profilePictureId: true }
      });

      // Delete old profile picture if exists
      if (existingUser?.profilePictureId) {
        await this.deleteUserFile(existingUser.profilePictureId, userId);
      }

      // Update user with new profile picture
      await prisma.user.update({
        where: { id: userId },
        data: {
          profilePictureId: fileRecord.id
        }
      });

      return {
        id: fileRecord.id,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: stats.size,
        url: fileRecord.url,
        type: 'PROFILE_PICTURE'
      };

    } catch (error) {
      logger.error('Profile picture processing failed', { error, userId });
      
      // Clean up file if processing failed
      try {
        await deleteFile(file.path);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup file after processing error', { cleanupError });
      }
      
      throw error;
    }
  }

  /**
   * Process multiple document uploads
   */
  async processDocuments(files: Express.Multer.File[], userId: string): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = [];
    
    for (const file of files) {
      try {
        await this.validateFile(file.path, file.mimetype);

        const fileRecord = await prisma.file.create({
          data: {
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
            type: 'DOCUMENT',
            userId: userId,
            url: getFileUrl(file.filename, 'document')
          }
        });

        results.push({
          id: fileRecord.id,
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: fileRecord.url,
          type: 'DOCUMENT'
        });

      } catch (error) {
        logger.error('Document processing failed', { error, filename: file.filename });
        
        // Clean up file
        try {
          await deleteFile(file.path);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup file after processing error', { cleanupError });
        }
        
        // Continue with other files, don't fail the entire batch
      }
    }

    return results;
  }

  /**
   * Get user files
   */
  async getUserFiles(userId: string, type?: string) {
    const whereClause: any = { userId };
    if (type) {
      whereClause.type = type;
    }

    return await prisma.file.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimetype: true,
        size: true,
        type: true,
        url: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  /**
   * Get file by ID
   */
  async getFileById(fileId: string, userId?: string) {
    const whereClause: any = { id: fileId };
    if (userId) {
      whereClause.userId = userId;
    }

    const file = await prisma.file.findUnique({
      where: whereClause
    });

    if (!file) {
      throw new AppError(404, 'File not found', 'FILE_NOT_FOUND');
    }

    return file;
  }

  /**
   * Delete user file
   */
  async deleteUserFile(fileId: string, userId: string): Promise<void> {
    const file = await this.getFileById(fileId, userId);
    
    // Remove from disk
    try {
      await deleteFile(file.path);
    } catch (error) {
      logger.warn('Failed to delete file from disk', { error, filePath: file.path });
    }

    // Remove from database
    await prisma.file.delete({
      where: { id: fileId }
    });

    // Update user references if needed
    if (file.type === 'CV') {
      await prisma.user.updateMany({
        where: { cvFileId: fileId },
        data: { cvFileId: null }
      });
    } else if (file.type === 'PROFILE_PICTURE') {
      await prisma.user.updateMany({
        where: { profilePictureId: fileId },
        data: { profilePictureId: null }
      });
    }

    logger.info('File deleted successfully', { fileId, userId });
  }

  /**
   * Validate uploaded file
   */
  private async validateFile(filePath: string, expectedMimetype: string): Promise<void> {
    // Check if file exists
    if (!await fileExists(filePath)) {
      throw new AppError(400, 'File not found after upload', 'FILE_NOT_FOUND');
    }

    // Validate file type by reading file header
    try {
      const buffer = await fs.readFile(filePath);
      const fileType = await fileTypeFromBuffer(buffer.slice(0, 4100));
      
      if (fileType && fileType.mime !== expectedMimetype) {
        // Special handling for Office documents which can have complex MIME types
        if (!(expectedMimetype.includes('word') && fileType.mime.includes('zip'))) {
          logger.warn('File MIME type mismatch', { 
            expected: expectedMimetype, 
            actual: fileType.mime,
            filePath 
          });
        }
      }
    } catch (error) {
      logger.warn('Could not validate file type', { error, filePath });
    }
  }

  /**
   * Process and resize image
   */
  private async processImage(imagePath: string, options: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
  }): Promise<string> {
    try {
      const { maxWidth, maxHeight, quality } = options;
      
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      // Only process if image is larger than max dimensions
      if ((metadata.width && metadata.width > maxWidth) || 
          (metadata.height && metadata.height > maxHeight)) {
        
        await image
          .resize(maxWidth, maxHeight, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ quality })
          .toFile(imagePath + '.processed');
        
        // Replace original with processed
        await fs.rename(imagePath + '.processed', imagePath);
      }
      
      return imagePath;
    } catch (error) {
      logger.warn('Image processing failed, using original', { error, imagePath });
      return imagePath;
    }
  }

  /**
   * Extract text from PDF (placeholder - would need pdf-parse or similar)
   */
  private async extractTextFromPDF(pdfPath: string): Promise<string> {
    // This is a placeholder. In a real implementation, you'd use a library like:
    // import pdf from 'pdf-parse';
    // const dataBuffer = await fs.readFile(pdfPath);
    // const data = await pdf(dataBuffer);
    // return data.text;
    
    logger.info('PDF text extraction not implemented', { pdfPath });
    return '';
  }

  /**
   * Extract text from Word document (placeholder)
   */
  private async extractTextFromWord(docPath: string): Promise<string> {
    // This is a placeholder. In a real implementation, you'd use a library like:
    // import mammoth from 'mammoth';
    // const result = await mammoth.extractRawText({ path: docPath });
    // return result.value;
    
    logger.info('Word document text extraction not implemented', { docPath });
    return '';
  }

  /**
   * Parse CV text to extract structured data
   */
  private async parseCV(text: string): Promise<any> {
    const parsedData: any = {};
    
    try {
      // Simple regex-based parsing (in production, you'd use NLP/AI)
      const emailMatch = text.match(/[\w\.-]+@[\w\.-]+\.\w+/);
      if (emailMatch) {
        parsedData.email = emailMatch[0];
      }

      const phoneMatch = text.match(/(?:\+27|0)(?:\d{2})\s?\d{3}\s?\d{4}|(?:\+27|0)(?:\d{3})\s?\d{3}\s?\d{3}/);
      if (phoneMatch) {
        parsedData.phone = phoneMatch[0];
      }

      // Extract potential skills (this is very basic)
      const skillKeywords = [
        'javascript', 'typescript', 'python', 'java', 'c#', 'php', 'ruby',
        'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask',
        'sql', 'mysql', 'postgresql', 'mongodb', 'redis',
        'aws', 'azure', 'docker', 'kubernetes', 'git'
      ];
      
      const foundSkills = skillKeywords.filter(skill => 
        text.toLowerCase().includes(skill.toLowerCase())
      );
      
      if (foundSkills.length > 0) {
        parsedData.skills = foundSkills;
      }

      // Try to extract name (first few lines, excluding common headers)
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      for (const line of lines.slice(0, 5)) {
        if (line.length < 50 && 
            !line.toLowerCase().includes('curriculum vitae') &&
            !line.toLowerCase().includes('resume') &&
            /^[a-zA-Z\s]+$/.test(line.trim())) {
          parsedData.name = line.trim();
          break;
        }
      }

    } catch (error) {
      logger.warn('CV parsing failed', { error });
    }

    return parsedData;
  }

  /**
   * Get file analytics for user
   */
  async getFileAnalytics(userId: string) {
    const [totalFiles, cvCount, documentCount, profilePictureCount, totalSize] = await Promise.all([
      prisma.file.count({ where: { userId } }),
      prisma.file.count({ where: { userId, type: 'CV' } }),
      prisma.file.count({ where: { userId, type: 'DOCUMENT' } }),
      prisma.file.count({ where: { userId, type: 'PROFILE_PICTURE' } }),
      prisma.file.aggregate({
        where: { userId },
        _sum: { size: true }
      })
    ]);

    return {
      totalFiles,
      filesByType: {
        cv: cvCount,
        documents: documentCount,
        profilePictures: profilePictureCount
      },
      totalSizeMB: Math.round((totalSize._sum.size || 0) / (1024 * 1024) * 100) / 100
    };
  }
}

export default new FileService();
