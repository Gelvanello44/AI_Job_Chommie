import { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { AIMatchingService } from '../services/ai-matching.service.js';
import { CareerDNAService } from '../services/career-dna.service.js';
import logger from '../config/logger.js';
import { prisma } from '../config/database.js';

// Initialize services
const aiMatchingService = new AIMatchingService();
const careerDnaService = new CareerDNAService();

/**
 * Match Explanation Controller
 * Handles all match explanation related operations
 */
export class MatchExplanationController {
  /**
   * Get comprehensive match explanation
   */
  async getMatchExplanation(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Generating match explanation', { userId, jobId });

      // Get match data
      const matchData = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchData.length === 0) {
        throw new AppError(404, 'No match data available for this job');
      }

      const match = matchData[0];

      // Get job and user details
      const [job, user] = await Promise.all([
        prisma.job.findUnique({
          where: { id: jobId },
          include: { 
            company: true,
            requirements: true,
            benefits: true
          }
        }),
        prisma.user.findUnique({
          where: { id: userId },
          include: { 
            userProfile: {
              include: {
                skills: true,
                experiences: true,
                education: true
              }
            }
          }
        })
      ]);

      // Generate comprehensive explanation
      const explanation = {
        overview: {
          matchScore: match.overallScore,
          matchLevel: this.getMatchLevel(match.overallScore),
          recommendation: this.getRecommendation(match.overallScore),
          confidence: this.calculateConfidence(match)
        },
        breakdown: {
          skills: {
            score: match.skillsScore,
            matching: match.matchDetails?.matchingSkills || [],
            missing: match.matchDetails?.missingSkills || [],
            analysis: this.analyzeSkillsMatch(match, job, user)
          },
          experience: {
            score: match.experienceScore,
            years: user?.userProfile?.yearsOfExperience || 0,
            required: job?.yearsExperienceMin || 0,
            analysis: this.analyzeExperienceMatch(match, job, user)
          },
          personality: {
            score: match.personalityScore,
            traits: match.personalityInsights || {},
            analysis: this.analyzePersonalityMatch(match)
          },
          culture: {
            score: match.culturalFitScore,
            values: match.culturalInsights || {},
            analysis: this.analyzeCultureMatch(match, job)
          }
        },
        strengths: this.identifyStrengths(match),
        improvements: this.identifyImprovements(match),
        actionPlan: this.generateActionPlan(match, job, user)
      };

      res.json({
        success: true,
        data: explanation
      });

    } catch (error) {
      logger.error('Error generating match explanation', { error });
      throw new AppError(500, 'Failed to generate match explanation');
    }
  }

  /**
   * Get match score comparison
   */
  async getMatchComparison(req: Request, res: Response): Promise<void> {
    try {
      const { jobIds } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        throw new AppError(400, 'Job IDs array is required');
      }

      if (jobIds.length > 10) {
        throw new AppError(400, 'Maximum 10 jobs can be compared at once');
      }

      logger.info(' Comparing matches', { userId, jobCount: jobIds.length });

      // Get match data for all jobs
      const matchData = await aiMatchingService.calculateJobMatches(userId, jobIds);

      // Get job details
      const jobs = await prisma.job.findMany({
        where: { id: { in: jobIds } },
        include: { company: true }
      });

      // Create comparison data
      const comparison = matchData.map(match => {
        const job = jobs.find(j => j.id === match.jobId);
        return {
          jobId: match.jobId,
          jobTitle: job?.title || 'Unknown',
          company: job?.company?.name || 'Unknown',
          overallScore: match.overallScore,
          scoreBreakdown: {
            skills: match.skillsScore,
            experience: match.experienceScore,
            personality: match.personalityScore,
            culture: match.culturalFitScore
          },
          strengths: match.strengths?.slice(0, 3) || [],
          gaps: match.gaps?.slice(0, 3) || [],
          recommendation: this.getRecommendation(match.overallScore)
        };
      });

      // Sort by overall score
      comparison.sort((a, b) => b.overallScore - a.overallScore);

      // Generate insights
      const insights = this.generateComparisonInsights(comparison);

      res.json({
        success: true,
        data: {
          comparisons: comparison,
          insights,
          bestMatch: comparison[0],
          summary: {
            averageScore: comparison.reduce((sum, c) => sum + c.overallScore, 0) / comparison.length,
            strongMatches: comparison.filter(c => c.overallScore > 0.7).length,
            totalCompared: comparison.length
          }
        }
      });

    } catch (error) {
      logger.error('Error comparing matches', { error });
      throw new AppError(500, 'Failed to compare matches');
    }
  }

  /**
   * Get match improvement suggestions
   */
  async getImprovementSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Generating improvement suggestions', { userId, jobId });

      // Get match data
      const matchData = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchData.length === 0) {
        throw new AppError(404, 'No match data available');
      }

      const match = matchData[0];

      // Get job details
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { 
          requirements: true,
          preferredSkills: true
        }
      });

      // Generate improvement suggestions
      const suggestions = {
        immediate: this.getImmediateImprovements(match, job),
        shortTerm: this.getShortTermImprovements(match, job),
        longTerm: this.getLongTermImprovements(match, job),
        resources: this.getImprovementResources(match, job),
        timeline: this.estimateImprovementTimeline(match),
        potentialScore: this.calculatePotentialScore(match)
      };

      res.json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      logger.error('Error generating improvement suggestions', { error });
      throw new AppError(500, 'Failed to generate improvement suggestions');
    }
  }

  /**
   * Get match insights
   */
  async getMatchInsights(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Generating match insights', { userId, jobId });

      // Get match data
      const matchData = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchData.length === 0) {
        throw new AppError(404, 'No match data available');
      }

      const match = matchData[0];

      // Get historical match data
      const historicalMatches = await this.getHistoricalMatches(userId, 10);

      // Generate insights
      const insights = {
        keyFindings: this.generateKeyFindings(match),
        competitivePosition: this.assessCompetitivePosition(match),
        marketAlignment: await this.analyzeMarketAlignment(match, jobId),
        careerImpact: this.assessCareerImpact(match),
        trends: this.analyzeMatchTrends(historicalMatches),
        recommendations: this.generateStrategicRecommendations(match)
      };

      res.json({
        success: true,
        data: insights
      });

    } catch (error) {
      logger.error('Error generating match insights', { error });
      throw new AppError(500, 'Failed to generate match insights');
    }
  }

  // Helper methods

  private getMatchLevel(score: number): string {
    if (score >= 0.85) return 'Excellent Match';
    if (score >= 0.70) return 'Strong Match';
    if (score >= 0.55) return 'Good Match';
    if (score >= 0.40) return 'Fair Match';
    return 'Developing Match';
  }

  private getRecommendation(score: number): string {
    if (score >= 0.85) return 'Highly recommended - Apply immediately with confidence';
    if (score >= 0.70) return 'Recommended - Tailor your application to highlight strengths';
    if (score >= 0.55) return 'Worth considering - Address key gaps in your application';
    if (score >= 0.40) return 'Stretch opportunity - Focus on transferable skills';
    return 'Consider gaining more experience before applying';
  }

  private calculateConfidence(match: any): number {
    const dataCompleteness = match.matchDetails ? 0.9 : 0.7;
    const scoreConsistency = this.calculateScoreConsistency(match);
    return (dataCompleteness + scoreConsistency) / 2;
  }

  private calculateScoreConsistency(match: any): number {
    const scores = [
      match.skillsScore || 0,
      match.experienceScore || 0,
      match.personalityScore || 0,
      match.culturalFitScore || 0
    ];
    
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
    return 1 - Math.min(variance, 1);
  }

  private analyzeSkillsMatch(match: any, job: any, user: any): string {
    const skillsPercentage = (match.skillsScore * 100).toFixed(0);
    const matchingCount = match.matchDetails?.matchingSkills?.length || 0;
    const totalRequired = job?.requirements?.length || 1;
    
    return `You match ${skillsPercentage}% of the required technical skills (${matchingCount}/${totalRequired}). ${
      match.skillsScore > 0.8 ? 'Your technical profile is highly aligned with this role.' :
      match.skillsScore > 0.6 ? 'You have most of the core technical skills needed.' :
      'Consider developing additional technical skills for this role.'
    }`;
  }

  private analyzeExperienceMatch(match: any, job: any, user: any): string {
    const userYears = user?.userProfile?.yearsOfExperience || 0;
    const requiredMin = job?.yearsExperienceMin || 0;
    const requiredMax = job?.yearsExperienceMax || requiredMin + 5;
    
    if (userYears >= requiredMin && userYears <= requiredMax) {
      return `Your ${userYears} years of experience falls within the ideal range (${requiredMin}-${requiredMax} years).`;
    } else if (userYears < requiredMin) {
      return `You have ${userYears} years of experience. The role typically requires ${requiredMin}+ years, but your skills may compensate.`;
    } else {
      return `With ${userYears} years of experience, you exceed the typical requirement (${requiredMin}-${requiredMax} years), positioning you as a senior candidate.`;
    }
  }

  private analyzePersonalityMatch(match: any): string {
    const score = (match.personalityScore * 100).toFixed(0);
    return `Your personality profile shows ${score}% alignment with the role requirements. ${
      match.personalityScore > 0.75 ? 'Your work style and communication preferences are well-suited for this position.' :
      'Consider how your unique personality traits can add value to the role.'
    }`;
  }

  private analyzeCultureMatch(match: any, job: any): string {
    const score = (match.culturalFitScore * 100).toFixed(0);
    return `Cultural alignment score is ${score}%. ${
      match.culturalFitScore > 0.7 ? 'Your values and work preferences align well with the company culture.' :
      'Research the company culture further to identify alignment opportunities.'
    }`;
  }

  private identifyStrengths(match: any): any[] {
    const strengths = [];
    
    if (match.skillsScore > 0.7) {
      strengths.push({
        area: 'Technical Skills',
        score: match.skillsScore,
        description: 'Strong technical competency alignment'
      });
    }
    
    if (match.experienceScore > 0.7) {
      strengths.push({
        area: 'Experience',
        score: match.experienceScore,
        description: 'Relevant professional background'
      });
    }
    
    if (match.personalityScore > 0.75) {
      strengths.push({
        area: 'Personality Fit',
        score: match.personalityScore,
        description: 'Compatible work style and traits'
      });
    }
    
    return strengths.sort((a, b) => b.score - a.score);
  }

  private identifyImprovements(match: any): any[] {
    const improvements = [];
    
    if (match.skillsScore < 0.6) {
      improvements.push({
        area: 'Technical Skills',
        currentScore: match.skillsScore,
        targetScore: 0.7,
        priority: 'High',
        suggestion: 'Focus on acquiring missing technical skills'
      });
    }
    
    if (match.experienceScore < 0.5) {
      improvements.push({
        area: 'Experience',
        currentScore: match.experienceScore,
        targetScore: 0.6,
        priority: 'Medium',
        suggestion: 'Highlight transferable experience and projects'
      });
    }
    
    return improvements;
  }

  private generateActionPlan(match: any, job: any, user: any): any {
    const plan = {
      immediate: [],
      shortTerm: [],
      longTerm: []
    };

    if (match.overallScore > 0.7) {
      plan.immediate.push('Customize your resume for this specific role');
      plan.immediate.push('Write a compelling cover letter highlighting your fit');
      plan.immediate.push('Research the company culture and values');
    }

    if (match.skillsScore < 0.7) {
      plan.shortTerm.push('Complete online courses for missing technical skills');
      plan.shortTerm.push('Work on projects demonstrating required competencies');
    }

    if (match.experienceScore < 0.6) {
      plan.longTerm.push('Gain more industry-specific experience');
      plan.longTerm.push('Seek mentorship in your target field');
    }

    return plan;
  }

  private generateComparisonInsights(comparisons: any[]): string[] {
    const insights = [];
    
    const avgScore = comparisons.reduce((sum, c) => sum + c.overallScore, 0) / comparisons.length;
    
    if (avgScore > 0.7) {
      insights.push('You have multiple strong matches - consider applying to all top matches');
    }
    
    const bestMatch = comparisons[0];
    insights.push(`Best match: ${bestMatch.jobTitle} at ${bestMatch.company} (${(bestMatch.overallScore * 100).toFixed(0)}%)`);
    
    // Identify common strengths
    const commonStrengths = this.findCommonElements(comparisons.map(c => c.strengths).flat());
    if (commonStrengths.length > 0) {
      insights.push(`Your consistent strengths: ${commonStrengths.join(', ')}`);
    }
    
    // Identify common gaps
    const commonGaps = this.findCommonElements(comparisons.map(c => c.gaps).flat());
    if (commonGaps.length > 0) {
      insights.push(`Common areas for improvement: ${commonGaps.join(', ')}`);
    }
    
    return insights;
  }

  private findCommonElements(arr: string[]): string[] {
    const frequency: { [key: string]: number } = {};
    arr.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });
    
    return Object.keys(frequency)
      .filter(key => frequency[key] > 1)
      .sort((a, b) => frequency[b] - frequency[a]);
  }

  private getImmediateImprovements(match: any, job: any): any[] {
    return [
      {
        action: 'Update resume with relevant keywords',
        impact: 'High',
        timeRequired: '1-2 hours'
      },
      {
        action: 'Tailor cover letter to match job requirements',
        impact: 'High',
        timeRequired: '1-2 hours'
      }
    ];
  }

  private getShortTermImprovements(match: any, job: any): any[] {
    const improvements = [];
    
    if (match.skillsScore < 0.7) {
      improvements.push({
        action: 'Complete online certification in missing skills',
        impact: 'High',
        timeRequired: '2-4 weeks'
      });
    }
    
    improvements.push({
      action: 'Build portfolio project demonstrating job-relevant skills',
      impact: 'Medium',
      timeRequired: '1-2 months'
    });
    
    return improvements;
  }

  private getLongTermImprovements(match: any, job: any): any[] {
    return [
      {
        action: 'Gain industry-specific experience through internships or projects',
        impact: 'High',
        timeRequired: '3-6 months'
      },
      {
        action: 'Develop leadership and soft skills through courses',
        impact: 'Medium',
        timeRequired: '3-6 months'
      }
    ];
  }

  private getImprovementResources(match: any, job: any): any[] {
    return [
      {
        type: 'Online Courses',
        platforms: ['Coursera', 'Udemy', 'LinkedIn Learning'],
        relevance: 'High'
      },
      {
        type: 'Certifications',
        suggestions: ['Industry-specific certifications', 'Technical certifications'],
        relevance: 'High'
      },
      {
        type: 'Projects',
        suggestions: ['Open source contributions', 'Personal projects', 'Freelance work'],
        relevance: 'Medium'
      }
    ];
  }

  private estimateImprovementTimeline(match: any): string {
    if (match.overallScore > 0.8) return 'Ready to apply now';
    if (match.overallScore > 0.65) return '1-4 weeks of preparation';
    if (match.overallScore > 0.5) return '1-3 months of skill development';
    return '3-6 months of experience building';
  }

  private calculatePotentialScore(match: any): number {
    // Estimate potential score after improvements
    let potential = match.overallScore;
    
    if (match.skillsScore < 0.7) {
      potential += 0.15; // Potential improvement from skills development
    }
    
    if (match.experienceScore < 0.6) {
      potential += 0.1; // Potential improvement from experience
    }
    
    return Math.min(potential, 0.95);
  }

  private async getHistoricalMatches(userId: string, limit: number): Promise<any[]> {
    // This would typically fetch from database
    // For now, returning mock data
    return [];
  }

  private generateKeyFindings(match: any): string[] {
    const findings = [];
    
    if (match.overallScore > 0.8) {
      findings.push('You are an exceptional candidate for this role');
    }
    
    if (match.skillsScore > match.experienceScore) {
      findings.push('Your technical skills are your strongest asset');
    }
    
    if (match.personalityScore > 0.8) {
      findings.push('Your personality profile is highly compatible with this role');
    }
    
    return findings;
  }

  private assessCompetitivePosition(match: any): any {
    return {
      position: match.overallScore > 0.75 ? 'Strong' : match.overallScore > 0.6 ? 'Competitive' : 'Developing',
      percentile: match.overallScore > 0.75 ? '80th' : match.overallScore > 0.6 ? '60th' : '40th',
      recommendation: match.overallScore > 0.7 ? 'Apply with confidence' : 'Consider skill development first'
    };
  }

  private async analyzeMarketAlignment(match: any, jobId: string): Promise<any> {
    // This would typically analyze market data
    return {
      demandLevel: 'High',
      supplyLevel: 'Moderate',
      competitionLevel: 'Medium',
      salaryRange: 'Competitive',
      growthPotential: 'Strong'
    };
  }

  private assessCareerImpact(match: any): any {
    return {
      alignment: match.overallScore > 0.7 ? 'Strong career progression' : 'Moderate career fit',
      growth: 'Significant skill development opportunity',
      trajectory: 'Positive long-term impact'
    };
  }

  private analyzeMatchTrends(historicalMatches: any[]): any {
    // Analyze trends from historical data
    return {
      trend: 'Improving',
      averageScore: 0.65,
      improvementRate: '+5%',
      consistencyScore: 0.8
    };
  }

  private generateStrategicRecommendations(match: any): string[] {
    const recommendations = [];
    
    if (match.overallScore > 0.7) {
      recommendations.push('Apply within the next week while the position is fresh');
      recommendations.push('Network with current employees for insights');
    }
    
    recommendations.push('Focus on demonstrating measurable achievements');
    recommendations.push('Prepare specific examples that showcase your fit');
    
    return recommendations;
  }
}

export const matchExplanationController = new MatchExplanationController();
