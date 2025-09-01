import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';
import { HuggingFaceService } from './huggingface.service.js';
import { CoverLetterService } from './coverLetter.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const prisma = new PrismaClient();

// Types and Interfaces
interface TimingAnalysis {
  optimalTime: Date;
  confidence: number;
  reasoning: string;
  hrActivityPattern: string;
  competitionLevel: 'low' | 'medium' | 'high';
  expectedResponseTime: number; // hours
}

interface AutoApplicationPreview {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  scheduledFor: Date;
  coverLetter: string;
  timingAnalysis: TimingAnalysis;
  estimatedSuccessRate: number;
  status: 'scheduled' | 'pending_approval' | 'cancelled';
  createdAt: Date;
}

interface ApplicationSuccess {
  applicationId: string;
  wasViewed: boolean;
  responseTime?: number;
  responseType?: 'interview' | 'rejection' | 'feedback_request';
  actualSubmissionTime: Date;
  timingScore: number; // how well our timing prediction worked
}

const autoApplicationConfigSchema = z.object({
  maxDailyApplications: z.number().min(1).max(50).default(5),
  minTimeBetweenApplications: z.number().min(30).max(480).default(120), // minutes
  preferredTimeRanges: z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
    end: z.string().regex(/^\d{2}:\d{2}$/),
    timezone: z.string().default('Africa/Johannesburg')
  })),
  skipWeekends: z.boolean().default(true),
  autoSubmit: z.boolean().default(false), // requires user approval by default
  industries: z.array(z.string()).optional(),
  maxApplicationsPerCompany: z.number().min(1).max(10).default(3)
});

export class AutoApplicationService {
  private hfService: HuggingFaceService;
  private coverLetterService: CoverLetterService;

  constructor() {
    this.hfService = HuggingFaceService.getInstance();
    this.coverLetterService = new CoverLetterService();
  }

  /**
   *  MAGIC: Analyze optimal timing for job application
   */
  async analyzeOptimalTiming(jobId: string, userId: string): Promise<TimingAnalysis> {
    try {
      logger.info(' Analyzing optimal timing for application', { jobId, userId });

      // Get job and company information
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          company: true,
          jobApplications: {
            select: {
              createdAt: true,
              viewedAt: true,
              reviewedAt: true,
              status: true
            },
            take: 100,
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!job) {
        throw new AppError(404, 'Job not found', 'JOB_NOT_FOUND');
      }

      // Analyze historical application patterns for this company
      const hrPatterns = await this.analyzeHRPatterns(job.companyId);
      
      // Analyze current competition level
      const competitionLevel = await this.analyzeCompetitionLevel(jobId);
      
      // Get industry-specific timing insights
      const industryInsights = await this.getIndustryTimingInsights(job.company.industry);

      // Calculate optimal time using AI
      const optimalTime = this.calculateOptimalTime(hrPatterns, competitionLevel, industryInsights);
      
      // Generate AI explanation
      const reasoning = await this.generateTimingReasoning(job, hrPatterns, competitionLevel);

      return {
        optimalTime,
        confidence: this.calculateTimingConfidence(hrPatterns, competitionLevel),
        reasoning,
        hrActivityPattern: hrPatterns.pattern,
        competitionLevel: competitionLevel.level,
        expectedResponseTime: hrPatterns.avgResponseTime || 72
      };

    } catch (error) {
      logger.error('Failed to analyze optimal timing', { error, jobId, userId });
      throw error;
    }
  }

  /**
   *  MAGIC: Schedule automatic job application
   */
  async scheduleAutoApplication(
    userId: string, 
    jobId: string, 
    config: z.infer<typeof autoApplicationConfigSchema>
  ): Promise<AutoApplicationPreview> {
    try {
      logger.info(' Scheduling auto application', { userId, jobId });

      // Validate configuration
      const validatedConfig = autoApplicationConfigSchema.parse(config);

      // Check if user already applied to this job
      const existingApplication = await prisma.jobApplication.findFirst({
        where: { userId, jobId }
      });

      if (existingApplication) {
        throw new AppError(409, 'Already applied to this job', 'DUPLICATE_APPLICATION');
      }

      // Analyze optimal timing
      const timingAnalysis = await this.analyzeOptimalTiming(jobId, userId);
      
      // Generate tailored cover letter
      const coverLetter = await this.generateAutoApplicationCoverLetter(userId, jobId);
      
      // Calculate success probability
      const estimatedSuccessRate = await this.calculateSuccessProbability(userId, jobId);

      // Create scheduled application record
      const scheduledApplication = await prisma.scheduledApplication.create({
        data: {
          userId,
          jobId,
          scheduledFor: timingAnalysis.optimalTime,
          coverLetter,
          timingAnalysis: JSON.stringify(timingAnalysis),
          estimatedSuccessRate,
          status: validatedConfig.autoSubmit ? 'scheduled' : 'pending_approval',
          config: JSON.stringify(validatedConfig)
        },
        include: {
          job: {
            include: {
              company: {
                select: { name: true }
              }
            }
          }
        }
      });

      // Schedule background job for submission (if auto-submit enabled)
      if (validatedConfig.autoSubmit) {
        await this.scheduleBackgroundSubmission(scheduledApplication.id, timingAnalysis.optimalTime);
      }

      return {
        id: scheduledApplication.id,
        jobId: scheduledApplication.jobId,
        jobTitle: scheduledApplication.job.title,
        companyName: scheduledApplication.job.company.name,
        scheduledFor: scheduledApplication.scheduledFor,
        coverLetter: scheduledApplication.coverLetter,
        timingAnalysis,
        estimatedSuccessRate: scheduledApplication.estimatedSuccessRate,
        status: scheduledApplication.status as any,
        createdAt: scheduledApplication.createdAt
      };

    } catch (error) {
      logger.error('Failed to schedule auto application', { error, userId, jobId });
      throw error;
    }
  }

  /**
   *  MAGIC: Get user's scheduled applications
   */
  async getUserScheduledApplications(userId: string, limit: number = 20): Promise<AutoApplicationPreview[]> {
    try {
      const scheduledApps = await prisma.scheduledApplication.findMany({
        where: { 
          userId,
          status: { in: ['scheduled', 'pending_approval'] }
        },
        include: {
          job: {
            include: {
              company: {
                select: { name: true }
              }
            }
          }
        },
        orderBy: { scheduledFor: 'asc' },
        take: limit
      });

      return scheduledApps.map(app => ({
        id: app.id,
        jobId: app.jobId,
        jobTitle: app.job.title,
        companyName: app.job.company.name,
        scheduledFor: app.scheduledFor,
        coverLetter: app.coverLetter,
        timingAnalysis: JSON.parse(app.timingAnalysis),
        estimatedSuccessRate: app.estimatedSuccessRate,
        status: app.status as any,
        createdAt: app.createdAt
      }));

    } catch (error) {
      logger.error('Failed to get scheduled applications', { error, userId });
      throw error;
    }
  }

  /**
   *  MAGIC: Execute scheduled application submission
   */
  async executeScheduledApplication(scheduledApplicationId: string): Promise<boolean> {
    try {
      logger.info(' Executing scheduled application', { scheduledApplicationId });

      const scheduledApp = await prisma.scheduledApplication.findUnique({
        where: { id: scheduledApplicationId },
        include: { job: true }
      });

      if (!scheduledApp || scheduledApp.status !== 'scheduled') {
        throw new AppError(404, 'Scheduled application not found or not ready', 'SCHEDULED_APP_NOT_FOUND');
      }

      // Create the actual job application
      const application = await prisma.jobApplication.create({
        data: {
          userId: scheduledApp.userId,
          jobId: scheduledApp.jobId,
          coverLetter: scheduledApp.coverLetter,
          status: 'SUBMITTED',
          source: 'AUTO_MAGIC',
          metadata: {
            scheduledApplicationId,
            timingAnalysis: JSON.parse(scheduledApp.timingAnalysis),
            estimatedSuccessRate: scheduledApp.estimatedSuccessRate,
            submittedVia: 'auto-application-service'
          }
        }
      });

      // Update scheduled application status
      await prisma.scheduledApplication.update({
        where: { id: scheduledApplicationId },
        data: { 
          status: 'completed',
          executedAt: new Date(),
          applicationId: application.id
        }
      });

      // Log successful auto-application
      await prisma.userActivity.create({
        data: {
          userId: scheduledApp.userId,
          action: 'auto_application_submitted',
          entityType: 'job',
          entityId: scheduledApp.jobId,
          metadata: {
            applicationId: application.id,
            timing: 'optimal',
            source: 'ai-magic'
          }
        }
      });

      logger.info(' Auto application submitted successfully', { 
        applicationId: application.id, 
        scheduledApplicationId 
      });

      return true;

    } catch (error) {
      logger.error('Failed to execute scheduled application', { error, scheduledApplicationId });
      
      // Mark as failed
      await prisma.scheduledApplication.update({
        where: { id: scheduledApplicationId },
        data: { 
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Unknown error'
        }
      }).catch(() => {});

      throw error;
    }
  }

  /**
   *  MAGIC: Track application success and improve timing algorithms
   */
  async trackApplicationSuccess(applicationId: string, success: ApplicationSuccess): Promise<void> {
    try {
      // Update application tracking data
      await prisma.applicationTracking.upsert({
        where: { applicationId },
        update: {
          wasViewed: success.wasViewed,
          responseTime: success.responseTime,
          responseType: success.responseType,
          timingScore: success.timingScore,
          updatedAt: new Date()
        },
        create: {
          applicationId,
          wasViewed: success.wasViewed,
          responseTime: success.responseTime,
          responseType: success.responseType,
          actualSubmissionTime: success.actualSubmissionTime,
          timingScore: success.timingScore
        }
      });

      // Use this data to improve timing predictions
      await this.updateTimingAlgorithms(success);

      logger.info(' Application success tracked', { applicationId, success: success.wasViewed });

    } catch (error) {
      logger.error('Failed to track application success', { error, applicationId });
    }
  }

  /**
   * Cancel scheduled application
   */
  async cancelScheduledApplication(scheduledApplicationId: string, userId: string): Promise<boolean> {
    try {
      const updated = await prisma.scheduledApplication.updateMany({
        where: { 
          id: scheduledApplicationId,
          userId,
          status: { in: ['scheduled', 'pending_approval'] }
        },
        data: { 
          status: 'cancelled',
          cancelledAt: new Date()
        }
      });

      return updated.count > 0;

    } catch (error) {
      logger.error('Failed to cancel scheduled application', { error, scheduledApplicationId });
      throw error;
    }
  }

  // Private helper methods

  private async analyzeHRPatterns(companyId: string): Promise<{
    pattern: string;
    avgResponseTime: number;
    bestDays: string[];
    bestHours: number[];
    activityLevel: number;
  }> {
    // Analyze historical data to determine HR patterns
    const applications = await prisma.jobApplication.findMany({
      where: {
        job: { companyId },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
      },
      include: {
        applicationTracking: true
      }
    });

    // Analyze patterns
    const dayOfWeekCounts = new Array(7).fill(0);
    const hourCounts = new Array(24).fill(0);
    let totalResponseTime = 0;
    let responseCount = 0;

    applications.forEach(app => {
      const date = new Date(app.createdAt);
      dayOfWeekCounts[date.getDay()]++;
      hourCounts[date.getHours()]++;

      if (app.applicationTracking?.responseTime) {
        totalResponseTime += app.applicationTracking.responseTime;
        responseCount++;
      }
    });

    const bestDays = dayOfWeekCounts
      .map((count, index) => ({ count, day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.day);

    const bestHours = hourCounts
      .map((count, hour) => ({ count, hour }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);

    return {
      pattern: applications.length > 10 ? 'established' : 'emerging',
      avgResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 72,
      bestDays,
      bestHours,
      activityLevel: Math.min(applications.length / 30, 1) // Activity level 0-1
    };
  }

  private async analyzeCompetitionLevel(jobId: string): Promise<{
    level: 'low' | 'medium' | 'high';
    applicantCount: number;
    recentActivity: number;
  }> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        jobApplications: {
          where: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
          }
        },
        _count: {
          select: { jobApplications: true }
        }
      }
    });

    const totalApplicants = job?._count.jobApplications || 0;
    const recentActivity = job?.jobApplications.length || 0;

    let level: 'low' | 'medium' | 'high' = 'low';
    if (totalApplicants > 50 || recentActivity > 10) level = 'high';
    else if (totalApplicants > 15 || recentActivity > 3) level = 'medium';

    return {
      level,
      applicantCount: totalApplicants,
      recentActivity
    };
  }

  private async getIndustryTimingInsights(industry: string): Promise<{
    peakDays: string[];
    peakHours: number[];
    responsePattern: string;
  }> {
    // Industry-specific timing patterns (could be enhanced with real data)
    const industryPatterns: Record<string, any> = {
      'Technology': {
        peakDays: ['Tue', 'Wed', 'Thu'],
        peakHours: [9, 10, 11, 14, 15],
        responsePattern: 'fast'
      },
      'Finance': {
        peakDays: ['Mon', 'Tue', 'Wed'],
        peakHours: [8, 9, 10, 13, 14],
        responsePattern: 'formal'
      },
      'Healthcare': {
        peakDays: ['Mon', 'Tue', 'Wed', 'Thu'],
        peakHours: [7, 8, 9, 13, 14, 15],
        responsePattern: 'steady'
      },
      'default': {
        peakDays: ['Tue', 'Wed', 'Thu'],
        peakHours: [9, 10, 11, 14, 15],
        responsePattern: 'standard'
      }
    };

    return industryPatterns[industry] || industryPatterns.default;
  }

  private calculateOptimalTime(hrPatterns: any, competitionLevel: any, industryInsights: any): Date {
    const now = new Date();
    const optimal = new Date();

    // Start with next business day
    optimal.setDate(now.getDate() + 1);
    
    // Adjust for weekend
    if (optimal.getDay() === 0) optimal.setDate(optimal.getDate() + 1); // Skip Sunday
    if (optimal.getDay() === 6) optimal.setDate(optimal.getDate() + 2); // Skip Saturday

    // Set optimal hour based on patterns
    const bestHour = hrPatterns.bestHours[0] || industryInsights.peakHours[0] || 10;
    optimal.setHours(bestHour, Math.floor(Math.random() * 30), 0, 0);

    // Adjust for competition
    if (competitionLevel.level === 'high') {
      optimal.setHours(optimal.getHours() - 2); // Submit earlier for high competition
    }

    return optimal;
  }

  private calculateTimingConfidence(hrPatterns: any, competitionLevel: any): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence with more historical data
    if (hrPatterns.pattern === 'established') confidence += 0.3;
    
    // Adjust for competition level
    if (competitionLevel.level === 'low') confidence += 0.2;
    else if (competitionLevel.level === 'high') confidence -= 0.1;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private async generateTimingReasoning(job: any, hrPatterns: any, competitionLevel: any): Promise<string> {
    const prompt = `Generate a brief explanation for optimal application timing:
    Job: ${job.title} at ${job.company.name}
    HR Pattern: ${hrPatterns.pattern} (responds in ${hrPatterns.avgResponseTime}h)
    Competition: ${competitionLevel.level} (${competitionLevel.applicantCount} total applicants)
    Best days: ${hrPatterns.bestDays.join(', ')}
    
    Explain in 2-3 sentences why this timing is optimal.`;

    try {
      const response = await this.hfService.generateText(prompt, {
        maxTokens: 100,
        temperature: 0.7
      });

      return response.text || 'Optimal timing based on HR activity patterns and competition analysis.';
    } catch (error) {
      return 'Timing optimized based on company hiring patterns and current competition levels.';
    }
  }

  private async generateAutoApplicationCoverLetter(userId: string, jobId: string): Promise<string> {
    try {
      // Use existing cover letter service with auto-application context
      const coverLetter = await this.coverLetterService.generateCoverLetter(userId, jobId, {
        tone: 'professional',
        length: 'medium',
        context: 'auto_application',
        includePersonality: true
      });

      return coverLetter;
    } catch (error) {
      logger.warn('Failed to generate auto cover letter, using template', { error });
      return 'Dear Hiring Manager,\n\nI am excited to apply for this position and believe my skills and experience make me an ideal candidate. I look forward to discussing how I can contribute to your team.\n\nBest regards';
    }
  }

  private async calculateSuccessProbability(userId: string, jobId: string): Promise<number> {
    // Basic success probability calculation (to be enhanced)
    const user = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        jobApplications: {
          include: { applicationTracking: true }
        }
      }
    });

    if (!user) return 0.3; // Default probability

    // Calculate based on historical success rate
    const totalApplications = user.jobApplications.length;
    const successfulApplications = user.jobApplications.filter(app => 
      app.applicationTracking?.wasViewed || app.status === 'INTERVIEWING'
    ).length;

    const baseRate = totalApplications > 0 ? successfulApplications / totalApplications : 0.3;
    
    // Adjust for profile completeness, skills match, etc.
    let adjustedRate = baseRate;
    if (user.completionScore > 0.8) adjustedRate += 0.1;
    if (user.skills && user.skills.length > 5) adjustedRate += 0.05;

    return Math.max(0.1, Math.min(0.9, adjustedRate));
  }

  private async scheduleBackgroundSubmission(scheduledAppId: string, scheduledTime: Date): Promise<void> {
    // In a real implementation, this would integrate with a job queue (Bull, Agenda, etc.)
    // For now, we'll create a database record that a cron job can process
    await prisma.backgroundJob.create({
      data: {
        type: 'AUTO_APPLICATION_SUBMIT',
        payload: { scheduledApplicationId: scheduledAppId },
        scheduledFor: scheduledTime,
        status: 'pending'
      }
    });
  }

  private async updateTimingAlgorithms(success: ApplicationSuccess): Promise<void> {
    // Update ML model weights based on success feedback
    // This is a placeholder for future ML model updates
    await prisma.timingFeedback.create({
      data: {
        applicationId: success.applicationId,
        timingScore: success.timingScore,
        wasSuccessful: success.wasViewed,
        submissionTime: success.actualSubmissionTime,
        responseTime: success.responseTime
      }
    });
  }
}

export default AutoApplicationService;
