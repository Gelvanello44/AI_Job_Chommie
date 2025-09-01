import { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { reminderService } from '../services/reminder.service.js';
import logger from '../config/logger.js';
import { z } from 'zod';

// Validation schemas
const createReminderSchema = z.object({
  type: z.enum(['APPLICATION_FOLLOWUP', 'INTERVIEW', 'MILESTONE', 'REFERENCE_REQUEST', 'CUSTOM']),
  applicationId: z.string().uuid().optional(),
  interviewId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  scheduledFor: z.string().datetime(),
  recurring: z.boolean().optional(),
  recurrencePattern: z.enum(['daily', 'weekly', 'monthly']).optional(),
  recurrenceEndDate: z.string().datetime().optional()
});

const updateReminderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  scheduledFor: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'CANCELLED']).optional()
});

/**
 * Reminder Controller
 * Handles reminder management for applications and interviews
 */
export class ReminderController {
  /**
   * Create a new reminder
   */
  async createReminder(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const validatedData = createReminderSchema.parse(req.body);

      let reminder;
      
      switch (validatedData.type) {
        case 'APPLICATION_FOLLOWUP':
          if (!validatedData.applicationId) {
            throw new AppError(400, 'Application ID is required for application reminders');
          }
          reminder = await reminderService.createApplicationReminder(
            userId,
            validatedData.applicationId,
            new Date(validatedData.scheduledFor),
            validatedData.title,
            validatedData.description
          );
          break;

        case 'INTERVIEW':
          if (!validatedData.interviewId) {
            throw new AppError(400, 'Interview ID is required for interview reminders');
          }
          reminder = await reminderService.createInterviewReminder(
            userId,
            validatedData.interviewId,
            new Date(validatedData.scheduledFor),
            validatedData.title,
            validatedData.description
          );
          break;

        default:
          reminder = await reminderService.createCustomReminder(userId, {
            title: validatedData.title,
            description: validatedData.description,
            scheduledFor: new Date(validatedData.scheduledFor),
            recurring: validatedData.recurring,
            recurrencePattern: validatedData.recurrencePattern,
            recurrenceEndDate: validatedData.recurrenceEndDate ? new Date(validatedData.recurrenceEndDate) : undefined
          });
      }

      logger.info('Reminder created', { userId, reminderId: reminder.id, type: validatedData.type });

      res.status(201).json({
        success: true,
        message: 'Reminder created successfully',
        data: reminder
      });

    } catch (error) {
      logger.error('Error creating reminder', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid reminder data', error.errors);
      }
      throw new AppError(500, 'Failed to create reminder');
    }
  }

  /**
   * Get user's reminders
   */
  async getUserReminders(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { type, status, upcoming, limit } = req.query;

      const reminders = await reminderService.getUserReminders(userId, {
        type: type as any,
        status: status as any,
        upcoming: upcoming === 'true',
        limit: limit ? parseInt(limit as string) : undefined
      });

      res.json({
        success: true,
        data: reminders
      });

    } catch (error) {
      logger.error('Error fetching reminders', { error });
      throw new AppError(500, 'Failed to fetch reminders');
    }
  }

  /**
   * Get reminder by ID
   */
  async getReminderById(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { reminderId } = req.params;

      const reminders = await reminderService.getUserReminders(userId, {
        limit: 1
      });

      const reminder = reminders.find(r => r.id === reminderId);
      
      if (!reminder) {
        throw new AppError(404, 'Reminder not found');
      }

      res.json({
        success: true,
        data: reminder
      });

    } catch (error) {
      logger.error('Error fetching reminder', { error });
      throw new AppError(500, 'Failed to fetch reminder');
    }
  }

  /**
   * Update a reminder
   */
  async updateReminder(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { reminderId } = req.params;
      const validatedData = updateReminderSchema.parse(req.body);

      const updates: any = {};
      if (validatedData.title) updates.title = validatedData.title;
      if (validatedData.description !== undefined) updates.description = validatedData.description;
      if (validatedData.scheduledFor) updates.scheduledFor = new Date(validatedData.scheduledFor);
      if (validatedData.status) updates.status = validatedData.status;

      const reminder = await reminderService.updateReminder(reminderId, userId, updates);

      logger.info('Reminder updated', { userId, reminderId });

      res.json({
        success: true,
        message: 'Reminder updated successfully',
        data: reminder
      });

    } catch (error) {
      logger.error('Error updating reminder', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid update data', error.errors);
      }
      throw new AppError(500, 'Failed to update reminder');
    }
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { reminderId } = req.params;

      await reminderService.deleteReminder(reminderId, userId);

      logger.info('Reminder deleted', { userId, reminderId });

      res.json({
        success: true,
        message: 'Reminder deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting reminder', { error });
      throw new AppError(500, 'Failed to delete reminder');
    }
  }

  /**
   * Get smart reminder suggestions for an application
   */
  async getSmartSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { applicationId } = req.params;

      const suggestions = await reminderService.getSmartReminderSuggestions(applicationId);

      res.json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      logger.error('Error getting smart suggestions', { error });
      throw new AppError(500, 'Failed to get reminder suggestions');
    }
  }

  /**
   * Create reminder from suggestion
   */
  async createFromSuggestion(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { applicationId } = req.params;
      const { suggestionIndex } = req.body;

      const suggestions = await reminderService.getSmartReminderSuggestions(applicationId);
      
      if (suggestionIndex < 0 || suggestionIndex >= suggestions.length) {
        throw new AppError(400, 'Invalid suggestion index');
      }

      const suggestion = suggestions[suggestionIndex];

      const reminder = await reminderService.createApplicationReminder(
        userId,
        applicationId,
        suggestion.suggestedDate,
        suggestion.title,
        suggestion.description
      );

      logger.info('Reminder created from suggestion', { userId, reminderId: reminder.id });

      res.status(201).json({
        success: true,
        message: 'Reminder created from suggestion',
        data: reminder
      });

    } catch (error) {
      logger.error('Error creating reminder from suggestion', { error });
      throw new AppError(500, 'Failed to create reminder');
    }
  }
}

export const reminderController = new ReminderController();
