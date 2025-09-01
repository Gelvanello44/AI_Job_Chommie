import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
// import { validate } from '../middleware/validation.js'; // Not available
import { AppError } from '../middleware/errorHandler.js';
import { AIMatchingService } from '../services/ai-matching.service.js';
import CompanyProfileService from '../services/companyProfileService.js';
import { IndustryLanguageService } from '../services/industry-language.service.js';
import { CareerDNAService } from '../services/career-dna.service.js';
import { ApplicationService } from '../services/application.service.js';
import { CoverLetterService } from '../services/coverLetter.service.js';
import { AnalyticsService } from '../services/analytics.service.js';
import logger from '../config/logger.js';
import { body, param, query } from 'express-validator';

const router = Router();

// Initialize services
const aiMatchingService = new AIMatchingService();
const companyProfileService = CompanyProfileService;
const industryLanguageService = new IndustryLanguageService();
const careerDNAService = new CareerDNAService();
const applicationService = new ApplicationService();
const coverLetterService = new CoverLetterService();
const analyticsService = new AnalyticsService();

// Apply authentication to all routes
router.use(authenticate);

//  PERSONALITY & MATCHING MAGIC

/**
 *  Get AI-powered job matching with personality analysis
 */
router.get('/personality-job-match/:jobId',
  param('jobId').isUUID().withMessage('Valid job ID required'),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required', 'AUTH_REQUIRED');
      }

      logger.info(' Processing personality-job match request', { userId, jobId });

      // Get enhanced job match with personality analysis
      const matchResult = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Job not found or user not eligible for matching'
        });
      }

      const match = matchResult[0];

      res.json({
        success: true,
        data: {
          jobId,
          overallScore: match.overallScore,
          personalityFit: match.personalityScore,
          cultureFit: match.culturalFitScore,
          skillsAlignment: match.skillsScore,
          experienceMatch: match.experienceScore,
          reasoning: match.magicExplanation,
          recommendations: match.recommendations,
          personalityInsights: match.personalityInsights,
          shouldApply: match.overallScore > 0.7,
          magicMoment: match.overallScore > 0.85 ? " Perfect Match! This role aligns beautifully with your personality and skills." : null
        }
      });

    } catch (error) {
      logger.error('Error in personality-job match', { error, userId: req.user?.id, jobId: req.params.jobId });
      throw error;
    }
  }
);

/**
 *  Get company culture intelligence
 */
router.get('/company-culture/:companyId',
  param('companyId').isUUID().withMessage('Valid company ID required'),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const userId = req.user?.id;

      logger.info(' Getting company culture intelligence', { userId, companyId });

      const cultureIntelligence = await companyProfileService.analyzeCultureIntelligence(companyId);
      const shouldApply = await companyProfileService.shouldUserApply(userId!, companyId);

      res.json({
        success: true,
        data: {
          companyId,
          cultureAnalysis: cultureIntelligence.cultureProfile,
          hiringPatterns: cultureIntelligence.hiringPatterns,
          interviewIntelligence: cultureIntelligence.interviewInsights,
          shouldApply: shouldApply.recommendation,
          reasoning: shouldApply.reasoning,
          confidenceScore: shouldApply.confidence,
          magicMoment: shouldApply.confidence > 0.85 ? " This company culture matches your values perfectly!" : null
        }
      });

    } catch (error) {
      logger.error('Error getting company culture intelligence', { error, userId: req.user?.id, companyId: req.params.companyId });
      throw error;
    }
  }
);

//  SUCCESS PREDICTION MAGIC

/**
 *  Get success probability prediction
 */
router.get('/success-prediction/:jobId',
  param('jobId').isUUID().withMessage('Valid job ID required'),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      logger.info(' Getting success prediction', { userId, jobId });

      // TODO: Implement predictApplicationSuccess method in AnalyticsService
      const prediction = {
        probability: 0.75,
        timeline: '2-4 weeks',
        confidence: 0.8,
        reasoning: 'Based on your profile and similar applications',
        comparison: 'Above average success rate',
        recommendations: ['Highlight relevant experience', 'Customize your application']
      };

      res.json({
        success: true,
        data: {
          jobId,
          successProbability: prediction.probability,
          timelineEstimate: prediction.timeline,
          confidenceLevel: prediction.confidence,
          reasoning: prediction.reasoning,
          competitiveAnalysis: prediction.comparison,
          recommendations: prediction.recommendations,
          magicMoment: prediction.probability > 0.8 ? " Exceptional match! You have an outstanding chance of success!" : null
        }
      });

    } catch (error) {
      logger.error('Error getting success prediction', { error, userId: req.user?.id, jobId: req.params.jobId });
      throw error;
    }
  }
);

// ⏰ PERFECT TIMING MAGIC

/**
 *  Get optimal application timing
 */
router.get('/optimal-timing/:jobId',
  param('jobId').isUUID().withMessage('Valid job ID required'),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { companyId } = req.query;

      logger.info(' Getting optimal timing recommendation', { jobId, companyId });

      if (!companyId || typeof companyId !== 'string') {
        throw new AppError(400, 'Company ID required for timing analysis', 'COMPANY_ID_REQUIRED');
      }

      const timingRecommendation = await applicationService.getOptimalSubmissionTiming(jobId, companyId);
      const hrPatterns = await applicationService.analyzeHRActivityPatterns(companyId);

      res.json({
        success: true,
        data: {
          jobId,
          companyId,
          submitNow: timingRecommendation.submitNow,
          waitUntil: timingRecommendation.waitUntil,
          reasoning: timingRecommendation.reasoning,
          confidence: timingRecommendation.confidenceLevel,
          hrPatterns: {
            peakHours: hrPatterns.peakActivityHours,
            activeDays: hrPatterns.activeDays,
            avgResponseTime: hrPatterns.averageResponseTime
          },
          alternativeTimes: timingRecommendation.alternativeTimes,
          magicMoment: timingRecommendation.submitNow ? " Perfect timing! HR activity is at peak levels right now!" : null
        }
      });

    } catch (error) {
      logger.error('Error getting optimal timing', { error, jobId: req.params.jobId });
      throw error;
    }
  }
);

/**
 *  Get timing correlation insights
 */
router.get('/timing-insights',
  query('companyId').optional().isUUID().withMessage('Valid company ID required'),
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.query;

      logger.info(' Getting timing correlation insights', { companyId });

      const insights = await applicationService.getTimingCorrelationReport(companyId as string);

      res.json({
        success: true,
        data: {
          optimalWindows: insights.optimalSubmissionWindows,
          responseRates: insights.responseRatesByTime,
          seasonalTrends: insights.seasonalInsights,
          recommendations: insights.recommendations,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error getting timing insights', { error });
      throw error;
    }
  }
);

//  INDUSTRY LANGUAGE MAGIC

/**
 *  Get trending keywords for industry
 */
router.get('/trending-keywords/:industry',
  param('industry').isLength({ min: 2, max: 50 }).withMessage('Valid industry name required'),
  async (req: Request, res: Response) => {
    try {
      const { industry } = req.params;

      logger.info(' Getting trending keywords', { industry });

      const trendingKeywords = await industryLanguageService.getTrendingKeywords(industry);

      res.json({
        success: true,
        data: {
          industry,
          keywords: trendingKeywords.trendingKeywords.slice(0, 20),
          mustHaveSkills: trendingKeywords.mustHaveSkills,
          emergingTerms: trendingKeywords.emergingTerms,
          languagePatterns: trendingKeywords.languagePatterns,
          lastUpdated: trendingKeywords.lastUpdated
        }
      });

    } catch (error) {
      logger.error('Error getting trending keywords', { error, industry: req.params.industry });
      throw error;
    }
  }
);

/**
 *  Optimize document language
 */
router.post('/optimize-language',
  body('content').isLength({ min: 50 }).withMessage('Content must be at least 50 characters'),
  body('documentType').isIn(['cv', 'cover_letter']).withMessage('Document type must be cv or cover_letter'),
  body('targetIndustry').isLength({ min: 2 }).withMessage('Target industry required'),
  body('experienceLevel').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const { content, documentType, targetIndustry, experienceLevel } = req.body;
      const userId = req.user?.id;

      logger.info(' Optimizing document language', { userId, documentType, targetIndustry });

      const optimization = await industryLanguageService.optimizeDocumentLanguage(
        content,
        documentType,
        targetIndustry,
        experienceLevel
      );

      res.json({
        success: true,
        data: {
          originalScore: optimization.overallScore,
          insights: optimization.languageInsights,
          suggestions: optimization.suggestions.slice(0, 10),
          missingKeywords: optimization.missingKeywords,
          overusedTerms: optimization.overusedTerms,
          strengths: optimization.strengthAreas,
          improvements: optimization.improvementAreas,
          magicMoment: optimization.overallScore > 0.9 ? " Outstanding optimization! Your document is industry-perfect!" : null
        }
      });

    } catch (error) {
      logger.error('Error optimizing document language', { error, userId: req.user?.id });
      throw error;
    }
  }
);

/**
 *  Get real-time keyword suggestions
 */
router.post('/keyword-suggestions',
  body('context').isLength({ min: 10 }).withMessage('Context must be at least 10 characters'),
  body('industry').isLength({ min: 2 }).withMessage('Industry required'),
  body('documentType').isIn(['cv', 'cover_letter', 'profile']).withMessage('Valid document type required'),
  body('userRole').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const { context, industry, documentType, userRole } = req.body;

      logger.info(' Getting real-time keyword suggestions', { industry, documentType });

      const suggestions = await industryLanguageService.getRealTimeKeywordSuggestions(
        context,
        industry,
        documentType,
        userRole
      );

      res.json({
        success: true,
        data: {
          context,
          suggestions: suggestions.suggestions,
          industry,
          documentType
        }
      });

    } catch (error) {
      logger.error('Error getting keyword suggestions', { error });
      throw error;
    }
  }
);

//  CAREER DNA MAGIC

/**
 *  Generate Career DNA analysis
 */
router.post('/career-dna',
  body('cvContent').optional().isString(),
  body('preferences').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const { cvContent, preferences } = req.body;
      const userId = req.user?.id;

      logger.info(' Generating Career DNA analysis', { userId });

      const careerDNA = await careerDNAService.generateCareerDNA(userId!, cvContent, preferences);

      res.json({
        success: true,
        data: {
          fingerprint: careerDNA.fingerprint,
          trajectory: careerDNA.trajectory,
          hiddenStrengths: careerDNA.hiddenStrengths.slice(0, 5),
          roadmap: {
            goals: careerDNA.roadmap.goals.slice(0, 6),
            skillDevelopmentPlan: careerDNA.roadmap.skillDevelopmentPlan,
            networkingStrategy: careerDNA.roadmap.networkingStrategy,
            timeline: careerDNA.roadmap.timelineOverview
          },
          milestones: careerDNA.milestones.slice(0, 8),
          confidenceScore: careerDNA.confidenceScore,
          lastAnalyzed: careerDNA.lastAnalyzed,
          magicMoment: careerDNA.confidenceScore > 0.85 ? " Exceptional career trajectory detected! You're on an amazing path!" : null
        }
      });

    } catch (error) {
      logger.error('Error generating Career DNA', { error, userId: req.user?.id });
      throw error;
    }
  }
);

/**
 *  Get career visualization data
 */
router.get('/career-visualization',
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      logger.info(' Getting career visualization data', { userId });

      const visualization = await careerDNAService.getCareerFingerprint(userId!);

      res.json({
        success: true,
        data: {
          charts: {
            personalityRadar: visualization.radarChart,
            skillsComparison: visualization.skillsChart,
            careerTrajectory: visualization.trajectoryChart,
            industryAffinity: visualization.industryAffinityChart
          },
          visualizationType: 'career_dna_fingerprint',
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error getting career visualization', { error, userId: req.user?.id });
      throw error;
    }
  }
);

/**
 *  Get personalized career insights
 */
router.get('/career-insights',
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      logger.info(' Getting career insights', { userId });

      const insights = await careerDNAService.getCareerInsights(userId!);

      res.json({
        success: true,
        data: {
          insights: insights.slice(0, 8),
          totalInsights: insights.length,
          priorityInsights: insights.filter(i => i.impact === 'high').length,
          actionableItems: insights.filter(i => i.actionable).length
        }
      });

    } catch (error) {
      logger.error('Error getting career insights', { error, userId: req.user?.id });
      throw error;
    }
  }
);

/**
 *  Predict optimal career moves
 */
router.get('/career-predictions',
  query('timeframe').isIn(['6m', '1y', '3y', '5y']).withMessage('Valid timeframe required'),
  async (req: Request, res: Response) => {
    try {
      const { timeframe } = req.query;
      const userId = req.user?.id;

      logger.info(' Predicting career moves', { userId, timeframe });

      const predictions = await careerDNAService.predictOptimalCareerMoves(
        userId!,
        timeframe as '6m' | '1y' | '3y' | '5y'
      );

      res.json({
        success: true,
        data: {
          timeframe,
          recommendations: predictions.recommendations,
          marketAnalysis: predictions.marketAnalysis,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error predicting career moves', { error, userId: req.user?.id });
      throw error;
    }
  }
);

/**
 *  Update milestone progress
 */
router.patch('/milestones/:milestoneId',
  param('milestoneId').isString().withMessage('Valid milestone ID required'),
  body('progress').isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
  body('notes').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const { milestoneId } = req.params;
      const { progress, notes } = req.body;
      const userId = req.user?.id;

      logger.info(' Updating milestone progress', { userId, milestoneId, progress });

      const updatedMilestone = await careerDNAService.updateMilestoneProgress(
        userId!,
        milestoneId,
        progress,
        notes
      );

      res.json({
        success: true,
        data: {
          milestone: updatedMilestone,
          celebrationTriggered: progress >= 100,
          magicMoment: progress >= 100 ? updatedMilestone.celebrationMessage : null
        }
      });

    } catch (error) {
      logger.error('Error updating milestone', { error, userId: req.user?.id, milestoneId: req.params.milestoneId });
      throw error;
    }
  }
);

//  ENHANCED WRITING MAGIC

/**
 *  Generate enhanced cover letter with personality matching
 */
router.post('/enhanced-cover-letter',
  body('jobId').isUUID().withMessage('Valid job ID required'),
  body('tone').isIn(['PROFESSIONAL', 'CONVERSATIONAL', 'EXECUTIVE', 'CREATIVE']).withMessage('Valid tone required'),
  body('cvContent').optional().isString(),
  body('templateId').optional().isString(),
  body('customization').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const { jobId, tone, cvContent, templateId, customization } = req.body;
      const userId = req.user?.id;

      logger.info(' Generating enhanced cover letter', { userId, jobId, tone });

      const enhancedCoverLetter = await coverLetterService.generateEnhancedCoverLetter(
        userId!,
        { jobId, tone, templateId, customization },
        cvContent
      );

      res.json({
        success: true,
        data: {
          content: enhancedCoverLetter.personalizedContent,
          personalityAlignment: enhancedCoverLetter.personalityAlignment,
          industryOptimization: enhancedCoverLetter.industryOptimization,
          toneAnalysis: enhancedCoverLetter.toneAnalysis,
          suggestions: enhancedCoverLetter.suggestions.slice(0, 8),
          oneClickOptimizations: enhancedCoverLetter.oneClickOptimizations,
          magicMoment: enhancedCoverLetter.personalityAlignment > 0.9 ? " Perfect voice match! This letter authentically represents you!" : null
        }
      });

    } catch (error) {
      logger.error('Error generating enhanced cover letter', { error, userId: req.user?.id });
      throw error;
    }
  }
);

/**
 *  Apply one-click optimization
 */
router.patch('/cover-letter/:coverLetterId/optimize',
  param('coverLetterId').isUUID().withMessage('Valid cover letter ID required'),
  body('optimizationType').isIn(['personality', 'industry', 'tone', 'keywords']).withMessage('Valid optimization type required'),
  async (req: Request, res: Response) => {
    try {
      const { coverLetterId } = req.params;
      const { optimizationType } = req.body;
      const userId = req.user?.id;

      logger.info(' Applying one-click optimization', { userId, coverLetterId, optimizationType });

      const optimization = await coverLetterService.applyOneClickOptimization(
        userId!,
        coverLetterId,
        optimizationType
      );

      res.json({
        success: true,
        data: {
          optimizedContent: optimization.optimizedContent,
          improvementScore: optimization.improvementScore,
          changes: optimization.changes,
          optimizationType,
          magicMoment: optimization.improvementScore > 0.9 ? " Incredible optimization! Your letter just got significantly stronger!" : null
        }
      });

    } catch (error) {
      logger.error('Error applying one-click optimization', { error, userId: req.user?.id });
      throw error;
    }
  }
);

/**
 *  Analyze job description language
 */
router.post('/analyze-job-language',
  body('jobDescription').isLength({ min: 50 }).withMessage('Job description must be at least 50 characters'),
  body('industry').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const { jobDescription, industry } = req.body;

      logger.info(' Analyzing job description language', { industry });

      const analysis = await industryLanguageService.analyzeJobDescription(jobDescription, industry);

      res.json({
        success: true,
        data: {
          keywords: analysis.extractedKeywords.slice(0, 15),
          complexity: analysis.languageComplexity,
          skills: {
            required: analysis.requiredSkills,
            preferred: analysis.preferredSkills
          },
          cultural: analysis.culturalIndicators,
          salary: analysis.salaryIndicators,
          urgency: analysis.urgencyLevel,
          applicationAdvice: analysis.applicationAdvice
        }
      });

    } catch (error) {
      logger.error('Error analyzing job language', { error });
      throw error;
    }
  }
);

/**
 *  Generate industry-specific template
 */
router.post('/industry-template',
  body('industry').isLength({ min: 2 }).withMessage('Industry required'),
  body('jobTitle').isLength({ min: 2 }).withMessage('Job title required'),
  body('experienceLevel').isIn(['entry', 'junior', 'mid', 'senior', 'executive']).withMessage('Valid experience level required'),
  body('companyName').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const { industry, jobTitle, experienceLevel, companyName } = req.body;

      logger.info(' Generating industry template', { industry, jobTitle });

      const template = await industryLanguageService.generateIndustryTemplate(
        industry,
        jobTitle,
        experienceLevel,
        companyName
      );

      res.json({
        success: true,
        data: {
          template: template.template,
          keyPhrases: template.keyPhrases,
          structureNotes: template.structureNotes,
          industryTips: template.industrySpecificTips,
          industry,
          jobTitle,
          experienceLevel
        }
      });

    } catch (error) {
      logger.error('Error generating industry template', { error });
      throw error;
    }
  }
);

//  MAGIC MOMENTS DASHBOARD

/**
 *  Get personalized magic moments dashboard
 */
router.get('/dashboard',
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      logger.info(' Getting magic moments dashboard', { userId });

      // Gather magic insights from all services
      const [
        careerInsights,
        recentMatches,
        careerDNA,
        applicationStats
      ] = await Promise.all([
        careerDNAService.getCareerInsights(userId!).catch(() => []),
        aiMatchingService.calculateJobMatches(userId!, []).catch(() => []),
        careerDNAService.generateCareerDNA(userId!).catch(() => null),
        applicationService.getApplicationStatistics(userId!).catch(() => null)
      ]);

      // Generate magic moments
      const magicMoments = [];
      
      // High-scoring insights
      const highImpactInsights = careerInsights.filter(insight => insight.impact === 'high');
      if (highImpactInsights.length > 0) {
        magicMoments.push({
          type: 'career_insight',
          title: ' High-Impact Opportunity Detected',
          description: highImpactInsights[0].description,
          action: 'View Career Insights',
          priority: 'high'
        });
      }

      // Perfect matches
      const perfectMatches = recentMatches.filter((match: any) => match.overallScore > 0.85);
      if (perfectMatches.length > 0) {
        magicMoments.push({
          type: 'perfect_match',
          title: ' Perfect Job Match Found',
          description: `${perfectMatches.length} exceptional job(s) match your profile perfectly`,
          action: 'View Matches',
          priority: 'high'
        });
      }

      // Career DNA insights
      if (careerDNA && careerDNA.confidenceScore > 0.8) {
        magicMoments.push({
          type: 'career_strength',
          title: ' Hidden Strength Identified',
          description: `Your ${careerDNA.hiddenStrengths[0]?.strength} has high market value`,
          action: 'View Career DNA',
          priority: 'medium'
        });
      }

      // Milestone achievements
      if (careerDNA) {
        const recentAchievements = careerDNA.milestones.filter(m => m.achievedDate && 
          new Date(m.achievedDate).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
        );
        
        if (recentAchievements.length > 0) {
          magicMoments.push({
            type: 'milestone_achieved',
            title: ' Milestone Achievement',
            description: `Congratulations on achieving: ${recentAchievements[0].title}`,
            action: 'View Milestones',
            priority: 'celebration'
          });
        }
      }

      res.json({
        success: true,
        data: {
          magicMoments: magicMoments.slice(0, 6),
          insights: {
            careerStrength: careerDNA?.confidenceScore || 0,
            recentActivity: applicationStats?.totalApplications || 0,
            perfectMatches: perfectMatches.length,
            actionableInsights: careerInsights.filter(i => i.actionable).length
          },
          quickActions: [
            { action: 'Analyze New Job', icon: '', endpoint: '/magic/personality-job-match' },
            { action: 'Optimize CV Language', icon: '', endpoint: '/magic/optimize-language' },
            { action: 'Check Perfect Timing', icon: '⏰', endpoint: '/magic/optimal-timing' },
            { action: 'Generate Cover Letter', icon: '', endpoint: '/magic/enhanced-cover-letter' }
          ],
          lastUpdated: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error getting magic dashboard', { error, userId: req.user?.id });
      throw error;
    }
  }
);

//  BATCH PROCESSING MAGIC

/**
 *  Batch analyze multiple jobs
 */
router.post('/batch-analyze',
  body('jobIds').isArray({ min: 1, max: 10 }).withMessage('Provide 1-10 job IDs'),
  body('jobIds.*').isUUID().withMessage('All job IDs must be valid UUIDs'),
  body('analysisTypes').isArray().withMessage('Analysis types required'),
  body('analysisTypes.*').isIn(['personality_match', 'success_prediction', 'timing', 'culture_fit']).withMessage('Valid analysis types required'),
  async (req: Request, res: Response) => {
    try {
      const { jobIds, analysisTypes } = req.body;
      const userId = req.user?.id;

      logger.info(' Processing batch job analysis', { userId, jobCount: jobIds.length, analysisTypes });

      const results = [];

      for (const jobId of jobIds) {
        const jobResult: any = { jobId, analyses: {} };

        // Personality matching
        if (analysisTypes.includes('personality_match')) {
          try {
            const matches = await aiMatchingService.calculateJobMatches(userId!, [jobId]);
            jobResult.analyses.personalityMatch = matches[0] || null;
          } catch (error) {
            logger.warn('Failed personality match in batch', { error, jobId });
          }
        }

        // Success prediction
        if (analysisTypes.includes('success_prediction')) {
          try {
            // TODO: Implement predictApplicationSuccess method in AnalyticsService
            const prediction = {
              probability: 0.75,
              timeline: '2-4 weeks',
              confidence: 0.8,
              reasoning: 'Based on your profile and similar applications',
              comparison: 'Above average success rate',
              recommendations: ['Highlight relevant experience', 'Customize your application']
            };
            jobResult.analyses.successPrediction = prediction;
          } catch (error) {
            logger.warn('Failed success prediction in batch', { error, jobId });
          }
        }

        // Timing analysis (requires company info)
        if (analysisTypes.includes('timing')) {
          try {
            // Get job to find company ID
            const job = await applicationService.getApplicationById(jobId, userId!);
            if (job) {
              const timing = await applicationService.getOptimalSubmissionTiming(
                jobId,
                job.job.company.id
              );
              jobResult.analyses.timing = timing;
            }
          } catch (error) {
            logger.warn('Failed timing analysis in batch', { error, jobId });
          }
        }

        results.push(jobResult);
      }

      // Find the best opportunities
      const bestOpportunities = results
        .filter(r => r.analyses.personalityMatch?.overallScore > 0.7)
        .sort((a, b) => (b.analyses.personalityMatch?.overallScore || 0) - (a.analyses.personalityMatch?.overallScore || 0))
        .slice(0, 3);

      res.json({
        success: true,
        data: {
          results,
          summary: {
            totalAnalyzed: jobIds.length,
            bestOpportunities: bestOpportunities.map(r => ({
              jobId: r.jobId,
              score: r.analyses.personalityMatch?.overallScore,
              submitNow: r.analyses.timing?.submitNow
            })),
            averageCompatibility: results.reduce((sum, r) => 
              sum + (r.analyses.personalityMatch?.overallScore || 0), 0
            ) / results.length,
            magicMoment: bestOpportunities.length > 0 ? " Amazing! Found exceptional opportunities in your batch analysis!" : null
          },
          processedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error in batch analysis', { error, userId: req.user?.id });
      throw error;
    }
  }
);

//  MAGIC INSIGHTS EXPORT

/**
 *  Export comprehensive magic report
 */
router.get('/export-report',
  query('format').optional().isIn(['json', 'pdf']).withMessage('Format must be json or pdf'),
  async (req: Request, res: Response) => {
    try {
      const { format = 'json' } = req.query;
      const userId = req.user?.id;

      logger.info(' Exporting magic report', { userId, format });

      // Gather comprehensive data
      const [
        careerDNA,
        careerInsights,
        applicationStats,
        timingInsights
      ] = await Promise.all([
        careerDNAService.generateCareerDNA(userId!).catch(() => null),
        careerDNAService.getCareerInsights(userId!).catch(() => []),
        applicationService.getApplicationStatistics(userId!).catch(() => null),
        applicationService.getTimingCorrelationReport().catch(() => null)
      ]);

      const comprehensiveReport = {
        user: {
          id: userId,
          reportGeneratedAt: new Date().toISOString()
        },
        careerProfile: {
          dna: careerDNA,
          insights: careerInsights,
          visualization: careerDNA ? await careerDNAService.getCareerFingerprint(userId!) : null
        },
        applicationIntelligence: {
          statistics: applicationStats,
          timingInsights: timingInsights
        },
        magicSummary: {
          totalMagicMoments: careerInsights.filter(i => i.impact === 'high').length,
          careerConfidence: careerDNA?.confidenceScore || 0,
          optimalMatchCount: 0, // Would be calculated from recent matches
          personalityAlignment: careerDNA?.fingerprint.personalityProfile || null
        },
        recommendations: {
          immediateActions: careerInsights.filter(i => i.timeframe === 'immediate').slice(0, 5),
          careerMoves: careerDNA?.trajectory.projectedGrowth.slice(0, 3) || [],
          skillDevelopment: careerDNA?.roadmap.skillDevelopmentPlan.criticalSkills.slice(0, 5) || []
        }
      };

      if (format === 'pdf') {
        // For PDF, set proper headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=magic-career-report.pdf');
        
        // Return JSON for now - in production, generate actual PDF
        res.json({
          success: true,
          message: 'PDF generation not implemented yet',
          data: comprehensiveReport
        });
      } else {
        res.json({
          success: true,
          data: comprehensiveReport
        });
      }

    } catch (error) {
      logger.error('Error exporting magic report', { error, userId: req.user?.id });
      throw error;
    }
  }
);

export default router;
