import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';
import { newsletterController } from '../controllers/newsletter.controller.js';

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
 * POST /api/v1/newsletter/subscribe
 * Subscribe to newsletter
 */
router.post('/subscribe',
  body('preferences').isObject().optional(),
  body('preferences.frequency').optional().isIn(['WEEKLY', 'MONTHLY']),
  body('preferences.categories').optional().isArray(),
  handleValidationErrors,
  newsletterController.subscribe.bind(newsletterController)
);

/**
 * POST /api/v1/newsletter/unsubscribe
 * Unsubscribe from newsletter
 */
router.post('/unsubscribe',
  handleValidationErrors,
  newsletterController.unsubscribe.bind(newsletterController)
);

/**
 * PUT /api/v1/newsletter/preferences
 * Update newsletter preferences
 */
router.put('/preferences',
  body('preferences').isObject().notEmpty(),
  body('preferences.frequency').optional().isIn(['WEEKLY', 'MONTHLY']),
  body('preferences.categories').optional().isArray(),
  handleValidationErrors,
  newsletterController.updatePreferences.bind(newsletterController)
);

/**
 * GET /api/v1/newsletter/archive
 * Get newsletter archive
 */
router.get('/archive',
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
  newsletterController.getArchive.bind(newsletterController)
);

/**
 * GET /api/v1/newsletter/:newsletterId
 * Get specific newsletter
 */
router.get('/:newsletterId',
  param('newsletterId').isString().notEmpty(),
  handleValidationErrors,
  newsletterController.getNewsletter.bind(newsletterController)
);

/**
 * GET /api/v1/newsletter/insights/sa
 * Get South Africa market insights
 */
router.get('/insights/sa',
  handleValidationErrors,
  newsletterController.getSAMarketInsights.bind(newsletterController)
);

/**
 * POST /api/v1/newsletter/admin/generate
 * Admin: Generate monthly newsletter
 */
router.post('/admin/generate',
  handleValidationErrors,
  newsletterController.generateMonthlyNewsletter.bind(newsletterController)
);

/**
 * POST /api/v1/newsletter/admin/send
 * Admin: Send newsletter to subscribers
 */
router.post('/admin/send',
  body('newsletterId').isString().notEmpty(),
  handleValidationErrors,
  newsletterController.sendNewsletter.bind(newsletterController)
);

export default router;
