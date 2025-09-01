import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

// Validation schemas
export const jobCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(50).max(10000),
  requirements: z.array(z.string()).max(20).optional(),
  benefits: z.array(z.string()).max(15).optional(),
  responsibilities: z.array(z.string()).max(20).optional(),
  qualifications: z.array(z.string()).max(15).optional(),
  location: z.string().max(200),
  city: z.string().max(100).optional(),
  province: z.enum([
    'EASTERN_CAPE', 'FREE_STATE', 'GAUTENG', 'KWAZULU_NATAL',
    'LIMPOPO', 'MPUMALANGA', 'NORTHERN_CAPE', 'NORTH_WEST', 'WESTERN_CAPE'
  ]).optional(),
  isRemote: z.boolean().default(false),
  jobType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'REMOTE']),
  experienceLevel: z.enum(['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'EXECUTIVE']),
  industry: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  salary: z.string().max(100).optional(),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  salaryFrequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'ANNUALLY']).optional(),
  currency: z.string().length(3).default('ZAR'),
  skills: z.array(z.string()).max(30).optional(),
  applicationDeadline: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  workingHours: z.string().max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().regex(/^(?:\+27|0)[1-9]\d{8}$/).optional(),
  applicationInstructions: z.string().max(1000).optional()
});

export const jobUpdateSchema = jobCreateSchema.partial();

export const jobFilterSchema = z.object({
  status: z.array(z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED'])).optional(),
  companyId: z.string().uuid().optional(),
  postedBy: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(10),
  sortBy: z.enum(['created_at', 'updated_at', 'title', 'applications_count', 'salary']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

class JobManagementService {
  /**
   * Create a new job posting
   */
  async createJob(userId: string, companyId: string, jobData: z.infer<typeof jobCreateSchema>) {
    try {
      const validatedData = jobCreateSchema.parse(jobData);

      // Check if user has permission to post jobs for this company
      const employerProfile = await prisma.employerProfile.findFirst({
        where: { userId, companyId }
      });

      if (!employerProfile) {
        throw new AppError(403, 'Access denied - not associated with this company', 'ACCESS_DENIED');
      }

      if (!employerProfile.canPostJobs) {
        throw new AppError(403, 'Access denied - no permission to post jobs', 'INSUFFICIENT_PERMISSIONS');
      }

      // Validate salary range
      if (validatedData.salaryMin && validatedData.salaryMax) {
        if (validatedData.salaryMin > validatedData.salaryMax) {
          throw new AppError(400, 'Minimum salary cannot be greater than maximum salary', 'INVALID_SALARY_RANGE');
        }
      }

      // Process skills
      let skillIds: string[] = [];
      if (validatedData.skills && validatedData.skills.length > 0) {
        skillIds = await this.processJobSkills(validatedData.skills);
      }

      const job = await prisma.job.create({
        data: {
          ...validatedData,
          companyId,
          postedBy: userId,
          status: 'DRAFT', // Start as draft
          applicationDeadline: validatedData.applicationDeadline ? 
            new Date(validatedData.applicationDeadline) : undefined,
          startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
          postedAt: new Date(),
          skills: skillIds.length > 0 ? {
            connect: skillIds.map(id => ({ id }))
          } : undefined
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              verified: true
            }
          },
          skills: {
            select: {
              id: true,
              name: true,
              category: true
            }
          },
          postedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      logger.info('Job created', { userId, jobId: job.id, companyId });

      return this.transformJob(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid job data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Create job failed', { error, userId, companyId });
      throw new AppError(500, 'Failed to create job', 'JOB_CREATE_ERROR');
    }
  }

  /**
   * Update existing job
   */
  async updateJob(userId: string, jobId: string, jobData: z.infer<typeof jobUpdateSchema>) {
    try {
      const validatedData = jobUpdateSchema.parse(jobData);

      // Check if job exists and user has permission
      const existingJob = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          company: {
            include: {
              employerProfiles: {
                where: { userId }
              }
            }
          }
        }
      });

      if (!existingJob) {
        throw new AppError(404, 'Job not found', 'JOB_NOT_FOUND');
      }

      const employerProfile = existingJob.company.employerProfiles[0];
      if (!employerProfile || !employerProfile.canPostJobs) {
        throw new AppError(403, 'Access denied', 'ACCESS_DENIED');
      }

      // Validate salary range
      if (validatedData.salaryMin && validatedData.salaryMax) {
        if (validatedData.salaryMin > validatedData.salaryMax) {
          throw new AppError(400, 'Minimum salary cannot be greater than maximum salary', 'INVALID_SALARY_RANGE');
        }
      }

      // Process skills if provided
      let skillConnections = undefined;
      if (validatedData.skills) {
        const skillIds = await this.processJobSkills(validatedData.skills);
        skillConnections = {
          set: skillIds.map(id => ({ id }))
        };
      }

      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          ...validatedData,
          applicationDeadline: validatedData.applicationDeadline ? 
            new Date(validatedData.applicationDeadline) : undefined,
          startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
          skills: skillConnections
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              verified: true
            }
          },
          skills: {
            select: {
              id: true,
              name: true,
              category: true
            }
          },
          _count: {
            select: { applications: true }
          }
        }
      });

      logger.info('Job updated', { userId, jobId });

      return this.transformJob(updatedJob);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid job data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Update job failed', { error, userId, jobId });
      throw new AppError(500, 'Failed to update job', 'JOB_UPDATE_ERROR');
    }
  }

  /**
   * Publish a draft job
   */
  async publishJob(userId: string, jobId: string) {
    try {
      const job = await this.getJobWithPermissions(userId, jobId);

      if (job.status === 'ACTIVE') {
        throw new AppError(400, 'Job is already published', 'JOB_ALREADY_PUBLISHED');
      }

      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: { 
          status: 'ACTIVE',
          postedAt: new Date()
        },
        include: {
          company: { select: { id: true, name: true, logo: true } },
          skills: { select: { id: true, name: true } }
        }
      });

      logger.info('Job published', { userId, jobId });

      return this.transformJob(updatedJob);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Publish job failed', { error, userId, jobId });
      throw new AppError(500, 'Failed to publish job', 'JOB_PUBLISH_ERROR');
    }
  }

  /**
   * Deactivate a job
   */
  async deactivateJob(userId: string, jobId: string) {
    try {
      const job = await this.getJobWithPermissions(userId, jobId);

      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: { status: 'INACTIVE' },
        include: {
          company: { select: { id: true, name: true, logo: true } },
          _count: { select: { applications: true } }
        }
      });

      logger.info('Job deactivated', { userId, jobId });

      return this.transformJob(updatedJob);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Deactivate job failed', { error, userId, jobId });
      throw new AppError(500, 'Failed to deactivate job', 'JOB_DEACTIVATE_ERROR');
    }
  }

  /**
   * Delete a job
   */
  async deleteJob(userId: string, jobId: string) {
    try {
      const job = await this.getJobWithPermissions(userId, jobId);

      // Check if job has applications
      const applicationCount = await prisma.jobApplication.count({
        where: { jobId }
      });

      if (applicationCount > 0) {
        throw new AppError(400, 'Cannot delete job with applications. Deactivate instead.', 'JOB_HAS_APPLICATIONS');
      }

      await prisma.job.delete({
        where: { id: jobId }
      });

      logger.info('Job deleted', { userId, jobId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Delete job failed', { error, userId, jobId });
      throw new AppError(500, 'Failed to delete job', 'JOB_DELETE_ERROR');
    }
  }

  /**
   * Get company jobs with filtering
   */
  async getCompanyJobs(userId: string, companyId: string, filters: z.infer<typeof jobFilterSchema>) {
    try {
      // Check if user has access to this company
      const employerProfile = await prisma.employerProfile.findFirst({
        where: { userId, companyId }
      });

      if (!employerProfile) {
        throw new AppError(403, 'Access denied', 'ACCESS_DENIED');
      }

      const validatedFilters = jobFilterSchema.parse(filters);
      const { page, limit, sortBy, sortOrder, ...filterParams } = validatedFilters;

      const skip = (page - 1) * limit;

      // Build filter conditions
      const where: any = { companyId };

      if (filterParams.status && filterParams.status.length > 0) {
        where.status = { in: filterParams.status };
      }

      if (filterParams.postedBy) {
        where.postedBy = filterParams.postedBy;
      }

      if (filterParams.dateFrom || filterParams.dateTo) {
        where.createdAt = {};
        if (filterParams.dateFrom) where.createdAt.gte = new Date(filterParams.dateFrom);
        if (filterParams.dateTo) where.createdAt.lte = new Date(filterParams.dateTo);
      }

      if (filterParams.search) {
        where.OR = [
          { title: { contains: filterParams.search, mode: 'insensitive' } },
          { description: { contains: filterParams.search, mode: 'insensitive' } },
          { location: { contains: filterParams.search, mode: 'insensitive' } }
        ];
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
        case 'title':
          orderBy.title = sortOrder;
          break;
        case 'applications_count':
          orderBy.applications = { _count: sortOrder };
          break;
        case 'salary':
          orderBy.salaryMax = sortOrder;
          break;
        default:
          orderBy.createdAt = 'desc';
      }

      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            company: {
              select: {
                id: true,
                name: true,
                logo: true
              }
            },
            skills: {
              select: {
                id: true,
                name: true,
                category: true
              }
            },
            postedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
            _count: {
              select: { applications: true }
            }
          }
        }),
        prisma.job.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        jobs: jobs.map(job => this.transformJob(job)),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: validatedFilters
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid filter parameters', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Get company jobs failed', { error, userId, companyId });
      throw new AppError(500, 'Failed to retrieve company jobs', 'JOBS_RETRIEVAL_ERROR');
    }
  }

  /**
   * Get job details
   */
  async getJobById(jobId: string, userId?: string) {
    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              verified: true,
              description: true,
              website: true,
              industry: true,
              size: true
            }
          },
          skills: {
            select: {
              id: true,
              name: true,
              category: true,
              isInDemand: true
            }
          },
          postedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: { applications: true }
          }
        }
      });

      if (!job) {
        throw new AppError(404, 'Job not found', 'JOB_NOT_FOUND');
      }

      // Check if user has already applied (if user is provided)
      let hasApplied = false;
      if (userId) {
        const application = await prisma.jobApplication.findUnique({
          where: {
            userId_jobId: { userId, jobId }
          }
        });
        hasApplied = !!application;
      }

      return {
        ...this.transformJob(job),
        hasApplied,
        applicationsCount: job._count.applications
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get job by ID failed', { error, jobId });
      throw new AppError(500, 'Failed to retrieve job', 'JOB_RETRIEVAL_ERROR');
    }
  }

  /**
   * Get job applications for a specific job
   */
  async getJobApplications(userId: string, jobId: string, page: number = 1, limit: number = 10) {
    try {
      // Check if user has permission to view applications
      const job = await this.getJobWithPermissions(userId, jobId);

      const skip = (page - 1) * limit;

      const [applications, total] = await Promise.all([
        prisma.jobApplication.findMany({
          where: { jobId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profilePicture: true,
                phone: true
              }
            }
          }
        }),
        prisma.jobApplication.count({ where: { jobId } })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        applications: applications.map(app => ({
          id: app.id,
          status: app.status,
          coverLetter: app.coverLetter,
          expectedSalary: app.expectedSalary,
          appliedAt: app.createdAt.toISOString(),
          candidate: {
            id: app.user.id,
            firstName: app.user.firstName,
            lastName: app.user.lastName,
            email: app.user.email,
            profilePicture: app.user.profilePicture,
            phone: app.user.phone
          }
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get job applications failed', { error, userId, jobId });
      throw new AppError(500, 'Failed to retrieve job applications', 'APPLICATIONS_RETRIEVAL_ERROR');
    }
  }

  /**
   * Process job skills (find or create)
   */
  private async processJobSkills(skillNames: string[]): Promise<string[]> {
    const skillIds: string[] = [];

    for (const skillName of skillNames) {
      let skill = await prisma.skill.findFirst({
        where: { name: { equals: skillName.trim(), mode: 'insensitive' } }
      });

      if (!skill) {
        skill = await prisma.skill.create({
          data: { name: skillName.trim() }
        });
      }

      skillIds.push(skill.id);
    }

    return skillIds;
  }

  /**
   * Get job with permission check
   */
  private async getJobWithPermissions(userId: string, jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: {
          include: {
            employerProfiles: {
              where: { userId }
            }
          }
        }
      }
    });

    if (!job) {
      throw new AppError(404, 'Job not found', 'JOB_NOT_FOUND');
    }

    const employerProfile = job.company.employerProfiles[0];
    if (!employerProfile) {
      throw new AppError(403, 'Access denied', 'ACCESS_DENIED');
    }

    return job;
  }

  /**
   * Transform job for API response
   */
  private transformJob(job: any) {
    return {
      id: job.id,
      title: job.title,
      description: job.description,
      requirements: job.requirements || [],
      benefits: job.benefits || [],
      responsibilities: job.responsibilities || [],
      qualifications: job.qualifications || [],
      location: job.location,
      city: job.city,
      province: job.province,
      isRemote: job.isRemote,
      jobType: job.jobType,
      experienceLevel: job.experienceLevel,
      industry: job.industry,
      department: job.department,
      salary: job.salary,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryFrequency: job.salaryFrequency,
      currency: job.currency,
      workingHours: job.workingHours,
      contactEmail: job.contactEmail,
      contactPhone: job.contactPhone,
      applicationInstructions: job.applicationInstructions,
      status: job.status,
      company: job.company,
      skills: job.skills || [],
      postedBy: job.postedByUser,
      applicationsCount: job._count?.applications || 0,
      postedAt: job.postedAt?.toISOString(),
      applicationDeadline: job.applicationDeadline?.toISOString(),
      startDate: job.startDate?.toISOString(),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString()
    };
  }
}

export default new JobManagementService();
