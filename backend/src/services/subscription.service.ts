/**
 * Enhanced Subscription Management Service
 * Comprehensive subscription lifecycle management with feature gating,
 * usage tracking, and subscription analytics
 */

import { SubscriptionPlan, User } from '@prisma/client';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import logger from '../config/logger';
import { PLAN_QUOTAS, getFeatureAccess, getMonthlyQuota } from '../utils/subscriptionQuotas';

export interface SubscriptionUsage {
  feature: string;
  usage: number;
  limit: number;
  resetDate: Date;
  overage?: number;
}

export interface SubscriptionMetrics {
  totalRevenue: number;
  activeSubscriptions: number;
  churnRate: number;
  averageSubscriptionValue: number;
  planDistribution: Record<SubscriptionPlan, number>;
}

export interface FeatureGate {
  feature: string;
  requiredPlan: SubscriptionPlan;
  fallbackBehavior: 'block' | 'limit' | 'degrade';
  gracePeriod?: number; // Days after subscription expires
}

export class SubscriptionService {
  private static readonly USAGE_CACHE_TTL = 3600; // 1 hour
  private static readonly FEATURE_USAGE_KEY = 'feature_usage:';
  
  /**
   * Create new subscription with comprehensive setup
   */
  static async createSubscription(
    userId: string,
    plan: SubscriptionPlan,
    paymentMethodId?: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<User> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Calculate subscription details
      const planQuota = PLAN_QUOTAS[plan];
      const subscriptionDuration = billingCycle === 'yearly' ? 12 : 1;
      const totalPrice = planQuota.price * subscriptionDuration * (billingCycle === 'yearly' ? 0.8 : 1); // 20% yearly discount
      
      const subscriptionData = {
        plan,
        status: 'ACTIVE' as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + subscriptionDuration * 30 * 24 * 60 * 60 * 1000),
        billingCycle,
        amount: totalPrice,
        currency: 'ZAR',
        paymentMethodId,
        trialEndsAt: plan === 'FREE' ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day trial
      };
      
      // Update user with new subscription
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: plan,
          creditsRemaining: planQuota.monthlyApplications,
          monthlyQuota: planQuota.monthlyApplications,
          quotaResetDate: this.getNextQuotaResetDate(),
          subscriptionExpiry: subscriptionData.currentPeriodEnd,
          subscription: {
            upsert: {
              create: subscriptionData,
              update: subscriptionData,
            },
          },
        },
        include: { subscription: true },
      });
      
      // Initialize feature usage tracking
      await this.initializeFeatureUsage(userId, plan);
      
      // Log subscription creation
      logger.info('Subscription created', {
        userId,
        plan,
        billingCycle,
        amount: totalPrice,
        trialEndsAt: subscriptionData.trialEndsAt,
      });
      
      return updatedUser;
    } catch (error) {
      logger.error('Error creating subscription', { userId, plan, error });
      throw error;
    }
  }
  
  /**
   * Upgrade/downgrade subscription with prorated billing
   */
  static async changeSubscription(
    userId: string,
    newPlan: SubscriptionPlan,
    billingCycle?: 'monthly' | 'yearly'
  ): Promise<User> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });
      
      if (!user || !user.subscription) {
        throw new Error('User or subscription not found');
      }
      
      const currentPlan = user.subscriptionPlan;
      const isUpgrade = this.isUpgrade(currentPlan, newPlan);
      
      // Calculate prorated amount
      const proratedAmount = await this.calculateProratedAmount(
        user.subscription,
        newPlan,
        billingCycle || user.subscription.billingCycle
      );
      
      // Update subscription
      const newQuota = getMonthlyQuota(newPlan);
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: newPlan,
          creditsRemaining: isUpgrade ? Math.max(user.creditsRemaining, newQuota) : newQuota,
          monthlyQuota: newQuota,
          subscription: {
            update: {
              plan: newPlan,
              billingCycle: billingCycle || user.subscription.billingCycle,
              amount: proratedAmount,
            },
          },
        },
        include: { subscription: true },
      });
      
      // Update feature usage tracking
      await this.updateFeatureUsage(userId, newPlan);
      
      // Log subscription change
      logger.info('Subscription changed', {
        userId,
        oldPlan: currentPlan,
        newPlan,
        isUpgrade,
        proratedAmount,
      });
      
      return updatedUser;
    } catch (error) {
      logger.error('Error changing subscription', { userId, newPlan, error });
      throw error;
    }
  }
  
  /**
   * Cancel subscription with retention options
   */
  static async cancelSubscription(
    userId: string,
    reason?: string,
    immediateCancel: boolean = false
  ): Promise<User> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });
      
      if (!user || !user.subscription) {
        throw new Error('User or subscription not found');
      }
      
      const cancelDate = immediateCancel ? new Date() : user.subscription.currentPeriodEnd;
      
      // Update subscription status
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          subscription: {
            update: {
              status: immediateCancel ? 'CANCELLED' : 'CANCELLING',
              cancelledAt: new Date(),
              cancellationReason: reason,
              currentPeriodEnd: cancelDate,
            },
          },
        },
        include: { subscription: true },
      });
      
      // If immediate cancel, downgrade to FREE
      if (immediateCancel) {
        await this.downgradeToFree(userId);
      }
      
      // Log cancellation
      logger.info('Subscription cancelled', {
        userId,
        plan: user.subscriptionPlan,
        reason,
        immediateCancel,
        endDate: cancelDate,
      });
      
      return updatedUser;
    } catch (error) {
      logger.error('Error cancelling subscription', { userId, error });
      throw error;
    }
  }
  
  /**
   * Track feature usage for quota management
   */
  static async trackFeatureUsage(
    userId: string,
    feature: string,
    amount: number = 1
  ): Promise<boolean> {
    try {
      const cacheKey = `${this.FEATURE_USAGE_KEY}${userId}:${feature}`;
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      const monthlyKey = `${cacheKey}:${currentMonth}`;
      
      // Get current usage
      const currentUsage = await redis.get(monthlyKey) || 0;
      const newUsage = parseInt(currentUsage.toString()) + amount;
      
      // Get user's plan and limits
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const featureAccess = getFeatureAccess(user.subscriptionPlan);
      const limit = this.getFeatureLimit(feature, user.subscriptionPlan);
      
      // Check if usage exceeds limit
      if (limit > 0 && newUsage > limit) {
        logger.warn('Feature usage limit exceeded', {
          userId,
          feature,
          usage: newUsage,
          limit,
          plan: user.subscriptionPlan,
        });
        return false;
      }
      
      // Update usage in Redis with expiration
      await redis.setex(monthlyKey, this.USAGE_CACHE_TTL, newUsage);
      
      // Store in database for analytics
      await prisma.featureUsage.upsert({
        where: {
          userId_feature_month: {
            userId,
            feature,
            month: currentMonth,
          },
        },
        create: {
          userId,
          feature,
          month: currentMonth,
          usage: newUsage,
        },
        update: {
          usage: newUsage,
          updatedAt: new Date(),
        },
      });
      
      return true;
    } catch (error) {
      logger.error('Error tracking feature usage', { userId, feature, amount, error });
      return false;
    }
  }
  
  /**
   * Get comprehensive subscription analytics
   */
  static async getSubscriptionAnalytics(timeRange: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<SubscriptionMetrics> {
    try {
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
      
      // Get subscription metrics
      const [revenue, activeSubscriptions, planDistribution, churnData] = await Promise.all([
        this.calculateRevenue(startDate, endDate),
        this.getActiveSubscriptionsCount(),
        this.getPlanDistribution(),
        this.calculateChurnRate(startDate, endDate),
      ]);
      
      return {
        totalRevenue: revenue,
        activeSubscriptions,
        churnRate: churnData.churnRate,
        averageSubscriptionValue: revenue / activeSubscriptions || 0,
        planDistribution,
      };
    } catch (error) {
      logger.error('Error getting subscription analytics', error);
      throw error;
    }
  }
  
  /**
   * Feature gate middleware creator
   */
  static createFeatureGate(feature: string, requiredPlan: SubscriptionPlan, options?: {
    gracePeriod?: number;
    fallbackBehavior?: 'block' | 'limit' | 'degrade';
    customMessage?: string;
  }) {
    return async (req: any, res: any, next: any) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            timestamp: new Date().toISOString(),
          });
        }
        
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { subscription: true },
        });
        
        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
            timestamp: new Date().toISOString(),
          });
        }
        
        const hasAccess = await this.checkFeatureAccess(userId, feature, requiredPlan, options?.gracePeriod);
        
        if (!hasAccess) {
          const featureAccess = getFeatureAccess(user.subscriptionPlan);
          
          return res.status(403).json({
            success: false,
            error: options?.customMessage || `Feature '${feature}' requires ${requiredPlan} plan or higher`,
            featureGate: {
              feature,
              requiredPlan,
              currentPlan: user.subscriptionPlan,
              upgradeRequired: true,
            },
            timestamp: new Date().toISOString(),
          });
        }
        
        // Track feature usage
        await this.trackFeatureUsage(userId, feature);
        
        next();
      } catch (error) {
        logger.error('Feature gate error', { feature, requiredPlan, error });
        return res.status(500).json({
          success: false,
          error: 'Feature access check failed',
          timestamp: new Date().toISOString(),
        });
      }
    };
  }
  
  /**
   * Check if user has access to a feature with grace period
   */
  static async checkFeatureAccess(
    userId: string,
    feature: string,
    requiredPlan: SubscriptionPlan,
    gracePeriod: number = 0
  ): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });
      
      if (!user) {
        return false;
      }
      
      // Check if user's plan meets requirements
      const planHierarchy: SubscriptionPlan[] = ['FREE', 'PROFESSIONAL', 'EXECUTIVE'];
      const userPlanIndex = planHierarchy.indexOf(user.subscriptionPlan);
      const requiredPlanIndex = planHierarchy.indexOf(requiredPlan);
      
      if (userPlanIndex >= requiredPlanIndex) {
        // Check if subscription is still active or within grace period
        if (user.subscription && user.subscription.status === 'ACTIVE') {
          return true;
        }
        
        if (gracePeriod > 0 && user.subscriptionExpiry) {
          const gracePeriodEnd = new Date(user.subscriptionExpiry);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriod);
          return new Date() <= gracePeriodEnd;
        }
      }
      
      return false;
    } catch (error) {
      logger.error('Error checking feature access', { userId, feature, requiredPlan, error });
      return false;
    }
  }
  
  /**
   * Get feature usage statistics for a user
   */
  static async getFeatureUsageStats(userId: string): Promise<SubscriptionUsage[]> {
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      
      const usageRecords = await prisma.featureUsage.findMany({
        where: {
          userId,
          month: currentMonth,
        },
      });
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true, quotaResetDate: true },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return usageRecords.map(record => ({
        feature: record.feature,
        usage: record.usage,
        limit: this.getFeatureLimit(record.feature, user.subscriptionPlan),
        resetDate: user.quotaResetDate,
        overage: Math.max(0, record.usage - this.getFeatureLimit(record.feature, user.subscriptionPlan)),
      }));
    } catch (error) {
      logger.error('Error getting feature usage stats', { userId, error });
      throw error;
    }
  }
  
  /**
   * Handle subscription renewal
   */
  static async renewSubscription(subscriptionId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { user: true },
      });
      
      if (!subscription) {
        throw new Error('Subscription not found');
      }
      
      const renewalDuration = subscription.billingCycle === 'yearly' ? 12 : 1;
      const newPeriodEnd = new Date(subscription.currentPeriodEnd);
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + renewalDuration);
      
      // Update subscription and reset user quota
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            currentPeriodStart: subscription.currentPeriodEnd,
            currentPeriodEnd: newPeriodEnd,
            status: 'ACTIVE',
          },
        }),
        prisma.user.update({
          where: { id: subscription.userId },
          data: {
            creditsRemaining: getMonthlyQuota(subscription.plan),
            quotaResetDate: this.getNextQuotaResetDate(),
            subscriptionExpiry: newPeriodEnd,
          },
        }),
      ]);
      
      // Reset feature usage
      await this.resetFeatureUsage(subscription.userId);
      
      logger.info('Subscription renewed', {
        subscriptionId,
        userId: subscription.userId,
        plan: subscription.plan,
        newPeriodEnd,
      });
    } catch (error) {
      logger.error('Error renewing subscription', { subscriptionId, error });
      throw error;
    }
  }
  
  /**
   * Handle failed payment and subscription management
   */
  static async handlePaymentFailure(subscriptionId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { user: true },
      });
      
      if (!subscription) {
        throw new Error('Subscription not found');
      }
      
      // Update subscription status
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'PAST_DUE',
          paymentFailedAt: new Date(),
        },
      });
      
      // Start grace period (7 days)
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
      
      // Schedule downgrade after grace period
      await this.scheduleDowngrade(subscription.userId, gracePeriodEnd);
      
      logger.warn('Payment failed, grace period started', {
        subscriptionId,
        userId: subscription.userId,
        gracePeriodEnd,
      });
    } catch (error) {
      logger.error('Error handling payment failure', { subscriptionId, error });
      throw error;
    }
  }
  
  /**
   * Get subscription lifecycle events
   */
  static async getSubscriptionEvents(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const events = await prisma.subscriptionEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      
      return events.map(event => ({
        id: event.id,
        type: event.eventType,
        description: event.description,
        metadata: event.metadata,
        timestamp: event.createdAt,
      }));
    } catch (error) {
      logger.error('Error getting subscription events', { userId, error });
      throw error;
    }
  }
  
  // ==============================================
  // PRIVATE HELPER METHODS
  // ==============================================
  
  private static async initializeFeatureUsage(userId: string, plan: SubscriptionPlan): Promise<void> {
    const features = PLAN_QUOTAS[plan].features;
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    for (const feature of features) {
      const cacheKey = `${this.FEATURE_USAGE_KEY}${userId}:${feature}:${currentMonth}`;
      await redis.setex(cacheKey, this.USAGE_CACHE_TTL, 0);
    }
  }
  
  private static async updateFeatureUsage(userId: string, newPlan: SubscriptionPlan): Promise<void> {
    const features = PLAN_QUOTAS[newPlan].features;
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    // Add new features
    for (const feature of features) {
      const cacheKey = `${this.FEATURE_USAGE_KEY}${userId}:${feature}:${currentMonth}`;
      const exists = await redis.exists(cacheKey);
      if (!exists) {
        await redis.setex(cacheKey, this.USAGE_CACHE_TTL, 0);
      }
    }
  }
  
  private static async resetFeatureUsage(userId: string): Promise<void> {
    const pattern = `${this.FEATURE_USAGE_KEY}${userId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
  
  private static getFeatureLimit(feature: string, plan: SubscriptionPlan): number {
    const limits: Record<string, Record<SubscriptionPlan, number>> = {
      'job_applications': { FREE: 2, PROFESSIONAL: 5, EXECUTIVE: 8 },
      'cv_uploads': { FREE: 1, PROFESSIONAL: 5, EXECUTIVE: 10 },
      'ai_matching': { FREE: 0, PROFESSIONAL: 50, EXECUTIVE: 200 },
      'cover_letter_generation': { FREE: 0, PROFESSIONAL: 10, EXECUTIVE: 50 },
      'skills_assessment': { FREE: 1, PROFESSIONAL: 3, EXECUTIVE: 10 },
    };
    
    return limits[feature]?.[plan] || 0;
  }
  
  private static isUpgrade(currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): boolean {
    const planHierarchy: SubscriptionPlan[] = ['FREE', 'PROFESSIONAL', 'EXECUTIVE'];
    return planHierarchy.indexOf(newPlan) > planHierarchy.indexOf(currentPlan);
  }
  
  private static async calculateProratedAmount(
    subscription: any,
    newPlan: SubscriptionPlan,
    billingCycle: 'monthly' | 'yearly'
  ): Promise<number> {
    const newPlanPrice = PLAN_QUOTAS[newPlan].price;
    const currentPlanPrice = PLAN_QUOTAS[subscription.plan].price;
    
    // Calculate remaining days in current period
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const totalDays = (periodEnd.getTime() - new Date(subscription.currentPeriodStart).getTime()) / (1000 * 60 * 60 * 24);
    const remainingDays = Math.max(0, (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate prorated amounts
    const unusedCredit = (currentPlanPrice * remainingDays) / totalDays;
    const newPlanCost = (newPlanPrice * remainingDays) / totalDays;
    
    const proratedAmount = Math.max(0, newPlanCost - unusedCredit);
    
    // Apply yearly discount if applicable
    return billingCycle === 'yearly' ? proratedAmount * 0.8 : proratedAmount;
  }
  
  private static async downgradeToFree(userId: string): Promise<void> {
    const freeQuota = getMonthlyQuota('FREE');
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: 'FREE',
        creditsRemaining: freeQuota,
        monthlyQuota: freeQuota,
        subscriptionExpiry: null,
      },
    });
    
    await this.resetFeatureUsage(userId);
  }
  
  private static async scheduleDowngrade(userId: string, downgradeDate: Date): Promise<void> {
    // This would typically use a job queue like BullMQ
    // For now, we'll store the schedule in Redis
    await redis.setex(
      `scheduled_downgrade:${userId}`,
      Math.ceil((downgradeDate.getTime() - Date.now()) / 1000),
      JSON.stringify({ userId, downgradeDate: downgradeDate.toISOString() })
    );
  }
  
  private static getNextQuotaResetDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  
  private static async calculateRevenue(startDate: Date, endDate: Date): Promise<number> {
    const result = await prisma.subscription.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['ACTIVE', 'CANCELLING'],
        },
      },
      _sum: {
        amount: true,
      },
    });
    
    return result._sum.amount || 0;
  }
  
  private static async getActiveSubscriptionsCount(): Promise<number> {
    return prisma.subscription.count({
      where: {
        status: 'ACTIVE',
      },
    });
  }
  
  private static async getPlanDistribution(): Promise<Record<SubscriptionPlan, number>> {
    const distribution = await prisma.user.groupBy({
      by: ['subscriptionPlan'],
      _count: {
        subscriptionPlan: true,
      },
    });
    
    const result: Record<SubscriptionPlan, number> = {
      FREE: 0,
      PROFESSIONAL: 0,
      EXECUTIVE: 0,
    };
    
    distribution.forEach(item => {
      result[item.subscriptionPlan] = item._count.subscriptionPlan;
    });
    
    return result;
  }
  
  private static async calculateChurnRate(startDate: Date, endDate: Date): Promise<{ churnRate: number }> {
    const [cancelled, total] = await Promise.all([
      prisma.subscription.count({
        where: {
          cancelledAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      prisma.subscription.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);
    
    const churnRate = total > 0 ? (cancelled / total) * 100 : 0;
    return { churnRate };
  }
}

export default SubscriptionService;
