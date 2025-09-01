import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

/**
 * Newsletter Service
 * Handles job market insights newsletters and email campaigns
 */
export class NewsletterService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Initialize email transporter
    this.transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST || 'smtp.gmail.com',
      port: config.EMAIL_PORT || 587,
      secure: false,
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASSWORD
      }
    });
  }

  /**
   * Subscribe user to newsletter
   */
  async subscribe(userId: string, preferences: any): Promise<any> {
    try {
      logger.info(' Subscribing user to newsletter', { userId });

      const subscription = await prisma.newsletterSubscription.upsert({
        where: { userId },
        update: {
          isActive: true,
          preferences,
          updatedAt: new Date()
        },
        create: {
          userId,
          isActive: true,
          preferences,
          frequency: preferences.frequency || 'MONTHLY',
          categories: preferences.categories || ['general', 'industry', 'salary'],
          createdAt: new Date()
        }
      });

      // Send welcome email
      await this.sendWelcomeEmail(userId);

      return subscription;
    } catch (error) {
      logger.error('Error subscribing to newsletter', { error, userId });
      throw error;
    }
  }

  /**
   * Unsubscribe user from newsletter
   */
  async unsubscribe(userId: string): Promise<void> {
    try {
      logger.info(' Unsubscribing user from newsletter', { userId });

      await prisma.newsletterSubscription.update({
        where: { userId },
        data: {
          isActive: false,
          unsubscribedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Error unsubscribing from newsletter', { error, userId });
      throw error;
    }
  }

  /**
   * Update newsletter preferences
   */
  async updatePreferences(userId: string, preferences: any): Promise<any> {
    try {
      logger.info(' Updating newsletter preferences', { userId });

      const subscription = await prisma.newsletterSubscription.update({
        where: { userId },
        data: {
          preferences,
          frequency: preferences.frequency,
          categories: preferences.categories,
          updatedAt: new Date()
        }
      });

      return subscription;
    } catch (error) {
      logger.error('Error updating preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Generate monthly job market insights newsletter
   */
  async generateMonthlyNewsletter(): Promise<any> {
    try {
      logger.info(' Generating monthly job market newsletter');

      const insights = await this.gatherMarketInsights();
      const newsletter = {
        id: `newsletter_${Date.now()}`,
        type: 'MONTHLY_INSIGHTS',
        subject: `Job Market Insights - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        content: this.formatNewsletterContent(insights),
        createdAt: new Date(),
        stats: insights.stats
      };

      // Store newsletter in database
      await prisma.newsletter.create({
        data: newsletter
      });

      // Cache for quick access
      await redis.setex(`newsletter:latest`, 86400, JSON.stringify(newsletter));

      return newsletter;
    } catch (error) {
      logger.error('Error generating newsletter', { error });
      throw error;
    }
  }

  /**
   * Send newsletter to all active subscribers
   */
  async sendNewsletter(newsletterId: string): Promise<any> {
    try {
      logger.info(' Sending newsletter to subscribers', { newsletterId });

      const newsletter = await prisma.newsletter.findUnique({
        where: { id: newsletterId }
      });

      if (!newsletter) {
        throw new Error('Newsletter not found');
      }

      const subscribers = await prisma.newsletterSubscription.findMany({
        where: { 
          isActive: true,
          frequency: 'MONTHLY'
        },
        include: { user: true }
      });

      const sendResults = {
        sent: 0,
        failed: 0,
        total: subscribers.length
      };

      // Send in batches to avoid rate limiting
      const batchSize = 50;
      for (let i = 0; i < subscribers.length; i += batchSize) {
        const batch = subscribers.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (subscriber) => {
          try {
            await this.sendEmail(
              subscriber.user.email,
              newsletter.subject,
              newsletter.content,
              this.generateHtmlTemplate(newsletter)
            );
            sendResults.sent++;
          } catch (error) {
            logger.error('Failed to send newsletter', { error, userId: subscriber.userId });
            sendResults.failed++;
          }
        }));

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Update newsletter with send stats
      await prisma.newsletter.update({
        where: { id: newsletterId },
        data: {
          sentAt: new Date(),
          sendStats: sendResults
        }
      });

      return sendResults;
    } catch (error) {
      logger.error('Error sending newsletter', { error });
      throw error;
    }
  }

  /**
   * Get newsletter archive
   */
  async getArchive(userId: string, limit: number = 12): Promise<any[]> {
    try {
      logger.info(' Fetching newsletter archive', { userId });

      const newsletters = await prisma.newsletter.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          subject: true,
          createdAt: true,
          sentAt: true,
          stats: true
        }
      });

      return newsletters;
    } catch (error) {
      logger.error('Error fetching archive', { error });
      throw error;
    }
  }

  /**
   * Get specific newsletter content
   */
  async getNewsletter(newsletterId: string): Promise<any> {
    try {
      const newsletter = await prisma.newsletter.findUnique({
        where: { id: newsletterId }
      });

      return newsletter;
    } catch (error) {
      logger.error('Error fetching newsletter', { error, newsletterId });
      throw error;
    }
  }

  /**
   * Generate South Africa focused market insights
   */
  async generateSAMarketInsights(): Promise<any> {
    try {
      logger.info(' Generating South Africa market insights');

      const insights = {
        topGrowingIndustries: await this.getTopGrowingIndustries('ZA'),
        inDemandSkills: await this.getInDemandSkills('ZA'),
        salaryTrends: await this.getSalaryTrends('ZA'),
        remoteWorkTrends: await this.getRemoteWorkTrends('ZA'),
        provincialHighlights: await this.getProvincialHighlights(),
        careerAdvice: await this.generateCareerAdvice(),
        upcomingEvents: await this.getUpcomingEvents('ZA'),
        featuredCompanies: await this.getFeaturedCompanies('ZA')
      };

      return insights;
    } catch (error) {
      logger.error('Error generating SA insights', { error });
      throw error;
    }
  }

  // Private helper methods

  private async gatherMarketInsights(): Promise<any> {
    const [
      jobStats,
      industryTrends,
      skillsDemand,
      salaryData
    ] = await Promise.all([
      this.getJobMarketStats(),
      this.getIndustryTrends(),
      this.getSkillsDemand(),
      this.getSalaryInsights()
    ]);

    return {
      stats: jobStats,
      trends: industryTrends,
      skills: skillsDemand,
      salaries: salaryData,
      generatedAt: new Date()
    };
  }

  private async getJobMarketStats(): Promise<any> {
    // Aggregate job market statistics
    const stats = await prisma.job.aggregate({
      _count: true,
      _avg: {
        salaryMin: true,
        salaryMax: true
      }
    });

    const byProvince = await prisma.job.groupBy({
      by: ['province'],
      _count: true,
      orderBy: {
        _count: {
          _all: 'desc'
        }
      },
      take: 5
    });

    return {
      totalJobs: stats._count,
      averageSalary: (stats._avg.salaryMin + stats._avg.salaryMax) / 2,
      topProvinces: byProvince
    };
  }

  private async getIndustryTrends(): Promise<any> {
    const trends = await prisma.job.groupBy({
      by: ['industry'],
      _count: true,
      orderBy: {
        _count: {
          _all: 'desc'
        }
      },
      take: 10
    });

    return trends.map(t => ({
      industry: t.industry,
      jobCount: t._count,
      growth: Math.random() * 20 - 5 // Simulated growth percentage
    }));
  }

  private async getSkillsDemand(): Promise<any> {
    // This would aggregate from job requirements
    return {
      technical: ['Python', 'JavaScript', 'React', 'Node.js', 'SQL'],
      soft: ['Communication', 'Leadership', 'Problem Solving', 'Teamwork'],
      emerging: ['AI/ML', 'Blockchain', 'Cloud Computing', 'DevOps']
    };
  }

  private async getSalaryInsights(): Promise<any> {
    return {
      averageByExperience: {
        'entry': 250000,
        'mid': 450000,
        'senior': 750000,
        'executive': 1200000
      },
      topPayingRoles: [
        { role: 'Software Engineer', average: 600000 },
        { role: 'Data Scientist', average: 650000 },
        { role: 'Product Manager', average: 700000 }
      ]
    };
  }

  private formatNewsletterContent(insights: any): any {
    return {
      headline: 'Your Monthly Job Market Insights',
      sections: [
        {
          title: 'Market Overview',
          content: `This month saw ${insights.stats.totalJobs} new job postings with an average salary of R${insights.stats.averageSalary}`
        },
        {
          title: 'Trending Industries',
          content: insights.trends
        },
        {
          title: 'In-Demand Skills',
          content: insights.skills
        },
        {
          title: 'Salary Insights',
          content: insights.salaries
        }
      ]
    };
  }

  private generateHtmlTemplate(newsletter: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0891b2; color: white; padding: 20px; text-align: center; }
            .section { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${newsletter.subject}</h1>
            </div>
            ${newsletter.content.sections.map((section: any) => `
              <div class="section">
                <h2>${section.title}</h2>
                <p>${JSON.stringify(section.content)}</p>
              </div>
            `).join('')}
            <div class="footer">
              <p>© AI Job Chommie | <a href="{unsubscribe_url}">Unsubscribe</a></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private async sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
    const mailOptions = {
      from: config.EMAIL_FROM || 'noreply@aijobchommie.co.za',
      to,
      subject,
      text,
      html
    };

    await this.transporter.sendMail(mailOptions);
  }

  private async sendWelcomeEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) return;

    const welcomeContent = `
      Welcome to AI Job Chommie Newsletter!
      
      You're now subscribed to receive monthly job market insights tailored for South Africa.
      
      What you'll receive:
      - Monthly job market trends
      - In-demand skills analysis
      - Salary benchmarks
      - Career advice
      - Industry insights
      
      Best regards,
      The AI Job Chommie Team
    `;

    await this.sendEmail(
      user.email,
      'Welcome to AI Job Chommie Newsletter!',
      welcomeContent,
      this.generateWelcomeHtml(user.firstName || 'there')
    );
  }

  private generateWelcomeHtml(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px; background: white; }
            .button { display: inline-block; padding: 12px 30px; background: #0891b2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome, ${name}!</h1>
            </div>
            <div class="content">
              <h2>You're now part of our newsletter community!</h2>
              <p>Get ready to receive monthly insights that will accelerate your career journey.</p>
              <a href="{dashboard_url}" class="button">Visit Your Dashboard</a>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private async getTopGrowingIndustries(country: string): Promise<any[]> {
    // Simulated data - would connect to real data source
    return [
      { name: 'Technology', growth: 15.2 },
      { name: 'Healthcare', growth: 12.8 },
      { name: 'Finance', growth: 8.5 },
      { name: 'Renewable Energy', growth: 22.3 },
      { name: 'E-commerce', growth: 18.7 }
    ];
  }

  private async getInDemandSkills(country: string): Promise<any[]> {
    return [
      { skill: 'Cloud Computing', demand: 'Very High' },
      { skill: 'Data Analysis', demand: 'High' },
      { skill: 'Digital Marketing', demand: 'High' },
      { skill: 'Project Management', demand: 'Medium-High' },
      { skill: 'AI/Machine Learning', demand: 'Very High' }
    ];
  }

  private async getSalaryTrends(country: string): Promise<any> {
    return {
      averageIncrease: 5.2,
      topPayingSectors: ['Technology', 'Mining', 'Finance'],
      entryLevelRange: { min: 180000, max: 300000 },
      seniorLevelRange: { min: 600000, max: 1500000 }
    };
  }

  private async getRemoteWorkTrends(country: string): Promise<any> {
    return {
      percentageRemote: 35,
      percentageHybrid: 45,
      percentageOnsite: 20,
      trend: 'increasing'
    };
  }

  private async getProvincialHighlights(): Promise<any[]> {
    return [
      { province: 'Gauteng', highlight: 'Highest job concentration in tech sector' },
      { province: 'Western Cape', highlight: 'Growing startup ecosystem' },
      { province: 'KwaZulu-Natal', highlight: 'Emerging logistics and transport hub' }
    ];
  }

  private async generateCareerAdvice(): Promise<string[]> {
    return [
      'Upskill in cloud technologies for better opportunities',
      'Network actively on LinkedIn for hidden job market access',
      'Tailor your CV for each application using AI tools',
      'Consider contract work to gain diverse experience'
    ];
  }

  private async getUpcomingEvents(country: string): Promise<any[]> {
    return [
      { 
        name: 'Tech Career Fair Johannesburg',
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        type: 'Career Fair'
      },
      {
        name: 'Women in Tech Summit Cape Town',
        date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        type: 'Conference'
      }
    ];
  }

  private async getFeaturedCompanies(country: string): Promise<any[]> {
    return [
      { name: 'Discovery', hiring: true, roles: 25 },
      { name: 'Standard Bank', hiring: true, roles: 18 },
      { name: 'Takealot', hiring: true, roles: 32 }
    ];
  }
}

export const newsletterService = new NewsletterService();
