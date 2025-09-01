import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { Link } from 'react-router-dom'

export default function QuotaBanner() {
  const { user } = useAuth()
  const used = user?.quotas?.autoApplicationsUsed ?? 0
  const limit = user?.quotas?.autoApplicationsLimit ?? 0
  if (!limit) return null
  const pct = (used / limit) * 100
  if (pct < 75) return null

  const closeToLimit = pct >= 75 && pct < 100
  const atLimit = pct >= 100

  return (
    <div className={`rounded-lg p-4 mb-4 ${atLimit ? 'bg-red-500/10 border border-red-500/30 text-red-200' : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-200'}`}>
      <div className="font-semibold mb-1">{atLimit ? 'Auto-apply limit reached' : 'Approaching auto-apply limit'}</div>
      <div className="text-sm mb-3">You have used {used} of {limit} auto applications this month.</div>
      <Link to="/payment" className="inline-block px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded">Upgrade for more</Link>
    </div>
  )
}

