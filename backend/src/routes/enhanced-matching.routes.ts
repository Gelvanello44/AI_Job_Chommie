import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { AIMatchingService } from '../services/ai-matching.service.js';
import { SemanticMatchingService } from '../services/semantic-matching.service.js';
import { IndustryLanguageService } from '../services/industry-language.service.js';
import logger from '../config/logger.js';
import { body, param, query } from 'express-validator';

const router = Router();

// Initialize services
const aiMatchingService = new AIMatchingService();
const semanticMatchingService = new SemanticMatchingService();
const industryLanguageService = new IndustryLanguageService();

// Apply authentication to all routes
router.use(authenticate);

/**
 *  Enhanced Semantic Matching - Deep CV-Job Similarity
 * POST /api/enhanced-matching/semantic-match
 */
router.post('/semantic-match',
  body('cvContent').isString().notEmpty().withMessage('CV content required'),
  body('jobDescription').isString().notEmpty().withMessage('Job description required'),
  body('industry').isString().optional(),
  async (req: Request, res: Response) => {
    try {
      const { cvContent, jobDescription, industry } = req.body;
      const userId = req.user?.id;

      logger.info(' Processing enhanced semantic matching request', { userId, industry });

      // Calculate enhanced semantic similarity
      const semanticScore = await semanticMatchingService.computeJobCvSimilarity(
        cvContent,
        jobDescription,
        industry
      );

      // Get detailed semantic analysis
      const semanticAnalysis = await semanticMatchingService.analyzeSemanticAlignment(
        cvContent,
        jobDescription
      );

      res.json({
        success: true,
        data: {
          semanticScore,
          semanticAnalysis,
          confidence: semanticAnalysis.confidence,
          recommendation: semanticScore > 0.7 ? 'Strong Match' : semanticScore > 0.5 ? 'Good Match' : 'Weak Match',
          insights: {
            keyMatchingConcepts: semanticAnalysis.matchingConcepts,
            missingElements: semanticAnalysis.gaps,
            improvementAreas: semanticAnalysis.suggestions
          }
        }
      });

    } catch (error) {
      logger.error('Error in semantic matching', { error, userId: req.user?.id });
      throw new AppError(500, 'Semantic matching failed');
    }
  }
);

/**
 *  Industry-Specific Embeddings Analysis
 * POST /api/enhanced-matching/industry-embeddings
 */
router.post('/industry-embeddings',
  body('text').isString().notEmpty().withMessage('Text content required'),
  body('industry').isString().notEmpty().withMessage('Industry required'),
  body('role').isString().optional(),
  async (req: Request, res: Response) => {
    try {
      const { text, industry, role } = req.body;
      const userId = req.user?.id;

      logger.info(' Processing industry-specific embeddings', { userId, industry, role });

      // Generate industry-specific embeddings
      const embeddings = await semanticMatchingService.generateIndustryEmbeddings(
        text,
        industry,
        role
      );

      // Analyze industry language alignment
      const industryAlignment = await industryLanguageService.analyzeIndustryLanguage(
        text,
        industry
      );

      // Get industry-specific keywords and concepts
      const industryKeywords = await industryLanguageService.extractIndustryKeywords(
        text,
        industry
      );

      res.json({
        success: true,
        data: {
          embeddings: {
            dimension: embeddings.length,
            summary: `${embeddings.length}-dimensional industry-specific embedding generated`,
            industryFocus: industry,
            roleFocus: role || 'general'
          },
          industryAlignment,
          industryKeywords,
          recommendations: industryAlignment.recommendations
        }
      });

    } catch (error) {
      logger.error('Error generating industry embeddings', { error, userId: req.user?.id });
      throw new AppError(500, 'Industry embedding generation failed');
    }
  }
);

/**
 *  Personality-Job Fit Analysis with Deep Learning
 * POST /api/enhanced-matching/personality-fit
 */
router.post('/personality-fit',
  body('jobId').isUUID().withMessage('Valid job ID required'),
  body('personalityProfile').isObject().optional(),
  async (req: Request, res: Response) => {
    try {
      const { jobId, personalityProfile } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Processing personality-job fit analysis', { userId, jobId });

      // Get enhanced personality fit analysis
      const personalityFit = await aiMatchingService.analyzePersonalityFit(
        userId,
        jobId,
        personalityProfile
      );

      // Get personality-based recommendations
      const personalityRecommendations = await aiMatchingService.getPersonalityBasedRecommendations(
        userId,
        jobId
      );

      res.json({
        success: true,
        data: {
          jobId,
          personalityFitScore: personalityFit.score,
          dimensions: personalityFit.dimensions,
          culturalAlignment: personalityFit.culturalAlignment,
          workStyleMatch: personalityFit.workStyleMatch,
          communicationFit: personalityFit.communicationFit,
          teamDynamics: personalityFit.teamDynamics,
          recommendations: personalityRecommendations,
          insights: personalityFit.insights,
          confidence: personalityFit.confidence
        }
      });

    } catch (error) {
      logger.error('Error in personality fit analysis', { error, userId: req.user?.id });
      throw new AppError(500, 'Personality fit analysis failed');
    }
  }
);

/**
 *  Multi-Modal Matching Analysis
 * POST /api/enhanced-matching/multi-modal
 */
router.post('/multi-modal',
  body('userId').isUUID().optional(),
  body('jobId').isUUID().withMessage('Valid job ID required'),
  body('cvContent').isString().optional(),
  body('portfolio').isArray().optional(),
  body('assessmentResults').isObject().optional(),
  async (req: Request, res: Response) => {
    try {
      const { jobId, cvContent, portfolio, assessmentResults } = req.body;
      const userId = req.body.userId || req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Processing multi-modal matching analysis', { userId, jobId });

      // Perform multi-modal analysis
      const multiModalAnalysis = await aiMatchingService.performMultiModalMatching(
        userId,
        jobId,
        {
          cvContent,
          portfolio,
          assessmentResults
        }
      );

      res.json({
        success: true,
        data: {
          jobId,
          overallScore: multiModalAnalysis.overallScore,
          modalScores: {
            textual: multiModalAnalysis.textualScore,
            behavioral: multiModalAnalysis.behavioralScore,
            portfolio: multiModalAnalysis.portfolioScore,
            assessment: multiModalAnalysis.assessmentScore
          },
          synthesis: multiModalAnalysis.synthesis,
          recommendations: multiModalAnalysis.recommendations,
          confidence: multiModalAnalysis.confidence,
          insights: multiModalAnalysis.insights
        }
      });

    } catch (error) {
      logger.error('Error in multi-modal matching', { error, userId: req.user?.id });
      throw new AppError(500, 'Multi-modal matching failed');
    }
  }
);

/**
 *  Batch Enhanced Matching
 * POST /api/enhanced-matching/batch
 */
router.post('/batch',
  body('jobIds').isArray().notEmpty().withMessage('Job IDs array required'),
  body('options').isObject().optional(),
  async (req: Request, res: Response) => {
    try {
      const { jobIds, options = {} } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Processing batch enhanced matching', { userId, jobCount: jobIds.length });

      // Perform batch matching with enhanced features
      const batchResults = await aiMatchingService.performBatchEnhancedMatching(
        userId,
        jobIds,
        options
      );

      res.json({
        success: true,
        data: {
          totalJobs: jobIds.length,
          processedJobs: batchResults.length,
          matches: batchResults,
          summary: {
            excellentMatches: batchResults.filter(r => r.overallScore > 0.85).length,
            goodMatches: batchResults.filter(r => r.overallScore > 0.70 && r.overallScore <= 0.85).length,
            fairMatches: batchResults.filter(r => r.overallScore > 0.50 && r.overallScore <= 0.70).length,
            weakMatches: batchResults.filter(r => r.overallScore <= 0.50).length
          }
        }
      });

    } catch (error) {
      logger.error('Error in batch enhanced matching', { error, userId: req.user?.id });
      throw new AppError(500, 'Batch enhanced matching failed');
    }
  }
);

export { router as enhancedMatchingRoutes };
