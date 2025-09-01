import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInfiniteJobsQuery } from '@/hooks/useInfiniteJobs'
import { useSavedJobsQuery, useToggleSaveJobMutation } from '@/hooks/useSavedJobs'
import { SkeletonJobCard } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'

function SaveJobButton({ jobId }) {
  const { data } = useSavedJobsQuery()
  const { mutate } = useToggleSaveJobMutation()
  const saved = !!data?.items?.find((j) => j.id === jobId)
  return (
    <button onClick={() => mutate({ jobId, saved })} className={saved ? 'text-cyan-400' : 'text-white/80 hover:text-cyan-400'}>
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}

export default function Jobs() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [province, setProvince] = useState('')
  const [remote, setRemote] = useState('')
  const [bee, setBee] = useState('')
  const [sort, setSort] = useState('newest')

  const params = useMemo(() => ({ q, province, remote, beeFriendly: bee, sort }), [q, province, remote, bee, sort])
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, refetch, isFetchingNextPage } = useInfiniteJobsQuery(params)

  const items = useMemo(() => (data ? data.pages.flatMap((p) => p.items) : []), [data])

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">Jobs</h1>

        <div className="mb-4 grid md:grid-cols-7 gap-2">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search jobs..." className="md:col-span-2 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" />
          <select value={province} onChange={(e)=>setProvince(e.target.value)} className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white">
            <option value="">Province</option>
            <option>Western Cape</option>
            <option>Gauteng</option>
            <option>Eastern Cape</option>
            <option>KwaZulu-Natal</option>
            <option>Free State</option>
            <option>North West</option>
            <option>Northern Cape</option>
            <option>Mpumalanga</option>
            <option>Limpopo</option>
          </select>
          <select value={remote} onChange={(e)=>setRemote(e.target.value)} className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white">
            <option value="">Any</option>
            <option value="true">Remote</option>
            <option value="false">On-site</option>
          </select>
          <select value={bee} onChange={(e)=>setBee(e.target.value)} className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white">
            <option value="">BEE: Any</option>
            <option value="true">BEE-Friendly</option>
            <option value="false">Not specified</option>
          </select>
          <div className="flex gap-2">
            <input type="number" min="0" placeholder="Min ZAR" className="w-28 px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white" />
            <input type="number" min="0" placeholder="Max ZAR" className="w-28 px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white" />
          </div>
          <select value={sort} onChange={(e)=>setSort(e.target.value)} className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white">
            <option value="newest">Newest</option>
            <option value="title_asc">Title A–Z</option>
            <option value="salary_desc">Salary high → low</option>
            <option value="salary_asc">Salary low → high</option>
          </select>
          <button onClick={() => refetch()} className="px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg">Search</button>
        </div>

        {isLoading && (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonJobCard key={i} />
            ))}
          </div>
        )}

        {isError && (
          <ErrorBanner
            title="Failed to load jobs"
            message={error?.message || "Please try again"}
            onRetry={refetch}
            className="mb-6"
          />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            title="No jobs found"
            description="Try adjusting your search filters or check back later for new opportunities."
            ctaLabel="Clear filters"
            ctaOnClick={() => {
              setQ('')
              setProvince('')
              setRemote('')
              setBee('')
              refetch()
            }}
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              {items.map((job) => (
                <div key={job.id} className="bg-white/5 border border-white/10 rounded-xl p-6 text-gray-300">
                  <div className="text-white text-xl font-semibold">{job.title}</div>
                  <div className="text-gray-400">{job.company} • {job.location}</div>
                  <div className="text-gray-400 text-sm">{job.remote ? 'Remote' : 'On-site'} • {job.province}</div>
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => nav(`/jobs/${job.id}`)} className="text-cyan-400">View</button>
                    <SaveJobButton jobId={job.id} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              {hasNextPage ? (
                <button
                  disabled={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                  className="px-6 py-3 bg-white/10 border border-white/20 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                  aria-busy={isFetchingNextPage}
                >
                  {isFetchingNextPage && <Spinner size="sm" />}
                  {isFetchingNextPage ? 'Loading more…' : 'Load more'}
                </button>
              ) : (
                <div className="text-gray-400">No more results</div>
              )}
            </div>
          </>
        )}

        <div className="mt-6">
          <Link to="/dashboard" className="text-cyan-400">Back to dashboard</Link>
        </div>
      </div>
    </div>
  )
}

