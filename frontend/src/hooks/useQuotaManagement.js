import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// User plan tiers as defined in PricingPage.jsx
const PLAN_TIERS = {
  FREE: {
    id: 'free',
    name: 'Career Starter',
    monthlyQuota: 2,
    features: {
      autoApplications: 2,
      cvTemplates: 1,
      skillsAssessments: true,
      applicationTracking: true,
      marketInsights: true
    }
  },
  PROFESSIONAL: {
    id: 'professional', 
    name: 'The Career Accelerator',
    price: 'R8/month',
    monthlyQuota: 5,
    features: {
      autoApplications: 5,
      cvTemplates: 'unlimited',
      skillsAssessments: true,
      applicationTracking: true,
      marketInsights: true,
      coverLetters: true,
      weeklyAlerts: true,
      analytics: true,
      professionalTools: true
    }
  },
  EXECUTIVE: {
    id: 'executive',
    name: 'The Leadership Advantage', 
    price: 'R17/month',
    monthlyQuota: 8,
    features: {
      autoApplications: 8,
      cvTemplates: 'unlimited',
      skillsAssessments: true,
      applicationTracking: true,
      marketInsights: true,
      coverLetters: true,
      weeklyAlerts: true,
      analytics: true,
      professionalTools: true,
      executiveCv: true,
      personalBrand: true,
      networking: true,
      careerPlanning: true,
      headhunterVisibility: true,
      leadershipAssessment: true,
      premiumSupport: true
    }
  }
}

// Mock API service for quota management
const quotaService = {
  async getUserQuota() {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Get from localStorage or use defaults
    const storedData = JSON.parse(localStorage.getItem('userQuota') || '{}')
    const currentDate = new Date()
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
    
    const defaultQuota = {
      userId: 'user123',
      currentPlan: storedData.currentPlan || 'free',
      currentMonth,
      quotaUsed: storedData.quotaUsed || 0,
      quotaRemaining: this.calculateRemainingQuota(storedData.currentPlan || 'free', storedData.quotaUsed || 0),
      lastResetDate: storedData.lastResetDate || currentDate.toISOString(),
      upcomingApplications: storedData.upcomingApplications || [],
      usageHistory: storedData.usageHistory || []
    }
    
    // Reset quota if new month
    if (storedData.currentMonth !== currentMonth) {
      defaultQuota.quotaUsed = 0
      defaultQuota.quotaRemaining = PLAN_TIERS[storedData.currentPlan?.toUpperCase() || 'FREE'].monthlyQuota
      defaultQuota.lastResetDate = currentDate.toISOString()
      defaultQuota.currentMonth = currentMonth
    }
    
    return defaultQuota
  },
  
  async updateQuotaUsage(usage) {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const current = await this.getUserQuota()
    const newUsed = current.quotaUsed + usage
    const plan = PLAN_TIERS[current.currentPlan.toUpperCase()]
    
    const updated = {
      ...current,
      quotaUsed: newUsed,
      quotaRemaining: Math.max(0, plan.monthlyQuota - newUsed),
      usageHistory: [
        ...current.usageHistory,
        {
          date: new Date().toISOString(),
          usage,
          type: 'auto_application',
          description: `Auto job application submitted`
        }
      ].slice(-50) // Keep last 50 entries
    }
    
    localStorage.setItem('userQuota', JSON.stringify(updated))
    return updated
  },
  
  async upgradePlan(newPlan) {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const current = await this.getUserQuota()
    const plan = PLAN_TIERS[newPlan.toUpperCase()]
    
    const updated = {
      ...current,
      currentPlan: newPlan,
      quotaRemaining: plan.monthlyQuota - current.quotaUsed,
      planUpgradedAt: new Date().toISOString()
    }
    
    localStorage.setItem('userQuota', JSON.stringify(updated))
    return updated
  },
  
  async getQuotaAnalytics() {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const quota = await this.getUserQuota()
    const plan = PLAN_TIERS[quota.currentPlan.toUpperCase()]
    
    return {
      currentUsage: quota.quotaUsed,
      monthlyLimit: plan.monthlyQuota,
      utilizationRate: (quota.quotaUsed / plan.monthlyQuota) * 100,
      remainingDays: this.getDaysRemainingInMonth(),
      averageDailyUsage: quota.quotaUsed / (new Date().getDate()),
      projectedMonthlyUsage: this.calculateProjectedUsage(quota),
      recommendedUpgrade: this.getUpgradeRecommendation(quota),
      usagePattern: this.analyzeUsagePattern(quota.usageHistory)
    }
  },
  
  calculateRemainingQuota(planId, used) {
    const plan = PLAN_TIERS[planId?.toUpperCase() || 'FREE']
    return Math.max(0, plan.monthlyQuota - used)
  },
  
  getDaysRemainingInMonth() {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return lastDay.getDate() - now.getDate()
  },
  
  calculateProjectedUsage(quota) {
    const daysInMonth = new Date().getDate()
    const dailyAverage = quota.quotaUsed / daysInMonth
    const remainingDays = this.getDaysRemainingInMonth()
    return Math.ceil(quota.quotaUsed + (dailyAverage * remainingDays))
  },
  
  getUpgradeRecommendation(quota) {
    const analytics = {
      currentUsage: quota.quotaUsed,
      monthlyLimit: PLAN_TIERS[quota.currentPlan.toUpperCase()].monthlyQuota
    }
    
    if (analytics.currentUsage >= analytics.monthlyLimit * 0.8) {
      if (quota.currentPlan === 'free') {
        return {
          recommended: true,
          plan: 'professional',
          reason: 'High quota utilization - upgrade for more applications',
          benefits: ['5 monthly applications', 'CV optimization', 'Cover letters']
        }
      } else if (quota.currentPlan === 'professional') {
        return {
          recommended: true,
          plan: 'executive',
          reason: 'Professional features fully utilized - executive plan offers premium benefits',
          benefits: ['8 monthly applications', 'Executive CV', 'Personal branding', 'Leadership assessment']
        }
      }
    }
    
    return { recommended: false }
  },
  
  analyzeUsagePattern(history) {
    if (!history || history.length < 3) {
      return { pattern: 'insufficient_data', description: 'Not enough usage data' }
    }
    
    const recentUsage = history.slice(-7) // Last 7 entries
    const dates = recentUsage.map(entry => new Date(entry.date).getDate())
    const isConsistent = dates.every((date, i) => i === 0 || date > dates[i-1] || date < 5) // Handle month rollover
    
    return {
      pattern: isConsistent ? 'consistent' : 'sporadic',
      description: isConsistent ? 'Consistent usage pattern' : 'Irregular usage - consider spacing applications',
      frequency: recentUsage.length / 7,
      recommendation: isConsistent ? 'Continue current pattern' : 'Consider scheduling applications more evenly'
    }
  }
}

export function useUserQuotaQuery() {
  return useQuery({
    queryKey: ['userQuota'],
    queryFn: quotaService.getUserQuota,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

export function useQuotaAnalyticsQuery() {
  return useQuery({
    queryKey: ['quotaAnalytics'],
    queryFn: quotaService.getQuotaAnalytics,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUpdateQuotaMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: quotaService.updateQuotaUsage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userQuota'] })
      queryClient.invalidateQueries({ queryKey: ['quotaAnalytics'] })
    }
  })
}

export function useUpgradePlanMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: quotaService.upgradePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userQuota'] })
      queryClient.invalidateQueries({ queryKey: ['quotaAnalytics'] })
    }
  })
}

export function usePlanFeatures(planId = null) {
  const { data: quota } = useUserQuotaQuery()
  const currentPlan = planId || quota?.currentPlan || 'free'
  
  return {
    plan: PLAN_TIERS[currentPlan.toUpperCase()],
    features: PLAN_TIERS[currentPlan.toUpperCase()]?.features || {},
    canUse: (feature) => {
      const plan = PLAN_TIERS[currentPlan.toUpperCase()]
      return plan?.features?.[feature] === true || plan?.features?.[feature] === 'unlimited'
    },
    hasQuotaRemaining: () => {
      return quota?.quotaRemaining > 0
    }
  }
}

export { PLAN_TIERS }
