import { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import multilingualService, { SALanguage } from '../services/multilingual.service.js';
import voiceOperationService from '../services/voiceOperation.service.js';
import { AppError } from '../utils/AppError.js';
import logger from '../config/logger.js';
import multer from 'multer';

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

export const uploadAudio = upload.single('audio');

/**
 * Get all supported South African languages
 */
export const getSupportedLanguages = async (req: Request, res: Response) => {
  try {
    const languages = multilingualService.getSupportedLanguages();
    
    res.json({
      success: true,
      data: {
        languages,
        total: languages.length
      }
    });
  } catch (error) {
    logger.error('Error getting supported languages', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get supported languages'
    });
  }
};

/**
 * Translate text between SA languages
 */
export const translateText = [
  body('text').notEmpty().withMessage('Text is required'),
  body('fromLanguage').isIn(Object.values(SALanguage)).withMessage('Invalid source language'),
  body('toLanguage').isIn(Object.values(SALanguage)).withMessage('Invalid target language'),
  
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { text, fromLanguage, toLanguage } = req.body;
      
      const translatedText = await multilingualService.translateText(
        text,
        fromLanguage as SALanguage,
        toLanguage as SALanguage
      );

      res.json({
        success: true,
        data: {
          originalText: text,
          translatedText,
          fromLanguage,
          toLanguage
        }
      });
    } catch (error) {
      logger.error('Text translation failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Translation failed'
      });
    }
  }
];

/**
 * Detect language from text
 */
export const detectLanguage = [
  body('text').notEmpty().withMessage('Text is required'),
  
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { text } = req.body;
      const detectedLanguage = await multilingualService.detectLanguage(text);

      res.json({
        success: true,
        data: {
          text,
          detectedLanguage,
          confidence: 0.8 // Placeholder confidence score
        }
      });
    } catch (error) {
      logger.error('Language detection failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Language detection failed'
      });
    }
  }
];

/**
 * Get user's preferred language
 */
export const getUserLanguage = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const language = await multilingualService.getUserLanguage(req.user.id);

    res.json({
      success: true,
      data: {
        language,
        userId: req.user.id
      }
    });
  } catch (error) {
    logger.error('Error getting user language', { error, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Failed to get user language'
    });
  }
};

/**
 * Set user's preferred language
 */
export const setUserLanguage = [
  body('language').isIn(Object.values(SALanguage)).withMessage('Invalid language'),
  
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { language } = req.body;
      
      await multilingualService.setUserLanguage(req.user.id, language as SALanguage);

      res.json({
        success: true,
        data: {
          language,
          userId: req.user.id,
          message: 'Language preference updated successfully'
        }
      });
    } catch (error) {
      logger.error('Error setting user language', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to update language preference'
      });
    }
  }
];

/**
 * Search jobs in user's preferred language
 */
export const searchJobsInLanguage = [
  query('query').notEmpty().withMessage('Search query is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { query: searchQuery } = req.query;
      const jobs = await multilingualService.searchJobsInLanguage(
        searchQuery as string,
        req.user.id
      );

      const userLanguage = await multilingualService.getUserLanguage(req.user.id);

      res.json({
        success: true,
        data: {
          jobs,
          total: jobs.length,
          language: userLanguage,
          searchQuery
        }
      });
    } catch (error) {
      logger.error('Multilingual job search failed', { error, query: req.query, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Job search failed'
      });
    }
  }
];

/**
 * Convert speech to text
 */
export const speechToText = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required'
      });
    }

    const { language } = req.body;
    const audioData = req.file.buffer;
    const userLanguage = language ? language as SALanguage : await multilingualService.getUserLanguage(req.user.id);

    const transcribedText = await voiceOperationService.speechToText(audioData, userLanguage);

    res.json({
      success: true,
      data: {
        transcribedText,
        language: userLanguage,
        audioSize: audioData.length
      }
    });
  } catch (error) {
    logger.error('Speech-to-text conversion failed', { error, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Speech-to-text conversion failed'
    });
  }
};

/**
 * Convert text to speech
 */
export const textToSpeech = [
  body('text').notEmpty().withMessage('Text is required'),
  body('language').optional().isIn(Object.values(SALanguage)).withMessage('Invalid language'),
  
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { text, language } = req.body;
      const userLanguage = language ? language as SALanguage : await multilingualService.getUserLanguage(req.user.id);

      const audioBuffer = await voiceOperationService.textToSpeech(text, userLanguage);

      // Set appropriate headers for audio response
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache'
      });

      res.send(audioBuffer);
    } catch (error) {
      logger.error('Text-to-speech conversion failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Text-to-speech conversion failed'
      });
    }
  }
];

/**
 * Process voice command
 */
export const processVoiceCommand = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required'
      });
    }

    const audioData = req.file.buffer;
    const response = await voiceOperationService.processVoiceCommand(audioData, req.user.id);

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    logger.error('Voice command processing failed', { error, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Voice command processing failed'
    });
  }
};

/**
 * Get voice command history
 */
export const getVoiceHistory = [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const history = await voiceOperationService.getVoiceHistory(req.user.id, limit);

      res.json({
        success: true,
        data: {
          history,
          total: history.length,
          limit
        }
      });
    } catch (error) {
      logger.error('Error getting voice history', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get voice history'
      });
    }
  }
];

/**
 * Update voice settings
 */
export const updateVoiceSettings = [
  body('speechRate').optional().isFloat({ min: 0.5, max: 2.0 }).withMessage('Speech rate must be between 0.5 and 2.0'),
  body('voiceType').optional().isIn(['male', 'female', 'neutral']).withMessage('Invalid voice type'),
  body('language').optional().isIn(Object.values(SALanguage)).withMessage('Invalid language'),
  
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const settings = req.body;
      await voiceOperationService.updateVoiceSettings(req.user.id, settings);

      res.json({
        success: true,
        data: {
          settings,
          userId: req.user.id,
          message: 'Voice settings updated successfully'
        }
      });
    } catch (error) {
      logger.error('Error updating voice settings', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to update voice settings'
      });
    }
  }
];

/**
 * Get translated job posting
 */
export const getTranslatedJob = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { jobId } = req.params;
    const translatedJob = await multilingualService.translateJobPosting(jobId, req.user.id);

    res.json({
      success: true,
      data: translatedJob
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    }

    logger.error('Error getting translated job', { error, jobId: req.params.jobId, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Failed to get translated job'
    });
  }
};
