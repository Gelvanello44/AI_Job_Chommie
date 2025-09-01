import { Router } from 'express';
import { CoverLetterController } from '../controllers/cover-letter.controller.js';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { csrfProtectUserData, sensitiveOperationCSRF } from '../middleware/csrf';
import { basicXSSProtection } from '../middleware/xss';

const router = Router();
const coverLetterController = new CoverLetterController();

// Rate limiting for cover letter generation
const coverLetterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // 15 cover letters per hour
  message: {
    success: false,
    error: 'Too many cover letter generations, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All cover letter routes require authentication
router.use(authenticate);

// Cover letter generation
router.post('/generate', coverLetterLimiter, ...basicXSSProtection, coverLetterController.generateCoverLetter);
router.post('/generate-custom', coverLetterLimiter, ...basicXSSProtection, coverLetterController.generateCustomCoverLetter);
router.post('/generate-from-job', coverLetterLimiter, ...basicXSSProtection, coverLetterController.generateFromJobPosting);

// Cover letter management
router.get('/', coverLetterController.getUserCoverLetters);
router.get('/:id', coverLetterController.getCoverLetterById);
router.post('/', coverLetterLimiter, ...basicXSSProtection, coverLetterController.saveCoverLetter);
router.put('/:id', ...basicXSSProtection, coverLetterController.updateCoverLetter);
router.delete('/:id', ...sensitiveOperationCSRF(), coverLetterController.deleteCoverLetter);

// Cover letter optimization
router.post('/:id/optimize', coverLetterLimiter, coverLetterController.optimizeCoverLetter);
router.post('/:id/analyze', coverLetterController.analyzeCoverLetter);
router.post('/:id/score', coverLetterController.scoreCoverLetter);

// Templates
router.get('/templates/list', coverLetterController.getTemplates);
router.get('/templates/:id', coverLetterController.getTemplateById);
router.post('/templates/preview', coverLetterController.previewTemplate);

// AI suggestions
router.post('/suggestions', ...basicXSSProtection, coverLetterController.getSuggestions);
router.post('/improve', coverLetterLimiter, ...basicXSSProtection, coverLetterController.improveCoverLetter);

export default router;
