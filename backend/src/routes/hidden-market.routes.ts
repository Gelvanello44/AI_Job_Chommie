import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { param, validationResult } from 'express-validator';
import { HiddenMarketService } from '../services/hiddenMarket.service.js';

const router = Router();

router.use(authenticate);

router.get('/opportunities', async (_req, res) => {
  const items = await HiddenMarketService.list();
  res.json({ success: true, data: items });
});

router.get('/opportunities/:id',
  param('id').isString().isLength({ min: 3 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const item = await HiddenMarketService.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Opportunity not found' });
    }
    res.json({ success: true, data: item });
  }
);

export default router;
