import { Router } from 'express';
import { badgeController } from '../controllers/badge.controller.js';

const router = Router();

// Public endpoint (no auth) so images can be embedded externally
router.get('/generate', badgeController.generate.bind(badgeController));

export default router;
