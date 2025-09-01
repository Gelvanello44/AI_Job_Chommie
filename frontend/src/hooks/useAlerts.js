import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiClient'

export function useAlertsQuery() {
  return useQuery({
    queryKey: ['alerts-settings'],
    queryFn: async () => apiFetch('/me/alerts'),
    staleTime: 1000 * 60 * 10,
  })
}

export function useSaveAlertsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values) => apiFetch('/me/alerts', { method: 'PUT', body: JSON.stringify(values) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts-settings'] })
  })
}

