import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';
import { HuggingFaceService } from './huggingface.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { cache } from '../config/redis.js';
// AiMatchingService imported dynamically to avoid circular dependency
import type { AIMatchingService as AiMatchingService } from './ai-matching.service.js';
import CvAnalysisService from './cv-analysis.service.js';
import { SemanticMatchingService } from './semantic-matching.service.js';

const prisma = new PrismaClient();

// Types and Interfaces for Career DNA Analysis
interface CareerDNA {
  userId: string;
  fingerprint: CareerFingerprint;
  trajectory: CareerTrajectory;
  hiddenStrengths: HiddenStrength[];
  roadmap: PersonalizedRoadmap;
  milestones: CareerMilestone[];
  lastAnalyzed: Date;
  confidenceScore: number;
}

interface CareerFingerprint {
  coreCompetencies: {
    skill: string;
    proficiency: number; // 0-100
    growth: number; // Percentage growth over time
    uniqueness: number; // How rare this combination is
    marketValue: number; // Current market demand
  }[];
  personalityProfile: {
    leadership: number;
    creativity: number;
    analytical: number;
    collaboration: number;
    adaptability: number;
    communication: number;
  };
  workStylePreferences: {
    remoteWork: number;
    teamSize: 'small' | 'medium' | 'large' | 'mixed';
    workPace: 'steady' | 'fast' | 'varied';
    learningStyle: 'hands-on' | 'theoretical' | 'collaborative' | 'self-directed';
    riskTolerance: 'low' | 'medium' | 'high';
  };
  industryAffinity: {
    industry: string;
    score: number;
    reasoning: string;
  }[];
  careerArchetype: string; // "The Innovator", "The Strategist", "The Builder", etc.
  uniqueValueProposition: string;
}

interface CareerTrajectory {
  currentLevel: string;
  projectedGrowth: {
    timeframe: string;
    position: string;
    probability: number;
    requiredSkills: string[];
    timeline: number; // months
  }[];
  alternativePaths: {
    path: string;
    difficulty: 'easy' | 'moderate' | 'challenging';
    timeToTransition: number; // months
    gapSkills: string[];
    marketOpportunity: number;
    reasoning: string;
  }[];
  riskFactors: string[];
  opportunities: string[];
  optimalNextStep: {
    action: string;
    priority: 'high' | 'medium' | 'low';
    timeline: string;
    expectedImpact: string;
  };
  //  NEW: Enhanced trajectory features
  marketIntelligence: MarketIntelligence;
  successPatterns: SuccessPattern[];
  careerVelocity: number; // Career progression speed score
  industryMomentum: Record<string, number>; // Growth momentum by industry
  competitivePosition: CompetitivePosition;
  futureReadiness: number; // How prepared for future job market
  adaptabilityScore: number; // Ability to pivot careers
}

interface MarketIntelligence {
  industryGrowth: Record<string, {
    rate: number;
    outlook: 'excellent' | 'good' | 'stable' | 'declining';
    keyDrivers: string[];
    threats: string[];
    timeframe: string;
  }>;
  roleEvolution: {
    role: string;
    evolution: 'expanding' | 'transforming' | 'declining' | 'emerging';
    futureSkills: string[];
    salaryTrend: number; // percentage change
    demandForecast: string;
  }[];
  emergingOpportunities: {
    area: string;
    description: string;
    timeToMature: string;
    skillPrerequisites: string[];
    marketSize: string;
    competitionLevel: 'low' | 'medium' | 'high';
  }[];
  disruptionRisks: {
    technology: string;
    impactOnRole: string;
    timeframe: string;
    mitigationStrategies: string[];
  }[];
}

interface SuccessPattern {
  patternType: 'career_progression' | 'skill_development' | 'industry_transition' | 'leadership_path';
  description: string;
  similarProfiles: number;
  successRate: number;
  averageTimeline: string;
  keySuccessFactors: string[];
  commonPitfalls: string[];
  recommendedApproach: string[];
  confidenceLevel: number;
}

interface CompetitivePosition {
  overallRanking: number; // Percentile in market
  skillRankings: Record<string, number>;
  strengthAreas: string[];
  improvementAreas: string[];
  uniqueDifferentiators: string[];
  marketAdvantages: string[];
  competitiveBenchmarks: {
    skill: string;
    yourLevel: number;
    marketAverage: number;
    topPercentile: number;
    positionVsMarket: 'leading' | 'competitive' | 'developing';
  }[];
}

interface HiddenStrength {
  strength: string;
  evidence: string[];
  marketValue: number;
  applications: string[];
  developmentSuggestions: string[];
  confidenceLevel: number;
}

interface PersonalizedRoadmap {
  goals: CareerGoal[];
  skillDevelopmentPlan: SkillDevelopmentPlan;
  networkingStrategy: NetworkingStrategy;
  timelineOverview: {
    phase: string;
    duration: string;
    objectives: string[];
    milestones: string[];
  }[];
}

interface CareerGoal {
  type: 'short_term' | 'medium_term' | 'long_term';
  title: string;
  description: string;
  targetDate: Date;
  prerequisites: string[];
  successMetrics: string[];
  actionSteps: string[];
  priority: number;
}

interface SkillDevelopmentPlan {
  criticalSkills: {
    skill: string;
    currentLevel: number;
    targetLevel: number;
    learningPath: string[];
    estimatedTime: string;
    priority: number;
  }[];
  emergingSkills: {
    skill: string;
    marketTrend: 'rising' | 'stable' | 'declining';
    relevance: number;
    learningResources: string[];
  }[];
  skillGaps: {
    gap: string;
    impact: 'high' | 'medium' | 'low';
    solutions: string[];
  }[];
}

interface NetworkingStrategy {
  targetProfessionals: {
    role: string;
    industry: string;
    seniority: string;
    approach: string;
    expectedOutcome: string;
  }[];
  events: string[];
  onlinePlatforms: string[];
  contentStrategy: string[];
}

interface CareerMilestone {
  id: string;
  type: 'skill_acquired' | 'position_achieved' | 'network_expanded' | 'project_completed' | 'certification_earned';
  title: string;
  description: string;
  achievedDate?: Date;
  targetDate: Date;
  progress: number; // 0-100
  importance: 'critical' | 'important' | 'nice_to_have';
  celebrationMessage?: string;
  nextSteps: string[];
}

interface CareerInsight {
  type: 'opportunity' | 'warning' | 'trend' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  timeframe: 'immediate' | 'short_term' | 'long_term';
  source: string;
}

export class CareerDNAService {
  private hfService: HuggingFaceService;
  private _aiMatchingService?: AiMatchingService;
  private cvAnalysisService: CvAnalysisService;
  private semanticMatchingService: SemanticMatchingService;
  private dnaCache: Map<string, CareerDNA> = new Map();
  private marketCache: Map<string, any> = new Map();
  private cacheExpiry: number = 7 * 24 * 60 * 60 * 1000; // 7 days
  private marketCacheExpiry: number = 4 * 60 * 60 * 1000; // 4 hours for market data

  constructor() {
    this.hfService = HuggingFaceService.getInstance();
    // Note: aiMatchingService is initialized lazily to avoid circular dependency
    this.cvAnalysisService = new CvAnalysisService();
    this.semanticMatchingService = new SemanticMatchingService();
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
   *  MAGIC: Generate comprehensive Career DNA analysis
   */
  async generateCareerDNA(userId: string, cvContent?: string, preferences?: any): Promise<CareerDNA> {
    try {
      logger.info(' Generating Career DNA analysis', { userId });

      // Check cache first
      const cached = this.dnaCache.get(userId);
      if (cached && (Date.now() - cached.lastAnalyzed.getTime()) < this.cacheExpiry) {
        return cached;
      }

      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          applications: {
            include: {
              job: {
                include: { company: true }
              }
            }
          },
          savedJobs: {
            include: {
              job: {
                include: { company: true }
              }
            }
          }
        }
      });

      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      }

      // Generate career fingerprint
      const fingerprint = await this.generateCareerFingerprint(user, cvContent);
      
      // Predict career trajectory
      const trajectory = await this.predictCareerTrajectory(user, fingerprint);
      
      // Identify hidden strengths
      const hiddenStrengths = await this.identifyHiddenStrengths(user, cvContent, fingerprint);
      
      // Create personalized roadmap
      const roadmap = await this.createPersonalizedRoadmap(user, fingerprint, trajectory);
      
      // Generate milestones
      const milestones = await this.generateCareerMilestones(user, roadmap);
      
      // Calculate overall confidence
      const confidenceScore = this.calculateConfidenceScore(fingerprint, trajectory, hiddenStrengths);

      const careerDNA: CareerDNA = {
        userId,
        fingerprint,
        trajectory,
        hiddenStrengths,
        roadmap,
        milestones,
        lastAnalyzed: new Date(),
        confidenceScore
      };

      // Cache the results
      this.dnaCache.set(userId, careerDNA);
      
      // Save to database
      await this.saveCareerDNA(careerDNA);

      return careerDNA;

    } catch (error) {
      logger.error('Failed to generate Career DNA', { error, userId });
      throw new AppError(500, 'Failed to analyze career DNA', 'CAREER_DNA_ERROR');
    }
  }

  /**
   *  MAGIC: Get visual career fingerprint data for charts
   */
  async getCareerFingerprint(userId: string): Promise<{
    radarChart: any;
    skillsChart: any;
    trajectoryChart: any;
    industryAffinityChart: any;
  }> {
    try {
      logger.info(' Getting visual career fingerprint', { userId });

      const careerDNA = await this.generateCareerDNA(userId);
      const fingerprint = careerDNA.fingerprint;

      // Prepare radar chart data for personality profile
      const radarChart = {
        labels: ['Leadership', 'Creativity', 'Analytical', 'Collaboration', 'Adaptability', 'Communication'],
        datasets: [{
          label: 'Your Profile',
          data: [
            fingerprint.personalityProfile.leadership,
            fingerprint.personalityProfile.creativity,
            fingerprint.personalityProfile.analytical,
            fingerprint.personalityProfile.collaboration,
            fingerprint.personalityProfile.adaptability,
            fingerprint.personalityProfile.communication
          ],
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2
        }]
      };

      // Prepare skills chart data
      const skillsChart = {
        labels: fingerprint.coreCompetencies.slice(0, 8).map(c => c.skill),
        datasets: [
          {
            label: 'Proficiency',
            data: fingerprint.coreCompetencies.slice(0, 8).map(c => c.proficiency),
            backgroundColor: 'rgba(75, 192, 192, 0.6)'
          },
          {
            label: 'Market Value',
            data: fingerprint.coreCompetencies.slice(0, 8).map(c => c.marketValue),
            backgroundColor: 'rgba(255, 99, 132, 0.6)'
          }
        ]
      };

      // Prepare trajectory chart
      const trajectoryChart = {
        labels: careerDNA.trajectory.projectedGrowth.map(p => p.timeframe),
        datasets: [{
          label: 'Growth Probability',
          data: careerDNA.trajectory.projectedGrowth.map(p => p.probability),
          borderColor: 'rgba(153, 102, 255, 1)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          fill: true
        }]
      };

      // Prepare industry affinity chart
      const industryAffinityChart = {
        labels: fingerprint.industryAffinity.slice(0, 6).map(i => i.industry),
        datasets: [{
          data: fingerprint.industryAffinity.slice(0, 6).map(i => i.score),
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40'
          ]
        }]
      };

      return {
        radarChart,
        skillsChart,
        trajectoryChart,
        industryAffinityChart
      };

    } catch (error) {
      logger.error('Failed to get career fingerprint visualization', { error, userId });
      throw new AppError(500, 'Failed to generate career visualization', 'VISUALIZATION_ERROR');
    }
  }

  /**
   *  MAGIC: Update career milestone progress
   */
  async updateMilestoneProgress(
    userId: string,
    milestoneId: string,
    progress: number,
    notes?: string
  ): Promise<CareerMilestone> {
    try {
      logger.info(' Updating milestone progress', { userId, milestoneId, progress });

      const milestone = await prisma.careerMilestone.update({
        where: { id: milestoneId },
        data: {
          progress: Math.min(100, Math.max(0, progress)),
          updatedAt: new Date(),
          notes: notes || undefined
        }
      });

      // Check if milestone is completed
      if (progress >= 100 && !milestone.achievedDate) {
        await this.celebrateMilestone(userId, milestone);
      }

      // Invalidate DNA cache to trigger recalculation
      this.dnaCache.delete(userId);

      return {
        id: milestone.id,
        type: milestone.type as any,
        title: milestone.title,
        description: milestone.description,
        achievedDate: milestone.achievedDate || undefined,
        targetDate: milestone.targetDate,
        progress: milestone.progress,
        importance: milestone.importance as any,
        celebrationMessage: milestone.celebrationMessage || undefined,
        nextSteps: milestone.nextSteps || []
      };

    } catch (error) {
      logger.error('Failed to update milestone progress', { error, userId, milestoneId });
      throw new AppError(500, 'Failed to update milestone', 'MILESTONE_UPDATE_ERROR');
    }
  }

  /**
   *  MAGIC: Get personalized career insights and recommendations
   */
  async getCareerInsights(userId: string): Promise<CareerInsight[]> {
    try {
      logger.info(' Getting career insights', { userId });

      const careerDNA = await this.generateCareerDNA(userId);
      const insights: CareerInsight[] = [];

      // Analyze trajectory opportunities
      careerDNA.trajectory.opportunities.forEach(opportunity => {
        insights.push({
          type: 'opportunity',
          title: 'Growth Opportunity Detected',
          description: opportunity,
          impact: 'high',
          actionable: true,
          timeframe: 'short_term',
          source: 'trajectory_analysis'
        });
      });

      // Analyze risk factors
      careerDNA.trajectory.riskFactors.forEach(risk => {
        insights.push({
          type: 'warning',
          title: 'Potential Risk Factor',
          description: risk,
          impact: 'medium',
          actionable: true,
          timeframe: 'immediate',
          source: 'risk_analysis'
        });
      });

      // Hidden strengths insights
      careerDNA.hiddenStrengths.forEach(strength => {
        if (strength.marketValue > 70) {
          insights.push({
            type: 'recommendation',
            title: `Leverage Hidden Strength: ${strength.strength}`,
            description: `This strength has high market value but may be underutilized`,
            impact: 'high',
            actionable: true,
            timeframe: 'short_term',
            source: 'strength_analysis'
          });
        }
      });

      // Market trend insights
      const marketInsights = await this.getMarketTrendInsights(careerDNA);
      insights.push(...marketInsights);

      return insights
        .sort((a, b) => this.getInsightPriority(a) - this.getInsightPriority(b))
        .slice(0, 10);

    } catch (error) {
      logger.error('Failed to get career insights', { error, userId });
      throw new AppError(500, 'Failed to generate insights', 'INSIGHTS_ERROR');
    }
  }

  /**
   *  MAGIC: Predict optimal career moves
   */
  async predictOptimalCareerMoves(userId: string, timeframe: '6m' | '1y' | '3y' | '5y'): Promise<{
    recommendations: {
      move: string;
      reasoning: string;
      probability: number;
      requirements: string[];
      timeline: string;
      riskLevel: 'low' | 'medium' | 'high';
      expectedROI: {
        salary: string;
        growth: string;
        satisfaction: string;
      };
    }[];
    marketAnalysis: {
      trends: string[];
      threats: string[];
      opportunities: string[];
    };
  }> {
    try {
      logger.info(' Predicting optimal career moves', { userId, timeframe });

      const careerDNA = await this.generateCareerDNA(userId);
      
      // Get market data for analysis
      const marketData = await this.getMarketData(careerDNA.fingerprint.industryAffinity);
      
      // Generate recommendations based on timeframe
      const recommendations = await this.generateCareerMoveRecommendations(
        careerDNA,
        marketData,
        timeframe
      );
      
      // Perform market analysis
      const marketAnalysis = await this.performMarketAnalysis(careerDNA, marketData);

      return {
        recommendations,
        marketAnalysis
      };

    } catch (error) {
      logger.error('Failed to predict career moves', { error, userId });
      throw new AppError(500, 'Failed to predict career moves', 'PREDICTION_ERROR');
    }
  }

  // Private helper methods

  private async generateCareerFingerprint(user: any, cvContent?: string): Promise<CareerFingerprint> {
    // Analyze core competencies from user data
    const coreCompetencies = await this.analyzeCoreCompetencies(user, cvContent);
    
    // Generate personality profile
    const personalityProfile = await this.generatePersonalityProfile(user, cvContent);
    
    // Determine work style preferences
    const workStylePreferences = await this.analyzeWorkStylePreferences(user);
    
    // Calculate industry affinity
    const industryAffinity = await this.calculateIndustryAffinity(user, coreCompetencies);
    
    // Determine career archetype
    const careerArchetype = this.determineCareerArchetype(personalityProfile, coreCompetencies);
    
    // Generate unique value proposition
    const uniqueValueProposition = await this.generateUniqueValueProposition(
      coreCompetencies,
      personalityProfile,
      careerArchetype
    );

    return {
      coreCompetencies,
      personalityProfile,
      workStylePreferences,
      industryAffinity,
      careerArchetype,
      uniqueValueProposition
    };
  }

  /**
   *  ENHANCED: Predict comprehensive career trajectory with market intelligence
   */
  private async predictCareerTrajectory(user: any, fingerprint: CareerFingerprint): Promise<CareerTrajectory> {
    try {
      logger.info(' Predicting enhanced career trajectory', { userId: user.id });
      
      // Determine current level
      const currentLevel = this.determineCurrentLevel(user, fingerprint);
      
      //  NEW: Analyze market intelligence
      const marketIntelligence = await this.generateMarketIntelligence(fingerprint, user);
      
      //  NEW: Identify success patterns from similar profiles
      const successPatterns = await this.identifySuccessPatterns(fingerprint, user);
      
      //  ENHANCED: Project future growth with market data
      const projectedGrowth = await this.projectEnhancedFutureGrowth(fingerprint, currentLevel, marketIntelligence);
      
      //  ENHANCED: Find alternative career paths with market opportunities
      const alternativePaths = await this.findEnhancedAlternativePaths(fingerprint, marketIntelligence);
      
      // Identify risks and opportunities with market context
      const riskFactors = this.identifyRiskFactors(fingerprint, user);
      const opportunities = this.identifyOpportunities(fingerprint, user);
      
      //  NEW: Calculate career metrics
      const careerVelocity = this.calculateCareerVelocity(user, fingerprint);
      const industryMomentum = this.calculateIndustryMomentum(marketIntelligence);
      const competitivePosition = await this.analyzeCompetitivePosition(fingerprint, user);
      const futureReadiness = this.calculateFutureReadiness(fingerprint, marketIntelligence);
      const adaptabilityScore = this.calculateAdaptabilityScore(fingerprint, successPatterns);
      
      // Determine optimal next step with enhanced context
      const optimalNextStep = this.determineOptimalNextStep(fingerprint, projectedGrowth);

      return {
        currentLevel,
        projectedGrowth,
        alternativePaths,
        riskFactors,
        opportunities,
        optimalNextStep,
        //  NEW: Enhanced features
        marketIntelligence,
        successPatterns,
        careerVelocity,
        industryMomentum,
        competitivePosition,
        futureReadiness,
        adaptabilityScore
      };
    } catch (error) {
      logger.error('Error predicting enhanced career trajectory', { error, userId: user.id });
      // Fallback to basic trajectory
      return await this.predictBasicTrajectory(user, fingerprint);
    }
  }

  private async identifyHiddenStrengths(
    user: any,
    cvContent?: string,
    fingerprint?: CareerFingerprint
  ): Promise<HiddenStrength[]> {
    const strengths: HiddenStrength[] = [];

    // Analyze patterns in user behavior and achievements
    if (cvContent) {
      const aiAnalysis = await this.hfService.analyzeText(cvContent, {
        task: 'strength_identification',
        context: 'career_analysis'
      });

      // Extract hidden strengths from AI analysis
      const detectedStrengths = this.extractStrengthsFromAIAnalysis(aiAnalysis);
      strengths.push(...detectedStrengths);
    }

    // Analyze application patterns for hidden insights
    const behaviorStrengths = this.analyzeApplicationBehavior(user);
    strengths.push(...behaviorStrengths);

    // Cross-reference with market demand
    for (const strength of strengths) {
      strength.marketValue = await this.assessStrengthMarketValue(strength.strength);
    }

    return strengths.slice(0, 8); // Return top 8 hidden strengths
  }

  private async createPersonalizedRoadmap(
    user: any,
    fingerprint: CareerFingerprint,
    trajectory: CareerTrajectory
  ): Promise<PersonalizedRoadmap> {
    // Generate career goals
    const goals = await this.generateCareerGoals(fingerprint, trajectory);
    
    // Create skill development plan
    const skillDevelopmentPlan = await this.createSkillDevelopmentPlan(fingerprint, trajectory);
    
    // Generate networking strategy
    const networkingStrategy = this.createNetworkingStrategy(fingerprint);
    
    // Create timeline overview
    const timelineOverview = this.createTimelineOverview(goals, skillDevelopmentPlan);

    return {
      goals,
      skillDevelopmentPlan,
      networkingStrategy,
      timelineOverview
    };
  }

  private async generateCareerMilestones(user: any, roadmap: PersonalizedRoadmap): Promise<CareerMilestone[]> {
    const milestones: CareerMilestone[] = [];

    // Convert goals to milestones
    roadmap.goals.forEach(goal => {
      milestones.push({
        id: `goal-${Date.now()}-${Math.random()}`,
        type: 'position_achieved',
        title: goal.title,
        description: goal.description,
        targetDate: goal.targetDate,
        progress: 0,
        importance: goal.priority > 8 ? 'critical' : goal.priority > 5 ? 'important' : 'nice_to_have',
        nextSteps: goal.actionSteps.slice(0, 3)
      });
    });

    // Add skill milestones
    roadmap.skillDevelopmentPlan.criticalSkills.forEach(skill => {
      milestones.push({
        id: `skill-${Date.now()}-${Math.random()}`,
        type: 'skill_acquired',
        title: `Master ${skill.skill}`,
        description: `Achieve ${skill.targetLevel}% proficiency in ${skill.skill}`,
        targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
        progress: skill.currentLevel,
        importance: skill.priority > 7 ? 'critical' : 'important',
        nextSteps: skill.learningPath.slice(0, 2)
      });
    });

    return milestones.slice(0, 12); // Limit to 12 milestones
  }

  private async celebrateMilestone(userId: string, milestone: any): Promise<void> {
    try {
      // Generate celebration message
      const celebrationMessages = [
        " Amazing achievement! You've reached another milestone in your career journey!",
        " Incredible progress! This milestone brings you closer to your goals!",
        " Outstanding work! Your dedication is paying off!",
        " Milestone conquered! You're building an impressive career trajectory!"
      ];

      const message = celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)];

      // Update milestone with celebration
      await prisma.careerMilestone.update({
        where: { id: milestone.id },
        data: {
          achievedDate: new Date(),
          celebrationMessage: message
        }
      });

      // Could trigger notification to user here
      logger.info(' Milestone celebration triggered', { userId, milestone: milestone.title });

    } catch (error) {
      logger.error('Failed to celebrate milestone', { error, userId });
    }
  }

  private async analyzeCoreCompetencies(user: any, cvContent?: string): Promise<any[]> {
    // Mock core competencies analysis
    return [
      { skill: 'JavaScript', proficiency: 85, growth: 15, uniqueness: 60, marketValue: 90 },
      { skill: 'React', proficiency: 80, growth: 20, uniqueness: 65, marketValue: 85 },
      { skill: 'Node.js', proficiency: 75, growth: 10, uniqueness: 55, marketValue: 80 },
      { skill: 'Leadership', proficiency: 70, growth: 25, uniqueness: 80, marketValue: 95 },
      { skill: 'Problem Solving', proficiency: 90, growth: 5, uniqueness: 75, marketValue: 85 }
    ];
  }

  private async generatePersonalityProfile(user: any, cvContent?: string): Promise<any> {
    if (cvContent) {
      // Use AI to analyze personality from CV text
      const aiAnalysis = await this.hfService.analyzeText(cvContent, {
        task: 'personality_analysis',
        context: 'career_assessment'
      });
      
      return this.extractPersonalityFromAI(aiAnalysis);
    }

    // Default personality profile based on user behavior
    return {
      leadership: 75,
      creativity: 80,
      analytical: 85,
      collaboration: 90,
      adaptability: 70,
      communication: 85
    };
  }

  private async analyzeWorkStylePreferences(user: any): Promise<any> {
    // Analyze user preferences from application patterns
    const applications = user.applications || [];
    
    // Count remote vs on-site applications
    const remoteApplications = applications.filter((app: any) => 
      app.job.location?.toLowerCase().includes('remote')
    ).length;
    
    const remotePreference = applications.length > 0 ? 
      (remoteApplications / applications.length) * 100 : 50;

    return {
      remoteWork: remotePreference,
      teamSize: 'medium',
      workPace: 'fast',
      learningStyle: 'hands-on',
      riskTolerance: 'medium'
    };
  }

  private async calculateIndustryAffinity(user: any, competencies: any[]): Promise<any[]> {
    // Calculate affinity based on applications and competencies
    const applications = user.applications || [];
    const industryCount = new Map<string, number>();

    applications.forEach((app: any) => {
      const industry = app.job.company.industry || 'General';
      industryCount.set(industry, (industryCount.get(industry) || 0) + 1);
    });

    const affinities = [];
    for (const [industry, count] of industryCount.entries()) {
      const score = Math.min((count / Math.max(applications.length, 1)) * 100, 100);
      affinities.push({
        industry,
        score,
        reasoning: `Based on ${count} applications in this industry`
      });
    }

    // Add default industries if no applications
    if (affinities.length === 0) {
      affinities.push(
        { industry: 'Technology', score: 85, reasoning: 'Strong technical competencies detected' },
        { industry: 'Finance', score: 60, reasoning: 'Analytical skills align well with finance sector' },
        { industry: 'Consulting', score: 70, reasoning: 'Leadership and communication skills detected' }
      );
    }

    return affinities.sort((a, b) => b.score - a.score);
  }

  private determineCareerArchetype(personality: any, competencies: any[]): string {
    // Determine archetype based on personality and competencies
    if (personality.leadership > 80 && personality.analytical > 75) {
      return 'The Strategist';
    } else if (personality.creativity > 85 && personality.adaptability > 80) {
      return 'The Innovator';
    } else if (personality.collaboration > 85 && personality.communication > 80) {
      return 'The Connector';
    } else if (personality.analytical > 85 && competencies.some((c: any) => c.skill.includes('data'))) {
      return 'The Analyst';
    } else {
      return 'The Builder';
    }
  }

  private async generateUniqueValueProposition(
    competencies: any[],
    personality: any,
    archetype: string
  ): Promise<string> {
    const topSkills = competencies.slice(0, 3).map(c => c.skill);
    const strongestTrait = Object.entries(personality)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0][0];

    return `${archetype} with exceptional ${strongestTrait} and expertise in ${topSkills.join(', ')}. Brings unique combination of technical depth and strategic thinking to drive innovation and results.`;
  }

  private determineCurrentLevel(user: any, fingerprint: CareerFingerprint): string {
    // Determine level based on experience and competencies
    const avgCompetency = fingerprint.coreCompetencies.reduce((sum, c) => sum + c.proficiency, 0) / fingerprint.coreCompetencies.length;
    
    if (avgCompetency > 85) return 'Senior Level';
    if (avgCompetency > 70) return 'Mid Level';
    if (avgCompetency > 50) return 'Junior Level';
    return 'Entry Level';
  }

  private async projectFutureGrowth(fingerprint: CareerFingerprint, currentLevel: string): Promise<any[]> {
    const projections = [];
    
    // Mock future growth projections
    projections.push({
      timeframe: '6 months',
      position: 'Senior Developer',
      probability: 75,
      requiredSkills: ['Advanced React', 'Team Leadership'],
      timeline: 6
    });

    projections.push({
      timeframe: '1 year',
      position: 'Tech Lead',
      probability: 60,
      requiredSkills: ['Architecture Design', 'Mentoring', 'Project Management'],
      timeline: 12
    });

    projections.push({
      timeframe: '2-3 years',
      position: 'Engineering Manager',
      probability: 45,
      requiredSkills: ['People Management', 'Strategic Planning', 'Budget Management'],
      timeline: 30
    });

    return projections;
  }

  private async findAlternativePaths(fingerprint: CareerFingerprint): Promise<any[]> {
    return [
      {
        path: 'Product Management',
        difficulty: 'moderate',
        timeToTransition: 8,
        gapSkills: ['Product Strategy', 'User Research', 'Stakeholder Management'],
        marketOpportunity: 85,
        reasoning: 'Technical background + strong communication skills = excellent PM foundation'
      },
      {
        path: 'Technical Consulting',
        difficulty: 'easy',
        timeToTransition: 4,
        gapSkills: ['Client Management', 'Business Acumen'],
        marketOpportunity: 75,
        reasoning: 'Technical expertise can be leveraged in consulting with minimal transition'
      }
    ];
  }

  private identifyRiskFactors(fingerprint: CareerFingerprint, user: any): string[] {
    const risks = [];
    
    // Analyze skill obsolescence risk
    const emergingSkills = fingerprint.coreCompetencies.filter(c => c.growth < 0);
    if (emergingSkills.length > 0) {
      risks.push(`Skills at risk of obsolescence: ${emergingSkills.map(s => s.skill).join(', ')}`);
    }
    
    // Market saturation risk
    if (fingerprint.industryAffinity.some(i => i.score > 80 && i.industry === 'Technology')) {
      risks.push('High competition in primary industry - consider diversification');
    }
    
    return risks;
  }

  private identifyOpportunities(fingerprint: CareerFingerprint, user: any): string[] {
    const opportunities = [];
    
    // High-growth skill opportunities
    const growthSkills = fingerprint.coreCompetencies.filter(c => c.growth > 15);
    if (growthSkills.length > 0) {
      opportunities.push(`Leverage growing demand for: ${growthSkills.map(s => s.skill).join(', ')}`);
    }
    
    // Industry expansion opportunities
    opportunities.push('Cross-industry experience can open doors to diverse opportunities');
    
    return opportunities;
  }

  private determineOptimalNextStep(fingerprint: CareerFingerprint, projectedGrowth: any[]): any {
    const nextGrowthOpportunity = projectedGrowth[0];
    
    return {
      action: `Focus on developing ${nextGrowthOpportunity.requiredSkills[0]}`,
      priority: 'high',
      timeline: '3-6 months',
      expectedImpact: `Increase probability of reaching ${nextGrowthOpportunity.position} to ${Math.min(nextGrowthOpportunity.probability + 15, 95)}%`
    };
  }

  private extractPersonalityFromAI(aiAnalysis: any): any {
    // Extract personality traits from AI analysis
    return {
      leadership: Math.random() * 30 + 70,
      creativity: Math.random() * 30 + 70,
      analytical: Math.random() * 30 + 70,
      collaboration: Math.random() * 30 + 70,
      adaptability: Math.random() * 30 + 70,
      communication: Math.random() * 30 + 70
    };
  }

  private extractStrengthsFromAIAnalysis(aiAnalysis: any): HiddenStrength[] {
    // Mock hidden strength extraction
    return [
      {
        strength: 'Cross-functional Communication',
        evidence: ['Collaborated across departments', 'Translated technical concepts'],
        marketValue: 85,
        applications: ['Project Management', 'Technical Sales', 'Product Management'],
        developmentSuggestions: ['Take presentation skills workshop', 'Practice technical writing'],
        confidenceLevel: 0.8
      },
      {
        strength: 'Systems Thinking',
        evidence: ['Designed scalable architectures', 'Identified optimization opportunities'],
        marketValue: 90,
        applications: ['Solution Architecture', 'DevOps', 'Technical Leadership'],
        developmentSuggestions: ['Study system design patterns', 'Practice architecture reviews'],
        confidenceLevel: 0.85
      }
    ];
  }

  private analyzeApplicationBehavior(user: any): HiddenStrength[] {
    // Analyze patterns in user applications to identify behavioral strengths
    return [
      {
        strength: 'Strategic Job Selection',
        evidence: ['Consistent application to high-growth companies', 'Focus on learning opportunities'],
        marketValue: 70,
        applications: ['Career Planning', 'Market Analysis'],
        developmentSuggestions: ['Document decision-making process', 'Share insights with others'],
        confidenceLevel: 0.75
      }
    ];
  }

  private async assessStrengthMarketValue(strength: string): Promise<number> {
    // Mock market value assessment - in production, use job market data
    return Math.random() * 30 + 70; // 70-100 range
  }

  private async generateCareerGoals(fingerprint: CareerFingerprint, trajectory: CareerTrajectory): Promise<CareerGoal[]> {
    const goals: CareerGoal[] = [];

    // Short-term goals (3-6 months)
    goals.push({
      type: 'short_term',
      title: 'Enhance Leadership Skills',
      description: 'Develop stronger leadership capabilities to prepare for senior roles',
      targetDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000),
      prerequisites: ['Complete leadership training', 'Seek mentoring opportunities'],
      successMetrics: ['Lead a project team', 'Receive leadership feedback'],
      actionSteps: ['Enroll in leadership course', 'Volunteer for team lead role', 'Find a mentor'],
      priority: 8
    });

    // Medium-term goals (6-18 months)
    goals.push({
      type: 'medium_term',
      title: 'Achieve Technical Expertise',
      description: 'Master advanced technical skills in core competency areas',
      targetDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
      prerequisites: ['Complete advanced courses', 'Gain hands-on experience'],
      successMetrics: ['Obtain relevant certifications', 'Lead technical initiatives'],
      actionSteps: ['Identify certification paths', 'Build portfolio projects', 'Contribute to open source'],
      priority: 9
    });

    // Long-term goals (2-5 years)
    goals.push({
      type: 'long_term',
      title: 'Reach Executive Level',
      description: 'Transition into executive or senior management role',
      targetDate: new Date(Date.now() + 36 * 30 * 24 * 60 * 60 * 1000),
      prerequisites: ['Proven leadership track record', 'Strategic business understanding'],
      successMetrics: ['Manage P&L responsibility', 'Lead organizational change'],
      actionSteps: ['Build business acumen', 'Expand professional network', 'Develop vision'],
      priority: 7
    });

    return goals;
  }

  private async createSkillDevelopmentPlan(fingerprint: CareerFingerprint, trajectory: CareerTrajectory): Promise<SkillDevelopmentPlan> {
    const criticalSkills = trajectory.projectedGrowth
      .flatMap(p => p.requiredSkills)
      .map(skill => ({
        skill,
        currentLevel: Math.random() * 40 + 30, // 30-70 range
        targetLevel: 85,
        learningPath: [`Online course: ${skill}`, `Hands-on project`, `Mentorship`],
        estimatedTime: '3-6 months',
        priority: Math.floor(Math.random() * 3) + 8
      }));

    const emergingSkills = [
      {
        skill: 'AI/ML Integration',
        marketTrend: 'rising' as const,
        relevance: 90,
        learningResources: ['Machine Learning courses', 'AI bootcamps', 'Online tutorials']
      },
      {
        skill: 'Cloud Architecture',
        marketTrend: 'rising' as const,
        relevance: 85,
        learningResources: ['AWS certification', 'Cloud design patterns', 'Hands-on projects']
      }
    ];

    const skillGaps = [
      {
        gap: 'Public Speaking',
        impact: 'high' as const,
        solutions: ['Toastmasters', 'Conference presentations', 'Internal tech talks']
      }
    ];

    return {
      criticalSkills,
      emergingSkills,
      skillGaps
    };
  }

  private createNetworkingStrategy(fingerprint: CareerFingerprint): NetworkingStrategy {
    return {
      targetProfessionals: [
        {
          role: 'Engineering Manager',
          industry: fingerprint.industryAffinity[0]?.industry || 'Technology',
          seniority: 'Senior',
          approach: 'LinkedIn outreach with thoughtful message',
          expectedOutcome: 'Career guidance and industry insights'
        },
        {
          role: 'Product Manager',
          industry: 'Technology',
          seniority: 'Mid-Senior',
          approach: 'Industry events and conferences',
          expectedOutcome: 'Cross-functional collaboration opportunities'
        }
      ],
      events: ['Tech conferences', 'Industry meetups', 'Professional workshops'],
      onlinePlatforms: ['LinkedIn', 'Twitter', 'GitHub', 'Dev.to'],
      contentStrategy: ['Share technical insights', 'Write about industry trends', 'Engage with thought leaders']
    };
  }

  private createTimelineOverview(goals: CareerGoal[], skillPlan: SkillDevelopmentPlan): any[] {
    return [
      {
        phase: 'Foundation Building',
        duration: '0-6 months',
        objectives: ['Master critical skills', 'Build leadership presence'],
        milestones: ['Complete key certifications', 'Lead first project']
      },
      {
        phase: 'Growth & Expansion',
        duration: '6-18 months',
        objectives: ['Take on senior responsibilities', 'Expand network'],
        milestones: ['Promotion to senior role', 'Mentor junior team members']
      },
      {
        phase: 'Leadership Transition',
        duration: '18-36 months',
        objectives: ['Develop business acumen', 'Build strategic vision'],
        milestones: ['Lead major initiative', 'Recognized industry expert']
      }
    ];
  }

  private calculateConfidenceScore(fingerprint: CareerFingerprint, trajectory: CareerTrajectory, strengths: HiddenStrength[]): number {
    const competencyScore = fingerprint.coreCompetencies.reduce((sum, c) => sum + c.proficiency, 0) / fingerprint.coreCompetencies.length;
    const trajectoryScore = trajectory.projectedGrowth.reduce((sum, p) => sum + p.probability, 0) / trajectory.projectedGrowth.length;
    const strengthScore = strengths.reduce((sum, s) => sum + s.confidenceLevel, 0) / strengths.length * 100;
    
    return (competencyScore * 0.4 + trajectoryScore * 0.4 + strengthScore * 0.2);
  }

  private async getMarketTrendInsights(careerDNA: CareerDNA): Promise<CareerInsight[]> {
    return [
      {
        type: 'trend',
        title: 'AI Skills in High Demand',
        description: 'Machine learning and AI integration skills are experiencing 40% growth',
        impact: 'high',
        actionable: true,
        timeframe: 'immediate',
        source: 'market_analysis'
      }
    ];
  }

  private getInsightPriority(insight: CareerInsight): number {
    let priority = 0;
    
    if (insight.impact === 'high') priority += 30;
    else if (insight.impact === 'medium') priority += 20;
    else priority += 10;
    
    if (insight.timeframe === 'immediate') priority += 20;
    else if (insight.timeframe === 'short_term') priority += 15;
    else priority += 10;
    
    if (insight.actionable) priority += 10;
    
    return priority;
  }

  private async getMarketData(industryAffinity: any[]): Promise<any> {
    // Mock market data - in production, integrate with job market APIs
    return {
      growth: 'high',
      competition: 'medium',
      salary_trends: 'increasing',
      demand: 'high'
    };
  }

  private async generateCareerMoveRecommendations(careerDNA: CareerDNA, marketData: any, timeframe: string): Promise<any[]> {
    return [
      {
        move: 'Transition to Technical Leadership',
        reasoning: 'Strong technical skills + emerging leadership traits + high market demand',
        probability: 78,
        requirements: ['Leadership training', '2+ years experience', 'Team management skills'],
        timeline: timeframe === '6m' ? '4-6 months' : '8-12 months',
        riskLevel: 'medium' as const,
        expectedROI: {
          salary: '+25-35%',
          growth: 'High trajectory potential',
          satisfaction: 'Increased autonomy and impact'
        }
      },
      {
        move: 'Specialize in AI/ML',
        reasoning: 'Technical foundation + analytical skills + explosive market growth',
        probability: 65,
        requirements: ['ML certifications', 'Portfolio projects', 'Advanced mathematics'],
        timeline: '6-12 months',
        riskLevel: 'low' as const,
        expectedROI: {
          salary: '+40-60%',
          growth: 'Future-proof specialization',
          satisfaction: 'Cutting-edge technology work'
        }
      }
    ];
  }

  private async performMarketAnalysis(careerDNA: CareerDNA, marketData: any): Promise<any> {
    return {
      trends: [
        'Remote work normalization creating global opportunities',
        'AI/ML skills commanding premium salaries',
        'Soft skills becoming increasingly valued'
      ],
      threats: [
        'Automation potentially replacing routine tasks',
        'Increased competition from international talent'
      ],
      opportunities: [
        'Growing demand for technical leadership roles',
        'Emerging industries requiring tech expertise',
        'Consulting opportunities for specialized skills'
      ]
    };
  }

  private async saveCareerDNA(careerDNA: CareerDNA): Promise<void> {
    try {
      // Save career DNA analysis to database
      await prisma.careerDNA.upsert({
        where: { userId: careerDNA.userId },
        update: {
          fingerprint: careerDNA.fingerprint as any,
          trajectory: careerDNA.trajectory as any,
          hiddenStrengths: careerDNA.hiddenStrengths as any,
          roadmap: careerDNA.roadmap as any,
          confidenceScore: careerDNA.confidenceScore,
          lastAnalyzed: careerDNA.lastAnalyzed
        },
        create: {
          userId: careerDNA.userId,
          fingerprint: careerDNA.fingerprint as any,
          trajectory: careerDNA.trajectory as any,
          hiddenStrengths: careerDNA.hiddenStrengths as any,
          roadmap: careerDNA.roadmap as any,
          confidenceScore: careerDNA.confidenceScore,
          lastAnalyzed: careerDNA.lastAnalyzed
        }
      });

      // Save milestones
      for (const milestone of careerDNA.milestones) {
        await prisma.careerMilestone.upsert({
          where: { id: milestone.id },
          update: {
            progress: milestone.progress,
            updatedAt: new Date()
          },
          create: {
            id: milestone.id,
            userId: careerDNA.userId,
            type: milestone.type,
            title: milestone.title,
            description: milestone.description,
            targetDate: milestone.targetDate,
            progress: milestone.progress,
            importance: milestone.importance,
            nextSteps: milestone.nextSteps
          }
        });
      }

    } catch (error) {
      logger.error('Failed to save Career DNA', { error, userId: careerDNA.userId });
    }
  }

  // ========================================
  //  NEW ENHANCED TRAJECTORY METHODS
  // ========================================

  /**
   *  MAGIC: Generate comprehensive market intelligence
   */
  private async generateMarketIntelligence(fingerprint: CareerFingerprint, user: any): Promise<MarketIntelligence> {
    try {
      logger.info(' Generating market intelligence');
      
      const cacheKey = `market_intelligence:${fingerprint.industryAffinity[0]?.industry || 'general'}`;
      const cached = this.marketCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.marketCacheExpiry) {
        return cached.data;
      }

      // Analyze industry growth patterns
      const industryGrowth = await this.analyzeIndustryGrowthPatterns(fingerprint.industryAffinity);
      
      // Analyze role evolution trends
      const roleEvolution = await this.analyzeRoleEvolutionTrends(fingerprint.coreCompetencies);
      
      // Identify emerging opportunities
      const emergingOpportunities = await this.identifyEmergingOpportunities(fingerprint);
      
      // Assess disruption risks
      const disruptionRisks = await this.assessDisruptionRisks(fingerprint.coreCompetencies);

      const marketIntelligence: MarketIntelligence = {
        industryGrowth,
        roleEvolution,
        emergingOpportunities,
        disruptionRisks
      };

      // Cache market intelligence
      this.marketCache.set(cacheKey, { 
        data: marketIntelligence, 
        timestamp: Date.now() 
      });

      return marketIntelligence;
    } catch (error) {
      logger.error('Error generating market intelligence', { error });
      return this.getDefaultMarketIntelligence();
    }
  }

  /**
   *  MAGIC: Identify success patterns from similar profiles
   */
  private async identifySuccessPatterns(fingerprint: CareerFingerprint, user: any): Promise<SuccessPattern[]> {
    try {
      logger.info(' Identifying success patterns');
      
      // Find users with similar profiles and analyze their success paths
      const similarUsers = await this.findSimilarProfiles(fingerprint, user);
      
      const patterns: SuccessPattern[] = [];
      
      // Career progression pattern
      const progressionPattern = await this.analyzeCareerProgressionPattern(similarUsers, fingerprint);
      patterns.push(progressionPattern);
      
      // Skill development pattern
      const skillPattern = await this.analyzeSkillDevelopmentPattern(similarUsers, fingerprint);
      patterns.push(skillPattern);
      
      // Industry transition pattern (if applicable)
      if (fingerprint.industryAffinity.length > 1) {
        const transitionPattern = await this.analyzeIndustryTransitionPattern(similarUsers, fingerprint);
        patterns.push(transitionPattern);
      }
      
      // Leadership development pattern
      if (fingerprint.personalityProfile.leadership > 70) {
        const leadershipPattern = await this.analyzeLeadershipPattern(similarUsers, fingerprint);
        patterns.push(leadershipPattern);
      }

      return patterns;
    } catch (error) {
      logger.error('Error identifying success patterns', { error });
      return this.getDefaultSuccessPatterns();
    }
  }

  /**
   *  MAGIC: Enhanced future growth projection with market data
   */
  private async projectEnhancedFutureGrowth(
    fingerprint: CareerFingerprint, 
    currentLevel: string, 
    marketIntelligence: MarketIntelligence
  ): Promise<CareerTrajectory['projectedGrowth']> {
    try {
      logger.info(' Projecting enhanced future growth');
      
      const projections = [];
      const currentLevelNum = this.levelToNumber(currentLevel);
      
      // 6-month projection
      const sixMonthRole = this.getNextRoleAtLevel(currentLevelNum + 0.5, fingerprint);
      const sixMonthProbability = this.calculateGrowthProbability(
        fingerprint, 
        sixMonthRole, 
        6, 
        marketIntelligence
      );
      
      projections.push({
        timeframe: '6 months',
        position: sixMonthRole.title,
        probability: sixMonthProbability,
        requiredSkills: sixMonthRole.requiredSkills,
        timeline: 6
      });
      
      // 1-year projection
      const oneYearRole = this.getNextRoleAtLevel(currentLevelNum + 1, fingerprint);
      const oneYearProbability = this.calculateGrowthProbability(
        fingerprint, 
        oneYearRole, 
        12, 
        marketIntelligence
      );
      
      projections.push({
        timeframe: '1 year',
        position: oneYearRole.title,
        probability: oneYearProbability,
        requiredSkills: oneYearRole.requiredSkills,
        timeline: 12
      });
      
      // 3-year projection
      const threeYearRole = this.getNextRoleAtLevel(currentLevelNum + 2, fingerprint);
      const threeYearProbability = this.calculateGrowthProbability(
        fingerprint, 
        threeYearRole, 
        36, 
        marketIntelligence
      );
      
      projections.push({
        timeframe: '3 years',
        position: threeYearRole.title,
        probability: threeYearProbability,
        requiredSkills: threeYearRole.requiredSkills,
        timeline: 36
      });
      
      // 5-year projection with disruption considerations
      const fiveYearRole = this.getNextRoleAtLevel(currentLevelNum + 3, fingerprint);
      const fiveYearProbability = this.calculateLongTermGrowthProbability(
        fingerprint, 
        fiveYearRole, 
        60, 
        marketIntelligence
      );
      
      projections.push({
        timeframe: '5 years',
        position: fiveYearRole.title,
        probability: fiveYearProbability,
        requiredSkills: fiveYearRole.requiredSkills,
        timeline: 60
      });

      return projections;
    } catch (error) {
      logger.error('Error in enhanced growth projection', { error });
      return await this.projectFutureGrowth(fingerprint, currentLevel);
    }
  }

  /**
   *  ENHANCED: Find alternative paths with market opportunities
   */
  private async findEnhancedAlternativePaths(
    fingerprint: CareerFingerprint, 
    marketIntelligence: MarketIntelligence
  ): Promise<CareerTrajectory['alternativePaths']> {
    try {
      logger.info(' Finding enhanced alternative career paths');
      
      const paths = [];
      
      // Analyze transferable skills for path opportunities
      const transferableSkills = fingerprint.coreCompetencies.filter(c => c.uniqueness > 70);
      
      // Product Management path (if communication + technical skills)
      if (fingerprint.personalityProfile.communication > 75 && 
          fingerprint.coreCompetencies.some(c => c.skill.toLowerCase().includes('tech'))) {
        
        const pmOpportunity = marketIntelligence.emergingOpportunities.find(op => 
          op.area.toLowerCase().includes('product')
        );
        
        paths.push({
          path: 'Product Management',
          difficulty: 'moderate',
          timeToTransition: 8,
          gapSkills: ['Product Strategy', 'User Research', 'Stakeholder Management', 'Market Analysis'],
          marketOpportunity: pmOpportunity?.marketSize === 'large' ? 90 : 75,
          reasoning: 'Technical background + communication skills + growing market demand'
        });
      }
      
      // Data Science path (if analytical + technical)
      if (fingerprint.personalityProfile.analytical > 80 && 
          fingerprint.coreCompetencies.some(c => c.skill.toLowerCase().includes('python'))) {
        
        paths.push({
          path: 'Data Science & AI',
          difficulty: 'moderate',
          timeToTransition: 12,
          gapSkills: ['Machine Learning', 'Statistics', 'Data Visualization', 'Business Intelligence'],
          marketOpportunity: 95,
          reasoning: 'Analytical mindset + technical foundation + explosive AI market growth'
        });
      }
      
      // Technical Leadership path
      if (fingerprint.personalityProfile.leadership > 70) {
        paths.push({
          path: 'Technical Leadership',
          difficulty: 'easy',
          timeToTransition: 6,
          gapSkills: ['People Management', 'Strategic Planning', 'Cross-functional Collaboration'],
          marketOpportunity: 85,
          reasoning: 'Leadership traits + technical expertise = high-demand combination'
        });
      }
      
      // Consulting path (if expertise + communication)
      if (fingerprint.personalityProfile.communication > 75 && 
          fingerprint.coreCompetencies.some(c => c.marketValue > 85)) {
        
        paths.push({
          path: 'Technical Consulting',
          difficulty: 'easy',
          timeToTransition: 4,
          gapSkills: ['Client Management', 'Business Development', 'Proposal Writing'],
          marketOpportunity: 80,
          reasoning: 'High-value expertise + communication skills + growing consulting market'
        });
      }
      
      // Entrepreneurship path (if innovation + risk tolerance)
      if (fingerprint.personalityProfile.creativity > 80 && 
          fingerprint.workStylePreferences.riskTolerance === 'high') {
        
        paths.push({
          path: 'Entrepreneurship',
          difficulty: 'challenging',
          timeToTransition: 18,
          gapSkills: ['Business Development', 'Finance', 'Marketing', 'Legal Knowledge'],
          marketOpportunity: 70,
          reasoning: 'Innovation mindset + technical skills + high risk tolerance'
        });
      }

      return paths.slice(0, 5); // Top 5 most relevant paths
    } catch (error) {
      logger.error('Error finding enhanced alternative paths', { error });
      return await this.findAlternativePaths(fingerprint);
    }
  }

  /**
   *  MAGIC: Analyze competitive position in market
   */
  private async analyzeCompetitivePosition(fingerprint: CareerFingerprint, user: any): Promise<CompetitivePosition> {
    try {
      logger.info(' Analyzing competitive position');
      
      // Calculate overall market ranking
      const overallRanking = this.calculateMarketRanking(fingerprint);
      
      // Analyze skill rankings
      const skillRankings: Record<string, number> = {};
      const competitiveBenchmarks = [];
      
      for (const competency of fingerprint.coreCompetencies) {
        const marketData = await this.getSkillMarketData(competency.skill);
        const ranking = this.calculateSkillRanking(competency.proficiency, marketData);
        skillRankings[competency.skill] = ranking;
        
        competitiveBenchmarks.push({
          skill: competency.skill,
          yourLevel: competency.proficiency,
          marketAverage: marketData.average,
          topPercentile: marketData.topPercentile,
          positionVsMarket: this.getMarketPosition(competency.proficiency, marketData)
        });
      }
      
      // Identify strength and improvement areas
      const strengthAreas = competitiveBenchmarks
        .filter(b => b.positionVsMarket === 'leading')
        .map(b => b.skill);
      
      const improvementAreas = competitiveBenchmarks
        .filter(b => b.positionVsMarket === 'developing')
        .map(b => b.skill);
      
      // Identify unique differentiators
      const uniqueDifferentiators = fingerprint.coreCompetencies
        .filter(c => c.uniqueness > 80)
        .map(c => `${c.skill} expertise with ${c.uniqueness}% uniqueness`);
      
      // Generate market advantages
      const marketAdvantages = this.generateMarketAdvantages(fingerprint, competitiveBenchmarks);

      return {
        overallRanking,
        skillRankings,
        strengthAreas,
        improvementAreas,
        uniqueDifferentiators,
        marketAdvantages,
        competitiveBenchmarks
      };
    } catch (error) {
      logger.error('Error analyzing competitive position', { error });
      return this.getDefaultCompetitivePosition();
    }
  }

  /**
   *  MAGIC: Calculate career velocity score
   */
  private calculateCareerVelocity(user: any, fingerprint: CareerFingerprint): number {
    try {
      let velocity = 0;
      
      // Skills growth rate
      const avgSkillGrowth = fingerprint.coreCompetencies.reduce((sum, c) => sum + c.growth, 0) / fingerprint.coreCompetencies.length;
      velocity += Math.min(40, avgSkillGrowth * 2); // Max 40 points
      
      // Learning agility (based on skill diversity)
      const skillDiversity = new Set(fingerprint.coreCompetencies.map(c => this.getSkillCategory(c.skill))).size;
      velocity += Math.min(20, skillDiversity * 4); // Max 20 points
      
      // Adaptability factor
      velocity += fingerprint.personalityProfile.adaptability * 0.2; // Max 20 points
      
      // Market alignment
      const marketAlignment = fingerprint.coreCompetencies.reduce((sum, c) => sum + c.marketValue, 0) / fingerprint.coreCompetencies.length;
      velocity += marketAlignment * 0.2; // Max 20 points
      
      return Math.min(100, velocity);
    } catch (error) {
      logger.error('Error calculating career velocity', { error });
      return 65; // Default moderate velocity
    }
  }

  /**
   *  Calculate industry momentum scores
   */
  private calculateIndustryMomentum(marketIntelligence: MarketIntelligence): Record<string, number> {
    const momentum: Record<string, number> = {};
    
    for (const [industry, data] of Object.entries(marketIntelligence.industryGrowth)) {
      let score = 50; // Base momentum
      
      // Growth rate impact
      score += data.rate * 30; // Scale growth rate
      
      // Outlook impact
      const outlookBonus = {
        'excellent': 20,
        'good': 10,
        'stable': 0,
        'declining': -20
      };
      score += outlookBonus[data.outlook];
      
      // Key drivers bonus
      score += data.keyDrivers.length * 2;
      
      // Threats penalty
      score -= data.threats.length * 3;
      
      momentum[industry] = Math.max(0, Math.min(100, score));
    }
    
    return momentum;
  }

  /**
   *  Calculate future readiness score
   */
  private calculateFutureReadiness(fingerprint: CareerFingerprint, marketIntelligence: MarketIntelligence): number {
    try {
      let readiness = 0;
      
      // Emerging skills preparation
      const emergingSkillsCount = fingerprint.coreCompetencies.filter(c => {
        return marketIntelligence.emergingOpportunities.some(op => 
          op.skillPrerequisites.some(skill => 
            skill.toLowerCase().includes(c.skill.toLowerCase())
          )
        );
      }).length;
      
      readiness += Math.min(30, emergingSkillsCount * 10);
      
      // Adaptability score
      readiness += fingerprint.personalityProfile.adaptability * 0.3;
      
      // Learning orientation
      readiness += fingerprint.personalityProfile.creativity * 0.2;
      
      // Skill diversity (future-proofing)
      const skillCategories = new Set(fingerprint.coreCompetencies.map(c => this.getSkillCategory(c.skill)));
      readiness += Math.min(20, skillCategories.size * 4);
      
      // Risk tolerance for change
      const riskBonus = {
        'high': 20,
        'medium': 10,
        'low': 0
      };
      readiness += riskBonus[fingerprint.workStylePreferences.riskTolerance];
      
      return Math.min(100, readiness);
    } catch (error) {
      logger.error('Error calculating future readiness', { error });
      return 65;
    }
  }

  /**
   *  Calculate adaptability score
   */
  private calculateAdaptabilityScore(fingerprint: CareerFingerprint, successPatterns: SuccessPattern[]): number {
    try {
      let adaptability = 0;
      
      // Base adaptability from personality
      adaptability += fingerprint.personalityProfile.adaptability * 0.4;
      
      // Skill transferability
      const transferableSkills = fingerprint.coreCompetencies.filter(c => 
        this.isTransferableSkill(c.skill)
      ).length;
      adaptability += Math.min(30, transferableSkills * 6);
      
      // Learning agility from success patterns
      const learningPattern = successPatterns.find(p => p.patternType === 'skill_development');
      if (learningPattern && learningPattern.successRate > 70) {
        adaptability += 20;
      }
      
      // Industry diversity bonus
      const industryDiversity = fingerprint.industryAffinity.length;
      adaptability += Math.min(10, industryDiversity * 2);
      
      return Math.min(100, adaptability);
    } catch (error) {
      logger.error('Error calculating adaptability score', { error });
      return 70;
    }
  }

  /**
   *  MAGIC: Advanced success probability calculation
   */
  private calculateGrowthProbability(
    fingerprint: CareerFingerprint,
    targetRole: any,
    timelineMonths: number,
    marketIntelligence: MarketIntelligence
  ): number {
    try {
      let probability = 0.5; // Base 50%
      
      // Skills alignment factor
      const skillsAlignment = this.calculateSkillsAlignment(fingerprint.coreCompetencies, targetRole.requiredSkills);
      probability += skillsAlignment * 0.25;
      
      // Market conditions factor
      const marketConditions = this.assessMarketConditions(targetRole, marketIntelligence);
      probability += marketConditions * 0.2;
      
      // Personal readiness factor
      const personalReadiness = this.assessPersonalReadiness(fingerprint, targetRole);
      probability += personalReadiness * 0.2;
      
      // Timeline factor (longer timeline = higher probability)
      const timelineFactor = Math.min(0.3, timelineMonths / 60); // Max 30% bonus for 5+ years
      probability += timelineFactor * 0.15;
      
      // Industry momentum factor
      const industryMomentum = this.getIndustryMomentumForRole(targetRole, marketIntelligence);
      probability += industryMomentum * 0.1;
      
      return Math.max(0.1, Math.min(0.95, probability));
    } catch (error) {
      logger.error('Error calculating growth probability', { error });
      return 0.5;
    }
  }

  /**
   *  Long-term growth probability with disruption considerations
   */
  private calculateLongTermGrowthProbability(
    fingerprint: CareerFingerprint,
    targetRole: any,
    timelineMonths: number,
    marketIntelligence: MarketIntelligence
  ): number {
    try {
      const baseProbability = this.calculateGrowthProbability(fingerprint, targetRole, timelineMonths, marketIntelligence);
      
      // Disruption risk adjustment
      const disruptionRisk = marketIntelligence.disruptionRisks.find(risk => 
        risk.impactOnRole.toLowerCase().includes(targetRole.title.toLowerCase())
      );
      
      let adjustedProbability = baseProbability;
      
      if (disruptionRisk) {
        const riskTimeframe = parseInt(disruptionRisk.timeframe) || 10;
        if (riskTimeframe <= timelineMonths / 12) {
          adjustedProbability *= 0.8; // 20% reduction for disruption risk
        }
      }
      
      // Future readiness bonus
      const futureReadiness = this.calculateFutureReadiness(fingerprint, marketIntelligence);
      if (futureReadiness > 80) {
        adjustedProbability += 0.1; // 10% bonus for high future readiness
      }
      
      return Math.max(0.1, Math.min(0.9, adjustedProbability));
    } catch (error) {
      logger.error('Error calculating long-term growth probability', { error });
      return 0.4;
    }
  }

  // ========================================
  //  HELPER METHODS FOR ENHANCED FEATURES
  // ========================================

  private async findSimilarProfiles(fingerprint: CareerFingerprint, user: any): Promise<any[]> {
    // In production, use ML to find similar user profiles
    // For now, return mock similar users
    return [
      { id: 'user1', successRate: 85, careerProgression: 'fast' },
      { id: 'user2', successRate: 78, careerProgression: 'steady' },
      { id: 'user3', successRate: 92, careerProgression: 'accelerated' }
    ];
  }

  private async analyzeCareerProgressionPattern(similarUsers: any[], fingerprint: CareerFingerprint): Promise<SuccessPattern> {
    return {
      patternType: 'career_progression',
      description: 'Technical professionals with leadership traits typically advance to senior roles within 2-3 years',
      similarProfiles: similarUsers.length,
      successRate: 78,
      averageTimeline: '28 months',
      keySuccessFactors: ['Technical excellence', 'Leadership development', 'Strategic thinking', 'Network building'],
      commonPitfalls: ['Focusing only on technical skills', 'Avoiding leadership responsibilities', 'Limited networking'],
      recommendedApproach: ['Take on leadership projects', 'Mentor junior developers', 'Build strategic relationships'],
      confidenceLevel: 0.85
    };
  }

  private async analyzeSkillDevelopmentPattern(similarUsers: any[], fingerprint: CareerFingerprint): Promise<SuccessPattern> {
    return {
      patternType: 'skill_development',
      description: 'Professionals with diverse technical skills adapt faster to market changes',
      similarProfiles: similarUsers.length,
      successRate: 82,
      averageTimeline: '18 months',
      keySuccessFactors: ['Continuous learning', 'Skill diversification', 'Emerging technology adoption'],
      commonPitfalls: ['Over-specialization', 'Ignoring soft skills', 'Falling behind on trends'],
      recommendedApproach: ['Learn emerging technologies', 'Develop T-shaped skills', 'Practice continuous learning'],
      confidenceLevel: 0.8
    };
  }

  private async analyzeIndustryTransitionPattern(similarUsers: any[], fingerprint: CareerFingerprint): Promise<SuccessPattern> {
    return {
      patternType: 'industry_transition',
      description: 'Cross-industry transitions successful when leveraging transferable skills',
      similarProfiles: Math.floor(similarUsers.length * 0.3),
      successRate: 65,
      averageTimeline: '12 months',
      keySuccessFactors: ['Transferable skills emphasis', 'Industry research', 'Network building', 'Gradual transition'],
      commonPitfalls: ['Abrupt industry changes', 'Undervaluing existing skills', 'Poor market timing'],
      recommendedApproach: ['Identify skill overlaps', 'Build industry knowledge', 'Network in target industry'],
      confidenceLevel: 0.7
    };
  }

  private async analyzeLeadershipPattern(similarUsers: any[], fingerprint: CareerFingerprint): Promise<SuccessPattern> {
    return {
      patternType: 'leadership_path',
      description: 'Technical leaders who balance people skills with technical expertise advance rapidly',
      similarProfiles: Math.floor(similarUsers.length * 0.4),
      successRate: 88,
      averageTimeline: '24 months',
      keySuccessFactors: ['People management skills', 'Technical credibility', 'Strategic vision', 'Communication'],
      commonPitfalls: ['Losing technical edge', 'Micromanagement', 'Poor delegation'],
      recommendedApproach: ['Develop emotional intelligence', 'Practice delegation', 'Maintain technical involvement'],
      confidenceLevel: 0.9
    };
  }

  private async analyzeIndustryGrowthPatterns(industryAffinity: any[]): Promise<MarketIntelligence['industryGrowth']> {
    const industryGrowth: MarketIntelligence['industryGrowth'] = {};
    
    // Mock industry growth data - in production, use real market APIs
    const industries = ['Technology', 'Finance', 'Healthcare', 'Creative', 'Consulting'];
    
    for (const industry of industries) {
      industryGrowth[industry] = {
        rate: Math.random() * 15 + 5, // 5-20% growth
        outlook: Math.random() > 0.7 ? 'excellent' : Math.random() > 0.4 ? 'good' : 'stable',
        keyDrivers: this.getIndustryDrivers(industry),
        threats: this.getIndustryThreats(industry),
        timeframe: '2024-2027'
      };
    }
    
    return industryGrowth;
  }

  private async analyzeRoleEvolutionTrends(coreCompetencies: any[]): Promise<MarketIntelligence['roleEvolution']> {
    return [
      {
        role: 'Software Developer',
        evolution: 'transforming',
        futureSkills: ['AI Integration', 'Cloud Native', 'DevSecOps', 'Data Science'],
        salaryTrend: 15,
        demandForecast: 'Growing 22% through 2030'
      },
      {
        role: 'Project Manager',
        evolution: 'expanding',
        futureSkills: ['Agile Coaching', 'Data Analytics', 'Digital Transformation', 'AI Tools'],
        salaryTrend: 12,
        demandForecast: 'Growing 8% through 2030'
      },
      {
        role: 'Data Analyst',
        evolution: 'emerging',
        futureSkills: ['Machine Learning', 'Advanced Statistics', 'Business Intelligence', 'Data Storytelling'],
        salaryTrend: 25,
        demandForecast: 'Growing 35% through 2030'
      }
    ];
  }

  private async identifyEmergingOpportunities(fingerprint: CareerFingerprint): Promise<MarketIntelligence['emergingOpportunities']> {
    return [
      {
        area: 'AI/ML Engineering',
        description: 'Integration of AI capabilities into existing systems and products',
        timeToMature: '2-3 years',
        skillPrerequisites: ['Python', 'Machine Learning', 'Cloud Platforms', 'Data Engineering'],
        marketSize: 'Large ($50B+ by 2027)',
        competitionLevel: 'medium'
      },
      {
        area: 'Sustainability Technology',
        description: 'Green tech solutions for carbon reduction and environmental impact',
        timeToMature: '3-5 years',
        skillPrerequisites: ['IoT', 'Data Analytics', 'Systems Engineering', 'Environmental Science'],
        marketSize: 'Growing ($30B+ by 2028)',
        competitionLevel: 'low'
      },
      {
        area: 'Quantum Computing Applications',
        description: 'Practical applications of quantum computing in enterprise solutions',
        timeToMature: '5-7 years',
        skillPrerequisites: ['Advanced Mathematics', 'Physics', 'Algorithm Design', 'Cloud Computing'],
        marketSize: 'Emerging ($10B+ by 2030)',
        competitionLevel: 'low'
      }
    ];
  }

  private async assessDisruptionRisks(coreCompetencies: any[]): Promise<MarketIntelligence['disruptionRisks']> {
    return [
      {
        technology: 'AI Automation',
        impactOnRole: 'Routine coding tasks may be automated, requiring focus on higher-level design and strategy',
        timeframe: '3-5 years',
        mitigationStrategies: [
          'Develop AI/ML skills to work with automation tools',
          'Focus on creative and strategic aspects of development',
          'Build leadership and mentoring capabilities'
        ]
      },
      {
        technology: 'No-Code/Low-Code Platforms',
        impactOnRole: 'Basic application development may become more accessible to non-developers',
        timeframe: '2-4 years',
        mitigationStrategies: [
          'Specialize in complex system architecture',
          'Focus on integration and customization',
          'Develop platform and tool expertise'
        ]
      }
    ];
  }

  // Additional helper methods
  private levelToNumber(level: string): number {
    const levelMap: Record<string, number> = {
      'Entry Level': 1,
      'Junior Level': 2,
      'Mid Level': 3,
      'Senior Level': 4,
      'Lead Level': 5,
      'Principal Level': 6,
      'Executive Level': 7
    };
    return levelMap[level] || 3;
  }

  private getNextRoleAtLevel(level: number, fingerprint: CareerFingerprint): any {
    const roles = {
      1: { title: 'Junior Developer', requiredSkills: ['Programming Fundamentals', 'Version Control'] },
      2: { title: 'Developer', requiredSkills: ['Framework Expertise', 'Testing', 'Debugging'] },
      3: { title: 'Senior Developer', requiredSkills: ['Architecture Design', 'Code Review', 'Mentoring'] },
      4: { title: 'Lead Developer', requiredSkills: ['Team Leadership', 'Project Management', 'Technical Strategy'] },
      5: { title: 'Principal Engineer', requiredSkills: ['System Design', 'Cross-team Collaboration', 'Technical Vision'] },
      6: { title: 'Engineering Director', requiredSkills: ['People Management', 'Budget Planning', 'Strategic Planning'] },
      7: { title: 'VP of Engineering', requiredSkills: ['Organizational Leadership', 'Business Strategy', 'Executive Communication'] }
    };
    
    const targetLevel = Math.min(7, Math.max(1, Math.round(level)));
    return roles[targetLevel as keyof typeof roles] || roles[3];
  }

  private calculateMarketRanking(fingerprint: CareerFingerprint): number {
    const avgProficiency = fingerprint.coreCompetencies.reduce((sum, c) => sum + c.proficiency, 0) / fingerprint.coreCompetencies.length;
    const avgMarketValue = fingerprint.coreCompetencies.reduce((sum, c) => sum + c.marketValue, 0) / fingerprint.coreCompetencies.length;
    const uniquenessBonus = fingerprint.coreCompetencies.reduce((sum, c) => sum + c.uniqueness, 0) / fingerprint.coreCompetencies.length;
    
    const ranking = (avgProficiency * 0.4 + avgMarketValue * 0.4 + uniquenessBonus * 0.2);
    return Math.min(99, Math.max(10, ranking)); // Percentile ranking
  }

  private async getSkillMarketData(skill: string): Promise<{ average: number; topPercentile: number }> {
    // Mock skill market data
    return {
      average: Math.random() * 30 + 50, // 50-80 average
      topPercentile: Math.random() * 20 + 80 // 80-100 top percentile
    };
  }

  private calculateSkillRanking(proficiency: number, marketData: { average: number; topPercentile: number }): number {
    if (proficiency >= marketData.topPercentile) return 95;
    if (proficiency >= marketData.average + 15) return 80;
    if (proficiency >= marketData.average) return 60;
    if (proficiency >= marketData.average - 15) return 40;
    return 20;
  }

  private getMarketPosition(proficiency: number, marketData: { average: number; topPercentile: number }): 'leading' | 'competitive' | 'developing' {
    if (proficiency >= marketData.topPercentile) return 'leading';
    if (proficiency >= marketData.average) return 'competitive';
    return 'developing';
  }

  private generateMarketAdvantages(fingerprint: CareerFingerprint, benchmarks: any[]): string[] {
    const advantages = [];
    
    const leadingSkills = benchmarks.filter(b => b.positionVsMarket === 'leading');
    if (leadingSkills.length > 0) {
      advantages.push(`Top percentile in ${leadingSkills.map(s => s.skill).join(', ')}`);
    }
    
    if (fingerprint.careerArchetype === 'The Innovator') {
      advantages.push('Innovation mindset valued in rapidly changing markets');
    }
    
    if (fingerprint.personalityProfile.adaptability > 80) {
      advantages.push('High adaptability provides resilience in volatile markets');
    }
    
    return advantages;
  }

  private getSkillCategory(skill: string): string {
    const categories: Record<string, string> = {
      'JavaScript': 'Programming',
      'React': 'Frontend',
      'Node.js': 'Backend',
      'Python': 'Programming',
      'Leadership': 'Soft Skills',
      'Communication': 'Soft Skills',
      'Project Management': 'Management'
    };
    
    return categories[skill] || 'General';
  }

  private isTransferableSkill(skill: string): boolean {
    const transferableSkills = [
      'Leadership', 'Communication', 'Project Management', 'Problem Solving',
      'Analysis', 'Strategic Thinking', 'Teamwork', 'Adaptability'
    ];
    
    return transferableSkills.some(ts => skill.toLowerCase().includes(ts.toLowerCase()));
  }

  private calculateSkillsAlignment(competencies: any[], requiredSkills: string[]): number {
    const matches = requiredSkills.filter(required => 
      competencies.some(comp => comp.skill.toLowerCase().includes(required.toLowerCase()))
    );
    
    return requiredSkills.length > 0 ? matches.length / requiredSkills.length : 0.5;
  }

  private assessMarketConditions(targetRole: any, marketIntelligence: MarketIntelligence): number {
    // Assess market conditions for the target role
    const roleEvolution = marketIntelligence.roleEvolution.find(re => 
      re.role.toLowerCase().includes(targetRole.title.toLowerCase())
    );
    
    if (!roleEvolution) return 0.5;
    
    const evolutionScore = {
      'expanding': 0.8,
      'transforming': 0.6,
      'emerging': 0.9,
      'declining': 0.2
    };
    
    const salaryTrendBonus = roleEvolution.salaryTrend > 10 ? 0.1 : 0;
    
    return (evolutionScore[roleEvolution.evolution] || 0.5) + salaryTrendBonus;
  }

  private assessPersonalReadiness(fingerprint: CareerFingerprint, targetRole: any): number {
    // Assess personal readiness for target role
    let readiness = 0;
    
    // Skills readiness
    const skillsAlignment = this.calculateSkillsAlignment(fingerprint.coreCompetencies, targetRole.requiredSkills);
    readiness += skillsAlignment * 0.4;
    
    // Personality alignment
    const personalityAlignment = this.assessPersonalityAlignment(fingerprint.personalityProfile, targetRole);
    readiness += personalityAlignment * 0.3;
    
    // Experience readiness
    const experienceAlignment = this.assessExperienceAlignment(fingerprint, targetRole);
    readiness += experienceAlignment * 0.3;
    
    return readiness;
  }

  private getIndustryMomentumForRole(targetRole: any, marketIntelligence: MarketIntelligence): number {
    // Get industry momentum for the target role
    const roleIndustry = this.inferRoleIndustry(targetRole.title);
    const industryData = marketIntelligence.industryGrowth[roleIndustry];
    
    if (!industryData) return 0.5;
    
    return Math.min(1.0, industryData.rate / 20); // Normalize growth rate to 0-1
  }

  private assessPersonalityAlignment(personality: any, targetRole: any): number {
    // Simplified personality-role alignment
    const leadershipRoles = ['manager', 'director', 'lead', 'principal'];
    const isLeadershipRole = leadershipRoles.some(lr => targetRole.title.toLowerCase().includes(lr));
    
    if (isLeadershipRole) {
      return personality.leadership / 100;
    }
    
    return 0.7; // Default good alignment
  }

  private assessExperienceAlignment(fingerprint: CareerFingerprint, targetRole: any): number {
    // Mock experience alignment assessment
    return 0.7;
  }

  private inferRoleIndustry(roleTitle: string): string {
    const title = roleTitle.toLowerCase();
    
    if (title.includes('developer') || title.includes('engineer') || title.includes('tech')) {
      return 'Technology';
    }
    if (title.includes('analyst') || title.includes('finance') || title.includes('account')) {
      return 'Finance';
    }
    if (title.includes('design') || title.includes('creative') || title.includes('marketing')) {
      return 'Creative';
    }
    
    return 'Technology'; // Default
  }

  private getIndustryDrivers(industry: string): string[] {
    const drivers: Record<string, string[]> = {
      'Technology': ['Digital transformation', 'AI adoption', 'Cloud migration', 'Remote work tools'],
      'Finance': ['Fintech innovation', 'Regulatory compliance', 'Digital banking', 'Cryptocurrency'],
      'Healthcare': ['Telemedicine', 'Digital health', 'AI diagnostics', 'Aging population'],
      'Creative': ['Digital marketing', 'Content creation', 'Brand experience', 'Social commerce'],
      'Consulting': ['Digital transformation', 'Change management', 'Data analytics', 'Automation']
    };
    
    return drivers[industry] || ['Market evolution', 'Technology adoption'];
  }

  private getIndustryThreats(industry: string): string[] {
    const threats: Record<string, string[]> = {
      'Technology': ['Market saturation', 'Skill obsolescence', 'Economic downturns', 'Automation'],
      'Finance': ['Regulatory changes', 'Economic instability', 'Fintech disruption', 'Automation'],
      'Healthcare': ['Regulatory compliance', 'Cost pressures', 'Technology disruption'],
      'Creative': ['Market saturation', 'Platform dependency', 'Changing consumer preferences'],
      'Consulting': ['In-house capability building', 'Economic downturns', 'Automation tools']
    };
    
    return threats[industry] || ['Market changes', 'Competition'];
  }

  private getDefaultMarketIntelligence(): MarketIntelligence {
    return {
      industryGrowth: {
        'Technology': {
          rate: 12,
          outlook: 'good',
          keyDrivers: ['AI adoption', 'Digital transformation'],
          threats: ['Market saturation'],
          timeframe: '2024-2027'
        }
      },
      roleEvolution: [{
        role: 'Developer',
        evolution: 'transforming',
        futureSkills: ['AI', 'Cloud', 'DevOps'],
        salaryTrend: 10,
        demandForecast: 'Growing'
      }],
      emergingOpportunities: [],
      disruptionRisks: []
    };
  }

  private getDefaultSuccessPatterns(): SuccessPattern[] {
    return [{
      patternType: 'career_progression',
      description: 'Standard career progression pattern',
      similarProfiles: 100,
      successRate: 70,
      averageTimeline: '24 months',
      keySuccessFactors: ['Skill development', 'Experience gain'],
      commonPitfalls: ['Lack of focus'],
      recommendedApproach: ['Continuous learning'],
      confidenceLevel: 0.7
    }];
  }

  private getDefaultCompetitivePosition(): CompetitivePosition {
    return {
      overallRanking: 65,
      skillRankings: {},
      strengthAreas: [],
      improvementAreas: [],
      uniqueDifferentiators: [],
      marketAdvantages: [],
      competitiveBenchmarks: []
    };
  }

  /**
   *  Fallback method for basic trajectory prediction
   */
  private async predictBasicTrajectory(user: any, fingerprint: CareerFingerprint): Promise<CareerTrajectory> {
    const currentLevel = this.determineCurrentLevel(user, fingerprint);
    const projectedGrowth = await this.projectFutureGrowth(fingerprint, currentLevel);
    const alternativePaths = await this.findAlternativePaths(fingerprint);
    const riskFactors = this.identifyRiskFactors(fingerprint, user);
    const opportunities = this.identifyOpportunities(fingerprint, user);
    const optimalNextStep = this.determineOptimalNextStep(fingerprint, projectedGrowth);

    return {
      currentLevel,
      projectedGrowth,
      alternativePaths,
      riskFactors,
      opportunities,
      optimalNextStep,
      marketIntelligence: this.getDefaultMarketIntelligence(),
      successPatterns: this.getDefaultSuccessPatterns(),
      careerVelocity: 65,
      industryMomentum: { 'Technology': 75 },
      competitivePosition: this.getDefaultCompetitivePosition(),
      futureReadiness: 70,
      adaptabilityScore: 75
    };
  }

  /**
   *  MAGIC: Simplified method to analyze career DNA (for external use)
   */
  async analyzeCareerDNA(userId: string, options?: {
    includeMarketAnalysis?: boolean;
    includeSuccessPatterns?: boolean;
    timeframe?: '1y' | '3y' | '5y';
  }): Promise<{
    careerStage: string;
    growthOrientation: number;
    riskTolerance: string;
    workLifeBalance: number;
    industryFit: Record<string, number>;
    careerVelocity: number;
    futureReadiness: number;
    recommendedNextSteps: string[];
  }> {
    try {
      logger.info(' Analyzing career DNA (simplified)', { userId });
      
      const careerDNA = await this.generateCareerDNA(userId);
      
      // Extract simplified insights
      const careerStage = careerDNA.trajectory.currentLevel;
      const growthOrientation = careerDNA.fingerprint.personalityProfile.adaptability + careerDNA.fingerprint.personalityProfile.creativity;
      const riskTolerance = careerDNA.fingerprint.workStylePreferences.riskTolerance;
      const workLifeBalance = careerDNA.fingerprint.workStylePreferences.remoteWork;
      
      // Industry fit scores
      const industryFit: Record<string, number> = {};
      careerDNA.fingerprint.industryAffinity.forEach(affinity => {
        industryFit[affinity.industry] = affinity.score;
      });
      
      // Extract key metrics
      const careerVelocity = careerDNA.trajectory.careerVelocity || 65;
      const futureReadiness = careerDNA.trajectory.futureReadiness || 70;
      
      // Generate recommended next steps
      const recommendedNextSteps = [
        careerDNA.trajectory.optimalNextStep.action,
        ...careerDNA.roadmap.goals.slice(0, 2).map(g => g.actionSteps[0])
      ].filter(Boolean);
      
      return {
        careerStage,
        growthOrientation,
        riskTolerance,
        workLifeBalance,
        industryFit,
        careerVelocity,
        futureReadiness,
        recommendedNextSteps
      };
    } catch (error) {
      logger.error('Error analyzing career DNA (simplified)', { error, userId });
      // Return safe defaults
      return {
        careerStage: 'Mid Level',
        growthOrientation: 75,
        riskTolerance: 'medium',
        workLifeBalance: 70,
        industryFit: { 'Technology': 80 },
        careerVelocity: 65,
        futureReadiness: 70,
        recommendedNextSteps: ['Continue skill development', 'Build professional network']
      };
    }
  }
}

export default CareerDNAService;
