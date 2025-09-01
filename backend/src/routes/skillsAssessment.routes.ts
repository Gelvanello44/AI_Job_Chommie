/**
 * Skills Assessment Routes
 * Routes for skills assessment quiz system and results
 */

import { Router } from 'express';
import { SkillsAssessmentController, skillsAssessmentValidation } from '../controllers/skillsAssessment.controller.js';
import { authenticate } from '../middleware/auth.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply authentication to all assessment routes
router.use(authenticate);

/**
 * GET /api/v1/assessments/types
 * Get available assessment types
 */
router.get('/types', SkillsAssessmentController.getAssessmentTypes);

/**
 * GET /api/v1/assessments/dashboard
 * Get user's assessment dashboard with overview
 */
router.get('/dashboard', SkillsAssessmentController.getAssessmentDashboard);

/**
 * GET /api/v1/assessments
 * Get user's assessments list
 */
router.get('/', SkillsAssessmentController.getUserAssessments);

/**
 * POST /api/v1/assessments
 * Create new skills assessment
 */
router.post(
  '/',
  skillsAssessmentValidation.createAssessment,
  strictRateLimiter, // Use preconfigured strict rate limiter for assessment creation
  SkillsAssessmentController.createAssessment
);

/**
 * POST /api/v1/assessments/:id/submit
 * Submit assessment answers
 */
router.post(
  '/:id/submit',
  skillsAssessmentValidation.submitAssessment,
  strictRateLimiter, // Use preconfigured strict rate limiter for submissions
  SkillsAssessmentController.submitAssessment
);

/**
 * GET /api/v1/assessments/:id/results
 * Get detailed assessment results
 */
router.get(
  '/:id/results',
  skillsAssessmentValidation.getResults,
  SkillsAssessmentController.getAssessmentResults
);

/**
 * GET /api/v1/assessments/badges/:type/:score
 * Generate shareable badge for assessment
 */
router.get('/badges/:type/:score', SkillsAssessmentController.generateBadge);

export default router;
