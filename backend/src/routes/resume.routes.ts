import { Router } from 'express';
import { ResumeController } from '../controllers/resume.controller.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const resumeController = new ResumeController();

// Rate limiting for resume operations
const resumeOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 resume operations per window
  message: {
    success: false,
    error: 'Too many resume operations, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All resume routes require authentication
router.use(authenticate);

// Resume parsing and analysis
router.post('/parse', upload.single('resume'), resumeOperationLimiter, resumeController.parseResume);
router.post('/parse-url', resumeOperationLimiter, resumeController.parseResumeFromUrl);
router.post('/analyze', resumeOperationLimiter, resumeController.analyzeResume);

// Resume management
router.get('/', resumeController.getUserResumes);
router.get('/:id', resumeController.getResumeById);
router.post('/', upload.single('file'), resumeOperationLimiter, resumeController.uploadResume);
router.put('/:id', resumeOperationLimiter, resumeController.updateResume);
router.delete('/:id', resumeController.deleteResume);

// Resume optimization
router.post('/:id/optimize', resumeOperationLimiter, resumeController.optimizeResume);
router.post('/:id/keywords', resumeController.extractKeywords);
router.post('/:id/score', resumeController.scoreResume);

// Resume templates
router.get('/templates/list', resumeController.getResumeTemplates);
router.post('/generate-from-template', resumeOperationLimiter, resumeController.generateFromTemplate);

export default router;
