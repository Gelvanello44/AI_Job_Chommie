import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiClient'
import { AnalyticsResponseSchema } from '@/lib/schemas'

export function useAnalyticsQuery(range = '3m') {
  return useQuery({
    queryKey: ['analytics', range],
    queryFn: async () => {
      const res = await apiFetch(`/me/analytics?range=${range}`)
      const parsed = AnalyticsResponseSchema.safeParse(res)
      if (!parsed.success) throw new Error('Invalid analytics response')
      return parsed.data
    },
    staleTime: 1000 * 60 * 15, // 15 minutes - analytics data changes less frequently
  })
}

export function useAnalyticsRolesQuery(range = '3m') {
  return useQuery({
    queryKey: ['analytics-roles', range],
    queryFn: async () => {
      const res = await apiFetch(`/me/analytics/roles?range=${range}`)
      return res // { roles: [{ role, applications, interviews }] }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes - analytics data changes less frequently
  })
}

export function useAnalyticsResponseTimeQuery(range = '3m') {
  return useQuery({
    queryKey: ['analytics-response-time', range],
    queryFn: async () => {
      const res = await apiFetch(`/me/analytics/response-time?range=${range}`)
      return res // { buckets: [{ bucket, value }] }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes - analytics data changes less frequently
  })
}

