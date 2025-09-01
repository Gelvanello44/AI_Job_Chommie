import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { HuggingFaceService } from './huggingface.service.js';

const prisma = new PrismaClient();

// Validation schemas
export const companySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  website: z.string().url().optional(),
  industry: z.string().max(100).optional(),
  size: z.enum(['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  foundedYear: z.number().min(1800).max(new Date().getFullYear()).optional(),
  headquarters: z.string().max(200).optional(),
  province: z.enum([
    'EASTERN_CAPE', 'FREE_STATE', 'GAUTENG', 'KWAZULU_NATAL',
    'LIMPOPO', 'MPUMALANGA', 'NORTHERN_CAPE', 'NORTH_WEST', 'WESTERN_CAPE'
  ]).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().regex(/^(?:\+27|0)[1-9]\d{8}$/).optional(),
  email: z.string().email().optional(),
  linkedinUrl: z.string().url().optional(),
  twitterUrl: z.string().url().optional(),
  facebookUrl: z.string().url().optional(),
  benefits: z.array(z.string()).max(20).optional(),
  values: z.array(z.string()).max(10).optional(),
  culture: z.string().max(2000).optional()
});

export const employerProfileSchema = z.object({
  position: z.string().min(1).max(100),
  department: z.string().max(100).optional(),
  isRecruiter: z.boolean().default(false),
  canPostJobs: z.boolean().default(false),
  permissions: z.array(z.enum([
    'POST_JOBS', 'MANAGE_APPLICATIONS', 'VIEW_ANALYTICS', 'MANAGE_COMPANY', 'MANAGE_TEAM'
  ])).max(5).optional()
});

export const companyFilterSchema = z.object({
  industry: z.string().optional(),
  size: z.array(z.enum(['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'])).optional(),
  province: z.array(z.enum([
    'EASTERN_CAPE', 'FREE_STATE', 'GAUTENG', 'KWAZULU_NATAL',
    'LIMPOPO', 'MPUMALANGA', 'NORTHERN_CAPE', 'NORTH_WEST', 'WESTERN_CAPE'
  ])).optional(),
  city: z.string().optional(),
  verified: z.boolean().optional(),
  hasJobs: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(10),
  sortBy: z.enum(['name', 'created_at', 'job_count', 'size']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

//  MAGIC: Company Culture Intelligence Interfaces
interface CompanyCultureAnalysis {
  companyId: string;
  companyName: string;
  cultureScore: number;
  cultureType: 'innovative' | 'traditional' | 'collaborative' | 'competitive' | 'flexible' | 'structured';
  cultureInsights: {
    workLifeBalance: number;
    innovation: number;
    collaboration: number;
    diversity: number;
    growth: number;
    leadership: number;
  };
  hiringPatterns: {
    averageHiringTime: number;
    responseRate: number;
    interviewProcess: string;
    commonRequirements: string[];
    salaryCompetitiveness: 'low' | 'average' | 'high';
  };
  employeeInsights: {
    averageTenure: number;
    satisfactionScore: number;
    commonPerks: string[];
    careerGrowthOpportunities: number;
  };
  shouldApplyAdvice: {
    recommendation: 'strongly_recommend' | 'recommend' | 'neutral' | 'caution' | 'avoid';
    reasoning: string[];
    matchPercentage: number;
    bestFitFor: string[];
    potentialConcerns: string[];
  };
  dataConfidence: 'high' | 'medium' | 'low';
  lastUpdated: Date;
}

interface InterviewIntelligence {
  companyId: string;
  interviewProcess: {
    stages: {
      stage: string;
      duration: string;
      description: string;
      tips: string[];
    }[];
    averageDuration: string;
    difficultyLevel: 'easy' | 'moderate' | 'challenging' | 'very_challenging';
  };
  commonQuestions: {
    category: string;
    questions: string[];
    tips: string[];
  }[];
  decisionFactors: {
    factor: string;
    importance: number;
    description: string;
  }[];
  successTips: string[];
  redFlags: string[];
}

interface HiringPatternAnalysis {
  companyId: string;
  recruitmentCycle: {
    peakMonths: string[];
    averagePositionsPerMonth: number;
    seasonalTrends: string;
  };
  applicationMetrics: {
    averageApplications: number;
    responseRate: number;
    interviewRate: number;
    offerRate: number;
    timeToResponse: number;
    timeToInterview: number;
    timeToOffer: number;
  };
  competitiveAnalysis: {
    industry: string;
    companyRanking: number;
    differentiators: string[];
    advantages: string[];
    challenges: string[];
  };
}

class CompanyProfileService {
  private hfService: HuggingFaceService;

  constructor() {
    this.hfService = HuggingFaceService.getInstance();
  }
  /**
   * Create a new company
   */
  async createCompany(userId: string, companyData: z.infer<typeof companySchema>) {
    try {
      const validatedData = companySchema.parse(companyData);

      // Check if user is an employer
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      }

      if (user.role !== 'EMPLOYER') {
        throw new AppError(403, 'Only employers can create companies', 'ROLE_MISMATCH');
      }

      // Check if company name already exists
      const existingCompany = await prisma.company.findFirst({
        where: { 
          name: { equals: validatedData.name, mode: 'insensitive' }
        }
      });

      if (existingCompany) {
        throw new AppError(409, 'Company name already exists', 'COMPANY_EXISTS');
      }

      // Create company and employer profile in transaction
      const result = await prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: validatedData
        });

        const employerProfile = await tx.employerProfile.create({
          data: {
            userId,
            companyId: company.id,
            position: 'Company Administrator',
            isRecruiter: true,
            canPostJobs: true,
            permissions: ['POST_JOBS', 'MANAGE_APPLICATIONS', 'VIEW_ANALYTICS', 'MANAGE_COMPANY', 'MANAGE_TEAM']
          }
        });

        return { company, employerProfile };
      });

      logger.info('Company created', { userId, companyId: result.company.id });

      return {
        ...this.transformCompany(result.company),
        employerProfile: this.transformEmployerProfile(result.employerProfile)
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid company data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Create company failed', { error, userId });
      throw new AppError(500, 'Failed to create company', 'COMPANY_CREATE_ERROR');
    }
  }

  /**
   * Update company profile
   */
  async updateCompany(userId: string, companyId: string, companyData: z.infer<typeof companySchema>) {
    try {
      const validatedData = companySchema.parse(companyData);

      // Check if user has permission to update this company
      await this.checkCompanyPermission(userId, companyId, 'MANAGE_COMPANY');

      // Check if new name conflicts with existing company (if name is being changed)
      if (validatedData.name) {
        const existingCompany = await prisma.company.findFirst({
          where: {
            name: { equals: validatedData.name, mode: 'insensitive' },
            id: { not: companyId }
          }
        });

        if (existingCompany) {
          throw new AppError(409, 'Company name already exists', 'COMPANY_EXISTS');
        }
      }

      const updatedCompany = await prisma.company.update({
        where: { id: companyId },
        data: validatedData
      });

      logger.info('Company updated', { userId, companyId });

      return this.transformCompany(updatedCompany);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid company data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Update company failed', { error, userId, companyId });
      throw new AppError(500, 'Failed to update company', 'COMPANY_UPDATE_ERROR');
    }
  }

  /**
   * Get company profile with details
   */
  async getCompanyProfile(companyId: string, userId?: string) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          employerProfiles: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  profilePicture: true
                }
              }
            }
          },
          jobs: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              title: true,
              location: true,
              jobType: true,
              salary: true,
              createdAt: true,
              _count: {
                select: { applications: true }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          _count: {
            select: {
              jobs: true,
              employerProfiles: true
            }
          }
        }
      });

      if (!company) {
        throw new AppError(404, 'Company not found', 'COMPANY_NOT_FOUND');
      }

      const transformedCompany = this.transformDetailedCompany(company);

      // If user is provided and they're part of this company, include sensitive data
      if (userId) {
        const userEmployerProfile = company.employerProfiles.find(ep => ep.userId === userId);
        if (userEmployerProfile) {
          transformedCompany.isCurrentUserEmployee = true;
          transformedCompany.currentUserRole = userEmployerProfile;
          transformedCompany.team = company.employerProfiles.map(this.transformEmployerProfile);
        }
      }

      return transformedCompany;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get company profile failed', { error, companyId });
      throw new AppError(500, 'Failed to retrieve company profile', 'COMPANY_RETRIEVAL_ERROR');
    }
  }

  /**
   * Search companies with filters
   */
  async searchCompanies(filters: z.infer<typeof companyFilterSchema>) {
    try {
      const validatedFilters = companyFilterSchema.parse(filters);
      const { page, limit, sortBy, sortOrder, ...filterParams } = validatedFilters;

      const skip = (page - 1) * limit;

      // Build filter conditions
      const where: any = {};

      if (filterParams.industry) {
        where.industry = { contains: filterParams.industry, mode: 'insensitive' };
      }

      if (filterParams.size && filterParams.size.length > 0) {
        where.size = { in: filterParams.size };
      }

      if (filterParams.province && filterParams.province.length > 0) {
        where.province = { in: filterParams.province };
      }

      if (filterParams.city) {
        where.city = { contains: filterParams.city, mode: 'insensitive' };
      }

      if (filterParams.verified !== undefined) {
        where.verified = filterParams.verified;
      }

      if (filterParams.hasJobs) {
        where.jobs = { some: { status: 'ACTIVE' } };
      }

      if (filterParams.search) {
        where.OR = [
          { name: { contains: filterParams.search, mode: 'insensitive' } },
          { description: { contains: filterParams.search, mode: 'insensitive' } },
          { industry: { contains: filterParams.search, mode: 'insensitive' } }
        ];
      }

      // Build sort order
      const orderBy: any = {};
      switch (sortBy) {
        case 'name':
          orderBy.name = sortOrder;
          break;
        case 'created_at':
          orderBy.createdAt = sortOrder;
          break;
        case 'job_count':
          orderBy.jobs = { _count: sortOrder };
          break;
        case 'size':
          orderBy.size = sortOrder;
          break;
        default:
          orderBy.name = 'asc';
      }

      const [companies, total] = await Promise.all([
        prisma.company.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            _count: {
              select: {
                jobs: { where: { status: 'ACTIVE' } },
                employerProfiles: true
              }
            }
          }
        }),
        prisma.company.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        companies: companies.map(company => ({
          ...this.transformCompany(company),
          activeJobsCount: company._count.jobs,
          employeesCount: company._count.employerProfiles
        })),
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
      logger.error('Search companies failed', { error });
      throw new AppError(500, 'Failed to search companies', 'COMPANY_SEARCH_ERROR');
    }
  }

  /**
   * Update employer profile
   */
  async updateEmployerProfile(userId: string, profileData: z.infer<typeof employerProfileSchema>) {
    try {
      const validatedData = employerProfileSchema.parse(profileData);

      const employerProfile = await prisma.employerProfile.findUnique({
        where: { userId }
      });

      if (!employerProfile) {
        throw new AppError(404, 'Employer profile not found', 'EMPLOYER_PROFILE_NOT_FOUND');
      }

      const updatedProfile = await prisma.employerProfile.update({
        where: { userId },
        data: validatedData
      });

      logger.info('Employer profile updated', { userId });

      return this.transformEmployerProfile(updatedProfile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid employer profile data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Update employer profile failed', { error, userId });
      throw new AppError(500, 'Failed to update employer profile', 'EMPLOYER_PROFILE_UPDATE_ERROR');
    }
  }

  /**
   * Invite team member to company
   */
  async inviteTeamMember(userId: string, companyId: string, email: string, position: string, permissions: string[]) {
    try {
      // Check if user has permission to manage team
      await this.checkCompanyPermission(userId, companyId, 'MANAGE_TEAM');

      // Check if invited user exists
      const invitedUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true }
      });

      if (!invitedUser) {
        throw new AppError(404, 'User with this email does not exist', 'USER_NOT_FOUND');
      }

      if (invitedUser.role !== 'EMPLOYER') {
        throw new AppError(400, 'User must be an employer to join a company', 'ROLE_MISMATCH');
      }

      // Check if user is already part of this company
      const existingProfile = await prisma.employerProfile.findUnique({
        where: { userId: invitedUser.id }
      });

      if (existingProfile && existingProfile.companyId === companyId) {
        throw new AppError(409, 'User is already part of this company', 'ALREADY_TEAM_MEMBER');
      }

      if (existingProfile && existingProfile.companyId !== companyId) {
        throw new AppError(409, 'User is already associated with another company', 'USER_HAS_COMPANY');
      }

      // Create employer profile for the invited user
      const employerProfile = await prisma.employerProfile.create({
        data: {
          userId: invitedUser.id,
          companyId,
          position,
          permissions,
          canPostJobs: permissions.includes('POST_JOBS')
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true
            }
          }
        }
      });

      logger.info('Team member invited', { userId, companyId, invitedUserId: invitedUser.id });

      return this.transformEmployerProfile(employerProfile);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Invite team member failed', { error, userId, companyId });
      throw new AppError(500, 'Failed to invite team member', 'TEAM_INVITE_ERROR');
    }
  }

  /**
   * Remove team member from company
   */
  async removeTeamMember(userId: string, companyId: string, memberUserId: string) {
    try {
      // Check if user has permission to manage team
      await this.checkCompanyPermission(userId, companyId, 'MANAGE_TEAM');

      // Cannot remove self
      if (userId === memberUserId) {
        throw new AppError(400, 'Cannot remove yourself from the company', 'CANNOT_REMOVE_SELF');
      }

      const memberProfile = await prisma.employerProfile.findFirst({
        where: {
          userId: memberUserId,
          companyId
        }
      });

      if (!memberProfile) {
        throw new AppError(404, 'Team member not found', 'TEAM_MEMBER_NOT_FOUND');
      }

      await prisma.employerProfile.delete({
        where: { id: memberProfile.id }
      });

      logger.info('Team member removed', { userId, companyId, removedUserId: memberUserId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Remove team member failed', { error, userId, companyId });
      throw new AppError(500, 'Failed to remove team member', 'TEAM_REMOVE_ERROR');
    }
  }

  /**
   * Get company statistics
   */
  async getCompanyStats(userId: string, companyId: string) {
    try {
      await this.checkCompanyPermission(userId, companyId, 'VIEW_ANALYTICS');

      const [
        totalJobs,
        activeJobs,
        totalApplications,
        recentApplications,
        topPerformingJobs
      ] = await Promise.all([
        prisma.job.count({ where: { companyId } }),
        prisma.job.count({ where: { companyId, status: 'ACTIVE' } }),
        prisma.jobApplication.count({
          where: { job: { companyId } }
        }),
        prisma.jobApplication.count({
          where: {
            job: { companyId },
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        }),
        prisma.job.findMany({
          where: { companyId, status: 'ACTIVE' },
          select: {
            id: true,
            title: true,
            _count: {
              select: { applications: true }
            }
          },
          orderBy: {
            applications: { _count: 'desc' }
          },
          take: 5
        })
      ]);

      return {
        jobs: {
          total: totalJobs,
          active: activeJobs,
          inactive: totalJobs - activeJobs
        },
        applications: {
          total: totalApplications,
          recent: recentApplications
        },
        topJobs: topPerformingJobs.map(job => ({
          id: job.id,
          title: job.title,
          applicationsCount: job._count.applications
        }))
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get company stats failed', { error, userId, companyId });
      throw new AppError(500, 'Failed to retrieve company statistics', 'COMPANY_STATS_ERROR');
    }
  }

  /**
   *  MAGIC: Analyze company culture using AI
   */
  async analyzeCompanyCulture(companyId: string, userId?: string): Promise<CompanyCultureAnalysis> {
    try {
      logger.info(' Analyzing company culture', { companyId });

      // Get comprehensive company data
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          jobs: {
            include: {
              jobApplications: {
                include: {
                  applicationTracking: true
                },
                orderBy: { createdAt: 'desc' },
                take: 100
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
          },
          employerProfiles: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  linkedinUrl: true
                }
              }
            }
          },
          _count: {
            select: {
              jobs: true,
              employerProfiles: true
            }
          }
        }
      });

      if (!company) {
        throw new AppError(404, 'Company not found', 'COMPANY_NOT_FOUND');
      }

      // Analyze culture using multiple data sources
      const [cultureAnalysis, hiringPatterns, employeeInsights] = await Promise.all([
        this.analyzeCompanyCultureFromText(company),
        this.analyzeHiringPatterns(company),
        this.analyzeEmployeeInsights(company)
      ]);

      // Generate AI-powered should apply advice
      const shouldApplyAdvice = await this.generateShouldApplyAdvice(
        company,
        cultureAnalysis,
        hiringPatterns,
        userId
      );

      const dataConfidence = this.calculateDataConfidence(company);

      return {
        companyId: company.id,
        companyName: company.name,
        cultureScore: cultureAnalysis.overallScore,
        cultureType: cultureAnalysis.type,
        cultureInsights: cultureAnalysis.insights,
        hiringPatterns,
        employeeInsights,
        shouldApplyAdvice,
        dataConfidence,
        lastUpdated: new Date()
      };

    } catch (error) {
      logger.error('Failed to analyze company culture', { error, companyId });
      throw error instanceof AppError ? error : new AppError(500, 'Failed to analyze company culture', 'CULTURE_ANALYSIS_ERROR');
    }
  }

  /**
   *  MAGIC: Get interview intelligence for company
   */
  async getInterviewIntelligence(companyId: string): Promise<InterviewIntelligence> {
    try {
      logger.info(' Gathering interview intelligence', { companyId });

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          jobs: {
            include: {
              jobApplications: {
                where: {
                  status: { in: ['INTERVIEWING', 'OFFER', 'HIRED'] }
                },
                select: {
                  status: true,
                  createdAt: true,
                  interviewDate: true,
                  feedback: true
                }
              }
            },
            take: 50
          }
        }
      });

      if (!company) {
        throw new AppError(404, 'Company not found', 'COMPANY_NOT_FOUND');
      }

      // Analyze interview process from application data
      const processAnalysis = this.analyzeInterviewProcess(company);
      
      // Generate AI-powered common questions
      const commonQuestions = await this.generateCommonInterviewQuestions(company);
      
      // Identify decision factors
      const decisionFactors = this.identifyDecisionFactors(company);
      
      // Generate success tips
      const successTips = await this.generateInterviewSuccessTips(company);
      
      // Identify red flags
      const redFlags = this.identifyInterviewRedFlags(company);

      return {
        companyId: company.id,
        interviewProcess: processAnalysis,
        commonQuestions,
        decisionFactors,
        successTips,
        redFlags
      };

    } catch (error) {
      logger.error('Failed to get interview intelligence', { error, companyId });
      throw error instanceof AppError ? error : new AppError(500, 'Failed to get interview intelligence', 'INTERVIEW_INTELLIGENCE_ERROR');
    }
  }

  /**
   *  MAGIC: Analyze hiring patterns
   */
  async getHiringPatternAnalysis(companyId: string): Promise<HiringPatternAnalysis> {
    try {
      logger.info(' Analyzing hiring patterns', { companyId });

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          jobs: {
            include: {
              jobApplications: {
                include: {
                  applicationTracking: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 200 // Analyze more jobs for better patterns
          }
        }
      });

      if (!company) {
        throw new AppError(404, 'Company not found', 'COMPANY_NOT_FOUND');
      }

      // Analyze recruitment cycles
      const recruitmentCycle = this.analyzeRecruitmentCycle(company.jobs);
      
      // Calculate application metrics
      const applicationMetrics = this.calculateApplicationMetrics(company.jobs);
      
      // Perform competitive analysis
      const competitiveAnalysis = await this.performCompetitiveAnalysis(company);

      return {
        companyId: company.id,
        recruitmentCycle,
        applicationMetrics,
        competitiveAnalysis
      };

    } catch (error) {
      logger.error('Failed to analyze hiring patterns', { error, companyId });
      throw error instanceof AppError ? error : new AppError(500, 'Failed to analyze hiring patterns', 'HIRING_PATTERN_ERROR');
    }
  }

  /**
   *  MAGIC: Generate "Should I Apply?" recommendation
   */
  async getShouldApplyRecommendation(companyId: string, userId: string): Promise<{
    recommendation: string;
    score: number;
    reasoning: string[];
    pros: string[];
    cons: string[];
    confidence: number;
  }> {
    try {
      logger.info(' Generating should apply recommendation', { companyId, userId });

      // Get user profile
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId },
        include: {
          experiences: true,
          educations: true,
          skills: { include: { skill: true } },
          jobApplications: {
            include: {
              job: { include: { company: true } },
              applicationTracking: true
            }
          }
        }
      });

      if (!userProfile) {
        throw new AppError(404, 'User profile not found', 'USER_PROFILE_NOT_FOUND');
      }

      // Get company culture analysis
      const cultureAnalysis = await this.analyzeCompanyCulture(companyId, userId);
      
      // Calculate compatibility score
      const compatibility = await this.calculateUserCompanyCompatibility(userProfile, cultureAnalysis);
      
      // Generate personalized recommendation
      const recommendation = this.generatePersonalizedRecommendation(compatibility, cultureAnalysis);

      return recommendation;

    } catch (error) {
      logger.error('Failed to generate should apply recommendation', { error, companyId, userId });
      throw error instanceof AppError ? error : new AppError(500, 'Failed to generate recommendation', 'RECOMMENDATION_ERROR');
    }
  }

  /**
   * Check if user has permission for company action
   */
  private async checkCompanyPermission(userId: string, companyId: string, permission: string) {
    const employerProfile = await prisma.employerProfile.findFirst({
      where: { userId, companyId }
    });

    if (!employerProfile) {
      throw new AppError(403, 'Access denied - not associated with this company', 'ACCESS_DENIED');
    }

    if (!employerProfile.permissions.includes(permission)) {
      throw new AppError(403, `Access denied - missing permission: ${permission}`, 'INSUFFICIENT_PERMISSIONS');
    }

    return employerProfile;
  }

  /**
   * Transform company for API response
   */
  private transformCompany(company: any) {
    return {
      id: company.id,
      name: company.name,
      description: company.description,
      logo: company.logo,
      website: company.website,
      industry: company.industry,
      size: company.size,
      foundedYear: company.foundedYear,
      headquarters: company.headquarters,
      location: {
        province: company.province,
        city: company.city,
        address: company.address
      },
      contact: {
        phone: company.phone,
        email: company.email
      },
      socialMedia: {
        linkedin: company.linkedinUrl,
        twitter: company.twitterUrl,
        facebook: company.facebookUrl
      },
      benefits: company.benefits || [],
      values: company.values || [],
      culture: company.culture,
      verified: company.verified,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString()
    };
  }

  /**
   * Transform detailed company for API response
   */
  private transformDetailedCompany(company: any) {
    return {
      ...this.transformCompany(company),
      stats: {
        totalJobs: company._count?.jobs || 0,
        totalEmployees: company._count?.employerProfiles || 0
      },
      recentJobs: company.jobs?.map((job: any) => ({
        id: job.id,
        title: job.title,
        location: job.location,
        jobType: job.jobType,
        salary: job.salary,
        applicationsCount: job._count?.applications || 0,
        createdAt: job.createdAt.toISOString()
      })) || []
    };
  }

  /**
   * Transform employer profile for API response
   */
  private transformEmployerProfile(profile: any) {
    return {
      id: profile.id,
      position: profile.position,
      department: profile.department,
      isRecruiter: profile.isRecruiter,
      canPostJobs: profile.canPostJobs,
      permissions: profile.permissions || [],
      user: profile.user ? {
        id: profile.user.id,
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
        profilePicture: profile.user.profilePicture
      } : undefined,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString()
    };
  }

  //  MAGIC: Stub methods for missing culture intelligence features
  async analyzeCultureIntelligence(companyId: string): Promise<any> {
    // TODO: Implement actual culture intelligence analysis
    return {
      cultureProfile: {
        cultureScore: 0.8,
        cultureType: 'innovative',
        cultureInsights: {
          workLifeBalance: 0.8,
          innovation: 0.9,
          collaboration: 0.7,
          diversity: 0.6,
          growth: 0.8,
          leadership: 0.7
        }
      },
      hiringPatterns: {
        averageHiringTime: 21,
        responseRate: 0.75,
        interviewProcess: 'Standard 3-stage process',
        commonRequirements: ['Experience', 'Cultural fit'],
        salaryCompetitiveness: 'high'
      },
      interviewInsights: {
        stages: [
          {
            stage: 'Initial Screening',
            duration: '30 minutes',
            description: 'Phone/video call screening',
            tips: ['Be prepared to discuss your experience']
          }
        ],
        averageDuration: '2-3 weeks',
        difficultyLevel: 'moderate'
      }
    };
  }

  async shouldUserApply(userId: string, companyId: string): Promise<any> {
    // TODO: Implement actual user-company compatibility analysis
    return {
      recommendation: 'recommend',
      reasoning: ['Good culture fit', 'Skills alignment'],
      confidence: 0.8
    };
  }
}

export default new CompanyProfileService();
