import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiClient'
import { SavedJobsSchema } from '@/lib/schemas'

export function useSavedJobsQuery() {
  return useQuery({
    queryKey: ['saved-jobs'],
    queryFn: async () => {
      const res = await apiFetch('/me/saved-jobs')
      const parsed = SavedJobsSchema.safeParse(res)
      if (!parsed.success) throw new Error('Invalid saved jobs response')
      return parsed.data
    },
    staleTime: 1000 * 60 * 30,
  })
}

export function useToggleSaveJobMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ jobId, saved }) => {
      const method = saved ? 'DELETE' : 'POST'
      const path = saved ? `/me/saved-jobs/${jobId}` : '/me/saved-jobs'
      const body = saved ? undefined : JSON.stringify({ jobId })
      const res = await apiFetch(path, { method, body })
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-jobs'] })
    }
  })
}

