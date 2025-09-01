import { Request, Response, NextFunction } from 'express';
import scrapingIntegrationService, { ScrapingTaskRequest } from '../services/scrapingIntegration.service.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import { z } from 'zod';

// Validation schemas
const startScrapingTaskSchema = z.object({
  source: z.string().min(1),
  keywords: z.string().optional(),
  location: z.string().optional(),
  maxJobs: z.number().min(1).max(1000).optional().default(100),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  tier: z.enum(['FREE', 'PROFESSIONAL', 'EXECUTIVE', 'ENTERPRISE']).optional()
});

const bulkScrapingSchema = z.object({
  sources: z.array(z.string()).min(1),
  keywords: z.array(z.string()).optional(),
  maxJobsPerSource: z.number().min(1).max(500).optional().default(100)
});

const taskIdSchema = z.object({
  taskId: z.string().min(1)
});

class ScrapingIntegrationController {
  /**
   * Start a new scraping task
   */
  async startScrapingTask(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      
      // Validate request body
      const validatedData = startScrapingTaskSchema.parse(req.body);

      // Check user's tier limits if authenticated
      if (userId) {
        await this.checkTierLimits(userId, validatedData.tier);
      }

      const scrapingRequest: ScrapingTaskRequest = {
        source: validatedData.source,
        keywords: validatedData.keywords,
        location: validatedData.location,
        maxJobs: validatedData.maxJobs,
        userId,
        priority: validatedData.priority,
        tier: validatedData.tier || this.getUserTier(req.user)
      };

      logger.info('Starting scraping task via API', { 
        userId, 
        source: validatedData.source,
        tier: scrapingRequest.tier
      });

      const result = await scrapingIntegrationService.startScrapingTask(scrapingRequest);

      res.json({
        success: true,
        data: result,
        meta: {
          userId,
          timestamp: new Date().toISOString(),
          source: validatedData.source
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid request data', 'VALIDATION_ERROR', error.errors));
      }
      logger.error('Failed to start scraping task', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get scraping task status
   */
  async getTaskStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskId } = taskIdSchema.parse(req.params);
      const userId = req.user?.id;

      logger.info('Getting scraping task status', { taskId, userId });

      const status = await scrapingIntegrationService.getTaskStatus(taskId);

      res.json({
        success: true,
        data: status,
        meta: {
          userId,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid task ID', 'VALIDATION_ERROR', error.errors));
      }
      logger.error('Failed to get task status', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get orchestrator status
   */
  async getOrchestratorStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      logger.info('Getting orchestrator status', { userId });

      const status = await scrapingIntegrationService.getOrchestratorStatus();

      res.json({
        success: true,
        data: status,
        meta: {
          userId,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get orchestrator status', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Start orchestrator
   */
  async startOrchestrator(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      // Only allow admins to start/stop orchestrator
      if (!req.user?.isAdmin) {
        throw new AppError(403, 'Admin privileges required', 'ADMIN_REQUIRED');
      }

      logger.info('Starting orchestrator via API', { userId });

      const result = await scrapingIntegrationService.startOrchestrator();

      res.json({
        success: true,
        data: result,
        meta: {
          userId,
          timestamp: new Date().toISOString(),
          action: 'start_orchestrator'
        }
      });

    } catch (error) {
      logger.error('Failed to start orchestrator', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Stop orchestrator
   */
  async stopOrchestrator(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      // Only allow admins to start/stop orchestrator
      if (!req.user?.isAdmin) {
        throw new AppError(403, 'Admin privileges required', 'ADMIN_REQUIRED');
      }

      logger.info('Stopping orchestrator via API', { userId });

      const result = await scrapingIntegrationService.stopOrchestrator();

      res.json({
        success: true,
        data: result,
        meta: {
          userId,
          timestamp: new Date().toISOString(),
          action: 'stop_orchestrator'
        }
      });

    } catch (error) {
      logger.error('Failed to stop orchestrator', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Bulk scraping (admin only)
   */
  async bulkScrapeJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      // Only allow admins to trigger bulk scraping
      if (!req.user?.isAdmin) {
        throw new AppError(403, 'Admin privileges required', 'ADMIN_REQUIRED');
      }

      const validatedData = bulkScrapingSchema.parse(req.body);

      logger.info('Starting bulk scraping via API', { 
        userId, 
        sources: validatedData.sources,
        keywordCount: validatedData.keywords?.length || 0
      });

      const result = await scrapingIntegrationService.bulkScrapeJobs(
        validatedData.sources,
        validatedData.keywords,
        userId
      );

      res.json({
        success: true,
        data: result,
        meta: {
          userId,
          timestamp: new Date().toISOString(),
          action: 'bulk_scraping'
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid bulk scraping request', 'VALIDATION_ERROR', error.errors));
      }
      logger.error('Failed to start bulk scraping', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get scraping service health status
   */
  async getServiceHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      const health = await scrapingIntegrationService.checkScrapingServiceHealth();

      res.json({
        success: true,
        data: health,
        meta: {
          userId,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get service health', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get system-wide scraping statistics (admin only)
   */
  async getSystemStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      // Only allow admins to view system stats
      if (!req.user?.isAdmin) {
        throw new AppError(403, 'Admin privileges required', 'ADMIN_REQUIRED');
      }

      const stats = await scrapingIntegrationService.getSystemScrapingStats();

      res.json({
        success: true,
        data: stats,
        meta: {
          userId,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get system stats', { error, userId: req.user?.id });
      next(error);
    }
  }





  /**
   * Get user's scraping history
   */
  async getUserScrapingHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      const limit = parseInt(req.query.limit as string) || 10;

      const history = await scrapingIntegrationService.getUserScrapingHistory(userId, limit);

      res.json({
        success: true,
        data: history,
        meta: {
          userId,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get user scraping history', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Check tier limits for scraping operations
   */
  private async checkTierLimits(userId: string, requestedTier?: string) {
    // Implementation would check user's subscription tier and limits
    // For now, just log the check
    logger.debug('Checking tier limits', { userId, requestedTier });
    
    // In a full implementation:
    // - Check user's current subscription tier
    // - Check daily/monthly scraping limits
    // - Validate if user can access premium features
    // - Throw error if limits exceeded
  }

  /**
   * Get user's tier from user object or default
   */
  private getUserTier(user?: any): 'FREE' | 'PROFESSIONAL' | 'EXECUTIVE' | 'ENTERPRISE' {
    if (!user) return 'FREE';
    
    // Map user subscription to tier
    switch (user.subscription?.plan) {
      case 'professional':
        return 'PROFESSIONAL';
      case 'executive':
        return 'EXECUTIVE';
      case 'enterprise':
        return 'ENTERPRISE';
      default:
        return 'FREE';
    }
  }
}

export default new ScrapingIntegrationController();
