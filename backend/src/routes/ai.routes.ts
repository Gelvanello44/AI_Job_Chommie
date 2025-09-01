import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { huggingFaceService } from '../services/huggingface.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * @route   POST /api/v1/ai/ner
 * @desc    Extract named entities from resume/CV text
 * @access  Private
 */
router.post('/ner',
  authMiddleware,
  [
    body('text').isString().isLength({ min: 10 }).withMessage('Text must be at least 10 characters'),
    body('type').optional().isIn(['resume', 'cover_letter', 'job_description']).withMessage('Invalid document type')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { text, type = 'resume' } = req.body;
      
      logger.info('Processing NER request', { 
        userId: req.user?.id, 
        textLength: text.length,
        type 
      });

      const entities = await huggingFaceService.extractEntitiesFromResume(text);
      
      // Group entities by type
      const groupedEntities = entities.reduce((acc, entity) => {
        const group = entity.entity_group || 'OTHER';
        if (!acc[group]) acc[group] = [];
        acc[group].push({
          text: entity.word,
          score: entity.score,
          position: { start: entity.start, end: entity.end }
        });
        return acc;
      }, {} as Record<string, any[]>);

      res.json({
        success: true,
        data: {
          entities,
          grouped: groupedEntities,
          summary: {
            total: entities.length,
            persons: groupedEntities['PER']?.length || 0,
            organizations: groupedEntities['ORG']?.length || 0,
            locations: groupedEntities['LOC']?.length || 0,
            misc: groupedEntities['MISC']?.length || 0
          }
        }
      });
    } catch (error) {
      logger.error('NER extraction failed', { error });
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ai/classify-skills
 * @desc    Zero-shot classification for skills
 * @access  Private
 */
router.post('/classify-skills',
  authMiddleware,
  [
    body('text').isString().isLength({ min: 10 }).withMessage('Text must be at least 10 characters'),
    body('candidateLabels').optional().isArray().withMessage('Candidate labels must be an array'),
    body('multiLabel').optional().isBoolean().withMessage('Multi-label must be a boolean')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { text, candidateLabels, multiLabel = true } = req.body;
      
      // Default skill categories if not provided
      const labels = candidateLabels || [
        'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'PHP',
        'React', 'Angular', 'Vue.js', 'Node.js', 'Django',
        'SQL', 'MongoDB', 'PostgreSQL', 'MySQL',
        'AWS', 'Azure', 'Docker', 'Kubernetes',
        'Machine Learning', 'Data Analysis', 'Project Management',
        'Leadership', 'Communication', 'Problem Solving'
      ];

      logger.info('Classifying skills', { 
        userId: req.user?.id,
        textLength: text.length,
        labelCount: labels.length 
      });

      const classifications = await huggingFaceService.classifySkills(text, labels);
      
      // Filter and sort by confidence
      const relevantSkills = classifications
        .filter(c => c.score > 0.3)
        .sort((a, b) => b.score - a.score);

      res.json({
        success: true,
        data: {
          skills: relevantSkills,
          topSkills: relevantSkills.slice(0, 10),
          summary: {
            total: relevantSkills.length,
            highConfidence: relevantSkills.filter(s => s.score > 0.7).length,
            mediumConfidence: relevantSkills.filter(s => s.score > 0.5 && s.score <= 0.7).length,
            lowConfidence: relevantSkills.filter(s => s.score <= 0.5).length
          }
        }
      });
    } catch (error) {
      logger.error('Skill classification failed', { error });
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ai/embeddings
 * @desc    Generate sentence embeddings for semantic search
 * @access  Private
 */
router.post('/embeddings',
  authMiddleware,
  [
    body('texts').custom((value) => {
      if (typeof value === 'string' || Array.isArray(value)) return true;
      throw new Error('Texts must be a string or array of strings');
    }),
    body('normalize').optional().isBoolean().withMessage('Normalize must be a boolean')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { texts, normalize = true } = req.body;
      const inputTexts = Array.isArray(texts) ? texts : [texts];
      
      logger.info('Generating embeddings', { 
        userId: req.user?.id,
        textCount: inputTexts.length 
      });

      const embeddings = await huggingFaceService.generateEmbeddings(inputTexts, { normalize });

      res.json({
        success: true,
        data: {
          embeddings,
          dimensions: embeddings[0]?.length || 0,
          count: embeddings.length
        }
      });
    } catch (error) {
      logger.error('Embedding generation failed', { error });
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ai/question-answer
 * @desc    Answer questions based on context
 * @access  Private
 */
router.post('/question-answer',
  authMiddleware,
  [
    body('question').isString().isLength({ min: 3 }).withMessage('Question must be at least 3 characters'),
    body('context').isString().isLength({ min: 10 }).withMessage('Context must be at least 10 characters')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { question, context } = req.body;
      
      logger.info('Processing Q&A request', { 
        userId: req.user?.id,
        questionLength: question.length,
        contextLength: context.length 
      });

      const answer = await huggingFaceService.answerQuestion(question, context);

      res.json({
        success: true,
        data: {
          question,
          answer: answer?.answer || 'Unable to determine answer from context',
          confidence: answer?.score || 0,
          position: answer ? { start: answer.start, end: answer.end } : null
        }
      });
    } catch (error) {
      logger.error('Question answering failed', { error });
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ai/generate-text
 * @desc    Generate text (cover letters, job descriptions, etc.)
 * @access  Private
 */
router.post('/generate-text',
  authMiddleware,
  [
    body('prompt').isString().isLength({ min: 10 }).withMessage('Prompt must be at least 10 characters'),
    body('maxLength').optional().isInt({ min: 50, max: 1000 }).withMessage('Max length must be between 50 and 1000'),
    body('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
    body('type').optional().isIn(['cover_letter', 'job_description', 'email', 'general']).withMessage('Invalid generation type')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { prompt, maxLength = 200, temperature = 0.7, type = 'general' } = req.body;
      
      logger.info('Generating text', { 
        userId: req.user?.id,
        promptLength: prompt.length,
        maxLength,
        type 
      });

      // Enhance prompt based on type
      let enhancedPrompt = prompt;
      if (type === 'cover_letter') {
        enhancedPrompt = `Write a professional cover letter: ${prompt}`;
      } else if (type === 'job_description') {
        enhancedPrompt = `Create a detailed job description: ${prompt}`;
      } else if (type === 'email') {
        enhancedPrompt = `Compose a professional email: ${prompt}`;
      }

      const generatedText = await huggingFaceService.generateText(enhancedPrompt, maxLength);

      res.json({
        success: true,
        data: {
          generatedText,
          prompt: enhancedPrompt,
          metadata: {
            length: generatedText.length,
            words: generatedText.split(/\s+/).length,
            type
          }
        }
      });
    } catch (error) {
      logger.error('Text generation failed', { error });
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ai/sentiment
 * @desc    Analyze sentiment of text
 * @access  Private
 */
router.post('/sentiment',
  authMiddleware,
  [
    body('text').isString().isLength({ min: 3 }).withMessage('Text must be at least 3 characters'),
    body('granularity').optional().isIn(['document', 'sentence', 'aspect']).withMessage('Invalid granularity')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { text, granularity = 'document' } = req.body;
      
      logger.info('Analyzing sentiment', { 
        userId: req.user?.id,
        textLength: text.length,
        granularity 
      });

      let sentimentResults;
      
      if (granularity === 'sentence') {
        // Split into sentences and analyze each
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const results = await Promise.all(
          sentences.map(sentence => huggingFaceService.analyzeSentiment(sentence.trim()))
        );
        
        sentimentResults = {
          sentences: sentences.map((sentence, i) => ({
            text: sentence.trim(),
            sentiment: results[i]
          })),
          overall: await huggingFaceService.analyzeSentiment(text)
        };
      } else {
        sentimentResults = await huggingFaceService.analyzeSentiment(text);
      }

      res.json({
        success: true,
        data: {
          sentiment: sentimentResults,
          summary: Array.isArray(sentimentResults) && sentimentResults.length > 0 ? {
            primarySentiment: sentimentResults[0].label,
            confidence: sentimentResults[0].score,
            distribution: sentimentResults.reduce((acc, item) => {
              acc[item.label] = item.score;
              return acc;
            }, {} as Record<string, number>)
          } : null
        }
      });
    } catch (error) {
      logger.error('Sentiment analysis failed', { error });
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ai/job-match
 * @desc    Enhanced job matching using multiple AI models
 * @access  Private
 */
router.post('/job-match',
  authMiddleware,
  [
    body('jobDescription').isString().isLength({ min: 50 }).withMessage('Job description must be at least 50 characters'),
    body('userProfile').isString().isLength({ min: 50 }).withMessage('User profile must be at least 50 characters')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { jobDescription, userProfile } = req.body;
      
      logger.info('Calculating job match', { 
        userId: req.user?.id,
        jobLength: jobDescription.length,
        profileLength: userProfile.length 
      });

      const matchResult = await huggingFaceService.matchJobWithProfile(jobDescription, userProfile);

      res.json({
        success: true,
        data: matchResult
      });
    } catch (error) {
      logger.error('Job matching failed', { error });
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ai/parse-resume
 * @desc    Parse and structure resume data
 * @access  Private
 */
router.post('/parse-resume',
  authMiddleware,
  [
    body('resumeText').isString().isLength({ min: 100 }).withMessage('Resume text must be at least 100 characters')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { resumeText } = req.body;
      
      logger.info('Parsing resume', { 
        userId: req.user?.id,
        textLength: resumeText.length 
      });

      const parsedData = await huggingFaceService.parseResume(resumeText);

      res.json({
        success: true,
        data: parsedData
      });
    } catch (error) {
      logger.error('Resume parsing failed', { error });
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ai/generate-cover-letter
 * @desc    Generate a professional cover letter
 * @access  Private
 */
router.post('/generate-cover-letter',
  authMiddleware,
  [
    body('jobTitle').isString().notEmpty().withMessage('Job title is required'),
    body('companyName').isString().notEmpty().withMessage('Company name is required'),
    body('userSkills').isArray().withMessage('User skills must be an array'),
    body('experience').isString().withMessage('Experience description is required')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { jobTitle, companyName, userSkills, experience } = req.body;
      
      logger.info('Generating cover letter', { 
        userId: req.user?.id,
        jobTitle,
        companyName,
        skillCount: userSkills.length 
      });

      const coverLetter = await huggingFaceService.generateCoverLetter(
        jobTitle,
        companyName,
        userSkills,
        experience
      );

      res.json({
        success: true,
        data: {
          coverLetter,
          metadata: {
            length: coverLetter.length,
            words: coverLetter.split(/\s+/).length,
            paragraphs: coverLetter.split(/\n\n/).length
          }
        }
      });
    } catch (error) {
      logger.error('Cover letter generation failed', { error });
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/ai/similarity
 * @desc    Calculate similarity between two texts
 * @access  Private
 */
router.post('/similarity',
  authMiddleware,
  [
    body('text1').isString().notEmpty().withMessage('First text is required'),
    body('text2').isString().notEmpty().withMessage('Second text is required')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { text1, text2 } = req.body;
      
      logger.info('Calculating text similarity', { 
        userId: req.user?.id,
        text1Length: text1.length,
        text2Length: text2.length 
      });

      const similarity = await huggingFaceService.calculateSimilarity(text1, text2);

      res.json({
        success: true,
        data: {
          similarity,
          percentage: Math.round(similarity * 100),
          interpretation: similarity > 0.8 ? 'Very Similar' : 
                        similarity > 0.6 ? 'Similar' : 
                        similarity > 0.4 ? 'Somewhat Similar' : 
                        similarity > 0.2 ? 'Different' : 'Very Different'
        }
      });
    } catch (error) {
      logger.error('Similarity calculation failed', { error });
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/ai/health
 * @desc    Check AI service health
 * @access  Public
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isHealthy = await huggingFaceService.healthCheck();
    
    res.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'degraded',
        huggingface: {
          connected: isHealthy,
          message: isHealthy ? 'All services operational' : 'Using fallback/mock responses'
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      success: false,
      error: 'Service health check failed'
    });
  }
});

export default router;
