import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

// Search filters schema
export const jobSearchFiltersSchema = z.object({
  // Basic search
  query: z.string().optional(),
  location: z.string().optional(),
  
  // Location filters
  province: z.enum([
    'EASTERN_CAPE', 'FREE_STATE', 'GAUTENG', 'KWAZULU_NATAL',
    'LIMPOPO', 'MPUMALANGA', 'NORTHERN_CAPE', 'NORTH_WEST', 'WESTERN_CAPE'
  ]).optional(),
  city: z.string().optional(),
  isRemote: z.boolean().optional(),
  
  // Job details
  jobTypes: z.array(z.enum([
    'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'REMOTE'
  ])).optional(),
  experienceLevel: z.enum([
    'ENTRY_LEVEL', 'JUNIOR', 'MID_LEVEL', 'SENIOR', 'EXECUTIVE'
  ]).optional(),
  
  // Salary filters
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  
  // Skills and requirements
  requiredSkills: z.array(z.string()).optional(),
  preferredSkills: z.array(z.string()).optional(),
  
  // Company filters
  companyId: z.string().optional(),
  companySize: z.string().optional(),
  industry: z.string().optional(),
  
  // Job status
  featured: z.boolean().optional(),
  urgent: z.boolean().optional(),
  postedWithin: z.enum(['24h', '7d', '30d', '90d']).optional(),
  
  // Pagination
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  
  // Sorting
  sortBy: z.enum([
    'relevance', 'date', 'salary_asc', 'salary_desc', 'company', 'title'
  ]).default('relevance')
});

export type JobSearchFilters = z.infer<typeof jobSearchFiltersSchema>;

export interface JobSearchResult {
  id: string;
  title: string;
  description: string;
  requirements: string;
  responsibilities: string;
  company: {
    id: string;
    name: string;
    logo?: string;
    industry: string;
    size?: string;
    verified: boolean;
  };
  jobType: string;
  experienceLevel: string;
  location: {
    province: string;
    city: string;
    suburb?: string;
    isRemote: boolean;
  };
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    period?: string;
    showSalary: boolean;
  };
  skills: {
    required: string[];
    preferred: string[];
  };
  applicationInfo: {
    deadline?: string;
    email?: string;
    url?: string;
  };
  status: {
    active: boolean;
    featured: boolean;
    urgent: boolean;
  };
  metrics: {
    views: number;
    applications: number;
  };
  dates: {
    createdAt: string;
    publishedAt?: string;
    expiresAt?: string;
  };
  matchScore?: number; // If user is authenticated and we can calculate matching
}

export interface SearchMetrics {
  totalResults: number;
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
  searchTime: number;
  filters: {
    provinces: { [key: string]: number };
    jobTypes: { [key: string]: number };
    experienceLevels: { [key: string]: number };
    industries: { [key: string]: number };
    salaryRanges: {
      '0-30000': number;
      '30000-60000': number;
      '60000-100000': number;
      '100000-200000': number;
      '200000+': number;
    };
  };
}

class JobSearchService {
  /**
   * Search jobs with advanced filtering and AI matching
   */
  async searchJobs(
    filters: JobSearchFilters, 
    userId?: string
  ): Promise<{ jobs: JobSearchResult[]; metrics: SearchMetrics }> {
    const startTime = Date.now();

    try {
      // Build the where clause for Prisma
      const whereClause = await this.buildWhereClause(filters);
      
      // Calculate offset for pagination
      const offset = (filters.page - 1) * filters.limit;
      
      // Build order by clause
      const orderBy = this.buildOrderByClause(filters.sortBy);
      
      // Execute search query
      const [jobs, totalCount] = await Promise.all([
        prisma.job.findMany({
          where: whereClause,
          include: {
            company: {
              select: {
                id: true,
                name: true,
                logo: true,
                industry: true,
                size: true,
                verified: true,
              }
            },
            matchScores: userId ? {
              where: { userId },
              select: { overallScore: true }
            } : false
          },
          orderBy,
          skip: offset,
          take: filters.limit,
        }),
        prisma.job.count({ where: whereClause })
      ]);

      // Transform results
      const transformedJobs = jobs.map(job => this.transformJobResult(job, userId));
      
      // Get search metrics
      const metrics = await this.calculateSearchMetrics(
        filters, 
        totalCount, 
        Date.now() - startTime
      );

      // Log search activity
      if (userId) {
        await this.logSearchActivity(userId, filters, totalCount);
      }

      return {
        jobs: transformedJobs,
        metrics
      };

    } catch (error) {
      logger.error('Job search failed', { error, filters, userId });
      throw new AppError(500, 'Job search failed', 'SEARCH_ERROR');
    }
  }

  /**
   * Get job recommendations for user
   */
  async getRecommendations(
    userId: string, 
    limit: number = 10
  ): Promise<JobSearchResult[]> {
    try {
      // Get user profile and preferences
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          jobSeekerProfile: true,
          skills: {
            include: { skill: true }
          },
          experiences: true,
          savedJobs: {
            select: { jobId: true }
          },
          applications: {
            select: { jobId: true }
          }
        }
      });

      if (!user || !user.jobSeekerProfile) {
        throw new AppError(404, 'User profile not found', 'PROFILE_NOT_FOUND');
      }

      // Extract user preferences and skills
      const userSkills = user.skills.map(us => us.skill.name);
      const preferredLocations = user.jobSeekerProfile.preferredLocations || [];
      const preferredJobTypes = user.jobSeekerProfile.preferredJobTypes || [];
      const preferredIndustries = user.jobSeekerProfile.preferredIndustries || [];
      const experienceYears = user.jobSeekerProfile.yearsOfExperience || 0;
      
      // Determine experience level
      const experienceLevel = this.mapYearsToExperienceLevel(experienceYears);
      
      // Get excluded job IDs (already saved or applied)
      const excludeJobIds = [
        ...user.savedJobs.map(sj => sj.jobId),
        ...user.applications.map(app => app.jobId)
      ];

      // Build recommendation query
      const recommendationQuery = {
        active: true,
        publishedAt: { not: null },
        NOT: excludeJobIds.length > 0 ? {
          id: { in: excludeJobIds }
        } : undefined,
        OR: [
          // Skills match
          userSkills.length > 0 ? {
            OR: [
              { requiredSkills: { hasSome: userSkills } },
              { preferredSkills: { hasSome: userSkills } }
            ]
          } : {},
          // Location match
          preferredLocations.length > 0 ? {
            OR: preferredLocations.map(location => ({
              OR: [
                { city: { contains: location, mode: 'insensitive' } },
                { province: location.toUpperCase().replace(/\s+/g, '_') as any }
              ]
            }))
          } : {},
          // Job type match
          preferredJobTypes.length > 0 ? {
            jobType: { in: preferredJobTypes }
          } : {},
          // Industry match
          preferredIndustries.length > 0 ? {
            company: {
              industry: { in: preferredIndustries }
            }
          } : {},
          // Experience level match
          {
            experienceLevel: {
              in: [experienceLevel, ...this.getAdjacentExperienceLevels(experienceLevel)]
            }
          }
        ]
      };

      // Get recommended jobs
      const jobs = await prisma.job.findMany({
        where: recommendationQuery,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              size: true,
              verified: true,
            }
          },
          matchScores: {
            where: { userId },
            select: { overallScore: true }
          }
        },
        orderBy: [
          { featured: 'desc' },
          { urgent: 'desc' },
          { publishedAt: 'desc' }
        ],
        take: limit * 2 // Get more to filter and rank
      });

      // Rank jobs by relevance score
      const rankedJobs = jobs
        .map(job => ({
          job,
          relevanceScore: this.calculateRelevanceScore(job, {
            userSkills,
            preferredLocations,
            preferredJobTypes,
            preferredIndustries,
            experienceLevel,
            experienceYears
          })
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit)
        .map(item => this.transformJobResult(item.job, userId));

      // Log recommendation activity
      await this.logRecommendationActivity(userId, rankedJobs.length);

      return rankedJobs;

    } catch (error) {
      logger.error('Job recommendations failed', { error, userId });
      throw error instanceof AppError ? error : 
        new AppError(500, 'Failed to get recommendations', 'RECOMMENDATIONS_ERROR');
    }
  }

  /**
   * Get similar jobs
   */
  async getSimilarJobs(jobId: string, userId?: string, limit: number = 5): Promise<JobSearchResult[]> {
    try {
      // Get the reference job
      const referenceJob = await prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true }
      });

      if (!referenceJob) {
        throw new AppError(404, 'Job not found', 'JOB_NOT_FOUND');
      }

      // Find similar jobs
      const similarJobs = await prisma.job.findMany({
        where: {
          id: { not: jobId },
          active: true,
          publishedAt: { not: null },
          OR: [
            // Same company
            { companyId: referenceJob.companyId },
            // Similar job type and experience level
            {
              jobType: referenceJob.jobType,
              experienceLevel: referenceJob.experienceLevel
            },
            // Skills overlap
            {
              OR: [
                { requiredSkills: { hasSome: referenceJob.requiredSkills } },
                { preferredSkills: { hasSome: referenceJob.preferredSkills } }
              ]
            },
            // Same location
            {
              province: referenceJob.province,
              city: referenceJob.city
            }
          ]
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logo: true,
              industry: true,
              size: true,
              verified: true,
            }
          },
          matchScores: userId ? {
            where: { userId },
            select: { overallScore: true }
          } : false
        },
        orderBy: [
          { featured: 'desc' },
          { publishedAt: 'desc' }
        ],
        take: limit
      });

      return similarJobs.map(job => this.transformJobResult(job, userId));

    } catch (error) {
      logger.error('Similar jobs search failed', { error, jobId });
      throw error instanceof AppError ? error :
        new AppError(500, 'Failed to get similar jobs', 'SIMILAR_JOBS_ERROR');
    }
  }

  /**
   * Build Prisma where clause from search filters
   */
  private buildWhereClause(filters: JobSearchFilters) {
    const whereClause: any = {
      active: true,
      publishedAt: { not: null }
    };

    // Text search
    if (filters.query) {
      whereClause.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
        { requirements: { contains: filters.query, mode: 'insensitive' } },
        { requiredSkills: { hasSome: [filters.query] } },
        { preferredSkills: { hasSome: [filters.query] } },
        { company: { name: { contains: filters.query, mode: 'insensitive' } } }
      ];
    }

    // Location filters
    if (filters.province) {
      whereClause.province = filters.province;
    }
    if (filters.city) {
      whereClause.city = { contains: filters.city, mode: 'insensitive' };
    }
    if (filters.isRemote !== undefined) {
      whereClause.isRemote = filters.isRemote;
    }
    if (filters.location && !filters.province && !filters.city) {
      // Generic location search
      whereClause.OR = [
        ...(whereClause.OR || []),
        { city: { contains: filters.location, mode: 'insensitive' } },
        { suburb: { contains: filters.location, mode: 'insensitive' } }
      ];
    }

    // Job details
    if (filters.jobTypes && filters.jobTypes.length > 0) {
      whereClause.jobType = { in: filters.jobTypes };
    }
    if (filters.experienceLevel) {
      whereClause.experienceLevel = filters.experienceLevel;
    }

    // Salary filters
    if (filters.salaryMin !== undefined || filters.salaryMax !== undefined) {
      whereClause.AND = whereClause.AND || [];
      if (filters.salaryMin !== undefined) {
        whereClause.AND.push({
          OR: [
            { salaryMin: { gte: filters.salaryMin } },
            { salaryMax: { gte: filters.salaryMin } }
          ]
        });
      }
      if (filters.salaryMax !== undefined) {
        whereClause.AND.push({
          salaryMin: { lte: filters.salaryMax }
        });
      }
    }

    // Skills
    if (filters.requiredSkills && filters.requiredSkills.length > 0) {
      whereClause.requiredSkills = { hasSome: filters.requiredSkills };
    }
    if (filters.preferredSkills && filters.preferredSkills.length > 0) {
      whereClause.preferredSkills = { hasSome: filters.preferredSkills };
    }

    // Company filters
    if (filters.companyId) {
      whereClause.companyId = filters.companyId;
    }
    if (filters.industry) {
      whereClause.company = {
        ...whereClause.company,
        industry: { contains: filters.industry, mode: 'insensitive' }
      };
    }
    if (filters.companySize) {
      whereClause.company = {
        ...whereClause.company,
        size: filters.companySize
      };
    }

    // Status filters
    if (filters.featured !== undefined) {
      whereClause.featured = filters.featured;
    }
    if (filters.urgent !== undefined) {
      whereClause.urgent = filters.urgent;
    }

    // Date filters
    if (filters.postedWithin) {
      const now = new Date();
      let dateThreshold: Date;
      
      switch (filters.postedWithin) {
        case '24h':
          dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
      }
      
      whereClause.publishedAt = { gte: dateThreshold };
    }

    return whereClause;
  }

  /**
   * Build order by clause
   */
  private buildOrderByClause(sortBy: string) {
    switch (sortBy) {
      case 'date':
        return [
          { featured: 'desc' as const },
          { urgent: 'desc' as const },
          { publishedAt: 'desc' as const }
        ];
      case 'salary_asc':
        return [
          { salaryMin: 'asc' as const },
          { publishedAt: 'desc' as const }
        ];
      case 'salary_desc':
        return [
          { salaryMax: 'desc' as const },
          { publishedAt: 'desc' as const }
        ];
      case 'company':
        return [
          { company: { name: 'asc' as const } },
          { publishedAt: 'desc' as const }
        ];
      case 'title':
        return [
          { title: 'asc' as const },
          { publishedAt: 'desc' as const }
        ];
      case 'relevance':
      default:
        return [
          { featured: 'desc' as const },
          { urgent: 'desc' as const },
          { views: 'desc' as const },
          { publishedAt: 'desc' as const }
        ];
    }
  }

  /**
   * Transform database job result to API format
   */
  private transformJobResult(job: any, userId?: string): JobSearchResult {
    return {
      id: job.id,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      responsibilities: job.responsibilities,
      company: {
        id: job.company.id,
        name: job.company.name,
        logo: job.company.logo,
        industry: job.company.industry,
        size: job.company.size,
        verified: job.company.verified
      },
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
      } : undefined,
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
      matchScore: job.matchScores?.[0]?.overallScore
    };
  }

  /**
   * Calculate search metrics
   */
  private async calculateSearchMetrics(
    filters: JobSearchFilters, 
    totalCount: number, 
    searchTime: number
  ): Promise<SearchMetrics> {
    const totalPages = Math.ceil(totalCount / filters.limit);
    
    // Get filter aggregations (simplified for performance)
    const [provinceStats, jobTypeStats, experienceStats, industryStats] = await Promise.all([
      this.getProvinceStats(filters),
      this.getJobTypeStats(filters),
      this.getExperienceStats(filters),
      this.getIndustryStats(filters)
    ]);

    return {
      totalResults: totalCount,
      totalPages,
      currentPage: filters.page,
      hasNext: filters.page < totalPages,
      hasPrevious: filters.page > 1,
      searchTime,
      filters: {
        provinces: provinceStats,
        jobTypes: jobTypeStats,
        experienceLevels: experienceStats,
        industries: industryStats,
        salaryRanges: {
          '0-30000': 0, // Would need separate queries to calculate
          '30000-60000': 0,
          '60000-100000': 0,
          '100000-200000': 0,
          '200000+': 0
        }
      }
    };
  }

  // Helper methods for stats (simplified implementations)
  private async getProvinceStats(filters: JobSearchFilters): Promise<{ [key: string]: number }> {
    // Implementation would aggregate job counts by province
    return {};
  }

  private async getJobTypeStats(filters: JobSearchFilters): Promise<{ [key: string]: number }> {
    // Implementation would aggregate job counts by type
    return {};
  }

  private async getExperienceStats(filters: JobSearchFilters): Promise<{ [key: string]: number }> {
    // Implementation would aggregate job counts by experience level
    return {};
  }

  private async getIndustryStats(filters: JobSearchFilters): Promise<{ [key: string]: number }> {
    // Implementation would aggregate job counts by industry
    return {};
  }

  /**
   * Calculate relevance score for recommendations
   */
  private calculateRelevanceScore(job: any, userProfile: any): number {
    let score = 0;
    
    // Skills matching (40% weight)
    const skillsMatch = this.calculateSkillsMatch(
      [...job.requiredSkills, ...job.preferredSkills],
      userProfile.userSkills
    );
    score += skillsMatch * 40;

    // Location matching (20% weight)
    const locationMatch = this.calculateLocationMatch(job, userProfile.preferredLocations);
    score += locationMatch * 20;

    // Experience level matching (20% weight)
    const experienceMatch = this.calculateExperienceMatch(job.experienceLevel, userProfile.experienceLevel);
    score += experienceMatch * 20;

    // Job type matching (10% weight)
    const jobTypeMatch = userProfile.preferredJobTypes.includes(job.jobType) ? 1 : 0;
    score += jobTypeMatch * 10;

    // Industry matching (10% weight)
    const industryMatch = userProfile.preferredIndustries.includes(job.company.industry) ? 1 : 0;
    score += industryMatch * 10;

    return Math.min(100, score);
  }

  private calculateSkillsMatch(jobSkills: string[], userSkills: string[]): number {
    if (jobSkills.length === 0) return 0.5; // Neutral if no skills specified
    const matchCount = jobSkills.filter(skill => 
      userSkills.some(userSkill => 
        userSkill.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(userSkill.toLowerCase())
      )
    ).length;
    return matchCount / jobSkills.length;
  }

  private calculateLocationMatch(job: any, preferredLocations: string[]): number {
    if (job.isRemote) return 1; // Remote jobs always match
    if (preferredLocations.length === 0) return 0.5; // Neutral if no preference
    
    return preferredLocations.some(location =>
      job.city.toLowerCase().includes(location.toLowerCase()) ||
      job.province.toLowerCase().includes(location.toLowerCase())
    ) ? 1 : 0;
  }

  private calculateExperienceMatch(jobLevel: string, userLevel: string): number {
    const levels = ['ENTRY_LEVEL', 'JUNIOR', 'MID_LEVEL', 'SENIOR', 'EXECUTIVE'];
    const jobIndex = levels.indexOf(jobLevel);
    const userIndex = levels.indexOf(userLevel);
    const difference = Math.abs(jobIndex - userIndex);
    return Math.max(0, (levels.length - difference) / levels.length);
  }

  private mapYearsToExperienceLevel(years: number): string {
    if (years < 1) return 'ENTRY_LEVEL';
    if (years < 3) return 'JUNIOR';
    if (years < 6) return 'MID_LEVEL';
    if (years < 10) return 'SENIOR';
    return 'EXECUTIVE';
  }

  private getAdjacentExperienceLevels(level: string): string[] {
    const levels = ['ENTRY_LEVEL', 'JUNIOR', 'MID_LEVEL', 'SENIOR', 'EXECUTIVE'];
    const index = levels.indexOf(level);
    const adjacent = [];
    
    if (index > 0) adjacent.push(levels[index - 1]);
    if (index < levels.length - 1) adjacent.push(levels[index + 1]);
    
    return adjacent;
  }

  /**
   * Log search activity
   */
  private async logSearchActivity(userId: string, filters: JobSearchFilters, resultCount: number) {
    try {
      await prisma.userActivity.create({
        data: {
          userId,
          action: 'job_search',
          entityType: 'search',
          metadata: {
            filters: {
              query: filters.query,
              location: filters.location,
              province: filters.province,
              jobTypes: filters.jobTypes,
              experienceLevel: filters.experienceLevel
            },
            resultCount,
            page: filters.page
          }
        }
      });
    } catch (error) {
      logger.warn('Failed to log search activity', { error, userId });
    }
  }

  /**
   * Log recommendation activity
   */
  private async logRecommendationActivity(userId: string, recommendationCount: number) {
    try {
      await prisma.userActivity.create({
        data: {
          userId,
          action: 'job_recommendations',
          entityType: 'recommendations',
          metadata: {
            recommendationCount
          }
        }
      });
    } catch (error) {
      logger.warn('Failed to log recommendation activity', { error, userId });
    }
  }
}

export default new JobSearchService();
