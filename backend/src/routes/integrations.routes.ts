import { Router } from 'express';
import { IntegrationsController } from '../controllers/remaining-controllers.js';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const integrationsController = new IntegrationsController();

// Rate limiting for integration operations
const integrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: {
    success: false,
    error: 'Too many integration requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All integration routes require authentication
router.use(authenticate);

// General integration management
router.get('/status', integrationsController.getAllIntegrationStatus);
router.get('/available', integrationsController.getAvailableIntegrations);
router.post('/test-connection/:provider', integrationLimiter, integrationsController.testConnection);

// LinkedIn Integration
router.post('/linkedin/connect', integrationLimiter, integrationsController.connectLinkedIn);
router.delete('/linkedin/disconnect', integrationsController.disconnectLinkedIn);
router.get('/linkedin/profile', integrationsController.getLinkedInProfile);
router.post('/linkedin/import-profile', integrationLimiter, integrationsController.importLinkedInProfile);
router.get('/linkedin/jobs', integrationsController.getLinkedInJobs);
router.post('/linkedin/apply/:jobId', integrationLimiter, integrationsController.applyViaLinkedIn);
router.get('/linkedin/connections', integrationsController.getLinkedInConnections);
router.post('/linkedin/sync', integrationLimiter, integrationsController.syncLinkedInData);
router.get('/linkedin/recommendations', integrationsController.getLinkedInRecommendations);
router.post('/linkedin/share', integrationsController.shareOnLinkedIn);

// Indeed Integration
router.post('/indeed/connect', integrationLimiter, integrationsController.connectIndeed);
router.delete('/indeed/disconnect', integrationsController.disconnectIndeed);
router.get('/indeed/profile', integrationsController.getIndeedProfile);
router.post('/indeed/import-resume', integrationLimiter, integrationsController.importIndeedResume);
router.get('/indeed/jobs', integrationsController.getIndeedJobs);
router.get('/indeed/saved-jobs', integrationsController.getIndeedSavedJobs);
router.post('/indeed/apply/:jobId', integrationLimiter, integrationsController.applyViaIndeed);
router.get('/indeed/applications', integrationsController.getIndeedApplications);
router.post('/indeed/sync', integrationLimiter, integrationsController.syncIndeedData);
router.get('/indeed/salary-insights', integrationsController.getIndeedSalaryInsights);

// Glassdoor Integration
router.post('/glassdoor/connect', integrationLimiter, integrationsController.connectGlassdoor);
router.delete('/glassdoor/disconnect', integrationsController.disconnectGlassdoor);
router.get('/glassdoor/profile', integrationsController.getGlassdoorProfile);
router.get('/glassdoor/jobs', integrationsController.getGlassdoorJobs);
router.get('/glassdoor/company/:companyId', integrationsController.getGlassdoorCompanyInfo);
router.get('/glassdoor/reviews/:companyId', integrationsController.getGlassdoorReviews);
router.get('/glassdoor/salaries/:jobTitle', integrationsController.getGlassdoorSalaries);
router.get('/glassdoor/interview-insights/:companyId', integrationsController.getGlassdoorInterviewInsights);
router.post('/glassdoor/sync', integrationLimiter, integrationsController.syncGlassdoorData);
router.post('/glassdoor/track-company/:companyId', integrationsController.trackGlassdoorCompany);

// OAuth callbacks
router.get('/linkedin/callback', integrationsController.linkedInOAuthCallback);
router.get('/indeed/callback', integrationsController.indeedOAuthCallback);
router.get('/glassdoor/callback', integrationsController.glassdoorOAuthCallback);

// Data import/export
router.post('/import/:provider', integrationLimiter, integrationsController.importData);
router.get('/export/:provider', integrationsController.exportData);

// Sync settings
router.get('/sync/settings', integrationsController.getSyncSettings);
router.put('/sync/settings', integrationsController.updateSyncSettings);
router.post('/sync/manual/:provider', integrationLimiter, integrationsController.manualSync);
router.get('/sync/history', integrationsController.getSyncHistory);

// Integration analytics
router.get('/analytics/:provider', integrationsController.getIntegrationAnalytics);
router.get('/analytics/usage', integrationsController.getUsageAnalytics);
router.get('/analytics/performance', integrationsController.getPerformanceMetrics);

export default router;
