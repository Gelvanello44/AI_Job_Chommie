import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { AIMatchingService } from '../services/ai-matching.service.js';
import { HuggingFaceService } from '../services/huggingface.service.js';
import logger from '../config/logger.js';
import { body, param, query } from 'express-validator';
import { cache } from '../config/redis.js';
import { Queue } from 'bullmq';
import { prisma } from '../config/database.js';

const router = Router();

// Initialize services
const aiMatchingService = new AIMatchingService();
const huggingfaceService = HuggingFaceService.getInstance();

// Initialize job queue for batch processing
const inferenceQueue = new Queue('inference-pipeline', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD,
  }
});

// Apply authentication to all routes
router.use(authenticate);

/**
 *  Real-time Inference
 * POST /api/inference-pipeline/real-time
 */
router.post('/real-time',
  body('input').isObject().withMessage('Input data required'),
  body('model').isString().withMessage('Model type required'),
  body('options').isObject().optional(),
  async (req: Request, res: Response) => {
    try {
      const { input, model, options = {} } = req.body;
      const userId = req.user?.id;

      logger.info(' Processing real-time inference', { userId, model });

      // Check cache for recent predictions
      const cacheKey = `inference:${model}:${JSON.stringify(input)}`;
      if (!options.skipCache) {
        const cached = await cache.get(cacheKey);
        if (cached) {
          return res.json({
            success: true,
            data: JSON.parse(cached as string),
            cached: true,
            latency: 0
          });
        }
      }

      const startTime = Date.now();
      let result;

      // Route to appropriate model
      switch (model) {
        case 'job-matching':
          result = await inferJobMatching(input, options);
          break;
        case 'skills-extraction':
          result = await inferSkillsExtraction(input, options);
          break;
        case 'personality-analysis':
          result = await inferPersonalityAnalysis(input, options);
          break;
        case 'semantic-similarity':
          result = await inferSemanticSimilarity(input, options);
          break;
        case 'career-prediction':
          result = await inferCareerPrediction(input, options);
          break;
        default:
          throw new AppError(400, 'Invalid model type');
      }

      const latency = Date.now() - startTime;

      // Cache result for 5 minutes
      await cache.set(cacheKey, JSON.stringify(result), 300);

      res.json({
        success: true,
        data: result,
        cached: false,
        latency,
        model,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in real-time inference', { error, userId: req.user?.id });
      throw new AppError(500, 'Real-time inference failed');
    }
  }
);

/**
 *  Batch Inference Processing
 * POST /api/inference-pipeline/batch
 */
router.post('/batch',
  body('inputs').isArray().notEmpty().withMessage('Batch inputs required'),
  body('model').isString().withMessage('Model type required'),
  body('options').isObject().optional(),
  async (req: Request, res: Response) => {
    try {
      const { inputs, model, options = {} } = req.body;
      const userId = req.user?.id;

      logger.info(' Starting batch inference', { 
        userId, 
        model, 
        batchSize: inputs.length 
      });

      // Create batch job
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Add job to queue
      const job = await inferenceQueue.add('batch-inference', {
        batchId,
        userId,
        model,
        inputs,
        options
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });

      // Store batch metadata
      await storeBatchMetadata(batchId, {
        userId,
        model,
        inputCount: inputs.length,
        status: 'queued',
        jobId: job.id,
        createdAt: new Date().toISOString()
      });

      res.json({
        success: true,
        data: {
          batchId,
          jobId: job.id,
          status: 'queued',
          inputCount: inputs.length,
          estimatedTime: calculateEstimatedTime(inputs.length, model),
          statusUrl: `/api/inference-pipeline/batch/${batchId}/status`,
          resultUrl: `/api/inference-pipeline/batch/${batchId}/results`
        }
      });

    } catch (error) {
      logger.error('Error starting batch inference', { error, userId: req.user?.id });
      throw new AppError(500, 'Batch inference initialization failed');
    }
  }
);

/**
 *  Get Batch Status
 * GET /api/inference-pipeline/batch/:batchId/status
 */
router.get('/batch/:batchId/status',
  param('batchId').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const userId = req.user?.id;

      logger.info(' Checking batch status', { userId, batchId });

      // Get batch metadata
      const metadata = await getBatchMetadata(batchId);
      
      if (!metadata) {
        throw new AppError(404, 'Batch not found');
      }

      // Check if user owns this batch
      if (metadata.userId !== userId) {
        throw new AppError(403, 'Access denied');
      }

      // Get job status from queue
      const job = await inferenceQueue.getJob(metadata.jobId);
      const jobStatus = await job?.getState();
      const progress = job?.progress || 0;

      res.json({
        success: true,
        data: {
          batchId,
          status: jobStatus || metadata.status,
          progress,
          inputCount: metadata.inputCount,
          processedCount: Math.floor((progress / 100) * metadata.inputCount),
          createdAt: metadata.createdAt,
          completedAt: metadata.completedAt,
          estimatedTimeRemaining: jobStatus === 'active' ? 
            calculateRemainingTime(progress, metadata.inputCount) : null
        }
      });

    } catch (error) {
      logger.error('Error checking batch status', { error });
      throw new AppError(500, 'Failed to get batch status');
    }
  }
);

/**
 *  Get Batch Results
 * GET /api/inference-pipeline/batch/:batchId/results
 */
router.get('/batch/:batchId/results',
  param('batchId').isString().notEmpty(),
  query('format').isString().optional(),
  async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const { format = 'json' } = req.query;
      const userId = req.user?.id;

      logger.info(' Getting batch results', { userId, batchId, format });

      // Get batch metadata
      const metadata = await getBatchMetadata(batchId);
      
      if (!metadata) {
        throw new AppError(404, 'Batch not found');
      }

      // Check if user owns this batch
      if (metadata.userId !== userId) {
        throw new AppError(403, 'Access denied');
      }

      // Get job from queue
      const job = await inferenceQueue.getJob(metadata.jobId);
      const jobState = await job?.getState();

      if (jobState !== 'completed') {
        throw new AppError(400, `Batch is ${jobState}. Results not available yet.`);
      }

      // Get results
      const results = await job.returnvalue;

      if (format === 'csv') {
        // Convert to CSV format
        const csv = convertResultsToCSV(results);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${batchId}.csv`);
        return res.send(csv);
      }

      res.json({
        success: true,
        data: {
          batchId,
          results,
          summary: generateResultsSummary(results),
          processingTime: metadata.processingTime,
          completedAt: metadata.completedAt
        }
      });

    } catch (error) {
      logger.error('Error getting batch results', { error });
      throw new AppError(500, 'Failed to get batch results');
    }
  }
);

/**
 *  Stream Inference Results
 * POST /api/inference-pipeline/stream
 */
router.post('/stream',
  body('inputs').isArray().notEmpty().withMessage('Input stream required'),
  body('model').isString().withMessage('Model type required'),
  async (req: Request, res: Response) => {
    try {
      const { inputs, model } = req.body;
      const userId = req.user?.id;

      logger.info(' Starting streaming inference', { userId, model });

      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      // Process inputs in stream
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        
        try {
          const result = await processStreamingInference(input, model);
          
          // Send result as SSE
          res.write(`data: ${JSON.stringify({
            index: i,
            total: inputs.length,
            progress: ((i + 1) / inputs.length * 100).toFixed(1),
            result
          })}\n\n`);
          
        } catch (error) {
          // Send error for this input
          res.write(`data: ${JSON.stringify({
            index: i,
            error: error.message
          })}\n\n`);
        }
      }

      // Send completion event
      res.write('event: complete\ndata: {"status": "completed"}\n\n');
      res.end();

    } catch (error) {
      logger.error('Error in streaming inference', { error });
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
);

/**
 *  Model-specific Inference Endpoints
 * POST /api/inference-pipeline/models/:modelName
 */
router.post('/models/:modelName',
  param('modelName').isString().notEmpty(),
  body('input').notEmpty().withMessage('Input required'),
  async (req: Request, res: Response) => {
    try {
      const { modelName } = req.params;
      const { input } = req.body;
      const userId = req.user?.id;

      logger.info(' Model-specific inference', { userId, modelName });

      let result;
      
      switch (modelName) {
        case 'bert-job-matching':
          result = await huggingfaceService.runBertJobMatching(input);
          break;
        case 'skill-ner':
          result = await huggingfaceService.runSkillNER(input);
          break;
        case 'sentiment-analysis':
          result = await huggingfaceService.runSentimentAnalysis(input);
          break;
        case 'industry-classifier':
          result = await huggingfaceService.runIndustryClassifier(input);
          break;
        default:
          throw new AppError(400, 'Unknown model');
      }

      res.json({
        success: true,
        data: {
          model: modelName,
          result,
          confidence: result.confidence || result.score || null
        }
      });

    } catch (error) {
      logger.error('Error in model-specific inference', { error });
      throw new AppError(500, 'Model inference failed');
    }
  }
);

/**
 *  Get Model Performance Metrics
 * GET /api/inference-pipeline/metrics
 */
router.get('/metrics',
  query('model').isString().optional(),
  query('period').isString().optional(),
  async (req: Request, res: Response) => {
    try {
      const { model, period = '24h' } = req.query;
      const userId = req.user?.id;

      logger.info(' Getting inference metrics', { userId, model, period });

      const metrics = await getInferenceMetrics(
        model as string,
        period as string
      );

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Error getting inference metrics', { error });
      throw new AppError(500, 'Failed to get metrics');
    }
  }
);

/**
 *  Model Configuration
 * GET /api/inference-pipeline/config
 */
router.get('/config',
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      logger.info(' Getting model configuration', { userId });

      const config = {
        availableModels: [
          {
            name: 'job-matching',
            description: 'Advanced job-CV matching with personality analysis',
            inputFormat: { cvContent: 'string', jobDescription: 'string' },
            outputFormat: { score: 'number', explanation: 'string' }
          },
          {
            name: 'skills-extraction',
            description: 'Extract and categorize skills from text',
            inputFormat: { text: 'string' },
            outputFormat: { skills: 'array', categories: 'object' }
          },
          {
            name: 'personality-analysis',
            description: 'Analyze personality traits from CV/profile',
            inputFormat: { text: 'string', userData: 'object' },
            outputFormat: { traits: 'object', confidence: 'number' }
          },
          {
            name: 'semantic-similarity',
            description: 'Calculate semantic similarity between texts',
            inputFormat: { text1: 'string', text2: 'string' },
            outputFormat: { similarity: 'number', details: 'object' }
          },
          {
            name: 'career-prediction',
            description: 'Predict career trajectory and recommendations',
            inputFormat: { profile: 'object', history: 'array' },
            outputFormat: { predictions: 'array', recommendations: 'array' }
          }
        ],
        limits: {
          realTime: {
            maxInputSize: '10MB',
            timeout: '30s',
            rateLimit: '100/minute'
          },
          batch: {
            maxBatchSize: 1000,
            maxFileSize: '50MB',
            timeout: '30m'
          },
          stream: {
            maxConcurrent: 10,
            maxDuration: '5m'
          }
        }
      };

      res.json({
        success: true,
        data: config
      });

    } catch (error) {
      logger.error('Error getting model config', { error });
      throw new AppError(500, 'Failed to get configuration');
    }
  }
);

// Helper functions

async function inferJobMatching(input: any, options: any): Promise<any> {
  const { cvContent, jobDescription, includePersonality = true } = input;
  
  // Run semantic matching
  const semanticScore = await aiMatchingService.calculateSemanticMatch(
    cvContent,
    jobDescription
  );
  
  // Extract skills and match
  const cvSkills = await aiMatchingService.extractSkillsFromText(cvContent);
  const jobSkills = await aiMatchingService.extractSkillsFromText(jobDescription);
  const skillsMatch = await aiMatchingService.calculateSkillsMatch(cvSkills, jobSkills);
  
  // Personality analysis if requested
  let personalityMatch = null;
  if (includePersonality) {
    personalityMatch = await aiMatchingService.analyzePersonalityMatch(cvContent, jobDescription);
  }
  
  return {
    overallScore: (semanticScore + skillsMatch) / 2,
    semanticScore,
    skillsMatch,
    personalityMatch,
    recommendation: generateMatchRecommendation(semanticScore, skillsMatch, personalityMatch)
  };
}

async function inferSkillsExtraction(input: any, options: any): Promise<any> {
  const { text, includeCategories = true, includeHierarchy = false } = input;
  
  // Extract skills using NLP
  const skills = await aiMatchingService.extractSkillsFromText(text);
  
  let result: any = { skills };
  
  if (includeCategories) {
    result.categories = categorizeExtractedSkills(skills);
  }
  
  if (includeHierarchy) {
    result.hierarchy = buildSkillHierarchy(skills);
  }
  
  return result;
}

async function inferPersonalityAnalysis(input: any, options: any): Promise<any> {
  const { text, userData } = input;
  
  // Analyze text for personality indicators
  const textAnalysis = await analyzeTextForPersonality(text);
  
  // Combine with user data if available
  const combinedAnalysis = userData ? 
    combinePersonalityData(textAnalysis, userData) : 
    textAnalysis;
  
  return {
    personalityProfile: combinedAnalysis,
    confidence: calculatePersonalityConfidence(combinedAnalysis),
    insights: generatePersonalityInsights(combinedAnalysis)
  };
}

async function inferSemanticSimilarity(input: any, options: any): Promise<any> {
  const { text1, text2, industry } = input;
  
  // Calculate basic semantic similarity
  const similarity = await aiMatchingService.calculateSemanticSimilarity(text1, text2);
  
  // Industry-specific adjustments
  const industryAdjusted = industry ? 
    await adjustSimilarityForIndustry(similarity, industry) : 
    similarity;
  
  return {
    similarity: industryAdjusted,
    breakdown: {
      semantic: similarity,
      industryAdjustment: industryAdjusted - similarity
    },
    confidence: similarity > 0.8 ? 'High' : similarity > 0.6 ? 'Medium' : 'Low'
  };
}

async function inferCareerPrediction(input: any, options: any): Promise<any> {
  const { profile, history } = input;
  
  // Analyze career progression
  const progression = analyzeCareerProgression(history);
  
  // Predict next steps
  const predictions = await predictCareerSteps(profile, progression);
  
  // Generate recommendations
  const recommendations = generateCareerRecommendations(profile, predictions);
  
  return {
    currentStage: progression.currentStage,
    predictions,
    recommendations,
    timeline: estimateCareerTimeline(predictions)
  };
}

function calculateEstimatedTime(batchSize: number, model: string): string {
  const baseTime = {
    'job-matching': 2,
    'skills-extraction': 1,
    'personality-analysis': 3,
    'semantic-similarity': 1.5,
    'career-prediction': 2.5
  };
  
  const timePerItem = baseTime[model] || 2;
  const totalSeconds = batchSize * timePerItem;
  
  if (totalSeconds < 60) return `${totalSeconds} seconds`;
  if (totalSeconds < 3600) return `${Math.ceil(totalSeconds / 60)} minutes`;
  return `${Math.ceil(totalSeconds / 3600)} hours`;
}

function calculateRemainingTime(progress: number, totalItems: number): string {
  if (progress === 0) return 'Calculating...';
  
  const processedItems = (progress / 100) * totalItems;
  const remainingItems = totalItems - processedItems;
  const avgTimePerItem = 2; // seconds
  
  return calculateEstimatedTime(remainingItems, 'default');
}

async function storeBatchMetadata(batchId: string, metadata: any): Promise<void> {
  await cache.set(`batch:${batchId}`, JSON.stringify(metadata), 86400); // 24 hours
}

async function getBatchMetadata(batchId: string): Promise<any> {
  const data = await cache.get(`batch:${batchId}`);
  return data ? JSON.parse(data as string) : null;
}

function convertResultsToCSV(results: any[]): string {
  if (!results || results.length === 0) return '';
  
  const headers = Object.keys(results[0]);
  const csv = [headers.join(',')];
  
  results.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'object' ? JSON.stringify(value) : value;
    });
    csv.push(values.join(','));
  });
  
  return csv.join('\n');
}

function generateResultsSummary(results: any[]): any {
  return {
    totalProcessed: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    averageScore: results
      .filter(r => r.score !== undefined)
      .reduce((sum, r) => sum + r.score, 0) / results.length || 0
  };
}

async function processStreamingInference(input: any, model: string): Promise<any> {
  // Route to appropriate model
  switch (model) {
    case 'job-matching':
      return inferJobMatching(input, {});
    case 'skills-extraction':
      return inferSkillsExtraction(input, {});
    case 'personality-analysis':
      return inferPersonalityAnalysis(input, {});
    case 'semantic-similarity':
      return inferSemanticSimilarity(input, {});
    case 'career-prediction':
      return inferCareerPrediction(input, {});
    default:
      throw new Error('Unknown model');
  }
}

async function getInferenceMetrics(model?: string, period?: string): Promise<any> {
  // Simulated metrics
  return {
    period,
    model: model || 'all',
    requests: {
      total: 15234,
      successful: 14876,
      failed: 358,
      cached: 4521
    },
    performance: {
      avgLatency: '245ms',
      p95Latency: '512ms',
      p99Latency: '1.2s'
    },
    usage: {
      cpuAvg: '45%',
      memoryAvg: '2.3GB',
      cacheHitRate: '29.7%'
    }
  };
}

function generateMatchRecommendation(semantic: number, skills: number, personality: any): string {
  const overall = personality ? 
    (semantic + skills + personality.score) / 3 : 
    (semantic + skills) / 2;
    
  if (overall > 0.8) return 'Excellent match - highly recommended to apply';
  if (overall > 0.65) return 'Good match - worth applying with tailored application';
  if (overall > 0.5) return 'Fair match - consider improving relevant skills';
  return 'Weak match - significant gaps to address';
}

function categorizeExtractedSkills(skills: string[]): Record<string, string[]> {
  const categories = {
    programming: [],
    frameworks: [],
    databases: [],
    tools: [],
    soft: [],
    other: []
  };
  
  skills.forEach(skill => {
    // Simple categorization logic
    const lowerSkill = skill.toLowerCase();
    if (['python', 'javascript', 'java', 'c++'].some(lang => lowerSkill.includes(lang))) {
      categories.programming.push(skill);
    } else if (['react', 'angular', 'django', 'spring'].some(fw => lowerSkill.includes(fw))) {
      categories.frameworks.push(skill);
    } else if (['sql', 'mongodb', 'redis'].some(db => lowerSkill.includes(db))) {
      categories.databases.push(skill);
    } else if (['git', 'docker', 'kubernetes'].some(tool => lowerSkill.includes(tool))) {
      categories.tools.push(skill);
    } else if (['communication', 'leadership', 'teamwork'].some(soft => lowerSkill.includes(soft))) {
      categories.soft.push(skill);
    } else {
      categories.other.push(skill);
    }
  });
  
  return categories;
}

function buildSkillHierarchy(skills: string[]): any {
  // Simplified hierarchy building
  return {
    technical: {
      programming: skills.filter(s => s.match(/python|javascript|java/i)),
      frameworks: skills.filter(s => s.match(/react|angular|django/i))
    },
    soft: skills.filter(s => s.match(/communication|leadership|teamwork/i))
  };
}

async function analyzeTextForPersonality(text: string): Promise<any> {
  // Simplified personality analysis
  return {
    communicationStyle: text.length > 1000 ? 'detailed' : 'concise',
    workingPreference: text.includes('team') ? 'collaborative' : 'independent',
    problemSolving: text.includes('analytical') ? 'analytical' : 'creative',
    confidence: 0.75
  };
}

function combinePersonalityData(textAnalysis: any, userData: any): any {
  return {
    ...textAnalysis,
    ...userData.personalityTraits,
    confidence: (textAnalysis.confidence + (userData.confidence || 0.5)) / 2
  };
}

function calculatePersonalityConfidence(analysis: any): number {
  return analysis.confidence || 0.7;
}

function generatePersonalityInsights(analysis: any): string[] {
  const insights = [];
  
  if (analysis.communicationStyle === 'detailed') {
    insights.push('Thorough communicator who values completeness');
  }
  
  if (analysis.workingPreference === 'collaborative') {
    insights.push('Team-oriented individual who thrives in collaborative environments');
  }
  
  return insights;
}

async function adjustSimilarityForIndustry(baseSimilarity: number, industry: string): Promise<number> {
  // Industry-specific adjustments
  const industryBoost = {
    'technology': 0.05,
    'finance': 0.03,
    'healthcare': 0.04
  };
  
  return Math.min(1, baseSimilarity + (industryBoost[industry.toLowerCase()] || 0));
}

function analyzeCareerProgression(history: any[]): any {
  if (!history || history.length === 0) {
    return { currentStage: 'entry', progression: 'starting' };
  }
  
  // Analyze job titles and responsibilities
  const latestRole = history[0];
  const stage = latestRole.level || 'mid';
  
  return {
    currentStage: stage,
    progression: 'advancing',
    averageTenure: calculateAverageTenure(history)
  };
}

async function predictCareerSteps(profile: any, progression: any): Promise<any[]> {
  // Simplified career prediction
  const predictions = [];
  
  if (progression.currentStage === 'entry') {
    predictions.push({
      role: 'Mid-level ' + profile.currentRole,
      timeline: '2-3 years',
      probability: 0.75
    });
  } else if (progression.currentStage === 'mid') {
    predictions.push({
      role: 'Senior ' + profile.currentRole,
      timeline: '3-5 years',
      probability: 0.65
    });
  }
  
  return predictions;
}

function generateCareerRecommendations(profile: any, predictions: any[]): string[] {
  const recommendations = [];
  
  if (predictions.length > 0) {
    recommendations.push(`Focus on skills needed for ${predictions[0].role}`);
    recommendations.push('Build leadership and mentoring experience');
  }
  
  return recommendations;
}

function estimateCareerTimeline(predictions: any[]): any {
  return {
    shortTerm: '1-2 years',
    midTerm: '3-5 years',
    longTerm: '5+ years'
  };
}

function calculateAverageTenure(history: any[]): number {
  if (history.length === 0) return 0;
  
  const tenures = history.map(job => job.duration || 2);
  return tenures.reduce((sum, tenure) => sum + tenure, 0) / tenures.length;
}

export { router as inferencePipelineRoutes };
