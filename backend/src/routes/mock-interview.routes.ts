import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import { MockInterviewService, Difficulty } from '../services/mockInterview.service.js';

const router = Router();

router.use(authenticate);

router.post('/session',
  body('role').isString().isLength({ min: 2, max: 60 }),
  body('difficulty').optional().isIn(['junior', 'mid', 'senior']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { role, difficulty } = req.body as { role: string; difficulty?: Difficulty };
    const session = MockInterviewService.createSession(role, (difficulty || 'mid'));
    res.status(201).json({ success: true, data: session });
  }
);

router.post('/score',
  body('questions').isArray({ min: 1 }),
  body('answers').isObject(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { questions, answers } = req.body as { questions: any[]; answers: Record<string,string> };
    const results = MockInterviewService.scoreAnswers(questions, answers);
    const avg = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
    res.json({ success: true, data: { results, average: avg } });
  }
);

export default router;
