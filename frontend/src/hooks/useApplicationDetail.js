import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiClient'
import { ApplicationDetailSchema } from '@/lib/schemas'

export function useApplicationDetailQuery(id) {
  return useQuery({
    queryKey: ['application', id],
    queryFn: async () => {
      const res = await apiFetch(`/applications/${id}`)
      const parsed = ApplicationDetailSchema.safeParse(res)
      if (!parsed.success) throw new Error('Invalid application detail')
      return parsed.data
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}

export function useAddNoteMutation(appId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (text) => {
      const res = await apiFetch(`/applications/${appId}/notes`, { method: 'POST', body: JSON.stringify({ text }) })
      return res
    },
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: ['application', appId] })
      const previous = qc.getQueryData(['application', appId])
      qc.setQueryData(['application', appId], (old) => ({
        ...old,
        notes: [{ id: 'optimistic-'+Date.now(), text, createdAt: new Date().toISOString() }, ...(old?.notes || [])]
      }))
      return { previous }
    },
    onError: (_err, _var, ctx) => {
      if (ctx?.previous) qc.setQueryData(['application', appId], ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['application', appId] })
    }
  })
}

