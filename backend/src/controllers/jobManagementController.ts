import { Response, NextFunction } from 'express';
import { z } from 'zod';
import jobManagementService, { 
  jobCreateSchema, 
  jobUpdateSchema,
  jobFilterSchema 
} from '../services/jobManagementService.js';
import jobScrapingService from '../services/jobScrapingService.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../types/auth.js';
import activityService from '../services/activityService.js';

// Additional validation schemas
const jobIdSchema = z.object({
  jobId: z.string().uuid()
});

const companyIdSchema = z.object({
  companyId: z.string().uuid()
});

const scrapingConfigSchema = z.object({
  keywords: z.array(z.string()).max(10).optional(),
  maxJobsPerBoard: z.number().min(1).max(200).optional()
});

export class JobManagementController {
  /**
   * Create a new job posting
   */
  async createJob(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { companyId } = companyIdSchema.parse(req.params);
      const jobData = req.body;

      const job = await jobManagementService.createJob(userId, companyId, jobData);

      // Log job creation activity
      await activityService.logUserActivity(userId, 'job_created', {
        jobId: job.id,
        jobTitle: job.title,
        companyId
      }).catch(err => logger.warn('Failed to log job creation activity', { error: err }));

      res.status(201).json({
        success: true,
        message: 'Job created successfully',
        data: job
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid company ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Update existing job
   */
  async updateJob(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { jobId } = jobIdSchema.parse(req.params);
      const jobData = req.body;

      const job = await jobManagementService.updateJob(userId, jobId, jobData);

      // Log job update activity
      await activityService.logUserActivity(userId, 'job_updated', {
        jobId,
        updatedFields: Object.keys(jobData)
      }).catch(err => logger.warn('Failed to log job update activity', { error: err }));

      res.json({
        success: true,
        message: 'Job updated successfully',
        data: job
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Publish a draft job
   */
  async publishJob(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { jobId } = jobIdSchema.parse(req.params);

      const job = await jobManagementService.publishJob(userId, jobId);

      // Log job publication activity
      await activityService.logUserActivity(userId, 'job_published', {
        jobId,
        jobTitle: job.title
      }).catch(err => logger.warn('Failed to log job publication activity', { error: err }));

      res.json({
        success: true,
        message: 'Job published successfully',
        data: job
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Deactivate a job
   */
  async deactivateJob(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { jobId } = jobIdSchema.parse(req.params);

      const job = await jobManagementService.deactivateJob(userId, jobId);

      // Log job deactivation activity
      await activityService.logUserActivity(userId, 'job_deactivated', {
        jobId,
        jobTitle: job.title
      }).catch(err => logger.warn('Failed to log job deactivation activity', { error: err }));

      res.json({
        success: true,
        message: 'Job deactivated successfully',
        data: job
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Delete a job
   */
  async deleteJob(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { jobId } = jobIdSchema.parse(req.params);

      await jobManagementService.deleteJob(userId, jobId);

      // Log job deletion activity
      await activityService.logUserActivity(userId, 'job_deleted', {
        jobId
      }).catch(err => logger.warn('Failed to log job deletion activity', { error: err }));

      res.json({
        success: true,
        message: 'Job deleted successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get company jobs with filtering
   */
  async getCompanyJobs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { companyId } = companyIdSchema.parse(req.params);

      const filters = {
        status: req.query.status ? 
          (Array.isArray(req.query.status) ? 
            req.query.status.map(s => s as string).filter(s => ['ACTIVE', 'DRAFT', 'INACTIVE', 'EXPIRED'].includes(s)) as ('ACTIVE' | 'DRAFT' | 'INACTIVE' | 'EXPIRED')[] : 
            [req.query.status as string].filter(s => ['ACTIVE', 'DRAFT', 'INACTIVE', 'EXPIRED'].includes(s)) as ('ACTIVE' | 'DRAFT' | 'INACTIVE' | 'EXPIRED')[]) : undefined,
        postedBy: req.query.postedBy as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        sortBy: (req.query.sortBy as string || 'created_at') as 'title' | 'salary' | 'created_at' | 'updated_at' | 'applications_count',
        sortOrder: (req.query.sortOrder as string || 'desc') as 'asc' | 'desc'
      };

      const result = await jobManagementService.getCompanyJobs(userId, companyId, filters);

      res.json({
        success: true,
        data: result.jobs,
        pagination: result.pagination,
        filters: result.filters
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid company ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get job details (public endpoint)
   */
  async getJobById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { jobId } = jobIdSchema.parse(req.params);
      const userId = req.user?.id; // Optional for public access

      const job = await jobManagementService.getJobById(jobId, userId);

      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get job applications for a specific job
   */
  async getJobApplications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { jobId } = jobIdSchema.parse(req.params);
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      const result = await jobManagementService.getJobApplications(userId, jobId, page, limit);

      res.json({
        success: true,
        data: result.applications,
        pagination: result.pagination
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Run job scraping pipeline (admin only)
   */
  async runJobScraping(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Check if user is admin (you might want to implement admin role check)
      // For now, we'll allow any authenticated user to run scraping
      
      const { keywords, maxJobsPerBoard } = scrapingConfigSchema.parse(req.body);

      const results = await jobScrapingService.runScrapingPipeline(keywords, maxJobsPerBoard);

      // Log scraping activity
      await activityService.logUserActivity(userId, 'job_scraping_executed', {
        results
      }).catch(err => logger.warn('Failed to log scraping activity', { error: err }));

      res.json({
        success: true,
        message: 'Job scraping completed',
        data: results
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid scraping configuration', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get scraping statistics
   */
  async getScrapingStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await jobScrapingService.getScrapingStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clean up old scraped jobs
   */
  async cleanupOldJobs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const daysOld = req.query.daysOld ? Number(req.query.daysOld) : 60;

      const deletedCount = await jobScrapingService.cleanupOldJobs(daysOld);

      // Log cleanup activity
      await activityService.logUserActivity(userId, 'jobs_cleanup_executed', {
        deletedCount,
        daysOld
      }).catch(err => logger.warn('Failed to log cleanup activity', { error: err }));

      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} old jobs`,
        data: { deletedCount }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Duplicate/clone a job
   */
  async duplicateJob(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { jobId } = jobIdSchema.parse(req.params);

      // Get the original job
      const originalJob = await jobManagementService.getJobById(jobId, userId);

      // Remove fields that shouldn't be duplicated
      const {
        id, createdAt, updatedAt, postedAt, applicationsCount, 
        hasApplied, postedBy, ...duplicateData
      } = originalJob;

      // Add "Copy of" to the title
      duplicateData.title = `Copy of ${duplicateData.title}`;
      duplicateData.status = 'DRAFT';

      // Create the duplicate job
      const duplicatedJob = await jobManagementService.createJob(
        userId, 
        duplicateData.company.id, 
        duplicateData as any
      );

      // Log job duplication activity
      await activityService.logUserActivity(userId, 'job_duplicated', {
        originalJobId: jobId,
        duplicatedJobId: duplicatedJob.id,
        jobTitle: duplicatedJob.title
      }).catch(err => logger.warn('Failed to log job duplication activity', { error: err }));

      res.status(201).json({
        success: true,
        message: 'Job duplicated successfully',
        data: duplicatedJob
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }
}

export default new JobManagementController();
