import { PrismaClient, SubscriptionPlan } from '@prisma/client'; // SkillAssessmentType not used
import { AppError } from '../utils/AppError.js';
import { canAccessFeature } from '../utils/subscriptionQuotas.js';
import logger from '../config/logger.js';

interface PersonalBrandAuditResult {
  overallScore: number;
  linkedinScore: number;
  resumeScore: number;
  onlinePresenceScore: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  actionPlan: any;
  contentCalendar: any;
}

interface LeadershipAssessmentData {
  title: string;
  assessmentType: '360_feedback' | 'self_assessment' | 'situational';
  questions: any[];
  responses?: any[];
}

interface CareerTrajectoryData {
  currentRole: string;
  targetRole: string;
  timeframe: number; // months
  milestones: Array<{
    title: string;
    description: string;
    targetDate: Date;
    skills: string[];
    resources: string[];
  }>;
  okrs: Array<{
    objective: string;
    keyResults: string[];
    dueDate: Date;
  }>;
}

interface NetworkingEventData {
  title: string;
  description: string;
  eventType: 'conference' | 'workshop' | 'meetup' | 'webinar' | 'networking';
  startDateTime: Date;
  endDateTime: Date;
  location?: string;
  virtualLink?: string;
  industry: string;
  experienceLevel: 'senior' | 'executive' | 'c_level';
  cost?: number;
  maxAttendees?: number;
  tags: string[];
}

export class ExecutiveService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async conductPersonalBrandAudit(userId: string): Promise<PersonalBrandAuditResult> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          personalBrandAudit: true,
          experiences: true,
          skills: { include: { skill: true } },
          cvs: { take: 1, orderBy: { createdAt: 'desc' } }
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'personalBrandAudit', SubscriptionPlan.EXECUTIVE)) {
        throw new AppError('Personal Brand Audit requires Executive plan', 403);
      }

      // Analyze LinkedIn presence (simulated)
      const linkedinScore = this.analyzeLinkedInProfile(user);
      
      // Analyze resume/CV quality
      const resumeScore = this.analyzeResumeQuality(user);
      
      // Analyze overall online presence
      const onlinePresenceScore = this.analyzeOnlinePresence(user);

      // Calculate overall score
      const overallScore = Math.round((linkedinScore + resumeScore + onlinePresenceScore) / 3);

      // Conduct SWOT analysis
      const swotAnalysis = this.conductSWOTAnalysis(user, {
        linkedinScore,
        resumeScore,
        onlinePresenceScore
      });

      // Generate action plan
      const actionPlan = this.generatePersonalBrandActionPlan(user, swotAnalysis);

      // Generate content calendar
      const contentCalendar = this.generateContentCalendar(user);

      const auditResult: PersonalBrandAuditResult = {
        overallScore,
        linkedinScore,
        resumeScore,
        onlinePresenceScore,
        strengths: swotAnalysis.strengths,
        weaknesses: swotAnalysis.weaknesses,
        opportunities: swotAnalysis.opportunities,
        threats: swotAnalysis.threats,
        actionPlan,
        contentCalendar
      };

      // Save or update audit in database
      await this.prisma.personalBrandAudit.upsert({
        where: { userId },
        update: {
          overallScore,
          linkedinScore,
          resumeScore,
          onlinePresenceScore,
          strengths: swotAnalysis.strengths,
          weaknesses: swotAnalysis.weaknesses,
          opportunities: swotAnalysis.opportunities,
          threats: swotAnalysis.threats,
          actionPlan,
          contentCalendar,
          lastAuditDate: new Date(),
          nextAuditDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          updatedAt: new Date()
        },
        create: {
          userId,
          overallScore,
          linkedinScore,
          resumeScore,
          onlinePresenceScore,
          strengths: swotAnalysis.strengths,
          weaknesses: swotAnalysis.weaknesses,
          opportunities: swotAnalysis.opportunities,
          threats: swotAnalysis.threats,
          actionPlan,
          contentCalendar,
          lastAuditDate: new Date(),
          nextAuditDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        }
      });

      return auditResult;

    } catch (error) {
      logger.error('Error conducting personal brand audit', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to conduct personal brand audit', 500);
    }
  }

  async createLeadershipAssessment(userId: string, data: LeadershipAssessmentData) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'leadershipAssessment', SubscriptionPlan.EXECUTIVE)) {
        throw new AppError('Leadership Assessment requires Executive plan', 403);
      }

      const assessment = await this.prisma.leadershipAssessment.create({
        data: {
          userId,
          title: data.title,
          assessmentType: data.assessmentType,
          questions: data.questions,
          responses: data.responses,
          completed: !!data.responses
        }
      });

      // If responses are provided, generate results
      if (data.responses && data.responses.length > 0) {
        const results = await this.generateLeadershipResults(assessment, data.questions, data.responses);
        
        await this.prisma.leadershipAssessment.update({
          where: { id: assessment.id },
          data: {
            results,
            overallScore: results.overallScore,
            leadershipStyles: results.leadershipStyles,
            competencyScores: results.competencyScores,
            developmentPlan: results.developmentPlan,
            recommendedActions: results.recommendedActions,
            completedAt: new Date()
          }
        });

        return { assessment: { ...assessment, results } };
      }

      return { assessment };

    } catch (error) {
      logger.error('Error creating leadership assessment', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to create leadership assessment', 500);
    }
  }

  async createCareerTrajectoryPlan(userId: string, data: CareerTrajectoryData) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'careerTrajectory', SubscriptionPlan.EXECUTIVE)) {
        throw new AppError('Career Trajectory Planning requires Executive plan', 403);
      }

      // Create career milestones
      const milestones = await Promise.all(
        data.milestones.map(milestone => 
          this.prisma.careerMilestone.create({
            data: {
              userId,
              title: milestone.title,
              description: milestone.description,
              category: 'role', // Default category
              objective: `Achieve ${milestone.title}`,
              keyResults: milestone.skills.map(skill => `Master ${skill} skill`),
              targetDate: milestone.targetDate,
              status: 'NOT_STARTED'
            }
          })
        )
      );

      // Store OKRs in user activity for tracking
      await this.prisma.userActivity.create({
        data: {
          userId,
          action: 'career_trajectory_created',
          entityType: 'career_plan',
          metadata: {
            currentRole: data.currentRole,
            targetRole: data.targetRole,
            timeframe: data.timeframe,
            okrs: data.okrs,
            milestoneIds: milestones.map(m => m.id)
          }
        }
      });

      return {
        success: true,
        milestones,
        okrs: data.okrs,
        message: 'Career trajectory plan created successfully'
      };

    } catch (error) {
      logger.error('Error creating career trajectory plan', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to create career trajectory plan', 500);
    }
  }

  async getExecutiveNetworkingEvents(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          jobSeekerProfile: true,
          experiences: { take: 1, orderBy: { startDate: 'desc' } }
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'executiveNetworking', SubscriptionPlan.EXECUTIVE)) {
        throw new AppError('Executive Networking requires Executive plan', 403);
      }

      // Get relevant networking events
      const upcomingEvents = await this.prisma.networkingEvent.findMany({
        where: {
          startDateTime: { gte: new Date() },
          experienceLevel: { in: ['SENIOR', 'EXECUTIVE'] },
          active: true
        },
        orderBy: { startDateTime: 'asc' },
        take: 20
      });

      // Filter and score events based on user profile
      const scoredEvents = upcomingEvents.map(event => {
        const relevanceScore = this.calculateEventRelevance(event, user);
        return {
          ...event,
          relevanceScore,
          recommended: relevanceScore >= 70
        };
      }).sort((a, b) => b.relevanceScore - a.relevanceScore);

      return {
        events: scoredEvents,
        recommendations: this.generateNetworkingRecommendations(user)
      };

    } catch (error) {
      logger.error('Error fetching executive networking events', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to fetch networking events', 500);
    }
  }

  async createNetworkingEvent(data: NetworkingEventData) {
    try {
      const event = await this.prisma.networkingEvent.create({
        data: {
          title: data.title,
          description: data.description,
          eventType: data.eventType,
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
          venue: data.location,
          eventUrl: data.virtualLink,
          isVirtual: !!data.virtualLink,
          industry: data.industry,
          experienceLevel: data.experienceLevel.toUpperCase() as any,
          cost: data.cost,
          isFree: !data.cost || data.cost === 0,
          maxAttendees: data.maxAttendees,
          active: true,
          featured: false
        }
      });

      return event;

    } catch (error) {
      logger.error('Error creating networking event', { error: error instanceof Error ? error.message : String(error) });
      throw new AppError('Failed to create networking event', 500);
    }
  }

  async rsvpToEvent(userId: string, eventId: string, status: 'interested' | 'attending' | 'not_attending') {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'executiveNetworking', SubscriptionPlan.EXECUTIVE)) {
        throw new AppError('Executive Networking requires Executive plan', 403);
      }

      const event = await this.prisma.networkingEvent.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        throw new AppError('Event not found', 404);
      }

      const rsvp = await this.prisma.eventAttendee.upsert({
        where: { 
          userId_eventId: { 
            userId, 
            eventId 
          } 
        },
        update: { 
          status,
          registeredAt: status === 'attending' ? new Date() : null,
          updatedAt: new Date()
        },
        create: {
          userId,
          eventId,
          status,
          registeredAt: status === 'attending' ? new Date() : null
        }
      });

      return rsvp;

    } catch (error) {
      logger.error('Error RSVPing to event', { error: error instanceof Error ? error.message : String(error), userId, eventId });
      throw error instanceof AppError ? error : new AppError('Failed to RSVP to event', 500);
    }
  }

  private analyzeLinkedInProfile(user: any): number {
    let score = 0;

    // Basic profile completion
    if (user.firstName && user.lastName) score += 10;
    if (user.bio) score += 15;
    if (user.profilePicture) score += 10;

    // Professional information
    if (user.experiences && user.experiences.length > 0) {
      score += 20;
      if (user.experiences.length >= 3) score += 10;
    }

    // Skills and endorsements
    if (user.skills && user.skills.length >= 5) score += 15;
    if (user.skills && user.skills.length >= 10) score += 10;

    // Activity and engagement (simulated)
    score += 20; // Baseline for having a profile

    return Math.min(score, 100);
  }

  private analyzeResumeQuality(user: any): number {
    let score = 0;

    if (user.cvs && user.cvs.length > 0) {
      const latestCv = user.cvs[0];
      score = latestCv.atsScore || 50; // Use existing ATS score
    } else {
      score = 30; // Low score for no CV
    }

    return Math.min(score, 100);
  }

  private analyzeOnlinePresence(user: any): number {
    let score = 40; // Base score

    // Email domain analysis (simulated)
    if (user.email && !user.email.includes('gmail.com') && !user.email.includes('yahoo.com')) {
      score += 20; // Professional email domain
    }

    // LinkedIn profile exists
    if (user.linkedinId) score += 20;

    // Complete profile
    if (user.bio && user.experiences && user.skills) score += 20;

    return Math.min(score, 100);
  }

  private conductSWOTAnalysis(user: any, scores: any) {
    const strengths = [];
    const weaknesses = [];
    const opportunities = [];
    const threats = [];

    // Analyze strengths
    if (scores.linkedinScore >= 80) strengths.push('Strong LinkedIn presence');
    if (scores.resumeScore >= 80) strengths.push('Well-optimized resume');
    if (user.experiences && user.experiences.length >= 3) strengths.push('Diverse professional experience');

    // Analyze weaknesses
    if (scores.linkedinScore < 60) weaknesses.push('LinkedIn profile needs improvement');
    if (scores.resumeScore < 60) weaknesses.push('Resume requires optimization');
    if (!user.bio) weaknesses.push('Missing professional summary');

    // Analyze opportunities
    opportunities.push('Executive networking events in your industry');
    opportunities.push('Thought leadership content creation');
    opportunities.push('Speaking opportunities at conferences');

    // Analyze threats
    threats.push('Competitive executive job market');
    threats.push('Rapid industry changes requiring skill updates');

    return { strengths, weaknesses, opportunities, threats };
  }

  private generatePersonalBrandActionPlan(_user: any, _swot: any) {
    return {
      immediate: [
        'Update LinkedIn profile with professional headshot',
        'Craft compelling professional summary',
        'Optimize resume for ATS systems'
      ],
      shortTerm: [
        'Publish 2 thought leadership articles per month',
        'Engage actively with industry posts on LinkedIn',
        'Attend at least 1 networking event per month'
      ],
      longTerm: [
        'Build personal brand around core expertise',
        'Develop speaking opportunities',
        'Create industry-specific content calendar'
      ]
    };
  }

  private generateContentCalendar(_user: any) {
    const currentMonth = new Date().getMonth();
    const calendar = [];

    for (let i = 0; i < 12; i++) {
      const month = (currentMonth + i) % 12;
      calendar.push({
        month: new Date(2024, month).toLocaleString('en-US', { month: 'long' }),
        themes: this.getMonthlyThemes(month),
        contentTypes: ['LinkedIn article', 'Industry insight post', 'Achievement highlight'],
        frequency: '2-3 posts per week'
      });
    }

    return calendar;
  }

  private getMonthlyThemes(month: number): string[] {
    const themes = [
      ['New Year Goals', 'Industry Predictions'],
      ['Leadership Insights', 'Team Building'],
      ['Innovation', 'Technology Trends'],
      ['Growth Strategies', 'Market Analysis'],
      ['Professional Development', 'Skills Assessment'],
      ['Mid-Year Review', 'Strategic Planning'],
      ['Summer Leadership', 'Work-Life Balance'],
      ['Industry Evolution', 'Digital Transformation'],
      ['Quarterly Results', 'Performance Metrics'],
      ['Year-End Planning', 'Budget Strategies'],
      ['Networking', 'Relationship Building'],
      ['Year in Review', 'Future Outlook']
    ];

    return themes[month] || ['Leadership', 'Industry Insights'];
  }

  private async generateLeadershipResults(_assessment: any, _questions: any[], _responses: any[]) {
    // Simulate leadership assessment scoring
    const overallScore = Math.floor(Math.random() * 30) + 70; // 70-100 range

    const leadershipStyles = [
      'Transformational Leadership',
      'Strategic Leadership',
      'Collaborative Leadership'
    ];

    const competencyScores = {
      'Strategic Thinking': Math.floor(Math.random() * 20) + 80,
      'Team Building': Math.floor(Math.random() * 20) + 75,
      'Communication': Math.floor(Math.random() * 20) + 85,
      'Decision Making': Math.floor(Math.random() * 20) + 78,
      'Change Management': Math.floor(Math.random() * 20) + 82
    };

    const developmentPlan = {
      focus_areas: ['Strategic Communication', 'Digital Leadership'],
      recommendations: [
        'Executive coaching program',
        'Advanced strategic planning course',
        '360-degree feedback implementation'
      ],
      timeline: '6-12 months'
    };

    const recommendedActions = [
      'Implement regular team feedback sessions',
      'Develop cross-functional collaboration initiatives',
      'Create strategic communication plan',
      'Establish mentoring relationships'
    ];

    return {
      overallScore,
      leadershipStyles,
      competencyScores,
      developmentPlan,
      recommendedActions
    };
  }

  private calculateEventRelevance(event: any, user: any): number {
    let score = 50; // Base relevance

    // Industry alignment
    const userIndustry = user.experiences?.[0]?.company || '';
    if (event.industry && userIndustry.includes(event.industry)) {
      score += 30;
    }

    // Experience level alignment
    if (event.experienceLevel === 'EXECUTIVE') score += 20;

    // Location preference (simulated)
    if (event.location && event.location.includes(user.province || '')) {
      score += 10;
    } else if (event.virtualLink) {
      score += 5; // Virtual events are convenient
    }

    // Event type preference
    if (event.eventType === 'conference' || event.eventType === 'networking') {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private generateNetworkingRecommendations(_user: any): string[] {
    return [
      'Focus on industry-specific executive conferences',
      'Attend board governance workshops',
      'Join C-suite networking groups',
      'Participate in leadership roundtables',
      'Consider speaking opportunities at industry events'
    ];
  }
}

export default new ExecutiveService();
