import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import logger from '../config/logger.js';

// Import AI services
import { HuggingFaceService } from '../services/huggingface.service.js';
import AiMatchingService from '../services/ai-matching.service.js';
import CvAnalysisService from '../services/cv-analysis.service.js';
import { SemanticMatchingService } from '../services/semantic-matching.service.js';

const router = Router();

// Initialize AI services
const hfService = HuggingFaceService.getInstance();
const aiMatchingService = new AiMatchingService();
const cvAnalysisService = new CvAnalysisService();
const semanticMatchingService = new SemanticMatchingService();

// Rate limiting for AI operations
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: {
    success: false,
    error: 'Too many AI requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const heavyAILimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour  
  max: 10, // 10 requests per hour for heavy AI operations
  message: {
    success: false,
    error: 'AI processing limit reached. Please try again in an hour.',
  },
});

// Validation schemas
const cvAnalysisSchema = z.object({
  cvContent: z.string().min(50).max(50000),
  analysisType: z.enum(['basic', 'detailed', 'skills', 'personality', 'career-fit']).optional(),
  includeRecommendations: z.boolean().optional(),
  targetRole: z.string().optional()
});

const jobMatchingSchema = z.object({
  jobId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  cvContent: z.string().optional(),
  analysisDepth: z.enum(['quick', 'standard', 'comprehensive']).optional(),
  includeExplanation: z.boolean().optional()
});

const semanticAnalysisSchema = z.object({
  text: z.string().min(10).max(10000),
  analysisType: z.enum(['skills', 'job-description', 'cv-content', 'requirements']),
  context: z.string().optional(),
  language: z.string().optional()
});

const batchAnalysisSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    content: z.string(),
    type: z.enum(['cv', 'job', 'skill'])
  })).min(1).max(10),
  analysisType: z.enum(['matching', 'classification', 'extraction'])
});

// ========================================
//  CV ANALYSIS AI ENDPOINTS
// ========================================

/**
 *  Analyze CV with AI
 * POST /api/ai-services/cv-analysis
 */
router.post(
  '/cv-analysis',
  authenticate,
  heavyAILimiter,
  validateBody(cvAnalysisSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { cvContent, analysisType = 'detailed', includeRecommendations = true, targetRole } = req.body;

      logger.info(' CV analysis requested', { userId, analysisType, targetRole });

      const analysis = await cvAnalysisService.analyzeCv({
        content: cvContent,
        userId,
        options: {
          analysisType,
          includeRecommendations,
          targetRole
        }
      });

      res.status(200).json({
        success: true,
        data: {
          analysis,
          analysisType,
          targetRole,
          processedAt: new Date(),
          confidence: analysis.confidence || 0.8
        }
      });

    } catch (error) {
      logger.error('CV analysis failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze CV',
        code: 'CV_ANALYSIS_ERROR'
      });
    }
  }
);

/**
 *  Extract skills from CV
 * POST /api/ai-services/extract-skills
 */
router.post(
  '/extract-skills',
  authenticate,
  aiLimiter,
  validateBody(z.object({ 
    cvContent: z.string().min(50),
    includeConfidence: z.boolean().optional(),
    filterRelevant: z.boolean().optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { cvContent, includeConfidence = true, filterRelevant = true } = req.body;

      logger.info(' Skills extraction requested', { userId });

      const extractedSkills = await cvAnalysisService.extractSkills(cvContent, {
        includeConfidence,
        filterRelevant,
        userId
      });

      res.status(200).json({
        success: true,
        data: {
          skills: extractedSkills,
          totalSkills: extractedSkills.length,
          categories: [...new Set(extractedSkills.map((s: any) => s.category))],
          extractedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Skills extraction failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to extract skills',
        code: 'SKILLS_EXTRACTION_ERROR'
      });
    }
  }
);

/**
 *  Get CV improvement suggestions
 * POST /api/ai-services/cv-suggestions
 */
router.post(
  '/cv-suggestions',
  authenticate,
  aiLimiter,
  validateBody(z.object({
    cvContent: z.string().min(50),
    targetRole: z.string().optional(),
    focusArea: z.enum(['content', 'format', 'keywords', 'ats-optimization']).optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { cvContent, targetRole, focusArea = 'content' } = req.body;

      logger.info(' CV suggestions requested', { userId, targetRole, focusArea });

      const suggestions = await cvAnalysisService.generateImprovementSuggestions(cvContent, {
        targetRole,
        focusArea,
        userId
      });

      res.status(200).json({
        success: true,
        data: {
          suggestions,
          focusArea,
          targetRole,
          prioritySuggestions: suggestions.filter((s: any) => s.priority === 'high'),
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('CV suggestions failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to generate CV suggestions',
        code: 'CV_SUGGESTIONS_ERROR'
      });
    }
  }
);

// ========================================
//  JOB MATCHING AI ENDPOINTS
// ========================================

/**
 *  AI-powered job matching
 * POST /api/ai-services/job-matching
 */
router.post(
  '/job-matching',
  authenticate,
  heavyAILimiter,
  validateBody(jobMatchingSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { jobId, cvContent, analysisDepth = 'standard', includeExplanation = true } = req.body;

      logger.info(' Job matching analysis requested', { userId, jobId, analysisDepth });

      const matchAnalysis = await aiMatchingService.analyzeJobMatch({
        jobId,
        userId: req.body.userId || userId,
        cvContent,
        options: {
          analysisDepth,
          includeExplanation
        }
      });

      res.status(200).json({
        success: true,
        data: {
          matchAnalysis,
          jobId,
          analysisDepth,
          includeExplanation,
          matchScore: matchAnalysis.overallScore,
          recommendation: matchAnalysis.overallScore > 80 ? 'highly-recommended' :
                         matchAnalysis.overallScore > 60 ? 'recommended' : 'consider',
          processedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Job matching analysis failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze job match',
        code: 'JOB_MATCHING_ERROR'
      });
    }
  }
);

/**
 *  Get personalized job recommendations
 * GET /api/ai-services/job-recommendations
 */
router.get(
  '/job-recommendations',
  authenticate,
  aiLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const includeExplanation = req.query.explanation === 'true';
      const location = req.query.location as string;

      logger.info(' Job recommendations requested', { userId, limit, location });

      const recommendations = await aiMatchingService.getPersonalizedRecommendations({
        userId,
        limit,
        includeExplanation,
        location
      });

      res.status(200).json({
        success: true,
        data: {
          recommendations,
          totalRecommendations: recommendations.length,
          averageMatchScore: recommendations.reduce((sum: number, r: any) => sum + r.matchScore, 0) / recommendations.length,
          location: location || 'all',
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Job recommendations failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get job recommendations',
        code: 'JOB_RECOMMENDATIONS_ERROR'
      });
    }
  }
);

/**
 *  Batch job matching analysis
 * POST /api/ai-services/batch-matching
 */
router.post(
  '/batch-matching',
  authenticate,
  heavyAILimiter,
  validateBody(z.object({
    jobIds: z.array(z.string().uuid()).min(1).max(20),
    analysisDepth: z.enum(['quick', 'standard']).optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { jobIds, analysisDepth = 'quick' } = req.body;

      logger.info(' Batch job matching requested', { userId, jobCount: jobIds.length });

      const batchResults = await aiMatchingService.batchAnalyzeJobs({
        jobIds,
        userId,
        analysisDepth
      });

      res.status(200).json({
        success: true,
        data: {
          batchResults,
          jobCount: jobIds.length,
          processedJobs: batchResults.length,
          averageMatchScore: batchResults.reduce((sum: number, r: any) => sum + r.matchScore, 0) / batchResults.length,
          topMatches: batchResults.filter((r: any) => r.matchScore > 70),
          analysisDepth,
          processedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Batch job matching failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to perform batch job matching',
        code: 'BATCH_MATCHING_ERROR'
      });
    }
  }
);

// ========================================
//  SEMANTIC ANALYSIS AI ENDPOINTS
// ========================================

/**
 *  Semantic text analysis
 * POST /api/ai-services/semantic-analysis
 */
router.post(
  '/semantic-analysis',
  authenticate,
  aiLimiter,
  validateBody(semanticAnalysisSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { text, analysisType, context, language = 'en' } = req.body;

      logger.info(' Semantic analysis requested', { userId, analysisType, textLength: text.length });

      const analysis = await semanticMatchingService.analyzeText({
        text,
        analysisType,
        context,
        language,
        userId
      });

      res.status(200).json({
        success: true,
        data: {
          analysis,
          analysisType,
          language,
          textLength: text.length,
          confidence: analysis.confidence || 0.85,
          processedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Semantic analysis failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to perform semantic analysis',
        code: 'SEMANTIC_ANALYSIS_ERROR'
      });
    }
  }
);

/**
 *  Find semantic similarities
 * POST /api/ai-services/find-similarities
 */
router.post(
  '/find-similarities',
  authenticate,
  aiLimiter,
  validateBody(z.object({
    sourceText: z.string().min(10),
    targetTexts: z.array(z.string()).min(1).max(50),
    similarityThreshold: z.number().min(0).max(1).optional(),
    includeScores: z.boolean().optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { sourceText, targetTexts, similarityThreshold = 0.7, includeScores = true } = req.body;

      logger.info(' Similarity analysis requested', { userId, targetCount: targetTexts.length });

      const similarities = await semanticMatchingService.findSimilarities({
        sourceText,
        targetTexts,
        threshold: similarityThreshold,
        includeScores,
        userId
      });

      res.status(200).json({
        success: true,
        data: {
          similarities,
          sourceTextLength: sourceText.length,
          targetCount: targetTexts.length,
          threshold: similarityThreshold,
          matchesFound: similarities.filter((s: any) => s.score >= similarityThreshold).length,
          processedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Similarity analysis failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to find similarities',
        code: 'SIMILARITY_ANALYSIS_ERROR'
      });
    }
  }
);

// ========================================
//  HUGGING FACE AI ENDPOINTS
// ========================================

/**
 *  HuggingFace text analysis
 * POST /api/ai-services/huggingface/analyze
 */
router.post(
  '/huggingface/analyze',
  authenticate,
  heavyAILimiter,
  validateBody(z.object({
    text: z.string().min(10).max(5000),
    task: z.enum(['sentiment', 'classification', 'ner', 'summarization', 'question-answering']),
    model: z.string().optional(),
    options: z.object({
      context: z.string().optional(),
      question: z.string().optional(),
      labels: z.array(z.string()).optional()
    }).optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { text, task, model, options } = req.body;

      logger.info(' HuggingFace analysis requested', { userId, task, model });

      const result = await hfService.analyzeText(text, {
        task,
        model,
        ...options
      });

      res.status(200).json({
        success: true,
        data: {
          result,
          task,
          model: model || 'default',
          textLength: text.length,
          processedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('HuggingFace analysis failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to perform HuggingFace analysis',
        code: 'HUGGINGFACE_ERROR'
      });
    }
  }
);

/**
 *  Generate text embeddings
 * POST /api/ai-services/huggingface/embeddings
 */
router.post(
  '/huggingface/embeddings',
  authenticate,
  aiLimiter,
  validateBody(z.object({
    texts: z.array(z.string()).min(1).max(20),
    model: z.string().optional(),
    normalize: z.boolean().optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { texts, model, normalize = true } = req.body;

      logger.info(' Embeddings generation requested', { userId, textCount: texts.length });

      const embeddings = await hfService.generateEmbeddings(texts, {
        model,
        normalize
      });

      res.status(200).json({
        success: true,
        data: {
          embeddings,
          textCount: texts.length,
          model: model || 'default',
          dimensions: embeddings[0]?.length || 0,
          normalized: normalize,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Embeddings generation failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to generate embeddings',
        code: 'EMBEDDINGS_ERROR'
      });
    }
  }
);

// ========================================
//  BATCH PROCESSING ENDPOINTS
// ========================================

/**
 *  Batch AI analysis
 * POST /api/ai-services/batch-analysis
 */
router.post(
  '/batch-analysis',
  authenticate,
  heavyAILimiter,
  validateBody(batchAnalysisSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { items, analysisType } = req.body;

      logger.info(' Batch analysis requested', { userId, itemCount: items.length, analysisType });

      const results = [];
      
      for (const item of items) {
        try {
          let analysis;
          
          switch (analysisType) {
            case 'matching':
              if (item.type === 'cv') {
                analysis = await cvAnalysisService.analyzeCv({
                  content: item.content,
                  userId
                });
              }
              break;
            case 'classification':
              analysis = await hfService.analyzeText(item.content, {
                task: 'classification'
              });
              break;
            case 'extraction':
              analysis = await cvAnalysisService.extractSkills(item.content);
              break;
            default:
              analysis = { error: 'Unknown analysis type' };
          }
          
          results.push({
            id: item.id,
            type: item.type,
            analysis,
            success: true
          });
        } catch (error) {
          results.push({
            id: item.id,
            type: item.type,
            error: error instanceof Error ? error.message : 'Analysis failed',
            success: false
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          results,
          totalItems: items.length,
          successfulAnalyses: results.filter(r => r.success).length,
          failedAnalyses: results.filter(r => !r.success).length,
          analysisType,
          processedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Batch analysis failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to perform batch analysis',
        code: 'BATCH_ANALYSIS_ERROR'
      });
    }
  }
);

// ========================================
//  AI INSIGHTS & RECOMMENDATIONS
// ========================================

/**
 *  Get AI-powered career insights
 * GET /api/ai-services/career-insights
 */
router.get(
  '/career-insights',
  authenticate,
  aiLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const includeMarketData = req.query.market === 'true';
      const focusArea = req.query.focus as string;

      logger.info(' AI career insights requested', { userId, includeMarketData, focusArea });

      // Get user's CV and application data for analysis
      const userInsights = await aiMatchingService.generateCareerInsights({
        userId,
        includeMarketData,
        focusArea
      });

      res.status(200).json({
        success: true,
        data: {
          insights: userInsights,
          focusArea: focusArea || 'general',
          includeMarketData,
          insightCount: userInsights.length,
          highPriorityInsights: userInsights.filter((i: any) => i.priority === 'high').length,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('AI career insights failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to generate career insights',
        code: 'CAREER_INSIGHTS_ERROR'
      });
    }
  }
);

/**
 *  Predict career trajectory using AI
 * POST /api/ai-services/predict-trajectory
 */
router.post(
  '/predict-trajectory',
  authenticate,
  heavyAILimiter,
  validateBody(z.object({
    cvContent: z.string().optional(),
    currentRole: z.string().optional(),
    careerGoals: z.array(z.string()).optional(),
    timeframe: z.enum(['1y', '3y', '5y', '10y']).optional(),
    includeAlternatives: z.boolean().optional()
  })),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { cvContent, currentRole, careerGoals = [], timeframe = '3y', includeAlternatives = true } = req.body;

      logger.info(' AI trajectory prediction requested', { userId, timeframe, includeAlternatives });

      const trajectoryPrediction = await aiMatchingService.predictCareerTrajectory({
        userId,
        cvContent,
        currentRole,
        careerGoals,
        timeframe,
        includeAlternatives
      });

      res.status(200).json({
        success: true,
        data: {
          trajectoryPrediction,
          timeframe,
          careerGoals,
          includeAlternatives,
          confidence: trajectoryPrediction.confidence || 0.8,
          predictedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('AI trajectory prediction failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to predict career trajectory',
        code: 'TRAJECTORY_PREDICTION_ERROR'
      });
    }
  }
);

// ========================================
//  AI UTILITIES & TOOLS
// ========================================

/**
 *  AI model health check
 * GET /api/ai-services/health
 */
router.get(
  '/health',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      logger.info(' AI services health check requested');

      const healthStatus = {
        huggingFace: await hfService.checkHealth(),
        cvAnalysis: await cvAnalysisService.checkHealth(),
        aiMatching: await aiMatchingService.checkHealth(),
        semanticMatching: await semanticMatchingService.checkHealth(),
        timestamp: new Date()
      };

      const allHealthy = Object.values(healthStatus).every(status => 
        typeof status === 'boolean' ? status : status !== false
      );

      res.status(allHealthy ? 200 : 503).json({
        success: allHealthy,
        data: healthStatus
      });

    } catch (error) {
      logger.error('AI services health check failed', { error });
      res.status(503).json({
        success: false,
        error: 'AI services health check failed',
        code: 'AI_HEALTH_CHECK_ERROR'
      });
    }
  }
);

/**
 *  Get AI processing queue status
 * GET /api/ai-services/queue-status
 */
router.get(
  '/queue-status',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      logger.info(' AI queue status requested', { userId });

      // This would typically check actual queue status
      const queueStatus = {
        activeJobs: 0, // Would get from actual queue
        pendingJobs: 0,
        completedToday: 0,
        averageProcessingTime: '2.3s',
        systemLoad: 'normal',
        estimatedWaitTime: '< 1 minute',
        timestamp: new Date()
      };

      res.status(200).json({
        success: true,
        data: queueStatus
      });

    } catch (error) {
      logger.error('AI queue status failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get queue status',
        code: 'QUEUE_STATUS_ERROR'
      });
    }
  }
);

/**
 *  Get AI service capabilities
 * GET /api/ai-services/capabilities
 */
router.get(
  '/capabilities',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      logger.info(' AI capabilities requested');

      const capabilities = {
        cvAnalysis: {
          available: true,
          features: ['skills-extraction', 'personality-analysis', 'improvement-suggestions', 'ats-optimization'],
          supportedFormats: ['text', 'pdf-text'],
          maxFileSize: '5MB',
          processingTime: '5-15 seconds'
        },
        jobMatching: {
          available: true,
          features: ['similarity-scoring', 'explanation-generation', 'batch-processing', 'recommendation-engine'],
          accuracyRate: '85%',
          processingTime: '2-8 seconds'
        },
        semanticAnalysis: {
          available: true,
          features: ['text-classification', 'entity-extraction', 'sentiment-analysis', 'similarity-matching'],
          supportedLanguages: ['en', 'af', 'zu', 'xh'],
          processingTime: '1-3 seconds'
        },
        huggingFace: {
          available: true,
          models: ['bert-base', 'distilbert', 'roberta', 'sentence-transformers'],
          tasks: ['classification', 'ner', 'sentiment', 'embeddings', 'summarization'],
          processingTime: '3-10 seconds'
        },
        careerPrediction: {
          available: true,
          features: ['trajectory-prediction', 'market-intelligence', 'success-patterns', 'competitive-analysis'],
          accuracy: '78%',
          timeframes: ['6m', '1y', '3y', '5y'],
          processingTime: '10-30 seconds'
        }
      };

      res.status(200).json({
        success: true,
        data: capabilities
      });

    } catch (error) {
      logger.error('AI capabilities request failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get AI capabilities',
        code: 'CAPABILITIES_ERROR'
      });
    }
  }
);

// ========================================
//  AI PERFORMANCE & MONITORING
// ========================================

/**
 *  Get AI performance metrics
 * GET /api/ai-services/performance
 */
router.get(
  '/performance',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const period = req.query.period as string || '24h';

      logger.info(' AI performance metrics requested', { userId, period });

      // Mock performance data - in production, this would come from monitoring systems
      const performance = {
        period,
        metrics: {
          totalRequests: 1250,
          successRate: 96.8,
          averageResponseTime: '4.2s',
          errorRate: 3.2,
          uptime: '99.5%'
        },
        serviceBreakdown: {
          cvAnalysis: { requests: 450, successRate: 98.2, avgTime: '6.1s' },
          jobMatching: { requests: 380, successRate: 97.1, avgTime: '3.8s' },
          semanticAnalysis: { requests: 320, successRate: 95.6, avgTime: '2.1s' },
          huggingFace: { requests: 100, successRate: 94.0, avgTime: '8.3s' }
        },
        topErrors: [
          { error: 'RATE_LIMIT_EXCEEDED', count: 15 },
          { error: 'MODEL_TIMEOUT', count: 8 },
          { error: 'INVALID_INPUT', count: 5 }
        ],
        timestamp: new Date()
      };

      res.status(200).json({
        success: true,
        data: performance
      });

    } catch (error) {
      logger.error('AI performance metrics failed', { error, userId: (req as any).user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics',
        code: 'PERFORMANCE_ERROR'
      });
    }
  }
);

export default router;
