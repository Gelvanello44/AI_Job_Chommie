import { prisma } from '../config/database.js';
import { cache } from '../config/redis.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { expandSkills, normalizeSkill } from '../data/skills_taxonomy.js';
// AiMatchingService imported dynamically to avoid circular dependency
import type { AIMatchingService as AiMatchingService } from './ai-matching.service.js';
import CvAnalysisService from './cv-analysis.service.js';
import CareerDnaService from './career-dna.service.js';

// Core interfaces
interface SkillGapAnalysis {
  userId: string;
  analysisId: string;
  targetRole?: string;
  targetIndustry?: string;
  
  currentSkills: AnalyzedSkill[];
  requiredSkills: RequiredSkill[];
  skillGaps: SkillGap[];
  recommendations: SkillRecommendation[];
  learningPaths: LearningPath[];
  
  readinessScore: number; // 0-100
  timeToReady: string;
  costEstimate: string;
  priorityMatrix: PriorityMatrix;
  
  analysisDate: Date;
  confidenceScore: number;
}

interface AnalyzedSkill {
  name: string;
  category: string;
  proficiency: number; // 0-100
  yearsExperience?: number;
  verified: boolean;
  marketDemand: number; // 0-100
  growthTrend: 'rising' | 'stable' | 'declining';
  transferability: number; // 0-100
}

interface RequiredSkill {
  name: string;
  importance: 'critical' | 'important' | 'preferred';
  demandLevel: number; // 0-100
  avgSalaryImpact: number; // percentage
  learningDifficulty: 'easy' | 'moderate' | 'challenging';
  timeToLearn: string;
}

interface SkillGap {
  skill: string;
  gapSize: number; // 0-100
  priority: number; // 1-10
  impact: 'career_blocking' | 'growth_limiting' | 'nice_to_have';
  urgency: 'immediate' | 'short_term' | 'long_term';
  mitigationStrategies: string[];
}

interface SkillRecommendation {
  skill: string;
  action: 'learn' | 'improve' | 'certify' | 'practice';
  reasoning: string;
  expectedBenefit: string;
  effortRequired: string;
  roi: number; // 0-100
}

interface LearningPath {
  skill: string;
  pathway: 'formal_education' | 'online_course' | 'certification' | 'self_study' | 'mentorship' | 'project_based';
  steps: LearningStep[];
  totalDuration: string;
  totalCost: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
}

interface LearningStep {
  step: number;
  title: string;
  description: string;
  duration: string;
  cost: string;
  resources: LearningResource[];
  milestones: string[];
  assessment: string;
}

interface LearningResource {
  type: 'course' | 'book' | 'tutorial' | 'workshop' | 'certification' | 'project';
  name: string;
  provider: string;
  url?: string;
  cost: string;
  duration: string;
  rating: number;
  relevanceScore: number;
}

interface PriorityMatrix {
  immediate: SkillGap[]; // Next 30 days
  shortTerm: SkillGap[]; // 1-6 months
  longTerm: SkillGap[]; // 6+ months
  optional: SkillGap[]; // Nice to have
}

interface MarketAnalysis {
  skill: string;
  demandTrend: 'high_growth' | 'moderate_growth' | 'stable' | 'declining';
  avgSalaryRange: { min: number; max: number };
  jobPostingsCount: number;
  competitionLevel: 'low' | 'moderate' | 'high';
  emergingStatus: boolean;
  industryAdoption: Record<string, number>; // industry -> adoption percentage
  futureDemand: 'will_grow' | 'will_stabilize' | 'will_decline';
}

interface PersonalizedLearning {
  userId: string;
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  preferredPace: 'intensive' | 'moderate' | 'gradual';
  availableTime: number; // hours per week
  budget: 'free' | 'low' | 'moderate' | 'high';
  currentLevel: 'beginner' | 'intermediate' | 'advanced';
  motivationFactors: string[];
}

interface SkillProgress {
  skill: string;
  currentProficiency: number;
  targetProficiency: number;
  progressRate: number; // points per week
  plateauRisk: number; // 0-100
  recommendedActions: string[];
  nextMilestone: string;
  estimatedCompletion: Date;
}

interface CompetitiveAnalysis {
  skill: string;
  yourLevel: number;
  marketAverage: number;
  topPercentile: number;
  competitiveAdvantage: boolean;
  catchUpTime: string;
  differentiation: string[];
}

export class SkillsGapAnalysisService {
  private analysisCache: Map<string, SkillGapAnalysis> = new Map();
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private _aiMatchingService?: AiMatchingService;
  private cvAnalysisService: CvAnalysisService;
  private careerDnaService: CareerDnaService;

  constructor() {
    // Note: aiMatchingService is initialized lazily to avoid circular dependency
    this.cvAnalysisService = new CvAnalysisService();
    this.careerDnaService = new CareerDnaService();
  }

  private get aiMatchingService(): AiMatchingService {
    if (!this._aiMatchingService) {
      // Lazy initialization to break circular dependency
      const { AIMatchingService } = require('./ai-matching.service.js');
      this._aiMatchingService = new AIMatchingService();
    }
    return this._aiMatchingService;
  }

  /**
   *  MAGIC: Comprehensive skills gap analysis
   */
  async analyzeSkillsGap(
    userId: string,
    options: {
      targetRole?: string;
      targetIndustry?: string;
      careerGoals?: string[];
      timeframe?: '6m' | '1y' | '3y' | '5y';
      includeEmergingSkills?: boolean;
    } = {}
  ): Promise<SkillGapAnalysis> {
    try {
      logger.info(' Analyzing skills gap', { userId, options });

      const {
        targetRole,
        targetIndustry,
        careerGoals = [],
        timeframe = '1y',
        includeEmergingSkills = true
      } = options;

      // Get user's current skills
      const currentSkills = await this.getCurrentUserSkills(userId);
      
      // Get required skills for target
      const requiredSkills = await this.getRequiredSkills(targetRole, targetIndustry, careerGoals);
      
      // Identify gaps
      const skillGaps = this.identifySkillGaps(currentSkills, requiredSkills);
      
      // Generate recommendations
      const recommendations = await this.generateSkillRecommendations(skillGaps, timeframe);
      
      // Create learning paths
      const learningPaths = await this.createLearningPaths(skillGaps, includeEmergingSkills);
      
      // Calculate readiness and estimates
      const readinessScore = this.calculateReadinessScore(currentSkills, requiredSkills);
      const timeToReady = this.estimateTimeToReady(skillGaps);
      const costEstimate = this.estimateLearningCost(learningPaths);
      
      // Create priority matrix
      const priorityMatrix = this.createPriorityMatrix(skillGaps);

      const analysis: SkillGapAnalysis = {
        userId,
        analysisId: `gap_${Date.now()}`,
        targetRole,
        targetIndustry,
        currentSkills,
        requiredSkills,
        skillGaps,
        recommendations,
        learningPaths,
        readinessScore,
        timeToReady,
        costEstimate,
        priorityMatrix,
        analysisDate: new Date(),
        confidenceScore: this.calculateConfidenceScore(currentSkills, requiredSkills)
      };

      // Cache and save
      this.analysisCache.set(`${userId}:${targetRole || 'general'}`, analysis);
      await this.saveAnalysisToDatabase(analysis);

      return analysis;

    } catch (error) {
      logger.error('Failed to analyze skills gap', { error, userId });
      throw new AppError(500, 'Failed to analyze skills gap', 'SKILLS_GAP_ERROR');
    }
  }

  private async getCurrentUserSkills(userId: string): Promise<AnalyzedSkill[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: { include: { skill: true } },
        experiences: true,
        skillsAssessments: true
      }
    });

    if (!user) throw new AppError(404, 'User not found');

    return user.skills.map(us => ({
      name: us.skill.name,
      category: us.skill.category || 'General',
      proficiency: (us.proficiencyLevel || 3) * 20, // Convert 1-5 to 0-100
      yearsExperience: us.yearsOfExperience || undefined,
      verified: us.verified,
      marketDemand: Math.random() * 30 + 70, // Mock data
      growthTrend: Math.random() > 0.7 ? 'rising' : Math.random() > 0.3 ? 'stable' : 'declining',
      transferability: Math.random() * 40 + 60
    }));
  }

  private async getRequiredSkills(targetRole?: string, targetIndustry?: string, careerGoals?: string[]): Promise<RequiredSkill[]> {
    // Mock implementation - in production, use job market data
    return [
      {
        name: 'JavaScript',
        importance: 'critical',
        demandLevel: 95,
        avgSalaryImpact: 15,
        learningDifficulty: 'moderate',
        timeToLearn: '3-6 months'
      },
      {
        name: 'React',
        importance: 'important',
        demandLevel: 85,
        avgSalaryImpact: 12,
        learningDifficulty: 'moderate',
        timeToLearn: '2-4 months'
      }
    ];
  }

  private identifySkillGaps(current: AnalyzedSkill[], required: RequiredSkill[]): SkillGap[] {
    const gaps: SkillGap[] = [];
    const currentSkillNames = new Set(current.map(s => s.name.toLowerCase()));

    for (const req of required) {
      if (!currentSkillNames.has(req.name.toLowerCase())) {
        gaps.push({
          skill: req.name,
          gapSize: 100, // Complete gap
          priority: req.importance === 'critical' ? 10 : req.importance === 'important' ? 7 : 4,
          impact: req.importance === 'critical' ? 'career_blocking' : 'growth_limiting',
          urgency: req.importance === 'critical' ? 'immediate' : 'short_term',
          mitigationStrategies: [`Learn ${req.name}`, `Get certified in ${req.name}`]
        });
      }
    }

    return gaps.sort((a, b) => b.priority - a.priority);
  }

  private async generateSkillRecommendations(gaps: SkillGap[], timeframe: string): Promise<SkillRecommendation[]> {
    return gaps.slice(0, 10).map(gap => ({
      skill: gap.skill,
      action: 'learn',
      reasoning: `${gap.skill} is ${gap.impact} for your career goals`,
      expectedBenefit: `Improved job opportunities and salary potential`,
      effortRequired: gap.urgency === 'immediate' ? 'High' : 'Moderate',
      roi: gap.priority * 10
    }));
  }

  private async createLearningPaths(gaps: SkillGap[], includeEmerging: boolean): Promise<LearningPath[]> {
    return gaps.slice(0, 5).map(gap => ({
      skill: gap.skill,
      pathway: 'online_course',
      steps: [
        {
          step: 1,
          title: `Introduction to ${gap.skill}`,
          description: `Learn the basics of ${gap.skill}`,
          duration: '2-4 weeks',
          cost: '$50-200',
          resources: [],
          milestones: [`Complete basic ${gap.skill} course`],
          assessment: 'Online quiz and practical project'
        }
      ],
      totalDuration: '3-6 months',
      totalCost: '$100-500',
      difficulty: 'intermediate',
      prerequisites: []
    }));
  }

  private calculateReadinessScore(current: AnalyzedSkill[], required: RequiredSkill[]): number {
    if (required.length === 0) return 100;
    
    const criticalSkills = required.filter(r => r.importance === 'critical');
    const coveredCritical = criticalSkills.filter(req => 
      current.some(curr => curr.name.toLowerCase() === req.name.toLowerCase())
    ).length;
    
    return criticalSkills.length > 0 ? (coveredCritical / criticalSkills.length) * 100 : 80;
  }

  private estimateTimeToReady(gaps: SkillGap[]): string {
    const immediateGaps = gaps.filter(g => g.urgency === 'immediate').length;
    const shortTermGaps = gaps.filter(g => g.urgency === 'short_term').length;
    
    if (immediateGaps > 3) return '12-18 months';
    if (immediateGaps > 0) return '6-12 months';
    if (shortTermGaps > 5) return '9-15 months';
    return '3-6 months';
  }

  private estimateLearningCost(paths: LearningPath[]): string {
    const totalPaths = paths.length;
    if (totalPaths === 0) return '$0';
    if (totalPaths <= 2) return '$200-800';
    if (totalPaths <= 5) return '$500-2000';
    return '$1000-5000';
  }

  private createPriorityMatrix(gaps: SkillGap[]): PriorityMatrix {
    return {
      immediate: gaps.filter(g => g.urgency === 'immediate'),
      shortTerm: gaps.filter(g => g.urgency === 'short_term'),
      longTerm: gaps.filter(g => g.urgency === 'long_term'),
      optional: gaps.filter(g => g.impact === 'nice_to_have')
    };
  }

  private calculateConfidenceScore(current: AnalyzedSkill[], required: RequiredSkill[]): number {
    return Math.min(85, current.length * 5 + required.length * 2);
  }

  private async saveAnalysisToDatabase(analysis: SkillGapAnalysis): Promise<void> {
    logger.info('Saving skills gap analysis', { analysisId: analysis.analysisId });
  }

  /**
   *  MAGIC: Market analysis for skills
   */
  async analyzeSkillMarket(skills: string[]): Promise<Record<string, MarketAnalysis>> {
    try {
      logger.info(' Analyzing skill market', { skills });
      
      const cacheKey = `market_analysis:${skills.sort().join(',')}`;
      const cached = await cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const analyses: Record<string, MarketAnalysis> = {};
      
      for (const skill of skills) {
        // Mock market data - in production, integrate with job market APIs
        analyses[skill] = {
          skill,
          demandTrend: Math.random() > 0.6 ? 'high_growth' : 'stable',
          avgSalaryRange: {
            min: Math.floor(Math.random() * 50000) + 50000,
            max: Math.floor(Math.random() * 80000) + 100000
          },
          jobPostingsCount: Math.floor(Math.random() * 10000) + 1000,
          competitionLevel: Math.random() > 0.5 ? 'moderate' : 'high',
          emergingStatus: Math.random() > 0.8,
          industryAdoption: {
            'Technology': Math.random() * 100,
            'Finance': Math.random() * 100,
            'Healthcare': Math.random() * 100
          },
          futureDemand: Math.random() > 0.7 ? 'will_grow' : 'will_stabilize'
        };
      }

      await cache.setex(cacheKey, 3600, JSON.stringify(analyses));
      return analyses;
      
    } catch (error) {
      logger.error('Failed to analyze skill market', { error, skills });
      throw new AppError(500, 'Failed to analyze skill market', 'MARKET_ANALYSIS_ERROR');
    }
  }

  /**
   *  MAGIC: Personalized learning path creation
   */
  async createPersonalizedLearningPath(
    userId: string,
    skillGaps: SkillGap[],
    preferences: PersonalizedLearning
  ): Promise<LearningPath[]> {
    try {
      logger.info(' Creating personalized learning paths', { userId, skillCount: skillGaps.length });

      const paths: LearningPath[] = [];
      
      for (const gap of skillGaps.slice(0, 8)) {
        const resources = await this.findOptimalResources(gap.skill, preferences);
        const steps = this.createAdaptiveSteps(gap, preferences, resources);
        
        paths.push({
          skill: gap.skill,
          pathway: this.selectOptimalPathway(preferences, gap),
          steps,
          totalDuration: this.calculatePathDuration(steps, preferences.availableTime),
          totalCost: this.calculatePathCost(steps, preferences.budget),
          difficulty: this.assessDifficulty(gap, preferences.currentLevel),
          prerequisites: await this.identifyPrerequisites(gap.skill)
        });
      }

      return paths.sort((a, b) => this.calculatePathPriority(b) - this.calculatePathPriority(a));
      
    } catch (error) {
      logger.error('Failed to create personalized learning paths', { error, userId });
      throw new AppError(500, 'Failed to create learning paths', 'LEARNING_PATH_ERROR');
    }
  }

  /**
   *  MAGIC: Track skill progress over time
   */
  async trackSkillProgress(userId: string, skill: string): Promise<SkillProgress> {
    try {
      logger.info(' Tracking skill progress', { userId, skill });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          skills: { 
            where: { skill: { name: { contains: skill, mode: 'insensitive' } } },
            include: { skill: true }
          },
          skillsAssessments: {
            where: { skillName: { contains: skill, mode: 'insensitive' } },
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });

      if (!user) throw new AppError(404, 'User not found');
      
      const currentSkill = user.skills[0];
      const assessments = user.skillsAssessments;
      
      const currentProficiency = currentSkill?.proficiencyLevel ? currentSkill.proficiencyLevel * 20 : 0;
      const targetProficiency = 80; // Default target
      
      // Calculate progress rate from assessments
      const progressRate = assessments.length >= 2 
        ? this.calculateProgressRate(assessments)
        : 5; // Default weekly progress

      const progress: SkillProgress = {
        skill,
        currentProficiency,
        targetProficiency,
        progressRate,
        plateauRisk: this.assessPlateauRisk(assessments),
        recommendedActions: this.generateProgressActions(currentProficiency, progressRate),
        nextMilestone: this.getNextMilestone(currentProficiency),
        estimatedCompletion: this.estimateCompletion(currentProficiency, targetProficiency, progressRate)
      };

      await this.saveProgressTracking(userId, progress);
      return progress;
      
    } catch (error) {
      logger.error('Failed to track skill progress', { error, userId, skill });
      throw new AppError(500, 'Failed to track progress', 'PROGRESS_TRACKING_ERROR');
    }
  }

  /**
   *  MAGIC: Competitive analysis against market
   */
  async performCompetitiveAnalysis(userId: string, targetRole?: string): Promise<CompetitiveAnalysis[]> {
    try {
      logger.info(' Performing competitive analysis', { userId, targetRole });

      const currentSkills = await this.getCurrentUserSkills(userId);
      const marketData = await this.getMarketBenchmarks(targetRole);
      
      const analyses: CompetitiveAnalysis[] = [];
      
      for (const skill of currentSkills) {
        const marketBenchmark = marketData[skill.name] || { average: 60, topPercentile: 90 };
        
        analyses.push({
          skill: skill.name,
          yourLevel: skill.proficiency,
          marketAverage: marketBenchmark.average,
          topPercentile: marketBenchmark.topPercentile,
          competitiveAdvantage: skill.proficiency > marketBenchmark.average,
          catchUpTime: this.calculateCatchUpTime(skill.proficiency, marketBenchmark.average),
          differentiation: this.identifyDifferentiation(skill, marketBenchmark)
        });
      }

      return analyses.sort((a, b) => {
        // Prioritize skills with competitive advantage
        if (a.competitiveAdvantage && !b.competitiveAdvantage) return -1;
        if (!a.competitiveAdvantage && b.competitiveAdvantage) return 1;
        return b.yourLevel - a.yourLevel;
      });
      
    } catch (error) {
      logger.error('Failed to perform competitive analysis', { error, userId });
      throw new AppError(500, 'Failed to perform competitive analysis', 'COMPETITIVE_ANALYSIS_ERROR');
    }
  }

  /**
   *  MAGIC: Smart skill prioritization based on career impact
   */
  async prioritizeSkillsByImpact(
    userId: string,
    skillGaps: SkillGap[],
    careerGoals: string[] = []
  ): Promise<SkillGap[]> {
    try {
      logger.info(' Prioritizing skills by impact', { userId, gapCount: skillGaps.length });

      const userProfile = await this.careerDnaService.analyzeCareerDNA(userId);
      const marketAnalysis = await this.analyzeSkillMarket(skillGaps.map(g => g.skill));
      
      const prioritizedGaps = skillGaps.map(gap => {
        const market = marketAnalysis[gap.skill];
        const careerAlignment = this.calculateCareerAlignment(gap.skill, userProfile, careerGoals);
        const learningEfficiency = this.calculateLearningEfficiency(gap, userProfile);
        
        // Calculate comprehensive priority score
        const impactScore = (
          gap.priority * 0.3 +
          (market?.demandTrend === 'high_growth' ? 10 : 5) * 0.2 +
          careerAlignment * 0.25 +
          learningEfficiency * 0.15 +
          (market?.emergingStatus ? 8 : 5) * 0.1
        );
        
        return {
          ...gap,
          priority: Math.round(impactScore),
          metadata: {
            marketDemand: market?.demandTrend,
            careerAlignment,
            learningEfficiency,
            emergingTech: market?.emergingStatus
          }
        };
      });

      return prioritizedGaps.sort((a, b) => b.priority - a.priority);
      
    } catch (error) {
      logger.error('Failed to prioritize skills', { error, userId });
      throw new AppError(500, 'Failed to prioritize skills', 'PRIORITIZATION_ERROR');
    }
  }

  /**
   *  MAGIC: Update skills based on learning progress
   */
  async updateSkillProgress(
    userId: string,
    skill: string,
    newProficiency: number,
    evidence?: {
      certificateUrl?: string;
      projectUrl?: string;
      assessmentScore?: number;
      endorsements?: string[];
    }
  ): Promise<SkillProgress> {
    try {
      logger.info(' Updating skill progress', { userId, skill, newProficiency });

      await prisma.userSkill.upsert({
        where: {
          userId_skillId: {
            userId,
            skillId: skill // This should be skill ID, but simplified for example
          }
        },
        update: {
          proficiencyLevel: Math.round(newProficiency / 20), // Convert 0-100 to 1-5
          verified: evidence?.certificateUrl || evidence?.assessmentScore ? true : false,
          lastUpdated: new Date()
        },
        create: {
          userId,
          skillId: skill,
          proficiencyLevel: Math.round(newProficiency / 20),
          verified: false
        }
      });

      // Track progress in assessment history
      await prisma.skillsAssessment.create({
        data: {
          userId,
          skillName: skill,
          score: newProficiency,
          assessmentType: evidence?.assessmentScore ? 'formal' : 'self_reported',
          metadata: evidence
        }
      });

      return await this.trackSkillProgress(userId, skill);
      
    } catch (error) {
      logger.error('Failed to update skill progress', { error, userId, skill });
      throw new AppError(500, 'Failed to update progress', 'PROGRESS_UPDATE_ERROR');
    }
  }

  /**
   *  MAGIC: Generate smart learning recommendations
   */
  async generateSmartRecommendations(
    userId: string,
    analysis: SkillGapAnalysis
  ): Promise<{
    quickWins: SkillRecommendation[];
    strategicInvestments: SkillRecommendation[];
    emergingOpportunities: SkillRecommendation[];
    personalizedTips: string[];
  }> {
    try {
      logger.info(' Generating smart recommendations', { userId });

      const userProfile = await this.careerDnaService.analyzeCareerDNA(userId);
      const marketAnalysis = await this.analyzeSkillMarket(analysis.skillGaps.map(g => g.skill));
      
      const quickWins = analysis.recommendations.filter(r => 
        r.effortRequired === 'Low' || r.roi > 80
      ).slice(0, 3);
      
      const strategicInvestments = analysis.recommendations.filter(r => 
        r.roi > 60 && r.effortRequired !== 'Low'
      ).slice(0, 4);
      
      const emergingOpportunities = analysis.recommendations.filter(r => {
        const market = marketAnalysis[r.skill];
        return market?.emergingStatus || market?.demandTrend === 'high_growth';
      }).slice(0, 3);

      const personalizedTips = this.generatePersonalizedTips(userProfile, analysis);

      return {
        quickWins,
        strategicInvestments,
        emergingOpportunities,
        personalizedTips
      };
      
    } catch (error) {
      logger.error('Failed to generate smart recommendations', { error, userId });
      throw new AppError(500, 'Failed to generate recommendations', 'SMART_RECOMMENDATIONS_ERROR');
    }
  }

  /**
   *  MAGIC: Create adaptive learning schedule
   */
  async createAdaptiveLearningSchedule(
    userId: string,
    learningPaths: LearningPath[],
    preferences: PersonalizedLearning
  ): Promise<{
    weeklySchedule: Record<string, any>;
    milestones: Record<string, Date>;
    adaptations: string[];
  }> {
    try {
      logger.info(' Creating adaptive learning schedule', { userId, pathCount: learningPaths.length });

      const schedule: Record<string, any> = {};
      const milestones: Record<string, Date> = {};
      const adaptations: string[] = [];
      
      // Distribute learning across available time
      const weeklyHours = preferences.availableTime;
      let currentWeek = 1;
      
      for (const path of learningPaths.slice(0, 3)) { // Focus on top 3 skills
        const hoursPerSkill = weeklyHours / Math.min(3, learningPaths.length);
        
        for (const step of path.steps) {
          const stepWeeks = Math.ceil(parseInt(step.duration.split('-')[0]) || 2);
          
          for (let week = 0; week < stepWeeks; week++) {
            const weekKey = `week_${currentWeek + week}`;
            if (!schedule[weekKey]) schedule[weekKey] = [];
            
            schedule[weekKey].push({
              skill: path.skill,
              task: step.title,
              hoursAllocated: hoursPerSkill,
              priority: path.difficulty === 'beginner' ? 'high' : 'medium'
            });
          }
          
          milestones[`${path.skill}_${step.step}`] = new Date(Date.now() + stepWeeks * 7 * 24 * 60 * 60 * 1000);
        }
        
        currentWeek += path.steps.length * 2;
      }

      // Add adaptive features
      if (preferences.learningStyle === 'visual') {
        adaptations.push('Prioritized video-based learning resources');
      }
      if (preferences.preferredPace === 'intensive') {
        adaptations.push('Condensed timeline with daily practice');
      }
      if (preferences.budget === 'free') {
        adaptations.push('Focus on free and open-source resources');
      }

      return { weeklySchedule: schedule, milestones, adaptations };
      
    } catch (error) {
      logger.error('Failed to create adaptive schedule', { error, userId });
      throw new AppError(500, 'Failed to create schedule', 'SCHEDULE_ERROR');
    }
  }

  // Helper methods for new functionality
  private selectOptimalPathway(preferences: PersonalizedLearning, gap: SkillGap): LearningPath['pathway'] {
    if (preferences.budget === 'free') return 'self_study';
    if (gap.urgency === 'immediate') return 'online_course';
    if (preferences.learningStyle === 'kinesthetic') return 'project_based';
    return 'online_course';
  }

  private async findOptimalResources(skill: string, preferences: PersonalizedLearning): Promise<LearningResource[]> {
    // Mock implementation - in production, integrate with learning platforms
    return [
      {
        type: 'course',
        name: `Master ${skill}`,
        provider: 'Coursera',
        cost: preferences.budget === 'free' ? 'Free' : '$49',
        duration: '6 weeks',
        rating: 4.7,
        relevanceScore: 95
      }
    ];
  }

  private createAdaptiveSteps(gap: SkillGap, preferences: PersonalizedLearning, resources: LearningResource[]): LearningStep[] {
    const baseSteps = [
      {
        step: 1,
        title: `Foundation in ${gap.skill}`,
        description: `Build core understanding of ${gap.skill} fundamentals`,
        duration: preferences.preferredPace === 'intensive' ? '1-2 weeks' : '2-4 weeks',
        cost: '$0-100',
        resources: resources.filter(r => r.type === 'tutorial'),
        milestones: [`Understand ${gap.skill} basics`, 'Complete first project'],
        assessment: 'Practical project evaluation'
      },
      {
        step: 2,
        title: `Intermediate ${gap.skill}`,
        description: `Develop practical skills and build projects`,
        duration: preferences.preferredPace === 'intensive' ? '2-4 weeks' : '4-8 weeks',
        cost: '$50-300',
        resources: resources.filter(r => r.type === 'course'),
        milestones: [`Build intermediate project`, 'Get peer feedback'],
        assessment: 'Portfolio review'
      }
    ];

    if (gap.impact === 'career_blocking') {
      baseSteps.push({
        step: 3,
        title: `${gap.skill} Certification`,
        description: `Obtain industry-recognized certification`,
        duration: '1-2 weeks',
        cost: '$100-500',
        resources: resources.filter(r => r.type === 'certification'),
        milestones: ['Pass certification exam'],
        assessment: 'Certification exam'
      });
    }

    return baseSteps;
  }

  private calculatePathDuration(steps: LearningStep[], availableHours: number): string {
    const totalWeeks = steps.reduce((sum, step) => {
      const weeks = parseInt(step.duration.split('-')[1] || step.duration.split('-')[0]) || 2;
      return sum + weeks;
    }, 0);
    
    // Adjust for available time
    const adjustedWeeks = availableHours < 5 ? totalWeeks * 1.5 : totalWeeks;
    return `${Math.round(adjustedWeeks)} weeks`;
  }

  private calculatePathCost(steps: LearningStep[], budget: PersonalizedLearning['budget']): string {
    if (budget === 'free') return '$0';
    
    const totalSteps = steps.length;
    const baseCost = totalSteps * 100;
    
    switch (budget) {
      case 'low': return `$${Math.min(baseCost, 200)}`;
      case 'moderate': return `$${Math.min(baseCost, 800)}`;
      case 'high': return `$${baseCost}-${baseCost * 2}`;
      default: return '$100-500';
    }
  }

  private assessDifficulty(gap: SkillGap, currentLevel: PersonalizedLearning['currentLevel']): LearningPath['difficulty'] {
    if (currentLevel === 'beginner' && gap.gapSize > 80) return 'advanced';
    if (currentLevel === 'advanced' || gap.gapSize < 40) return 'beginner';
    return 'intermediate';
  }

  private async identifyPrerequisites(skill: string): Promise<string[]> {
    // Mock implementation - in production, use skill dependency graph
    const prerequisites: Record<string, string[]> = {
      'React': ['JavaScript', 'HTML', 'CSS'],
      'Node.js': ['JavaScript'],
      'Python': [],
      'Machine Learning': ['Python', 'Statistics']
    };
    
    return prerequisites[skill] || [];
  }

  private calculatePathPriority(path: LearningPath): number {
    const difficultyWeight = path.difficulty === 'beginner' ? 10 : path.difficulty === 'intermediate' ? 7 : 4;
    const prereqWeight = path.prerequisites.length === 0 ? 10 : Math.max(2, 10 - path.prerequisites.length * 2);
    return difficultyWeight + prereqWeight;
  }

  private calculateProgressRate(assessments: any[]): number {
    if (assessments.length < 2) return 5;
    
    const latest = assessments[0].score;
    const previous = assessments[1].score;
    const timeDiff = new Date(assessments[0].createdAt).getTime() - new Date(assessments[1].createdAt).getTime();
    const weeksDiff = timeDiff / (7 * 24 * 60 * 60 * 1000);
    
    return Math.max(1, (latest - previous) / weeksDiff);
  }

  private assessPlateauRisk(assessments: any[]): number {
    if (assessments.length < 3) return 30; // Low data confidence
    
    const recentProgress = assessments.slice(0, 3).map(a => a.score);
    const variance = this.calculateVariance(recentProgress);
    
    return variance < 5 ? 80 : variance < 15 ? 50 : 20;
  }

  private calculateVariance(scores: number[]): number {
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
  }

  private generateProgressActions(proficiency: number, progressRate: number): string[] {
    const actions = [];
    
    if (progressRate < 3) {
      actions.push('Consider changing learning approach');
      actions.push('Find a mentor or study group');
    }
    
    if (proficiency < 40) {
      actions.push('Focus on fundamentals');
      actions.push('Practice daily for 30 minutes');
    } else if (proficiency < 70) {
      actions.push('Work on practical projects');
      actions.push('Seek feedback from experts');
    } else {
      actions.push('Teach others to reinforce knowledge');
      actions.push('Explore advanced topics');
    }
    
    return actions;
  }

  private getNextMilestone(proficiency: number): string {
    if (proficiency < 25) return 'Complete basic understanding';
    if (proficiency < 50) return 'Build first practical project';
    if (proficiency < 75) return 'Demonstrate intermediate competency';
    return 'Achieve expert-level mastery';
  }

  private estimateCompletion(current: number, target: number, rate: number): Date {
    const pointsNeeded = target - current;
    const weeksNeeded = Math.max(1, pointsNeeded / rate);
    return new Date(Date.now() + weeksNeeded * 7 * 24 * 60 * 60 * 1000);
  }

  private async saveProgressTracking(userId: string, progress: SkillProgress): Promise<void> {
    const cacheKey = `progress:${userId}:${progress.skill}`;
    await cache.setex(cacheKey, 3600, JSON.stringify(progress));
  }

  private async getMarketBenchmarks(targetRole?: string): Promise<Record<string, { average: number; topPercentile: number }>> {
    // Mock implementation - in production, use real market data
    return {
      'JavaScript': { average: 65, topPercentile: 90 },
      'React': { average: 60, topPercentile: 85 },
      'Python': { average: 70, topPercentile: 92 },
      'Node.js': { average: 62, topPercentile: 88 }
    };
  }

  private calculateCatchUpTime(yourLevel: number, marketAverage: number): string {
    const gap = Math.max(0, marketAverage - yourLevel);
    if (gap === 0) return 'Already competitive';
    if (gap < 10) return '2-4 weeks';
    if (gap < 25) return '2-3 months';
    return '6+ months';
  }

  private identifyDifferentiation(skill: AnalyzedSkill, benchmark: { average: number; topPercentile: number }): string[] {
    const differentiation = [];
    
    if (skill.proficiency > benchmark.topPercentile) {
      differentiation.push('Top percentile expertise');
    }
    if (skill.verified) {
      differentiation.push('Verified competency');
    }
    if (skill.yearsExperience && skill.yearsExperience > 3) {
      differentiation.push('Extensive experience');
    }
    if (skill.transferability > 80) {
      differentiation.push('Highly transferable skill');
    }
    
    return differentiation;
  }

  private calculateCareerAlignment(skill: string, userProfile: any, careerGoals: string[]): number {
    // Mock calculation - in production, use semantic analysis
    const goalKeywords = careerGoals.join(' ').toLowerCase();
    const skillLower = skill.toLowerCase();
    
    if (goalKeywords.includes(skillLower)) return 90;
    if (goalKeywords.includes('developer') && ['javascript', 'react', 'python'].includes(skillLower)) return 80;
    return 50;
  }

  private calculateLearningEfficiency(gap: SkillGap, userProfile: any): number {
    // Mock calculation based on user's learning patterns
    let efficiency = 70; // Base efficiency
    
    if (gap.urgency === 'immediate') efficiency += 20;
    if (gap.impact === 'career_blocking') efficiency += 15;
    
    return Math.min(100, efficiency);
  }

  private generatePersonalizedTips(userProfile: any, analysis: SkillGapAnalysis): string[] {
    const tips = [];
    
    if (analysis.readinessScore < 50) {
      tips.push('Focus on critical skills first to maximize career impact');
    }
    
    if (analysis.skillGaps.length > 10) {
      tips.push('Consider specializing in 3-5 key skills rather than spreading too thin');
    }
    
    if (analysis.priorityMatrix.immediate.length > 0) {
      tips.push('Address immediate skill gaps within the next 30 days for quick wins');
    }
    
    tips.push('Set weekly learning goals and track your progress consistently');
    tips.push('Join communities and networks related to your target skills');
    
    return tips;
  }
}

export default SkillsGapAnalysisService;
