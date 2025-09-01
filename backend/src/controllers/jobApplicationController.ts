import { Response, NextFunction } from 'express';
import { z } from 'zod';
import jobApplicationService, { 
  jobApplicationSchema, 
  applicationFilterSchema 
} from '../services/jobApplicationService.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../types/auth.js';
import activityService from '../services/activityService.js';

// Additional validation schemas
const applicationIdSchema = z.object({
  applicationId: z.string().uuid()
});

const withdrawSchema = z.object({
  reason: z.string().max(500).optional()
});

export class JobApplicationController {
  /**
   * Apply for a job
   */
  async applyForJob(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const applicationData = req.body;

      const application = await jobApplicationService.applyForJob(userId, applicationData);

      // Log application activity
      await activityService.logUserActivity(userId, 'job_applied', {
        jobId: applicationData.jobId,
        applicationId: application.id
      }).catch(err => logger.warn('Failed to log job application activity', { error: err }));

      res.status(201).json({
        success: true,
        message: 'Job application submitted successfully',
        data: application
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's job applications with filtering and pagination
   */
  async getUserApplications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      
      // Parse and validate query parameters
      const filters: any = {
        status: req.query.status ? 
          (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : undefined,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        companyId: req.query.companyId as string,
        jobType: req.query.jobType ? 
          (Array.isArray(req.query.jobType) ? req.query.jobType : [req.query.jobType]) : undefined,
        salaryMin: req.query.salaryMin ? Number(req.query.salaryMin) : undefined,
        salaryMax: req.query.salaryMax ? Number(req.query.salaryMax) : undefined,
        location: req.query.location as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        sortBy: req.query.sortBy as string || 'created_at',
        sortOrder: req.query.sortOrder as string || 'desc'
      };

      const result = await jobApplicationService.getUserApplications(userId, filters);

      res.json({
        success: true,
        data: result.applications,
        pagination: result.pagination,
        filters: result.filters
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific application details
   */
  async getApplicationById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { applicationId } = applicationIdSchema.parse(req.params);

      const application = await jobApplicationService.getApplicationById(userId, applicationId);

      // Log application view activity
      await activityService.logUserActivity(userId, 'application_viewed', {
        applicationId
      }).catch(err => logger.warn('Failed to log application view activity', { error: err }));

      res.json({
        success: true,
        data: application
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid application ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Withdraw job application
   */
  async withdrawApplication(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { applicationId } = applicationIdSchema.parse(req.params);
      const { reason } = withdrawSchema.parse(req.body);

      const application = await jobApplicationService.withdrawApplication(userId, applicationId, reason);

      // Log withdrawal activity
      await activityService.logUserActivity(userId, 'application_withdrawn', {
        applicationId,
        reason
      }).catch(err => logger.warn('Failed to log withdrawal activity', { error: err }));

      res.json({
        success: true,
        message: 'Application withdrawn successfully',
        data: application
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid request data', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get application statistics for user
   */
  async getApplicationStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const stats = await jobApplicationService.getApplicationStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get applications by status
   */
  async getApplicationsByStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { status } = req.params;

      // Validate status
      const validStatuses = [
        'PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 
        'INTERVIEWED', 'OFFER_MADE', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'
      ];

      if (!validStatuses.includes(status.toUpperCase())) {
        throw new AppError(400, 'Invalid application status', 'INVALID_STATUS');
      }

      const filters: any = {
        status: [status.toUpperCase()],
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        sortBy: req.query.sortBy as string || 'created_at',
        sortOrder: req.query.sortOrder as string || 'desc'
      };

      const result = await jobApplicationService.getUserApplications(userId, filters);

      res.json({
        success: true,
        data: result.applications,
        pagination: result.pagination,
        meta: {
          status: status.toUpperCase(),
          count: result.applications.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent applications (last 30 days)
   */
  async getRecentApplications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const filters = {
        dateFrom: thirtyDaysAgo.toISOString(),
        page: 1,
        limit: 20,
        sortBy: 'created_at' as const,
        sortOrder: 'desc' as const
      };

      const result = await jobApplicationService.getUserApplications(userId, filters);

      res.json({
        success: true,
        data: result.applications,
        meta: {
          period: 'last_30_days',
          count: result.applications.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pending applications
   */
  async getPendingApplications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const filters: any = {
        status: ['PENDING', 'REVIEWING'],
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        sortBy: 'created_at' as const,
        sortOrder: 'desc' as const
      };

      const result = await jobApplicationService.getUserApplications(userId, filters);

      res.json({
        success: true,
        data: result.applications,
        pagination: result.pagination,
        meta: {
          type: 'pending',
          count: result.applications.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get successful applications (accepted offers)
   */
  async getSuccessfulApplications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const filters: any = {
        status: ['ACCEPTED'],
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        sortBy: 'updated_at' as const,
        sortOrder: 'desc' as const
      };

      const result = await jobApplicationService.getUserApplications(userId, filters);

      res.json({
        success: true,
        data: result.applications,
        pagination: result.pagination,
        meta: {
          type: 'successful',
          count: result.applications.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get applications with upcoming interviews
   */
  async getUpcomingInterviews(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const filters: any = {
        status: ['INTERVIEW_SCHEDULED'],
        page: 1,
        limit: 50,
        sortBy: 'created_at' as const,
        sortOrder: 'asc' as const
      };

      const result = await jobApplicationService.getUserApplications(userId, filters);

      // Filter for upcoming interviews (this would be better done in the service)
      const upcomingInterviews = result.applications.filter(app => 
        app.interviewDate && new Date(app.interviewDate) >= tomorrow
      );

      res.json({
        success: true,
        data: upcomingInterviews,
        meta: {
          type: 'upcoming_interviews',
          count: upcomingInterviews.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export user applications (CSV format)
   */
  async exportApplications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      
      // Get all applications for export
      const filters = {
        page: 1,
        limit: 1000, // Large limit to get all applications
        sortBy: 'created_at' as const,
        sortOrder: 'desc' as const
      };

      const result = await jobApplicationService.getUserApplications(userId, filters);

      // Convert to CSV format
      const csvHeaders = [
        'Application ID', 'Job Title', 'Company', 'Status', 'Applied Date', 
        'Location', 'Job Type', 'Expected Salary', 'Interview Date'
      ];

      const csvRows = result.applications.map(app => [
        app.id,
        app.job.title,
        app.job.company.name,
        app.status,
        new Date(app.appliedAt).toLocaleDateString(),
        app.job.location || '',
        app.job.jobType || '',
        app.expectedSalary || '',
        app.interviewDate ? new Date(app.interviewDate).toLocaleDateString() : ''
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      // Log export activity
      await activityService.logUserActivity(userId, 'applications_exported', {
        applicationCount: result.applications.length
      }).catch(err => logger.warn('Failed to log export activity', { error: err }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="applications_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (error) {
      next(error);
    }
  }
}

export default new JobApplicationController();
