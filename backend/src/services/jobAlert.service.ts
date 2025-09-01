import { PrismaClient, SubscriptionPlan, Province, JobType } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { canAccessFeature } from '../utils/subscriptionQuotas.js';
import logger from '../config/logger.js';

interface JobAlertData {
  name: string;
  keywords: string[];
  provinces: Province[];
  jobTypes: JobType[];
  salaryMin?: number;
  salaryMax?: number;
  experienceLevel?: string;
  remote?: boolean;
  frequency: 'daily' | 'weekly' | 'biweekly';
  emailEnabled: boolean;
}

interface NewsletterData {
  title: string;
  content: string;
  summary?: string;
  targetAudience: SubscriptionPlan[];
  provinces?: Province[];
  industries?: string[];
  tags?: string[];
  featuredImage?: string;
  scheduledFor?: Date;
}

interface CompanyResearchBriefing {
  companyId: string;
  companyName: string;
  industry: string;
  summary: string;
  recentNews: string[];
  jobOpenings: number;
  averageSalary: number;
  benefits: string[];
  culture: string;
  growthTrend: 'growing' | 'stable' | 'declining';
  recommendationScore: number; // 1-10
}

export class JobAlertService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createJobAlert(userId: string, data: JobAlertData) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check if user can create job alerts
      if (!canAccessFeature(user.subscriptionPlan, 'jobAlerts', SubscriptionPlan.PROFESSIONAL)) {
        throw new AppError('Job alerts require Professional plan or higher', 403);
      }

      // Check existing alert limits
      const existingAlerts = await this.prisma.jobAlert.count({
        where: { 
          userId,
          active: true 
        }
      });

      const maxAlerts = user.subscriptionPlan === SubscriptionPlan.EXECUTIVE ? 10 : 3;
      if (existingAlerts >= maxAlerts) {
        throw new AppError(`You can have maximum ${maxAlerts} active job alerts`, 400);
      }

      const jobAlert = await this.prisma.jobAlert.create({
        data: {
          userId,
          name: data.name,
          keywords: data.keywords,
          provinces: data.provinces,
          cities: [], // Empty array as default
          jobTypes: data.jobTypes,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
          experienceLevels: data.experienceLevel ? [data.experienceLevel as any] : [],
          frequency: data.frequency,
          emailEnabled: data.emailEnabled,
          active: true
        }
      });

      return jobAlert;

    } catch (error) {
      logger.error('Error creating job alert', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to create job alert', 500);
    }
  }

  async getUserJobAlerts(userId: string) {
    try {
      const jobAlerts = await this.prisma.jobAlert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return { jobAlerts };
    } catch (error) {
      logger.error('Error fetching user job alerts', { error: error instanceof Error ? error.message : String(error), userId });
      throw new AppError('Failed to fetch job alerts', 500);
    }
  }

  async updateJobAlert(userId: string, alertId: string, data: Partial<JobAlertData>) {
    try {
      const alert = await this.prisma.jobAlert.findFirst({
        where: { 
          id: alertId,
          userId 
        }
      });

      if (!alert) {
        throw new AppError('Job alert not found', 404);
      }

      const updatedAlert = await this.prisma.jobAlert.update({
        where: { id: alertId },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      return updatedAlert;
    } catch (error) {
      logger.error('Error updating job alert', { error: error instanceof Error ? error.message : String(error), userId, alertId });
      throw error instanceof AppError ? error : new AppError('Failed to update job alert', 500);
    }
  }

  async deleteJobAlert(userId: string, alertId: string) {
    try {
      const alert = await this.prisma.jobAlert.findFirst({
        where: { 
          id: alertId,
          userId 
        }
      });

      if (!alert) {
        throw new AppError('Job alert not found', 404);
      }

      await this.prisma.jobAlert.delete({
        where: { id: alertId }
      });

      return { success: true };
    } catch (error) {
      logger.error('Error deleting job alert', { error: error instanceof Error ? error.message : String(error), userId, alertId });
      throw error instanceof AppError ? error : new AppError('Failed to delete job alert', 500);
    }
  }

  async processJobAlerts() {
    try {
      // Get all active job alerts that are due for processing
      const dueAlerts = await this.prisma.jobAlert.findMany({
        where: {
          active: true,
          OR: [
            { lastSentAt: null },
            { lastSentAt: { lte: this.getLastDueDate('weekly') } }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              subscriptionPlan: true
            }
          }
        }
      });

      logger.info(`Processing ${dueAlerts.length} job alerts`);

      for (const alert of dueAlerts) {
        try {
          const matchingJobs = await this.findMatchingJobs(alert);
          
          if (matchingJobs.length > 0) {
            await this.sendJobAlertEmail(alert, matchingJobs);
            
            // Update last sent timestamp
            await this.prisma.jobAlert.update({
              where: { id: alert.id },
              data: { lastSentAt: new Date() }
            });
          }
        } catch (alertError) {
          logger.error('Error processing individual job alert', { 
            error: alertError instanceof Error ? alertError.message : String(alertError),
            alertId: alert.id 
          });
        }
      }

      return { processed: dueAlerts.length };
    } catch (error) {
      logger.error('Error processing job alerts', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to process job alerts', 500);
    }
  }

  async generateCompanyResearchBriefing(companyId: string): Promise<CompanyResearchBriefing> {
    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        include: {
          jobs: {
            where: { active: true },
            select: {
              id: true,
              title: true,
              salaryMin: true,
              salaryMax: true
            }
          }
        }
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      // Calculate average salary from job postings
      const salaries = company.jobs
        .filter(job => job.salaryMin && job.salaryMax)
        .map(job => (job.salaryMin! + job.salaryMax!) / 2);
      
      const averageSalary = salaries.length > 0 
        ? salaries.reduce((sum, salary) => sum + salary, 0) / salaries.length
        : 0;

      // Generate research briefing
      const briefing: CompanyResearchBriefing = {
        companyId: company.id,
        companyName: company.name,
        industry: company.industry,
        summary: this.generateCompanySummary(company),
        recentNews: await this.getRecentCompanyNews(company.name),
        jobOpenings: company.jobs.length,
        averageSalary: Math.round(averageSalary),
        benefits: this.inferCompanyBenefits(company),
        culture: this.inferCompanyCulture(company),
        growthTrend: this.analyzeGrowthTrend(company),
        recommendationScore: this.calculateRecommendationScore(company)
      };

      // Save research to database
      await this.prisma.companyResearch.create({
        data: {
          companyId,
          cultureInsights: {
            summary: briefing.summary,
            averageSalary: briefing.averageSalary,
            jobOpenings: briefing.jobOpenings,
            growthTrend: briefing.growthTrend,
            recommendationScore: briefing.recommendationScore,
            benefits: briefing.benefits,
            culture: briefing.culture
          },
          lastResearchedAt: new Date(),
          dataFreshness: new Date()
        }
      });

      return briefing;

    } catch (error) {
      logger.error('Error generating company research briefing', { error: error instanceof Error ? error.message : String(error), companyId });
      throw error instanceof AppError ? error : new AppError('Failed to generate company research briefing', 500);
    }
  }

  async createNewsletter(data: NewsletterData) {
    try {
      const newsletter = await this.prisma.newsletter.create({
        data: {
          title: data.title,
          content: data.content,
          summary: data.summary,
          targetAudience: data.targetAudience,
          provinces: data.provinces || [],
          industries: data.industries || [],
          tags: data.tags || [],
          featuredImage: data.featuredImage,
          scheduledFor: data.scheduledFor,
          slug: this.generateSlug(data.title),
          published: false
        }
      });

      return newsletter;
    } catch (error) {
      logger.error('Error creating newsletter', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to create newsletter', 500);
    }
  }

  async publishNewsletter(newsletterId: string) {
    try {
      const newsletter = await this.prisma.newsletter.findUnique({
        where: { id: newsletterId }
      });

      if (!newsletter) {
        throw new AppError('Newsletter not found', 404);
      }

      // Get target users based on newsletter criteria
      const targetUsers = await this.getNewsletterTargetUsers(newsletter);

      // Create newsletter subscriptions for each target user
      const subscriptions = targetUsers.map(user => ({
        userId: user.id,
        newsletterId: newsletter.id,
        subscribed: true
      }));

      await this.prisma.newsletterSubscription.createMany({
        data: subscriptions,
        skipDuplicates: true
      });

      // Mark newsletter as published
      await this.prisma.newsletter.update({
        where: { id: newsletterId },
        data: {
          published: true,
          publishedAt: new Date(),
          recipientCount: targetUsers.length
        }
      });

      // Queue newsletter emails
      await this.queueNewsletterEmails(newsletter, targetUsers);

      return { 
        success: true, 
        recipientCount: targetUsers.length 
      };
    } catch (error) {
      logger.error('Error publishing newsletter', { error: error instanceof Error ? error.message : String(error), newsletterId });
      throw new AppError('Failed to publish newsletter', 500);
    }
  }

  private async findMatchingJobs(alert: any) {
    const whereClause: any = {
      active: true,
      createdAt: { gte: this.getLastDueDate(alert.frequency) }
    };

    // Add keyword matching
    if (alert.keywords.length > 0) {
      whereClause.OR = alert.keywords.map((keyword: string) => ({
        OR: [
          { title: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } }
        ]
      }));
    }

    // Add location filtering
    if (alert.provinces.length > 0) {
      whereClause.province = { in: alert.provinces };
    }

    // Add job type filtering
    if (alert.jobTypes.length > 0) {
      whereClause.jobType = { in: alert.jobTypes };
    }

    // Add salary filtering
    if (alert.salaryMin) {
      whereClause.salaryMin = { gte: alert.salaryMin };
    }
    if (alert.salaryMax) {
      whereClause.salaryMax = { lte: alert.salaryMax };
    }

    // Add remote work filtering
    if (alert.remote !== null) {
      whereClause.remote = alert.remote;
    }

    const jobs = await this.prisma.job.findMany({
      where: whereClause,
      include: {
        company: {
          select: {
            name: true,
            industry: true
          }
        }
      },
      take: 20, // Limit to top 20 matches
      orderBy: { createdAt: 'desc' }
    });

    return jobs;
  }

  private async sendJobAlertEmail(alert: any, jobs: any[]) {
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    logger.info('Sending job alert email', {
      userId: alert.userId,
      alertName: alert.name,
      jobCount: jobs.length
    });
    
    // Placeholder for actual email sending logic
    return true;
  }

  private getLastDueDate(frequency: string): Date {
    const date = new Date();
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() - 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() - 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() - 14);
        break;
    }
    return date;
  }

  private generateCompanySummary(company: any): string {
    return `${company.name} is a ${company.size || 'established'} company in the ${company.industry} sector, founded in ${company.founded || 'N/A'}. Based in ${company.city}, ${company.province}, they are currently offering ${company.jobs.length} open positions.`;
  }

  private async getRecentCompanyNews(companyName: string): Promise<string[]> {
    // Placeholder for news API integration
    return [
      `${companyName} announces new product launch`,
      `${companyName} expands operations in South Africa`,
      `${companyName} receives industry recognition award`
    ];
  }

  private inferCompanyBenefits(company: any): string[] {
    const commonBenefits = [
      'Medical Aid',
      'Pension Fund',
      'Annual Leave',
      'Study Assistance'
    ];

    // Industry-specific benefits
    if (company.industry === 'Technology') {
      commonBenefits.push('Flexible Working Hours', 'Remote Work Options', 'Professional Development');
    }

    return commonBenefits;
  }

  private inferCompanyCulture(_company: any): string {
    const cultures = [
      'Collaborative and innovation-focused environment',
      'Professional growth-oriented culture',
      'Dynamic and fast-paced workplace',
      'Team-oriented with strong values'
    ];

    return cultures[Math.floor(Math.random() * cultures.length)];
  }

  private analyzeGrowthTrend(company: any): 'growing' | 'stable' | 'declining' {
    // Simple heuristic based on number of job openings
    if (company.jobs.length > 5) return 'growing';
    if (company.jobs.length > 2) return 'stable';
    return 'stable'; // Default to stable for conservative estimate
  }

  private calculateRecommendationScore(company: any): number {
    let score = 5; // Base score

    // Increase score based on job openings (indicates growth)
    score += Math.min(company.jobs.length * 0.5, 3);

    // Industry factors
    if (['Technology', 'Healthcare', 'Finance'].includes(company.industry)) {
      score += 1;
    }

    // Company verification
    if (company.verified) {
      score += 1;
    }

    return Math.min(Math.round(score), 10);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
  }

  private async getNewsletterTargetUsers(newsletter: any) {
    const whereClause: any = {};

    // Filter by subscription plan
    if (newsletter.targetAudience.length > 0) {
      whereClause.subscriptionPlan = { in: newsletter.targetAudience };
    }

    // Filter by province
    if (newsletter.provinces.length > 0) {
      whereClause.province = { in: newsletter.provinces };
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    return users;
  }

  private async queueNewsletterEmails(newsletter: any, users: any[]) {
    // In production, queue emails for batch processing
    logger.info('Queuing newsletter emails', {
      newsletterId: newsletter.id,
      recipientCount: users.length
    });
    
    // Placeholder for actual email queue implementation
    return true;
  }
}

export default new JobAlertService();
