import { Job, JobType, ExperienceLevel, Province, Prisma, User } from '@prisma/client';
import { prisma } from '../config/database.js';
import { cache } from '../config/redis.js';
import { AppError } from '../middleware/errorHandler.js';
import { AIMatchingService } from './ai-matching.service.js';
import logger from '../config/logger.js';

interface JobSearchFilters {
  query?: string;
  location?: string;
  province?: Province;
  city?: string;
  jobType?: JobType;
  experienceLevel?: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
  isRemote?: boolean;
  companyId?: string;
  skills?: string[];
  featured?: boolean;
  page: number;
  limit: number;
  sortBy: 'createdAt' | 'salary' | 'title' | 'relevance';
  sortOrder: 'asc' | 'desc';
}

interface JobCreateData {
  title: string;
  description: string;
  requirements: string;
  responsibilities: string;
  companyId: string;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  province: Province;
  city: string;
  suburb?: string;
  isRemote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  salaryPeriod: string;
  showSalary: boolean;
  requiredSkills: string[];
  preferredSkills: string[];
  education?: string;
  yearsExperienceMin?: number;
  yearsExperienceMax?: number;
  applicationDeadline?: string;
  applicationEmail?: string;
  applicationUrl?: string;
  featured: boolean;
  urgent: boolean;
}

interface JobWithDetails extends Job {
  company: {
    id: string;
    name: string;
    logo: string | null;
    industry: string;
    province: Province;
    city: string;
  };
  _count: {
    jobApplications: number;
  };
  isSaved?: boolean;
  matchScore?: number;
}

export class JobService {
  private aiMatchingService = new AIMatchingService();

  /**
   * Search jobs with advanced filtering
   */
  async searchJobs(filters: JobSearchFilters, userId?: string) {
    try {
      const { page, limit, sortBy, sortOrder, ...searchFilters } = filters;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Prisma.JobWhereInput = {
        active: true,
        ...(searchFilters.query && {
          OR: [
            { title: { contains: searchFilters.query, mode: 'insensitive' } },
            { description: { contains: searchFilters.query, mode: 'insensitive' } },
            { requirements: { contains: searchFilters.query, mode: 'insensitive' } },
            { company: { name: { contains: searchFilters.query, mode: 'insensitive' } } }
          ]
        }),
        ...(searchFilters.province && { province: searchFilters.province }),
        ...(searchFilters.city && { city: { contains: searchFilters.city, mode: 'insensitive' } }),
        ...(searchFilters.jobType && { jobType: searchFilters.jobType }),
        ...(searchFilters.experienceLevel && { experienceLevel: searchFilters.experienceLevel }),
        ...(searchFilters.isRemote !== undefined && { isRemote: searchFilters.isRemote }),
        ...(searchFilters.companyId && { companyId: searchFilters.companyId }),
        ...(searchFilters.featured !== undefined && { featured: searchFilters.featured }),
        ...(searchFilters.salaryMin && { salaryMin: { gte: searchFilters.salaryMin } }),
        ...(searchFilters.salaryMax && { salaryMax: { lte: searchFilters.salaryMax } }),
        ...(searchFilters.skills?.length && {
          OR: [
            { requiredSkills: { hasSome: searchFilters.skills } },
            { preferredSkills: { hasSome: searchFilters.skills } }
          ]
        })
      };

      // Build order by clause
      const orderBy: Prisma.JobOrderByWithRelationInput = {};
      if (sortBy === 'salary') {
        orderBy.salaryMax = sortOrder;
      } else if (sortBy === 'title') {
        orderBy.title = sortOrder;
      } else {
        orderBy.createdAt = sortOrder;
      }

      // Execute query
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
                logo: true,
                industry: true,
                province: true,
                city: true
              }
            },
            _count: {
              select: {
                jobApplications: true
              }
            },
            ...(userId && {
              savedByUsers: {
                where: { userId },
                select: { id: true }
              }
            })
          }
        }),
        prisma.job.count({ where })
      ]);

      // Add saved status and match scores for authenticated users
      const jobsWithDetails = await Promise.all(
        jobs.map(async (job) => {
          const jobWithDetails: any = {
            ...job,
            isSaved: userId ? job.savedByUsers?.length > 0 : false
          };

          // Remove savedByUsers from response
          delete jobWithDetails.savedByUsers;

          // Add match score if user is authenticated
          if (userId && sortBy === 'relevance') {
            const matchScore = await this.getJobMatchScore(userId, job.id);
            jobWithDetails.matchScore = matchScore;
          }

          return jobWithDetails;
        })
      );

      // Sort by relevance if specified
      if (sortBy === 'relevance' && userId) {
        jobsWithDetails.sort((a, b) => {
          const scoreA = a.matchScore || 0;
          const scoreB = b.matchScore || 0;
          return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
        });
      }

      return {
        jobs: jobsWithDetails,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        filters: searchFilters
      };
    } catch (error) {
      logger.error('Error searching jobs', { error, filters });
      throw new AppError(500, 'Failed to search jobs');
    }
  }

  /**
   * Get job by ID with full details
   */
  async getJobById(jobId: string, userId?: string): Promise<JobWithDetails | null> {
    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId, active: true },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              province: true,
              city: true,
              website: true,
              description: true,
              size: true,
              founded: true
            }
          },
          _count: {
            select: {
              jobApplications: true
            }
          },
          ...(userId && {
            savedByUsers: {
              where: { userId },
              select: { id: true, notes: true }
            },
            jobApplications: {
              where: { userId },
              select: { id: true, status: true, createdAt: true }
            }
          })
        }
      });

      if (!job) return null;

      // Increment view count
      await prisma.job.update({
        where: { id: jobId },
        data: { views: { increment: 1 } }
      });

      const jobWithDetails: any = {
        ...job,
        isSaved: userId ? job.savedByUsers?.length > 0 : false,
        hasApplied: userId ? job.jobApplications?.length > 0 : false,
        savedNotes: userId && job.savedByUsers?.length > 0 ? job.savedByUsers[0].notes : null,
        applicationStatus: userId && job.jobApplications?.length > 0 ? job.jobApplications[0].status : null
      };

      // Remove internal fields
      delete jobWithDetails.savedByUsers;
      delete jobWithDetails.jobApplications;

      // Add match score for authenticated users
      if (userId) {
        jobWithDetails.matchScore = await this.getJobMatchScore(userId, jobId);
      }

      return jobWithDetails;
    } catch (error) {
      logger.error('Error getting job by ID', { error, jobId });
      throw new AppError(500, 'Failed to retrieve job');
    }
  }

  /**
   * Create new job
   */
  async createJob(data: JobCreateData, createdBy: string): Promise<Job> {
    try {
      // Verify company exists
      const company = await prisma.company.findUnique({
        where: { id: data.companyId }
      });

      if (!company) {
        throw new AppError(404, 'Company not found');
      }

      const job = await prisma.job.create({
        data: {
          ...data,
          applicationDeadline: data.applicationDeadline ? new Date(data.applicationDeadline) : null,
          publishedAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days from now
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              province: true,
              city: true
            }
          }
        }
      });

      // Log activity
      await this.logActivity(createdBy, 'job_create', 'job', job.id);

      logger.info('Job created successfully', { jobId: job.id, createdBy });

      return job;
    } catch (error) {
      logger.error('Error creating job', { error, data });
      throw error instanceof AppError ? error : new AppError(500, 'Failed to create job');
    }
  }

  /**
   * Update job
   */
  async updateJob(jobId: string, updates: Partial<JobCreateData>, userId: string): Promise<Job> {
    try {
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
        throw new AppError(404, 'Job not found');
      }

      // Check permission (employer must own the company or be admin)
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN' && existingJob.company.employerProfiles.length === 0) {
        throw new AppError(403, 'You do not have permission to update this job');
      }

      const job = await prisma.job.update({
        where: { id: jobId },
        data: {
          ...updates,
          applicationDeadline: updates.applicationDeadline ? new Date(updates.applicationDeadline) : undefined,
          updatedAt: new Date()
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              province: true,
              city: true
            }
          }
        }
      });

      // Log activity
      await this.logActivity(userId, 'job_update', 'job', jobId);

      logger.info('Job updated successfully', { jobId, userId });

      return job;
    } catch (error) {
      logger.error('Error updating job', { error, jobId, userId });
      throw error instanceof AppError ? error : new AppError(500, 'Failed to update job');
    }
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string, userId: string): Promise<void> {
    try {
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
        throw new AppError(404, 'Job not found');
      }

      // Check permission
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== 'ADMIN' && existingJob.company.employerProfiles.length === 0) {
        throw new AppError(403, 'You do not have permission to delete this job');
      }

      // Soft delete by setting active to false
      await prisma.job.update({
        where: { id: jobId },
        data: { active: false }
      });

      // Log activity
      await this.logActivity(userId, 'job_delete', 'job', jobId);

      logger.info('Job deleted successfully', { jobId, userId });
    } catch (error) {
      logger.error('Error deleting job', { error, jobId, userId });
      throw error instanceof AppError ? error : new AppError(500, 'Failed to delete job');
    }
  }

  /**
   * Get featured jobs
   */
  async getFeaturedJobs(limit: number = 10): Promise<JobWithDetails[]> {
    try {
      const cacheKey = `featured_jobs:${limit}`;
      const cached = await cache.get<JobWithDetails[]>(cacheKey);

      if (cached) {
        return cached;
      }

      const jobs = await prisma.job.findMany({
        where: {
          active: true,
          featured: true
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              province: true,
              city: true
            }
          },
          _count: {
            select: {
              jobApplications: true
            }
          }
        }
      }) as JobWithDetails[];

      // Cache for 30 minutes
      await cache.set(cacheKey, jobs, 1800);

      return jobs;
    } catch (error) {
      logger.error('Error getting featured jobs', { error });
      throw new AppError(500, 'Failed to retrieve featured jobs');
    }
  }

  /**
   * Get trending jobs (most viewed/applied in recent days)
   */
  async getTrendingJobs(limit: number = 10, days: number = 7): Promise<JobWithDetails[]> {
    try {
      const cacheKey = `trending_jobs:${limit}:${days}`;
      const cached = await cache.get<JobWithDetails[]>(cacheKey);

      if (cached) {
        return cached;
      }

      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const jobs = await prisma.job.findMany({
        where: {
          active: true,
          createdAt: { gte: dateFrom }
        },
        take: limit,
        orderBy: [
          { views: 'desc' },
          { applications: 'desc' },
          { createdAt: 'desc' }
        ],
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              province: true,
              city: true
            }
          },
          _count: {
            select: {
              jobApplications: true
            }
          }
        }
      }) as JobWithDetails[];

      // Cache for 1 hour
      await cache.set(cacheKey, jobs, 3600);

      return jobs;
    } catch (error) {
      logger.error('Error getting trending jobs', { error });
      throw new AppError(500, 'Failed to retrieve trending jobs');
    }
  }

  /**
   * Get jobs by company
   */
  async getJobsByCompany(companyId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;

      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where: {
            companyId,
            active: true
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            company: {
              select: {
                id: true,
                name: true,
                logo: true,
                industry: true,
                province: true,
                city: true
              }
            },
            _count: {
              select: {
                jobApplications: true
              }
            }
          }
        }),
        prisma.job.count({
          where: {
            companyId,
            active: true
          }
        })
      ]);

      return {
        jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting jobs by company', { error, companyId });
      throw new AppError(500, 'Failed to retrieve company jobs');
    }
  }

  /**
   * Get jobs by location
   */
  async getJobsByLocation(province: Province, city: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;

      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where: {
            province,
            city: { contains: city, mode: 'insensitive' },
            active: true
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            company: {
              select: {
                id: true,
                name: true,
                logo: true,
                industry: true,
                province: true,
                city: true
              }
            },
            _count: {
              select: {
                jobApplications: true
              }
            }
          }
        }),
        prisma.job.count({
          where: {
            province,
            city: { contains: city, mode: 'insensitive' },
            active: true
          }
        })
      ]);

      return {
        jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting jobs by location', { error, province, city });
      throw new AppError(500, 'Failed to retrieve location jobs');
    }
  }

  /**
   * Get job recommendations using AI
   */
  async getJobRecommendations(userId: string, limit: number = 10, minScore: number = 0.6) {
    try {
      return await this.aiMatchingService.getJobRecommendations(userId, limit, minScore);
    } catch (error) {
      logger.error('Error getting job recommendations', { error, userId });
      throw new AppError(500, 'Failed to get job recommendations');
    }
  }

  /**
   * Toggle save/unsave job
   */
  async toggleSaveJob(userId: string, jobId: string, notes?: string) {
    try {
      // Check if job exists
      const job = await prisma.job.findUnique({
        where: { id: jobId, active: true }
      });

      if (!job) {
        throw new AppError(404, 'Job not found');
      }

      // Check if already saved
      const existingSave = await prisma.savedJob.findUnique({
        where: {
          userId_jobId: {
            userId,
            jobId
          }
        }
      });

      if (existingSave) {
        // Unsave
        await prisma.savedJob.delete({
          where: { id: existingSave.id }
        });

        await this.logActivity(userId, 'job_unsave', 'job', jobId);

        return { saved: false };
      } else {
        // Save
        await prisma.savedJob.create({
          data: {
            userId,
            jobId,
            notes
          }
        });

        await this.logActivity(userId, 'job_save', 'job', jobId);

        return { saved: true };
      }
    } catch (error) {
      logger.error('Error toggling save job', { error, userId, jobId });
      throw error instanceof AppError ? error : new AppError(500, 'Failed to save/unsave job');
    }
  }

  /**
   * Get user's saved jobs
   */
  async getSavedJobs(userId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;

      const [savedJobs, total] = await Promise.all([
        prisma.savedJob.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            job: {
              include: {
                company: {
                  select: {
                    id: true,
                    name: true,
                    logo: true,
                    industry: true,
                    province: true,
                    city: true
                  }
                },
                _count: {
                  select: {
                    jobApplications: true
                  }
                }
              }
            }
          }
        }),
        prisma.savedJob.count({ where: { userId } })
      ]);

      const jobs = savedJobs.map(saved => ({
        ...saved.job,
        isSaved: true,
        savedNotes: saved.notes,
        savedAt: saved.createdAt
      }));

      return {
        jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting saved jobs', { error, userId });
      throw new AppError(500, 'Failed to retrieve saved jobs');
    }
  }

  /**
   * Get employer's jobs
   */
  async getEmployerJobs(userId: string, page: number = 1, limit: number = 20, status?: string) {
    try {
      const skip = (page - 1) * limit;

      // Get user's companies
      const employerProfile = await prisma.employerProfile.findUnique({
        where: { userId },
        include: { company: true }
      });

      if (!employerProfile?.company) {
        throw new AppError(404, 'Employer company not found');
      }

      const where: Prisma.JobWhereInput = {
        companyId: employerProfile.company.id,
        ...(status && { active: status === 'active' })
      };

      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            company: {
              select: {
                id: true,
                name: true,
                logo: true,
                industry: true,
                province: true,
                city: true
              }
            },
            _count: {
              select: {
                jobApplications: true
              }
            }
          }
        }),
        prisma.job.count({ where })
      ]);

      return {
        jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting employer jobs', { error, userId });
      throw error instanceof AppError ? error : new AppError(500, 'Failed to retrieve employer jobs');
    }
  }

  /**
   * Get job statistics
   */
  async getJobStatistics() {
    try {
      const cacheKey = 'job_statistics';
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const [
        totalJobs,
        activeJobs,
        featuredJobs,
        remoteJobs,
        jobsByType,
        jobsByExperience,
        jobsByProvince
      ] = await Promise.all([
        prisma.job.count(),
        prisma.job.count({ where: { active: true } }),
        prisma.job.count({ where: { active: true, featured: true } }),
        prisma.job.count({ where: { active: true, isRemote: true } }),
        prisma.job.groupBy({
          by: ['jobType'],
          where: { active: true },
          _count: { _all: true }
        }),
        prisma.job.groupBy({
          by: ['experienceLevel'],
          where: { active: true },
          _count: { _all: true }
        }),
        prisma.job.groupBy({
          by: ['province'],
          where: { active: true },
          _count: { _all: true }
        })
      ]);

      const stats = {
        totalJobs,
        activeJobs,
        featuredJobs,
        remoteJobs,
        distribution: {
          byType: jobsByType,
          byExperience: jobsByExperience,
          byProvince: jobsByProvince
        },
        lastUpdated: new Date().toISOString()
      };

      // Cache for 1 hour
      await cache.set(cacheKey, stats, 3600);

      return stats;
    } catch (error) {
      logger.error('Error getting job statistics', { error });
      throw new AppError(500, 'Failed to retrieve job statistics');
    }
  }

  /**
   * Track job view
   */
  async trackJobView(jobId: string, userId: string): Promise<void> {
    try {
      await this.logActivity(userId, 'job_view', 'job', jobId);
    } catch (error) {
      logger.warn('Failed to track job view', { error, jobId, userId });
      // Don't throw error for tracking failures
    }
  }

  /**
   * Verify company access for user
   */
  async verifyCompanyAccess(userId: string, companyId: string): Promise<boolean> {
    try {
      const employerProfile = await prisma.employerProfile.findUnique({
        where: { userId },
        include: { company: true }
      });

      return employerProfile?.company?.id === companyId;
    } catch (error) {
      logger.error('Error verifying company access', { error, userId, companyId });
      return false;
    }
  }

  /**
   * Get job match score for user
   */
  private async getJobMatchScore(userId: string, jobId: string): Promise<number | null> {
    try {
      const matchScore = await prisma.jobMatchScore.findUnique({
        where: {
          jobId_userId: {
            jobId,
            userId
          }
        },
        select: { overallScore: true }
      });

      return matchScore?.overallScore || null;
    } catch (error) {
      logger.warn('Failed to get job match score', { error, userId, jobId });
      return null;
    }
  }

  /**
   * Log user activity
   */
  private async logActivity(userId: string, action: string, entityType: string, entityId: string, metadata?: any): Promise<void> {
    try {
      await prisma.userActivity.create({
        data: {
          userId,
          action,
          entityType,
          entityId,
          metadata: metadata || {}
        }
      });
    } catch (error) {
      logger.warn('Failed to log activity', { error, userId, action });
      // Don't throw error for logging failures
    }
  }
}
