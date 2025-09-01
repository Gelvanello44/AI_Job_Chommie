import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { useJobDetailQuery } from '@/hooks/useJobs'
import PlanGate from '@/components/PlanGate'
import Upsell from '@/components/Upsell'
import QuotaBanner from '@/components/QuotaBanner'

export default function JobDetail() {
  const { id } = useParams()
  const { data: job, isLoading, isError, error } = useJobDetailQuery(id)

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Job Detail</h1>

        {isLoading && <div className="text-gray-300">Loading...</div>}
        {isError && <div className="text-red-400">{error.message}</div>}
        {job && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-gray-300">
            <div className="text-white text-2xl font-semibold">{job.title}</div>
            <div className="text-gray-400">{job.company.name} • {job.location}</div>
            <div className="prose prose-invert mt-4" dangerouslySetInnerHTML={{ __html: job.descriptionHtml }} />
            <div className="mt-4">
              <div className="text-white font-semibold mb-2">Requirements</div>
              <ul className="list-disc list-inside text-gray-300">
                {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div className="mt-4">
              <QuotaBanner />
            </div>
            <div className="mt-6 flex gap-3">
              <button className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg">Apply</button>
              <button className="border border-white/30 hover:border-cyan-400 text-white px-6 py-3 rounded-lg">Save</button>
            </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-gray-300">
            <div className="text-white font-semibold mb-2">Company research</div>
            <PlanGate allow={['pro','executive']} fallback={<Upsell plan="pro" feature="Company research briefings" />}>
              <div className="text-gray-300 text-sm">Research summary and insights will be shown here.</div>
            </PlanGate>
          </div>
          </div>
        )}

        <div className="mt-6">
          <Link to="/jobs" className="text-cyan-400">Back to Jobs</Link>
        </div>
      </div>
    </div>
  )
}

