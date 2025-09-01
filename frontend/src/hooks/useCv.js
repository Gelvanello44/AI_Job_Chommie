import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiClient'
import { CvTemplatesResponseSchema, CvDocumentSchema } from '@/lib/schemas'

export function useCvTemplatesQuery() {
  return useQuery({
    queryKey: ['cv-templates'],
    queryFn: async () => {
      const res = await apiFetch('/me/cv/templates')
      const parsed = CvTemplatesResponseSchema.safeParse(res)
      if (!parsed.success) throw new Error('Invalid templates response')
      return parsed.data
    },
    staleTime: 1000 * 60 * 60,
  })
}

export function useExportCvMutation() {
  return useMutation({
    mutationFn: async (payload) => {
      const parsed = CvDocumentSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Invalid CV payload')
      const res = await apiFetch('/me/cv/export', { method: 'POST', body: JSON.stringify(parsed.data) })
      return res // expect { url }
    },
  })
}

