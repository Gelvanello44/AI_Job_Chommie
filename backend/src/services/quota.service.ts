/**
 * User Quota Management Service
 * Handles monthly application quotas and subscription management
 */

import { User, SubscriptionPlan } from '@prisma/client';
import { prisma } from '../config/database.js';
import { 
  getMonthlyQuota, 
  shouldResetQuota, 
  getNextQuotaResetDate,
  canApplyForJob,
  getFeatureAccess
} from '../utils/subscriptionQuotas.js';
import logger from '../config/logger.js';

export class QuotaService {
  /**
   * Check and reset user quota if needed (monthly reset)
   */
  static async checkAndResetQuota(userId: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if quota needs reset
    if (shouldResetQuota(user.quotaResetDate)) {
      const newQuota = getMonthlyQuota(user.subscriptionPlan);
      const nextResetDate = getNextQuotaResetDate();

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          creditsRemaining: newQuota,
          monthlyQuota: newQuota,
          quotaResetDate: nextResetDate
        }
      });

      logger.info('User quota reset', {
        userId,
        plan: user.subscriptionPlan,
        newQuota,
        nextResetDate
      });

      return updatedUser;
    }

    return user;
  }

  /**
   * Consume application credit (when user applies for job)
   */
  static async consumeApplicationCredit(userId: string): Promise<boolean> {
    const user = await this.checkAndResetQuota(userId);

    if (!canApplyForJob(user.creditsRemaining)) {
      return false;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        creditsRemaining: {
          decrement: 1
        }
      }
    });

    logger.info('Application credit consumed', {
      userId,
      creditsRemaining: user.creditsRemaining - 1
    });

    return true;
  }

  /**
   * Get user's current quota status
   */
  static async getQuotaStatus(userId: string) {
    const user = await this.checkAndResetQuota(userId);
    const featureAccess = getFeatureAccess(user.subscriptionPlan);

    return {
      plan: user.subscriptionPlan,
      creditsRemaining: user.creditsRemaining,
      monthlyQuota: user.monthlyQuota,
      quotaResetDate: user.quotaResetDate,
      canApply: canApplyForJob(user.creditsRemaining),
      featureAccess,
      usageThisMonth: user.monthlyQuota - user.creditsRemaining,
      usagePercentage: Math.round(((user.monthlyQuota - user.creditsRemaining) / user.monthlyQuota) * 100)
    };
  }

  /**
   * Upgrade user subscription plan
   */
  static async upgradePlan(userId: string, newPlan: SubscriptionPlan, subscriptionMonths: number = 1): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate new quota and expiry
    const newQuota = getMonthlyQuota(newPlan);
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + subscriptionMonths);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: newPlan,
        subscriptionExpiry: expiryDate,
        creditsRemaining: newQuota, // Grant immediate credits on upgrade
        monthlyQuota: newQuota,
        quotaResetDate: getNextQuotaResetDate()
      }
    });

    logger.info('User plan upgraded', {
      userId,
      oldPlan: user.subscriptionPlan,
      newPlan,
      newQuota,
      expiryDate
    });

    return updatedUser;
  }

  /**
   * Check if subscription has expired and downgrade if needed
   */
  static async checkSubscriptionExpiry(userId: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if subscription has expired
    if (user.subscriptionExpiry && user.subscriptionExpiry < new Date() && user.subscriptionPlan !== 'FREE') {
      const downgradedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: 'FREE',
          creditsRemaining: getMonthlyQuota('FREE'),
          monthlyQuota: getMonthlyQuota('FREE'),
          subscriptionExpiry: null,
          quotaResetDate: getNextQuotaResetDate()
        }
      });

      logger.info('User subscription expired, downgraded to FREE', {
        userId,
        expiredPlan: user.subscriptionPlan,
        expiredAt: user.subscriptionExpiry
      });

      return downgradedUser;
    }

    return user;
  }

  /**
   * Check if user has access to a specific feature
   */
  static async hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const user = await this.checkSubscriptionExpiry(userId);
    const featureAccess = getFeatureAccess(user.subscriptionPlan);
    
    return featureAccess[feature as keyof typeof featureAccess] === true;
  }

  /**
   * Get usage analytics for user
   */
  static async getUserUsageAnalytics(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get applications count for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const applicationsThisMonth = await prisma.application.count({
      where: {
        userId,
        createdAt: {
          gte: startOfMonth
        }
      }
    });

    // Get total applications count
    const totalApplications = await prisma.application.count({
      where: { userId }
    });

    return {
      currentPlan: user.subscriptionPlan,
      creditsRemaining: user.creditsRemaining,
      monthlyQuota: user.monthlyQuota,
      applicationsThisMonth,
      totalApplications,
      subscriptionExpiry: user.subscriptionExpiry,
      quotaResetDate: user.quotaResetDate,
      usagePercentage: Math.round((applicationsThisMonth / user.monthlyQuota) * 100)
    };
  }

  /**
   * Batch update quotas for all users (monthly cron job)
   */
  static async batchResetQuotas(): Promise<number> {
    const usersNeedingReset = await prisma.user.findMany({
      where: {
        quotaResetDate: {
          lt: new Date()
        }
      }
    });

    let resetCount = 0;
    for (const user of usersNeedingReset) {
      try {
        await this.checkAndResetQuota(user.id);
        resetCount++;
      } catch (error) {
        logger.error('Error resetting quota for user', {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('Batch quota reset completed', {
      totalUsers: usersNeedingReset.length,
      successfulResets: resetCount
    });

    return resetCount;
  }
}
