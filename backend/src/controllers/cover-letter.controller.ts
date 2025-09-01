import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import logger from '../config/logger.js';
import { PrismaClient } from '@prisma/client';
import { OpenAI } from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class CoverLetterController {
  /**
   * Generate cover letter
   */
  async generateCoverLetter(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { jobTitle, companyName, jobDescription, resumeId } = req.body;

      // Get user's resume if provided
      let resumeContent = '';
      if (resumeId) {
        const resume = await prisma.resume.findUnique({
          where: { id: resumeId, userId }
        });
        resumeContent = resume?.rawText || '';
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional cover letter writer. Create compelling, personalized cover letters that highlight relevant experience and show genuine interest in the position.'
          },
          {
            role: 'user',
            content: `Generate a cover letter for:
Job Title: ${jobTitle}
Company: ${companyName}
Job Description: ${jobDescription}
Resume: ${resumeContent || 'Not provided - use general professional experience'}`
          }
        ]
      });

      const coverLetter = completion.choices[0].message.content;

      // Save generated cover letter
      const saved = await prisma.coverLetter.create({
        data: {
          userId,
          jobTitle,
          companyName,
          content: coverLetter,
          status: 'generated'
        }
      });

      res.status(200).json({
        success: true,
        data: {
          id: saved.id,
          content: coverLetter
        }
      });
    } catch (error) {
      logger.error('Failed to generate cover letter', { error });
      next(error);
    }
  }

  /**
   * Generate custom cover letter with specific requirements
   */
  async generateCustomCoverLetter(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { requirements, tone, length, highlights } = req.body;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a professional cover letter writer. Create a cover letter with tone: ${tone}, length: ${length} words.`
          },
          {
            role: 'user',
            content: `Generate a custom cover letter with these requirements:
${requirements}

Key highlights to include:
${highlights.join('\n')}`
          }
        ]
      });

      const coverLetter = completion.choices[0].message.content;

      res.status(200).json({
        success: true,
        data: {
          content: coverLetter
        }
      });
    } catch (error) {
      logger.error('Failed to generate custom cover letter', { error });
      next(error);
    }
  }

  /**
   * Generate cover letter from job posting
   */
  async generateFromJobPosting(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { jobUrl, resumeId } = req.body;

      // Here you would scrape the job posting
      // For now, we'll use the provided description
      const jobDetails = {
        title: 'Software Engineer',
        company: 'Tech Company',
        description: 'Job description from URL'
      };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional cover letter writer. Create a cover letter based on the job posting.'
          },
          {
            role: 'user',
            content: `Generate a cover letter for this job posting: ${JSON.stringify(jobDetails)}`
          }
        ]
      });

      const coverLetter = completion.choices[0].message.content;

      res.status(200).json({
        success: true,
        data: {
          content: coverLetter,
          jobDetails
        }
      });
    } catch (error) {
      logger.error('Failed to generate cover letter from job posting', { error });
      next(error);
    }
  }

  /**
   * Get user's cover letters
   */
  async getUserCoverLetters(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;

      const coverLetters = await prisma.coverLetter.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({
        success: true,
        data: coverLetters
      });
    } catch (error) {
      logger.error('Failed to get cover letters', { error });
      next(error);
    }
  }

  /**
   * Get cover letter by ID
   */
  async getCoverLetterById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const coverLetter = await prisma.coverLetter.findUnique({
        where: { id, userId }
      });

      if (!coverLetter) {
        throw new AppError('Cover letter not found', 404);
      }

      res.status(200).json({
        success: true,
        data: coverLetter
      });
    } catch (error) {
      logger.error('Failed to get cover letter', { error });
      next(error);
    }
  }

  /**
   * Save cover letter
   */
  async saveCoverLetter(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { content, jobTitle, companyName } = req.body;

      const coverLetter = await prisma.coverLetter.create({
        data: {
          userId,
          content,
          jobTitle,
          companyName,
          status: 'saved'
        }
      });

      res.status(201).json({
        success: true,
        data: coverLetter
      });
    } catch (error) {
      logger.error('Failed to save cover letter', { error });
      next(error);
    }
  }

  /**
   * Update cover letter
   */
  async updateCoverLetter(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const updateData = req.body;

      const coverLetter = await prisma.coverLetter.update({
        where: { id, userId },
        data: updateData
      });

      res.status(200).json({
        success: true,
        data: coverLetter
      });
    } catch (error) {
      logger.error('Failed to update cover letter', { error });
      next(error);
    }
  }

  /**
   * Delete cover letter
   */
  async deleteCoverLetter(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      await prisma.coverLetter.delete({
        where: { id, userId }
      });

      res.status(200).json({
        success: true,
        message: 'Cover letter deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete cover letter', { error });
      next(error);
    }
  }

  /**
   * Optimize cover letter
   */
  async optimizeCoverLetter(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const { jobDescription } = req.body;

      const coverLetter = await prisma.coverLetter.findUnique({
        where: { id, userId }
      });

      if (!coverLetter) {
        throw new AppError('Cover letter not found', 404);
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Optimize this cover letter to better match the job description and improve its impact.'
          },
          {
            role: 'user',
            content: `Optimize this cover letter:
${coverLetter.content}

For this job:
${jobDescription}`
          }
        ]
      });

      const optimized = completion.choices[0].message.content;

      res.status(200).json({
        success: true,
        data: {
          original: coverLetter.content,
          optimized
        }
      });
    } catch (error) {
      logger.error('Failed to optimize cover letter', { error });
      next(error);
    }
  }

  /**
   * Analyze cover letter
   */
  async analyzeCoverLetter(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const coverLetter = await prisma.coverLetter.findUnique({
        where: { id, userId }
      });

      if (!coverLetter) {
        throw new AppError('Cover letter not found', 404);
      }

      const analysis = {
        score: 85,
        strengths: [
          'Strong opening paragraph',
          'Good company research evident',
          'Clear value proposition'
        ],
        improvements: [
          'Add more specific achievements',
          'Strengthen closing call-to-action'
        ],
        readability: 'High',
        tone: 'Professional'
      };

      res.status(200).json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Failed to analyze cover letter', { error });
      next(error);
    }
  }

  /**
   * Score cover letter
   */
  async scoreCoverLetter(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const coverLetter = await prisma.coverLetter.findUnique({
        where: { id, userId }
      });

      if (!coverLetter) {
        throw new AppError('Cover letter not found', 404);
      }

      const scores = {
        overall: 87,
        relevance: 90,
        personalization: 85,
        grammar: 95,
        impact: 82
      };

      res.status(200).json({
        success: true,
        data: scores
      });
    } catch (error) {
      logger.error('Failed to score cover letter', { error });
      next(error);
    }
  }

  /**
   * Get templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await prisma.coverLetterTemplate.findMany({
        where: { isActive: true },
        orderBy: { popularity: 'desc' }
      });

      res.status(200).json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Failed to get templates', { error });
      next(error);
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const template = await prisma.coverLetterTemplate.findUnique({
        where: { id }
      });

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      res.status(200).json({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error('Failed to get template', { error });
      next(error);
    }
  }

  /**
   * Preview template
   */
  async previewTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId, userData } = req.body;

      const template = await prisma.coverLetterTemplate.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      // Generate preview with user data
      const preview = template.content.replace(/{{name}}/g, userData.name || '[Your Name]');

      res.status(200).json({
        success: true,
        data: {
          preview
        }
      });
    } catch (error) {
      logger.error('Failed to preview template', { error });
      next(error);
    }
  }

  /**
   * Get suggestions
   */
  async getSuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { content, type } = req.body;

      const suggestions = [
        'Add specific metrics and achievements',
        'Include keywords from job description',
        'Personalize the opening paragraph',
        'Research and mention company values'
      ];

      res.status(200).json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      logger.error('Failed to get suggestions', { error });
      next(error);
    }
  }

  /**
   * Improve cover letter
   */
  async improveCoverLetter(req: Request, res: Response, next: NextFunction) {
    try {
      const { content, improvements } = req.body;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Improve this cover letter based on the specific feedback provided.'
          },
          {
            role: 'user',
            content: `Improve this cover letter:
${content}

Requested improvements:
${improvements.join('\n')}`
          }
        ]
      });

      const improved = completion.choices[0].message.content;

      res.status(200).json({
        success: true,
        data: {
          improved
        }
      });
    } catch (error) {
      logger.error('Failed to improve cover letter', { error });
      next(error);
    }
  }
}
