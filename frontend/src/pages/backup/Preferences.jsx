import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PreferencesSchema } from '@/lib/schemas'
import { usePreferencesQuery, useSavePreferencesMutation } from '@/hooks/usePreferences'
import Modal from '@/components/Modal'
import QuotaBanner from '@/components/QuotaBanner'

export default function Preferences() {
  const { data, isLoading } = usePreferencesQuery()
  const { mutate: save, isPending } = useSavePreferencesMutation()
  const form = useForm({ resolver: zodResolver(PreferencesSchema), values: data || { autoApplyEnabled:false, frequency:'weekly', roles:[], provinces:[], remote:'any' } })
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  function onSubmit(values) {
    if (values.autoApplyEnabled) {
      setConfirmOpen(true)
      return
    }
    save(values)
  }

  function confirmEnable() {
    const values = form.getValues()
    save(values)
    setConfirmOpen(false)
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Job Preferences</h1>

        {isLoading ? (
          <div className="text-gray-300">Loading…</div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="mb-2">
              <QuotaBanner />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="auto-apply" {...form.register('autoApplyEnabled')} />
              <label htmlFor="auto-apply" className="text-white">Enable auto-apply</label>
            </div>

            <div>
              <label className="text-white font-semibold">Frequency</label>
              <select className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register('frequency')}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="text-white font-semibold">Preferred roles (comma separated)</label>
              <input className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" onChange={(e)=>form.setValue('roles', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} defaultValue={(data?.roles||[]).join(', ')} />
            </div>

            <div>
              <label className="text-white font-semibold">Provinces</label>
              <select multiple className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white h-32" {...form.register('provinces')}>
                {['Western Cape','Gauteng','Eastern Cape','KwaZulu-Natal','Free State','North West','Northern Cape','Mpumalanga','Limpopo'].map((p)=>(<option key={p} value={p}>{p}</option>))}
              </select>
            </div>

            <div>
              <label className="text-white font-semibold">Remote</label>
              <select className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register('remote')}>
                <option value="any">Any</option>
                <option value="remote">Remote</option>
                <option value="onsite">On-site</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={isPending} className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg">{isPending ? 'Saving…' : 'Save preferences'}</button>
            </div>
          </form>
        )}

        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-white font-semibold">Upcoming applications</div>
            <div className="text-gray-400 text-sm">Auto-apply will queue matching jobs here.</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-white font-semibold mb-2">Usage this month</div>
            <div className="text-gray-400 text-sm">Auto applications used vs plan limit.</div>
          </div>
        </div>

        <Modal
          open={confirmOpen}
          onClose={()=>setConfirmOpen(false)}
          title="Enable auto-apply?"
          actions={(
            <>
              <button onClick={()=>setConfirmOpen(false)} className="px-4 py-2 border border-white/20 text-white rounded">Cancel</button>
              <button onClick={confirmEnable} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded">Confirm</button>
            </>
          )}
        >
          Enabling auto-apply will use your monthly quota automatically for matching jobs. You can change these settings anytime.
        </Modal>
      </div>
    </div>
  )
}

