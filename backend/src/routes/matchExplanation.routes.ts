import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';
import { matchExplanationController } from '../controllers/matchExplanation.controller.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
};

/**
 * GET /api/v1/match-explanations/:jobId
 * Get comprehensive match explanation for a specific job
 */
router.get('/:jobId',
  param('jobId').isUUID().withMessage('Valid job ID required'),
  handleValidationErrors,
  matchExplanationController.getMatchExplanation.bind(matchExplanationController)
);

/**
 * POST /api/v1/match-explanations/compare
 * Compare match scores across multiple jobs
 */
router.post('/compare',
  body('jobIds').isArray({ min: 1, max: 10 }).withMessage('Job IDs array required (1-10 items)'),
  body('jobIds.*').isUUID().withMessage('All job IDs must be valid UUIDs'),
  handleValidationErrors,
  matchExplanationController.getMatchComparison.bind(matchExplanationController)
);

/**
 * GET /api/v1/match-explanations/:jobId/improvements
 * Get improvement suggestions for a specific job match
 */
router.get('/:jobId/improvements',
  param('jobId').isUUID().withMessage('Valid job ID required'),
  handleValidationErrors,
  matchExplanationController.getImprovementSuggestions.bind(matchExplanationController)
);

/**
 * GET /api/v1/match-explanations/:jobId/insights
 * Get detailed insights for a job match
 */
router.get('/:jobId/insights',
  param('jobId').isUUID().withMessage('Valid job ID required'),
  handleValidationErrors,
  matchExplanationController.getMatchInsights.bind(matchExplanationController)
);

export default router;
