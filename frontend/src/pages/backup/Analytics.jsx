import React from 'react'
import { SkeletonChart } from '@/components/ui/Skeleton'
import ErrorBanner from '@/components/ui/ErrorBanner'

function RoleBreakdown({ range }) {
  const { data, isLoading, isError, error, refetch } = useAnalyticsRolesQuery(range)

  if (isLoading) return <SkeletonChart />
  if (isError) return (
    <ErrorBanner
      title="Failed to load role data"
      message={error?.message}
      onRetry={refetch}
    />
  )

  const roles = data?.roles || []
  return (
    <div aria-label="Role breakdown chart showing applications and interviews by job role" role="img">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={roles}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="role" stroke="#999" fontSize={12} />
          <YAxis stroke="#999" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          />
          <Bar dataKey="applications" fill="#22d3ee" name="Applications" />
          <Bar dataKey="interviews" fill="#60a5fa" name="Interviews" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ResponseTimeChart({ range }) {
  const { data, isLoading, isError, error, refetch } = useAnalyticsResponseTimeQuery(range)

  if (isLoading) return <SkeletonChart />
  if (isError) return (
    <ErrorBanner
      title="Failed to load response time data"
      message={error?.message}
      onRetry={refetch}
    />
  )

  return (
    <div aria-label="Response time distribution chart showing employer response times in different time buckets" role="img">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data?.buckets || []}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="bucket" stroke="#999" fontSize={12} />
          <YAxis stroke="#999" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          />
          <Bar dataKey="value" fill="#a78bfa" name="Response Count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

import { useState } from 'react'

import PlanGate from '@/components/PlanGate'
import Upsell from '@/components/Upsell'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from 'recharts'

import { useAnalyticsQuery, useAnalyticsRolesQuery, useAnalyticsResponseTimeQuery } from '@/hooks/useAnalytics'

// Note: For now these extra charts use mock arrays in-component; these can be moved to MSW endpoints if needed.


export default function Analytics() {
  const [range, setRange] = useState('3m')
  const { data, isLoading, isError, error, refetch } = useAnalyticsQuery(range)
  const series = data?.timeseries || []
  const rolesQ = useAnalyticsRolesQuery(range)


  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Analytics</h1>
        <PlanGate allow={['pro','executive']} fallback={<Upsell plan="pro" feature="Application performance analytics" />}>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-gray-300">Range:</div>
            <select value={range} onChange={(e)=>setRange(e.target.value)} className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white">
              <option value="1m">Last 1 month</option>
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
            </select>
          </div>
          {isLoading ? (
            <div className="grid md:grid-cols-3 gap-6">
              <SkeletonChart />
              <SkeletonChart />
              <SkeletonChart />
            </div>
          ) : isError ? (
            <ErrorBanner
              title="Failed to load analytics"
              message={error?.message || "Please try again"}
              onRetry={refetch}
              className="mb-6"
            />
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="text-white font-semibold mb-2">Applications over time</div>
                <div className="h-40" aria-label="Line chart showing application trends over time" role="img">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="month" stroke="#999" fontSize={12} />
                      <YAxis stroke="#999" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      />
                      <Line type="monotone" dataKey="apps" stroke="#22d3ee" strokeWidth={2} name="Applications" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="text-white font-semibold mb-2">Interviews over time</div>
                <div className="h-40" aria-label="Bar chart showing interview trends over time" role="img">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="month" stroke="#999" fontSize={12} />
                      <YAxis stroke="#999" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="interviews" fill="#60a5fa" name="Interviews" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="text-white font-semibold mb-2">Conversion</div>
                <div className="text-gray-400 text-sm" data-testid="summary-conv">
                  Apps: {series.reduce((a,c)=>a+c.apps,0)} • Interviews: {series.reduce((a,c)=>a+c.interviews,0)} • Offers: {series.reduce((a,c)=>a+c.offers||0,0)} • Hires: {series.reduce((a,c)=>a+c.hires||0,0)}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="text-white font-semibold mb-2">Response rate</div>
                <div className="text-3xl text-cyan-400 font-bold">{Math.round((series.reduce((a,c)=>a+c.interviews,0)/Math.max(1,series.reduce((a,c)=>a+c.apps,0)))*100)}%</div>
                <div className="text-gray-400 text-sm">Mock data</div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:col-span-3">
                <div className="text-white font-semibold mb-2">Funnel: Applications → Interviews</div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ stage: 'Applications', value: series.reduce((a,c)=>a+c.apps,0) }, { stage: 'Interviews', value: series.reduce((a,c)=>a+c.interviews,0) }]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="stage" stroke="#999" />
                      <YAxis stroke="#999" />
                      <Tooltip />
                      <Bar dataKey="value" fill="#34d399" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:col-span-3">
                <div className="text-white font-semibold mb-2">Role breakdown</div>
                <div className="h-40">
                  <RoleBreakdown range={range} />
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:col-span-3">
                <div className="text-white font-semibold mb-2">Conversion (stacked by stage per month)</div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="month" stroke="#999" />
                      <YAxis stroke="#999" />
                      <Tooltip
                        formatter={(value, name, props) => {
                          const total = (props.payload.apps||0) + (props.payload.interviews||0) + (props.payload.offers||0) + (props.payload.hires||0)
                          const pct = total ? Math.round((value/total)*100) : 0
                          const label = name
                          return [`${value} (${pct}%)`, label]
                        }}
                      />
                      <Legend />
                      <Bar name="Apps" dataKey="apps" stackId="conv" fill="#22d3ee" />
                      <Bar name="Interviews" dataKey="interviews" stackId="conv" fill="#60a5fa" />
                      <Bar name="Offers" dataKey="offers" stackId="conv" fill="#a3e635" />
                      <Bar name="Hires" dataKey="hires" stackId="conv" fill="#f97316" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-gray-400 text-xs">Legend: Apps (cyan), Interviews (blue), Offers (lime), Hires (orange)</div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:col-span-3">
                <div className="text-white font-semibold mb-2">Conversion funnel</div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { stage: 'Apps', value: series.reduce((a,c)=>a+c.apps,0) },
                      { stage: 'Interviews', value: series.reduce((a,c)=>a+c.interviews,0) },
                      { stage: 'Offers', value: series.reduce((a,c)=>a+c.offers||0,0) },
                      { stage: 'Hires', value: series.reduce((a,c)=>a+c.hires||0,0) },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="stage" stroke="#999" />
                      <YAxis stroke="#999" />
                      <Tooltip />
                      <Bar dataKey="value" fill="#a3e635" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:col-span-3">
                <div className="text-white font-semibold mb-2">Response-time distribution</div>
                <div className="h-40">
                  <ResponseTimeChart range={range} />
                </div>
              </div>

              {/* TTI summary */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:col-span-3">
                <div className="text-white font-semibold mb-2">TTI buckets (summary)</div>
                <div className="text-gray-400 text-sm" data-testid="summary-tti">
                  {(data?.ttiBuckets || []).map((b, i) => (
                    <span key={b.bucket} data-testid={`tti-${b.bucket}`} className="mr-2">{b.bucket}:{b.value}{i < (data?.ttiBuckets.length||0)-1 ? ' | ' : ''}</span>
                  ))}
                </div>
              </div>

              {/* Role breakdown (chart already above); include a summary */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:col-span-3">
                <div className="text-white font-semibold mb-2">Roles (summary)</div>
                <div className="text-gray-400 text-sm" data-testid="summary-roles">
                  {(rolesQ?.data?.roles || []).map((r, i, arr) => (
                    <span key={r.role} data-testid={`role-${r.role}`} className="mr-2">{r.role}:{r.applications}/{r.interviews}{i < arr.length-1 ? ' | ' : ''}</span>
                  ))}
                </div>
              </div>

              {/* Time to interview chart */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:col-span-3">
                <div className="text-white font-semibold mb-2">Time to interview (days)</div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.ttiBuckets || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="bucket" stroke="#999" />
                      <YAxis stroke="#999" />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </PlanGate>
      </div>
    </div>
  )
}

