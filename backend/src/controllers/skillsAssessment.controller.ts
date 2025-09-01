/**
 * Skills Assessment Controller
 * Handles HTTP requests for skills assessments and quiz system
 */

import { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { SkillsAssessmentService } from '../services/skillsAssessment.service.js';
import { QuotaService } from '../services/quota.service.js';
// SkillAssessmentType imported but not used in this file
import logger from '../config/logger.js';

export class SkillsAssessmentController {
  /**
   * Get available assessment types
   * GET /api/v1/assessments/types
   */
  static async getAssessmentTypes(_req: Request, res: Response): Promise<void> {
    try {
      const types = SkillsAssessmentService.getAssessmentTypes();
      
      res.json({
        success: true,
        data: types
      });
    } catch (error) {
      logger.error('Error fetching assessment types', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assessment types'
      });
    }
  }

  /**
   * Create new skills assessment
   * POST /api/v1/assessments
   */
  static async createAssessment(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Check if user has access to skills assessment
      const hasAccess = await QuotaService.hasFeatureAccess(userId, 'hasSkillsAssessment');
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'Skills assessment not available in your current plan',
          upgradeRequired: true
        });
        return;
      }

      const { type, title } = req.body;

      // Check if user can retake this assessment type
      const canRetake = await SkillsAssessmentService.canRetakeAssessment(userId, type);
      if (!canRetake) {
        res.status(400).json({
          success: false,
          message: 'Assessment retake not yet available. Please wait before retaking.'
        });
        return;
      }

      const assessment = await SkillsAssessmentService.createAssessment(userId, type, title);

      res.status(201).json({
        success: true,
        data: assessment,
        message: 'Assessment created successfully'
      });
    } catch (error) {
      logger.error('Error creating assessment', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to create assessment'
      });
    }
  }

  /**
   * Submit assessment answers
   * POST /api/v1/assessments/:id/submit
   */
  static async submitAssessment(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const { answers } = req.body;

      const assessment = await SkillsAssessmentService.submitAssessment(id, answers);

      res.json({
        success: true,
        data: assessment,
        message: 'Assessment completed successfully'
      });
    } catch (error) {
      logger.error('Error submitting assessment', { error, assessmentId: req.params.id });
      
      if (error instanceof Error) {
        if (error.message === 'Assessment not found') {
          res.status(404).json({
            success: false,
            message: 'Assessment not found'
          });
          return;
        }
        if (error.message === 'Assessment already completed') {
          res.status(400).json({
            success: false,
            message: 'Assessment has already been completed'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to submit assessment'
      });
    }
  }

  /**
   * Get user's assessment dashboard
   * GET /api/v1/assessments/dashboard
   */
  static async getAssessmentDashboard(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const dashboard = await SkillsAssessmentService.getAssessmentDashboard(userId);

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error('Error fetching assessment dashboard', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assessment dashboard'
      });
    }
  }

  /**
   * Get assessment results
   * GET /api/v1/assessments/:id/results
   */
  static async getAssessmentResults(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const assessment = await SkillsAssessmentService.getAssessmentResults(id);

      if (!assessment) {
        res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
        return;
      }

      // Check if user owns this assessment
      if (assessment.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      logger.error('Error fetching assessment results', { error, assessmentId: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assessment results'
      });
    }
  }

  /**
   * Get user's assessments list
   * GET /api/v1/assessments
   */
  static async getUserAssessments(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const assessments = await SkillsAssessmentService.getUserAssessments(userId);

      res.json({
        success: true,
        data: assessments
      });
    } catch (error) {
      logger.error('Error fetching user assessments', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assessments'
      });
    }
  }

  /**
   * Generate badge image
   * GET /api/v1/assessments/badges/:type/:score
   */
  static async generateBadge(req: Request, res: Response): Promise<void> {
    try {
      const { type, score } = req.params;
      
      // This would integrate with an image generation service
      const badgeUrl = SkillsAssessmentService.generateBadgeImage(type, parseInt(score));
      
      res.json({
        success: true,
        data: {
          badgeUrl,
          downloadUrl: `${badgeUrl}&download=true`
        }
      });
    } catch (error) {
      logger.error('Error generating badge', { error, params: req.params });
      res.status(500).json({
        success: false,
        message: 'Failed to generate badge'
      });
    }
  }
}

/**
 * Validation middleware for skills assessment endpoints
 */
export const skillsAssessmentValidation = {
  createAssessment: [
    body('type')
      .isIn(['TECHNICAL', 'LEADERSHIP', 'COMMUNICATION', 'PROBLEM_SOLVING'])
      .withMessage('Invalid assessment type'),
    body('title')
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage('Title must be between 3 and 100 characters')
  ],

  submitAssessment: [
    param('id')
      .isUUID()
      .withMessage('Invalid assessment ID'),
    body('answers')
      .isObject()
      .withMessage('Answers must be an object')
      .custom((answers) => {
        if (Object.keys(answers).length === 0) {
          throw new Error('At least one answer is required');
        }
        return true;
      })
  ],

  getResults: [
    param('id')
      .isUUID()
      .withMessage('Invalid assessment ID')
  ]
};
