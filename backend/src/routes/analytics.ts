/**
 * Payment Analytics API Routes
 * Provides endpoints for payment insights, provider comparisons, and business reporting
 */

import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimit';
import { validateInput } from '../middleware/validation';
import { paymentAnalyticsService } from '../services/payment/PaymentAnalyticsService';
import { logger } from '../utils/logger';
import { body, query } from 'express-validator';

const router = express.Router();

// Apply authentication and rate limiting to all analytics routes
router.use(authenticateUser);
router.use(rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30 // 30 requests per minute
}));

/**
 * GET /analytics/payments - Get comprehensive payment analytics
 */
router.get('/payments',
  validateInput([
    query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']),
    query('currency').optional().isLength({ min: 3, max: 3 })
  ]),
  async (req, res) => {
    try {
      // TODO: Add role-based access control - only allow admin/manager roles
      const { timeRange = '30d', currency = 'ZAR' } = req.query;

      const analytics = await paymentAnalyticsService.getPaymentAnalytics(
        timeRange as any,
        currency as string
      );

      res.json({
        success: true,
        data: analytics,
        metadata: {
          timeRange,
          currency,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching payment analytics', { error, user: req.user });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment analytics'
      });
    }
  }
);

/**
 * GET /analytics/providers/:provider - Get detailed provider metrics
 */
router.get('/providers/:provider',
  validateInput([
    query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']),
    query('currency').optional().isLength({ min: 3, max: 3 })
  ]),
  async (req, res) => {
    try {
      const { provider } = req.params;
      const { timeRange = '30d', currency = 'ZAR' } = req.query;

      if (!['yoco', 'paystack'].includes(provider)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid provider. Must be yoco or paystack'
        });
      }

      const { startDate, endDate } = getDateRange(timeRange as string);
      const metrics = await paymentAnalyticsService.getProviderMetrics(
        provider as any,
        startDate,
        endDate,
        currency as string
      );

      res.json({
        success: true,
        data: {
          provider,
          metrics,
          timeRange,
          currency
        }
      });
    } catch (error) {
      logger.error('Error fetching provider metrics', { error, provider: req.params.provider });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch provider metrics'
      });
    }
  }
);

/**
 * GET /analytics/comparison - Compare provider performance
 */
router.get('/comparison',
  validateInput([
    query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']),
    query('currency').optional().isLength({ min: 3, max: 3 })
  ]),
  async (req, res) => {
    try {
      const { timeRange = '30d', currency = 'ZAR' } = req.query;
      const { startDate, endDate } = getDateRange(timeRange as string);

      const comparison = await paymentAnalyticsService.getProviderComparison(
        startDate,
        endDate,
        currency as string
      );

      res.json({
        success: true,
        data: {
          comparison,
          summary: {
            betterProvider: comparison.yoco.successRate > comparison.paystack.successRate ? 'yoco' : 'paystack',
            costEffectiveProvider: comparison.yoco.fees.percentage < comparison.paystack.fees.percentage ? 'yoco' : 'paystack',
            fasterProvider: comparison.yoco.averageResponseTime < comparison.paystack.averageResponseTime ? 'yoco' : 'paystack'
          },
          timeRange,
          currency
        }
      });
    } catch (error) {
      logger.error('Error fetching provider comparison', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch provider comparison'
      });
    }
  }
);

/**
 * GET /analytics/insights - Get payment insights and recommendations
 */
router.get('/insights',
  validateInput([
    query('timeRange').optional().isIn(['30d', '90d'])
  ]),
  async (req, res) => {
    try {
      const { timeRange = '30d' } = req.query;

      const insights = await paymentAnalyticsService.getPaymentInsights(timeRange as any);

      res.json({
        success: true,
        data: insights,
        metadata: {
          timeRange,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching payment insights', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payment insights'
      });
    }
  }
);

/**
 * GET /analytics/costs/:provider - Get provider cost analysis
 */
router.get('/costs/:provider',
  validateInput([
    query('timeRange').optional().isIn(['30d', '90d', '1y'])
  ]),
  async (req, res) => {
    try {
      const { provider } = req.params;
      const { timeRange = '30d' } = req.query;

      if (!['yoco', 'paystack'].includes(provider)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid provider. Must be yoco or paystack'
        });
      }

      const costAnalysis = await paymentAnalyticsService.getProviderCostAnalysis(
        provider as any,
        timeRange as any
      );

      res.json({
        success: true,
        data: {
          provider,
          costAnalysis,
          timeRange
        }
      });
    } catch (error) {
      logger.error('Error fetching provider cost analysis', { error, provider: req.params.provider });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch provider cost analysis'
      });
    }
  }
);

/**
 * GET /analytics/attribution - Get revenue attribution analysis
 */
router.get('/attribution',
  validateInput([
    query('timeRange').optional().isIn(['30d', '90d'])
  ]),
  async (req, res) => {
    try {
      const { timeRange = '30d' } = req.query;

      const attribution = await paymentAnalyticsService.getRevenueAttribution(timeRange as any);

      res.json({
        success: true,
        data: attribution,
        metadata: {
          timeRange,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching revenue attribution', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch revenue attribution'
      });
    }
  }
);

/**
 * GET /analytics/revenue-breakdown - Get detailed revenue breakdown
 */
router.get('/revenue-breakdown',
  validateInput([
    query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
  ]),
  async (req, res) => {
    try {
      const { timeRange = '30d' } = req.query;
      const { startDate, endDate } = getDateRange(timeRange as string);

      const breakdown = await paymentAnalyticsService.getRevenueBreakdown(startDate, endDate);

      res.json({
        success: true,
        data: breakdown,
        metadata: {
          timeRange,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching revenue breakdown', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch revenue breakdown'
      });
    }
  }
);

/**
 * GET /analytics/subscriptions - Get subscription-specific analytics
 */
router.get('/subscriptions',
  validateInput([
    query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
  ]),
  async (req, res) => {
    try {
      const { timeRange = '30d' } = req.query;
      const { startDate, endDate } = getDateRange(timeRange as string);

      const subscriptionMetrics = await paymentAnalyticsService.getSubscriptionMetrics(startDate, endDate);

      res.json({
        success: true,
        data: subscriptionMetrics,
        metadata: {
          timeRange,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching subscription analytics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subscription analytics'
      });
    }
  }
);

/**
 * POST /analytics/export - Export payment data
 */
router.post('/export',
  validateInput([
    body('format').isIn(['csv', 'json']),
    body('filters').optional().isObject(),
    body('filters.provider').optional().isIn(['yoco', 'paystack']),
    body('filters.status').optional().isIn(['SUCCESS', 'FAILED', 'PENDING']),
    body('filters.startDate').optional().isISO8601(),
    body('filters.endDate').optional().isISO8601(),
    body('filters.currency').optional().isLength({ min: 3, max: 3 })
  ]),
  async (req, res) => {
    try {
      // TODO: Add role-based access control - only allow admin/manager roles
      const { format, filters = {} } = req.body;

      // Convert date strings to Date objects
      if (filters.startDate) {
        filters.startDate = new Date(filters.startDate);
      }
      if (filters.endDate) {
        filters.endDate = new Date(filters.endDate);
      }

      const exportData = await paymentAnalyticsService.exportPaymentData(format, filters);

      // Set appropriate headers for file download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `payment-export-${timestamp}.${format}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');

      res.send(exportData);
    } catch (error) {
      logger.error('Error exporting payment data', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to export payment data'
      });
    }
  }
);

/**
 * GET /analytics/dashboard - Get dashboard summary for quick overview
 */
router.get('/dashboard',
  validateInput([
    query('timeRange').optional().isIn(['7d', '30d', '90d'])
  ]),
  async (req, res) => {
    try {
      const { timeRange = '30d' } = req.query;

      // Get multiple analytics in parallel for dashboard
      const [analytics, insights, attribution] = await Promise.all([
        paymentAnalyticsService.getPaymentAnalytics(timeRange as any),
        paymentAnalyticsService.getPaymentInsights(timeRange as any),
        paymentAnalyticsService.getRevenueAttribution(timeRange as any)
      ]);

      // Create a simplified dashboard view
      const dashboard = {
        kpis: {
          totalRevenue: analytics.overview.totalRevenue,
          totalTransactions: analytics.overview.totalTransactions,
          successRate: analytics.overview.successRate,
          revenueGrowth: analytics.overview.revenueGrowth,
          conversionRate: analytics.conversionFunnel.conversionRate,
          churnRate: analytics.subscriptionMetrics.churnRate
        },
        providerHealth: {
          yoco: {
            uptime: analytics.providerComparison.yoco.uptime,
            successRate: analytics.providerComparison.yoco.successRate,
            marketShare: analytics.providerComparison.yoco.marketShare
          },
          paystack: {
            uptime: analytics.providerComparison.paystack.uptime,
            successRate: analytics.providerComparison.paystack.successRate,
            marketShare: analytics.providerComparison.paystack.marketShare
          }
        },
        recentTrends: analytics.revenueBreakdown.byTimeSegment.slice(-7), // Last 7 days
        topCountries: Object.entries(attribution.byGeography)
          .sort(([,a], [,b]) => b.revenue - a.revenue)
          .slice(0, 5)
          .map(([country, data]) => ({ country, ...data })),
        alerts: insights.alerts.filter(alert => alert.type === 'error' || alert.actionRequired),
        recommendations: insights.recommendations.slice(0, 3) // Top 3 recommendations
      };

      res.json({
        success: true,
        data: dashboard,
        metadata: {
          timeRange,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching analytics dashboard', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics dashboard'
      });
    }
  }
);

/**
 * GET /analytics/conversion-funnel - Get detailed conversion funnel analysis
 */
router.get('/conversion-funnel',
  validateInput([
    query('timeRange').optional().isIn(['7d', '30d', '90d', '1y'])
  ]),
  async (req, res) => {
    try {
      const { timeRange = '30d' } = req.query;
      const { startDate, endDate } = getDateRange(timeRange as string);

      const conversionFunnel = await paymentAnalyticsService.getConversionFunnel(startDate, endDate);

      // Calculate conversion percentages for each step
      const conversionSteps = {
        ...conversionFunnel,
        stages: [
          {
            name: 'Payment Initialized',
            count: conversionFunnel.paymentInitialized,
            percentage: 100,
            dropOff: 0
          },
          {
            name: 'Payment Completed',
            count: conversionFunnel.paymentCompleted,
            percentage: conversionFunnel.paymentInitialized > 0 ? 
              (conversionFunnel.paymentCompleted / conversionFunnel.paymentInitialized) * 100 : 0,
            dropOff: conversionFunnel.paymentInitialized - conversionFunnel.paymentCompleted
          },
          {
            name: 'Subscription Created',
            count: conversionFunnel.subscriptionCreated,
            percentage: conversionFunnel.paymentCompleted > 0 ? 
              (conversionFunnel.subscriptionCreated / conversionFunnel.paymentCompleted) * 100 : 0,
            dropOff: conversionFunnel.paymentCompleted - conversionFunnel.subscriptionCreated
          }
        ]
      };

      res.json({
        success: true,
        data: conversionSteps,
        metadata: {
          timeRange,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching conversion funnel', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversion funnel'
      });
    }
  }
);

/**
 * GET /analytics/provider-cost-comparison - Compare costs between providers
 */
router.get('/provider-cost-comparison',
  validateInput([
    query('timeRange').optional().isIn(['30d', '90d', '1y'])
  ]),
  async (req, res) => {
    try {
      const { timeRange = '30d' } = req.query;

      const [yocoCosts, paystackCosts] = await Promise.all([
        paymentAnalyticsService.getProviderCostAnalysis('yoco', timeRange as any),
        paymentAnalyticsService.getProviderCostAnalysis('paystack', timeRange as any)
      ]);

      const comparison = {
        yoco: yocoCosts,
        paystack: paystackCosts,
        savings: {
          totalSavings: Math.abs(yocoCosts.processingFees - paystackCosts.processingFees),
          betterProvider: yocoCosts.processingFees < paystackCosts.processingFees ? 'yoco' : 'paystack',
          annualProjectedSavings: Math.abs(yocoCosts.projectedAnnualCost - paystackCosts.projectedAnnualCost)
        }
      };

      res.json({
        success: true,
        data: comparison,
        metadata: {
          timeRange,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching provider cost comparison', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch provider cost comparison'
      });
    }
  }
);

/**
 * GET /analytics/revenue-trends - Get revenue trends over time
 */
router.get('/revenue-trends',
  validateInput([
    query('timeRange').optional().isIn(['30d', '90d', '1y']),
    query('granularity').optional().isIn(['daily', 'weekly', 'monthly'])
  ]),
  async (req, res) => {
    try {
      const { timeRange = '90d', granularity = 'daily' } = req.query;
      const { startDate, endDate } = getDateRange(timeRange as string);

      const breakdown = await paymentAnalyticsService.getRevenueBreakdown(startDate, endDate);
      
      // Group time segments based on granularity
      const groupedTrends = groupTimeSegments(breakdown.byTimeSegment, granularity as string);

      res.json({
        success: true,
        data: {
          trends: groupedTrends,
          summary: {
            totalRevenue: groupedTrends.reduce((sum, segment) => sum + segment.revenue, 0),
            totalTransactions: groupedTrends.reduce((sum, segment) => sum + segment.transactions, 0),
            averageDailyRevenue: groupedTrends.length > 0 ? 
              groupedTrends.reduce((sum, segment) => sum + segment.revenue, 0) / groupedTrends.length : 0
          }
        },
        metadata: {
          timeRange,
          granularity,
          periodCount: groupedTrends.length
        }
      });
    } catch (error) {
      logger.error('Error fetching revenue trends', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch revenue trends'
      });
    }
  }
);

/**
 * GET /analytics/performance-metrics - Get real-time performance metrics
 */
router.get('/performance-metrics', async (req, res) => {
  try {
    // Get last 24 hours of data for real-time metrics
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    const [realtimeMetrics, providerComparison] = await Promise.all([
      paymentAnalyticsService.getPaymentAnalytics('7d'),
      paymentAnalyticsService.getProviderComparison(startDate, endDate)
    ]);

    const performanceMetrics = {
      last24Hours: {
        successRate: realtimeMetrics.overview.successRate,
        averageResponseTime: {
          yoco: providerComparison.yoco.averageResponseTime,
          paystack: providerComparison.paystack.averageResponseTime
        },
        uptime: {
          yoco: providerComparison.yoco.uptime,
          paystack: providerComparison.paystack.uptime
        }
      },
      alerts: await paymentAnalyticsService.getPaymentInsights('30d').then(insights => insights.alerts),
      systemStatus: {
        yoco: providerComparison.yoco.uptime > 99 ? 'healthy' : 
               providerComparison.yoco.uptime > 95 ? 'degraded' : 'unhealthy',
        paystack: providerComparison.paystack.uptime > 99 ? 'healthy' : 
                  providerComparison.paystack.uptime > 95 ? 'degraded' : 'unhealthy'
      }
    };

    res.json({
      success: true,
      data: performanceMetrics,
      metadata: {
        generatedAt: new Date().toISOString(),
        monitoringPeriod: '24h'
      }
    });
  } catch (error) {
    logger.error('Error fetching performance metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics'
    });
  }
});

// ======================================
// HELPER FUNCTIONS
// ======================================

function getDateRange(timeRange: string): { startDate: Date; endDate: Date; } {
  const endDate = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
  }

  return { startDate, endDate };
}

function groupTimeSegments(
  segments: Array<{ date: string; revenue: number; transactions: number; }>,
  granularity: string
): Array<{ date: string; revenue: number; transactions: number; }> {
  if (granularity === 'daily') {
    return segments;
  }

  const grouped: Record<string, { revenue: number; transactions: number; }> = {};

  segments.forEach(segment => {
    const date = new Date(segment.date);
    let groupKey: string;

    if (granularity === 'weekly') {
      // Group by week (ISO week)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      groupKey = weekStart.toISOString().split('T')[0];
    } else if (granularity === 'monthly') {
      // Group by month
      groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      groupKey = segment.date;
    }

    if (!grouped[groupKey]) {
      grouped[groupKey] = { revenue: 0, transactions: 0 };
    }

    grouped[groupKey].revenue += segment.revenue;
    grouped[groupKey].transactions += segment.transactions;
  });

  return Object.entries(grouped)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default router;
