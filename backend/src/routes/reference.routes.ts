import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';
import { referenceController } from '../controllers/reference.controller.js';

const router = Router();

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

// Public routes (no authentication required for references to respond)
/**
 * GET /api/v1/references/form/:token
 * Get reference form for public viewing
 */
router.get('/form/:token',
  param('token').isString().notEmpty(),
  handleValidationErrors,
  referenceController.getReferenceForm.bind(referenceController)
);

/**
 * POST /api/v1/references/submit
 * Submit reference response (public)
 */
router.post('/submit',
  body('token').isString().notEmpty(),
  body('response').isString().isLength({ min: 50, max: 5000 }),
  handleValidationErrors,
  referenceController.submitResponse.bind(referenceController)
);

/**
 * POST /api/v1/references/decline
 * Decline reference request (public)
 */
router.post('/decline',
  body('token').isString().notEmpty(),
  body('reason').optional().isString().isLength({ max: 500 }),
  handleValidationErrors,
  referenceController.declineResponse.bind(referenceController)
);

// Apply authentication to remaining routes
router.use(authenticate);

/**
 * POST /api/v1/references
 * Create a new reference request
 */
router.post('/',
  body('referenceName').isString().isLength({ min: 2, max: 100 }),
  body('referenceEmail').isEmail(),
  body('referencePhone').optional().isString(),
  body('company').isString().isLength({ min: 2, max: 100 }),
  body('position').isString().isLength({ min: 2, max: 100 }),
  body('relationship').isIn(['Manager', 'Colleague', 'Client', 'Mentor', 'Subordinate', 'Other']),
  body('requestMessage').isString().isLength({ min: 10, max: 1000 }),
  body('jobTitle').optional().isString(),
  body('urgency').optional().isIn(['urgent', 'normal', 'flexible']),
  body('canContactDirectly').optional().isBoolean(),
  handleValidationErrors,
  referenceController.createReference.bind(referenceController)
);

/**
 * GET /api/v1/references
 * Get all references for authenticated user
 */
router.get('/',
  query('status').optional().isIn(['pending', 'sent', 'responded', 'declined']),
  query('isVisible').optional().isBoolean(),
  handleValidationErrors,
  referenceController.getUserReferences.bind(referenceController)
);

/**
 * GET /api/v1/references/statistics
 * Get reference statistics
 */
router.get('/statistics',
  referenceController.getStatistics.bind(referenceController)
);

/**
 * GET /api/v1/references/:referenceId
 * Get a single reference request
 */
router.get('/:referenceId',
  param('referenceId').isUUID(),
  handleValidationErrors,
  referenceController.getReference.bind(referenceController)
);

/**
 * PUT /api/v1/references/:referenceId
 * Update reference request
 */
router.put('/:referenceId',
  param('referenceId').isUUID(),
  body('requestMessage').optional().isString().isLength({ min: 10, max: 1000 }),
  body('urgency').optional().isIn(['urgent', 'normal', 'flexible']),
  body('isVisible').optional().isBoolean(),
  body('canContactDirectly').optional().isBoolean(),
  handleValidationErrors,
  referenceController.updateReference.bind(referenceController)
);

/**
 * POST /api/v1/references/:referenceId/send
 * Send reference request email
 */
router.post('/:referenceId/send',
  param('referenceId').isUUID(),
  handleValidationErrors,
  referenceController.sendReference.bind(referenceController)
);

/**
 * POST /api/v1/references/:referenceId/reminder
 * Send reminder for pending reference
 */
router.post('/:referenceId/reminder',
  param('referenceId').isUUID(),
  handleValidationErrors,
  referenceController.sendReminder.bind(referenceController)
);

/**
 * PATCH /api/v1/references/:referenceId/visibility
 * Update reference visibility
 */
router.patch('/:referenceId/visibility',
  param('referenceId').isUUID(),
  body('isVisible').isBoolean(),
  handleValidationErrors,
  referenceController.updateVisibility.bind(referenceController)
);

/**
 * DELETE /api/v1/references/:referenceId
 * Delete reference request
 */
router.delete('/:referenceId',
  param('referenceId').isUUID(),
  handleValidationErrors,
  referenceController.deleteReference.bind(referenceController)
);

export default router;
