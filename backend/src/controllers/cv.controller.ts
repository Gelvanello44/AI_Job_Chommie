import { Request, Response } from 'express';
import { z } from 'zod';
import cvService from '../services/cv.service.js';
// validateRequest import removed - not needed
import logger from '../config/logger.js';
import path from 'path';
import fs from 'fs/promises';

// Validation schemas
const CreateCvDocumentSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  personalInfo: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    headline: z.string().optional(),
    summary: z.string().optional(),
  }),
  experience: z.array(z.object({
    company: z.string().min(1, 'Company name is required'),
    role: z.string().min(1, 'Role is required'),
    startDate: z.string(),
    endDate: z.string().optional(),
    description: z.string().optional(),
    achievements: z.array(z.string()).optional(),
  })).default([]),
  education: z.array(z.object({
    institution: z.string().min(1, 'Institution name is required'),
    degree: z.string().min(1, 'Degree is required'),
    fieldOfStudy: z.string().optional(),
    startDate: z.string(),
    endDate: z.string().optional(),
    grade: z.string().optional(),
  })).default([]),
  skills: z.array(z.object({
    name: z.string().min(1, 'Skill name is required'),
    category: z.string().optional(),
    proficiency: z.number().min(1).max(5).optional(),
  })).default([]),
  projects: z.array(z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().min(1, 'Project description is required'),
    technologies: z.array(z.string()).optional(),
    url: z.string().url().optional(),
  })).optional(),
  certifications: z.array(z.object({
    name: z.string().min(1, 'Certification name is required'),
    issuer: z.string().min(1, 'Issuer is required'),
    date: z.string(),
    url: z.string().url().optional(),
  })).optional(),
  languages: z.array(z.object({
    language: z.string().min(1, 'Language is required'),
    proficiency: z.string().min(1, 'Proficiency level is required'),
  })).optional(),
});

const UpdateCvDocumentSchema = CreateCvDocumentSchema.partial().omit({ templateId: true });

export class CvController {
  
  /**
   * Get available CV templates for user's subscription plan
   * GET /api/v1/cv/templates
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'User not authenticated' 
        });
        return;
      }

      const result = await cvService.getAvailableTemplates(userId);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'CV templates retrieved successfully'
      });

    } catch (error: any) {
      logger.error('Error in getTemplates:', { error: error.message, userId: req.user?.id });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch CV templates'
      });
    }
  }

  /**
   * Create a new CV document
   * POST /api/v1/cv/documents
   */
  async createDocument(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'User not authenticated' 
        });
        return;
      }

      // Validate request body
      const validation = CreateCvDocumentSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: validation.error.errors
        });
        return;
      }

      const result = await cvService.createCvDocument(userId, {
        templateId: validation.data.templateId!,
        personalInfo: validation.data.personalInfo,
        experience: validation.data.experience.map(exp => ({
          company: exp.company || '',
          role: exp.role || '',
          startDate: exp.startDate || '',
          endDate: exp.endDate,
          description: exp.description,
          achievements: exp.achievements
        })),
        education: validation.data.education.map(edu => ({
          institution: edu.institution || '',
          degree: edu.degree || '',
          fieldOfStudy: edu.fieldOfStudy,
          startDate: edu.startDate || '',
          endDate: edu.endDate,
          grade: edu.grade
        })),
        skills: validation.data.skills.map(skill => ({
          name: skill.name || '',
          category: skill.category,
          proficiency: skill.proficiency
        })),
        projects: validation.data.projects?.map(proj => ({
          name: proj.name || '',
          description: proj.description || '',
          technologies: proj.technologies,
          url: proj.url
        })),
        certifications: validation.data.certifications?.map(cert => ({
          name: cert.name || '',
          issuer: cert.issuer || '',
          date: cert.date || '',
          url: cert.url
        })),
        languages: validation.data.languages?.map(lang => ({
          language: lang.language || '',
          proficiency: lang.proficiency || ''
        }))
      });
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'CV document created successfully'
      });

    } catch (error: any) {
      logger.error('Error in createDocument:', { error: error.message, userId: req.user?.id });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create CV document'
      });
    }
  }

  /**
   * Get user's CV documents
   * GET /api/v1/cv/documents
   */
  async getUserDocuments(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'User not authenticated' 
        });
        return;
      }

      const result = await cvService.getUserCvs(userId);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'CV documents retrieved successfully'
      });

    } catch (error: any) {
      logger.error('Error in getUserDocuments:', { error: error.message, userId: req.user?.id });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch CV documents'
      });
    }
  }

  /**
   * Get specific CV document
   * GET /api/v1/cv/documents/:id
   */
  async getDocument(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'User not authenticated' 
        });
        return;
      }

      if (!cvId) {
        res.status(400).json({
          success: false,
          message: 'CV ID is required'
        });
        return;
      }

      const result = await cvService.getCvDocument(userId, cvId);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'CV document retrieved successfully'
      });

    } catch (error: any) {
      logger.error('Error in getDocument:', { 
        error: error.message, 
        userId: req.user?.id, 
        cvId: req.params.id 
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch CV document'
      });
    }
  }

  /**
   * Update CV document
   * PUT /api/v1/cv/documents/:id
   */
  async updateDocument(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'User not authenticated' 
        });
        return;
      }

      if (!cvId) {
        res.status(400).json({
          success: false,
          message: 'CV ID is required'
        });
        return;
      }

      // Validate request body
      const validation = UpdateCvDocumentSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: validation.error.errors
        });
        return;
      }

      const result = await cvService.updateCvDocument(userId, cvId, {
        personalInfo: validation.data.personalInfo || {},
        experience: validation.data.experience || [],
        education: validation.data.education || [],
        skills: validation.data.skills || [],
        projects: validation.data.projects,
        certifications: validation.data.certifications,
        languages: validation.data.languages
      } as any);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'CV document updated successfully'
      });

    } catch (error: any) {
      logger.error('Error in updateDocument:', { 
        error: error.message, 
        userId: req.user?.id, 
        cvId: req.params.id 
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update CV document'
      });
    }
  }

  /**
   * Delete CV document
   * DELETE /api/v1/cv/documents/:id
   */
  async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'User not authenticated' 
        });
        return;
      }

      if (!cvId) {
        res.status(400).json({
          success: false,
          message: 'CV ID is required'
        });
        return;
      }

      const result = await cvService.deleteCvDocument(userId, cvId);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'CV document deleted successfully'
      });

    } catch (error: any) {
      logger.error('Error in deleteDocument:', { 
        error: error.message, 
        userId: req.user?.id, 
        cvId: req.params.id 
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete CV document'
      });
    }
  }

  /**
   * Export CV to PDF
   * POST /api/v1/cv/documents/:id/export
   */
  async exportToPdf(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'User not authenticated' 
        });
        return;
      }

      if (!cvId) {
        res.status(400).json({
          success: false,
          message: 'CV ID is required'
        });
        return;
      }

      const result = await cvService.exportCvToPdf(userId, cvId);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'CV exported successfully'
      });

    } catch (error: any) {
      logger.error('Error in exportToPdf:', { 
        error: error.message, 
        userId: req.user?.id, 
        cvId: req.params.id 
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to export CV to PDF'
      });
    }
  }

  /**
   * Download CV PDF file
   * GET /api/v1/cv/documents/:id/download
   */
  async downloadPdf(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'User not authenticated' 
        });
        return;
      }

      if (!cvId) {
        res.status(400).json({
          success: false,
          message: 'CV ID is required'
        });
        return;
      }

      // Verify the CV belongs to the user
      const cv = await cvService.getCvDocument(userId, cvId);
      
      if (!cv.parsedData) {
        res.status(404).json({
          success: false,
          message: 'CV content not found'
        });
        return;
      }

      // Check if PDF already exists, if not generate it
      let pdfResult;
      const cvData = cv.parsedData as any;
      const fileName = `${cv.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      
      // Try to find the actual PDF file for this CV ID
      const cvDir = path.join(process.cwd(), 'uploads', 'cv');
      
      try {
        // Ensure the directory exists
        await fs.access(cvDir);
        
        // Read directory and find PDF files for this CV
        const allFiles = await fs.readdir(cvDir);
        const cvFiles = allFiles.filter((file: string) => 
          file.startsWith(`cv-${cvId}`) && file.endsWith('.pdf')
        );
        
        if (cvFiles.length === 0) {
          throw new Error('File not found');
        }
        
        // Use the first (most recent) file found
        const actualFilePath = path.join(cvDir, cvFiles[0]);
        
        // Get file stats
        const stats = await fs.stat(actualFilePath);
        
        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', stats.size.toString());
        res.setHeader('Cache-Control', 'no-cache');
        
        // Stream the file
        const fileBuffer = await fs.readFile(actualFilePath);
        res.send(fileBuffer);
        
        logger.info('PDF downloaded successfully', { cvId, userId, fileName });
        
      } catch (fileError) {
        // File doesn't exist, need to generate it first
        logger.info('PDF not found, generating new one', { cvId, userId });
        
        res.status(404).json({
          success: false,
          message: 'PDF not generated yet. Please export the CV to PDF first.',
          action: 'Call POST /api/v1/cv/documents/:id/export to generate PDF'
        });
        return;
      }

    } catch (error: any) {
      logger.error('Error in downloadPdf:', { 
        error: error.message, 
        userId: req.user?.id, 
        cvId: req.params.id 
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to download CV PDF'
      });
    }
  }
}

export default new CvController();
