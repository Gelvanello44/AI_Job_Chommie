/**
 * Skills Assessment Service
 * Handles skills assessment quiz system, results, and shareable badges
 */

import { SkillsAssessment, SkillAssessmentType } from '@prisma/client'; // User not used
import { prisma } from '../config/database.js';
import logger from '../config/logger.js';

export interface AssessmentQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'rating' | 'scenario';
  options?: string[];
  category: string;
  weight: number;
}

export interface AssessmentResult {
  score: number;
  topStrengths: string[];
  improvementAreas: string[];
  recommendations: string[];
  categoryScores: Record<string, number>;
}

export interface ShareableBadge {
  title: string;
  description: string;
  imageUrl: string;
  linkedinText: string;
  profileText: string;
}

export class SkillsAssessmentService {
  /**
   * Get available assessment types
   */
  static getAssessmentTypes(): Array<{type: SkillAssessmentType, title: string, description: string}> {
    return [
      {
        type: 'TECHNICAL',
        title: 'Technical Skills Assessment',
        description: 'Evaluate your technical competencies and identify areas for growth'
      },
      {
        type: 'LEADERSHIP',
        title: 'Leadership Assessment',
        description: 'Discover your leadership style and management capabilities'
      },
      {
        type: 'COMMUNICATION',
        title: 'Communication Skills Assessment',
        description: 'Assess your written and verbal communication effectiveness'
      },
      {
        type: 'PROBLEM_SOLVING',
        title: 'Problem Solving Assessment',
        description: 'Evaluate your analytical thinking and problem-solving approach'
      }
    ];
  }

  /**
   * Create a new skills assessment for user
   */
  static async createAssessment(
    userId: string, 
    type: SkillAssessmentType,
    customTitle?: string
  ): Promise<SkillsAssessment> {
    const questions = this.generateQuestions(type);
    const assessmentTypes = this.getAssessmentTypes();
    const typeInfo = assessmentTypes.find(t => t.type === type);

    const assessment = await prisma.skillsAssessment.create({
      data: {
        userId,
        type,
        title: customTitle || typeInfo?.title || `${type} Assessment`,
        description: typeInfo?.description,
        questions: questions as any,
        retakeAllowed: true,
        nextRetakeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      }
    });

    logger.info('Skills assessment created', {
      userId,
      assessmentId: assessment.id,
      type
    });

    return assessment;
  }

  /**
   * Generate questions for assessment type
   */
  private static generateQuestions(type: SkillAssessmentType): AssessmentQuestion[] {
    const baseQuestions: Record<SkillAssessmentType, AssessmentQuestion[]> = {
      TECHNICAL: [
        {
          id: 'tech_1',
          question: 'How do you approach learning new technologies?',
          type: 'multiple_choice',
          options: [
            'I dive deep into documentation and tutorials',
            'I prefer hands-on projects and experimentation',
            'I take structured courses and certifications',
            'I learn through mentoring and collaboration'
          ],
          category: 'learning_approach',
          weight: 1.0
        },
        {
          id: 'tech_2',
          question: 'Rate your experience with version control systems (Git)',
          type: 'rating',
          category: 'version_control',
          weight: 1.2
        },
        {
          id: 'tech_3',
          question: 'When debugging complex issues, which approach do you typically use?',
          type: 'scenario',
          options: [
            'Systematic isolation and testing',
            'Collaborative problem-solving with team',
            'Research similar issues online',
            'Use debugging tools and logging'
          ],
          category: 'problem_solving',
          weight: 1.5
        }
      ],
      LEADERSHIP: [
        {
          id: 'lead_1',
          question: 'How do you motivate team members during challenging projects?',
          type: 'scenario',
          options: [
            'Set clear goals and celebrate small wins',
            'Provide individual support and mentoring',
            'Lead by example and maintain transparency',
            'Adjust workload and provide resources'
          ],
          category: 'motivation',
          weight: 1.5
        },
        {
          id: 'lead_2',
          question: 'Rate your comfort level with difficult conversations',
          type: 'rating',
          category: 'difficult_conversations',
          weight: 1.3
        }
      ],
      COMMUNICATION: [
        {
          id: 'comm_1',
          question: 'How do you tailor your communication style to different audiences?',
          type: 'multiple_choice',
          options: [
            'I adjust technical detail based on audience expertise',
            'I use different channels (email, chat, face-to-face)',
            'I modify tone and formality level',
            'I provide context and background as needed'
          ],
          category: 'audience_adaptation',
          weight: 1.4
        }
      ],
      PROBLEM_SOLVING: [
        {
          id: 'prob_1',
          question: 'When facing a complex problem, what is your first step?',
          type: 'multiple_choice',
          options: [
            'Break it down into smaller components',
            'Research similar problems and solutions',
            'Brainstorm multiple approaches',
            'Gather all relevant information first'
          ],
          category: 'problem_approach',
          weight: 1.0
        }
      ]
    };

    return baseQuestions[type] || [];
  }

  /**
   * Submit assessment answers and calculate results
   */
  static async submitAssessment(
    assessmentId: string,
    answers: Record<string, any>
  ): Promise<SkillsAssessment> {
    const assessment = await prisma.skillsAssessment.findUnique({
      where: { id: assessmentId }
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    if (assessment.completed) {
      throw new Error('Assessment already completed');
    }

    // Calculate results
    const results = this.calculateResults(assessment.questions as any, answers);
    const badges = this.generateShareableBadges(assessment.type, results);

    const updatedAssessment = await prisma.skillsAssessment.update({
      where: { id: assessmentId },
      data: {
        answers: answers as any,
        results: results as any,
        score: results.score,
        topStrengths: results.topStrengths,
        improvementAreas: results.improvementAreas,
        completed: true,
        completedAt: new Date(),
        shareableBadges: badges as any
      }
    });

    logger.info('Skills assessment completed', {
      assessmentId,
      userId: assessment.userId,
      score: results.score,
      topStrengths: results.topStrengths
    });

    return updatedAssessment;
  }

  /**
   * Calculate assessment results from answers
   */
  private static calculateResults(
    questions: AssessmentQuestion[], 
    answers: Record<string, any>
  ): AssessmentResult {
    let totalScore = 0;
    let maxScore = 0;
    const categoryScores: Record<string, { score: number; maxScore: number }> = {};

    // Calculate scores by category
    questions.forEach(question => {
      const answer = answers[question.id];
      if (answer !== undefined) {
        let questionScore = 0;
        
        if (question.type === 'rating') {
          questionScore = (answer / 5) * 100; // Normalize rating to 0-100
        } else if (question.type === 'multiple_choice' || question.type === 'scenario') {
          questionScore = 75; // Base score for completing question
        }

        const weightedScore = questionScore * question.weight;
        totalScore += weightedScore;
        maxScore += 100 * question.weight;

        if (!categoryScores[question.category]) {
          categoryScores[question.category] = { score: 0, maxScore: 0 };
        }
        categoryScores[question.category].score += weightedScore;
        categoryScores[question.category].maxScore += 100 * question.weight;
      }
    });

    // Calculate final score and category percentages
    const finalScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const categoryPercentages: Record<string, number> = {};
    
    Object.entries(categoryScores).forEach(([category, scores]) => {
      categoryPercentages[category] = scores.maxScore > 0 ? 
        (scores.score / scores.maxScore) * 100 : 0;
    });

    // Determine top strengths and improvement areas
    const sortedCategories = Object.entries(categoryPercentages)
      .sort(([,a], [,b]) => b - a);

    const topStrengths = sortedCategories.slice(0, 3).map(([category]) => 
      this.formatCategoryName(category)
    );

    const improvementAreas = sortedCategories.slice(-2).map(([category]) => 
      this.formatCategoryName(category)
    );

    const recommendations = this.generateRecommendations(topStrengths, improvementAreas);

    return {
      score: Math.round(finalScore),
      topStrengths,
      improvementAreas,
      recommendations,
      categoryScores: categoryPercentages
    };
  }

  /**
   * Format category name for display
   */
  private static formatCategoryName(category: string): string {
    return category.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate recommendations based on assessment results
   */
  private static generateRecommendations(
    strengths: string[], 
    improvements: string[]
  ): string[] {
    const recommendations = [];

    // Leverage strengths
    if (strengths.length > 0) {
      recommendations.push(`Leverage your ${strengths[0].toLowerCase()} skills in your job applications`);
    }

    // Address improvement areas
    if (improvements.length > 0) {
      recommendations.push(`Consider developing your ${improvements[0].toLowerCase()} capabilities`);
    }

    // General recommendations
    recommendations.push(
      'Update your LinkedIn profile to highlight your top strengths',
      'Consider taking online courses to address skill gaps',
      'Practice skills through projects or volunteer work'
    );

    return recommendations;
  }

  /**
   * Generate shareable badges for LinkedIn/profile
   */
  private static generateShareableBadges(
    type: SkillAssessmentType, 
    results: AssessmentResult
  ): ShareableBadge[] {
    const badges: ShareableBadge[] = [];

    // Main assessment badge
    badges.push({
      title: `${this.formatCategoryName(type)} Assessment Completed`,
      description: `Scored ${results.score}% in ${type.toLowerCase()} skills assessment`,
      imageUrl: this.generateBadgeImage(type, results.score),
      linkedinText: `Just completed a comprehensive ${type.toLowerCase()} skills assessment with AI Job Chommie! Scored ${results.score}% and identified my top strengths. #SkillsDevelopment #CareerGrowth #AIJobChommie`,
      profileText: `${type} Skills Assessment: ${results.score}% (${new Date().getFullYear()})`
    });

    // Top strength badges
    results.topStrengths.slice(0, 2).forEach(strength => {
      badges.push({
        title: `Top Strength: ${strength}`,
        description: `Identified as a key strength in ${type.toLowerCase()} assessment`,
        imageUrl: `/api/v1/badges/generate?strength=${encodeURIComponent(strength)}`,
        linkedinText: `Proud to share that ${strength.toLowerCase()} was identified as one of my top strengths!  #${strength.replace(' ', '')} #StrengthsIdentification`,
        profileText: `Key Strength: ${strength}`
      });
    });

    return badges;
  }

  /**
   * Get user's completed assessments
   */
  static async getUserAssessments(userId: string): Promise<SkillsAssessment[]> {
    return await prisma.skillsAssessment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get assessment results with detailed breakdown
   */
  static async getAssessmentResults(assessmentId: string): Promise<SkillsAssessment | null> {
    return await prisma.skillsAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            subscriptionPlan: true
          }
        }
      }
    });
  }

  /**
   * Check if user can retake assessment
   */
  static async canRetakeAssessment(userId: string, type: SkillAssessmentType): Promise<boolean> {
    const lastAssessment = await prisma.skillsAssessment.findFirst({
      where: {
        userId,
        type,
        completed: true
      },
      orderBy: { completedAt: 'desc' }
    });

    if (!lastAssessment || !lastAssessment.nextRetakeDate) {
      return true;
    }

    return new Date() >= lastAssessment.nextRetakeDate;
  }

  /**
   * Get assessment dashboard data for user
   */
  static async getAssessmentDashboard(userId: string) {
    const assessments = await prisma.skillsAssessment.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' }
    });

    const completedAssessments = assessments.filter(a => a.completed);
    const pendingAssessments = assessments.filter(a => !a.completed);

    // Calculate overall skill profile
    const skillProfile = this.calculateOverallSkillProfile(completedAssessments);

    // Get retake availability
    const retakeAvailability = await Promise.all(
      this.getAssessmentTypes().map(async (typeInfo) => ({
        type: typeInfo.type,
        title: typeInfo.title,
        canRetake: await this.canRetakeAssessment(userId, typeInfo.type),
        lastTaken: completedAssessments.find(a => a.type === typeInfo.type)?.completedAt
      }))
    );

    return {
      completedCount: completedAssessments.length,
      pendingCount: pendingAssessments.length,
      overallScore: skillProfile.overallScore,
      topStrengths: skillProfile.topStrengths,
      assessments: completedAssessments.map(a => ({
        id: a.id,
        type: a.type,
        title: a.title,
        score: a.score,
        completedAt: a.completedAt,
        topStrengths: a.topStrengths
      })),
      retakeAvailability,
      recommendedNext: this.getRecommendedAssessments(completedAssessments)
    };
  }

  /**
   * Calculate overall skill profile from completed assessments
   */
  private static calculateOverallSkillProfile(assessments: SkillsAssessment[]) {
    if (assessments.length === 0) {
      return { overallScore: 0, topStrengths: [] };
    }

    const totalScore = assessments.reduce((sum, a) => sum + (a.score || 0), 0);
    const overallScore = Math.round(totalScore / assessments.length);

    // Collect all strengths and rank by frequency
    const allStrengths: Record<string, number> = {};
    assessments.forEach(assessment => {
      assessment.topStrengths.forEach(strength => {
        allStrengths[strength] = (allStrengths[strength] || 0) + 1;
      });
    });

    const topStrengths = Object.entries(allStrengths)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([strength]) => strength);

    return { overallScore, topStrengths };
  }

  /**
   * Get recommended assessments based on completed ones
   */
  private static getRecommendedAssessments(completed: SkillsAssessment[]): SkillAssessmentType[] {
    const completedTypes = completed.map(a => a.type);
    const allTypes: SkillAssessmentType[] = ['TECHNICAL', 'LEADERSHIP', 'COMMUNICATION', 'PROBLEM_SOLVING'];
    
    return allTypes.filter(type => !completedTypes.includes(type));
  }

  /**
   * Generate shareable badge image URL (placeholder implementation)
   */
  static generateBadgeImage(type: string, score: number): string {
    // This would integrate with an image generation service or CDN
    return `/api/v1/badges/generate?type=${encodeURIComponent(type)}&score=${encodeURIComponent(String(score))}`;
  }

  /**
   * Get assessment statistics (admin view)
   */
  static async getAssessmentStatistics() {
    const totalAssessments = await prisma.skillsAssessment.count();
    const completedAssessments = await prisma.skillsAssessment.count({
      where: { completed: true }
    });

    const assessmentsByType = await prisma.skillsAssessment.groupBy({
      by: ['type'],
      _count: true,
      where: { completed: true }
    });

    const averageScores = await prisma.skillsAssessment.groupBy({
      by: ['type'],
      _avg: { score: true },
      where: { completed: true }
    });

    return {
      totalAssessments,
      completedAssessments,
      completionRate: totalAssessments > 0 ? (completedAssessments / totalAssessments) * 100 : 0,
      assessmentsByType,
      averageScores: averageScores.map(avg => ({
        type: avg.type,
        averageScore: Math.round(avg._avg.score || 0)
      }))
    };
  }
}
