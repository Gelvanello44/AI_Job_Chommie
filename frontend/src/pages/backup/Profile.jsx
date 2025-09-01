import React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ProfileSchema } from '@/lib/schemas'
import { useProfileQuery, useSaveProfileMutation } from '@/hooks/useProfile'

export default function Profile() {
  const { data, isLoading } = useProfileQuery()
  const { mutate: save, isPending } = useSaveProfileMutation()
  const form = useForm({ resolver: zodResolver(ProfileSchema), values: data || { name: '', headline: '', location: '', skills: [], experience: [], education: [] } })
  const exp = useFieldArray({ control: form.control, name: 'experience' })
  const edu = useFieldArray({ control: form.control, name: 'education' })

  function onSubmit(values) { save(values) }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Profile</h1>

        {isLoading ? (
          <div className="text-gray-300">Loading profile…</div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/10 border border-white/20 overflow-hidden">
                {/* avatar preview placeholder */}
              </div>
              <button type="button" className="px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg">Upload avatar (dev)</button>
            </div>

            <div>
              <label className="text-white font-semibold">Name</label>
              <input className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register('name')} />
              <p className="text-red-400 text-sm">{form.formState.errors.name?.message}</p>
            </div>
            <div>
              <label className="text-white font-semibold">Headline</label>
              <input className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register('headline')} />
            </div>
            <div>
              <label className="text-white font-semibold">Location</label>
              <input className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register('location')} />
            </div>
            <div>
              <label className="text-white font-semibold">Skills (comma separated)</label>
              <input className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" onChange={(e)=>form.setValue('skills', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} defaultValue={data?.skills?.join(', ') || ''} />
            </div>

            <div>
              <div className="text-white font-semibold mb-2">Experience</div>
              {exp.fields.map((f, idx) => (
                <div key={f.id} className="grid md:grid-cols-2 gap-2 mb-2">
                  <input placeholder="Company" className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register(`experience.${idx}.company`)} />
                  <input placeholder="Role" className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register(`experience.${idx}.role`)} />
                  <input placeholder="Start (YYYY-MM)" className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register(`experience.${idx}.startDate`)} />
                  <input placeholder="End (YYYY-MM)" className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register(`experience.${idx}.endDate`)} />
                  <input placeholder="Description" className="md:col-span-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register(`experience.${idx}.description`)} />
                </div>
              ))}
              <button type="button" onClick={()=>exp.append({ company:'', role:'', startDate:'', endDate:'', description:'' })} className="px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg">Add experience</button>
            </div>

            <div>
              <div className="text-white font-semibold mb-2">Education</div>
              {edu.fields.map((f, idx) => (
                <div key={f.id} className="grid md:grid-cols-2 gap-2 mb-2">
                  <input placeholder="Institution" className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register(`education.${idx}.institution`)} />
                  <input placeholder="Degree" className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register(`education.${idx}.degree`)} />
                  <input placeholder="Start (YYYY-MM)" className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register(`education.${idx}.startDate`)} />
                  <input placeholder="End (YYYY-MM)" className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register(`education.${idx}.endDate`)} />
                </div>
              ))}
              <button type="button" onClick={()=>edu.append({ institution:'', degree:'', startDate:'', endDate:'' })} className="px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg">Add education</button>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={isPending} className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg">{isPending ? 'Saving…' : 'Save profile'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

