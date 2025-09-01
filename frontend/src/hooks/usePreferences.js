import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiClient'
import { PreferencesSchema } from '@/lib/schemas'

export function usePreferencesQuery() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: async () => {
      const res = await apiFetch('/me/preferences')
      const parsed = PreferencesSchema.safeParse(res)
      if (!parsed.success) throw new Error('Invalid preferences response')
      return parsed.data
    },
    staleTime: 1000 * 60 * 10,
  })
}

export function useSavePreferencesMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values) => {
      const parsed = PreferencesSchema.safeParse(values)
      if (!parsed.success) throw new Error('Invalid preferences data')
      const res = await apiFetch('/me/preferences', { method: 'PUT', body: JSON.stringify(parsed.data) })
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preferences'] })
    }
  })
}

