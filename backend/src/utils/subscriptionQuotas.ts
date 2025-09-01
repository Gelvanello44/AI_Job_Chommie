/**
 * Subscription Quota Management - Aligned with PricingPage.jsx
 * Manages monthly application quotas and plan-specific features
 */

import { SubscriptionPlan } from '@prisma/client';

export interface PlanQuotas {
  monthlyApplications: number;
  features: string[];
  price: number; // ZAR per month
}

/**
 * Plan quotas and features as defined in PricingPage.jsx
 */
export const PLAN_QUOTAS: Record<SubscriptionPlan, PlanQuotas> = {
  FREE: {
    monthlyApplications: 2,
    price: 0,
    features: [
      'AUTO_JOB_APPLICATIONS',
      'CV_BUILDER_BASIC',
      'SKILLS_ASSESSMENT',
      'APPLICATION_TRACKING',
      'JOB_MARKET_INSIGHTS_NEWSLETTER'
    ]
  },
  PROFESSIONAL: {
    monthlyApplications: 5,
    price: 8,
    features: [
      // All FREE features plus:
      'AUTO_JOB_APPLICATIONS',
      'CV_BUILDER_BASIC',
      'SKILLS_ASSESSMENT',
      'APPLICATION_TRACKING',
      'JOB_MARKET_INSIGHTS_NEWSLETTER',
      // Professional features:
      'CV_OPTIMIZATION_PROFESSIONAL',
      'COVER_LETTER_GENERATION',
      'WEEKLY_JOB_ALERTS',
      'COMPANY_RESEARCH_BRIEFINGS',
      'ANALYTICS_DASHBOARD',
      'SALARY_BENCHMARKING',
      'INTERVIEW_SCHEDULING',
      'CALENDAR_SYNC',
      'FOLLOW_UP_TEMPLATES',
      'LINKEDIN_OPTIMIZATION',
      'REFERENCE_MANAGEMENT'
    ]
  },
  EXECUTIVE: {
    monthlyApplications: 8,
    price: 17,
    features: [
      // All PROFESSIONAL features plus:
      'AUTO_JOB_APPLICATIONS',
      'CV_BUILDER_BASIC',
      'SKILLS_ASSESSMENT',
      'APPLICATION_TRACKING',
      'JOB_MARKET_INSIGHTS_NEWSLETTER',
      'CV_OPTIMIZATION_PROFESSIONAL',
      'COVER_LETTER_GENERATION',
      'WEEKLY_JOB_ALERTS',
      'COMPANY_RESEARCH_BRIEFINGS',
      'ANALYTICS_DASHBOARD',
      'SALARY_BENCHMARKING',
      'INTERVIEW_SCHEDULING',
      'CALENDAR_SYNC',
      'FOLLOW_UP_TEMPLATES',
      'LINKEDIN_OPTIMIZATION',
      'REFERENCE_MANAGEMENT',
      // Executive features:
      'CV_EXECUTIVE_TEMPLATE',
      'PERSONAL_BRAND_AUDIT',
      'EXECUTIVE_NETWORKING_EVENTS',
      'CAREER_TRAJECTORY_PLANNING',
      'HEADHUNTER_POSITIONING',
      'LEADERSHIP_ASSESSMENT',
      'PREMIUM_SUPPORT',
      'INDUSTRY_REPORTS',
      'MOCK_INTERVIEWS',
      'HIDDEN_JOB_MARKET'
    ]
  }
};

/**
 * Get quota information for a subscription plan
 */
export function getPlanQuota(plan: SubscriptionPlan): PlanQuotas {
  return PLAN_QUOTAS[plan];
}

/**
 * Check if a plan has a specific feature
 */
export function planHasFeature(plan: SubscriptionPlan, feature: string): boolean {
  return PLAN_QUOTAS[plan].features.includes(feature);
}

/**
 * Check if user can access a feature based on their plan
 */
export function canAccessFeature(userPlan: SubscriptionPlan, featureName: string, requiredPlan?: SubscriptionPlan): boolean {
  if (requiredPlan) {
    // Check if user's plan meets the required plan level
    const planHierarchy: SubscriptionPlan[] = ['FREE', 'PROFESSIONAL', 'EXECUTIVE'];
    const userPlanIndex = planHierarchy.indexOf(userPlan);
    const requiredPlanIndex = planHierarchy.indexOf(requiredPlan);
    return userPlanIndex >= requiredPlanIndex;
  }
  
  // Check if user's plan has the specific feature
  return planHasFeature(userPlan, featureName);
}

/**
 * Get monthly application quota for a plan
 */
export function getMonthlyQuota(plan: SubscriptionPlan): number {
  return PLAN_QUOTAS[plan].monthlyApplications;
}

/**
 * Get plan price in ZAR
 */
export function getPlanPrice(plan: SubscriptionPlan): number {
  return PLAN_QUOTAS[plan].price;
}

/**
 * Check if user can apply for a job based on remaining credits
 */
export function canApplyForJob(creditsRemaining: number): boolean {
  return creditsRemaining > 0;
}

/**
 * Calculate quota reset date (first day of next month)
 */
export function getNextQuotaResetDate(): Date {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth;
}

/**
 * Check if quota needs to be reset (new month)
 */
export function shouldResetQuota(lastResetDate: Date | null): boolean {
  if (!lastResetDate) return true;
  
  const now = new Date();
  const lastReset = new Date(lastResetDate);
  
  return now.getMonth() !== lastReset.getMonth() || 
         now.getFullYear() !== lastReset.getFullYear();
}

/**
 * Get feature access level for different tiers
 */
export function getFeatureAccess(plan: SubscriptionPlan) {
  return {
    // Auto Applications
    hasAutoApplications: planHasFeature(plan, 'AUTO_JOB_APPLICATIONS'),
    monthlyQuota: getMonthlyQuota(plan),
    
    // CV Features
    hasBasicCVBuilder: planHasFeature(plan, 'CV_BUILDER_BASIC'),
    hasProfessionalCV: planHasFeature(plan, 'CV_OPTIMIZATION_PROFESSIONAL'),
    hasExecutiveCV: planHasFeature(plan, 'CV_EXECUTIVE_TEMPLATE'),
    
    // Cover Letters
    hasCoverLetterGeneration: planHasFeature(plan, 'COVER_LETTER_GENERATION'),
    
    // Skills & Assessment
    hasSkillsAssessment: planHasFeature(plan, 'SKILLS_ASSESSMENT'),
    hasLeadershipAssessment: planHasFeature(plan, 'LEADERSHIP_ASSESSMENT'),
    
    // Job Search & Alerts
    hasWeeklyAlerts: planHasFeature(plan, 'WEEKLY_JOB_ALERTS'),
    hasNewsletterAccess: planHasFeature(plan, 'JOB_MARKET_INSIGHTS_NEWSLETTER'),
    
    // Analytics & Research
    hasAnalytics: planHasFeature(plan, 'ANALYTICS_DASHBOARD'),
    hasSalaryBenchmarking: planHasFeature(plan, 'SALARY_BENCHMARKING'),
    hasCompanyResearch: planHasFeature(plan, 'COMPANY_RESEARCH_BRIEFINGS'),
    
    // Professional Tools
    hasInterviewScheduling: planHasFeature(plan, 'INTERVIEW_SCHEDULING'),
    hasCalendarSync: planHasFeature(plan, 'CALENDAR_SYNC'),
    hasReferenceManagement: planHasFeature(plan, 'REFERENCE_MANAGEMENT'),
    hasLinkedInOptimization: planHasFeature(plan, 'LINKEDIN_OPTIMIZATION'),
    
    // Executive Features
    hasPersonalBrandAudit: planHasFeature(plan, 'PERSONAL_BRAND_AUDIT'),
    hasNetworkingEvents: planHasFeature(plan, 'EXECUTIVE_NETWORKING_EVENTS'),
    hasCareerPlanning: planHasFeature(plan, 'CAREER_TRAJECTORY_PLANNING'),
    hasHeadhunterPositioning: planHasFeature(plan, 'HEADHUNTER_POSITIONING'),
    hasPremiumSupport: planHasFeature(plan, 'PREMIUM_SUPPORT'),
    hasHiddenJobMarket: planHasFeature(plan, 'HIDDEN_JOB_MARKET'),
    
    // Plan info
    planName: plan,
    planPrice: getPlanPrice(plan)
  };
}

/**
 * Subscription plan upgrade/downgrade logic
 */
export function getUpgradePath(currentPlan: SubscriptionPlan): SubscriptionPlan[] {
  switch (currentPlan) {
    case 'FREE':
      return ['PROFESSIONAL', 'EXECUTIVE'];
    case 'PROFESSIONAL':
      return ['EXECUTIVE'];
    case 'EXECUTIVE':
      return []; // Already at highest tier
    default:
      return [];
  }
}

/**
 * Get recommended plan based on usage patterns
 */
export function getRecommendedPlan(monthlyApplications: number): SubscriptionPlan {
  if (monthlyApplications <= 2) {
    return 'FREE';
  } else if (monthlyApplications <= 5) {
    return 'PROFESSIONAL';
  } else {
    return 'EXECUTIVE';
  }
}
