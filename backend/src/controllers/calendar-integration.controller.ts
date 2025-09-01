import { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { calendarIntegrationService } from '../services/calendar-integration.service.js';
import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { z } from 'zod';

// Validation schemas
const getAvailableSlotsSchema = z.object({
  provider: z.enum(['GOOGLE', 'MICROSOFT']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  duration: z.number().min(15).max(480).default(60)
});

const syncInterviewSchema = z.object({
  interviewScheduleId: z.string().uuid(),
  provider: z.enum(['GOOGLE', 'MICROSOFT'])
});

/**
 * Calendar Integration Controller
 * Handles calendar synchronization for interviews
 */
export class CalendarIntegrationController {
  /**
   * Get Google Calendar authorization URL
   */
  async getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const authUrl = calendarIntegrationService.getGoogleAuthUrl(userId);

      res.json({
        success: true,
        data: { authUrl }
      });

    } catch (error) {
      logger.error('Error getting Google auth URL', { error });
      throw new AppError(500, 'Failed to get Google authorization URL');
    }
  }

  /**
   * Get Microsoft Calendar authorization URL
   */
  async getMicrosoftAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const authUrl = calendarIntegrationService.getMicrosoftAuthUrl(userId);

      res.json({
        success: true,
        data: { authUrl }
      });

    } catch (error) {
      logger.error('Error getting Microsoft auth URL', { error });
      throw new AppError(500, 'Failed to get Microsoft authorization URL');
    }
  }

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        throw new AppError(400, 'Missing authorization code or state');
      }

      await calendarIntegrationService.handleGoogleCallback(
        code as string,
        state as string // userId passed in state
      );

      // Redirect to frontend success page
      res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?connected=google`);

    } catch (error) {
      logger.error('Error handling Google callback', { error });
      // Redirect to frontend error page
      res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=google_connection_failed`);
    }
  }

  /**
   * Handle Microsoft OAuth callback
   */
  async handleMicrosoftCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        throw new AppError(400, 'Missing authorization code or state');
      }

      await calendarIntegrationService.handleMicrosoftCallback(
        code as string,
        state as string // userId passed in state
      );

      // Redirect to frontend success page
      res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?connected=microsoft`);

    } catch (error) {
      logger.error('Error handling Microsoft callback', { error });
      // Redirect to frontend error page
      res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=microsoft_connection_failed`);
    }
  }

  /**
   * Get available time slots
   */
  async getAvailableTimeSlots(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const validatedData = getAvailableSlotsSchema.parse(req.query);

      const availableSlots = await calendarIntegrationService.getAvailableTimeSlots(
        userId,
        validatedData.provider,
        {
          start: new Date(validatedData.startDate),
          end: new Date(validatedData.endDate)
        },
        validatedData.duration
      );

      res.json({
        success: true,
        data: { availableSlots }
      });

    } catch (error) {
      logger.error('Error getting available slots', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid request parameters', error.errors);
      }
      throw new AppError(500, 'Failed to get available time slots');
    }
  }

  /**
   * Get calendar integration status
   */
  async getIntegrationStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const status = await calendarIntegrationService.getIntegrationStatus(userId);

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Error getting integration status', { error });
      throw new AppError(500, 'Failed to get integration status');
    }
  }

  /**
   * Disconnect calendar integration
   */
  async disconnectCalendar(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { provider } = req.params;

      if (!['GOOGLE', 'MICROSOFT'].includes(provider)) {
        throw new AppError(400, 'Invalid calendar provider');
      }

      await calendarIntegrationService.disconnectCalendar(
        userId,
        provider as 'GOOGLE' | 'MICROSOFT'
      );

      res.json({
        success: true,
        message: `${provider} calendar disconnected successfully`
      });

    } catch (error) {
      logger.error('Error disconnecting calendar', { error });
      throw new AppError(500, 'Failed to disconnect calendar');
    }
  }

  /**
   * Sync interview to calendar
   */
  async syncInterviewToCalendar(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const validatedData = syncInterviewSchema.parse(req.body);

      // Get interview schedule
      const interviewSchedule = await prisma.interviewSchedule.findFirst({
        where: {
          id: validatedData.interviewScheduleId,
          userId
        }
      });

      if (!interviewSchedule) {
        throw new AppError(404, 'Interview schedule not found');
      }

      let eventId = null;

      if (validatedData.provider === 'GOOGLE') {
        eventId = await calendarIntegrationService.createGoogleCalendarEvent(
          userId,
          interviewSchedule
        );
      } else {
        eventId = await calendarIntegrationService.createMicrosoftCalendarEvent(
          userId,
          interviewSchedule
        );
      }

      if (eventId) {
        // Update interview schedule with calendar event ID
        await prisma.interviewSchedule.update({
          where: { id: validatedData.interviewScheduleId },
          data: {
            googleEventId: validatedData.provider === 'GOOGLE' ? eventId : undefined,
            outlookEventId: validatedData.provider === 'MICROSOFT' ? eventId : undefined
          }
        });

        logger.info('Interview synced to calendar', { 
          userId, 
          interviewScheduleId: validatedData.interviewScheduleId,
          provider: validatedData.provider 
        });
      }

      res.json({
        success: true,
        message: 'Interview synced to calendar successfully',
        data: { eventId }
      });

    } catch (error) {
      logger.error('Error syncing interview to calendar', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid sync data', error.errors);
      }
      throw new AppError(500, 'Failed to sync interview to calendar');
    }
  }

  /**
   * Update calendar event
   */
  async updateCalendarEvent(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { interviewScheduleId } = req.params;
      const { provider } = req.body;

      // Get interview schedule
      const interviewSchedule = await prisma.interviewSchedule.findFirst({
        where: {
          id: interviewScheduleId,
          userId
        }
      });

      if (!interviewSchedule) {
        throw new AppError(404, 'Interview schedule not found');
      }

      const eventId = provider === 'GOOGLE' 
        ? interviewSchedule.googleEventId 
        : interviewSchedule.outlookEventId;

      if (!eventId) {
        throw new AppError(400, 'No calendar event found for this interview');
      }

      let success = false;

      if (provider === 'GOOGLE') {
        success = await calendarIntegrationService.updateGoogleCalendarEvent(
          userId,
          eventId,
          interviewSchedule
        );
      } else {
        success = await calendarIntegrationService.updateMicrosoftCalendarEvent(
          userId,
          eventId,
          interviewSchedule
        );
      }

      if (success) {
        logger.info('Calendar event updated', { 
          userId, 
          interviewScheduleId,
          provider 
        });
      }

      res.json({
        success,
        message: success ? 'Calendar event updated successfully' : 'Failed to update calendar event'
      });

    } catch (error) {
      logger.error('Error updating calendar event', { error });
      throw new AppError(500, 'Failed to update calendar event');
    }
  }

  /**
   * Delete calendar event
   */
  async deleteCalendarEvent(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const { interviewScheduleId } = req.params;
      const { provider } = req.body;

      // Get interview schedule
      const interviewSchedule = await prisma.interviewSchedule.findFirst({
        where: {
          id: interviewScheduleId,
          userId
        }
      });

      if (!interviewSchedule) {
        throw new AppError(404, 'Interview schedule not found');
      }

      const eventId = provider === 'GOOGLE' 
        ? interviewSchedule.googleEventId 
        : interviewSchedule.outlookEventId;

      if (!eventId) {
        throw new AppError(400, 'No calendar event found for this interview');
      }

      let success = false;

      if (provider === 'GOOGLE') {
        success = await calendarIntegrationService.deleteGoogleCalendarEvent(userId, eventId);
      } else {
        success = await calendarIntegrationService.deleteMicrosoftCalendarEvent(userId, eventId);
      }

      if (success) {
        // Clear the event ID from interview schedule
        await prisma.interviewSchedule.update({
          where: { id: interviewScheduleId },
          data: {
            googleEventId: provider === 'GOOGLE' ? null : undefined,
            outlookEventId: provider === 'MICROSOFT' ? null : undefined
          }
        });

        logger.info('Calendar event deleted', { 
          userId, 
          interviewScheduleId,
          provider 
        });
      }

      res.json({
        success,
        message: success ? 'Calendar event deleted successfully' : 'Failed to delete calendar event'
      });

    } catch (error) {
      logger.error('Error deleting calendar event', { error });
      throw new AppError(500, 'Failed to delete calendar event');
    }
  }
}

export const calendarIntegrationController = new CalendarIntegrationController();
