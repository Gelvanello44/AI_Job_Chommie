import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { SemanticMatchingService } from '../services/semantic-matching.service.js';
import { AIMatchingService } from '../services/ai-matching.service.js';
import logger from '../config/logger.js';
import { body, param, query } from 'express-validator';
import { cache } from '../config/redis.js';

const router = Router();

// Initialize services
const semanticMatchingService = new SemanticMatchingService();
const aiMatchingService = new AIMatchingService();

// Apply authentication to all routes
router.use(authenticate);

/**
 *  Calculate Real-time Job-CV Similarity
 * POST /api/similarity-engine/calculate
 */
router.post('/calculate',
  body('cvContent').isString().notEmpty().withMessage('CV content required'),
  body('jobDescription').isString().notEmpty().withMessage('Job description required'),
  body('options').isObject().optional(),
  async (req: Request, res: Response) => {
    try {
      const { cvContent, jobDescription, options = {} } = req.body;
      const userId = req.user?.id;

      logger.info(' Calculating real-time job-CV similarity', { userId, options });

      // Check cache first
      const cacheKey = `similarity:${userId}:${Buffer.from(cvContent + jobDescription).toString('base64').substring(0, 32)}`;
      const cached = await cache.get(cacheKey);
      if (cached && !options.skipCache) {
        return res.json({
          success: true,
          data: JSON.parse(cached as string),
          cached: true
        });
      }

      // Calculate comprehensive similarity
      const similarityScore = await semanticMatchingService.computeJobCvSimilarity(
        cvContent,
        jobDescription,
        options.industry
      );

      // Get detailed similarity breakdown
      const similarityBreakdown = await semanticMatchingService.getSimilarityBreakdown(
        cvContent,
        jobDescription
      );

      // Get keyword overlap analysis
      const keywordAnalysis = await aiMatchingService.analyzeKeywordOverlap(
        cvContent,
        jobDescription
      );

      // Get contextual similarity
      const contextualSimilarity = await semanticMatchingService.analyzeContextualSimilarity(
        cvContent,
        jobDescription
      );

      const result = {
        overallSimilarity: similarityScore,
        breakdown: {
          semantic: similarityBreakdown.semantic,
          keyword: similarityBreakdown.keyword,
          structural: similarityBreakdown.structural,
          contextual: contextualSimilarity.score
        },
        keywordAnalysis,
        contextualInsights: contextualSimilarity.insights,
        confidence: similarityBreakdown.confidence,
        recommendations: similarityBreakdown.recommendations
      };

      // Cache for 1 hour
      await cache.set(cacheKey, JSON.stringify(result), 3600);

      res.json({
        success: true,
        data: result,
        cached: false
      });

    } catch (error) {
      logger.error('Error calculating similarity', { error, userId: req.user?.id });
      throw new AppError(500, 'Similarity calculation failed');
    }
  }
);

/**
 *  Multi-Modal Similarity Analysis
 * POST /api/similarity-engine/multi-modal
 */
router.post('/multi-modal',
  body('cvData').isObject().withMessage('CV data required'),
  body('jobData').isObject().withMessage('Job data required'),
  body('modalities').isArray().optional(),
  async (req: Request, res: Response) => {
    try {
      const { cvData, jobData, modalities = ['text', 'skills', 'experience'] } = req.body;
      const userId = req.user?.id;

      logger.info(' Processing multi-modal similarity analysis', { userId, modalities });

      const modalityScores: Record<string, number> = {};
      const modalityAnalysis: Record<string, any> = {};

      // Text similarity
      if (modalities.includes('text') && cvData.content && jobData.description) {
        const textSimilarity = await semanticMatchingService.computeJobCvSimilarity(
          cvData.content,
          jobData.description
        );
        modalityScores.text = textSimilarity;
        modalityAnalysis.text = {
          score: textSimilarity,
          confidence: 'high',
          weight: 0.4
        };
      }

      // Skills similarity
      if (modalities.includes('skills') && cvData.skills && jobData.requiredSkills) {
        const skillsSimilarity = await aiMatchingService.calculateSkillSimilarity(
          cvData.skills,
          jobData.requiredSkills,
          jobData.preferredSkills
        );
        modalityScores.skills = skillsSimilarity;
        modalityAnalysis.skills = {
          score: skillsSimilarity,
          confidence: 'high',
          weight: 0.3
        };
      }

      // Experience similarity
      if (modalities.includes('experience') && cvData.experience !== undefined && jobData.experienceRequired !== undefined) {
        const expSimilarity = aiMatchingService.calculateExperienceSimilarity(
          cvData.experience,
          jobData.experienceRequired
        );
        modalityScores.experience = expSimilarity;
        modalityAnalysis.experience = {
          score: expSimilarity,
          confidence: 'medium',
          weight: 0.2
        };
      }

      // Education similarity
      if (modalities.includes('education') && cvData.education && jobData.educationRequired) {
        const eduSimilarity = aiMatchingService.calculateEducationSimilarity(
          cvData.education,
          jobData.educationRequired
        );
        modalityScores.education = eduSimilarity;
        modalityAnalysis.education = {
          score: eduSimilarity,
          confidence: 'medium',
          weight: 0.1
        };
      }

      // Calculate weighted overall score
      let overallScore = 0;
      let totalWeight = 0;
      for (const [modality, analysis] of Object.entries(modalityAnalysis)) {
        overallScore += (analysis.score * analysis.weight);
        totalWeight += analysis.weight;
      }
      if (totalWeight > 0) {
        overallScore = overallScore / totalWeight;
      }

      res.json({
        success: true,
        data: {
          overallScore,
          modalityScores,
          modalityAnalysis,
          synthesis: {
            strongestModality: Object.entries(modalityScores).reduce((a, b) => b[1] > a[1] ? b : a)[0],
            weakestModality: Object.entries(modalityScores).reduce((a, b) => b[1] < a[1] ? b : a)[0],
            recommendation: overallScore > 0.7 ? 'Strong Match' : overallScore > 0.5 ? 'Good Match' : 'Weak Match'
          }
        }
      });

    } catch (error) {
      logger.error('Error in multi-modal similarity analysis', { error, userId: req.user?.id });
      throw new AppError(500, 'Multi-modal similarity analysis failed');
    }
  }
);

/**
 *  Bulk Similarity Comparison
 * POST /api/similarity-engine/bulk-compare
 */
router.post('/bulk-compare',
  body('cvContent').isString().notEmpty().withMessage('CV content required'),
  body('jobDescriptions').isArray().notEmpty().withMessage('Job descriptions array required'),
  body('limit').isInt().optional(),
  async (req: Request, res: Response) => {
    try {
      const { cvContent, jobDescriptions, limit = 10 } = req.body;
      const userId = req.user?.id;

      logger.info(' Processing bulk similarity comparison', { 
        userId, 
        jobCount: jobDescriptions.length,
        limit 
      });

      // Process similarities in parallel (with concurrency limit)
      const batchSize = 5;
      const results = [];
      
      for (let i = 0; i < jobDescriptions.length; i += batchSize) {
        const batch = jobDescriptions.slice(i, i + batchSize);
        const batchPromises = batch.map(async (job: any) => {
          const similarity = await semanticMatchingService.computeJobCvSimilarity(
            cvContent,
            job.description || job.jobDescription,
            job.industry
          );
          
          return {
            jobId: job.id || job.jobId,
            title: job.title,
            company: job.company,
            similarity,
            industry: job.industry
          };
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      // Sort by similarity score
      results.sort((a, b) => b.similarity - a.similarity);

      // Apply limit
      const topResults = results.slice(0, limit);

      res.json({
        success: true,
        data: {
          totalCompared: jobDescriptions.length,
          results: topResults,
          statistics: {
            averageSimilarity: results.reduce((sum, r) => sum + r.similarity, 0) / results.length,
            highestSimilarity: results[0]?.similarity || 0,
            lowestSimilarity: results[results.length - 1]?.similarity || 0,
            matchDistribution: {
              excellent: results.filter(r => r.similarity > 0.8).length,
              good: results.filter(r => r.similarity > 0.6 && r.similarity <= 0.8).length,
              fair: results.filter(r => r.similarity > 0.4 && r.similarity <= 0.6).length,
              poor: results.filter(r => r.similarity <= 0.4).length
            }
          }
        }
      });

    } catch (error) {
      logger.error('Error in bulk similarity comparison', { error, userId: req.user?.id });
      throw new AppError(500, 'Bulk similarity comparison failed');
    }
  }
);

/**
 *  Real-time Similarity Updates
 * POST /api/similarity-engine/real-time-update
 */
router.post('/real-time-update',
  body('sessionId').isString().notEmpty().withMessage('Session ID required'),
  body('cvContent').isString().notEmpty().withMessage('CV content required'),
  body('jobId').isUUID().withMessage('Valid job ID required'),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, cvContent, jobId } = req.body;
      const userId = req.user?.id;

      logger.info(' Processing real-time similarity update', { userId, sessionId, jobId });

      // Get job details
      const job = await aiMatchingService.getJobDetails(jobId);
      
      if (!job) {
        throw new AppError(404, 'Job not found');
      }

      // Calculate updated similarity
      const similarity = await semanticMatchingService.computeJobCvSimilarity(
        cvContent,
        job.description,
        job.industry
      );

      // Get improvement suggestions
      const improvements = await aiMatchingService.getSimilarityImprovements(
        cvContent,
        job.description,
        similarity
      );

      // Store in session cache for quick updates
      const sessionKey = `session:${sessionId}:${jobId}`;
      await cache.set(sessionKey, JSON.stringify({
        similarity,
        improvements,
        timestamp: new Date().toISOString()
      }), 300); // 5 minute cache

      res.json({
        success: true,
        data: {
          jobId,
          similarity,
          previousSimilarity: req.body.previousSimilarity || null,
          change: req.body.previousSimilarity ? similarity - req.body.previousSimilarity : null,
          improvements,
          sessionId
        }
      });

    } catch (error) {
      logger.error('Error in real-time similarity update', { error, userId: req.user?.id });
      throw new AppError(500, 'Real-time similarity update failed');
    }
  }
);

/**
 *  Similarity Trend Analysis
 * GET /api/similarity-engine/trends/:userId
 */
router.get('/trends/:userId',
  param('userId').isUUID().optional(),
  query('period').isString().optional(),
  async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.userId || req.user?.id;
      const period = req.query.period as string || '7days';

      if (!targetUserId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Getting similarity trend analysis', { targetUserId, period });

      // Get historical similarity data
      const trends = await semanticMatchingService.getSimilarityTrends(
        targetUserId,
        period
      );

      res.json({
        success: true,
        data: {
          userId: targetUserId,
          period,
          trends,
          insights: {
            averageImprovement: trends.averageImprovement,
            topPerformingIndustries: trends.topIndustries,
            recommendedFocus: trends.recommendedFocus
          }
        }
      });

    } catch (error) {
      logger.error('Error getting similarity trends', { error });
      throw new AppError(500, 'Failed to get similarity trends');
    }
  }
);

export { router as similarityEngineRoutes };
