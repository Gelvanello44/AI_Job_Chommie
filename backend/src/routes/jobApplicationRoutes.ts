import { Router } from 'express';
import jobApplicationController from '../controllers/jobApplicationController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { jobApplicationSchema } from '../services/jobApplicationService.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Rate limiting for different types of operations
const applicationLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 applications per hour
  message: 'Too many job applications. Please try again later.',
  keyGenerator: (req) => `job_applications:${req.user?.id}`
});

const generalLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 requests per 5 minutes
  message: 'Too many requests. Please try again later.',
  keyGenerator: (req) => `application_ops:${req.user?.id}`
});

const exportLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 exports per hour
  message: 'Too many export requests. Please try again later.',
  keyGenerator: (req) => `export:${req.user?.id}`
});

// Main application routes
router.post('/', applicationLimiter, validateRequest(jobApplicationSchema), jobApplicationController.applyForJob);
router.get('/', generalLimiter, jobApplicationController.getUserApplications);
router.get('/stats', generalLimiter, jobApplicationController.getApplicationStats);
router.get('/export', exportLimiter, jobApplicationController.exportApplications);

// Filtered application routes
router.get('/recent', generalLimiter, jobApplicationController.getRecentApplications);
router.get('/pending', generalLimiter, jobApplicationController.getPendingApplications);
router.get('/successful', generalLimiter, jobApplicationController.getSuccessfulApplications);
router.get('/interviews', generalLimiter, jobApplicationController.getUpcomingInterviews);

// Status-based routes
router.get('/status/:status', generalLimiter, jobApplicationController.getApplicationsByStatus);

// Individual application routes
router.get('/:applicationId', generalLimiter, jobApplicationController.getApplicationById);
router.patch('/:applicationId/withdraw', generalLimiter, jobApplicationController.withdrawApplication);

export default router;
