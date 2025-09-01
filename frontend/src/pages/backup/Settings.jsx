import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getPlanFeatures } from '@/lib/planFeatures'
import QuotaMeter from '@/components/QuotaMeter'

export default function Settings() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const plan = user?.plan || 'free'
  const planDetails = getPlanFeatures(plan)

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Settings</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 lg:col-span-2">
            <div className="text-white font-semibold mb-2">Subscription</div>
            <div className="text-gray-300 text-sm mb-4">Current plan: <span className="text-white font-semibold">{planDetails.name}</span></div>
            <QuotaMeter />
            <div className="mt-4 flex gap-3">
              {plan !== 'pro' && <Link to="/payment?plan=pro" className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded">Upgrade to Pro</Link>}
              {plan !== 'executive' && <Link to="/payment?plan=executive" className="px-4 py-2 border border-white/20 text-white rounded">Upgrade to Executive</Link>}
              {plan !== 'free' && <button onClick={()=>navigate('/payment?plan=free')} className="px-4 py-2 text-gray-300 hover:text-white">Downgrade to Free</button>}
            </div>
            <div className="mt-6 text-xs text-gray-400">Invoices and billing history will appear here once payments are processed.</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-white font-semibold mb-2">Account</div>
            <div className="text-gray-300 text-sm">Email: <span className="text-white">{user?.email || 'unknown'}</span></div>
            <div className="text-gray-300 text-sm">Name: <span className="text-white">{user?.name || '-'}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

