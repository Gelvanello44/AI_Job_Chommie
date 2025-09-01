/**
 * Quota Management Routes
 * Routes for subscription quota tracking and usage analytics
 */

import { Router } from 'express';
import { QuotaController } from '../controllers/quota.controller.js';
import { authenticate } from '../middleware/auth.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply authentication to all quota routes
router.use(authenticate);

/**
 * GET /api/v1/quota/status
 * Get user's current quota status and feature access
 */
router.get('/status', QuotaController.getQuotaStatus);

/**
 * GET /api/v1/quota/analytics  
 * Get detailed usage analytics for user
 */
router.get('/analytics', QuotaController.getUserAnalytics);

/**
 * GET /api/v1/quota/plans
 * Get plan information and pricing (aligned with PricingPage.jsx)
 */
router.get('/plans', QuotaController.getPlansInfo);

/**
 * GET /api/v1/quota/can-apply
 * Check if user can apply for jobs (quota availability)
 */
router.get('/can-apply', QuotaController.canApplyCheck);

/**
 * GET /api/v1/quota/meter
 * Get quota meter widget data for dashboard
 */
router.get('/meter', QuotaController.getQuotaMeter);

/**
 * GET /api/v1/quota/upcoming-applications
 * Get upcoming applications widget data
 */
router.get('/upcoming-applications', QuotaController.getUpcomingApplications);

/**
 * POST /api/v1/quota/reset/:userId
 * Force quota reset (admin only)
 */
router.post(
  '/reset/:userId',
  strictRateLimiter, // Use preconfigured strict rate limiter
  QuotaController.forceQuotaReset
);

export default router;
