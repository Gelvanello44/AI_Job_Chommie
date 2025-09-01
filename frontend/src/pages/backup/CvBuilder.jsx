import React, { useState } from 'react'
import PlanGate from '@/components/PlanGate'
import Upsell from '@/components/Upsell'
import TemplateCards from '@/components/TemplateCards'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CvDocumentSchema, CvTemplatesResponseSchema } from '@/lib/schemas'
import CvExperienceEditor from '@/components/CvExperienceEditor'
import CvEducationEditor from '@/components/CvEducationEditor'
import { useCvTemplatesQuery, useExportCvMutation } from '@/hooks/useCv'
import { SkeletonLine, SkeletonBox } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import LoadingOverlay from '@/components/ui/LoadingOverlay'
function StandardPreview({ form }) {
  return (
    <div className="bg-white text-black text-sm leading-relaxed font-sans max-w-full overflow-hidden print:shadow-none print:border-none">
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-gray-400">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {form.watch('content.fullName') || 'Your Name'}
        </h1>
        <div className="text-gray-600 text-sm">
          Job Seeker • South Africa
        </div>
      </div>

      {/* Summary */}
      {form.watch('content.summary') && (
        <section className="mb-4">
          <h2 className="text-base font-bold text-gray-900 mb-2 uppercase">Summary</h2>
          <p className="text-gray-700 leading-relaxed">
            {form.watch('content.summary')}
          </p>
        </section>
      )}

      {/* Skills */}
      {form.watch('content.skills')?.length > 0 && (
        <section className="mb-4">
          <h2 className="text-base font-bold text-gray-900 mb-2 uppercase">Skills</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {form.watch('content.skills').map((skill, i) => (
              <span key={i} className="text-gray-700">• {skill}</span>
            ))}
          </div>
        </section>
      )}

      {/* Experience */}
      {form.watch('content.experience')?.length > 0 && (
        <section className="mb-4">
          <h2 className="text-base font-bold text-gray-900 mb-2 uppercase">Experience</h2>
          <div className="space-y-3">
            {form.watch('content.experience').map((e, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-gray-900">{e.role}</h3>
                  <span className="text-xs text-gray-600">
                    {e.start} – {e.end || 'Present'}
                  </span>
                </div>
                <div className="text-gray-700 text-sm mb-1">{e.company}</div>
                {e.description && (
                  <div className="text-gray-700 text-sm leading-relaxed">
                    {e.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {form.watch('content.education')?.length > 0 && (
        <section className="mb-4">
          <h2 className="text-base font-bold text-gray-900 mb-2 uppercase">Education</h2>
          <div className="space-y-2">
            {form.watch('content.education').map((ed, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{ed.degree}</h3>
                    <div className="text-gray-700 text-sm">{ed.institution}</div>
                  </div>
                  <span className="text-xs text-gray-600">
                    {ed.start} – {ed.end}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ProfessionalPreview({ form }) {
  return (
    <div className="bg-white text-black text-sm leading-relaxed font-serif max-w-full overflow-hidden print:shadow-none print:border-none"
         style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {/* Header with name and contact */}
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
          {form.watch('content.fullName') || 'Your Name'}
        </h1>
        <div className="text-gray-600 text-sm">
          Professional • South Africa • Available for opportunities
        </div>
      </div>

      {/* Professional Summary */}
      {form.watch('content.summary') && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
            Professional Summary
          </h2>
          <p className="text-gray-700 leading-relaxed">
            {form.watch('content.summary')}
          </p>
        </section>
      )}

      {/* Experience */}
      {form.watch('content.experience')?.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
            Professional Experience
          </h2>
          <div className="space-y-4">
            {form.watch('content.experience').map((e, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-gray-900">{e.role}</h3>
                  <span className="text-sm text-gray-600 font-medium">
                    {e.start} – {e.end || 'Present'}
                  </span>
                </div>
                <div className="text-gray-700 font-medium mb-2">{e.company}</div>
                {e.description && (
                  <div className="text-gray-700 leading-relaxed">
                    {e.description.split('\n').map((line, idx) => (
                      <div key={idx} className="mb-1">
                        {line.trim().startsWith('•') || line.trim().startsWith('-') ? (
                          <div className="flex items-start">
                            <span className="mr-2 text-gray-500">•</span>
                            <span>{line.replace(/^[•-]\s*/, '')}</span>
                          </div>
                        ) : (
                          line
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {form.watch('content.skills')?.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
            Core Competencies
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {form.watch('content.skills').map((skill, i) => (
              <div key={i} className="flex items-center">
                <span className="mr-2 text-gray-500">•</span>
                <span className="text-gray-700">{skill}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {form.watch('content.education')?.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">
            Education
          </h2>
          <div className="space-y-3">
            {form.watch('content.education').map((ed, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900">{ed.degree}</h3>
                    <div className="text-gray-700">{ed.institution}</div>
                  </div>
                  <span className="text-sm text-gray-600 font-medium">
                    {ed.start} – {ed.end}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}


const CvFormSchema = z.object({
  templateId: z.string(),
  content: z.record(z.any()).default({
    fullName: '',
    summary: '',
    skills: [],
    experience: [],
    education: [],
  }),
})

export default function CvBuilder() {
  const templatesQuery = useCvTemplatesQuery()
  const exportCv = useExportCvMutation()
  const [atsScore, setAtsScore] = useState(78)

  const form = useForm({ resolver: zodResolver(CvFormSchema), defaultValues: { templateId: 'std', content: { fullName: '', summary: '', skills: [], experience: [], education: [] } } })
  const templates = templatesQuery.data?.templates || []

  async function onExport() {
    const payload = { id: 'cv1', templateId: form.getValues('templateId'), content: form.getValues('content'), atsScore }
    const res = await exportCv.mutateAsync(payload)
    alert(`Exported! URL: ${res.url}`)
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">CV Builder</h1>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="text-white font-semibold mb-2">Template</div>
              <div className="mb-3">
                <TemplateCards templates={templates} selectedId={form.watch('templateId')} onSelect={(id)=>form.setValue('templateId', id)} />
              </div>
              <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register('templateId')}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="text-gray-400 text-sm mt-1">ATS-friendly templates.</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
              <div className="text-white font-semibold">Content</div>
              <input placeholder="Full name" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" {...form.register('content.fullName')} />
              <textarea placeholder="Professional summary" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" rows={4} {...form.register('content.summary')} />
              <input placeholder="Skills (comma separated)" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" onChange={(e)=>form.setValue('content.skills', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} />
              <div>
                <div className="text-white font-semibold mt-3 mb-1">Experience</div>
                <CvExperienceEditor value={form.watch('content.experience')} onChange={(val)=>form.setValue('content.experience', val)} />
              </div>
              <div>
                <div className="text-white font-semibold mt-3 mb-1">Education</div>
                <CvEducationEditor value={form.watch('content.education')} onChange={(val)=>form.setValue('content.education', val)} />
              </div>
              <PlanGate allow={['pro','executive']} fallback={<Upsell plan="pro" feature="Keyword optimization" />}>
                <div className="mt-3 text-sm text-gray-300">Pro: Keyword recommendations and diff view coming soon.</div>
              </PlanGate>
            </div>

            {templatesQuery.isError && (
              <ErrorBanner
                title="Failed to load templates"
                message={templatesQuery.error?.message}
                onRetry={templatesQuery.refetch}
                className="mb-4"
              />
            )}

            <div className="flex gap-3 relative">
              <button
                onClick={onExport}
                disabled={exportCv.isPending}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                aria-busy={exportCv.isPending}
              >
                {exportCv.isPending && <Spinner size="sm" />}
                {exportCv.isPending ? 'Exporting…' : 'Export PDF'}
              </button>
              {exportCv.isSuccess && exportCv.data?.url && (
                <a href={exportCv.data.url} target="_blank" rel="noreferrer" className="px-6 py-3 border border-white/20 text-white rounded-lg">Download</a>
              )}
              <LoadingOverlay
                isVisible={exportCv.isPending}
                message="Generating your CV..."
              />
            </div>

            {exportCv.isError && (
              <ErrorBanner
                title="Export failed"
                message={exportCv.error?.message || "Please try again"}
                onRetry={onExport}
                className="mt-4"
              />
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="text-white font-semibold mb-2">ATS guidance</div>
              <ul className="text-gray-300 list-disc list-inside text-sm space-y-1">
                <li>Use simple headings (Experience, Education, Skills)</li>
                <li>Use bullet points and active verbs</li>
                <li>Avoid tables and fancy graphics</li>
                <li>Include SA-specific keywords relevant to your industry</li>
              </ul>
              <div className="mt-4 text-gray-300 text-sm">Estimated ATS score:</div>
              <div className="text-cyan-400 text-2xl font-bold">{atsScore}%</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="text-white font-semibold mb-2">Preview</div>
              <div className="text-gray-300 text-sm">
                {templatesQuery.isLoading ? (
                  <div className="space-y-3">
                    <SkeletonLine width="3/4" height="6" />
                    <SkeletonLine width="full" height="4" />
                    <SkeletonLine width="1/2" height="4" />
                    <SkeletonBox height="32" className="mt-4" />
                  </div>
                ) : form.watch('content.fullName') || form.watch('content.summary') ? (
                  form.watch('templateId') === 'pro' ? (
                    <ProfessionalPreview form={form} />
                  ) : (
                    <StandardPreview form={form} />
                  )
                ) : (
                  <EmptyState
                    title="Start building your CV"
                    description="Fill in your personal information to see a preview"
                    className="py-8"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
