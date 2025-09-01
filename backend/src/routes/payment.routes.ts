/**
 * Payment Routes
 * Handles payment initialization, verification, and subscription management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment';
import { subscriptionPaymentService } from '../services/payment/SubscriptionPaymentService';
import { paymentHealthMonitor } from '../services/payment/PaymentHealthMonitor';
import { paymentRetryService } from '../services/payment/PaymentRetryService';
import { paymentAnalyticsService } from '../services/payment/PaymentAnalyticsService';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { csrfProtectPayments, sensitiveOperationCSRF } from '../middleware/csrf';
import { fileUploadXSSProtection } from '../middleware/xss';
import { body, query, param } from 'express-validator';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { SubscriptionPlan } from '@prisma/client';

const router = Router();

/**
 * Get available payment providers
 */
router.get('/providers', (req: Request, res: Response) => {
  const providers = paymentService.getAvailableProviders();
  const configs = providers.map(provider => ({
    id: provider,
    ...paymentService.getProviderConfig(provider)
  }));
  
  res.json({
    success: true,
    providers: configs,
    defaultProvider: process.env.DEFAULT_PAYMENT_PROVIDER || 'paystack'
  });
});

/**
 * Initialize a payment
 */
router.post(
  '/initialize',
  authenticate,
  ...csrfProtectPayments,
  [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('currency').optional().isIn(['NGN', 'ZAR', 'GHS', 'USD']).withMessage('Invalid currency'),
    body('provider').optional().isIn(['yoco', 'paystack']).withMessage('Invalid provider'),
    body('callback_url').optional().isURL().withMessage('Invalid callback URL'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, currency, provider, callback_url, metadata } = req.body;
      const user = req.user!;
      
      const result = await paymentService.initializePayment({
        email: user.email,
        amount: Math.round(amount * 100), // Convert to cents/kobo
        currency,
        provider,
        callback_url,
        metadata: {
          userId: user.id,
          ...metadata
        }
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Payment initialization error:', error);
      next(error);
    }
  }
);

/**
 * Verify a payment
 */
router.get(
  '/verify/:reference',
  authenticate,
  [
    param('reference').notEmpty().withMessage('Reference is required'),
    query('provider').optional().isIn(['yoco', 'paystack']).withMessage('Invalid provider')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reference } = req.params;
      const { provider } = req.query;
      
      const transaction = await paymentService.verifyPayment(
        reference, 
        provider as any
      );
      
      res.json({
        success: true,
        data: transaction
      });
    } catch (error) {
      logger.error('Payment verification error:', error);
      next(error);
    }
  }
);

/**
 * Create a subscription
 */
router.post(
  '/subscription',
  authenticate,
  ...csrfProtectPayments,
  [
    body('plan').notEmpty().withMessage('Plan is required'),
    body('provider').optional().isIn(['yoco', 'paystack']).withMessage('Invalid provider'),
    body('authorization').optional().isString().withMessage('Authorization must be a string')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { plan, provider, authorization } = req.body;
      const user = req.user!;
      
      const subscription = await paymentService.createSubscription({
        customer: {
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          phone: user.phone
        },
        plan,
        provider,
        authorization
      });
      
      res.json({
        success: true,
        data: subscription
      });
    } catch (error) {
      logger.error('Subscription creation error:', error);
      next(error);
    }
  }
);

/**
 * Get user's subscriptions
 */
router.get(
  '/subscriptions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      
      // For now, return subscription-related payments instead of subscriptions table
      const subscriptions = await prisma.payment.findMany({
        where: { 
          userId: user.id,
          type: 'subscription'
        },
        orderBy: { createdAt: 'desc' }
      });
      
      res.json({
        success: true,
        data: subscriptions
      });
    } catch (error) {
      logger.error('Error fetching subscriptions:', error);
      next(error);
    }
  }
);

/**
 * Cancel a subscription
 */
router.delete(
  '/subscription/:subscriptionId',
  authenticate,
  [
    param('subscriptionId').notEmpty().withMessage('Subscription ID is required'),
    query('provider').optional().isIn(['yoco', 'paystack']).withMessage('Invalid provider')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { subscriptionId } = req.params;
      const { provider } = req.query;
      const user = req.user!;
      
      // Verify subscription payment belongs to user
      const subscription = await prisma.payment.findFirst({
        where: {
          paystackReference: subscriptionId, // Using reference as identifier
          userId: user.id,
          type: 'subscription'
        }
      });
      
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
      }
      
      const cancelled = await paymentService.cancelSubscription(
        subscriptionId,
        provider as any
      );
      
      res.json({
        success: true,
        data: { cancelled }
      });
    } catch (error) {
      logger.error('Subscription cancellation error:', error);
      next(error);
    }
  }
);

/**
 * Get payment history
 */
router.get(
  '/transactions',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('status').optional().isIn(['SUCCESS', 'FAILED', 'PENDING']).withMessage('Invalid status')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { limit = 20, offset = 0, status } = req.query;
      
      const where: any = { userId: user.id };
      if (status) {
        where.status = status;
      }
      
      const [transactions, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          take: Number(limit),
          skip: Number(offset),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.payment.count({ where })
      ]);
      
      res.json({
        success: true,
        data: {
          transactions,
          total,
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (error) {
      logger.error('Error fetching transactions:', error);
      next(error);
    }
  }
);

/**
 * Get manager payment analytics - Admin/Manager only
 */
router.get(
  '/manager/analytics',
  authenticate,
  [
    query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period'),
    query('provider').optional().isIn(['yoco', 'paystack', 'all']).withMessage('Invalid provider')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Note: In production, add proper role-based access control for managers/admins
      const { period = '30d', provider = 'all' } = req.query;
      
      // Calculate date range
      const periodDays = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      };
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays[period as keyof typeof periodDays]);
      
      // Build where clause for provider filter
      const whereClause: any = {
        createdAt: {
          gte: startDate
        }
      };
      
      if (provider !== 'all') {
        whereClause.provider = provider.toUpperCase();
      }
      
      // Get payment analytics
      const [transactions, totalRevenue, totalCount, successfulPayments, failedPayments] = await Promise.all([
        prisma.payment.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: 100, // Latest 100 transactions
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paystackReference: true,
            type: true,
            createdAt: true,
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }),
        prisma.payment.aggregate({
          where: {
            ...whereClause,
            status: 'SUCCESS'
          },
          _sum: { amount: true }
        }),
        prisma.payment.count({ where: whereClause }),
        prisma.payment.count({ 
          where: { ...whereClause, status: 'SUCCESS' } 
        }),
        prisma.payment.count({ 
          where: { ...whereClause, status: 'FAILED' } 
        })
      ]);
      
      // Get subscription analytics - using Payment model
      const [activeSubscriptions, subscriptionsByProvider] = await Promise.all([
        prisma.payment.count({ 
          where: { 
            status: 'SUCCESS',
            type: 'subscription' 
          } 
        }),
        prisma.payment.groupBy({
          by: ['type'],
          _count: { id: true },
          where: { 
            status: 'SUCCESS',
            type: 'subscription'
          }
        })
      ]);
      
      // Calculate daily revenue for the period (for charting)
      const dailyRevenue = await prisma.payment.groupBy({
        by: ['createdAt'],
        where: {
          ...whereClause,
          status: 'SUCCESS'
        },
        _sum: { amount: true },
        _count: { id: true }
      });
      
      // Group by day for chart data
      const revenueByDay = dailyRevenue.reduce((acc: any, item) => {
        const date = new Date(item.createdAt).toISOString().split('T')[0];
        acc[date] = {
          revenue: item._sum.amount || 0,
          transactions: item._count.id
        };
        return acc;
      }, {});
      
      res.json({
        success: true,
        data: {
          summary: {
            totalRevenue: totalRevenue._sum.amount || 0,
            totalTransactions: totalCount,
            successfulPayments,
            failedPayments,
            successRate: totalCount > 0 ? ((successfulPayments / totalCount) * 100).toFixed(1) : '0',
            activeSubscriptions,
            period,
            provider
          },
          subscriptionsByProvider: subscriptionsByProvider.reduce((acc: any, item) => {
            acc[item.type.toLowerCase()] = item._count.id;
            return acc;
          }, {}),
          recentTransactions: transactions,
          dailyRevenue: revenueByDay
        }
      });
    } catch (error) {
      logger.error('Error fetching manager payment analytics:', error);
      next(error);
    }
  }
);

/**
 * Get subscription plans
 */
router.get(
  '/plans',
  [
    query('provider').optional().isIn(['yoco', 'paystack']).withMessage('Invalid provider')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider } = req.query;
      
      // For now, return static plans. In production, you would fetch these from the payment provider
      const plans = [
        {
          id: 'FREE',
          name: 'Free Plan',
          amount: 0,
          interval: 'monthly',
          monthlyApplications: 2,
          features: [
            '2 job applications per month',
            'Basic CV builder',
            'Skills assessment',
            'Application tracking'
          ],
          providers: ['yoco', 'paystack']
        },
        {
          id: 'PROFESSIONAL',
          name: 'Professional Plan',
          amount: 800, // R8.00
          interval: 'monthly',
          monthlyApplications: 5,
          features: [
            '5 job applications per month',
            'Professional CV optimization',
            'Cover letter generation',
            'Weekly job alerts',
            'Analytics dashboard'
          ],
          providers: ['yoco', 'paystack']
        },
        {
          id: 'EXECUTIVE',
          name: 'Executive Plan',
          amount: 1700, // R17.00
          interval: 'monthly',
          monthlyApplications: 8,
          features: [
            '8 job applications per month',
            'Executive CV templates',
            'Personal brand audit',
            'Executive networking events',
            'Premium support',
            'Hidden job market access'
          ],
          providers: ['yoco', 'paystack']
        }
      ];
      
      // Filter by provider if specified
      const filteredPlans = provider
        ? plans.filter(plan => plan.providers.includes(provider as string))
        : plans;
      
      res.json({
        success: true,
        data: filteredPlans
      });
    } catch (error) {
      logger.error('Error fetching plans:', error);
      next(error);
    }
  }
);

/**
 * Upgrade subscription with Yoco/Paystack integration
 */
router.post(
  '/subscription/upgrade',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('newPlan').isIn(['PROFESSIONAL', 'EXECUTIVE']).withMessage('Invalid upgrade plan'),
    body('billingCycle').optional().isIn(['monthly', 'yearly']).withMessage('Invalid billing cycle'),
    body('paymentMethodId').optional().isString().withMessage('Payment method ID must be a string')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { newPlan, billingCycle, paymentMethodId } = req.body;
      const user = req.user!;

      const result = await subscriptionPaymentService.upgradeSubscription({
        userId: user.id,
        newPlan: newPlan as SubscriptionPlan,
        billingCycle: billingCycle || 'monthly',
        paymentMethodId
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Subscription upgrade error:', error);
      next(error);
    }
  }
);

/**
 * Downgrade subscription
 */
router.post(
  '/subscription/downgrade',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('newPlan').isIn(['FREE', 'PROFESSIONAL']).withMessage('Invalid downgrade plan')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { newPlan } = req.body;
      const user = req.user!;

      const result = await subscriptionPaymentService.downgradeSubscription({
        userId: user.id,
        newPlan: newPlan as SubscriptionPlan
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Subscription downgrade error:', error);
      next(error);
    }
  }
);

/**
 * Change billing cycle
 */
router.post(
  '/subscription/billing-cycle',
  authenticate,
  ...csrfProtectPayments,
  [
    body('billingCycle').isIn(['monthly', 'yearly']).withMessage('Invalid billing cycle')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { billingCycle } = req.body;
      const user = req.user!;

      const result = await subscriptionPaymentService.changeBillingCycle(
        user.id,
        billingCycle
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Billing cycle change error:', error);
      next(error);
    }
  }
);

/**
 * Cancel subscription with options
 */
router.post(
  '/subscription/cancel',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('immediate').optional().isBoolean().withMessage('Immediate must be a boolean'),
    body('reason').optional().isString().withMessage('Reason must be a string'),
    body('feedback').optional().isString().withMessage('Feedback must be a string')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { immediate, reason, feedback } = req.body;
      const user = req.user!;

      const result = await subscriptionPaymentService.cancelSubscription(user.id, {
        immediate: immediate || false,
        reason,
        feedback
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Subscription cancellation error:', error);
      next(error);
    }
  }
);

/**
 * Get subscription change options for user
 */
router.get(
  '/subscription/options',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      
      const options = await subscriptionPaymentService.getSubscriptionChangeOptions(user.id);
      
      res.json({
        success: true,
        data: options
      });
    } catch (error) {
      logger.error('Error fetching subscription options:', error);
      next(error);
    }
  }
);

/**
 * Get payment provider health status - Admin/Manager only
 */
router.get(
  '/health/providers',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Note: In production, add proper role-based access control
      const healthData = await paymentHealthMonitor.getAllProvidersHealth();
      
      res.json({
        success: true,
        data: healthData
      });
    } catch (error) {
      logger.error('Error fetching provider health:', error);
      next(error);
    }
  }
);

/**
 * Get payment provider health dashboard - Admin/Manager only
 */
router.get(
  '/health/dashboard',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Note: In production, add proper role-based access control
      const dashboard = await paymentHealthMonitor.getHealthDashboard();
      
      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error('Error fetching health dashboard:', error);
      next(error);
    }
  }
);

/**
 * Get provider analytics - Admin/Manager only
 */
router.get(
  '/health/analytics/:provider',
  authenticate,
  [
    param('provider').isIn(['yoco', 'paystack']).withMessage('Invalid provider'),
    query('timeRange').optional().isIn(['1h', '6h', '24h', '7d', '30d']).withMessage('Invalid time range')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Note: In production, add proper role-based access control
      const { provider } = req.params;
      const { timeRange = '24h' } = req.query;
      
      const analytics = await paymentHealthMonitor.getProviderAnalytics(
        provider as any,
        timeRange as any
      );
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error fetching provider analytics:', error);
      next(error);
    }
  }
);

/**
 * Force health check for all providers - Admin/Manager only
 */
router.post(
  '/health/check',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Note: In production, add proper role-based access control
      const results = await paymentHealthMonitor.forceHealthCheck();
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error forcing health check:', error);
      next(error);
    }
  }
);

/**
 * POST /payment/retry - Process payment with intelligent retry
 */
router.post(
  '/retry',
  authenticate,
  ...csrfProtectPayments,
  [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('currency').optional().isIn(['NGN', 'ZAR', 'GHS', 'USD']).withMessage('Invalid currency'),
    body('provider').optional().isIn(['yoco', 'paystack']).withMessage('Invalid provider'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object'),
    body('retryConfig').optional().isObject().withMessage('Retry config must be an object')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, currency = 'ZAR', provider, description, metadata, retryConfig } = req.body;
      const user = req.user!;
      
      const paymentData = {
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        userId: user.id,
        description,
        metadata: {
          userId: user.id,
          ...metadata
        }
      };
      
      const result = await paymentRetryService.processPaymentWithRetry(
        paymentData,
        provider,
        retryConfig
      );
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      logger.error('Payment retry error:', error);
      next(error);
    }
  }
);

/**
 * GET /payment/retry/statistics - Get retry system statistics - Admin only
 */
router.get(
  '/retry/statistics',
  authenticate,
  [
    query('timeRange').optional().isIn(['24h', '7d', '30d']).withMessage('Invalid time range')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - only allow admin roles
      const { timeRange = '7d' } = req.query;
      
      const statistics = await paymentRetryService.getRetryStatistics(timeRange as any);
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Error fetching retry statistics:', error);
      next(error);
    }
  }
);

/**
 * GET /payment/retry/health - Get retry system health - Admin only
 */
router.get(
  '/retry/health',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - only allow admin roles
      const health = await paymentRetryService.getRetrySystemHealth();
      
      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Error fetching retry system health:', error);
      next(error);
    }
  }
);

/**
 * POST /payment/retry/recover - Batch recover failed payments - Admin only
 */
router.post(
  '/retry/recover',
  authenticate,
  [
    body('batchSize').optional().isInt({ min: 1, max: 100 }).withMessage('Batch size must be between 1 and 100'),
    body('maxAge').optional().matches(/^\d+[hd]$/).withMessage('Max age must be in format like "24h" or "7d"')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - only allow admin roles
      const { batchSize = 50, maxAge = '24h' } = req.body;
      
      const results = await paymentRetryService.recoverFailedPayments(
        batchSize,
        maxAge
      );
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error during batch payment recovery:', error);
      next(error);
    }
  }
);

/**
 * GET /payment/analytics/comprehensive - Get comprehensive payment analytics - Admin only
 */
router.get(
  '/analytics/comprehensive',
  authenticate,
  [
    query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid time range'),
    query('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
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
      logger.error('Error fetching comprehensive analytics:', error);
      next(error);
    }
  }
);

/**
 * GET /payment/analytics/insights - Get payment insights and recommendations - Admin only
 */
router.get(
  '/analytics/insights',
  authenticate,
  [
    query('timeRange').optional().isIn(['30d', '90d']).withMessage('Invalid time range')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - only allow admin/manager roles
      const { timeRange = '30d' } = req.query;
      
      const insights = await paymentAnalyticsService.getPaymentInsights(timeRange as any);
      
      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      logger.error('Error fetching payment insights:', error);
      next(error);
    }
  }
);

/**
 * GET /payment/analytics/cost-analysis/:provider - Get provider cost analysis - Admin only
 */
router.get(
  '/analytics/cost-analysis/:provider',
  authenticate,
  [
    param('provider').isIn(['yoco', 'paystack']).withMessage('Invalid provider'),
    query('timeRange').optional().isIn(['30d', '90d', '1y']).withMessage('Invalid time range')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - only allow admin roles
      const { provider } = req.params;
      const { timeRange = '30d' } = req.query;
      
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
      logger.error('Error fetching cost analysis:', error);
      next(error);
    }
  }
);

/**
 * POST /payment/analytics/export - Export payment data - Admin only
 */
router.post(
  '/analytics/export',
  authenticate,
  [
    body('format').isIn(['csv', 'json']).withMessage('Format must be csv or json'),
    body('filters').optional().isObject().withMessage('Filters must be an object')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - only allow admin roles
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
      logger.error('Error exporting payment data:', error);
      next(error);
    }
  }
);

export default router;
