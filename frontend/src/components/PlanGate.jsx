import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { hasFeature, getQuotaLimit, getPlanFeatures } from '@/lib/planFeatures'
import { Link } from 'react-router-dom'
import { Lock, Crown } from 'lucide-react'

// Component for gating content based on plan
export default function PlanGate({ 
  allow = ['free','pro','executive'], 
  feature = null,
  children, 
  fallback = null,
  showUpgradePrompt = true 
}) {
  const { user } = useAuth()
  
  if (!user) return null
  
  // Check if user's plan is in the allowed plans
  const isPlanAllowed = allow.includes(user.plan)
  
  // If a specific feature is specified, check if it's available
  const isFeatureAllowed = feature ? hasFeature(user.plan, feature) : true
  
  // Content is accessible if both plan and feature checks pass
  const hasAccess = isPlanAllowed && isFeatureAllowed
  
  if (hasAccess) {
    return children
  }
  
  // Return custom fallback if provided
  if (fallback) {
    return fallback
  }
  
  // Default upgrade prompt
  if (showUpgradePrompt) {
    const requiredPlan = allow.find(plan => plan !== 'free') || 'pro'
    const planDetails = getPlanFeatures(requiredPlan)
    
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 text-center">
        <div className="flex justify-center mb-4">
          {requiredPlan === 'executive' ? (
            <Crown className="h-12 w-12 text-yellow-400" />
          ) : (
            <Lock className="h-12 w-12 text-cyan-400" />
          )}
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          {planDetails.name} Plan Required
        </h3>
        <p className="text-gray-300 mb-4">
          Upgrade to {planDetails.name} to access this feature
        </p>
        <Link 
          to="/pricing" 
          className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200"
        >
          View Plans
        </Link>
      </div>
    )
  }
  
  return <div className="text-gray-300">Upgrade required</div>
}

// Hook for checking feature access
export function useFeatureAccess(feature) {
  const { user } = useAuth()
  
  if (!user) return { hasAccess: false, userPlan: null }
  
  return {
    hasAccess: hasFeature(user.plan, feature),
    userPlan: user.plan,
    quotaLimit: feature.includes('autoApplications') ? getQuotaLimit(user.plan, 'autoApplicationsLimit') : null
  }
}

