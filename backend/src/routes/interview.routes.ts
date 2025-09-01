import { Router } from 'express';
import { InterviewController } from '../controllers/interview.controller.js';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { csrfProtectUserData, sensitiveOperationCSRF } from '../middleware/csrf';
import { basicXSSProtection } from '../middleware/xss';

const router = Router();
const interviewController = new InterviewController();

// Rate limiting for interview operations
const interviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 operations per window
  message: {
    success: false,
    error: 'Too many interview operations, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All interview routes require authentication
router.use(authenticate);

// Interview scheduling and management
router.post('/schedule', interviewLimiter, ...basicXSSProtection, interviewController.scheduleInterview);
router.get('/upcoming', interviewController.getUpcomingInterviews);
router.put('/:interviewId', interviewController.updateInterview);
router.delete('/:interviewId/cancel', ...sensitiveOperationCSRF(), interviewController.cancelInterview);

// Interview preparation and coaching
router.get('/:interviewId/preparation', interviewController.getInterviewPreparation);
router.post('/:interviewId/coaching', interviewController.getInterviewCoaching);
router.get('/:interviewId/checklist', interviewController.getInterviewChecklist);

// Practice interviews
router.post('/practice', interviewLimiter, interviewController.practiceInterview);
router.post('/practice/:sessionId/submit', interviewController.submitPracticeAnswers);
router.post('/mock/record', interviewController.recordMockInterview);

// Analytics and feedback
router.get('/analytics', interviewController.getInterviewAnalytics);
router.post('/:interviewId/feedback', ...basicXSSProtection, interviewController.submitFeedback);

export default router;
