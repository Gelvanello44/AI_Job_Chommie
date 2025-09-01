import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { differenceInDays, format } from 'date-fns';

const prisma = new PrismaClient();

// Brand Audit Questionnaire Schema
const BrandAuditInputSchema = z.object({
  userId: z.string(),
  presence: z.object({
    linkedin: z.object({
      headlineQuality: z.number().min(0).max(10),
      summaryQuality: z.number().min(0).max(10),
      activityLevel: z.number().min(0).max(10),
      connections: z.number().min(0)
    }),
    github: z.object({
      repoCount: z.number().min(0),
      recentCommits: z.number().min(0)
    }).optional(),
    personalSite: z.object({
      hasSite: z.boolean(),
      lastUpdatedDays: z.number().min(0).optional(),
      blogPostsLast90Days: z.number().min(0).optional()
    }).optional(),
    twitter: z.object({
      activityLevel: z.number().min(0).max(10).optional(),
      followers: z.number().min(0).optional()
    }).optional()
  }),
  authority: z.object({
    speakingEngagements: z.number().min(0),
    publications: z.number().min(0),
    certifications: z.number().min(0)
  }),
  consistency: z.object({
    visualConsistency: z.number().min(0).max(10),
    bioConsistency: z.number().min(0).max(10),
    messagingConsistency: z.number().min(0).max(10)
  }),
  goals: z.array(z.object({
    objective: z.string(),
    timelineDays: z.number().min(7).max(365),
    priority: z.enum(['low', 'medium', 'high'])
  }))
});

type BrandAuditInput = z.infer<typeof BrandAuditInputSchema>;

type BrandAuditScorecard = {
  overallScore: number;
  pillars: {
    presence: number;
    authority: number;
    consistency: number;
  };
  strengths: string[];
  improvements: string[];
  actions: { action: string; priority: 'low' | 'medium' | 'high'; dueDate: Date }[];
};

export class BrandAuditService {
  private WEIGHTS = {
    presence: 0.45,
    authority: 0.3,
    consistency: 0.25
  };

  async runAudit(input: BrandAuditInput): Promise<BrandAuditScorecard> {
    const data = BrandAuditInputSchema.parse(input);

    // Calculate pillar scores (0-100)
    const presenceScore = this.calculatePresenceScore(data);
    const authorityScore = this.calculateAuthorityScore(data);
    const consistencyScore = this.calculateConsistencyScore(data);

    const overallScore = Math.round(
      presenceScore * this.WEIGHTS.presence +
      authorityScore * this.WEIGHTS.authority +
      consistencyScore * this.WEIGHTS.consistency
    );

    const strengths = this.getStrengths({ presenceScore, authorityScore, consistencyScore });
    const improvements = this.getImprovements({ presenceScore, authorityScore, consistencyScore });

    const actions = this.generateActionPlan(data, { presenceScore, authorityScore, consistencyScore });

    // Persist results
    await prisma.brandAudit.create({
      data: {
        userId: data.userId,
        overallScore,
        presenceScore,
        authorityScore,
        consistencyScore,
        strengths: JSON.stringify(strengths),
        improvements: JSON.stringify(improvements),
        actions: JSON.stringify(actions),
        rawInput: JSON.stringify(data)
      }
    });

    return {
      overallScore,
      pillars: {
        presence: presenceScore,
        authority: authorityScore,
        consistency: consistencyScore
      },
      strengths,
      improvements,
      actions
    };
  }

  private calculatePresenceScore(data: BrandAuditInput): number {
    const li = data.presence.linkedin;
    const linkedinScore = (
      li.headlineQuality * 0.25 +
      li.summaryQuality * 0.25 +
      li.activityLevel * 0.25 +
      Math.min(li.connections / 500, 1) * 10 // cap at 500 connections -> 10 points
    ) * 2.5; // scale to 100

    const githubScore = data.presence.github
      ? Math.min(data.presence.github.repoCount / 20, 1) * 60 + Math.min(data.presence.github.recentCommits / 30, 1) * 40
      : 0;

    const siteScore = data.presence.personalSite
      ? (data.presence.personalSite.hasSite ? 60 : 0) +
        Math.max(0, 40 - (data.presence.personalSite.lastUpdatedDays || 999) * 0.5)
      : 0;

    const twitterScore = data.presence.twitter?.activityLevel
      ? data.presence.twitter.activityLevel * 10
      : 0;

    // Weighted presence score: LinkedIn 50%, GitHub 20%, Site 20%, Twitter 10%
    return Math.round(
      linkedinScore * 0.5 +
      githubScore * 0.2 +
      siteScore * 0.2 +
      twitterScore * 0.1
    );
  }

  private calculateAuthorityScore(data: BrandAuditInput): number {
    const speaking = Math.min(data.authority.speakingEngagements, 12) / 12 * 40;
    const publications = Math.min(data.authority.publications, 12) / 12 * 40;
    const certs = Math.min(data.authority.certifications, 10) / 10 * 20;
    return Math.round(speaking + publications + certs);
  }

  private calculateConsistencyScore(data: BrandAuditInput): number {
    const c = data.consistency;
    return Math.round((c.visualConsistency + c.bioConsistency + c.messagingConsistency) / 30 * 100);
  }

  private getStrengths(scores: { presenceScore: number; authorityScore: number; consistencyScore: number }): string[] {
    const strengths: string[] = [];
    if (scores.presenceScore >= 70) strengths.push('Strong online presence');
    if (scores.authorityScore >= 60) strengths.push('Good authority signals (speaking/publications)');
    if (scores.consistencyScore >= 75) strengths.push('Consistent brand across platforms');
    if (strengths.length === 0) strengths.push('Foundational brand assets in place');
    return strengths;
  }

  private getImprovements(scores: { presenceScore: number; authorityScore: number; consistencyScore: number }): string[] {
    const improvements: string[] = [];
    if (scores.presenceScore < 70) improvements.push('Improve LinkedIn completeness and activity; consider adding a personal site');
    if (scores.authorityScore < 60) improvements.push('Increase authority signals: publish articles, speak at events, earn relevant certifications');
    if (scores.consistencyScore < 75) improvements.push('Align visuals, bio, and messaging across platforms');
    return improvements;
  }

  private generateActionPlan(data: BrandAuditInput, scores: { presenceScore: number; authorityScore: number; consistencyScore: number }): { action: string; priority: 'low' | 'medium' | 'high'; dueDate: Date }[] {
    const actions: { action: string; priority: 'low' | 'medium' | 'high'; dueDate: Date }[] = [];

    // Presence actions
    if (scores.presenceScore < 70) {
      actions.push({ action: 'Revise LinkedIn headline and summary with keywords and achievements', priority: 'high', dueDate: this.addDays(14) });
      actions.push({ action: 'Post weekly on LinkedIn for the next 8 weeks', priority: 'medium', dueDate: this.addDays(56) });
      if (!data.presence.personalSite?.hasSite) {
        actions.push({ action: 'Set up a simple personal portfolio site (Notion/Super/Netlify)', priority: 'medium', dueDate: this.addDays(21) });
      }
    }

    // Authority actions
    if (scores.authorityScore < 60) {
      actions.push({ action: 'Draft and publish 2 articles on industry topics', priority: 'high', dueDate: this.addDays(30) });
      actions.push({ action: 'Apply to speak at 1-2 local meetups or webinars', priority: 'medium', dueDate: this.addDays(45) });
      actions.push({ action: 'Identify one relevant certification to pursue', priority: 'low', dueDate: this.addDays(60) });
    }

    // Consistency actions
    if (scores.consistencyScore < 75) {
      actions.push({ action: 'Standardize profile photo and banner across platforms', priority: 'high', dueDate: this.addDays(10) });
      actions.push({ action: 'Align bios (LinkedIn/Twitter/site) with consistent messaging', priority: 'high', dueDate: this.addDays(14) });
    }

    // Goal-based actions
    for (const g of data.goals) {
      actions.push({ action: `Progress on goal: ${g.objective}`, priority: g.priority, dueDate: this.addDays(g.timelineDays) });
    }

    // Cap to top 10 actions by priority/soonest due
    return actions
      .sort((a, b) => (this.priorityWeight(b.priority) - this.priorityWeight(a.priority)) || (a.dueDate.getTime() - b.dueDate.getTime()))
      .slice(0, 10);
  }

  private priorityWeight(p: 'low' | 'medium' | 'high'): number {
    return p === 'high' ? 3 : p === 'medium' ? 2 : 1;
  }

  private addDays(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  async getLatestAudit(userId: string): Promise<any> {
    const audit = await prisma.brandAudit.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!audit) return null;

    return {
      overallScore: audit.overallScore,
      pillars: {
        presence: audit.presenceScore,
        authority: audit.authorityScore,
        consistency: audit.consistencyScore
      },
      strengths: JSON.parse(audit.strengths as string),
      improvements: JSON.parse(audit.improvements as string),
      actions: JSON.parse(audit.actions as string),
      createdAt: audit.createdAt
    };
  }
}

export default new BrandAuditService();

