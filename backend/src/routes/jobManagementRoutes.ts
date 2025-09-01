import { Router } from 'express';
import jobManagementController from '../controllers/jobManagementController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { jobCreateSchema, jobUpdateSchema } from '../services/jobManagementService.js';

const router = Router();

// Rate limiting for different types of operations
const jobManagementLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 job operations per window
  message: 'Too many job management requests. Please try again later.',
  keyGenerator: (req) => `job_mgmt:${req.user?.id}`
});

const scrapingLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 scraping runs per hour
  message: 'Too many scraping requests. Please try again later.',
  keyGenerator: (req) => `scraping:${req.user?.id}`
});

const generalLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 requests per 5 minutes
  message: 'Too many requests. Please try again later.',
  keyGenerator: (req) => `job_ops:${req.user?.id || req.ip}`
});

// Public routes (no authentication required)
router.get('/:jobId', optionalAuth, generalLimiter, jobManagementController.getJobById);

// Protected routes (authentication required)
router.use(authenticate);

// Company-specific job management routes
router.post('/company/:companyId', jobManagementLimiter, validateRequest(jobCreateSchema), jobManagementController.createJob);
router.get('/company/:companyId', generalLimiter, jobManagementController.getCompanyJobs);

// Individual job management routes
router.put('/:jobId', jobManagementLimiter, validateRequest(jobUpdateSchema), jobManagementController.updateJob);
router.patch('/:jobId/publish', jobManagementLimiter, jobManagementController.publishJob);
router.patch('/:jobId/deactivate', jobManagementLimiter, jobManagementController.deactivateJob);
router.delete('/:jobId', jobManagementLimiter, jobManagementController.deleteJob);
router.post('/:jobId/duplicate', jobManagementLimiter, jobManagementController.duplicateJob);

// Job applications management
router.get('/:jobId/applications', generalLimiter, jobManagementController.getJobApplications);

// Job scraping and data pipeline routes (admin functions)
router.post('/scraping/run', scrapingLimiter, jobManagementController.runJobScraping);
router.get('/scraping/stats', generalLimiter, jobManagementController.getScrapingStats);
router.delete('/scraping/cleanup', jobManagementLimiter, jobManagementController.cleanupOldJobs);

export default router;
