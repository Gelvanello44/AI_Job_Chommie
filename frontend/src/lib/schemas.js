import { z } from 'zod'

export const MeSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  plan: z.enum(['free', 'pro', 'executive']),
  quotas: z.object({
    autoApplicationsUsed: z.number(),
    autoApplicationsLimit: z.number(),
  }),
})

export const PreferencesSchema = z.object({
  autoApplyEnabled: z.boolean().default(false),
  frequency: z.enum(['weekly','biweekly','monthly']).default('weekly'),
  roles: z.array(z.string()).default([]),
  provinces: z.array(z.string()).default([]),
  remote: z.enum(['any','remote','onsite']).default('any'),
})

export const JobItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  province: z.string(),
  salaryZarMin: z.number().optional(),
  salaryZarMax: z.number().optional(),
  remote: z.boolean().optional(),
  beeFriendly: z.boolean().optional(),
  postedAt: z.string().optional(),
})

export const JobsListSchema = z.object({
  items: z.array(JobItemSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
})

export const JobDetailSchema = JobItemSchema.extend({
  descriptionHtml: z.string(),
  requirements: z.array(z.string()),
  company: z.object({ id: z.string(), name: z.string() }),
})

export const ApplicationsListSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    jobId: z.string(),
    jobTitle: z.string(),
    companyName: z.string(),
    status: z.enum(['applied','interview','offer','hired','rejected']),
    appliedAt: z.string(),
  }))
})

export const ApplicationNoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
})

export const ApplicationDetailSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  jobTitle: z.string(),
  companyName: z.string(),
  status: z.enum(['applied','interview','offer','hired','rejected']),
  appliedAt: z.string(),
  notes: z.array(ApplicationNoteSchema).default([]),
  job: JobItemSchema.optional(),
})

export const SavedJobsSchema = z.object({
  items: z.array(JobItemSchema),
})

export const ProfileSchema = z.object({
  name: z.string().min(2),
  headline: z.string().optional(),
  location: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  skills: z.array(z.string()).default([]),
  experience: z.array(z.object({
    company: z.string(),
    role: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
    description: z.string().optional(),
  })).default([]),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
  })).default([]),
})

export const CvTemplateSchema = z.object({ id: z.string(), name: z.string(), description: z.string().optional() })
export const CvDocumentSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  content: z.record(z.any()),
  atsScore: z.number().min(0).max(100).optional(),
})
export const CvTemplatesResponseSchema = z.object({ templates: z.array(CvTemplateSchema) })

export const AnalyticsPointSchema = z.object({ month: z.string(), apps: z.number(), interviews: z.number(), offers: z.number().default(0), hires: z.number().default(0) })
export const AnalyticsResponseSchema = z.object({
  timeseries: z.array(AnalyticsPointSchema),
  ttiBuckets: z.array(z.object({ bucket: z.string(), value: z.number() })).default([]),
})

