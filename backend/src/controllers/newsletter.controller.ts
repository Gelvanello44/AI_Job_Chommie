import { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { newsletterService } from '../services/newsletter.service.js';
import logger from '../config/logger.js';

/**
 * Newsletter Controller
 * Handles newsletter subscriptions and delivery
 */
export class NewsletterController {
  /**
   * Subscribe to newsletter
   */
  async subscribe(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { preferences } = req.body;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const subscription = await newsletterService.subscribe(userId, preferences);

      res.json({
        success: true,
        message: 'Successfully subscribed to newsletter',
        data: subscription
      });

    } catch (error) {
      logger.error('Error subscribing to newsletter', { error });
      throw new AppError(500, 'Failed to subscribe to newsletter');
    }
  }

  /**
   * Unsubscribe from newsletter
   */
  async unsubscribe(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      await newsletterService.unsubscribe(userId);

      res.json({
        success: true,
        message: 'Successfully unsubscribed from newsletter'
      });

    } catch (error) {
      logger.error('Error unsubscribing from newsletter', { error });
      throw new AppError(500, 'Failed to unsubscribe from newsletter');
    }
  }

  /**
   * Update newsletter preferences
   */
  async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { preferences } = req.body;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const subscription = await newsletterService.updatePreferences(userId, preferences);

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: subscription
      });

    } catch (error) {
      logger.error('Error updating preferences', { error });
      throw new AppError(500, 'Failed to update preferences');
    }
  }

  /**
   * Get newsletter archive
   */
  async getArchive(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { limit = 12 } = req.query;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      const newsletters = await newsletterService.getArchive(userId, parseInt(limit as string));

      res.json({
        success: true,
        data: newsletters
      });

    } catch (error) {
      logger.error('Error fetching archive', { error });
      throw new AppError(500, 'Failed to fetch newsletter archive');
    }
  }

  /**
   * Get specific newsletter
   */
  async getNewsletter(req: Request, res: Response): Promise<void> {
    try {
      const { newsletterId } = req.params;

      const newsletter = await newsletterService.getNewsletter(newsletterId);

      if (!newsletter) {
        throw new AppError(404, 'Newsletter not found');
      }

      res.json({
        success: true,
        data: newsletter
      });

    } catch (error) {
      logger.error('Error fetching newsletter', { error });
      throw new AppError(500, 'Failed to fetch newsletter');
    }
  }

  /**
   * Get South Africa market insights
   */
  async getSAMarketInsights(req: Request, res: Response): Promise<void> {
    try {
      const insights = await newsletterService.generateSAMarketInsights();

      res.json({
        success: true,
        data: insights
      });

    } catch (error) {
      logger.error('Error generating SA insights', { error });
      throw new AppError(500, 'Failed to generate market insights');
    }
  }

  /**
   * Admin: Generate monthly newsletter
   */
  async generateMonthlyNewsletter(req: Request, res: Response): Promise<void> {
    try {
      // Check admin privileges
      if (req.user?.role !== 'ADMIN') {
        throw new AppError(403, 'Admin access required');
      }

      const newsletter = await newsletterService.generateMonthlyNewsletter();

      res.json({
        success: true,
        message: 'Newsletter generated successfully',
        data: newsletter
      });

    } catch (error) {
      logger.error('Error generating newsletter', { error });
      throw new AppError(500, 'Failed to generate newsletter');
    }
  }

  /**
   * Admin: Send newsletter
   */
  async sendNewsletter(req: Request, res: Response): Promise<void> {
    try {
      // Check admin privileges
      if (req.user?.role !== 'ADMIN') {
        throw new AppError(403, 'Admin access required');
      }

      const { newsletterId } = req.body;

      const results = await newsletterService.sendNewsletter(newsletterId);

      res.json({
        success: true,
        message: 'Newsletter sent successfully',
        data: results
      });

    } catch (error) {
      logger.error('Error sending newsletter', { error });
      throw new AppError(500, 'Failed to send newsletter');
    }
  }
}

export const newsletterController = new NewsletterController();
