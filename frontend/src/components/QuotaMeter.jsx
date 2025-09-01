import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { getQuotaLimit, getPlanFeatures } from '@/lib/planFeatures'
import { Link } from 'react-router-dom'

export default function QuotaMeter() {
  const { user } = useAuth()
  if (!user) return null
  
  // Get limits from centralized config
  const limit = getQuotaLimit(user.plan, 'autoApplicationsLimit')
  const used = user.quotas?.autoApplicationsUsed || 0
  const pct = limit ? Math.min(100, Math.round((used/limit)*100)) : 0
  
  // Get plan details for display
  const planDetails = getPlanFeatures(user.plan)
  
  // Determine color based on usage
  const getColor = () => {
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 75) return 'bg-yellow-500'
    return 'bg-cyan-500'
  }
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Auto applications ({planDetails.name})</span>
        <span>{used}/{limit}</span>
      </div>
      <div className="h-2 bg-white/10 rounded overflow-hidden">
        <div 
          className={`h-2 ${getColor()} rounded transition-all duration-300`} 
          style={{ width: pct+'%' }} 
        />
      </div>
      {pct >= 90 && (
        <div className="mt-2 text-xs">
          <span className="text-yellow-400">Almost at limit!</span>
          {user.plan !== 'executive' && (
            <Link to="/pricing" className="text-cyan-400 hover:underline ml-2">
              Upgrade for more
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

