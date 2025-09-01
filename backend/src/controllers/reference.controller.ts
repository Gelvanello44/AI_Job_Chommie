import { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { referenceService } from '../services/reference.service.js';
import logger from '../config/logger.js';
import { z } from 'zod';

// Validation schemas
const createReferenceSchema = z.object({
  referenceName: z.string().min(2).max(100),
  referenceEmail: z.string().email(),
  referencePhone: z.string().optional(),
  company: z.string().min(2).max(100),
  position: z.string().min(2).max(100),
  relationship: z.enum(['Manager', 'Colleague', 'Client', 'Mentor', 'Subordinate', 'Other']),
  requestMessage: z.string().min(10).max(1000),
  jobTitle: z.string().optional(),
  urgency: z.enum(['urgent', 'normal', 'flexible']).optional(),
  canContactDirectly: z.boolean().optional()
});

const updateReferenceSchema = z.object({
  requestMessage: z.string().min(10).max(1000).optional(),
  urgency: z.enum(['urgent', 'normal', 'flexible']).optional(),
  isVisible: z.boolean().optional(),
  canContactDirectly: z.boolean().optional()
});

const submitResponseSchema = z.object({
  token: z.string(),
  response: z.string().min(50).max(5000)
});

const declineResponseSchema = z.object({
  token: z.string(),
  reason: z.string().max(500).optional()
});

/**
 * Reference Management Controller
 * Handles professional references and request workflows
 */
export class ReferenceController {
  /**
   * Create a new reference request
   */
  async createReference(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const validatedData = createReferenceSchema.parse(req.body);

      const referenceRequest = await referenceService.createReferenceRequest(
        userId,
        validatedData
      );

      res.status(201).json({
        success: true,
        message: 'Reference request created successfully',
        data: referenceRequest
      });

    } catch (error) {
      logger.error('Error creating reference request', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid reference data', error.errors);
      }
      throw error;
    }
  }

  /**
   * Send reference request email
   */
  async sendReference(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { referenceId } = req.params;

      // Verify ownership
      const reference = await referenceService.getReferenceRequest(referenceId, userId);
      if (!reference) {
        throw new AppError(404, 'Reference request not found');
      }

      await referenceService.sendReferenceRequest(referenceId);

      res.json({
        success: true,
        message: 'Reference request sent successfully'
      });

    } catch (error) {
      logger.error('Error sending reference request', { error });
      throw error;
    }
  }

  /**
   * Get all references for the authenticated user
   */
  async getUserReferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { status, isVisible } = req.query;

      const filters: any = {};
      if (status) filters.status = status as string;
      if (isVisible !== undefined) filters.isVisible = isVisible === 'true';

      const references = await referenceService.getUserReferences(userId, filters);

      res.json({
        success: true,
        data: references
      });

    } catch (error) {
      logger.error('Error getting user references', { error });
      throw new AppError(500, 'Failed to retrieve references');
    }
  }

  /**
   * Get a single reference request
   */
  async getReference(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { referenceId } = req.params;

      const reference = await referenceService.getReferenceRequest(referenceId, userId);

      res.json({
        success: true,
        data: reference
      });

    } catch (error) {
      logger.error('Error getting reference', { error });
      throw error;
    }
  }

  /**
   * Update reference request
   */
  async updateReference(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { referenceId } = req.params;
      const validatedData = updateReferenceSchema.parse(req.body);

      const updatedReference = await referenceService.updateReferenceRequest(
        referenceId,
        userId,
        validatedData
      );

      res.json({
        success: true,
        message: 'Reference request updated successfully',
        data: updatedReference
      });

    } catch (error) {
      logger.error('Error updating reference', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid update data', error.errors);
      }
      throw error;
    }
  }

  /**
   * Delete reference request
   */
  async deleteReference(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { referenceId } = req.params;

      await referenceService.deleteReferenceRequest(referenceId, userId);

      res.json({
        success: true,
        message: 'Reference request deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting reference', { error });
      throw error;
    }
  }

  /**
   * Send reminder for pending reference
   */
  async sendReminder(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { referenceId } = req.params;

      await referenceService.sendReferenceReminder(referenceId, userId);

      res.json({
        success: true,
        message: 'Reminder sent successfully'
      });

    } catch (error) {
      logger.error('Error sending reminder', { error });
      throw error;
    }
  }

  /**
   * Update reference visibility
   */
  async updateVisibility(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { referenceId } = req.params;
      const { isVisible } = req.body;

      if (typeof isVisible !== 'boolean') {
        throw new AppError(400, 'Invalid visibility value');
      }

      await referenceService.updateReferenceVisibility(
        referenceId,
        userId,
        isVisible
      );

      res.json({
        success: true,
        message: `Reference ${isVisible ? 'made visible' : 'hidden'} successfully`
      });

    } catch (error) {
      logger.error('Error updating visibility', { error });
      throw error;
    }
  }

  /**
   * Get reference statistics
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const statistics = await referenceService.getReferenceStatistics(userId);

      res.json({
        success: true,
        data: statistics
      });

    } catch (error) {
      logger.error('Error getting reference statistics', { error });
      throw new AppError(500, 'Failed to retrieve statistics');
    }
  }

  /**
   * Submit reference response (public endpoint for references)
   */
  async submitResponse(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = submitResponseSchema.parse(req.body);

      await referenceService.submitReferenceResponse(
        validatedData.token,
        validatedData.response
      );

      res.json({
        success: true,
        message: 'Thank you for providing your reference. Your response has been submitted successfully.'
      });

    } catch (error) {
      logger.error('Error submitting reference response', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid response data', error.errors);
      }
      throw error;
    }
  }

  /**
   * Decline reference request (public endpoint for references)
   */
  async declineResponse(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = declineResponseSchema.parse(req.body);

      await referenceService.declineReferenceRequest(
        validatedData.token,
        validatedData.reason
      );

      res.json({
        success: true,
        message: 'Reference request declined. The applicant will be notified.'
      });

    } catch (error) {
      logger.error('Error declining reference', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid decline data', error.errors);
      }
      throw error;
    }
  }

  /**
   * Get reference form (public endpoint for references to view form)
   */
  async getReferenceForm(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      // Decode token to get reference request ID
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [referenceRequestId] = decoded.split(':');

      const reference = await referenceService.getReferenceRequest(referenceRequestId);

      // Only return necessary data for the form
      const formData = {
        applicantName: `${reference.user.firstName} ${reference.user.lastName}`,
        relationship: reference.relationship,
        position: reference.position,
        company: reference.company,
        jobTitle: reference.jobTitle,
        requestMessage: reference.requestMessage,
        urgency: reference.urgency
      };

      res.json({
        success: true,
        data: formData
      });

    } catch (error) {
      logger.error('Error getting reference form', { error });
      throw new AppError(400, 'Invalid or expired reference link');
    }
  }
}

export const referenceController = new ReferenceController();
