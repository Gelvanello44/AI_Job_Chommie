import { Router } from 'express';
import { AnalyticsController } from '../controllers/remaining-controllers.js';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const analyticsController = new AnalyticsController();

// Rate limiting for analytics operations
const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: {
    success: false,
    error: 'Too many analytics requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All analytics routes require authentication
router.use(authenticate);

// User analytics
router.get('/dashboard', analyticsLimiter, analyticsController.getDashboardAnalytics);
router.get('/profile-views', analyticsController.getProfileViews);
router.get('/application-stats', analyticsController.getApplicationStats);
router.get('/job-search-stats', analyticsController.getJobSearchStats);
router.get('/interview-performance', analyticsController.getInterviewPerformance);

// Export functionality
router.post('/export', analyticsLimiter, analyticsController.exportAnalytics);
router.get('/export/formats', analyticsController.getExportFormats);
router.get('/export/:exportId/status', analyticsController.getExportStatus);
router.get('/export/:exportId/download', analyticsController.downloadExport);

// Time-based analytics
router.get('/trends/weekly', analyticsController.getWeeklyTrends);
router.get('/trends/monthly', analyticsController.getMonthlyTrends);
router.get('/trends/yearly', analyticsController.getYearlyTrends);
router.get('/trends/custom', analyticsController.getCustomTrends);

// Performance metrics
router.get('/performance/overview', analyticsController.getPerformanceOverview);
router.get('/performance/success-rate', analyticsController.getSuccessRate);
router.get('/performance/response-time', analyticsController.getAverageResponseTime);
router.get('/performance/conversion', analyticsController.getConversionMetrics);

// Industry insights
router.get('/insights/industry', analyticsController.getIndustryInsights);
router.get('/insights/salary', analyticsController.getSalaryInsights);
router.get('/insights/skills', analyticsController.getSkillsInsights);
router.get('/insights/market', analyticsController.getMarketInsights);

// Comparison analytics
router.get('/compare/peers', analyticsController.compareToPeers);
router.get('/compare/industry-average', analyticsController.compareToIndustryAverage);
router.get('/compare/location', analyticsController.compareByLocation);

// Reports
router.get('/reports/generate', analyticsLimiter, analyticsController.generateReport);
router.get('/reports/list', analyticsController.listReports);
router.get('/reports/:reportId', analyticsController.getReport);
router.delete('/reports/:reportId', analyticsController.deleteReport);

// Real-time analytics
router.get('/realtime/active-users', analyticsController.getActiveUsers);
router.get('/realtime/current-activity', analyticsController.getCurrentActivity);
router.get('/realtime/live-stats', analyticsController.getLiveStats);

// Employer analytics
router.get('/employer/job-performance', analyticsController.getJobPostingPerformance);
router.get('/employer/candidate-quality', analyticsController.getCandidateQualityMetrics);
router.get('/employer/hiring-funnel', analyticsController.getHiringFunnelAnalytics);
router.get('/employer/time-to-hire', analyticsController.getTimeToHireMetrics);

export default router;
