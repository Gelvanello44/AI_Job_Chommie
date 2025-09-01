import { Router } from 'express';
import { JobController } from '../controllers/job.controller.js';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { csrfProtectUserData, sensitiveOperationCSRF } from '../middleware/csrf';
import { basicXSSProtection } from '../middleware/xss';

const router = Router();
const jobController = new JobController();

// Rate limiting for job creation/modification
const jobModificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 job operations per window
  message: {
    success: false,
    error: 'Too many job operations, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes (no authentication required)
router.get('/', jobController.getJobs);
router.get('/featured', jobController.getFeaturedJobs);
router.get('/trending', jobController.getTrendingJobs);
router.get('/stats', jobController.getJobStats);
router.get('/search', jobController.searchJobs);
router.get('/company/:companyId', jobController.getJobsByCompany);
router.get('/location/:province/:city', jobController.getJobsByLocation);
router.get('/:id', jobController.getJobById);

// Protected routes (authentication required)
router.get('/user/recommendations', authenticate, jobController.getRecommendations);
router.post('/ai-match', authenticate, ...csrfProtectUserData, jobController.getAIMatchedJobs);
router.get('/user/saved', authenticate, jobController.getSavedJobs);
router.post('/:id/save', authenticate, ...csrfProtectUserData, jobController.toggleSaveJob);
router.delete('/:id/save', authenticate, ...csrfProtectUserData, jobController.toggleSaveJob);

// Employer routes (employer/admin only)
router.post('/', authenticate, jobModificationLimiter, ...basicXSSProtection, jobController.createJob);
router.put('/:id', authenticate, jobModificationLimiter, ...basicXSSProtection, jobController.updateJob);
router.delete('/:id', authenticate, jobModificationLimiter, ...sensitiveOperationCSRF(), jobController.deleteJob);
router.get('/employer/jobs', authenticate, jobController.getEmployerJobs);

export default router;
