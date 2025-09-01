import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
// import { validateBody } from '../middleware/validation.js'; // Not used
import rateLimit from 'express-rate-limit';
import { csrfProtectAuth, sensitiveOperationCSRF } from '../middleware/csrf';
import { basicXSSProtection } from '../middleware/xss';

const router = Router();
const authController = new AuthController();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again later.',
  },
});

// Public routes
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);

// Password reset
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Email verification
router.post('/verify-email', ...basicXSSProtection, authController.verifyEmail);
router.post('/send-email-verification', authenticate, ...csrfProtectAuth, authController.sendEmailVerification);

// Phone verification
router.post('/send-phone-verification', authenticate, ...csrfProtectAuth, authController.sendPhoneVerification);
router.post('/verify-phone', authenticate, ...csrfProtectAuth, authController.verifyPhone);

// Profile management
router.get('/profile', authenticate, authController.getProfile);
router.put('/change-password', authenticate, ...sensitiveOperationCSRF(), authController.changePassword);

// Two-Factor Authentication
router.post('/enable-2fa', authenticate, ...sensitiveOperationCSRF(), authController.enable2FA);
router.post('/disable-2fa', authenticate, ...sensitiveOperationCSRF(), authController.disable2FA);

// Account management
router.delete('/account', authenticate, ...sensitiveOperationCSRF(), authController.deleteAccount);

// OAuth routes (will be configured with Passport.js)
router.get('/google', (_req, res) => {
  res.redirect(`/auth/google`);
});

router.get('/google/callback', authController.googleCallback);

router.get('/linkedin', (_req, res) => {
  res.redirect(`/auth/linkedin`);
});

router.get('/linkedin/callback', authController.linkedinCallback);

export default router;
