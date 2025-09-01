import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query, validationResult } from 'express-validator';
import { ContentCalendarService } from '../services/contentCalendar.service.js';

const router = Router();

// Require auth for personalized planning
router.use(authenticate);

router.get('/suggest',
  query('topic').optional().isString().isLength({ min: 2, max: 60 }),
  query('audience').optional().isString().isLength({ min: 2, max: 80 }),
  query('weeks').optional().isInt({ min: 1, max: 12 }),
  query('cadencePerWeek').optional().isInt({ min: 1, max: 7 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { topic, audience, weeks, cadencePerWeek, startDate } = req.query as any;
    const plan = ContentCalendarService.generateCalendar({
      topic, audience,
      weeks: weeks ? parseInt(weeks, 10) : undefined,
      cadencePerWeek: cadencePerWeek ? parseInt(cadencePerWeek, 10) : undefined,
      startDate
    });

    res.json({ success: true, data: plan });
  }
);

export default router;
