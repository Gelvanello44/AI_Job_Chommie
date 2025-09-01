import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getSupportedLanguages,
  translateText,
  detectLanguage,
  getUserLanguage,
  setUserLanguage,
  searchJobsInLanguage,
  speechToText,
  textToSpeech,
  processVoiceCommand,
  getVoiceHistory,
  updateVoiceSettings,
  getTranslatedJob,
  uploadAudio
} from '../controllers/multilingual.controller.js';

const router = express.Router();

// Language support endpoints
router.get('/languages', getSupportedLanguages);
router.post('/translate', translateText);
router.post('/detect-language', detectLanguage);

// User language preferences (requires authentication)
router.get('/user/language', authenticate, getUserLanguage);
router.put('/user/language', authenticate, setUserLanguage);

// Multilingual job search
router.get('/jobs/search', authenticate, searchJobsInLanguage);
router.get('/jobs/:jobId/translate', authenticate, getTranslatedJob);

// Voice operation endpoints (requires authentication)
router.post('/voice/speech-to-text', authenticate, uploadAudio, speechToText);
router.post('/voice/text-to-speech', authenticate, textToSpeech);
router.post('/voice/command', authenticate, uploadAudio, processVoiceCommand);
router.get('/voice/history', authenticate, getVoiceHistory);
router.put('/voice/settings', authenticate, updateVoiceSettings);

export default router;
