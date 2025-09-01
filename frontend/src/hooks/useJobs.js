import { useQuery } from '@tanstack/react-query'
import { jobsAPI } from '../services/api'
import { JobsListSchema, JobDetailSchema } from '../lib/schemas'

export function useJobsQuery(params) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: async () => {
      const res = await jobsAPI.getJobs(params)
      const parsed = JobsListSchema.safeParse(res)
      if (!parsed.success) {
        console.warn('Jobs validation failed:', parsed.error)
        return res // Return raw data if validation fails
      }
      return parsed.data
    },
    staleTime: 1000 * 60 * 30, // 30 min for job data
  })
}

export function useJobDetailQuery(id) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const res = await jobsAPI.getJobById(id)
      const parsed = JobDetailSchema.safeParse(res)
      if (!parsed.success) {
        console.warn('Job detail validation failed:', parsed.error)
        return res // Return raw data if validation fails
      }
      return parsed.data
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  })
}

