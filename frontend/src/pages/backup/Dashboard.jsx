import React from 'react'
import QuotaMeter from '@/components/QuotaMeter'
import PlanGate from '@/components/PlanGate'
import PaymentDashboard from '@/components/PaymentDashboard'
import { useAuth } from '@/context/AuthContext'
import { Calendar, TrendingUp, Briefcase, Users, CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { user } = useAuth()
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Dashboard</h1>
        
        {/* Core widgets for all users */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-white font-semibold mb-1">Upcoming applications</div>
            <div className="text-gray-300 text-sm">Your queued auto applications will appear here.</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-white font-semibold mb-2">Usage this month</div>
            <QuotaMeter />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-gray-300">Matches this week</div>
            <div className="text-3xl text-cyan-400 font-bold">—</div>
          </div>
        </div>
        
        {/* Pro features - Analytics preview */}
        <PlanGate allow={['pro', 'executive']}>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Link to="/analytics" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                <div className="text-white font-semibold">Performance Analytics</div>
              </div>
              <div className="text-gray-300 text-sm">View your application performance metrics</div>
            </Link>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="text-gray-300 mb-1">Interview rate</div>
              <div className="text-2xl text-cyan-400 font-bold">—</div>
              <div className="text-gray-400 text-sm">Last 30 days</div>
            </div>
          </div>
        </PlanGate>
        
        {/* Payment Management - Available for Pro and Executive */}
        <PlanGate allow={['pro', 'executive']}>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-cyan-400" />
              Payment Management
            </h2>
            <PaymentDashboard />
          </div>
        </PlanGate>
        
        {/* Executive features */}
        <PlanGate allow={['executive']}>
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Executive Dashboard</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {/* Career Planning */}
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar className="h-6 w-6 text-purple-400" />
                    <div className="text-white font-semibold">Career Milestones</div>
                  </div>
                  <div className="text-gray-300 text-sm mb-3">Track your career trajectory</div>
                  <div className="text-purple-400">0 milestones set</div>
                  <Link to="/career-planning" className="text-purple-400 text-sm hover:underline mt-2 inline-block">Set milestones →</Link>
                </div>
                
                {/* Networking Events */}
                <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Users className="h-6 w-6 text-cyan-400" />
                    <div className="text-white font-semibold">Networking Events</div>
                  </div>
                  <div className="text-gray-300 text-sm mb-3">Upcoming executive events</div>
                  <div className="text-cyan-400">No events scheduled</div>
                  <Link to="/networking" className="text-cyan-400 text-sm hover:underline mt-2 inline-block">Browse events →</Link>
                </div>
                
                {/* Headhunter Visibility */}
                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Briefcase className="h-6 w-6 text-yellow-400" />
                    <div className="text-white font-semibold">Headhunter Visibility</div>
                  </div>
                  <div className="text-gray-300 text-sm mb-3">Your recruiter profile status</div>
                  <div className="text-yellow-400">Not visible</div>
                  <Link to="/settings" className="text-yellow-400 text-sm hover:underline mt-2 inline-block">Manage visibility →</Link>
                </div>
              </div>
            </div>
            
            {/* Brand Score Widget */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Personal Brand Score</h3>
                <span className="text-xs text-gray-400">Executive feature</span>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">—</div>
                  <div className="text-xs text-gray-400">Overall</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">—</div>
                  <div className="text-xs text-gray-400">LinkedIn</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">—</div>
                  <div className="text-xs text-gray-400">Network</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">—</div>
                  <div className="text-xs text-gray-400">Visibility</div>
                </div>
              </div>
              <Link to="/brand-audit" className="text-cyan-400 text-sm hover:underline mt-4 inline-block">Run brand audit →</Link>
            </div>
          </div>
        </PlanGate>
      </div>
    </div>
  )
}

