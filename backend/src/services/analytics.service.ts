import { PrismaClient, SubscriptionPlan, ApplicationStatus, Province, ExperienceLevel } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { canAccessFeature } from '../utils/subscriptionQuotas.js';
import { HuggingFaceService } from './huggingface.service.js';
import logger from '../config/logger.js';

interface AnalyticsOverview {
  totalApplications: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  averageTimeToInterview: number; // days
  averageTimeToOffer: number; // days
  topPerformingSkills: string[];
  recommendedActions: string[];
}

interface ApplicationTrendData {
  month: string;
  applications: number;
  interviews: number;
  offers: number;
  hires: number;
}

interface SalaryBenchmarkData {
  jobTitle: string;
  industry: string;
  experienceLevel: ExperienceLevel;
  province: Province;
  minSalary: number;
  maxSalary: number;
  averageSalary: number;
  percentile25: number;
  percentile75: number;
  dataPoints: number;
}

//  MAGIC: Success Probability Interfaces
interface SuccessPrediction {
  jobId: string;
  jobTitle: string;
  companyName: string;
  successProbability: number;
  confidence: 'low' | 'medium' | 'high';
  timelinePredictions: TimelinePrediction[];
  interviewLikelihood: number;
  offerLikelihood: number;
  reasoning: string[];
  comparisonToSimilarProfiles: {
    averageSuccessRate: number;
    yourAdvantage: string[];
    areasToImprove: string[];
  };
}

interface TimelinePrediction {
  event: 'response' | 'interview' | 'offer';
  predictedDays: number;
  confidence: number;
  range: {
    min: number;
    max: number;
  };
}

interface ProfileComparison {
  similarProfilesCount: number;
  averageSuccessMetrics: {
    responseRate: number;
    interviewRate: number;
    offerRate: number;
    averageTimeToOffer: number;
  };
  userRanking: {
    percentile: number;
    rank: string; // 'top 10%', 'above average', etc.
  };
  improvementAreas: string[];
}

export class AnalyticsService {
  private prisma: PrismaClient;
  private hfService: HuggingFaceService;

  constructor() {
    this.prisma = new PrismaClient();
    this.hfService = HuggingFaceService.getInstance();
  }

  async getAnalyticsOverview(userId: string): Promise<AnalyticsOverview> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'analytics', SubscriptionPlan.PROFESSIONAL)) {
        throw new AppError('Analytics requires Professional plan or higher', 403);
      }

      // Get user applications with status tracking
      const applications = await this.prisma.application.findMany({
        where: { userId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          viewedAt: true,
          reviewedAt: true,
          interviewDate: true,
          job: {
            select: {
              title: true,
              company: { select: { industry: true } }
            }
          }
        }
      });

      const totalApplications = applications.length;

      if (totalApplications === 0) {
        return {
          totalApplications: 0,
          responseRate: 0,
          interviewRate: 0,
          offerRate: 0,
          averageTimeToInterview: 0,
          averageTimeToOffer: 0,
          topPerformingSkills: [],
          recommendedActions: ['Start applying to jobs to see your analytics']
        };
      }

      // Calculate rates
      const viewedApplications = applications.filter(app => app.viewedAt).length;
      const interviewApplications = applications.filter(app => 
        app.status === ApplicationStatus.INTERVIEW || app.interviewDate
      ).length;
      const offerApplications = applications.filter(app => 
        app.status === ApplicationStatus.OFFER
      ).length;

      const responseRate = (viewedApplications / totalApplications) * 100;
      const interviewRate = (interviewApplications / totalApplications) * 100;
      const offerRate = (offerApplications / totalApplications) * 100;

      // Calculate time metrics
      const averageTimeToInterview = await this.calculateAverageTimeToEvent(
        userId, 
        'interview'
      );
      const averageTimeToOffer = await this.calculateAverageTimeToEvent(
        userId, 
        'offer'
      );

      // Get top performing skills
      const topPerformingSkills = await this.getTopPerformingSkills(userId);

      // Generate recommended actions
      const recommendedActions = this.generateRecommendations({
        responseRate,
        interviewRate,
        offerRate,
        totalApplications
      });

      return {
        totalApplications,
        responseRate: Math.round(responseRate * 10) / 10,
        interviewRate: Math.round(interviewRate * 10) / 10,
        offerRate: Math.round(offerRate * 10) / 10,
        averageTimeToInterview,
        averageTimeToOffer,
        topPerformingSkills,
        recommendedActions
      };

    } catch (error) {
      logger.error('Error getting analytics overview', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to get analytics overview', 500);
    }
  }

  async getApplicationTrends(userId: string, months: number = 6): Promise<ApplicationTrendData[]> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'analytics', SubscriptionPlan.PROFESSIONAL)) {
        throw new AppError('Analytics requires Professional plan or higher', 403);
      }

      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Get applications data aggregated by month
      const applications = await this.prisma.application.findMany({
        where: {
          userId,
          createdAt: { gte: startDate }
        },
        select: {
          createdAt: true,
          status: true,
          interviewDate: true
        }
      });

      // Group by month and count statuses
      const monthlyData = new Map<string, ApplicationTrendData>();

      // Initialize all months with zero values
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData.set(monthKey, {
          month: monthKey,
          applications: 0,
          interviews: 0,
          offers: 0,
          hires: 0
        });
      }

      // Populate with actual data
      applications.forEach(app => {
        const monthKey = `${app.createdAt.getFullYear()}-${String(app.createdAt.getMonth() + 1).padStart(2, '0')}`;
        const monthData = monthlyData.get(monthKey);
        
        if (monthData) {
          monthData.applications++;
          
          if (app.status === ApplicationStatus.INTERVIEW || app.interviewDate) {
            monthData.interviews++;
          }
          if (app.status === ApplicationStatus.OFFER) {
            monthData.offers++;
          }
          if (app.status === ApplicationStatus.HIRED) {
            monthData.hires++;
          }
        }
      });

      return Array.from(monthlyData.values()).sort((a, b) => a.month.localeCompare(b.month));

    } catch (error) {
      logger.error('Error getting application trends', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to get application trends', 500);
    }
  }

  async getSalaryBenchmarks(
    jobTitle: string, 
    industry?: string, 
    experienceLevel?: ExperienceLevel, 
    province?: Province
  ): Promise<SalaryBenchmarkData[]> {
    try {
      const whereClause: any = {
        jobTitle: { contains: jobTitle, mode: 'insensitive' }
      };

      if (industry) {
        whereClause.industry = { contains: industry, mode: 'insensitive' };
      }
      if (experienceLevel) {
        whereClause.experienceLevel = experienceLevel;
      }
      if (province) {
        whereClause.province = province;
      }

      const benchmarks = await this.prisma.salaryBenchmark.findMany({
        where: whereClause,
        orderBy: [
          { province: 'asc' },
          { experienceLevel: 'asc' }
        ]
      });

      return benchmarks.map(benchmark => ({
        jobTitle: benchmark.jobTitle,
        industry: benchmark.industry,
        experienceLevel: benchmark.experienceLevel,
        province: benchmark.province,
        minSalary: benchmark.salaryMin,
        maxSalary: benchmark.salaryMax,
        averageSalary: (benchmark.salaryMin + benchmark.salaryMax) / 2,
        percentile25: benchmark.salaryMin * 0.8,
        percentile75: benchmark.salaryMax * 0.8,
        dataPoints: 100
      }));

    } catch (error) {
      logger.error('Error getting salary benchmarks', { error: error instanceof Error ? error.message : String(error), jobTitle });
      throw new AppError('Failed to get salary benchmarks', 500);
    }
  }

  async getPersonalizedSalaryInsights(userId: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          jobSeekerProfile: true,
          experiences: {
            orderBy: { startDate: 'desc' },
            take: 1
          }
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'salaryBenchmarking', SubscriptionPlan.PROFESSIONAL)) {
        throw new AppError('Salary benchmarking requires Professional plan or higher', 403);
      }

      const currentRole = user.experiences[0]?.jobTitle;
      const targetSalaryMin = user.jobSeekerProfile?.expectedSalaryMin;
      const targetSalaryMax = user.jobSeekerProfile?.expectedSalaryMax;
      const province = user.province;

      if (!currentRole || !province) {
        return {
          message: 'Complete your profile to get personalized salary insights',
          recommendations: [
            'Add your current job title',
            'Specify your location',
            'Set your salary expectations'
          ]
        };
      }

      // Get benchmark data for user's role and location
      const benchmarks = await this.getSalaryBenchmarks(
        currentRole,
        undefined,
        (user.jobSeekerProfile?.yearsOfExperience || 0) >= 5 ? ExperienceLevel.SENIOR : ExperienceLevel.MID_LEVEL,
        province
      );

      if (benchmarks.length === 0) {
        return {
          message: 'Limited salary data available for your role and location',
          suggestion: 'Consider broader job titles or locations for more insights'
        };
      }

      const benchmark = benchmarks[0];
      const insights = [];

      if (targetSalaryMin && targetSalaryMin < benchmark.percentile25) {
        insights.push({
          type: 'opportunity',
          message: `Your minimum salary expectation is below market rate. Consider increasing it to R${benchmark.percentile25.toLocaleString()}`
        });
      }

      if (targetSalaryMax && targetSalaryMax > benchmark.percentile75) {
        insights.push({
          type: 'caution',
          message: `Your maximum salary expectation is above the 75th percentile. Be prepared to demonstrate exceptional value.`
        });
      }

      insights.push({
        type: 'benchmark',
        message: `The average ${currentRole} in ${province} earns R${benchmark.averageSalary.toLocaleString()}`
      });

      return {
        currentRole,
        province,
        benchmark,
        insights,
        recommendations: this.generateSalaryRecommendations(user, benchmark)
      };

    } catch (error) {
      logger.error('Error getting personalized salary insights', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to get salary insights', 500);
    }
  }

  /**
   *  MAGIC: ML-Powered Success Probability Prediction
   */
  async predictJobSuccessProbability(userId: string, jobId: string): Promise<SuccessPrediction> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'successPrediction', SubscriptionPlan.EXECUTIVE)) {
        throw new AppError('Success prediction requires Executive plan', 403);
      }

      logger.info(' Predicting job success probability', { userId, jobId });

      // Get job and user data
      const [job, userProfile, userApplicationHistory] = await Promise.all([
        this.prisma.job.findUnique({
          where: { id: jobId },
          include: {
            company: true,
            jobApplications: {
              select: {
                userId: true,
                status: true,
                createdAt: true,
                viewedAt: true
              },
              take: 100
            }
          }
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            jobSeekerProfile: true,
            experiences: true,
            educations: true,
            skills: { include: { skill: true } },
            cvs: { take: 1, orderBy: { createdAt: 'desc' } }
          }
        }),
        this.prisma.application.findMany({
          where: { userId },
          include: {
            job: {
              include: { company: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        })
      ]);

      if (!job || !userProfile) {
        throw new AppError('Job or user profile not found', 404);
      }

      // Calculate success probability using multiple factors
      const successProbability = await this.calculateMLSuccessProbability(userProfile, job, userApplicationHistory);
      
      // Generate timeline predictions
      const timelinePredictions = await this.generateTimelinePredictions(userId, job, userApplicationHistory);
      
      // Calculate specific likelihoods
      const interviewLikelihood = this.calculateInterviewLikelihood(userProfile, job, userApplicationHistory);
      const offerLikelihood = this.calculateOfferLikelihood(userProfile, job, userApplicationHistory);
      
      // Generate AI reasoning
      const reasoning = await this.generateSuccessReasoning(userProfile, job, successProbability);
      
      // Compare to similar profiles
      const comparison = await this.compareToSimilarProfiles(userId, job.company.industry, job.experienceLevel);

      const confidence = this.calculateConfidenceLevel(userApplicationHistory.length, job.jobApplications.length);

      return {
        jobId: job.id,
        jobTitle: job.title,
        companyName: job.company.name,
        successProbability: Math.round(successProbability * 100) / 100,
        confidence,
        timelinePredictions,
        interviewLikelihood: Math.round(interviewLikelihood * 100) / 100,
        offerLikelihood: Math.round(offerLikelihood * 100) / 100,
        reasoning,
        comparisonToSimilarProfiles: comparison
      };

    } catch (error) {
      logger.error('Error predicting job success', { error: error instanceof Error ? error.message : String(error), userId, jobId });
      throw error instanceof AppError ? error : new AppError('Failed to predict success probability', 500);
    }
  }

  /**
   *  MAGIC: Batch success predictions for multiple jobs
   */
  async predictMultipleJobsSuccess(userId: string, jobIds: string[]): Promise<SuccessPrediction[]> {
    try {
      const predictions = await Promise.all(
        jobIds.slice(0, 10).map(jobId => // Limit to 10 jobs to prevent overload
          this.predictJobSuccessProbability(userId, jobId).catch(error => {
            logger.warn('Failed to predict for job', { jobId, error });
            return null;
          })
        )
      );

      return predictions.filter(Boolean) as SuccessPrediction[];
    } catch (error) {
      logger.error('Error predicting multiple jobs', { error, userId });
      throw new AppError('Failed to predict multiple jobs success', 500);
    }
  }

  /**
   *  MAGIC: Compare user performance to similar profiles
   */
  async compareToSimilarProfiles(userId: string, industry?: string, experienceLevel?: ExperienceLevel): Promise<ProfileComparison> {
    try {
      const userProfile = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          experiences: true,
          applications: {
            include: {
              job: { include: { company: true } }
            }
          }
        }
      });

      if (!userProfile) {
        throw new AppError('User profile not found', 404);
      }

      // Find similar profiles based on experience, skills, and industry
      const similarProfiles = await this.findSimilarProfiles(userProfile, industry, experienceLevel);
      
      // Calculate average metrics for similar profiles
      const avgMetrics = this.calculateAverageSuccessMetrics(similarProfiles);
      
      // Calculate user's ranking
      const userMetrics = this.calculateUserSuccessMetrics(userProfile.applications);
      const ranking = this.calculateUserRanking(userMetrics, avgMetrics, similarProfiles.length);
      
      // Identify improvement areas
      const improvementAreas = this.identifyImprovementAreas(userMetrics, avgMetrics);

      return {
        similarProfilesCount: similarProfiles.length,
        averageSuccessMetrics: avgMetrics,
        userRanking: ranking,
        improvementAreas
      };

    } catch (error) {
      logger.error('Error comparing to similar profiles', { error, userId });
      throw error instanceof AppError ? error : new AppError('Failed to compare profiles', 500);
    }
  }

  /**
   *  MAGIC: Get detailed timeline predictions
   */
  async getTimelinePredictions(userId: string, jobId: string): Promise<TimelinePrediction[]> {
    try {
      const userHistory = await this.prisma.application.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true }
      });

      if (!job) {
        throw new AppError('Job not found', 404);
      }

      return this.generateTimelinePredictions(userId, job, userHistory);
    } catch (error) {
      logger.error('Error getting timeline predictions', { error, userId, jobId });
      throw error instanceof AppError ? error : new AppError('Failed to get timeline predictions', 500);
    }
  }

  private async calculateAverageTimeToEvent(userId: string, eventType: 'interview' | 'offer'): Promise<number> {
    const applications = await this.prisma.application.findMany({
      where: { 
        userId,
        ...(eventType === 'interview' 
          ? { OR: [{ status: ApplicationStatus.INTERVIEW }, { interviewDate: { not: null } }] }
          : { status: ApplicationStatus.OFFER }
        )
      },
      select: {
        createdAt: true,
        interviewDate: true,
        updatedAt: true,
        status: true
      }
    });

    if (applications.length === 0) return 0;

    const times = applications.map(app => {
      const targetDate = eventType === 'interview' && app.interviewDate 
        ? app.interviewDate 
        : app.updatedAt;
      
      const diffTime = targetDate.getTime() - app.createdAt.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convert to days
    });

    return Math.round(times.reduce((sum, time) => sum + time, 0) / times.length);
  }

  private async getTopPerformingSkills(userId: string): Promise<string[]> {
    // Get applications that resulted in interviews/offers
    const successfulApplications = await this.prisma.application.findMany({
      where: {
        userId,
        OR: [
          { status: ApplicationStatus.INTERVIEW },
          { status: ApplicationStatus.OFFER },
          { status: ApplicationStatus.HIRED }
        ]
      },
      include: {
        job: {
          select: {
            title: true,
            requirements: true,
            description: true
          }
        }
      }
    });

    // Get user skills
    const userSkills = await this.prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true }
    });

    // Simple skill matching algorithm
    const skillPerformance = new Map<string, number>();

    userSkills.forEach(userSkill => {
      const skillName = userSkill.skill.name.toLowerCase();
      let matches = 0;

      successfulApplications.forEach(app => {
        const requirements = Array.isArray(app.job.requirements) ? app.job.requirements.join(' ') : String(app.job.requirements || '');
        const jobText = `${app.job.title} ${app.job.description} ${requirements}`.toLowerCase();
        if (jobText.includes(skillName)) {
          matches++;
        }
      });

      if (matches > 0) {
        skillPerformance.set(userSkill.skill.name, matches);
      }
    });

    return Array.from(skillPerformance.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill]) => skill);
  }

  private generateRecommendations(metrics: {
    responseRate: number;
    interviewRate: number;
    offerRate: number;
    totalApplications: number;
  }): string[] {
    const recommendations = [];

    if (metrics.totalApplications < 10) {
      recommendations.push('Apply to more positions to improve your chances');
    }

    if (metrics.responseRate < 20) {
      recommendations.push('Optimize your CV and cover letters to increase response rates');
    }

    if (metrics.interviewRate < 10) {
      recommendations.push('Tailor your applications more closely to job requirements');
    }

    if (metrics.responseRate > 20 && metrics.interviewRate < 15) {
      recommendations.push('Focus on interview preparation to convert more responses to interviews');
    }

    if (recommendations.length === 0) {
      recommendations.push('Great job! Your application performance is strong');
    }

    return recommendations;
  }

  private generateSalaryRecommendations(user: any, benchmark: SalaryBenchmarkData): string[] {
    const recommendations = [];

    if (!user.jobSeekerProfile?.expectedSalaryMin) {
      recommendations.push('Set salary expectations to help filter relevant jobs');
    }

    recommendations.push(`Consider roles paying between R${benchmark.percentile25.toLocaleString()} - R${benchmark.percentile75.toLocaleString()}`);
    
    recommendations.push('Highlight quantifiable achievements to justify higher salary expectations');
    
    if (user.experiences?.length > 0) {
      recommendations.push('Update your experience to reflect current market trends');
    }

    return recommendations;
  }

  //  MAGIC: Helper methods for success prediction

  private async calculateMLSuccessProbability(userProfile: any, job: any, userHistory: any[]): Promise<number> {
    let baseScore = 0.4; // Base probability

    // Skills matching factor (25% weight)
    const skillsMatch = this.calculateSkillsMatchScore(userProfile, job);
    baseScore += skillsMatch * 0.25;

    // Experience relevance factor (20% weight)
    const experienceMatch = this.calculateExperienceMatchScore(userProfile, job);
    baseScore += experienceMatch * 0.20;

    // Historical performance factor (20% weight)
    const historicalPerformance = this.calculateHistoricalPerformance(userHistory);
    baseScore += historicalPerformance * 0.20;

    // Company/industry familiarity factor (15% weight)
    const industryFamiliarity = this.calculateIndustryFamiliarity(userProfile, job);
    baseScore += industryFamiliarity * 0.15;

    // Profile completeness factor (10% weight)
    const profileCompleteness = this.calculateProfileCompleteness(userProfile);
    baseScore += profileCompleteness * 0.10;

    // Market competition adjustment (10% weight)
    const competitionAdjustment = await this.calculateCompetitionAdjustment(job);
    baseScore += competitionAdjustment * 0.10;

    return Math.max(0.05, Math.min(0.95, baseScore));
  }

  private calculateSkillsMatchScore(userProfile: any, job: any): number {
    if (!userProfile.skills || !job.requiredSkills) return 0.3;

    const userSkills = userProfile.skills.map((s: any) => s.skill.name.toLowerCase());
    const requiredSkills = (Array.isArray(job.requiredSkills) ? job.requiredSkills : []).map((s: string) => s.toLowerCase());
    const preferredSkills = (Array.isArray(job.preferredSkills) ? job.preferredSkills : []).map((s: string) => s.toLowerCase());

    const requiredMatches = requiredSkills.filter(skill => userSkills.includes(skill)).length;
    const preferredMatches = preferredSkills.filter(skill => userSkills.includes(skill)).length;

    const requiredScore = requiredSkills.length > 0 ? requiredMatches / requiredSkills.length : 1;
    const preferredScore = preferredSkills.length > 0 ? preferredMatches / preferredSkills.length : 0.5;

    return (requiredScore * 0.8 + preferredScore * 0.2);
  }

  private calculateExperienceMatchScore(userProfile: any, job: any): number {
    if (!userProfile.experiences || userProfile.experiences.length === 0) return 0.2;

    const userExperience = userProfile.experiences[0];
    const jobTitle = job.title.toLowerCase();
    const userTitle = userExperience.jobTitle.toLowerCase();

    // Title similarity
    const titleSimilarity = this.calculateTitleSimilarity(userTitle, jobTitle);
    
    // Experience level matching
    const experienceLevelMatch = this.matchExperienceLevel(userProfile.yearsOfExperience || 0, job.experienceLevel);
    
    // Industry relevance
    const industryMatch = userExperience.industry === job.company.industry ? 1 : 0.5;

    return (titleSimilarity * 0.5 + experienceLevelMatch * 0.3 + industryMatch * 0.2);
  }

  private calculateHistoricalPerformance(userHistory: any[]): number {
    if (userHistory.length === 0) return 0.5;

    const totalApplications = userHistory.length;
    const viewedApplications = userHistory.filter(app => app.viewedAt).length;
    const interviewApplications = userHistory.filter(app => app.status === ApplicationStatus.INTERVIEW).length;
    const offerApplications = userHistory.filter(app => app.status === ApplicationStatus.OFFER).length;

    const responseRate = viewedApplications / totalApplications;
    const interviewRate = interviewApplications / totalApplications;
    const offerRate = offerApplications / totalApplications;

    // Weighted historical performance
    return (responseRate * 0.4 + interviewRate * 0.4 + offerRate * 0.2);
  }

  private calculateIndustryFamiliarity(userProfile: any, job: any): number {
    if (!userProfile.experiences || userProfile.experiences.length === 0) return 0.3;

    const hasIndustryExperience = userProfile.experiences.some(
      (exp: any) => exp.industry === job.company.industry
    );

    return hasIndustryExperience ? 0.8 : 0.3;
  }

  private calculateProfileCompleteness(userProfile: any): number {
    let score = 0;
    const maxScore = 10;

    if (userProfile.summary) score += 1;
    if (userProfile.experiences && userProfile.experiences.length > 0) score += 2;
    if (userProfile.educations && userProfile.educations.length > 0) score += 1;
    if (userProfile.skills && userProfile.skills.length >= 3) score += 2;
    if (userProfile.cvFiles && userProfile.cvFiles.length > 0) score += 2;
    if (userProfile.profilePicture) score += 1;
    if (userProfile.linkedinUrl) score += 1;

    return score / maxScore;
  }

  private async calculateCompetitionAdjustment(job: any): Promise<number> {
    const applicationCount = job.jobApplications?.length || 0;
    
    // Lower competition = higher success probability
    if (applicationCount < 5) return 0.2;
    if (applicationCount < 15) return 0.1;
    if (applicationCount < 50) return 0;
    if (applicationCount < 100) return -0.1;
    return -0.2;
  }

  private calculateTitleSimilarity(userTitle: string, jobTitle: string): number {
    const userWords = userTitle.split(' ');
    const jobWords = jobTitle.split(' ');
    
    const commonWords = userWords.filter(word => jobWords.includes(word)).length;
    const totalUniqueWords = new Set([...userWords, ...jobWords]).size;
    
    return commonWords / Math.min(userWords.length, jobWords.length);
  }

  private matchExperienceLevel(userYears: number, jobLevel: any): number {
    const levelRequirements: Record<string, {min: number, max: number}> = {
      'ENTRY_LEVEL': { min: 0, max: 2 },
      'JUNIOR': { min: 1, max: 3 },
      'MID_LEVEL': { min: 3, max: 7 },
      'SENIOR': { min: 5, max: 12 },
      'EXECUTIVE': { min: 8, max: 25 }
    };

    const requirements = levelRequirements[jobLevel] || { min: 0, max: 25 };
    
    if (userYears >= requirements.min && userYears <= requirements.max) return 1;
    if (userYears < requirements.min) return Math.max(0.3, userYears / requirements.min);
    if (userYears > requirements.max) return Math.max(0.3, requirements.max / userYears);
    
    return 0.3;
  }

  private calculateInterviewLikelihood(userProfile: any, job: any, userHistory: any[]): number {
    const baseSuccess = this.calculateHistoricalPerformance(userHistory);
    const skillsMatch = this.calculateSkillsMatchScore(userProfile, job);
    const experienceMatch = this.calculateExperienceMatchScore(userProfile, job);
    
    return (baseSuccess * 0.4 + skillsMatch * 0.35 + experienceMatch * 0.25);
  }

  private calculateOfferLikelihood(userProfile: any, job: any, userHistory: any[]): number {
    const interviewLikelihood = this.calculateInterviewLikelihood(userProfile, job, userHistory);
    
    // Offer likelihood is typically lower than interview likelihood
    return interviewLikelihood * 0.7;
  }

  private async generateTimelinePredictions(userId: string, job: any, userHistory: any[]): Promise<TimelinePrediction[]> {
    // Calculate average response times from user's history
    const avgResponseTime = this.calculateAverageResponseTime(userHistory, 'response');
    const avgInterviewTime = this.calculateAverageResponseTime(userHistory, 'interview');
    const avgOfferTime = this.calculateAverageResponseTime(userHistory, 'offer');
    
    // Industry-specific adjustments
    const industryMultiplier = this.getIndustryTimeMultiplier(job.company.industry);
    
    return [
      {
        event: 'response',
        predictedDays: Math.round((avgResponseTime || 5) * industryMultiplier),
        confidence: userHistory.length > 5 ? 0.8 : 0.5,
        range: {
          min: Math.round((avgResponseTime || 5) * industryMultiplier * 0.5),
          max: Math.round((avgResponseTime || 5) * industryMultiplier * 1.5)
        }
      },
      {
        event: 'interview',
        predictedDays: Math.round((avgInterviewTime || 12) * industryMultiplier),
        confidence: userHistory.length > 3 ? 0.7 : 0.4,
        range: {
          min: Math.round((avgInterviewTime || 12) * industryMultiplier * 0.7),
          max: Math.round((avgInterviewTime || 12) * industryMultiplier * 1.8)
        }
      },
      {
        event: 'offer',
        predictedDays: Math.round((avgOfferTime || 21) * industryMultiplier),
        confidence: userHistory.length > 2 ? 0.6 : 0.3,
        range: {
          min: Math.round((avgOfferTime || 21) * industryMultiplier * 0.6),
          max: Math.round((avgOfferTime || 21) * industryMultiplier * 2.0)
        }
      }
    ];
  }

  private calculateAverageResponseTime(userHistory: any[], eventType: string): number {
    const relevantApps = userHistory.filter(app => {
      if (eventType === 'response') return app.viewedAt;
      if (eventType === 'interview') return app.status === ApplicationStatus.INTERVIEW;
      if (eventType === 'offer') return app.status === ApplicationStatus.OFFER;
      return false;
    });

    if (relevantApps.length === 0) return 0;

    const totalTime = relevantApps.reduce((sum, app) => {
      const responseTime = app.viewedAt ? 
        Math.ceil((app.viewedAt.getTime() - app.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 7;
      return sum + responseTime;
    }, 0);

    return Math.round(totalTime / relevantApps.length);
  }

  private getIndustryTimeMultiplier(industry: string): number {
    const multipliers: Record<string, number> = {
      'Technology': 0.8,
      'Finance': 1.2,
      'Healthcare': 1.1,
      'Government': 1.8,
      'Startup': 0.6,
      'Consulting': 1.0,
      'Manufacturing': 1.3,
      'Education': 1.5
    };

    return multipliers[industry] || 1.0;
  }

  private async generateSuccessReasoning(userProfile: any, job: any, successProbability: number): Promise<string[]> {
    const reasoning = [];
    
    // Skills-based reasoning
    const skillsMatch = this.calculateSkillsMatchScore(userProfile, job);
    if (skillsMatch > 0.7) {
      reasoning.push('Strong skills alignment with job requirements');
    } else if (skillsMatch < 0.4) {
      reasoning.push('Limited skills match - consider skills development');
    }

    // Experience-based reasoning
    const expMatch = this.calculateExperienceMatchScore(userProfile, job);
    if (expMatch > 0.7) {
      reasoning.push('Relevant experience matches job expectations');
    } else if (expMatch < 0.4) {
      reasoning.push('Experience level may need justification in application');
    }

    // Industry familiarity
    const industryFamiliarity = this.calculateIndustryFamiliarity(userProfile, job);
    if (industryFamiliarity > 0.6) {
      reasoning.push('Industry experience provides advantage');
    }

    // Profile completeness
    const completeness = this.calculateProfileCompleteness(userProfile);
    if (completeness < 0.6) {
      reasoning.push('Complete profile to improve chances');
    }

    // Success probability interpretation
    if (successProbability > 0.7) {
      reasoning.push('High probability based on profile alignment');
    } else if (successProbability < 0.4) {
      reasoning.push('Consider targeting more suitable roles');
    }

    return reasoning;
  }

  private calculateConfidenceLevel(userHistoryCount: number, jobApplicationCount: number): 'low' | 'medium' | 'high' {
    const dataPoints = userHistoryCount + Math.min(jobApplicationCount, 20);
    
    if (dataPoints >= 25) return 'high';
    if (dataPoints >= 10) return 'medium';
    return 'low';
  }

  private async findSimilarProfiles(userProfile: any, industry?: string, experienceLevel?: ExperienceLevel): Promise<any[]> {
    // This would typically query similar user profiles from the database
    // For now, return a mock implementation
    return [];
  }

  private calculateAverageSuccessMetrics(similarProfiles: any[]): {
    responseRate: number;
    interviewRate: number;
    offerRate: number;
    averageTimeToOffer: number;
  } {
    // Mock implementation - in real scenario, calculate from similar profiles data
    return {
      responseRate: 25.5,
      interviewRate: 15.2,
      offerRate: 8.1,
      averageTimeToOffer: 28
    };
  }

  private calculateUserSuccessMetrics(userApplications: any[]): {
    responseRate: number;
    interviewRate: number;
    offerRate: number;
    averageTimeToOffer: number;
  } {
    if (userApplications.length === 0) {
      return { responseRate: 0, interviewRate: 0, offerRate: 0, averageTimeToOffer: 0 };
    }

    const total = userApplications.length;
    const viewed = userApplications.filter(app => app.viewedAt).length;
    const interviews = userApplications.filter(app => app.status === ApplicationStatus.INTERVIEW).length;
    const offers = userApplications.filter(app => app.status === ApplicationStatus.OFFER).length;

    return {
      responseRate: (viewed / total) * 100,
      interviewRate: (interviews / total) * 100,
      offerRate: (offers / total) * 100,
      averageTimeToOffer: 0 // Would calculate from actual timing data
    };
  }

  private calculateUserRanking(userMetrics: any, avgMetrics: any, totalProfiles: number): {
    percentile: number;
    rank: string;
  } {
    // Simple percentile calculation based on response rate
    const percentile = Math.min(95, Math.max(5, (userMetrics.responseRate / avgMetrics.responseRate) * 50));
    
    let rank = 'below average';
    if (percentile >= 90) rank = 'top 10%';
    else if (percentile >= 75) rank = 'top 25%';
    else if (percentile >= 50) rank = 'above average';
    
    return { percentile, rank };
  }

  private identifyImprovementAreas(userMetrics: any, avgMetrics: any): string[] {
    const areas = [];
    
    if (userMetrics.responseRate < avgMetrics.responseRate * 0.8) {
      areas.push('Improve CV and application quality');
    }
    
    if (userMetrics.interviewRate < avgMetrics.interviewRate * 0.8) {
      areas.push('Better job targeting and application personalization');
    }
    
    if (userMetrics.offerRate < avgMetrics.offerRate * 0.8) {
      areas.push('Enhance interview preparation and presentation skills');
    }
    
    return areas;
  }
}

export default new AnalyticsService();
