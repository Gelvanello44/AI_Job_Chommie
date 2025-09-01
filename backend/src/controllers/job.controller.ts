import { Request, Response } from 'express';
import { z } from 'zod';
import { JobService } from '../services/job.service.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { JobType, ExperienceLevel, Province } from '@prisma/client';
import logger from '../config/logger.js';

// Validation schemas
const jobCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(50).max(5000),
  requirements: z.string().min(20).max(3000),
  responsibilities: z.string().min(20).max(3000),
  companyId: z.string().uuid(),
  jobType: z.nativeEnum(JobType),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  province: z.nativeEnum(Province),
  city: z.string().min(1).max(100),
  suburb: z.string().max(100).optional(),
  isRemote: z.boolean().default(false),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  salaryCurrency: z.string().default('ZAR'),
  salaryPeriod: z.string().default('monthly'),
  showSalary: z.boolean().default(true),
  requiredSkills: z.array(z.string()).max(20),
  preferredSkills: z.array(z.string()).max(15),
  education: z.string().max(200).optional(),
  yearsExperienceMin: z.number().min(0).max(50).optional(),
  yearsExperienceMax: z.number().min(0).max(50).optional(),
  applicationDeadline: z.string().datetime().optional(),
  applicationEmail: z.string().email().optional(),
  applicationUrl: z.string().url().optional(),
  featured: z.boolean().default(false),
  urgent: z.boolean().default(false)
});

const jobUpdateSchema = jobCreateSchema.partial();

const jobSearchSchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  province: z.nativeEnum(Province).optional(),
  city: z.string().optional(),
  jobType: z.nativeEnum(JobType).optional(),
  experienceLevel: z.nativeEnum(ExperienceLevel).optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  isRemote: z.boolean().optional(),
  companyId: z.string().uuid().optional(),
  skills: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'salary', 'title', 'relevance']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export class JobController {
  private jobService = new JobService();

  /**
   * Get all jobs with filtering and pagination
   */
  getJobs = asyncHandler(async (req: Request, res: Response) => {
    const parsedFilters = jobSearchSchema.parse(req.query);
    
    const result = await this.jobService.searchJobs({
      query: parsedFilters.query,
      location: parsedFilters.location,
      province: parsedFilters.province,
      city: parsedFilters.city,
      jobType: parsedFilters.jobType,
      experienceLevel: parsedFilters.experienceLevel,
      salaryMin: parsedFilters.salaryMin,
      salaryMax: parsedFilters.salaryMax,
      isRemote: parsedFilters.isRemote,
      companyId: parsedFilters.companyId,
      skills: parsedFilters.skills,
      featured: parsedFilters.featured,
      page: parsedFilters.page,
      limit: parsedFilters.limit,
      sortBy: parsedFilters.sortBy,
      sortOrder: parsedFilters.sortOrder
    }, req.user?.id);
    
    res.json({
      success: true,
      data: result,
      message: 'Jobs retrieved successfully'
    });
  });

  /**
   * Get featured jobs
   */
  getFeaturedJobs = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const jobs = await this.jobService.getFeaturedJobs(limit);
    
    res.json({
      success: true,
      data: { jobs },
      message: 'Featured jobs retrieved successfully'
    });
  });

  /**
   * Get job by ID
   */
  getJobById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw new AppError(400, 'Job ID is required');
    }

    const job = await this.jobService.getJobById(id, req.user?.id);
    
    if (!job) {
      throw new AppError(404, 'Job not found');
    }

    // Track job view
    if (req.user?.id) {
      await this.jobService.trackJobView(id, req.user.id);
    }

    res.json({
      success: true,
      data: { job },
      message: 'Job retrieved successfully'
    });
  });

  /**
   * Create new job (Employer only)
   */
  createJob = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Only employers can create jobs');
    }

    const parsedData = jobCreateSchema.parse(req.body);
    
    // Verify company ownership for employers
    if (req.user.role === 'EMPLOYER') {
      const hasAccess = await this.jobService.verifyCompanyAccess(req.user.id, parsedData.companyId);
      if (!hasAccess) {
        throw new AppError(403, 'You do not have access to this company');
      }
    }

    const job = await this.jobService.createJob({
      title: parsedData.title,
      description: parsedData.description,
      requirements: parsedData.requirements,
      responsibilities: parsedData.responsibilities,
      companyId: parsedData.companyId,
      jobType: parsedData.jobType,
      experienceLevel: parsedData.experienceLevel,
      province: parsedData.province,
      city: parsedData.city,
      suburb: parsedData.suburb,
      isRemote: parsedData.isRemote,
      salaryMin: parsedData.salaryMin,
      salaryMax: parsedData.salaryMax,
      salaryCurrency: parsedData.salaryCurrency,
      salaryPeriod: parsedData.salaryPeriod,
      showSalary: parsedData.showSalary,
      requiredSkills: parsedData.requiredSkills,
      preferredSkills: parsedData.preferredSkills,
      education: parsedData.education,
      yearsExperienceMin: parsedData.yearsExperienceMin,
      yearsExperienceMax: parsedData.yearsExperienceMax,
      applicationDeadline: parsedData.applicationDeadline,
      applicationEmail: parsedData.applicationEmail,
      applicationUrl: parsedData.applicationUrl,
      featured: parsedData.featured,
      urgent: parsedData.urgent
    }, req.user.id);
    
    logger.info('Job created', { jobId: job.id, userId: req.user.id });

    res.status(201).json({
      success: true,
      data: { job },
      message: 'Job created successfully'
    });
  });

  /**
   * Update job (Employer only)
   */
  updateJob = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;
    const updates = jobUpdateSchema.parse(req.body);

    const job = await this.jobService.updateJob(id, updates, req.user.id);
    
    logger.info('Job updated', { jobId: id, userId: req.user.id });

    res.json({
      success: true,
      data: { job },
      message: 'Job updated successfully'
    });
  });

  /**
   * Delete job (Employer/Admin only)
   */
  deleteJob = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    await this.jobService.deleteJob(id, req.user.id);
    
    logger.info('Job deleted', { jobId: id, userId: req.user.id });

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  });

  /**
   * Get job recommendations for user
   */
  getRecommendations = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const minScore = parseFloat(req.query.minScore as string) || 0.6;

    const recommendations = await this.jobService.getJobRecommendations(
      req.user.id, 
      limit, 
      minScore
    );

    res.json({
      success: true,
      data: { recommendations },
      message: 'Job recommendations retrieved successfully'
    });
  });

  /**
   * Get AI-matched jobs based on user profile
   */
  getAIMatchedJobs = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { skills, experience, preferences, limit = 20 } = req.body;
    
    // Use AI to match jobs based on user profile
    const matchedJobs = await this.jobService.getAIMatchedJobs(
      req.user.id,
      {
        skills: skills || [],
        experience: experience || '',
        preferences: preferences || {},
        limit: Math.min(limit, 50)
      }
    );
    
    logger.info('AI job matching completed', { 
      userId: req.user.id,
      matchCount: matchedJobs.length
    });

    res.json({
      success: true,
      data: { 
        jobs: matchedJobs,
        count: matchedJobs.length
      },
      message: 'AI-matched jobs retrieved successfully'
    });
  });

  /**
   * Save/unsave job
   */
  toggleSaveJob = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;
    const { notes } = req.body;

    const result = await this.jobService.toggleSaveJob(req.user.id, id, notes);

    res.json({
      success: true,
      data: { saved: result.saved },
      message: result.saved ? 'Job saved successfully' : 'Job unsaved successfully'
    });
  });

  /**
   * Get user's saved jobs
   */
  getSavedJobs = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await this.jobService.getSavedJobs(req.user.id, page, limit);

    res.json({
      success: true,
      data: result,
      message: 'Saved jobs retrieved successfully'
    });
  });

  /**
   * Get job statistics
   */
  getJobStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.jobService.getJobStatistics();

    res.json({
      success: true,
      data: { stats },
      message: 'Job statistics retrieved successfully'
    });
  });

  /**
   * Search jobs with advanced filters
   */
  searchJobs = asyncHandler(async (req: Request, res: Response) => {
    const searchParams = jobSearchSchema.parse(req.query);
    
    const result = await this.jobService.searchJobs({
      query: searchParams.query,
      location: searchParams.location,
      province: searchParams.province,
      city: searchParams.city,
      jobType: searchParams.jobType,
      experienceLevel: searchParams.experienceLevel,
      salaryMin: searchParams.salaryMin,
      salaryMax: searchParams.salaryMax,
      isRemote: searchParams.isRemote,
      companyId: searchParams.companyId,
      skills: searchParams.skills,
      featured: searchParams.featured,
      page: searchParams.page,
      limit: searchParams.limit,
      sortBy: searchParams.sortBy,
      sortOrder: searchParams.sortOrder
    }, req.user?.id);
    
    res.json({
      success: true,
      data: result,
      message: 'Job search completed successfully'
    });
  });

  /**
   * Get jobs by company
   */
  getJobsByCompany = asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await this.jobService.getJobsByCompany(companyId, page, limit);

    res.json({
      success: true,
      data: result,
      message: 'Company jobs retrieved successfully'
    });
  });

  /**
   * Get trending jobs
   */
  getTrendingJobs = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const days = parseInt(req.query.days as string) || 7;

    const jobs = await this.jobService.getTrendingJobs(limit, days);

    res.json({
      success: true,
      data: { jobs },
      message: 'Trending jobs retrieved successfully'
    });
  });

  /**
   * Get jobs by location
   */
  getJobsByLocation = asyncHandler(async (req: Request, res: Response) => {
    const { province, city } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await this.jobService.getJobsByLocation(
      province as Province, 
      city, 
      page, 
      limit
    );

    res.json({
      success: true,
      data: result,
      message: 'Location-based jobs retrieved successfully'
    });
  });

  /**
   * Get employer's jobs
   */
  getEmployerJobs = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Access denied');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const result = await this.jobService.getEmployerJobs(req.user.id, page, limit, status);

    res.json({
      success: true,
      data: result,
      message: 'Employer jobs retrieved successfully'
    });
  });
}
