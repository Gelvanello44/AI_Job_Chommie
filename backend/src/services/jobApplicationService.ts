import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

// Validation schemas
export const jobApplicationSchema = z.object({
  jobId: z.string().uuid(),
  coverLetter: z.string().max(2000).optional(),
  expectedSalary: z.number().min(0).optional(),
  availableStartDate: z.string().datetime().optional(),
  portfolioUrl: z.string().url().optional(),
  additionalNotes: z.string().max(1000).optional(),
  attachments: z.array(z.string().uuid()).max(5).optional() // File IDs
});

export const applicationUpdateSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 
                  'INTERVIEWED', 'OFFER_MADE', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']).optional(),
  interviewDate: z.string().datetime().optional(),
  interviewLocation: z.string().max(500).optional(),
  interviewNotes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(500).optional(),
  offerDetails: z.object({
    salary: z.number().min(0).optional(),
    benefits: z.string().max(1000).optional(),
    startDate: z.string().datetime().optional(),
    offerExpiryDate: z.string().datetime().optional()
  }).optional()
});

export const applicationFilterSchema = z.object({
  status: z.array(z.enum(['PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 
                         'INTERVIEWED', 'OFFER_MADE', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'])).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  companyId: z.string().uuid().optional(),
  jobType: z.array(z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'REMOTE'])).optional(),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  location: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(10),
  sortBy: z.enum(['created_at', 'updated_at', 'status', 'salary', 'company']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

class JobApplicationService {
  /**
   * Apply for a job
   */
  async applyForJob(userId: string, applicationData: z.infer<typeof jobApplicationSchema>) {
    try {
      const validatedData = jobApplicationSchema.parse(applicationData);

      // Check if job exists and is active
      const job = await prisma.job.findUnique({
        where: { id: validatedData.jobId },
        include: { company: { select: { name: true, id: true } } }
      });

      if (!job) {
        throw new AppError(404, 'Job not found', 'JOB_NOT_FOUND');
      }

      if (job.status !== 'ACTIVE') {
        throw new AppError(400, 'Job is no longer accepting applications', 'JOB_INACTIVE');
      }

      if (job.applicationDeadline && new Date() > job.applicationDeadline) {
        throw new AppError(400, 'Application deadline has passed', 'DEADLINE_PASSED');
      }

      // Check if user has already applied
      const existingApplication = await prisma.jobApplication.findUnique({
        where: {
          userId_jobId: {
            userId,
            jobId: validatedData.jobId
          }
        }
      });

      if (existingApplication) {
        throw new AppError(409, 'You have already applied for this job', 'DUPLICATE_APPLICATION');
      }

      // Check user's application limits (based on subscription)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          subscriptionPlan: true, 
          creditsRemaining: true,
          monthlyQuota: true
        }
      });

      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      }

      // Check application quota
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const applicationCount = await prisma.jobApplication.count({
        where: {
          userId,
          createdAt: { gte: currentMonth }
        }
      });

      const maxApplications = user.monthlyQuota || 10;
      if (applicationCount >= maxApplications) {
        throw new AppError(429, `Monthly application limit (${maxApplications}) reached`, 'QUOTA_EXCEEDED');
      }

      // Create application
      const application = await prisma.jobApplication.create({
        data: {
          ...validatedData,
          userId,
          status: 'PENDING',
          availableStartDate: validatedData.availableStartDate ? new Date(validatedData.availableStartDate) : undefined
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              company: {
                select: {
                  id: true,
                  name: true,
                  logo: true
                }
              },
              location: true,
              salary: true,
              jobType: true
            }
          }
        }
      });

      // Update user credits if applicable
      if (user.creditsRemaining && user.creditsRemaining > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { creditsRemaining: { decrement: 1 } }
        });
      }

      // Log application activity
      await this.logApplicationActivity(userId, application.id, 'applied', {
        jobId: validatedData.jobId,
        jobTitle: job.title,
        companyName: job.company.name
      });

      logger.info('Job application submitted', { 
        userId, 
        jobId: validatedData.jobId, 
        applicationId: application.id 
      });

      return this.transformApplication(application);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid application data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Apply for job failed', { error, userId });
      throw new AppError(500, 'Failed to submit job application', 'APPLICATION_ERROR');
    }
  }

  /**
   * Get user's job applications with filtering and pagination
   */
  async getUserApplications(userId: string, filters: z.infer<typeof applicationFilterSchema>) {
    try {
      const validatedFilters = applicationFilterSchema.parse(filters);
      const { page, limit, sortBy, sortOrder, ...filterParams } = validatedFilters;

      const skip = (page - 1) * limit;

      // Build filter conditions
      const where: any = { userId };

      if (filterParams.status && filterParams.status.length > 0) {
        where.status = { in: filterParams.status };
      }

      if (filterParams.dateFrom || filterParams.dateTo) {
        where.createdAt = {};
        if (filterParams.dateFrom) where.createdAt.gte = new Date(filterParams.dateFrom);
        if (filterParams.dateTo) where.createdAt.lte = new Date(filterParams.dateTo);
      }

      if (filterParams.companyId) {
        where.job = { companyId: filterParams.companyId };
      }

      if (filterParams.jobType && filterParams.jobType.length > 0) {
        where.job = { ...where.job, jobType: { in: filterParams.jobType } };
      }

      if (filterParams.salaryMin || filterParams.salaryMax) {
        where.job = { ...where.job };
        if (filterParams.salaryMin) where.job.salaryMin = { gte: filterParams.salaryMin };
        if (filterParams.salaryMax) where.job.salaryMax = { lte: filterParams.salaryMax };
      }

      if (filterParams.location) {
        where.job = { 
          ...where.job,
          OR: [
            { location: { contains: filterParams.location, mode: 'insensitive' } },
            { city: { contains: filterParams.location, mode: 'insensitive' } },
            { province: { contains: filterParams.location, mode: 'insensitive' } }
          ]
        };
      }

      // Build sort order
      const orderBy: any = {};
      switch (sortBy) {
        case 'created_at':
          orderBy.createdAt = sortOrder;
          break;
        case 'updated_at':
          orderBy.updatedAt = sortOrder;
          break;
        case 'status':
          orderBy.status = sortOrder;
          break;
        case 'salary':
          orderBy.job = { salaryMax: sortOrder };
          break;
        case 'company':
          orderBy.job = { company: { name: sortOrder } };
          break;
        default:
          orderBy.createdAt = 'desc';
      }

      const [applications, total] = await Promise.all([
        prisma.jobApplication.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            job: {
              include: {
                company: {
                  select: {
                    id: true,
                    name: true,
                    logo: true,
                    industry: true,
                    verified: true
                  }
                }
              }
            }
          }
        }),
        prisma.jobApplication.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        applications: applications.map(app => this.transformApplication(app)),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage,
          hasPrevPage
        },
        filters: validatedFilters
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid filter parameters', 'VALIDATION_ERROR', error.errors);
      }
      logger.error('Get user applications failed', { error, userId });
      throw new AppError(500, 'Failed to retrieve applications', 'APPLICATIONS_RETRIEVAL_ERROR');
    }
  }

  /**
   * Get specific application details
   */
  async getApplicationById(userId: string, applicationId: string) {
    try {
      const application = await prisma.jobApplication.findUnique({
        where: { id: applicationId },
        include: {
          job: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                  industry: true,
                  verified: true,
                  description: true,
                  website: true
                }
              }
            }
          },
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 20
          }
        }
      });

      if (!application) {
        throw new AppError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
      }

      // Check if user owns this application
      if (application.userId !== userId) {
        throw new AppError(403, 'Access denied', 'ACCESS_DENIED');
      }

      return this.transformDetailedApplication(application);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get application by ID failed', { error, userId, applicationId });
      throw new AppError(500, 'Failed to retrieve application', 'APPLICATION_RETRIEVAL_ERROR');
    }
  }

  /**
   * Withdraw job application
   */
  async withdrawApplication(userId: string, applicationId: string, reason?: string) {
    try {
      const application = await prisma.jobApplication.findUnique({
        where: { id: applicationId },
        include: { job: { select: { title: true, company: { select: { name: true } } } } }
      });

      if (!application) {
        throw new AppError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
      }

      if (application.userId !== userId) {
        throw new AppError(403, 'Access denied', 'ACCESS_DENIED');
      }

      if (application.status === 'WITHDRAWN') {
        throw new AppError(400, 'Application already withdrawn', 'ALREADY_WITHDRAWN');
      }

      if (['ACCEPTED', 'REJECTED'].includes(application.status)) {
        throw new AppError(400, 'Cannot withdraw application with current status', 'INVALID_STATUS');
      }

      const updatedApplication = await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { 
          status: 'WITHDRAWN',
          rejectionReason: reason || 'Withdrawn by candidate'
        },
        include: {
          job: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  logo: true
                }
              }
            }
          }
        }
      });

      // Log withdrawal activity
      await this.logApplicationActivity(userId, applicationId, 'withdrawn', {
        reason,
        jobTitle: application.job.title,
        companyName: application.job.company.name
      });

      logger.info('Application withdrawn', { userId, applicationId, reason });

      return this.transformApplication(updatedApplication);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Withdraw application failed', { error, userId, applicationId });
      throw new AppError(500, 'Failed to withdraw application', 'WITHDRAWAL_ERROR');
    }
  }

  /**
   * Get application statistics for user
   */
  async getApplicationStats(userId: string) {
    try {
      const [
        totalApplications,
        statusCounts,
        recentApplications,
        monthlyStats
      ] = await Promise.all([
        prisma.jobApplication.count({ where: { userId } }),
        prisma.jobApplication.groupBy({
          by: ['status'],
          where: { userId },
          _count: true
        }),
        prisma.jobApplication.count({
          where: {
            userId,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        }),
        this.getMonthlyApplicationStats(userId)
      ]);

      const statusBreakdown = statusCounts.reduce((acc: any, item) => {
        acc[item.status.toLowerCase()] = item._count;
        return acc;
      }, {});

      return {
        total: totalApplications,
        recent: recentApplications,
        statusBreakdown,
        monthlyStats,
        successRate: statusCounts.find(s => s.status === 'ACCEPTED')?._count || 0,
        responseRate: statusCounts.filter(s => !['PENDING', 'REVIEWING'].includes(s.status))
          .reduce((sum, s) => sum + s._count, 0)
      };
    } catch (error) {
      logger.error('Get application stats failed', { error, userId });
      throw new AppError(500, 'Failed to retrieve application statistics', 'STATS_ERROR');
    }
  }

  /**
   * Get monthly application statistics
   */
  private async getMonthlyApplicationStats(userId: string) {
    const currentDate = new Date();
    const sixMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1);

    const monthlyData = await prisma.jobApplication.groupBy({
      by: ['createdAt'],
      where: {
        userId,
        createdAt: { gte: sixMonthsAgo }
      },
      _count: true
    });

    // Process data to get monthly counts
    const monthlyStats = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const count = monthlyData.filter(item => {
        const itemDate = new Date(item.createdAt);
        return itemDate.getFullYear() === date.getFullYear() && 
               itemDate.getMonth() === date.getMonth();
      }).reduce((sum, item) => sum + item._count, 0);

      monthlyStats.push({
        month: monthKey,
        applications: count
      });
    }

    return monthlyStats;
  }

  /**
   * Log application activity
   */
  private async logApplicationActivity(userId: string, applicationId: string, action: string, metadata: any = {}) {
    try {
      await prisma.applicationActivity.create({
        data: {
          applicationId,
          action,
          metadata,
          performedBy: userId,
          performedAt: new Date()
        }
      });
    } catch (error) {
      logger.warn('Failed to log application activity', { error, userId, applicationId, action });
    }
  }

  /**
   * Transform application for API response
   */
  private transformApplication(application: any) {
    return {
      id: application.id,
      status: application.status,
      coverLetter: application.coverLetter,
      expectedSalary: application.expectedSalary,
      availableStartDate: application.availableStartDate?.toISOString(),
      portfolioUrl: application.portfolioUrl,
      additionalNotes: application.additionalNotes,
      interviewDate: application.interviewDate?.toISOString(),
      interviewLocation: application.interviewLocation,
      job: {
        id: application.job.id,
        title: application.job.title,
        location: application.job.location,
        city: application.job.city,
        province: application.job.province,
        salary: application.job.salary,
        salaryMin: application.job.salaryMin,
        salaryMax: application.job.salaryMax,
        jobType: application.job.jobType,
        company: application.job.company
      },
      appliedAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString()
    };
  }

  /**
   * Transform detailed application for API response
   */
  private transformDetailedApplication(application: any) {
    return {
      ...this.transformApplication(application),
      interviewNotes: application.interviewNotes,
      rejectionReason: application.rejectionReason,
      offerDetails: application.offerDetails,
      activities: application.activities?.map((activity: any) => ({
        id: activity.id,
        action: activity.action,
        metadata: activity.metadata,
        performedAt: activity.performedAt.toISOString()
      })) || []
    };
  }
}

export default new JobApplicationService();
