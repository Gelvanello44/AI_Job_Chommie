/**
 * Quota Management Controller
 * Handles subscription quota tracking and usage analytics
 */

import { Request, Response } from 'express';
import { QuotaService } from '../services/quota.service.js';
import { getFeatureAccess, PLAN_QUOTAS } from '../utils/subscriptionQuotas.js';
import logger from '../config/logger.js';

export class QuotaController {
  /**
   * Get user's current quota status
   * GET /api/v1/quota/status
   */
  static async getQuotaStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const quotaStatus = await QuotaService.getQuotaStatus(userId);

      res.json({
        success: true,
        data: quotaStatus
      });
    } catch (error) {
      logger.error('Error fetching quota status', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quota status'
      });
    }
  }

  /**
   * Get usage analytics for user
   * GET /api/v1/quota/analytics
   */
  static async getUserAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const analytics = await QuotaService.getUserUsageAnalytics(userId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error fetching user analytics', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch usage analytics'
      });
    }
  }

  /**
   * Get plan information and pricing
   * GET /api/v1/quota/plans
   */
  static async getPlansInfo(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      let currentPlan = null;
      let featureAccess = null;

      if (userId) {
        const quotaStatus = await QuotaService.getQuotaStatus(userId);
        currentPlan = quotaStatus.plan;
        featureAccess = quotaStatus.featureAccess;
      }

      // Return all plan information aligned with PricingPage.jsx
      const plansInfo = Object.entries(PLAN_QUOTAS).map(([plan, quota]) => ({
        plan,
        monthlyApplications: quota.monthlyApplications,
        price: quota.price,
        features: quota.features,
        isCurrent: plan === currentPlan,
        featureAccess: plan === currentPlan ? featureAccess : getFeatureAccess(plan as any)
      }));

      res.json({
        success: true,
        data: {
          plans: plansInfo,
          currentPlan,
          currency: 'ZAR'
        }
      });
    } catch (error) {
      logger.error('Error fetching plans info', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch plans information'
      });
    }
  }

  /**
   * Check if user can apply for a job (quota check)
   * GET /api/v1/quota/can-apply
   */
  static async canApplyCheck(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const quotaStatus = await QuotaService.getQuotaStatus(userId);

      res.json({
        success: true,
        data: {
          canApply: quotaStatus.canApply,
          creditsRemaining: quotaStatus.creditsRemaining,
          plan: quotaStatus.plan,
          quotaResetDate: quotaStatus.quotaResetDate,
          upgradeRequired: !quotaStatus.canApply
        }
      });
    } catch (error) {
      logger.error('Error checking application eligibility', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to check application eligibility'
      });
    }
  }

  /**
   * Get quota meter widget data for dashboard
   * GET /api/v1/quota/meter
   */
  static async getQuotaMeter(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const quotaStatus = await QuotaService.getQuotaStatus(userId);
      
      // Format for frontend quota meter widget
      const meterData = {
        current: quotaStatus.usageThisMonth,
        total: quotaStatus.monthlyQuota,
        remaining: quotaStatus.creditsRemaining,
        percentage: quotaStatus.usagePercentage,
        plan: quotaStatus.plan,
        resetDate: quotaStatus.quotaResetDate,
        status: quotaStatus.creditsRemaining > 0 ? 'active' : 'exhausted',
        color: quotaStatus.usagePercentage < 80 ? 'green' : 
               quotaStatus.usagePercentage < 100 ? 'yellow' : 'red'
      };

      res.json({
        success: true,
        data: meterData
      });
    } catch (error) {
      logger.error('Error fetching quota meter', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quota meter data'
      });
    }
  }

  /**
   * Get upcoming applications widget data
   * GET /api/v1/quota/upcoming-applications
   */
  static async getUpcomingApplications(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Get recent applications and quota status
      const [quotaStatus, recentApplications] = await Promise.all([
        QuotaService.getQuotaStatus(userId),
        // Get applications from last 7 days
        QuotaService.getUserUsageAnalytics(userId)
      ]);

      // Calculate when user might apply next based on patterns
      const nextApplicationDate = new Date();
      nextApplicationDate.setDate(nextApplicationDate.getDate() + 3); // Estimate 3 days

      const upcomingData = {
        creditsRemaining: quotaStatus.creditsRemaining,
        canApplyNow: quotaStatus.canApply,
        nextResetDate: quotaStatus.quotaResetDate,
        estimatedNextApplication: quotaStatus.canApply ? nextApplicationDate : null,
        recentActivity: {
          applicationsThisMonth: quotaStatus.usageThisMonth,
          totalApplications: recentApplications.totalApplications
        },
        recommendations: this.getApplicationRecommendations(quotaStatus)
      };

      res.json({
        success: true,
        data: upcomingData
      });
    } catch (error) {
      logger.error('Error fetching upcoming applications', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch upcoming applications data'
      });
    }
  }

  /**
   * Generate application recommendations based on quota status
   */
  private static getApplicationRecommendations(quotaStatus: any): string[] {
    const recommendations = [];

    if (quotaStatus.creditsRemaining === 0) {
      recommendations.push('Your monthly quota is exhausted. Consider upgrading for more applications.');
      recommendations.push(`Your quota resets on ${new Date(quotaStatus.quotaResetDate).toLocaleDateString()}`);
    } else if (quotaStatus.usagePercentage > 80) {
      recommendations.push('You\'re running low on applications. Use them wisely on high-match jobs.');
      recommendations.push('Consider saving interesting jobs to apply when your quota resets.');
    } else {
      recommendations.push('You have applications available. Check out recommended jobs!');
      recommendations.push('Use the job matching system to find the best opportunities.');
    }

    return recommendations;
  }

  /**
   * Force quota reset (admin only)
   * POST /api/v1/quota/reset/:userId
   */
  static async forceQuotaReset(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      // Check if requester is admin
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const user = await QuotaService.checkAndResetQuota(userId);

      res.json({
        success: true,
        data: {
          userId: user.id,
          plan: user.subscriptionPlan,
          creditsRemaining: user.creditsRemaining,
          quotaResetDate: user.quotaResetDate
        },
        message: 'Quota reset successfully'
      });
    } catch (error) {
      logger.error('Error forcing quota reset', { error, userId: req.params.userId });
      res.status(500).json({
        success: false,
        message: 'Failed to reset quota'
      });
    }
  }
}

export default QuotaController;
