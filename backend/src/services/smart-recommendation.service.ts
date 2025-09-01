import { prisma } from '../config/database.js';
import { cache } from '../config/redis.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { AIMatchingService } from './ai-matching.service.js';
import { CVAnalysisService } from './cv-analysis.service.js';
import { CareerDNAService } from './career-dna.service.js';
import { HuggingFaceService } from './huggingface.service.js';
import { Job, User, Application, SavedJob } from '@prisma/client';

// Types and Interfaces
interface SmartRecommendation {
  job: Job & { company: any };
  score: number; // 0-100
  reasoning: RecommendationReasoning;
  confidence: number; // 0-100
  personalizedInsights: PersonalizedInsights;
  applicationStrategy: ApplicationStrategy;
  timing: RecommendationTiming;
  competitiveAnalysis: CompetitiveAnalysis;
  successPrediction: SuccessPrediction;
  aiExplanation: string;
  magicInsights: MagicInsights;
}

interface RecommendationReasoning {
  primaryFactors: string[];
  skillAlignment: {
    matches: string[];
    gaps: string[];
    strength: number; // 0-100
  };
  experienceAlignment: {
    levelMatch: boolean;
    industryRelevance: number;
    roleProgression: string;
  };
  personalityFit: {
    score: number;
    alignment: string[];
    concerns: string[];
  };
  marketFactors: {
    demandLevel: 'low' | 'medium' | 'high' | 'very_high';
    competitionLevel: 'low' | 'medium' | 'high';
    salaryCompetitiveness: number;
  };
  uniqueFactors: string[];
}

interface PersonalizedInsights {
  whyPerfectFit: string;
  potentialChallenges: string[];
  growthOpportunities: string[];
  learningPotential: string;
  careerImpact: string;
  networkingValue: string;
  personalizedTips: string[];
}

interface ApplicationStrategy {
  approachType: 'immediate' | 'prepare_first' | 'skill_up_first' | 'wait_for_better_match';
  keyMessages: string[];
  strengthsToHighlight: string[];
  coverLetterTone: 'professional' | 'conversational' | 'creative' | 'executive';
  applicationTiming: {
    optimal: boolean;
    bestTimeToApply: string;
    reasoning: string;
  };
  followUpStrategy: string[];
}

interface RecommendationTiming {
  urgency: 'low' | 'medium' | 'high' | 'critical';
  optimalApplicationTime: Date;
  applicationDeadline?: Date;
  marketWindow: {
    current: 'opening' | 'peak' | 'closing';
    duration: string;
    nextOpportunity?: string;
  };
  userReadiness: number; // 0-100
}

interface CompetitiveAnalysis {
  estimatedApplicants: number;
  userCompetitivePosition: number; // 0-100 (percentile)
  keyDifferentiators: string[];
  competitiveAdvantages: string[];
  competitiveWeaknesses: string[];
  marketPosition: 'underdog' | 'competitive' | 'strong' | 'ideal';
}

interface SuccessPrediction {
  applicationSuccessRate: number; // 0-100
  interviewSuccessRate: number; // 0-100
  offerSuccessRate: number; // 0-100
  overallSuccessRate: number; // 0-100
  factorsInfluencing: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  benchmarkComparison: string;
}

interface MagicInsights {
  oneLinePitch: string;
  standoutQualities: string[];
  hiddenConnectionsToRole: string[];
  unexpectedStrengths: string[];
  futureCareerAlignment: string;
  personalGrowthPotential: string;
  networkingOpportunities: string[];
}

interface UserBehaviorProfile {
  userId: string;
  preferences: {
    jobTypes: string[];
    industries: string[];
    locations: string[];
    salaryRanges: { min: number; max: number }[];
    companySize: string[];
    workStyle: string[];
  };
  applicationPatterns: {
    averageApplicationsPerWeek: number;
    preferredApplicationDays: string[];
    preferredApplicationTimes: string[];
    applicationSuccessRate: number;
    followUpBehavior: string;
  };
  searchBehavior: {
    commonKeywords: string[];
    searchFrequency: number;
    filterPreferences: Record<string, any>;
    browsingingPatterns: string[];
  };
  engagementMetrics: {
    profileViews: number;
    jobViewToApplicationRatio: number;
    saveToApplicationRatio: number;
    averageTimeOnJobPostings: number;
  };
  learningProfile: {
    skillDevelopmentRate: number;
    learningPreferences: string[];
    assessmentResults: Record<string, number>;
    growthAreas: string[];
  };
  lastUpdated: Date;
}

interface RecommendationMLModel {
  version: string;
  features: string[];
  weights: Record<string, number>;
  accuracy: number;
  lastTrained: Date;
  trainingDataSize: number;
  biasMetrics: Record<string, number>;
}

interface LearningFeedback {
  recommendationId: string;
  userId: string;
  jobId: string;
  userAction: 'viewed' | 'saved' | 'applied' | 'dismissed' | 'not_interested';
  explicit_feedback?: {
    rating: number; // 1-5
    reasoning: string[];
    improvements: string[];
  };
  implicitSignals: {
    timeSpentViewing: number;
    scrollDepth: number;
    clicksOnJobDetails: number;
    returnVisits: number;
  };
  outcome?: {
    applicationResult: string;
    interviewResult?: string;
    finalOutcome?: string;
    satisfactionScore?: number;
  };
  timestamp: Date;
}

export class SmartRecommendationService {
  private aiMatchingService: AIMatchingService;
  private cvAnalysisService: CVAnalysisService;
  private careerDNAService: CareerDNAService;
  private hfService: HuggingFaceService;
  
  private behaviorCache: Map<string, UserBehaviorProfile> = new Map();
  private modelCache: Map<string, RecommendationMLModel> = new Map();
  private cacheExpiry = 6 * 60 * 60 * 1000; // 6 hours
  
  private mlModel: RecommendationMLModel;
  private feedbackBuffer: LearningFeedback[] = [];
  private readonly FEEDBACK_BATCH_SIZE = 50;
  private readonly MODEL_RETRAIN_THRESHOLD = 1000; // Retrain after 1000 feedback points

  constructor() {
    this.aiMatchingService = new AIMatchingService();
    this.cvAnalysisService = new CVAnalysisService();
    this.careerDNAService = new CareerDNAService();
    this.hfService = HuggingFaceService.getInstance();
    
    this.initializeMLModel();
  }

  /**
   *  MAGIC: Get personalized job recommendations with ML
   */
  async getSmartRecommendations(
    userId: string,
    options: {
      limit?: number;
      excludeApplied?: boolean;
      includeLongTerm?: boolean;
      diversityFactor?: number; // 0-1, higher = more diverse recommendations
      riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
      careerStage?: 'exploration' | 'growth' | 'senior' | 'transition';
    } = {}
  ): Promise<SmartRecommendation[]> {
    try {
      logger.info(' Generating smart job recommendations', { userId, options });

      const {
        limit = 10,
        excludeApplied = true,
        includeLongTerm = false,
        diversityFactor = 0.3,
        riskTolerance = 'moderate',
        careerStage = 'growth'
      } = options;

      // Get or build user behavior profile
      const behaviorProfile = await this.getUserBehaviorProfile(userId);
      
      // Get user's career DNA
      const careerDNA = await this.careerDNAService.generateCareerDNA(userId);
      
      // Get candidate jobs with smart filtering
      const candidateJobs = await this.getCandidateJobs(
        userId, 
        behaviorProfile, 
        excludeApplied,
        limit * 3 // Get more to allow for filtering and ranking
      );

      if (candidateJobs.length === 0) {
        return [];
      }

      // Score jobs using ML model and multiple factors
      const scoredJobs = await Promise.all(
        candidateJobs.map(job => this.scoreJobForUser(
          job, 
          userId, 
          behaviorProfile, 
          careerDNA, 
          riskTolerance,
          careerStage
        ))
      );

      // Apply diversity and quality filters
      const diversifiedRecommendations = this.applyDiversityFilter(
        scoredJobs.filter(rec => rec.score > 60), // Minimum quality threshold
        diversityFactor
      );

      // Sort by score and limit results
      const finalRecommendations = diversifiedRecommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Record recommendations for learning
      await this.recordRecommendations(userId, finalRecommendations);

      logger.info(' Smart recommendations generated', { 
        userId, 
        candidateJobs: candidateJobs.length,
        finalRecommendations: finalRecommendations.length,
        avgScore: finalRecommendations.reduce((sum, rec) => sum + rec.score, 0) / finalRecommendations.length
      });

      return finalRecommendations;

    } catch (error) {
      logger.error('Failed to generate smart recommendations', { error, userId });
      throw new AppError(500, 'Failed to generate recommendations', 'RECOMMENDATION_ERROR');
    }
  }

  /**
   *  MAGIC: Learn from user feedback to improve recommendations
   */
  async recordUserFeedback(feedback: LearningFeedback): Promise<void> {
    try {
      logger.info(' Recording user feedback for learning', { 
        userId: feedback.userId,
        action: feedback.userAction 
      });

      // Add to feedback buffer
      this.feedbackBuffer.push(feedback);

      // Save to database for persistence
      await this.saveFeedbackToDatabase(feedback);

      // Process feedback batch if threshold reached
      if (this.feedbackBuffer.length >= this.FEEDBACK_BATCH_SIZE) {
        await this.processFeedbackBatch();
      }

      // Update user behavior profile
      await this.updateUserBehaviorProfile(feedback);

      // Check if model should be retrained
      await this.checkModelRetraining();

    } catch (error) {
      logger.error('Failed to record user feedback', { error, feedback });
    }
  }

  /**
   *  MAGIC: Predict job application success
   */
  async predictApplicationSuccess(
    userId: string, 
    jobId: string
  ): Promise<{
    overallPrediction: SuccessPrediction;
    stageBreakdown: {
      application: { probability: number; factors: string[] };
      interview: { probability: number; factors: string[] };
      offer: { probability: number; factors: string[] };
    };
    recommendations: string[];
    confidenceLevel: 'low' | 'medium' | 'high' | 'very_high';
    benchmarks: {
      similarUsers: number;
      similarJobs: number;
      industryAverage: number;
    };
  }> {
    try {
      logger.info(' Predicting application success', { userId, jobId });

      // Get user and job data
      const [user, job] = await Promise.all([
        this.getUserWithRelations(userId),
        this.getJobWithRelations(jobId)
      ]);

      if (!user || !job) {
        throw new AppError(404, 'User or job not found');
      }

      // Get user behavior profile and career DNA
      const [behaviorProfile, careerDNA] = await Promise.all([
        this.getUserBehaviorProfile(userId),
        this.careerDNAService.generateCareerDNA(userId)
      ]);

      // Calculate match scores
      const matchResults = await this.aiMatchingService.calculateJobMatches(userId, [jobId]);
      const matchResult = matchResults[0];

      if (!matchResult) {
        throw new AppError(500, 'Failed to calculate job match');
      }

      // Analyze historical success patterns
      const historicalData = await this.getHistoricalSuccessData(user, job);
      
      // Predict each stage
      const applicationPrediction = await this.predictApplicationStage(user, job, matchResult, historicalData);
      const interviewPrediction = await this.predictInterviewStage(user, job, matchResult, careerDNA);
      const offerPrediction = await this.predictOfferStage(user, job, matchResult, historicalData);

      // Calculate overall prediction
      const overallSuccessRate = 
        applicationPrediction.probability * 
        interviewPrediction.probability * 
        offerPrediction.probability;

      const overallPrediction: SuccessPrediction = {
        applicationSuccessRate: applicationPrediction.probability,
        interviewSuccessRate: interviewPrediction.probability,
        offerSuccessRate: offerPrediction.probability,
        overallSuccessRate,
        factorsInfluencing: {
          positive: [
            ...applicationPrediction.factors.filter(f => f.startsWith('+')),
            ...interviewPrediction.factors.filter(f => f.startsWith('+')),
            ...offerPrediction.factors.filter(f => f.startsWith('+'))
          ],
          negative: [
            ...applicationPrediction.factors.filter(f => f.startsWith('-')),
            ...interviewPrediction.factors.filter(f => f.startsWith('-')),
            ...offerPrediction.factors.filter(f => f.startsWith('-'))
          ],
          neutral: []
        },
        confidenceInterval: {
          lower: Math.max(0, overallSuccessRate - 0.15),
          upper: Math.min(1, overallSuccessRate + 0.15)
        },
        benchmarkComparison: this.generateBenchmarkComparison(overallSuccessRate, historicalData)
      };

      // Generate recommendations
      const recommendations = this.generateSuccessRecommendations(
        applicationPrediction,
        interviewPrediction,
        offerPrediction,
        matchResult
      );

      // Calculate confidence level
      const confidenceLevel = this.calculateConfidenceLevel(matchResult.successProbability, historicalData);

      // Get benchmarks
      const benchmarks = await this.getBenchmarks(user, job);

      return {
        overallPrediction,
        stageBreakdown: {
          application: applicationPrediction,
          interview: interviewPrediction,
          offer: offerPrediction
        },
        recommendations,
        confidenceLevel,
        benchmarks
      };

    } catch (error) {
      logger.error('Failed to predict application success', { error, userId, jobId });
      throw new AppError(500, 'Failed to predict success', 'PREDICTION_ERROR');
    }
  }

  /**
   *  MAGIC: Update recommendation preferences based on user feedback
   */
  async updateRecommendationPreferences(
    userId: string,
    preferences: {
      jobTypes?: string[];
      industries?: string[];
      locations?: string[];
      salaryRange?: { min: number; max: number };
      workStyle?: string[];
      careerGoals?: string[];
      excludeKeywords?: string[];
      priorityFactors?: string[];
    }
  ): Promise<void> {
    try {
      logger.info(' Updating recommendation preferences', { userId });

      // Get current behavior profile
      const behaviorProfile = await this.getUserBehaviorProfile(userId);

      // Update preferences
      if (preferences.jobTypes) {
        behaviorProfile.preferences.jobTypes = preferences.jobTypes;
      }
      if (preferences.industries) {
        behaviorProfile.preferences.industries = preferences.industries;
      }
      if (preferences.locations) {
        behaviorProfile.preferences.locations = preferences.locations;
      }
      if (preferences.salaryRange) {
        behaviorProfile.preferences.salaryRanges = [preferences.salaryRange];
      }

      // Save updated profile
      await this.saveUserBehaviorProfile(behaviorProfile);

      // Clear recommendation cache for user
      await this.clearUserRecommendationCache(userId);

      logger.info('Recommendation preferences updated', { userId });

    } catch (error) {
      logger.error('Failed to update recommendation preferences', { error, userId });
      throw new AppError(500, 'Failed to update preferences', 'PREFERENCE_UPDATE_ERROR');
    }
  }

  /**
   *  MAGIC: Get recommendation performance analytics
   */
  async getRecommendationAnalytics(userId: string, timeframe: string = '30d'): Promise<{
    performance: {
      totalRecommendations: number;
      viewedRecommendations: number;
      appliedRecommendations: number;
      successfulApplications: number;
      conversionRate: number;
    };
    accuracy: {
      predictionAccuracy: number;
      scoreCorrelation: number;
      userSatisfaction: number;
    };
    trends: {
      improvementRate: number;
      learningVelocity: number;
      adaptationScore: number;
    };
    insights: {
      bestPerformingFactors: string[];
      underperformingAreas: string[];
      recommendedAdjustments: string[];
    };
  }> {
    try {
      logger.info(' Getting recommendation analytics', { userId, timeframe });

      const timeframeDate = this.parseTimeframe(timeframe);
      
      // Get recommendation history
      const recommendations = await this.getRecommendationHistory(userId, timeframeDate);
      
      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(recommendations);
      
      // Calculate accuracy metrics
      const accuracy = await this.calculateAccuracyMetrics(userId, recommendations);
      
      // Calculate trends
      const trends = this.calculateTrendMetrics(recommendations);
      
      // Generate insights
      const insights = await this.generateAnalyticsInsights(performance, accuracy, trends);

      return {
        performance,
        accuracy,
        trends,
        insights
      };

    } catch (error) {
      logger.error('Failed to get recommendation analytics', { error, userId });
      throw new AppError(500, 'Failed to get analytics', 'ANALYTICS_ERROR');
    }
  }

  // Private helper methods

  private async initializeMLModel(): Promise<void> {
    // Initialize or load existing ML model
    this.mlModel = {
      version: '1.0.0',
      features: [
        'skills_match', 'experience_match', 'education_match', 'location_match',
        'salary_match', 'personality_match', 'cultural_fit', 'market_demand',
        'user_behavior_score', 'historical_success_rate', 'timing_score'
      ],
      weights: {
        'skills_match': 0.25,
        'experience_match': 0.20,
        'personality_match': 0.15,
        'cultural_fit': 0.10,
        'market_demand': 0.10,
        'user_behavior_score': 0.10,
        'historical_success_rate': 0.05,
        'timing_score': 0.05
      },
      accuracy: 0.78,
      lastTrained: new Date(),
      trainingDataSize: 0,
      biasMetrics: {}
    };
  }

  private async getUserBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
    // Check cache first
    const cached = this.behaviorCache.get(userId);
    if (cached && (Date.now() - cached.lastUpdated.getTime()) < this.cacheExpiry) {
      return cached;
    }

    // Build behavior profile from user data
    const profile = await this.buildBehaviorProfile(userId);
    
    // Cache the result
    this.behaviorCache.set(userId, profile);
    
    return profile;
  }

  private async buildBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
    // Get user data with all relations
    const user = await this.getUserWithRelations(userId);
    
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Analyze application patterns
    const applicationPatterns = this.analyzeApplicationPatterns(user.applications);
    
    // Analyze search and engagement behavior
    const searchBehavior = await this.analyzeSearchBehavior(userId);
    const engagementMetrics = await this.analyzeEngagementMetrics(userId);
    
    // Extract preferences from behavior
    const preferences = this.extractPreferencesFromBehavior(user, applicationPatterns);
    
    // Analyze learning profile
    const learningProfile = await this.analyzeLearningProfile(user);

    return {
      userId,
      preferences,
      applicationPatterns,
      searchBehavior,
      engagementMetrics,
      learningProfile,
      lastUpdated: new Date()
    };
  }

  private async scoreJobForUser(
    job: Job & { company: any },
    userId: string,
    behaviorProfile: UserBehaviorProfile,
    careerDNA: any,
    riskTolerance: string,
    careerStage: string
  ): Promise<SmartRecommendation> {
    // Get base AI matching score
    const matchResults = await this.aiMatchingService.calculateJobMatches(userId, [job.id]);
    const baseMatch = matchResults[0];

    // Calculate behavior-based adjustments
    const behaviorScore = this.calculateBehaviorScore(job, behaviorProfile);
    
    // Calculate career stage alignment
    const careerStageScore = this.calculateCareerStageAlignment(job, careerStage, careerDNA);
    
    // Calculate market timing score
    const timingScore = await this.calculateTimingScore(job, behaviorProfile);
    
    // Apply ML model
    const mlScore = this.applyMLModel({
      skillsMatch: baseMatch.skillsScore,
      experienceMatch: baseMatch.experienceScore,
      educationMatch: baseMatch.educationScore,
      locationMatch: baseMatch.locationScore,
      salaryMatch: baseMatch.salaryScore,
      personalityMatch: baseMatch.personalityScore,
      culturalFit: baseMatch.culturalFitScore,
      marketDemand: this.calculateMarketDemand(job),
      userBehaviorScore: behaviorScore,
      historicalSuccessRate: baseMatch.successProbability,
      timingScore: timingScore
    });

    // Generate comprehensive recommendation
    const reasoning = await this.generateRecommendationReasoning(job, baseMatch, behaviorProfile);
    const personalizedInsights = await this.generatePersonalizedInsights(job, careerDNA, baseMatch);
    const applicationStrategy = this.generateApplicationStrategy(job, baseMatch, behaviorProfile);
    const timing = this.generateRecommendationTiming(job, timingScore);
    const competitiveAnalysis = await this.generateCompetitiveAnalysis(job, userId, baseMatch);
    const successPrediction = this.generateSuccessPrediction(baseMatch, {} as any);
    const magicInsights = await this.generateMagicInsights(job, careerDNA, baseMatch);

    // Generate AI explanation
    const aiExplanation = await this.generateAIExplanation(job, mlScore, reasoning, magicInsights);

    return {
      job,
      score: Math.round(mlScore * 100) / 100,
      reasoning,
      confidence: this.calculateRecommendationConfidence(mlScore, baseMatch.successProbability),
      personalizedInsights,
      applicationStrategy,
      timing,
      competitiveAnalysis,
      successPrediction,
      aiExplanation,
      magicInsights
    };
  }

  private applyMLModel(features: Record<string, number>): number {
    let score = 0;
    
    for (const [feature, value] of Object.entries(features)) {
      const weight = this.mlModel.weights[feature] || 0;
      score += value * weight;
    }

    // Apply sigmoid function to normalize between 0 and 1
    return 1 / (1 + Math.exp(-score));
  }

  private calculateBehaviorScore(job: Job, behaviorProfile: UserBehaviorProfile): number {
    let score = 0;
    let factors = 0;

    // Job type preference
    if (behaviorProfile.preferences.jobTypes.includes(job.jobType)) {
      score += 0.2;
    }
    factors++;

    // Industry preference
    if (behaviorProfile.preferences.industries.includes(job.company.industry)) {
      score += 0.2;
    }
    factors++;

    // Location preference
    const locationMatch = behaviorProfile.preferences.locations.some(loc => 
      job.province.includes(loc) || job.city.includes(loc) || job.isRemote
    );
    if (locationMatch) {
      score += 0.15;
    }
    factors++;

    // Salary alignment
    const salaryInRange = behaviorProfile.preferences.salaryRanges.some(range =>
      (!job.salaryMin || job.salaryMin >= range.min) &&
      (!job.salaryMax || job.salaryMax <= range.max)
    );
    if (salaryInRange) {
      score += 0.15;
    }
    factors++;

    // Application pattern alignment
    if (behaviorProfile.applicationPatterns.applicationSuccessRate > 0.3) {
      score += 0.1; // Boost for users with good success rates
    }
    factors++;

    return score;
  }

  private calculateCareerStageAlignment(job: Job, careerStage: string, careerDNA: any): number {
    // Align job with user's career stage
    const stageAlignments: Record<string, any> = {
      'exploration': {
        experienceWeight: 0.2,
        learningWeight: 0.4,
        stabilityWeight: 0.1,
        growthWeight: 0.3
      },
      'growth': {
        experienceWeight: 0.3,
        learningWeight: 0.3,
        stabilityWeight: 0.2,
        growthWeight: 0.2
      },
      'senior': {
        experienceWeight: 0.4,
        learningWeight: 0.2,
        stabilityWeight: 0.3,
        growthWeight: 0.1
      },
      'transition': {
        experienceWeight: 0.2,
        learningWeight: 0.4,
        stabilityWeight: 0.1,
        growthWeight: 0.3
      }
    };

    const alignment = stageAlignments[careerStage] || stageAlignments['growth'];
    
    // Calculate alignment score based on job characteristics
    let score = 0;
    
    // Experience alignment
    const experienceAlignment = this.calculateExperienceAlignment(job, careerStage);
    score += experienceAlignment * alignment.experienceWeight;
    
    // Learning opportunity
    const learningOpportunity = this.calculateLearningOpportunity(job);
    score += learningOpportunity * alignment.learningWeight;
    
    // Job stability
    const stabilityScore = this.calculateJobStability(job);
    score += stabilityScore * alignment.stabilityWeight;
    
    // Growth potential
    const growthPotential = this.calculateGrowthPotential(job);
    score += growthPotential * alignment.growthWeight;

    return score;
  }

  private async calculateTimingScore(job: Job, behaviorProfile: UserBehaviorProfile): Promise<number> {
    // Calculate optimal timing for application based on multiple factors
    let score = 0.5; // Base score

    // Job posting freshness (apply early for better visibility)
    const daysSincePosted = Math.floor((Date.now() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSincePosted <= 3) score += 0.3;
    else if (daysSincePosted <= 7) score += 0.2;
    else if (daysSincePosted <= 14) score += 0.1;

    // Deadline urgency
    if (job.applicationDeadline) {
      const daysUntilDeadline = Math.floor((job.applicationDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline <= 3) score += 0.2; // Apply soon if deadline approaching
      else if (daysUntilDeadline <= 7) score += 0.1;
    }

    // User application pattern alignment
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const currentHour = new Date().getHours();
    
    if (behaviorProfile.applicationPatterns.preferredApplicationDays.includes(currentDay)) {
      score += 0.1;
    }
    
    const preferredHours = behaviorProfile.applicationPatterns.preferredApplicationTimes.map(time => parseInt(time));
    if (preferredHours.some(hour => Math.abs(hour - currentHour) <= 2)) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private applyDiversityFilter(
    recommendations: SmartRecommendation[], 
    diversityFactor: number
  ): SmartRecommendation[] {
    if (diversityFactor === 0) {
      return recommendations; // No diversity applied
    }

    const selected: SmartRecommendation[] = [];
    const usedIndustries = new Set<string>();
    const usedJobTypes = new Set<string>();
    const usedCompanies = new Set<string>();

    // Sort by score first
    const sorted = [...recommendations].sort((a, b) => b.score - a.score);

    for (const rec of sorted) {
      const industry = rec.job.company.industry;
      const jobType = rec.job.jobType;
      const company = rec.job.company.id;

      // Calculate diversity penalty
      let diversityPenalty = 0;
      if (usedIndustries.has(industry)) diversityPenalty += diversityFactor * 0.4;
      if (usedJobTypes.has(jobType)) diversityPenalty += diversityFactor * 0.3;
      if (usedCompanies.has(company)) diversityPenalty += diversityFactor * 0.3;

      // Apply penalty to score
      const adjustedScore = rec.score * (1 - diversityPenalty);

      if (adjustedScore > 60) { // Still meets minimum threshold
        selected.push(rec);
        usedIndustries.add(industry);
        usedJobTypes.add(jobType);
        usedCompanies.add(company);
      }
    }

    return selected;
  }

  private async processFeedbackBatch(): Promise<void> {
    try {
      logger.info(' Processing feedback batch for model improvement', { 
        batchSize: this.feedbackBuffer.length 
      });

      // Analyze feedback patterns
      const patterns = this.analyzeFeedbackPatterns(this.feedbackBuffer);
      
      // Update model weights based on feedback
      await this.updateModelWeights(patterns);
      
      // Clear processed feedback
      this.feedbackBuffer = [];

      logger.info('Feedback batch processed successfully');

    } catch (error) {
      logger.error('Failed to process feedback batch', { error });
    }
  }

  private analyzeFeedbackPatterns(feedback: LearningFeedback[]): any {
    // Analyze patterns in user feedback to improve model
    const patterns = {
      highScoreActions: feedback.filter(f => f.userAction === 'applied' || f.userAction === 'saved'),
      lowScoreActions: feedback.filter(f => f.userAction === 'dismissed' || f.userAction === 'not_interested'),
      viewOnlyActions: feedback.filter(f => f.userAction === 'viewed'),
      timeSpentCorrelations: feedback.map(f => ({
        score: f.implicitSignals.timeSpentViewing,
        action: f.userAction
      }))
    };

    return patterns;
  }

  private async updateModelWeights(patterns: any): Promise<void> {
    // Update ML model weights based on feedback patterns
    // This is a simplified implementation - in production, use proper ML training
    
    const totalFeedback = patterns.highScoreActions.length + patterns.lowScoreActions.length;
    if (totalFeedback === 0) return;

    const successRate = patterns.highScoreActions.length / totalFeedback;
    
    // Adjust weights based on success rate
    if (successRate < this.mlModel.accuracy) {
      // Model is underperforming, adjust weights
      Object.keys(this.mlModel.weights).forEach(key => {
        this.mlModel.weights[key] *= 0.95; // Slightly reduce all weights
      });
      
      // Boost user behavior and timing scores as they may be more predictive
      this.mlModel.weights['user_behavior_score'] *= 1.1;
      this.mlModel.weights['timing_score'] *= 1.1;
    }

    this.mlModel.accuracy = (this.mlModel.accuracy + successRate) / 2;
    this.mlModel.lastTrained = new Date();
  }

  private async checkModelRetraining(): Promise<void> {
    // Check if model should be retrained based on accumulated feedback
    const totalFeedback = await this.getTotalFeedbackCount();
    
    if (totalFeedback >= this.MODEL_RETRAIN_THRESHOLD) {
      await this.scheduleModelRetraining();
    }
  }

  private async scheduleModelRetraining(): Promise<void> {
    // Schedule ML model retraining
    logger.info(' Scheduling ML model retraining');
    
    // This would typically trigger a background job for model retraining
    // For now, we'll just log the event
  }

  // Stub implementations for helper methods
  private parseTimeframe(timeframe: string): Date {
    const now = new Date();
    const days = parseInt(timeframe.replace(/\D/g, '')) || 30;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  private async getCandidateJobs(userId: string, behaviorProfile: UserBehaviorProfile, excludeApplied: boolean, limit: number): Promise<(Job & { company: any })[]> {
    // Get candidate jobs based on user preferences and behavior
    const where: any = { active: true };
    
    if (excludeApplied) {
      const appliedJobIds = await this.getAppliedJobIds(userId);
      if (appliedJobIds.length > 0) {
        where.id = { notIn: appliedJobIds };
      }
    }

    // Apply preference filters
    if (behaviorProfile.preferences.jobTypes.length > 0) {
      where.jobType = { in: behaviorProfile.preferences.jobTypes };
    }

    return await prisma.job.findMany({
      where,
      include: { company: true },
      take: limit,
      orderBy: [
        { featured: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  private async getAppliedJobIds(userId: string): Promise<string[]> {
    const applications = await prisma.application.findMany({
      where: { userId },
      select: { jobId: true }
    });
    return applications.map(app => app.jobId);
  }

  private async getUserWithRelations(userId: string) {
    return await prisma.user.findUnique({
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
        },
        skills: {
          include: { skill: true }
        },
        experiences: true,
        educations: true,
        skillsAssessments: true
      }
    });
  }

  private async getJobWithRelations(jobId: string) {
    return await prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true }
    });
  }

  // Additional stub implementations for completeness
  private analyzeApplicationPatterns(applications: any[]): any { return {}; }
  private async analyzeSearchBehavior(userId: string): Promise<any> { return {}; }
  private async analyzeEngagementMetrics(userId: string): Promise<any> { return {}; }
  private extractPreferencesFromBehavior(user: any, patterns: any): any { return {}; }
  private async analyzeLearningProfile(user: any): Promise<any> { return {}; }
  private calculateMarketDemand(job: Job): number { return 0.7; }
  private calculateExperienceAlignment(job: Job, careerStage: string): number { return 0.7; }
  private calculateLearningOpportunity(job: Job): number { return 0.8; }
  private calculateJobStability(job: Job): number { return 0.8; }
  private calculateGrowthPotential(job: Job): number { return 0.7; }
  private async generateRecommendationReasoning(job: Job, match: any, profile: UserBehaviorProfile): Promise<RecommendationReasoning> { return {} as RecommendationReasoning; }
  private async generatePersonalizedInsights(job: Job, careerDNA: any, match: any): Promise<PersonalizedInsights> { return {} as PersonalizedInsights; }
  private generateApplicationStrategy(job: Job, match: any, profile: UserBehaviorProfile): ApplicationStrategy { return {} as ApplicationStrategy; }
  private generateRecommendationTiming(job: Job, timingScore: number): RecommendationTiming { return {} as RecommendationTiming; }
  private async generateCompetitiveAnalysis(job: Job, userId: string, match: any): Promise<CompetitiveAnalysis> { return {} as CompetitiveAnalysis; }
  private generateSuccessPrediction(match: any, historicalData: any): SuccessPrediction { return {} as SuccessPrediction; }
  private async generateMagicInsights(job: Job, careerDNA: any, match: any): Promise<MagicInsights> { return {} as MagicInsights; }
  private async generateAIExplanation(job: Job, score: number, reasoning: RecommendationReasoning, insights: MagicInsights): Promise<string> { return 'This job is recommended based on your profile and preferences.'; }
  private calculateRecommendationConfidence(score: number, successProbability: number): number { return 80; }
  private async recordRecommendations(userId: string, recommendations: SmartRecommendation[]): Promise<void> {}
  private async saveFeedbackToDatabase(feedback: LearningFeedback): Promise<void> {}
  private async updateUserBehaviorProfile(feedback: LearningFeedback): Promise<void> {}
  private async clearUserRecommendationCache(userId: string): Promise<void> {}
  private async saveUserBehaviorProfile(profile: UserBehaviorProfile): Promise<void> {}
  private async getRecommendationHistory(userId: string, since: Date): Promise<any[]> { return []; }
  private calculatePerformanceMetrics(recommendations: any[]): any { return {}; }
  private async calculateAccuracyMetrics(userId: string, recommendations: any[]): Promise<any> { return {}; }
  private calculateTrendMetrics(recommendations: any[]): any { return {}; }
  private async generateAnalyticsInsights(performance: any, accuracy: any, trends: any): Promise<any> { return {}; }
  private async getTotalFeedbackCount(): Promise<number> { return 0; }
  private async getHistoricalSuccessData(user: any, job: Job): Promise<any> { return {}; }
  private async predictApplicationStage(user: any, job: Job, match: any, historical: any): Promise<any> { return { probability: 0.7, factors: [] }; }
  private async predictInterviewStage(user: any, job: Job, match: any, careerDNA: any): Promise<any> { return { probability: 0.6, factors: [] }; }
  private async predictOfferStage(user: any, job: Job, match: any, historical: any): Promise<any> { return { probability: 0.5, factors: [] }; }
  private generateBenchmarkComparison(rate: number, historical: any): string { return 'Average performance'; }
  private generateSuccessRecommendations(app: any, interview: any, offer: any, match: any): string[] { return []; }
  private calculateConfidenceLevel(probability: number, historical: any): 'low' | 'medium' | 'high' | 'very_high' { return 'medium'; }
  private async getBenchmarks(user: any, job: Job): Promise<any> { return {}; }

  /**
   *  Clear recommendation caches
   */
  clearCache(): void {
    this.behaviorCache.clear();
    this.modelCache.clear();
    logger.info(' Smart recommendation cache cleared');
  }

  /**
   *  Get service health and performance metrics
   */
  getServiceHealth(): {
    cacheSize: number;
    modelAccuracy: number;
    feedbackBufferSize: number;
    lastModelUpdate: Date;
    recommendationsGenerated: number;
  } {
    return {
      cacheSize: this.behaviorCache.size,
      modelAccuracy: this.mlModel.accuracy,
      feedbackBufferSize: this.feedbackBuffer.length,
      lastModelUpdate: this.mlModel.lastTrained,
      recommendationsGenerated: this.mlModel.trainingDataSize
    };
  }
}

export default SmartRecommendationService;
