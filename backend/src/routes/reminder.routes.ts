import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';
import { reminderController } from '../controllers/reminder.controller.js';

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
 * POST /api/v1/reminders
 * Create a new reminder
 */
router.post('/',
  body('type').isIn(['APPLICATION_FOLLOWUP', 'INTERVIEW', 'MILESTONE', 'REFERENCE_REQUEST', 'CUSTOM']).notEmpty(),
  body('applicationId').optional().isUUID(),
  body('interviewId').optional().isUUID(),
  body('title').isString().trim().notEmpty().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('scheduledFor').isISO8601().toDate(),
  body('recurring').optional().isBoolean(),
  body('recurrencePattern').optional().isIn(['daily', 'weekly', 'monthly']),
  body('recurrenceEndDate').optional().isISO8601().toDate(),
  handleValidationErrors,
  reminderController.createReminder.bind(reminderController)
);

/**
 * GET /api/v1/reminders
 * Get user's reminders
 */
router.get('/',
  query('type').optional().isIn(['APPLICATION_FOLLOWUP', 'INTERVIEW', 'MILESTONE', 'REFERENCE_REQUEST', 'CUSTOM']),
  query('status').optional().isIn(['PENDING', 'SENT', 'FAILED', 'CANCELLED']),
  query('upcoming').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors,
  reminderController.getUserReminders.bind(reminderController)
);

/**
 * GET /api/v1/reminders/:reminderId
 * Get a specific reminder
 */
router.get('/:reminderId',
  param('reminderId').isUUID(),
  handleValidationErrors,
  reminderController.getReminderById.bind(reminderController)
);

/**
 * PUT /api/v1/reminders/:reminderId
 * Update a reminder
 */
router.put('/:reminderId',
  param('reminderId').isUUID(),
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('scheduledFor').optional().isISO8601().toDate(),
  body('status').optional().isIn(['PENDING', 'SENT', 'FAILED', 'CANCELLED']),
  handleValidationErrors,
  reminderController.updateReminder.bind(reminderController)
);

/**
 * DELETE /api/v1/reminders/:reminderId
 * Delete a reminder
 */
router.delete('/:reminderId',
  param('reminderId').isUUID(),
  handleValidationErrors,
  reminderController.deleteReminder.bind(reminderController)
);

/**
 * GET /api/v1/reminders/suggestions/:applicationId
 * Get smart reminder suggestions for an application
 */
router.get('/suggestions/:applicationId',
  param('applicationId').isUUID(),
  handleValidationErrors,
  reminderController.getSmartSuggestions.bind(reminderController)
);

/**
 * POST /api/v1/reminders/suggestions/:applicationId
 * Create reminder from suggestion
 */
router.post('/suggestions/:applicationId',
  param('applicationId').isUUID(),
  body('suggestionIndex').isInt({ min: 0 }),
  handleValidationErrors,
  reminderController.createFromSuggestion.bind(reminderController)
);

export default router;
