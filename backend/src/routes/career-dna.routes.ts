import { Router, Request, Response } from 'express';
import { CareerDNAService } from '../services/career-dna.service.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import logger from '../config/logger.js';

const router = Router();
const careerDNAService = new CareerDNAService();

// Rate limiting for computationally intensive endpoints
const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    success: false,
    error: 'Too many analysis requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const heavyAnalysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour for heavy operations
  message: {
    success: false,
    error: 'Analysis limit reached. Please try again in an hour.',
  },
});

// Validation schemas
const careerAnalysisSchema = z.object({
  cvContent: z.string().optional(),
  preferences: z.object({
    includeMarketAnalysis: z.boolean().optional(),
    includeSuccessPatterns: z.boolean().optional(),
    timeframe: z.enum(['1y', '3y', '5y']).optional()
  }).optional()
});

const milestoneUpdateSchema = z.object({
  progress: z.number().min(0).max(100),
  notes: z.string().optional()
});

const careerMoveSchema = z.object({
  timeframe: z.enum(['6m', '1y', '3y', '5y']),
  includeRiskAnalysis: z.boolean().optional(),
  focusArea: z.string().optional()
});

// ========================================
//  CORE CAREER DNA ENDPOINTS
// ========================================

/**
 *  Generate comprehensive Career DNA analysis
 * POST /api/career-dna/analyze
 */
router.post(
  '/analyze',
  authenticate,
  heavyAnalysisLimiter,
  validateBody(careerAnalysisSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { cvContent, preferences } = req.body;

      logger.info(' Career DNA analysis requested', { userId });

      const careerDNA = await careerDNAService.generateCareerDNA(userId, cvContent, preferences);

      res.status(200).json({
        success: true,
        data: {
          careerDNA,
          analysisDate: new Date(),
          confidenceScore: careerDNA.confidenceScore,
          cacheStatus: 'fresh'
        }
      });

    } catch (error) {
      logger.error('Career DNA analysis failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze career DNA',
        code: 'CAREER_DNA_ERROR'
      });
    }
  }
);

/**
 *  Get simplified Career DNA insights
 * GET /api/career-dna/insights
 */
router.get(
  '/insights',
  authenticate,
  analysisLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const options = {
        includeMarketAnalysis: req.query.market === 'true',
        includeSuccessPatterns: req.query.patterns === 'true',
        timeframe: (req.query.timeframe as '1y' | '3y' | '5y') || '3y'
      };

      logger.info(' Career DNA insights requested', { userId, options });

      const insights = await careerDNAService.analyzeCareerDNA(userId, options);

      res.status(200).json({
        success: true,
        data: insights
      });

    } catch (error) {
      logger.error('Career DNA insights failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get career insights',
        code: 'INSIGHTS_ERROR'
      });
    }
  }
);

/**
 *  Get visual career fingerprint data
 * GET /api/career-dna/fingerprint
 */
router.get(
  '/fingerprint',
  authenticate,
  analysisLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      logger.info(' Career fingerprint requested', { userId });

      const fingerprint = await careerDNAService.getCareerFingerprint(userId);

      res.status(200).json({
        success: true,
        data: fingerprint
      });

    } catch (error) {
      logger.error('Career fingerprint failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get career fingerprint',
        code: 'FINGERPRINT_ERROR'
      });
    }
  }
);

// ========================================
//  ENHANCED TRAJECTORY ENDPOINTS
// ========================================

/**
 *  Get enhanced career trajectory with market intelligence
 * GET /api/career-dna/trajectory/enhanced
 */
router.get(
  '/trajectory/enhanced',
  authenticate,
  heavyAnalysisLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      logger.info(' Enhanced trajectory analysis requested', { userId });

      // Generate full career DNA to get enhanced trajectory
      const careerDNA = await careerDNAService.generateCareerDNA(userId);
      const trajectory = careerDNA.trajectory;

      res.status(200).json({
        success: true,
        data: {
          trajectory,
          enhancedFeatures: {
            marketIntelligence: trajectory.marketIntelligence,
            successPatterns: trajectory.successPatterns,
            careerVelocity: trajectory.careerVelocity,
            industryMomentum: trajectory.industryMomentum,
            competitivePosition: trajectory.competitivePosition,
            futureReadiness: trajectory.futureReadiness,
            adaptabilityScore: trajectory.adaptabilityScore
          },
          analysisTimestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Enhanced trajectory analysis failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze enhanced trajectory',
        code: 'ENHANCED_TRAJECTORY_ERROR'
      });
    }
  }
);

/**
 *  Predict optimal career moves
 * POST /api/career-dna/predict-moves
 */
router.post(
  '/predict-moves',
  authenticate,
  heavyAnalysisLimiter,
  validateBody(careerMoveSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { timeframe, includeRiskAnalysis, focusArea } = req.body;

      logger.info(' Career moves prediction requested', { userId, timeframe });

      const prediction = await careerDNAService.predictOptimalCareerMoves(userId, timeframe);

      res.status(200).json({
        success: true,
        data: {
          ...prediction,
          requestedTimeframe: timeframe,
          includeRiskAnalysis: includeRiskAnalysis || false,
          focusArea: focusArea || 'general',
          predictionDate: new Date()
        }
      });

    } catch (error) {
      logger.error('Career moves prediction failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to predict career moves',
        code: 'PREDICTION_ERROR'
      });
    }
  }
);

// ========================================
//  MARKET INTELLIGENCE ENDPOINTS
// ========================================

/**
 *  Get market intelligence data
 * GET /api/career-dna/market-intelligence
 */
router.get(
  '/market-intelligence',
  authenticate,
  analysisLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const industry = req.query.industry as string;

      logger.info(' Market intelligence requested', { userId, industry });

      // Generate career DNA to access market intelligence
      const careerDNA = await careerDNAService.generateCareerDNA(userId);
      const marketIntelligence = careerDNA.trajectory.marketIntelligence;

      // Filter by industry if specified
      let filteredData = marketIntelligence;
      if (industry) {
        filteredData = {
          ...marketIntelligence,
          industryGrowth: Object.fromEntries(
            Object.entries(marketIntelligence.industryGrowth)
              .filter(([key]) => key.toLowerCase().includes(industry.toLowerCase()))
          )
        };
      }

      res.status(200).json({
        success: true,
        data: {
          marketIntelligence: filteredData,
          industryFilter: industry || 'all',
          lastUpdated: new Date(),
          dataFreshness: 'current'
        }
      });

    } catch (error) {
      logger.error('Market intelligence request failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get market intelligence',
        code: 'MARKET_INTELLIGENCE_ERROR'
      });
    }
  }
);

/**
 *  Get competitive position analysis
 * GET /api/career-dna/competitive-position
 */
router.get(
  '/competitive-position',
  authenticate,
  analysisLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const includeComparison = req.query.comparison === 'true';

      logger.info(' Competitive position analysis requested', { userId });

      const careerDNA = await careerDNAService.generateCareerDNA(userId);
      const competitivePosition = careerDNA.trajectory.competitivePosition;

      res.status(200).json({
        success: true,
        data: {
          competitivePosition,
          marketRanking: {
            overall: competitivePosition.overallRanking,
            percentile: `${competitivePosition.overallRanking}th percentile`,
            marketCategory: competitivePosition.overallRanking > 80 ? 'top-tier' : 
                           competitivePosition.overallRanking > 60 ? 'competitive' : 'developing'
          },
          includeComparison,
          analysisDate: new Date()
        }
      });

    } catch (error) {
      logger.error('Competitive position analysis failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze competitive position',
        code: 'COMPETITIVE_POSITION_ERROR'
      });
    }
  }
);

/**
 *  Get success patterns analysis
 * GET /api/career-dna/success-patterns
 */
router.get(
  '/success-patterns',
  authenticate,
  analysisLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const patternType = req.query.type as string;

      logger.info(' Success patterns requested', { userId, patternType });

      const careerDNA = await careerDNAService.generateCareerDNA(userId);
      let successPatterns = careerDNA.trajectory.successPatterns;

      // Filter by pattern type if specified
      if (patternType) {
        successPatterns = successPatterns.filter(pattern => 
          pattern.patternType === patternType
        );
      }

      res.status(200).json({
        success: true,
        data: {
          successPatterns,
          patternFilter: patternType || 'all',
          totalPatterns: careerDNA.trajectory.successPatterns.length,
          averageSuccessRate: successPatterns.reduce((sum, p) => sum + p.successRate, 0) / successPatterns.length,
          analysisConfidence: successPatterns.reduce((sum, p) => sum + p.confidenceLevel, 0) / successPatterns.length
        }
      });

    } catch (error) {
      logger.error('Success patterns request failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get success patterns',
        code: 'SUCCESS_PATTERNS_ERROR'
      });
    }
  }
);

// ========================================
//  CAREER METRICS DASHBOARD ENDPOINTS
// ========================================

/**
 *  Get comprehensive career metrics dashboard
 * GET /api/career-dna/metrics/dashboard
 */
router.get(
  '/metrics/dashboard',
  authenticate,
  analysisLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      logger.info(' Career metrics dashboard requested', { userId });

      const careerDNA = await careerDNAService.generateCareerDNA(userId);
      const trajectory = careerDNA.trajectory;

      const dashboard = {
        // Core metrics
        careerVelocity: {
          score: trajectory.careerVelocity,
          level: trajectory.careerVelocity > 80 ? 'high' : trajectory.careerVelocity > 60 ? 'moderate' : 'developing',
          description: 'Your career progression speed and market responsiveness'
        },
        futureReadiness: {
          score: trajectory.futureReadiness,
          level: trajectory.futureReadiness > 80 ? 'excellent' : trajectory.futureReadiness > 60 ? 'good' : 'needs-improvement',
          description: 'How prepared you are for future job market changes'
        },
        adaptabilityScore: {
          score: trajectory.adaptabilityScore,
          level: trajectory.adaptabilityScore > 80 ? 'highly-adaptable' : trajectory.adaptabilityScore > 60 ? 'adaptable' : 'developing',
          description: 'Your ability to pivot and adapt to career changes'
        },
        // Market position
        marketPosition: {
          overallRanking: trajectory.competitivePosition.overallRanking,
          marketCategory: trajectory.competitivePosition.overallRanking > 80 ? 'top-tier' : 
                         trajectory.competitivePosition.overallRanking > 60 ? 'competitive' : 'developing',
          strengthAreas: trajectory.competitivePosition.strengthAreas,
          improvementAreas: trajectory.competitivePosition.improvementAreas.slice(0, 3)
        },
        // Industry momentum
        industryMomentum: {
          scores: trajectory.industryMomentum,
          topIndustry: Object.entries(trajectory.industryMomentum)
            .sort(([,a], [,b]) => b - a)[0],
          trendDirection: 'upward' // Could be calculated from historical data
        },
        // Quick insights
        quickInsights: {
          nextMilestone: careerDNA.milestones.find(m => m.progress < 100),
          optimalNextStep: trajectory.optimalNextStep,
          topOpportunity: trajectory.alternativePaths[0],
          keyStrength: careerDNA.hiddenStrengths[0]?.strength
        }
      };

      res.status(200).json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      logger.error('Career metrics dashboard failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to load career metrics dashboard',
        code: 'DASHBOARD_ERROR'
      });
    }
  }
);

/**
 *  Get career velocity details
 * GET /api/career-dna/metrics/velocity
 */
router.get(
  '/metrics/velocity',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      const careerDNA = await careerDNAService.generateCareerDNA(userId);
      const velocity = careerDNA.trajectory.careerVelocity;

      const velocityBreakdown = {
        overallScore: velocity,
        components: {
          skillGrowthRate: Math.min(40, careerDNA.fingerprint.coreCompetencies.reduce((sum, c) => sum + c.growth, 0) / careerDNA.fingerprint.coreCompetencies.length * 2),
          learningAgility: Math.min(20, new Set(careerDNA.fingerprint.coreCompetencies.map(c => c.skill)).size * 4),
          adaptabilityFactor: careerDNA.fingerprint.personalityProfile.adaptability * 0.2,
          marketAlignment: careerDNA.fingerprint.coreCompetencies.reduce((sum, c) => sum + c.marketValue, 0) / careerDNA.fingerprint.coreCompetencies.length * 0.2
        },
        recommendations: velocity < 60 ? [
          'Focus on high-growth skills',
          'Diversify skill portfolio',
          'Improve market alignment'
        ] : [
          'Maintain current momentum',
          'Explore leadership opportunities',
          'Consider advanced specializations'
        ]
      };

      res.status(200).json({
        success: true,
        data: velocityBreakdown
      });

    } catch (error) {
      logger.error('Career velocity request failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get career velocity data',
        code: 'VELOCITY_ERROR'
      });
    }
  }
);

// ========================================
//  MILESTONE & PROGRESS ENDPOINTS
// ========================================

/**
 *  Update milestone progress
 * PUT /api/career-dna/milestones/:milestoneId
 */
router.put(
  '/milestones/:milestoneId',
  authenticate,
  validateBody(milestoneUpdateSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { milestoneId } = req.params;
      const { progress, notes } = req.body;

      logger.info(' Milestone update requested', { userId, milestoneId, progress });

      const milestone = await careerDNAService.updateMilestoneProgress(userId, milestoneId, progress, notes);

      res.status(200).json({
        success: true,
        data: {
          milestone,
          progressDelta: progress - (milestone.progress || 0),
          completionStatus: progress >= 100 ? 'completed' : 'in-progress'
        }
      });

    } catch (error) {
      logger.error('Milestone update failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to update milestone',
        code: 'MILESTONE_UPDATE_ERROR'
      });
    }
  }
);

/**
 *  Get career insights and recommendations
 * GET /api/career-dna/insights/recommendations
 */
router.get(
  '/insights/recommendations',
  authenticate,
  analysisLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const category = req.query.category as string;

      logger.info(' Career insights requested', { userId, category });

      const insights = await careerDNAService.getCareerInsights(userId);
      
      // Filter by category if specified
      let filteredInsights = insights;
      if (category) {
        filteredInsights = insights.filter(insight => insight.type === category);
      }

      res.status(200).json({
        success: true,
        data: {
          insights: filteredInsights,
          totalInsights: insights.length,
          categories: [...new Set(insights.map(i => i.type))],
          actionableInsights: filteredInsights.filter(i => i.actionable).length,
          highImpactInsights: filteredInsights.filter(i => i.impact === 'high').length
        }
      });

    } catch (error) {
      logger.error('Career insights request failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get career insights',
        code: 'INSIGHTS_ERROR'
      });
    }
  }
);

// ========================================
//  SPECIALIZED ANALYSIS ENDPOINTS
// ========================================

/**
 *  Get industry momentum analysis
 * GET /api/career-dna/industry-momentum
 */
router.get(
  '/industry-momentum',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      const careerDNA = await careerDNAService.generateCareerDNA(userId);
      const industryMomentum = careerDNA.trajectory.industryMomentum;
      const marketIntelligence = careerDNA.trajectory.marketIntelligence;

      const analysis = {
        momentum: industryMomentum,
        topGrowthIndustries: Object.entries(industryMomentum)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([industry, score]) => ({
            industry,
            momentumScore: score,
            growthRate: marketIntelligence.industryGrowth[industry]?.rate || 0,
            outlook: marketIntelligence.industryGrowth[industry]?.outlook || 'stable'
          })),
        userIndustryPosition: careerDNA.fingerprint.industryAffinity.map(affinity => ({
          industry: affinity.industry,
          userAffinity: affinity.score,
          marketMomentum: industryMomentum[affinity.industry] || 50,
          alignment: affinity.score * (industryMomentum[affinity.industry] || 50) / 100
        }))
      };

      res.status(200).json({
        success: true,
        data: analysis
      });

    } catch (error) {
      logger.error('Industry momentum analysis failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze industry momentum',
        code: 'MOMENTUM_ANALYSIS_ERROR'
      });
    }
  }
);

/**
 *  Get future readiness assessment
 * GET /api/career-dna/future-readiness
 */
router.get(
  '/future-readiness',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      const careerDNA = await careerDNAService.generateCareerDNA(userId);
      const futureReadiness = careerDNA.trajectory.futureReadiness;
      const marketIntelligence = careerDNA.trajectory.marketIntelligence;

      const assessment = {
        overallScore: futureReadiness,
        readinessLevel: futureReadiness > 80 ? 'future-ready' : 
                       futureReadiness > 60 ? 'mostly-ready' : 'needs-preparation',
        strengths: [
          ...(futureReadiness > 70 ? ['Strong adaptability'] : []),
          ...(careerDNA.fingerprint.personalityProfile.creativity > 75 ? ['Innovation mindset'] : []),
          ...(careerDNA.fingerprint.coreCompetencies.some(c => c.growth > 15) ? ['Emerging skills'] : [])
        ],
        preparationAreas: [
          ...(futureReadiness < 60 ? ['Develop emerging technologies'] : []),
          ...(careerDNA.fingerprint.personalityProfile.adaptability < 60 ? ['Build adaptability'] : []),
          'Stay current with industry trends',
          'Expand skill portfolio'
        ],
        emergingOpportunities: marketIntelligence.emergingOpportunities.slice(0, 3),
        disruptionPreparedness: {
          level: futureReadiness > 75 ? 'well-prepared' : futureReadiness > 50 ? 'moderately-prepared' : 'needs-work',
          keyRisks: marketIntelligence.disruptionRisks.slice(0, 2)
        }
      };

      res.status(200).json({
        success: true,
        data: assessment
      });

    } catch (error) {
      logger.error('Future readiness assessment failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to assess future readiness',
        code: 'FUTURE_READINESS_ERROR'
      });
    }
  }
);

// ========================================
//  QUICK ACCESS ENDPOINTS
// ========================================

/**
 *  Get quick career summary
 * GET /api/career-dna/quick-summary
 */
router.get(
  '/quick-summary',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      const insights = await careerDNAService.analyzeCareerDNA(userId);

      const quickSummary = {
        careerStage: insights.careerStage,
        careerVelocity: insights.careerVelocity,
        futureReadiness: insights.futureReadiness,
        topIndustry: Object.entries(insights.industryFit)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Technology',
        nextSteps: insights.recommendedNextSteps.slice(0, 3),
        riskLevel: insights.riskTolerance,
        workStyle: insights.workLifeBalance > 70 ? 'remote-friendly' : 'flexible'
      };

      res.status(200).json({
        success: true,
        data: quickSummary
      });

    } catch (error) {
      logger.error('Quick summary request failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get career summary',
        code: 'QUICK_SUMMARY_ERROR'
      });
    }
  }
);

/**
 *  Get alternative career paths with market opportunities
 * GET /api/career-dna/alternative-paths
 */
router.get(
  '/alternative-paths',
  authenticate,
  analysisLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const difficulty = req.query.difficulty as string;
      const maxPaths = parseInt(req.query.limit as string) || 5;

      logger.info(' Alternative paths requested', { userId, difficulty, maxPaths });

      const careerDNA = await careerDNAService.generateCareerDNA(userId);
      let alternativePaths = careerDNA.trajectory.alternativePaths;

      // Filter by difficulty if specified
      if (difficulty) {
        alternativePaths = alternativePaths.filter(path => path.difficulty === difficulty);
      }

      // Limit results
      alternativePaths = alternativePaths.slice(0, maxPaths);

      const pathsWithEnhancedData = alternativePaths.map(path => ({
        ...path,
        marketScore: path.marketOpportunity,
        difficultyLevel: path.difficulty,
        timelineCategory: path.timeToTransition <= 6 ? 'quick' : 
                        path.timeToTransition <= 12 ? 'moderate' : 'long-term',
        skillsGapAnalysis: {
          totalGaps: path.gapSkills.length,
          criticalGaps: path.gapSkills.slice(0, 2),
          estimatedLearningTime: `${path.timeToTransition} months`
        }
      }));

      res.status(200).json({
        success: true,
        data: {
          alternativePaths: pathsWithEnhancedData,
          pathCount: pathsWithEnhancedData.length,
          difficultyFilter: difficulty || 'all',
          averageMarketOpportunity: pathsWithEnhancedData.reduce((sum, p) => sum + p.marketOpportunity, 0) / pathsWithEnhancedData.length,
          quickestTransition: pathsWithEnhancedData.sort((a, b) => a.timeToTransition - b.timeToTransition)[0]
        }
      });

    } catch (error) {
      logger.error('Alternative paths request failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get alternative career paths',
        code: 'ALTERNATIVE_PATHS_ERROR'
      });
    }
  }
);

// ========================================
//  GROWTH & PROJECTION ENDPOINTS
// ========================================

/**
 *  Get detailed growth projections
 * GET /api/career-dna/growth-projections
 */
router.get(
  '/growth-projections',
  authenticate,
  analysisLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const timeframe = req.query.timeframe as string;

      const careerDNA = await careerDNAService.generateCareerDNA(userId);
      let projections = careerDNA.trajectory.projectedGrowth;

      // Filter by timeframe if specified
      if (timeframe) {
        projections = projections.filter(p => p.timeframe === timeframe);
      }

      const analysis = {
        projections: projections.map(p => ({
          ...p,
          probabilityLevel: p.probability > 0.8 ? 'high' : p.probability > 0.6 ? 'moderate' : 'challenging',
          skillsGapAnalysis: {
            totalRequiredSkills: p.requiredSkills.length,
            matchingSkills: careerDNA.fingerprint.coreCompetencies.filter(c => 
              p.requiredSkills.some(rs => rs.toLowerCase().includes(c.skill.toLowerCase()))
            ).length,
            gapSkills: p.requiredSkills.filter(rs => 
              !careerDNA.fingerprint.coreCompetencies.some(c => 
                c.skill.toLowerCase().includes(rs.toLowerCase())
              )
            )
          }
        })),
        currentLevel: careerDNA.trajectory.currentLevel,
        growthTrajectory: projections.length > 1 ? 
          (projections[1].probability - projections[0].probability > 0 ? 'accelerating' : 'steady') : 'steady',
        recommendedFocus: careerDNA.trajectory.optimalNextStep
      };

      res.status(200).json({
        success: true,
        data: analysis
      });

    } catch (error) {
      logger.error('Growth projections request failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get growth projections',
        code: 'GROWTH_PROJECTIONS_ERROR'
      });
    }
  }
);

// ========================================
//  EXPORT & SHARING ENDPOINTS
// ========================================

/**
 *  Export career DNA report
 * GET /api/career-dna/export
 */
router.get(
  '/export',
  authenticate,
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 exports per hour
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const format = req.query.format as string || 'json';

      logger.info(' Career DNA export requested', { userId, format });

      const careerDNA = await careerDNAService.generateCareerDNA(userId);

      const exportData = {
        exportDate: new Date(),
        userId: userId,
        careerAnalysis: {
          fingerprint: careerDNA.fingerprint,
          trajectory: careerDNA.trajectory,
          hiddenStrengths: careerDNA.hiddenStrengths,
          roadmap: careerDNA.roadmap,
          milestones: careerDNA.milestones
        },
        enhancedMetrics: {
          careerVelocity: careerDNA.trajectory.careerVelocity,
          futureReadiness: careerDNA.trajectory.futureReadiness,
          adaptabilityScore: careerDNA.trajectory.adaptabilityScore,
          competitiveRanking: careerDNA.trajectory.competitivePosition.overallRanking
        },
        confidenceScore: careerDNA.confidenceScore
      };

      if (format === 'json') {
        res.status(200).json({
          success: true,
          data: exportData
        });
      } else {
        // Could add PDF export here in the future
        res.status(400).json({
          success: false,
          error: 'Export format not supported',
          supportedFormats: ['json']
        });
      }

    } catch (error) {
      logger.error('Career DNA export failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to export career DNA',
        code: 'EXPORT_ERROR'
      });
    }
  }
);

// ========================================
//  ANALYTICS & TRACKING ENDPOINTS
// ========================================

/**
 *  Get career analytics summary
 * GET /api/career-dna/analytics
 */
router.get(
  '/analytics',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const period = req.query.period as string || '30d';

      logger.info(' Career analytics requested', { userId, period });

      // This would typically fetch historical data
      // For now, provide current snapshot with trends
      const careerDNA = await careerDNAService.generateCareerDNA(userId);

      const analytics = {
        analysisHistory: {
          totalAnalyses: 1, // Would be actual count from DB
          lastAnalysis: careerDNA.lastAnalyzed,
          analysisFrequency: 'monthly'
        },
        progressMetrics: {
          skillGrowth: careerDNA.fingerprint.coreCompetencies.reduce((sum, c) => sum + c.growth, 0) / careerDNA.fingerprint.coreCompetencies.length,
          careerVelocityTrend: 'improving', // Would calculate from historical data
          milestoneCompletionRate: careerDNA.milestones.filter(m => m.progress >= 100).length / careerDNA.milestones.length * 100
        },
        marketAlignment: {
          currentAlignment: careerDNA.fingerprint.coreCompetencies.reduce((sum, c) => sum + c.marketValue, 0) / careerDNA.fingerprint.coreCompetencies.length,
          trend: 'stable',
          topPerformingSkills: careerDNA.fingerprint.coreCompetencies
            .sort((a, b) => b.marketValue - a.marketValue)
            .slice(0, 3)
            .map(c => c.skill)
        }
      };

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Career analytics request failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get career analytics',
        code: 'ANALYTICS_ERROR'
      });
    }
  }
);

export default router;
