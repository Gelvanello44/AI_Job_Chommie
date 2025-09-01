import { Router } from 'express';
import { ApplicationController } from '../controllers/application.controller.js';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { csrfProtectUserData, sensitiveOperationCSRF } from '../middleware/csrf';
import { basicXSSProtection } from '../middleware/xss';

const router = Router();
const applicationController = new ApplicationController();

// Rate limiting for application submissions
const applicationSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 applications per hour
  message: {
    success: false,
    error: 'Too many application submissions, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All application routes require authentication
router.use(authenticate);

// Job seeker routes
router.post('/', applicationSubmissionLimiter, ...basicXSSProtection, applicationController.submitApplication);
router.post('/bulk-apply', applicationSubmissionLimiter, ...csrfProtectUserData, applicationController.bulkApply);
router.get('/', applicationController.getUserApplications);
router.get('/stats', applicationController.getApplicationStats);
router.get('/:id', applicationController.getApplicationById);
router.get('/:id/timeline', applicationController.getApplicationTimeline);
router.put('/:id/withdraw', ...sensitiveOperationCSRF(), applicationController.withdrawApplication);
router.get('/job/:jobId/eligibility', applicationController.checkApplicationEligibility);

// User notes routes
router.put('/:id/notes', ...basicXSSProtection, applicationController.updateUserNotes);
router.get('/:id/notes', applicationController.getUserNotes);

// Employer routes
router.get('/employer/applications', applicationController.getEmployerApplications);
router.get('/employer/analytics', applicationController.getEmployerApplicationAnalytics);
router.put('/employer/:id/status', ...csrfProtectUserData, applicationController.updateApplicationStatus);
router.put('/employer/bulk-update', ...sensitiveOperationCSRF(), applicationController.bulkUpdateApplications);

export default router;
