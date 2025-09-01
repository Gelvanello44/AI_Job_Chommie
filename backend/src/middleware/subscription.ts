/**
 * Subscription Middleware
 * Feature gating and quota enforcement middleware
 */

import { Request, Response, NextFunction } from 'express';
import { SubscriptionPlan } from '@prisma/client';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import logger from '../config/logger';
import { getFeatureAccess, PLAN_QUOTAS } from '../utils/subscriptionQuotas';

export interface FeatureGateOptions {
  gracePeriod?: number;
  fallbackBehavior?: 'block' | 'limit' | 'degrade';
  customMessage?: string;
  usageLimit?: number;
}

/**
 * Feature gate middleware creator
 */
export function requireSubscription(
  requiredPlan: SubscriptionPlan,
  options: FeatureGateOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      
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
      
      const hasAccess = await checkPlanAccess(user.subscriptionPlan, requiredPlan, user.subscriptionExpiry, options.gracePeriod);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: options.customMessage || `This feature requires ${requiredPlan} plan or higher`,
          featureGate: {
            requiredPlan,
            currentPlan: user.subscriptionPlan,
            upgradeRequired: true,
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      next();
    } catch (error) {
      logger.error('Subscription check error', { requiredPlan, error });
      return res.status(500).json({
        success: false,
        error: 'Subscription verification failed',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Feature usage tracking and quota enforcement
 */
export function trackFeatureUsage(feature: string, usageAmount: number = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return next();
      }
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true },
      });
      
      if (!user) {
        return next();
      }
      
      const currentMonth = new Date().toISOString().substring(0, 7);
      const usageKey = `feature_usage:${userId}:${feature}:${currentMonth}`;
      
      // Get current usage
      const currentUsage = parseInt(await redis.get(usageKey) || '0');
      const limit = getFeatureLimit(feature, user.subscriptionPlan);
      
      // Check if usage would exceed limit
      if (limit > 0 && currentUsage + usageAmount > limit) {
        return res.status(429).json({
          success: false,
          error: `Feature usage limit exceeded for ${feature}`,
          quota: {
            feature,
            usage: currentUsage,
            limit,
            remaining: Math.max(0, limit - currentUsage),
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      // Track usage
      await redis.setex(usageKey, 86400 * 31, currentUsage + usageAmount); // 31 days TTL
      
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
          usage: currentUsage + usageAmount,
        },
        update: {
          usage: currentUsage + usageAmount,
          updatedAt: new Date(),
        },
      });
      
      // Add usage info to response headers
      res.set({
        'X-Feature-Usage': currentUsage + usageAmount,
        'X-Feature-Limit': limit.toString(),
        'X-Feature-Remaining': Math.max(0, limit - currentUsage - usageAmount).toString(),
      });
      
      next();
    } catch (error) {
      logger.error('Error tracking feature usage', { feature, usageAmount, error });
      // Continue request even if tracking fails
      next();
    }
  };
}

/**
 * Quota enforcement for job applications
 */
export const enforceApplicationQuota = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditsRemaining: true, subscriptionPlan: true },
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (user.creditsRemaining <= 0) {
      const planInfo = PLAN_QUOTAS[user.subscriptionPlan];
      return res.status(429).json({
        success: false,
        error: 'Monthly application quota exhausted',
        quota: {
          remaining: user.creditsRemaining,
          plan: user.subscriptionPlan,
          upgradeOptions: getUpgradeOptions(user.subscriptionPlan),
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error enforcing application quota', error);
    return res.status(500).json({
      success: false,
      error: 'Quota check failed',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Subscription expiry checker
 */
export const checkSubscriptionExpiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return next();
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        subscriptionExpiry: true, 
        subscriptionPlan: true,
        id: true,
      },
    });
    
    if (!user) {
      return next();
    }
    
    // Check if subscription has expired
    if (user.subscriptionExpiry && user.subscriptionExpiry < new Date() && user.subscriptionPlan !== 'FREE') {
      // Auto-downgrade to FREE plan
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: 'FREE',
          creditsRemaining: PLAN_QUOTAS.FREE.monthlyApplications,
          monthlyQuota: PLAN_QUOTAS.FREE.monthlyApplications,
          subscriptionExpiry: null,
        },
      });
      
      logger.info('User subscription expired, downgraded to FREE', {
        userId,
        expiredPlan: user.subscriptionPlan,
        expiredAt: user.subscriptionExpiry,
      });
      
      // Add expiry notification to response headers
      res.set({
        'X-Subscription-Expired': 'true',
        'X-Subscription-Downgraded': 'FREE',
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking subscription expiry', error);
    // Continue request even if check fails
    next();
  }
};

/**
 * Usage analytics middleware
 */
export const trackUserActivity = (activityType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return next();
      }
      
      // Track activity in Redis for real-time analytics
      const activityKey = `user_activity:${userId}:${activityType}`;
      const dailyKey = `${activityKey}:${new Date().toISOString().substring(0, 10)}`;
      
      await redis.zincrby('user_activity_leaderboard', 1, userId);
      await redis.incr(dailyKey);
      await redis.expire(dailyKey, 86400 * 30); // 30 days TTL
      
      next();
    } catch (error) {
      logger.error('Error tracking user activity', { activityType, error });
      // Continue request even if tracking fails
      next();
    }
  };
};

/**
 * Plan recommendation middleware
 */
export const addPlanRecommendations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return next();
    }
    
    // Get user's usage patterns
    const usageStats = await getUserUsagePatterns(userId);
    const recommendedPlan = getRecommendedPlan(usageStats);
    
    // Add recommendation to response headers
    res.set({
      'X-Recommended-Plan': recommendedPlan,
      'X-Usage-Score': usageStats.score.toString(),
    });
    
    next();
  } catch (error) {
    logger.error('Error adding plan recommendations', error);
    next();
  }
};

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Check if user's plan meets requirements
 */
async function checkPlanAccess(
  userPlan: SubscriptionPlan,
  requiredPlan: SubscriptionPlan,
  subscriptionExpiry: Date | null,
  gracePeriod: number = 0
): Promise<boolean> {
  const planHierarchy: SubscriptionPlan[] = ['FREE', 'PROFESSIONAL', 'EXECUTIVE'];
  const userPlanIndex = planHierarchy.indexOf(userPlan);
  const requiredPlanIndex = planHierarchy.indexOf(requiredPlan);
  
  if (userPlanIndex >= requiredPlanIndex) {
    // Check subscription expiry with grace period
    if (subscriptionExpiry && subscriptionExpiry < new Date()) {
      if (gracePeriod > 0) {
        const gracePeriodEnd = new Date(subscriptionExpiry);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriod);
        return new Date() <= gracePeriodEnd;
      }
      return false;
    }
    return true;
  }
  
  return false;
}

/**
 * Get feature limits for a plan
 */
function getFeatureLimit(feature: string, plan: SubscriptionPlan): number {
  const limits: Record<string, Record<SubscriptionPlan, number>> = {
    'job_applications': { FREE: 2, PROFESSIONAL: 5, EXECUTIVE: 8 },
    'cv_uploads': { FREE: 1, PROFESSIONAL: 5, EXECUTIVE: 10 },
    'ai_matching': { FREE: 0, PROFESSIONAL: 50, EXECUTIVE: 200 },
    'cover_letter_generation': { FREE: 0, PROFESSIONAL: 10, EXECUTIVE: 50 },
    'skills_assessment': { FREE: 1, PROFESSIONAL: 3, EXECUTIVE: 10 },
    'job_alerts': { FREE: 3, PROFESSIONAL: 10, EXECUTIVE: 25 },
    'company_research': { FREE: 0, PROFESSIONAL: 20, EXECUTIVE: 100 },
    'interview_prep': { FREE: 0, PROFESSIONAL: 5, EXECUTIVE: 20 },
  };
  
  return limits[feature]?.[plan] || 0;
}

/**
 * Get upgrade options for current plan
 */
function getUpgradeOptions(currentPlan: SubscriptionPlan): Array<{
  plan: SubscriptionPlan;
  price: number;
  features: string[];
}> {
  const planHierarchy: SubscriptionPlan[] = ['FREE', 'PROFESSIONAL', 'EXECUTIVE'];
  const currentIndex = planHierarchy.indexOf(currentPlan);
  
  return planHierarchy
    .slice(currentIndex + 1)
    .map(plan => ({
      plan,
      price: PLAN_QUOTAS[plan].price,
      features: PLAN_QUOTAS[plan].features,
    }));
}

/**
 * Get user usage patterns for recommendations
 */
async function getUserUsagePatterns(userId: string): Promise<{
  score: number;
  monthlyApplications: number;
  aiUsage: number;
  premiumFeatureUsage: number;
}> {
  try {
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    const usageRecords = await prisma.featureUsage.findMany({
      where: {
        userId,
        month: currentMonth,
      },
    });
    
    let score = 0;
    let monthlyApplications = 0;
    let aiUsage = 0;
    let premiumFeatureUsage = 0;
    
    usageRecords.forEach(record => {
      switch (record.feature) {
        case 'job_applications':
          monthlyApplications = record.usage;
          score += record.usage * 2;
          break;
        case 'ai_matching':
        case 'cover_letter_generation':
          aiUsage += record.usage;
          score += record.usage;
          break;
        case 'skills_assessment':
        case 'company_research':
        case 'interview_prep':
          premiumFeatureUsage += record.usage;
          score += record.usage * 1.5;
          break;
      }
    });
    
    return {
      score,
      monthlyApplications,
      aiUsage,
      premiumFeatureUsage,
    };
  } catch (error) {
    logger.error('Error getting usage patterns', { userId, error });
    return {
      score: 0,
      monthlyApplications: 0,
      aiUsage: 0,
      premiumFeatureUsage: 0,
    };
  }
}

/**
 * Recommend plan based on usage patterns
 */
function getRecommendedPlan(usageStats: {
  score: number;
  monthlyApplications: number;
  aiUsage: number;
  premiumFeatureUsage: number;
}): SubscriptionPlan {
  if (usageStats.score >= 50 || usageStats.monthlyApplications > 5 || usageStats.premiumFeatureUsage > 10) {
    return 'EXECUTIVE';
  } else if (usageStats.score >= 20 || usageStats.monthlyApplications > 2 || usageStats.aiUsage > 5) {
    return 'PROFESSIONAL';
  } else {
    return 'FREE';
  }
}

/**
 * Subscription trial middleware
 */
export const checkTrialStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return next();
    }
    
    const subscription = await prisma.subscription.findFirst({
      where: { userId },
      select: { trialEndsAt: true, status: true },
    });
    
    if (subscription?.trialEndsAt && subscription.trialEndsAt < new Date()) {
      // Trial has expired
      res.set({
        'X-Trial-Expired': 'true',
        'X-Trial-Ended': subscription.trialEndsAt.toISOString(),
      });
      
      // Check if subscription is still active (payment method on file)
      if (subscription.status !== 'ACTIVE') {
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionPlan: 'FREE',
            creditsRemaining: PLAN_QUOTAS.FREE.monthlyApplications,
            monthlyQuota: PLAN_QUOTAS.FREE.monthlyApplications,
          },
        });
        
        logger.info('Trial expired, downgraded to FREE', { userId });
      }
    }
    
    next();
  } catch (error) {
    logger.error('Error checking trial status', error);
    next();
  }
};

/**
 * Usage-based feature degradation
 */
export function createFeatureDegradation(feature: string, degradedBehavior: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return next();
      }
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true },
      });
      
      if (!user) {
        return next();
      }
      
      const currentMonth = new Date().toISOString().substring(0, 7);
      const usageKey = `feature_usage:${userId}:${feature}:${currentMonth}`;
      const currentUsage = parseInt(await redis.get(usageKey) || '0');
      const limit = getFeatureLimit(feature, user.subscriptionPlan);
      
      // If usage is at 80% of limit, start degrading feature
      if (limit > 0 && currentUsage >= limit * 0.8) {
        (req as any).featureDegraded = true;
        (req as any).degradationLevel = Math.min(1, (currentUsage - limit * 0.8) / (limit * 0.2));
        
        // Apply degraded behavior
        if (typeof degradedBehavior === 'function') {
          return degradedBehavior(req, res, next);
        }
      }
      
      next();
    } catch (error) {
      logger.error('Error in feature degradation', { feature, error });
      next();
    }
  };
}

/**
 * Subscription health monitoring
 */
export const monitorSubscriptionHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return next();
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    
    if (!user?.subscription) {
      return next();
    }
    
    const subscription = user.subscription;
    
    // Check for subscription issues
    const warnings = [];
    
    // Payment failure warnings
    if (subscription.status === 'PAST_DUE') {
      warnings.push('payment_overdue');
    }
    
    // Expiry warnings (7 days before expiry)
    if (subscription.currentPeriodEnd) {
      const daysUntilExpiry = (subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry <= 7) {
        warnings.push('expiring_soon');
      }
    }
    
    // Usage warnings (approaching limits)
    const currentMonth = new Date().toISOString().substring(0, 7);
    const usageKey = `feature_usage:${userId}:job_applications:${currentMonth}`;
    const applicationUsage = parseInt(await redis.get(usageKey) || '0');
    const applicationLimit = getFeatureLimit('job_applications', user.subscriptionPlan);
    
    if (applicationLimit > 0 && applicationUsage >= applicationLimit * 0.8) {
      warnings.push('quota_warning');
    }
    
    // Add warnings to response headers
    if (warnings.length > 0) {
      res.set({
        'X-Subscription-Warnings': warnings.join(','),
        'X-Subscription-Health': 'warning',
      });
    } else {
      res.set('X-Subscription-Health', 'healthy');
    }
    
    next();
  } catch (error) {
    logger.error('Error monitoring subscription health', error);
    next();
  }
};

export default {
  requireSubscription,
  trackFeatureUsage,
  enforceApplicationQuota,
  checkSubscriptionExpiry,
  checkTrialStatus,
  createFeatureDegradation,
  monitorSubscriptionHealth,
};
