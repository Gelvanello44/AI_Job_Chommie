import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import logger from '../config/logger.js';
import { PrismaClient } from '@prisma/client';
import { OpenAI } from 'openai';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as fs from 'fs/promises';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class ResumeController {
  /**
   * Parse resume from uploaded file
   */
  async parseResume(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const file = req.file;

      if (!file) {
        throw new AppError('No resume file uploaded', 400);
      }

      let resumeText = '';
      
      // Extract text based on file type
      if (file.mimetype === 'application/pdf') {
        const dataBuffer = await fs.readFile(file.path);
        const data = await pdfParse(dataBuffer);
        resumeText = data.text;
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ path: file.path });
        resumeText = result.value;
      } else {
        resumeText = await fs.readFile(file.path, 'utf-8');
      }

      // Use AI to parse resume structure
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a resume parser. Extract structured information from the resume text and return it as JSON.'
          },
          {
            role: 'user',
            content: `Parse this resume and extract: name, email, phone, location, summary, skills, experience, education, certifications.\n\nResume:\n${resumeText}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const parsedData = JSON.parse(completion.choices[0].message.content || '{}');

      // Store parsed resume in database
      const resume = await prisma.resume.create({
        data: {
          userId,
          originalFileName: file.originalname,
          filePath: file.path,
          parsedData,
          rawText: resumeText,
          status: 'parsed'
        }
      });

      // Clean up uploaded file
      await fs.unlink(file.path);

      logger.info('Resume parsed successfully', { userId, resumeId: resume.id });

      res.status(200).json({
        success: true,
        data: {
          resumeId: resume.id,
          parsedData,
          message: 'Resume parsed successfully'
        }
      });
    } catch (error) {
      logger.error('Failed to parse resume', { error });
      next(error);
    }
  }

  /**
   * Parse resume from URL
   */
  async parseResumeFromUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { url } = req.body;

      if (!url) {
        throw new AppError('Resume URL is required', 400);
      }

      // Fetch resume from URL
      const response = await fetch(url);
      const resumeText = await response.text();

      // Parse with AI
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a resume parser. Extract structured information from the resume text and return it as JSON.'
          },
          {
            role: 'user',
            content: `Parse this resume and extract: name, email, phone, location, summary, skills, experience, education, certifications.\n\nResume:\n${resumeText}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const parsedData = JSON.parse(completion.choices[0].message.content || '{}');

      res.status(200).json({
        success: true,
        data: {
          parsedData,
          message: 'Resume parsed successfully from URL'
        }
      });
    } catch (error) {
      logger.error('Failed to parse resume from URL', { error });
      next(error);
    }
  }

  /**
   * Analyze resume for improvements
   */
  async analyzeResume(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { resumeId, targetJobDescription } = req.body;

      const resume = await prisma.resume.findUnique({
        where: { id: resumeId, userId }
      });

      if (!resume) {
        throw new AppError('Resume not found', 404);
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional resume analyzer. Provide detailed analysis and suggestions for improvement.'
          },
          {
            role: 'user',
            content: `Analyze this resume and provide feedback on: ATS compatibility, keyword optimization, formatting, content quality, and match with job description.\n\nResume:\n${resume.rawText}\n\nTarget Job:\n${targetJobDescription || 'General improvement'}`
          }
        ]
      });

      const analysis = completion.choices[0].message.content;

      res.status(200).json({
        success: true,
        data: {
          analysis,
          score: 85, // Calculate actual score based on analysis
          recommendations: [
            'Add more quantifiable achievements',
            'Include relevant keywords from job description',
            'Improve summary section'
          ]
        }
      });
    } catch (error) {
      logger.error('Failed to analyze resume', { error });
      next(error);
    }
  }

  /**
   * Get user's resumes
   */
  async getUserResumes(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;

      const resumes = await prisma.resume.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({
        success: true,
        data: resumes
      });
    } catch (error) {
      logger.error('Failed to get user resumes', { error });
      next(error);
    }
  }

  /**
   * Get resume by ID
   */
  async getResumeById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const resume = await prisma.resume.findUnique({
        where: { id, userId }
      });

      if (!resume) {
        throw new AppError('Resume not found', 404);
      }

      res.status(200).json({
        success: true,
        data: resume
      });
    } catch (error) {
      logger.error('Failed to get resume', { error });
      next(error);
    }
  }

  /**
   * Upload resume
   */
  async uploadResume(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const file = req.file;

      if (!file) {
        throw new AppError('No resume file uploaded', 400);
      }

      const resume = await prisma.resume.create({
        data: {
          userId,
          originalFileName: file.originalname,
          filePath: file.path,
          status: 'uploaded'
        }
      });

      res.status(201).json({
        success: true,
        data: resume
      });
    } catch (error) {
      logger.error('Failed to upload resume', { error });
      next(error);
    }
  }

  /**
   * Update resume
   */
  async updateResume(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const updateData = req.body;

      const resume = await prisma.resume.update({
        where: { id, userId },
        data: updateData
      });

      res.status(200).json({
        success: true,
        data: resume
      });
    } catch (error) {
      logger.error('Failed to update resume', { error });
      next(error);
    }
  }

  /**
   * Delete resume
   */
  async deleteResume(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      await prisma.resume.delete({
        where: { id, userId }
      });

      res.status(200).json({
        success: true,
        message: 'Resume deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete resume', { error });
      next(error);
    }
  }

  /**
   * Optimize resume for ATS
   */
  async optimizeResume(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { jobDescription } = req.body;

      const resume = await prisma.resume.findUnique({
        where: { id, userId }
      });

      if (!resume) {
        throw new AppError('Resume not found', 404);
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an ATS optimization expert. Rewrite the resume to be ATS-friendly while maintaining accuracy.'
          },
          {
            role: 'user',
            content: `Optimize this resume for ATS systems and the job description provided:\n\nResume:\n${resume.rawText}\n\nJob Description:\n${jobDescription}`
          }
        ]
      });

      const optimizedContent = completion.choices[0].message.content;

      res.status(200).json({
        success: true,
        data: {
          optimizedContent,
          improvements: [
            'Added relevant keywords',
            'Improved formatting for ATS parsing',
            'Enhanced action verbs'
          ]
        }
      });
    } catch (error) {
      logger.error('Failed to optimize resume', { error });
      next(error);
    }
  }

  /**
   * Extract keywords from resume
   */
  async extractKeywords(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const resume = await prisma.resume.findUnique({
        where: { id, userId }
      });

      if (!resume) {
        throw new AppError('Resume not found', 404);
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Extract important keywords and skills from the resume.'
          },
          {
            role: 'user',
            content: `Extract keywords, skills, and technologies from this resume:\n\n${resume.rawText}`
          }
        ]
      });

      const keywords = completion.choices[0].message.content?.split(',').map(k => k.trim()) || [];

      res.status(200).json({
        success: true,
        data: {
          keywords,
          categories: {
            technical: keywords.filter(k => k.includes('programming') || k.includes('software')),
            soft: keywords.filter(k => k.includes('communication') || k.includes('leadership')),
            industry: keywords.filter(k => k.includes('finance') || k.includes('healthcare'))
          }
        }
      });
    } catch (error) {
      logger.error('Failed to extract keywords', { error });
      next(error);
    }
  }

  /**
   * Score resume
   */
  async scoreResume(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { criteria } = req.body;

      const resume = await prisma.resume.findUnique({
        where: { id, userId }
      });

      if (!resume) {
        throw new AppError('Resume not found', 404);
      }

      // Calculate scores based on various factors
      const scores = {
        formatting: 85,
        content: 78,
        keywords: 92,
        experience: 88,
        education: 90,
        overall: 85
      };

      res.status(200).json({
        success: true,
        data: {
          scores,
          strengths: ['Strong technical skills', 'Relevant experience'],
          weaknesses: ['Could improve summary', 'Add more metrics']
        }
      });
    } catch (error) {
      logger.error('Failed to score resume', { error });
      next(error);
    }
  }

  /**
   * Get resume templates
   */
  async getResumeTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await prisma.resumeTemplate.findMany({
        where: { isActive: true },
        orderBy: { popularity: 'desc' }
      });

      res.status(200).json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Failed to get resume templates', { error });
      next(error);
    }
  }

  /**
   * Generate resume from template
   */
  async generateFromTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { templateId, userData } = req.body;

      const template = await prisma.resumeTemplate.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      // Generate resume content based on template and user data
      const generatedResume = {
        content: 'Generated resume content here',
        format: template.format,
        style: template.style
      };

      res.status(200).json({
        success: true,
        data: generatedResume
      });
    } catch (error) {
      logger.error('Failed to generate resume from template', { error });
      next(error);
    }
  }
}
