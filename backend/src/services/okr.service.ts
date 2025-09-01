import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { addDays, differenceInDays, startOfQuarter, endOfQuarter, format } from 'date-fns';
import reminderService from './reminder.service';
import notificationService from './notification.service';

const prisma = new PrismaClient();

// OKR Schemas
const KeyResultSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  targetValue: z.number(),
  currentValue: z.number().default(0),
  unit: z.string(), // e.g., "applications", "interviews", "certifications", "%"
  startValue: z.number().default(0),
  status: z.enum(['not_started', 'in_progress', 'at_risk', 'completed', 'exceeded']).default('not_started'),
  dueDate: z.date(),
  milestones: z.array(z.object({
    title: z.string(),
    targetValue: z.number(),
    dueDate: z.date(),
    completed: z.boolean().default(false)
  })).optional()
});

const ObjectiveSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(['career', 'skills', 'networking', 'brand', 'financial', 'other']),
  priority: z.enum(['low', 'medium', 'high']),
  quarter: z.string(), // e.g., "Q1 2024"
  startDate: z.date(),
  endDate: z.date(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).default('draft'),
  progress: z.number().min(0).max(100).default(0),
  keyResults: z.array(KeyResultSchema),
  tags: z.array(z.string()).optional(),
  alignedWithCareerGoal: z.string().optional() // Reference to career goal
});

type Objective = z.infer<typeof ObjectiveSchema>;
type KeyResult = z.infer<typeof KeyResultSchema>;

export class OKRService {
  /**
   * Create a new objective with key results
   */
  async createObjective(objectiveData: Partial<Objective>): Promise<Objective> {
    try {
      const validated = ObjectiveSchema.parse({
        ...objectiveData,
        startDate: objectiveData.startDate || startOfQuarter(new Date()),
        endDate: objectiveData.endDate || endOfQuarter(new Date()),
        quarter: objectiveData.quarter || this.getCurrentQuarter()
      });

      // Save objective
      const objective = await prisma.objective.create({
        data: {
          userId: validated.userId,
          title: validated.title,
          description: validated.description,
          category: validated.category,
          priority: validated.priority,
          quarter: validated.quarter,
          startDate: validated.startDate,
          endDate: validated.endDate,
          status: validated.status,
          progress: validated.progress,
          tags: JSON.stringify(validated.tags || []),
          alignedWithCareerGoal: validated.alignedWithCareerGoal
        }
      });

      // Save key results
      for (const kr of validated.keyResults) {
        await prisma.keyResult.create({
          data: {
            objectiveId: objective.id,
            title: kr.title,
            description: kr.description,
            targetValue: kr.targetValue,
            currentValue: kr.currentValue,
            unit: kr.unit,
            startValue: kr.startValue,
            status: kr.status,
            dueDate: kr.dueDate,
            milestones: JSON.stringify(kr.milestones || [])
          }
        });
      }

      // Set up reminders
      await this.setupOKRReminders(objective.id, validated.userId);

      return this.getObjectiveWithKeyResults(objective.id);
    } catch (error) {
      console.error('Error creating objective:', error);
      throw new Error('Failed to create objective');
    }
  }

  /**
   * Update key result progress
   */
  async updateKeyResultProgress(keyResultId: string, currentValue: number): Promise<KeyResult> {
    try {
      const keyResult = await prisma.keyResult.findUnique({
        where: { id: keyResultId },
        include: { objective: true }
      });

      if (!keyResult) {
        throw new Error('Key result not found');
      }

      // Calculate progress and status
      const progress = this.calculateProgress(
        keyResult.startValue,
        currentValue,
        keyResult.targetValue
      );

      const status = this.determineKeyResultStatus(
        progress,
        keyResult.dueDate,
        currentValue,
        keyResult.targetValue
      );

      // Update key result
      const updated = await prisma.keyResult.update({
        where: { id: keyResultId },
        data: {
          currentValue,
          status,
          updatedAt: new Date()
        }
      });

      // Update milestones if applicable
      await this.checkAndUpdateMilestones(keyResultId, currentValue);

      // Update objective progress
      await this.updateObjectiveProgress(keyResult.objectiveId);

      // Send notification if target reached
      if (currentValue >= keyResult.targetValue && keyResult.status !== 'completed') {
        await notificationService.sendNotification({
          userId: keyResult.objective.userId,
          type: 'okr_milestone',
          title: 'Key Result Achieved! ',
          message: `Congratulations! You've achieved "${keyResult.title}"`,
          data: {
            keyResultId,
            objectiveId: keyResult.objectiveId,
            achievement: {
              target: keyResult.targetValue,
              achieved: currentValue,
              unit: keyResult.unit
            }
          }
        });
      }

      return this.formatKeyResult(updated);
    } catch (error) {
      console.error('Error updating key result:', error);
      throw new Error('Failed to update key result progress');
    }
  }

  /**
   * Get user's active OKRs for current quarter
   */
  async getCurrentOKRs(userId: string): Promise<Objective[]> {
    try {
      const currentQuarter = this.getCurrentQuarter();
      
      const objectives = await prisma.objective.findMany({
        where: {
          userId,
          quarter: currentQuarter,
          status: { in: ['active', 'at_risk'] }
        },
        include: {
          keyResults: true
        },
        orderBy: { priority: 'desc' }
      });

      return objectives.map(obj => this.formatObjective(obj));
    } catch (error) {
      console.error('Error getting current OKRs:', error);
      throw new Error('Failed to get current OKRs');
    }
  }

  /**
   * Generate OKR suggestions based on career goals
   */
  async generateOKRSuggestions(userId: string, careerGoal?: string): Promise<any[]> {
    try {
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId },
        include: { user: true }
      });

      if (!userProfile) return [];

      const suggestions = [];

      // Career progression OKRs
      suggestions.push({
        category: 'career',
        title: 'Advance to Senior Role',
        description: 'Position myself for promotion or senior role transition',
        keyResults: [
          {
            title: 'Complete 3 high-impact projects',
            targetValue: 3,
            unit: 'projects'
          },
          {
            title: 'Receive performance rating of 4+',
            targetValue: 4,
            unit: 'rating'
          },
          {
            title: 'Lead 2 cross-functional initiatives',
            targetValue: 2,
            unit: 'initiatives'
          }
        ]
      });

      // Skill development OKRs
      suggestions.push({
        category: 'skills',
        title: 'Master In-Demand Technologies',
        description: 'Build expertise in high-demand technical skills',
        keyResults: [
          {
            title: 'Complete 2 professional certifications',
            targetValue: 2,
            unit: 'certifications'
          },
          {
            title: 'Build 4 portfolio projects',
            targetValue: 4,
            unit: 'projects'
          },
          {
            title: 'Contribute to 3 open source projects',
            targetValue: 3,
            unit: 'contributions'
          }
        ]
      });

      // Networking OKRs
      suggestions.push({
        category: 'networking',
        title: 'Expand Professional Network',
        description: 'Build meaningful connections in target industry',
        keyResults: [
          {
            title: 'Attend 6 networking events',
            targetValue: 6,
            unit: 'events'
          },
          {
            title: 'Connect with 50 industry professionals',
            targetValue: 50,
            unit: 'connections'
          },
          {
            title: 'Schedule 12 informational interviews',
            targetValue: 12,
            unit: 'interviews'
          }
        ]
      });

      // Personal brand OKRs
      suggestions.push({
        category: 'brand',
        title: 'Establish Thought Leadership',
        description: 'Build visibility as an expert in my field',
        keyResults: [
          {
            title: 'Publish 6 LinkedIn articles',
            targetValue: 6,
            unit: 'articles'
          },
          {
            title: 'Achieve 80% LinkedIn profile completeness',
            targetValue: 80,
            unit: '%'
          },
          {
            title: 'Speak at 2 industry events',
            targetValue: 2,
            unit: 'events'
          }
        ]
      });

      // Job search OKRs
      suggestions.push({
        category: 'career',
        title: 'Land Dream Role',
        description: 'Successfully transition to target role',
        keyResults: [
          {
            title: 'Submit 30 targeted applications',
            targetValue: 30,
            unit: 'applications'
          },
          {
            title: 'Secure 6 interviews',
            targetValue: 6,
            unit: 'interviews'
          },
          {
            title: 'Receive 2 job offers',
            targetValue: 2,
            unit: 'offers'
          }
        ]
      });

      return suggestions;
    } catch (error) {
      console.error('Error generating OKR suggestions:', error);
      return [];
    }
  }

  /**
   * Get OKR analytics and insights
   */
  async getOKRAnalytics(userId: string): Promise<any> {
    try {
      const objectives = await prisma.objective.findMany({
        where: { userId },
        include: { keyResults: true }
      });

      const totalObjectives = objectives.length;
      const activeObjectives = objectives.filter(o => o.status === 'active').length;
      const completedObjectives = objectives.filter(o => o.status === 'completed').length;
      
      const avgProgress = objectives.length > 0
        ? objectives.reduce((sum, o) => sum + o.progress, 0) / objectives.length
        : 0;

      const keyResultStats = objectives.flatMap(o => o.keyResults);
      const totalKeyResults = keyResultStats.length;
      const completedKeyResults = keyResultStats.filter(kr => kr.status === 'completed').length;
      const atRiskKeyResults = keyResultStats.filter(kr => kr.status === 'at_risk').length;

      // Category breakdown
      const categoryBreakdown = objectives.reduce((acc, obj) => {
        acc[obj.category] = (acc[obj.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Historical progress
      const quarters = this.getLastFourQuarters();
      const historicalProgress = await Promise.all(
        quarters.map(async quarter => {
          const quarterObjectives = objectives.filter(o => o.quarter === quarter);
          const avgQuarterProgress = quarterObjectives.length > 0
            ? quarterObjectives.reduce((sum, o) => sum + o.progress, 0) / quarterObjectives.length
            : 0;
          
          return {
            quarter,
            avgProgress: Math.round(avgQuarterProgress),
            completedCount: quarterObjectives.filter(o => o.status === 'completed').length
          };
        })
      );

      return {
        summary: {
          totalObjectives,
          activeObjectives,
          completedObjectives,
          avgProgress: Math.round(avgProgress),
          totalKeyResults,
          completedKeyResults,
          atRiskKeyResults,
          successRate: totalObjectives > 0 
            ? Math.round((completedObjectives / totalObjectives) * 100)
            : 0
        },
        categoryBreakdown,
        historicalProgress,
        recommendations: this.generateOKRRecommendations({
          avgProgress,
          atRiskCount: atRiskKeyResults,
          successRate: completedObjectives / Math.max(totalObjectives, 1)
        })
      };
    } catch (error) {
      console.error('Error getting OKR analytics:', error);
      throw new Error('Failed to get OKR analytics');
    }
  }

  /**
   * Setup reminders for OKR milestones
   */
  private async setupOKRReminders(objectiveId: string, userId: string): Promise<void> {
    try {
      const objective = await prisma.objective.findUnique({
        where: { id: objectiveId },
        include: { keyResults: true }
      });

      if (!objective) return;

      // Weekly check-in reminder
      await reminderService.createReminder({
        userId,
        type: 'okr_checkin',
        title: 'Weekly OKR Check-in',
        message: `Time to update progress on: ${objective.title}`,
        dueDate: addDays(new Date(), 7),
        recurring: true,
        recurringInterval: 'weekly',
        metadata: { objectiveId }
      });

      // Key result deadline reminders
      for (const kr of objective.keyResults) {
        const daysUntilDue = differenceInDays(kr.dueDate, new Date());
        
        if (daysUntilDue > 7) {
          await reminderService.createReminder({
            userId,
            type: 'okr_deadline',
            title: 'Key Result Deadline Approaching',
            message: `"${kr.title}" is due in 7 days`,
            dueDate: addDays(kr.dueDate, -7),
            metadata: { objectiveId, keyResultId: kr.id }
          });
        }
      }
    } catch (error) {
      console.error('Error setting up OKR reminders:', error);
    }
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(startValue: number, currentValue: number, targetValue: number): number {
    if (targetValue === startValue) return 100;
    const progress = ((currentValue - startValue) / (targetValue - startValue)) * 100;
    return Math.max(0, Math.min(100, Math.round(progress)));
  }

  /**
   * Determine key result status
   */
  private determineKeyResultStatus(
    progress: number,
    dueDate: Date,
    currentValue: number,
    targetValue: number
  ): string {
    if (currentValue >= targetValue) return 'completed';
    if (currentValue > targetValue) return 'exceeded';
    
    const daysUntilDue = differenceInDays(dueDate, new Date());
    const expectedProgress = ((new Date().getTime() - new Date().getTime()) / 
                            (dueDate.getTime() - new Date().getTime())) * 100;
    
    if (daysUntilDue < 0) return 'at_risk'; // Past due
    if (progress < expectedProgress - 20) return 'at_risk'; // Behind schedule
    if (progress > 0) return 'in_progress';
    return 'not_started';
  }

  /**
   * Update objective progress based on key results
   */
  private async updateObjectiveProgress(objectiveId: string): Promise<void> {
    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      include: { keyResults: true }
    });

    if (!objective) return;

    const totalProgress = objective.keyResults.reduce((sum, kr) => {
      const progress = this.calculateProgress(kr.startValue, kr.currentValue, kr.targetValue);
      return sum + progress;
    }, 0);

    const avgProgress = objective.keyResults.length > 0
      ? totalProgress / objective.keyResults.length
      : 0;

    await prisma.objective.update({
      where: { id: objectiveId },
      data: { 
        progress: Math.round(avgProgress),
        status: avgProgress >= 100 ? 'completed' : 
                avgProgress > 0 ? 'active' : 'not_started'
      }
    });
  }

  /**
   * Check and update milestones
   */
  private async checkAndUpdateMilestones(keyResultId: string, currentValue: number): Promise<void> {
    const keyResult = await prisma.keyResult.findUnique({
      where: { id: keyResultId }
    });

    if (!keyResult || !keyResult.milestones) return;

    const milestones = JSON.parse(keyResult.milestones as string);
    let updated = false;

    for (const milestone of milestones) {
      if (!milestone.completed && currentValue >= milestone.targetValue) {
        milestone.completed = true;
        updated = true;
        
        // Send milestone notification
        const objective = await prisma.objective.findUnique({
          where: { id: keyResult.objectiveId }
        });
        
        if (objective) {
          await notificationService.sendNotification({
            userId: objective.userId,
            type: 'okr_milestone',
            title: 'Milestone Achieved! ',
            message: `You've reached the milestone "${milestone.title}" for ${keyResult.title}`,
            data: { keyResultId, milestone }
          });
        }
      }
    }

    if (updated) {
      await prisma.keyResult.update({
        where: { id: keyResultId },
        data: { milestones: JSON.stringify(milestones) }
      });
    }
  }

  /**
   * Get current quarter string
   */
  private getCurrentQuarter(): string {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `Q${quarter} ${now.getFullYear()}`;
  }

  /**
   * Get last four quarters
   */
  private getLastFourQuarters(): string[] {
    const quarters = [];
    const now = new Date();
    
    for (let i = 0; i < 4; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - (i * 3));
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      quarters.push(`Q${quarter} ${date.getFullYear()}`);
    }
    
    return quarters.reverse();
  }

  /**
   * Generate OKR recommendations
   */
  private generateOKRRecommendations(stats: any): string[] {
    const recommendations = [];

    if (stats.avgProgress < 50) {
      recommendations.push('Consider breaking down objectives into smaller, more achievable key results');
    }

    if (stats.atRiskCount > 2) {
      recommendations.push('You have several at-risk key results. Schedule time to focus on these priorities');
    }

    if (stats.successRate < 0.5) {
      recommendations.push('Your OKR success rate is below 50%. Consider setting more realistic targets');
    }

    if (stats.successRate > 0.9) {
      recommendations.push('You\'re achieving most of your OKRs! Consider setting more ambitious targets');
    }

    return recommendations;
  }

  /**
   * Format objective
   */
  private formatObjective(objective: any): Objective {
    return {
      ...objective,
      tags: objective.tags ? JSON.parse(objective.tags) : [],
      keyResults: objective.keyResults?.map((kr: any) => this.formatKeyResult(kr)) || []
    };
  }

  /**
   * Format key result
   */
  private formatKeyResult(keyResult: any): KeyResult {
    return {
      ...keyResult,
      milestones: keyResult.milestones ? JSON.parse(keyResult.milestones) : []
    };
  }

  /**
   * Get objective with key results
   */
  private async getObjectiveWithKeyResults(objectiveId: string): Promise<Objective> {
    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      include: { keyResults: true }
    });

    if (!objective) {
      throw new Error('Objective not found');
    }

    return this.formatObjective(objective);
  }
}

export default new OKRService();
