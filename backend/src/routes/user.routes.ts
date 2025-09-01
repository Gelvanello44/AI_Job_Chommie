import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();
const authController = new AuthController();

// Get current user profile - this is what the frontend expects
router.get('/me', authenticate, authController.getProfile);

export default router;
