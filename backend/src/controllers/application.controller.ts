import { Request, Response } from 'express';
import { z } from 'zod';
import { ApplicationService } from '../services/application.service.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { ApplicationStatus } from '@prisma/client';
import logger from '../config/logger.js';

// Validation schemas
const applicationCreateSchema = z.object({
  jobId: z.string().uuid(),
  cvId: z.string().uuid().optional(),
  coverLetter: z.string().max(5000).optional(),
  customFields: z.record(z.any()).optional()
});

const applicationUpdateSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  internalNotes: z.string().max(1000).optional(),
  rejectionReason: z.string().max(500).optional(),
  interviewDate: z.string().datetime().optional()
});

const userNotesUpdateSchema = z.object({
  userNotes: z.string().max(2000)
});

const applicationSearchSchema = z.object({
  jobId: z.string().uuid().optional(),
  status: z.nativeEnum(ApplicationStatus).optional(),
  userId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'status', 'matchScore']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export class ApplicationController {
  private applicationService = new ApplicationService();

  /**
   * Submit job application
   */
  submitApplication = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    if (req.user.role !== 'JOB_SEEKER') {
      throw new AppError(403, 'Only job seekers can submit applications');
    }

    const parsedData = applicationCreateSchema.parse(req.body);
    
    const application = await this.applicationService.submitApplication(
      req.user.id,
      {
        jobId: parsedData.jobId,
        cvId: parsedData.cvId,
        coverLetter: parsedData.coverLetter,
        customFields: parsedData.customFields
      }
    );
    
    logger.info('Application submitted', { 
      applicationId: application.id, 
      userId: req.user.id,
      jobId: parsedData.jobId 
    });

    res.status(201).json({
      success: true,
      data: { application },
      message: 'Application submitted successfully'
    });
  });

  /**
   * Get user's applications
   */
  getUserApplications = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const parsedFilters = applicationSearchSchema.parse(req.query);
    
    const result = await this.applicationService.getUserApplications(
      req.user.id,
      {
        jobId: parsedFilters.jobId,
        status: parsedFilters.status,
        userId: parsedFilters.userId,
        companyId: parsedFilters.companyId,
        page: parsedFilters.page,
        limit: parsedFilters.limit,
        sortBy: parsedFilters.sortBy,
        sortOrder: parsedFilters.sortOrder
      }
    );

    res.json({
      success: true,
      data: result,
      message: 'Applications retrieved successfully'
    });
  });

  /**
   * Get application by ID
   */
  getApplicationById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;
    
    const application = await this.applicationService.getApplicationById(
      id,
      req.user.id
    );

    if (!application) {
      throw new AppError(404, 'Application not found');
    }

    res.json({
      success: true,
      data: { application },
      message: 'Application retrieved successfully'
    });
  });

  /**
   * Withdraw application
   */
  withdrawApplication = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;
    
    const application = await this.applicationService.withdrawApplication(
      id,
      req.user.id
    );
    
    logger.info('Application withdrawn', { 
      applicationId: id, 
      userId: req.user.id 
    });

    res.json({
      success: true,
      data: { application },
      message: 'Application withdrawn successfully'
    });
  });

  /**
   * Get applications for employer
   */
  getEmployerApplications = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Access denied');
    }

    const parsedFilters = applicationSearchSchema.parse(req.query);
    
    const result = await this.applicationService.getEmployerApplications(
      req.user.id,
      {
        jobId: parsedFilters.jobId,
        status: parsedFilters.status,
        userId: parsedFilters.userId,
        companyId: parsedFilters.companyId,
        page: parsedFilters.page,
        limit: parsedFilters.limit,
        sortBy: parsedFilters.sortBy,
        sortOrder: parsedFilters.sortOrder
      }
    );

    res.json({
      success: true,
      data: result,
      message: 'Employer applications retrieved successfully'
    });
  });

  /**
   * Update application status (Employer only)
   */
  updateApplicationStatus = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Only employers can update application status');
    }

    const { id } = req.params;
    const parsedUpdates = applicationUpdateSchema.parse(req.body);
    
    const application = await this.applicationService.updateApplicationStatus(
      id,
      {
        status: parsedUpdates.status,
        internalNotes: parsedUpdates.internalNotes,
        rejectionReason: parsedUpdates.rejectionReason,
        interviewDate: parsedUpdates.interviewDate
      },
      req.user.id
    );
    
    logger.info('Application status updated', { 
      applicationId: id, 
      newStatus: parsedUpdates.status,
      updatedBy: req.user.id 
    });

    res.json({
      success: true,
      data: { application },
      message: 'Application status updated successfully'
    });
  });

  /**
   * Get application statistics
   */
  getApplicationStats = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const stats = await this.applicationService.getApplicationStatistics(req.user.id);

    res.json({
      success: true,
      data: { stats },
      message: 'Application statistics retrieved successfully'
    });
  });

  /**
   * Get application timeline
   */
  getApplicationTimeline = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;
    
    const timeline = await this.applicationService.getApplicationTimeline(
      id,
      req.user.id
    );

    res.json({
      success: true,
      data: { timeline },
      message: 'Application timeline retrieved successfully'
    });
  });

  /**
   * Check if user can apply to job
   */
  checkApplicationEligibility = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { jobId } = req.params;
    
    const eligibility = await this.applicationService.checkApplicationEligibility(
      req.user.id,
      jobId
    );

    res.json({
      success: true,
      data: eligibility,
      message: 'Application eligibility checked'
    });
  });

  /**
   * Get application analytics for employer
   */
  getEmployerApplicationAnalytics = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Access denied');
    }

    const { timeframe } = req.query;
    
    const analytics = await this.applicationService.getEmployerApplicationAnalytics(
      req.user.id,
      timeframe as string
    );

    res.json({
      success: true,
      data: { analytics },
      message: 'Application analytics retrieved successfully'
    });
  });

  /**
   * Bulk apply to multiple jobs
   */
  bulkApply = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { jobIds, coverLetter, resumeId } = req.body;
    
    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      throw new AppError(400, 'Job IDs array is required');
    }

    if (jobIds.length > 10) {
      throw new AppError(400, 'Maximum 10 applications allowed per bulk apply');
    }

    const results = await this.applicationService.bulkApply(
      req.user.id,
      jobIds,
      { coverLetter, resumeId }
    );
    
    logger.info('Bulk application submitted', { 
      userId: req.user.id,
      jobCount: jobIds.length,
      successful: results.successful.length,
      failed: results.failed.length
    });

    res.json({
      success: true,
      data: results,
      message: `Applied to ${results.successful.length} jobs successfully`
    });
  });

  /**
   * Bulk update application statuses
   */
  bulkUpdateApplications = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Access denied');
    }

    const { applicationIds, status, notes } = req.body;
    
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      throw new AppError(400, 'Application IDs are required');
    }

    const result = await this.applicationService.bulkUpdateApplications(
      applicationIds,
      status,
      req.user.id,
      notes
    );
    
    logger.info('Bulk application update', { 
      count: applicationIds.length,
      status,
      updatedBy: req.user.id 
    });

    res.json({
      success: true,
      data: { updated: result.updated, failed: result.failed },
      message: `${result.updated} applications updated successfully`
    });
  });

  /**
   * Update user notes for an application
   */
  updateUserNotes = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;
    const parsedData = userNotesUpdateSchema.parse(req.body);
    
    const application = await this.applicationService.updateUserNotes(
      id,
      req.user.id,
      parsedData.userNotes
    );
    
    logger.info('User notes updated', { 
      applicationId: id, 
      userId: req.user.id 
    });

    res.json({
      success: true,
      data: { application },
      message: 'Notes updated successfully'
    });
  });

  /**
   * Get user notes for an application
   */
  getUserNotes = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;
    
    const notes = await this.applicationService.getUserNotes(
      id,
      req.user.id
    );

    res.json({
      success: true,
      data: { notes },
      message: 'Notes retrieved successfully'
    });
  });
}
