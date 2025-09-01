import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';
import { calendarIntegrationController } from '../controllers/calendar-integration.controller.js';

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

// OAuth callback routes (no auth required)
/**
 * GET /api/v1/calendar/auth/google/callback
 * Google OAuth callback
 */
router.get('/auth/google/callback', 
  calendarIntegrationController.handleGoogleCallback.bind(calendarIntegrationController)
);

/**
 * GET /api/v1/calendar/auth/microsoft/callback
 * Microsoft OAuth callback
 */
router.get('/auth/microsoft/callback', 
  calendarIntegrationController.handleMicrosoftCallback.bind(calendarIntegrationController)
);

// Apply authentication to remaining routes
router.use(authenticate);

/**
 * GET /api/v1/calendar/auth/google
 * Get Google Calendar authorization URL
 */
router.get('/auth/google',
  calendarIntegrationController.getGoogleAuthUrl.bind(calendarIntegrationController)
);

/**
 * GET /api/v1/calendar/auth/microsoft
 * Get Microsoft Calendar authorization URL
 */
router.get('/auth/microsoft',
  calendarIntegrationController.getMicrosoftAuthUrl.bind(calendarIntegrationController)
);

/**
 * GET /api/v1/calendar/status
 * Get calendar integration status
 */
router.get('/status',
  calendarIntegrationController.getIntegrationStatus.bind(calendarIntegrationController)
);

/**
 * GET /api/v1/calendar/available-slots
 * Get available time slots from calendar
 */
router.get('/available-slots',
  query('provider').isIn(['GOOGLE', 'MICROSOFT']),
  query('startDate').isISO8601().toDate(),
  query('endDate').isISO8601().toDate(),
  query('duration').optional().isInt({ min: 15, max: 480 }),
  handleValidationErrors,
  calendarIntegrationController.getAvailableTimeSlots.bind(calendarIntegrationController)
);

/**
 * POST /api/v1/calendar/sync-interview
 * Sync interview to calendar
 */
router.post('/sync-interview',
  body('interviewScheduleId').isUUID(),
  body('provider').isIn(['GOOGLE', 'MICROSOFT']),
  handleValidationErrors,
  calendarIntegrationController.syncInterviewToCalendar.bind(calendarIntegrationController)
);

/**
 * PUT /api/v1/calendar/interview/:interviewScheduleId
 * Update calendar event for interview
 */
router.put('/interview/:interviewScheduleId',
  param('interviewScheduleId').isUUID(),
  body('provider').isIn(['GOOGLE', 'MICROSOFT']),
  handleValidationErrors,
  calendarIntegrationController.updateCalendarEvent.bind(calendarIntegrationController)
);

/**
 * DELETE /api/v1/calendar/interview/:interviewScheduleId
 * Delete calendar event for interview
 */
router.delete('/interview/:interviewScheduleId',
  param('interviewScheduleId').isUUID(),
  body('provider').isIn(['GOOGLE', 'MICROSOFT']),
  handleValidationErrors,
  calendarIntegrationController.deleteCalendarEvent.bind(calendarIntegrationController)
);

/**
 * DELETE /api/v1/calendar/disconnect/:provider
 * Disconnect calendar integration
 */
router.delete('/disconnect/:provider',
  param('provider').isIn(['GOOGLE', 'MICROSOFT']),
  handleValidationErrors,
  calendarIntegrationController.disconnectCalendar.bind(calendarIntegrationController)
);

export default router;
