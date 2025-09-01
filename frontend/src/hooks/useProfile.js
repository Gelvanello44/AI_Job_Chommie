import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiClient'
import { ProfileSchema } from '@/lib/schemas'

export function useProfileQuery() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await apiFetch('/me/profile')
      const parsed = ProfileSchema.safeParse(res)
      if (!parsed.success) throw new Error('Invalid profile response')
      return parsed.data
    },
    staleTime: 1000 * 60 * 10,
  })
}

export function useSaveProfileMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values) => {
      const parsed = ProfileSchema.safeParse(values)
      if (!parsed.success) throw new Error('Invalid profile data')
      const res = await apiFetch('/me/profile', { method: 'PUT', body: JSON.stringify(parsed.data) })
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
    }
  })
}

