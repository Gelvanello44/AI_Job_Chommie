import React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/apiClient'

import PlanGate from '@/components/PlanGate'
import Upsell from '@/components/Upsell'
import { useAlertsQuery, useSaveAlertsMutation } from '@/hooks/useAlerts'
import { SkeletonLine } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'

function computeNextDigest({ frequency, sendDay, sendHour }) {
  const now = new Date()
  const dayIndex = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }
  // Start from now at desired hour
  const target = new Date(now)
  target.setSeconds(0,0)
  target.setMinutes(0)
  target.setHours(Number(sendHour) || 9)

  if (frequency === 'daily') {
    if (target <= now) target.setDate(target.getDate() + 1)
    return target
  }
  const desiredDow = dayIndex[sendDay] ?? 5
  let diff = (desiredDow - now.getDay() + 7) % 7
  // If today and time passed, move to next cycle
  if (diff === 0 && target <= now) {
    diff = frequency === 'biweekly' ? 14 : 7
  }
  target.setDate(target.getDate() + diff)
  // For biweekly, ensure at least 14 days when same-day window already passed
  if (frequency === 'biweekly' && diff === 0 && target <= now) target.setDate(target.getDate() + 14)
  return target
}

function formatEnZAWithTZ(date) {
  try {
    const fmt = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Johannesburg' })
    return `${fmt.format(date)} SAST`
  } catch {
    return date.toString() + ' SAST'
  }
}

function countdownTo(date) {
  const ms = date - new Date()
  if (ms <= 0) return 'now'
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / (60*24))
  const hours = Math.floor((totalMinutes % (60*24)) / 60)
  const minutes = totalMinutes % 60
  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return 'in ' + parts.join(' ')
}
function AutoRefreshingCountdown({ target }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])
  return <span className="text-gray-400 text-sm ml-2">({countdownTo(target)})</span>
}


function DigestForm() {
  const { data, isLoading, isError, error, refetch } = useAlertsQuery()
  const { mutate: save, isPending: isSaving, isError: saveError, error: saveErrorMsg } = useSaveAlertsMutation()
  const [roles, setRoles] = useState('')
  const [province, setProvince] = useState('All provinces')
  const [minSalary, setMinSalary] = useState('')
  const [channel, setChannel] = useState('Email')
  const [items, setItems] = useState([])
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const [frequency, setFrequency] = useState('weekly')
  const [sendDay, setSendDay] = useState('Friday')
  const [sendHour, setSendHour] = useState(9)

  useEffect(() => {
    if (data) {
      setRoles(data.roles || '')
      setProvince(data.province || 'All provinces')
      setMinSalary(String(data.minSalary || ''))
      setChannel(data.channel || 'Email')
      setFrequency(data.frequency || 'weekly')
      setSendDay(data.sendDay || 'Friday')
      setSendHour(data.sendHour ?? 9)
    }
  }, [data])

  const load = useCallback(async () => {
    setIsLoadingPreview(true)
    setPreviewError(null)
    try {
      const params = new URLSearchParams()
      if (roles) params.set('roles', roles)
      if (province) params.set('province', province)
      if (minSalary) params.set('minSalary', minSalary)
      const res = await apiFetch(`/me/alerts/digest?${params.toString()}`)
      setItems(res.items || [])
    } catch (err) {
      console.error('Preview failed:', err)
      setPreviewError(err.message || 'Failed to load preview')
      setItems([])
    } finally {
      setIsLoadingPreview(false)
    }
  }, [roles, province, minSalary])

  function onSave() {
    save({ roles, province, minSalary: parseInt(minSalary||'0', 10), channel, frequency, sendDay, sendHour: Number(sendHour) })
  }

  useEffect(() => { if (!isLoading) load() }, [isLoading, load])

  const next = computeNextDigest({ frequency, sendDay, sendHour })
  const nextText = formatEnZAWithTZ(next)
  const countdown = countdownTo(next)

  return (
    <div className="text-gray-300 space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <input value={roles} onChange={(e)=>setRoles(e.target.value)} placeholder="Roles (comma separated)" className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white" />
        <select value={province} onChange={(e)=>setProvince(e.target.value)} className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white">
          <option>All provinces</option>
          <option>Western Cape</option>
          <option>Gauteng</option>
          <option>Eastern Cape</option>
        </select>
        <input value={minSalary} onChange={(e)=>setMinSalary(e.target.value)} placeholder="Min salary" className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white" />
        <select value={channel} onChange={(e)=>setChannel(e.target.value)} className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white">
          <option>Email</option>
          <option>SMS</option>
        </select>
      </div>
      <div className="text-gray-400 text-sm" data-testid="next-digest">Next digest on {nextText} • {countdown} <AutoRefreshingCountdown target={next} /></div>

      {saveError && (
        <ErrorBanner
          title="Failed to save alerts"
          message={saveErrorMsg?.message || "Please try again"}
          onRetry={onSave}
          className="mb-4"
        />
      )}

      <div className="flex gap-3">
        <button
          onClick={load}
          disabled={isLoadingPreview}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded disabled:opacity-50 flex items-center gap-2"
          aria-busy={isLoadingPreview}
        >
          {isLoadingPreview && <Spinner size="sm" />}
          {isLoadingPreview ? 'Loading preview...' : 'Preview digest'}
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-2 border border-white/20 text-white rounded disabled:opacity-50 flex items-center gap-2"
          aria-busy={isSaving}
        >
          {isSaving && <Spinner size="sm" />}
          {isSaving ? 'Saving...' : 'Save alerts'}
        </button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="text-white text-sm">Digest frequency</label>
          <select value={frequency} onChange={(e)=>setFrequency(e.target.value)} className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
          </select>
        </div>
        <div>
          <label className="text-white text-sm">Send day</label>
          <select value={sendDay} onChange={(e)=>setSendDay(e.target.value)} className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white">
            {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=>(<option key={d} value={d}>{d}</option>))}
          </select>
        </div>
        <div>
          <label className="text-white text-sm">Send hour</label>
          <input type="number" min="0" max="23" value={sendHour} onChange={(e)=>setSendHour(e.target.value)} className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white" />
        </div>
      </div>
      <div className="text-gray-400 text-sm" data-testid="next-digest">Next digest on {nextText} • {countdown}</div>
      <div className="mt-6">
        <div className="text-white font-semibold mb-2">Upcoming digest preview</div>

        {previewError && (
          <ErrorBanner
            title="Failed to load preview"
            message={previewError}
            onRetry={load}
            className="mb-4"
          />
        )}

        <div className="bg-black/30 border border-white/10 rounded p-3 text-sm">
          {isLoadingPreview ? (
            <div className="space-y-2">
              <SkeletonLine width="3/4" height="4" />
              <SkeletonLine width="1/2" height="4" />
              <SkeletonLine width="2/3" height="4" />
            </div>
          ) : items.length === 0 && !previewError ? (
            <EmptyState
              title="No matches"
              description="Try adjusting your role or location filters to see more job opportunities."
              className="py-6"
            />
          ) : (
            <ul className="list-disc list-inside text-gray-300">
              {items.map((j) => (
                <li key={j.id}>{j.title} — {j.location} — {j.remote ? 'Remote' : 'On-site'}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Alerts() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Job Alerts</h1>
        <PlanGate allow={['pro','executive']} fallback={<Upsell plan="pro" feature="Weekly job alerts" />}>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-gray-300 space-y-4">
            <div className="text-white font-semibold">Alert settings</div>
            <DigestForm />
          </div>
        </PlanGate>
      </div>
    </div>
  )
}

