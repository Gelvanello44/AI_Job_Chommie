import { useInfiniteQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiClient'
import { JobsListSchema } from '@/lib/schemas'

export function useInfiniteJobsQuery(params) {
  return useInfiniteQuery({
    queryKey: ['jobs-infinite', params],
    queryFn: async ({ pageParam = 1 }) => {
      const qs = new URLSearchParams({ ...params, page: String(pageParam), pageSize: '5' }).toString()
      const res = await apiFetch(`/jobs?${qs}`)
      const parsed = JobsListSchema.safeParse(res)
      if (!parsed.success) throw new Error('Invalid jobs response')
      return parsed.data
    },
    getNextPageParam: (lastPage) => {
      const { page, pageSize, total } = lastPage
      const next = page + 1
      return (next - 1) * pageSize < total ? next : undefined
    },
    staleTime: 1000 * 60 * 30,
  })
}

