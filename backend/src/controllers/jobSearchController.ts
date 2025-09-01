import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jobSearchService, { jobSearchFiltersSchema } from '../services/jobSearchService.js';
import { AIMatchingService } from '../services/ai-matching.service.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import { z } from 'zod';

const prisma = new PrismaClient();
const aiMatchingService = new AIMatchingService();

// Validation schemas
const jobIdSchema = z.object({
  jobId: z.string().uuid()
});

const saveJobSchema = z.object({
  jobId: z.string().uuid(),
  notes: z.string().optional()
});

const recommendationsQuerySchema = z.object({
  limit: z.string().transform(val => Math.min(parseInt(val) || 10, 50)).default('10')
});

class JobSearchController {
  /**
   * Search jobs with advanced filtering
   */
  async searchJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      
      // Validate search filters
      const filters = jobSearchFiltersSchema.parse({
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20
      });

      logger.info('Job search requested', { 
        userId, 
        filters: {
          query: filters.query,
          location: filters.location,
          province: filters.province,
          jobTypes: filters.jobTypes,
          experienceLevel: filters.experienceLevel
        }
      });

      // Execute search
      const result = await jobSearchService.searchJobs(filters, userId);

      res.json({
        success: true,
        data: result.jobs,
        meta: result.metrics
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid search filters', 'VALIDATION_ERROR', error.errors));
      }
      logger.error('Job search failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get job recommendations for authenticated user
   */
  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required for recommendations', 'AUTH_REQUIRED');
      }

      const { limit } = recommendationsQuerySchema.parse(req.query);

      logger.info('Job recommendations requested', { userId, limit });

      const recommendations = await jobSearchService.getRecommendations(userId, limit);

      res.json({
        success: true,
        data: recommendations,
        meta: {
          count: recommendations.length,
          userId,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Job recommendations failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   *  MAGIC: Get AI-enhanced job matches with personality analysis
   */
  async getAIEnhancedMatches(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required for AI matching', 'AUTH_REQUIRED');
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
      const minScore = parseFloat(req.query.minScore as string) || 0.6;
      const jobIds = req.query.jobIds ? (req.query.jobIds as string).split(',') : undefined;

      logger.info(' AI enhanced matching requested', { userId, limit, minScore });

      // Use enhanced AI matching service
      const matches = await aiMatchingService.calculateJobMatches(userId, jobIds);
      
      // Filter and limit results
      const filteredMatches = matches
        .filter(match => match.overallScore >= minScore)
        .slice(0, limit);

      // Get full job details for matched jobs
      const jobDetails = await Promise.all(
        filteredMatches.map(async (match) => {
          const job = await prisma.job.findUnique({
            where: { id: match.jobId },
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                  industry: true,
                  size: true,
                  verified: true,
                  description: true
                }
              }
            }
          });

          return {
            job: {
              id: job?.id,
              title: job?.title,
              description: job?.description?.substring(0, 300) + '...',
              company: job?.company,
              jobType: job?.jobType,
              location: {
                province: job?.province,
                city: job?.city,
                isRemote: job?.isRemote
              },
              salary: job?.salaryMin || job?.salaryMax ? {
                min: job?.salaryMin,
                max: job?.salaryMax,
                currency: job?.salaryCurrency
              } : null
            },
            aiAnalysis: {
              overallScore: match.overallScore,
              successProbability: match.successProbability,
              magicExplanation: match.magicExplanation,
              whyPerfectFit: match.whyPerfectFit,
              personalityInsights: match.personalityInsights,
              scores: {
                skills: match.skillsScore,
                experience: match.experienceScore,
                personality: match.personalityScore,
                culturalFit: match.culturalFitScore,
                location: match.locationScore
              },
              strengths: match.strengths,
              recommendations: match.recommendations
            }
          };
        })
      );

      res.json({
        success: true,
        data: jobDetails,
        meta: {
          count: jobDetails.length,
          totalAnalyzed: matches.length,
          userId,
          aiEnhanced: true,
          generatedAt: new Date().toISOString(),
          magicVersion: '1.0'
        }
      });

    } catch (error) {
      logger.error(' AI enhanced matching failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   *  MAGIC: Get detailed personality-job analysis for specific job
   */
  async getJobPersonalityAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required for personality analysis', 'AUTH_REQUIRED');
      }

      const { jobId } = jobIdSchema.parse(req.params);

      logger.info(' Personality analysis requested', { userId, jobId });

      // Get AI analysis for specific job
      const matches = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matches.length === 0) {
        throw new AppError(404, 'Job not found or no match data available', 'NO_MATCH_DATA');
      }

      const match = matches[0];

      // Get additional job details
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              size: true,
              description: true,
              // culture: true,
            }
          }
        }
      });

      res.json({
        success: true,
        data: {
          jobInfo: {
            id: job?.id,
            title: job?.title,
            company: job?.companyId
          },
          personalityAnalysis: {
            overallCompatibility: match.overallScore,
            successProbability: {
              percentage: Math.round(match.successProbability * 100),
              confidence: match.personalityInsights.confidenceLevel,
              reasoning: match.magicExplanation
            },
            personalityFit: {
              score: match.personalityScore,
              insights: match.personalityInsights,
              explanation: match.whyPerfectFit
            },
            culturalFit: {
              score: match.culturalFitScore,
              alignment: match.personalityInsights.culturalAlignment
            },
            detailedScores: {
              skills: { score: match.skillsScore, weight: '25%' },
              experience: { score: match.experienceScore, weight: '20%' },
              personality: { score: match.personalityScore, weight: '15%' },
              location: { score: match.locationScore, weight: '15%' },
              education: { score: match.educationScore, weight: '10%' },
              salary: { score: match.salaryScore, weight: '10%' },
              culture: { score: match.culturalFitScore, weight: '5%' }
            },
            actionable: {
              strengths: match.strengths,
              recommendations: match.recommendations,
              nextSteps: match.recommendations.slice(0, 3)
            }
          }
        },
        meta: {
          analysisType: 'personality-enhanced',
          aiVersion: '1.0',
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID format', 'VALIDATION_ERROR', error.errors));
      }
      logger.error(' Personality analysis failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get job details by ID
   */
  async getJobById(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId } = jobIdSchema.parse(req.params);
      const userId = req.user?.id;

      // Get job details
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              website: true,
              industry: true,
              size: true,
              verified: true,
              description: true,
              founded: true
            }
          },
          matchScores: userId ? {
            where: { userId },
            select: { 
              overallScore: true,
              skillsScore: true,
              experienceScore: true,
              educationScore: true,
              locationScore: true,
              salaryScore: true,
              strengths: true,
              gaps: true,
              recommendations: true
            }
          } : false,
          savedByUsers: userId ? {
            where: { userId },
            select: { id: true, notes: true, createdAt: true }
          } : false,
          jobApplications: userId ? {
            where: { userId },
            select: { 
              id: true, 
              status: true, 
              createdAt: true,
              viewedAt: true,
              reviewedAt: true
            }
          } : false
        }
      });

      if (!job) {
        throw new AppError(404, 'Job not found', 'JOB_NOT_FOUND');
      }

      if (!job.active) {
        throw new AppError(410, 'Job is no longer active', 'JOB_INACTIVE');
      }

      // Increment view count (fire and forget)
      prisma.job.update({
        where: { id: jobId },
        data: { views: { increment: 1 } }
      }).catch(error => {
        logger.warn('Failed to increment job view count', { error, jobId });
      });

      // Log view activity if user is authenticated
      if (userId) {
        prisma.userActivity.create({
          data: {
            userId,
            action: 'job_view',
            entityType: 'job',
            entityId: jobId,
            metadata: {
              jobTitle: job.title,
              companyName: job.company.name
            }
          }
        }).catch(error => {
          logger.warn('Failed to log job view activity', { error, userId, jobId });
        });
      }

      // Transform the response
      const jobDetails = {
        id: job.id,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        responsibilities: job.responsibilities,
        company: job.company,
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        location: {
          province: job.province,
          city: job.city,
          suburb: job.suburb,
          isRemote: job.isRemote
        },
        salary: job.salaryMin || job.salaryMax ? {
          min: job.salaryMin,
          max: job.salaryMax,
          currency: job.salaryCurrency,
          period: job.salaryPeriod,
          showSalary: job.showSalary
        } : null,
        skills: {
          required: job.requiredSkills || [],
          preferred: job.preferredSkills || []
        },
        applicationInfo: {
          deadline: job.applicationDeadline?.toISOString(),
          email: job.applicationEmail,
          url: job.applicationUrl
        },
        status: {
          active: job.active,
          featured: job.featured,
          urgent: job.urgent
        },
        metrics: {
          views: job.views,
          applications: job.applications
        },
        dates: {
          createdAt: job.createdAt.toISOString(),
          publishedAt: job.publishedAt?.toISOString(),
          expiresAt: job.expiresAt?.toISOString()
        },
        userInteraction: userId ? {
          matchScore: job.matchScores?.[0] || null,
          isSaved: job.savedByUsers.length > 0,
          savedDetails: job.savedByUsers[0] || null,
          hasApplied: job.jobApplications.length > 0,
          applicationDetails: job.jobApplications[0] || null
        } : null
      };

      res.json({
        success: true,
        data: jobDetails
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID format', 'VALIDATION_ERROR', error.errors));
      }
      logger.error('Get job by ID failed', { error, jobId: req.params.jobId });
      next(error);
    }
  }

  /**
   * Get similar jobs
   */
  async getSimilarJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId } = jobIdSchema.parse(req.params);
      const userId = req.user?.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);

      logger.info('Similar jobs requested', { jobId, userId, limit });

      const similarJobs = await jobSearchService.getSimilarJobs(jobId, userId, limit);

      res.json({
        success: true,
        data: similarJobs,
        meta: {
          count: similarJobs.length,
          referenceJobId: jobId
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID format', 'VALIDATION_ERROR', error.errors));
      }
      logger.error('Similar jobs search failed', { error, jobId: req.params.jobId });
      next(error);
    }
  }

  /**
   * Save job for later
   */
  async saveJob(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      const { jobId, notes } = saveJobSchema.parse(req.body);

      // Check if job exists and is active
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true, title: true, active: true, company: { select: { name: true } } }
      });

      if (!job) {
        throw new AppError(404, 'Job not found', 'JOB_NOT_FOUND');
      }

      if (!job.active) {
        throw new AppError(410, 'Cannot save inactive job', 'JOB_INACTIVE');
      }

      // Check if already saved
      const existingSavedJob = await prisma.savedJob.findUnique({
        where: {
          userId_jobId: {
            userId,
            jobId
          }
        }
      });

      if (existingSavedJob) {
        // Update notes if provided
        if (notes !== undefined) {
          const updatedSavedJob = await prisma.savedJob.update({
            where: { id: existingSavedJob.id },
            data: { notes }
          });

          return res.json({
            success: true,
            message: 'Saved job updated successfully',
            data: {
              id: updatedSavedJob.id,
              jobId,
              notes: updatedSavedJob.notes,
              savedAt: updatedSavedJob.createdAt.toISOString()
            }
          });
        }

        return res.json({
          success: true,
          message: 'Job already saved',
          data: {
            id: existingSavedJob.id,
            jobId,
            notes: existingSavedJob.notes,
            savedAt: existingSavedJob.createdAt.toISOString()
          }
        });
      }

      // Save the job
      const savedJob = await prisma.savedJob.create({
        data: {
          userId,
          jobId,
          notes
        }
      });

      // Log save activity
      await prisma.userActivity.create({
        data: {
          userId,
          action: 'job_save',
          entityType: 'job',
          entityId: jobId,
          metadata: {
            jobTitle: job.title,
            companyName: job.company.name
          }
        }
      }).catch(error => {
        logger.warn('Failed to log job save activity', { error, userId, jobId });
      });

      logger.info('Job saved successfully', { userId, jobId });

      res.status(201).json({
        success: true,
        message: 'Job saved successfully',
        data: {
          id: savedJob.id,
          jobId,
          notes: savedJob.notes,
          savedAt: savedJob.createdAt.toISOString()
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid request data', 'VALIDATION_ERROR', error.errors));
      }
      logger.error('Save job failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Remove job from saved jobs
   */
  async unsaveJob(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      const { jobId } = jobIdSchema.parse(req.params);

      const savedJob = await prisma.savedJob.findUnique({
        where: {
          userId_jobId: {
            userId,
            jobId
          }
        }
      });

      if (!savedJob) {
        throw new AppError(404, 'Saved job not found', 'SAVED_JOB_NOT_FOUND');
      }

      await prisma.savedJob.delete({
        where: { id: savedJob.id }
      });

      // Log unsave activity
      await prisma.userActivity.create({
        data: {
          userId,
          action: 'job_unsave',
          entityType: 'job',
          entityId: jobId
        }
      }).catch(error => {
        logger.warn('Failed to log job unsave activity', { error, userId, jobId });
      });

      logger.info('Job unsaved successfully', { userId, jobId });

      res.json({
        success: true,
        message: 'Job removed from saved jobs'
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid job ID format', 'VALIDATION_ERROR', error.errors));
      }
      logger.error('Unsave job failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get user's saved jobs
   */
  async getSavedJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      const [savedJobs, totalCount] = await Promise.all([
        prisma.savedJob.findMany({
          where: { userId },
          include: {
            job: {
              include: {
                company: {
                  select: {
                    id: true,
                    name: true,
                    logo: true,
                    industry: true,
                    size: true,
                    verified: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.savedJob.count({ where: { userId } })
      ]);

      const transformedJobs = savedJobs.map(savedJob => ({
        savedJobId: savedJob.id,
        notes: savedJob.notes,
        savedAt: savedJob.createdAt.toISOString(),
        job: {
          id: savedJob.job.id,
          title: savedJob.job.title,
          company: savedJob.job.company,
          jobType: savedJob.job.jobType,
          experienceLevel: savedJob.job.experienceLevel,
          location: {
            province: savedJob.job.province,
            city: savedJob.job.city,
            isRemote: savedJob.job.isRemote
          },
          salary: savedJob.job.salaryMin || savedJob.job.salaryMax ? {
            min: savedJob.job.salaryMin,
            max: savedJob.job.salaryMax,
            currency: savedJob.job.salaryCurrency,
            showSalary: savedJob.job.showSalary
          } : null,
          status: {
            active: savedJob.job.active,
            featured: savedJob.job.featured,
            urgent: savedJob.job.urgent
          },
          dates: {
            publishedAt: savedJob.job.publishedAt?.toISOString(),
            expiresAt: savedJob.job.expiresAt?.toISOString()
          }
        }
      }));

      res.json({
        success: true,
        data: transformedJobs,
        meta: {
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
            hasNext: page * limit < totalCount,
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      logger.error('Get saved jobs failed', { error, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get popular/trending jobs
   */
  async getTrendingJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const timeframe = req.query.timeframe as string || '7d';

      let dateThreshold: Date;
      const now = new Date();

      switch (timeframe) {
        case '24h':
          dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      // Get trending jobs based on views and applications
      const trendingJobs = await prisma.job.findMany({
        where: {
          active: true,
          publishedAt: { 
            not: null,
            gte: dateThreshold
          }
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              size: true,
              verified: true
            }
          },
          matchScores: userId ? {
            where: { userId },
            select: { overallScore: true }
          } : false
        },
        orderBy: [
          { featured: 'desc' },
          { views: 'desc' },
          { applications: 'desc' },
          { publishedAt: 'desc' }
        ],
        take: limit
      });

      const transformedJobs = trendingJobs.map(job => ({
        id: job.id,
        title: job.title,
        description: job.description.substring(0, 200) + (job.description.length > 200 ? '...' : ''),
        company: job.company,
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        location: {
          province: job.province,
          city: job.city,
          isRemote: job.isRemote
        },
        salary: job.salaryMin || job.salaryMax ? {
          min: job.salaryMin,
          max: job.salaryMax,
          currency: job.salaryCurrency,
          showSalary: job.showSalary
        } : null,
        status: {
          active: job.active,
          featured: job.featured,
          urgent: job.urgent
        },
        metrics: {
          views: job.views,
          applications: job.applications
        },
        dates: {
          publishedAt: job.publishedAt?.toISOString()
        },
        matchScore: job.matchScores?.[0]?.overallScore
      }));

      res.json({
        success: true,
        data: transformedJobs,
        meta: {
          count: transformedJobs.length,
          timeframe,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Get trending jobs failed', { error });
      next(error);
    }
  }

  /**
   * Get job search statistics
   */
  async getSearchStats(req: Request, res: Response, next: NextFunction) {
    try {
      const [
        totalJobs,
        activeJobs,
        featuredJobs,
        recentJobs,
        companiesCount,
        locationStats,
        industryStats
      ] = await Promise.all([
        prisma.job.count(),
        prisma.job.count({ where: { active: true } }),
        prisma.job.count({ where: { active: true, featured: true } }),
        prisma.job.count({
          where: {
            active: true,
            publishedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        prisma.company.count({ where: { active: true } }),
        this.getLocationStats(),
        this.getIndustryStats()
      ]);

      res.json({
        success: true,
        data: {
          jobs: {
            total: totalJobs,
            active: activeJobs,
            featured: featuredJobs,
            recentlyPosted: recentJobs
          },
          companies: {
            total: companiesCount
          },
          locations: locationStats,
          industries: industryStats,
          lastUpdated: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Get search stats failed', { error });
      next(error);
    }
  }

  private async getLocationStats() {
    try {
      const stats = await prisma.job.groupBy({
        by: ['province'],
        where: { active: true },
        _count: { id: true }
      });

      return stats.reduce((acc, stat) => {
        acc[stat.province] = stat._count.id;
        return acc;
      }, {} as Record<string, number>);
    } catch (error) {
      logger.warn('Failed to get location stats', { error });
      return {};
    }
  }

  private async getIndustryStats() {
    try {
      const stats = await prisma.job.groupBy({
        by: ['companyId'],
        where: { active: true },
        _count: { id: true },
        take: 20,
        orderBy: { _count: { id: 'desc' } }
      });

      // Get company industries for top companies
      const companyIds = stats.map(s => s.companyId);
      const companies = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, industry: true }
      });

      const industryMap = companies.reduce((acc, company) => {
        acc[company.id] = company.industry;
        return acc;
      }, {} as Record<string, string>);

      const industryStats = stats.reduce((acc, stat) => {
        const industry = industryMap[stat.companyId];
        if (industry) {
          acc[industry] = (acc[industry] || 0) + stat._count.id;
        }
        return acc;
      }, {} as Record<string, number>);

      return industryStats;
    } catch (error) {
      logger.warn('Failed to get industry stats', { error });
      return {};
    }
  }
}

export default new JobSearchController();
