import { http, HttpResponse } from 'msw'
import { apiConfig } from '@/lib/apiConfig'

const me = {
  id: 'user_1',
  email: 'user@example.com',
  name: 'AI Job Chommie User',
  plan: 'free',
  quotas: { autoApplicationsUsed: 0, autoApplicationsLimit: 2 },
}

let profile = {
  name: 'AI Job Chommie User',
  headline: 'Aspiring Junior Developer',
  location: 'Cape Town, Western Cape',
  avatarUrl: '',
  skills: ['JavaScript', 'React', 'Node.js'],
  experience: [
    { company: 'Local NGO', role: 'Intern', startDate: '2024-01', endDate: '2024-06', description: 'Built small tools.' }
  ],
  education: [
    { institution: 'UCT', degree: 'Short Course: Web Dev', startDate: '2023-02', endDate: '2023-05' }
  ]
}

let preferences = {
  autoApplyEnabled: false,
  frequency: 'weekly',
  roles: ['Junior Developer'],
  provinces: ['Western Cape'],
  remote: 'any',
}

let alertsSettings = {
  roles: 'developer',
  province: 'All provinces',
  minSalary: 0,
  channel: 'Email',
  frequency: 'weekly',
  sendDay: 'Friday',
  sendHour: 9,
}

let savedJobs = []

let jobs = [
  {
    id: 'job_1',
    title: 'Junior Software Developer',
    company: 'Mzansi Tech',
    location: 'Cape Town',
    province: 'Western Cape',
    salaryZarMin: 18000,
    salaryZarMax: 28000,
    remote: true,
    beeFriendly: true,
    postedAt: '2025-08-20T08:00:00Z',
  },
  {
    id: 'job_2',
    title: 'Data Analyst',
    company: 'Ubuntu Analytics',
    location: 'Johannesburg',
    province: 'Gauteng',
    salaryZarMin: 25000,
    salaryZarMax: 38000,
    remote: false,
    beeFriendly: true,
    postedAt: '2025-08-18T08:00:00Z',
  },
  {
    id: 'job_3',
    title: 'IT Support Technician',
    company: 'Algoa Systems',
    location: 'Gqeberha (Port Elizabeth)',
    province: 'Eastern Cape',
    salaryZarMin: 15000,
    salaryZarMax: 22000,
    remote: false,
    beeFriendly: false,
    postedAt: '2025-08-10T08:00:00Z',
  },
  {
    id: 'job_4',
    title: 'Full Stack Developer',
    company: 'Cape Coders',
    location: 'Cape Town',
    province: 'Western Cape',
    salaryZarMin: 30000,
    salaryZarMax: 45000,
    remote: true,
    beeFriendly: true,
    postedAt: '2025-08-22T08:00:00Z',
  },
]

let applications = [
  {
    id: 'app_1',
    jobId: 'job_1',
    jobTitle: 'Junior Software Developer',
    companyName: 'Mzansi Tech',
    status: 'applied',
    appliedAt: '2025-08-01T10:00:00Z',
  },
  {
    id: 'app_2',
    jobId: 'job_2',
    jobTitle: 'Data Analyst',
    companyName: 'Ubuntu Analytics',
    status: 'interview',
    appliedAt: '2025-08-05T14:15:00Z',
  },
]

const api = (path) => `${apiConfig.baseURL}${path}`

export const handlers = [
  // Auth / Me
  http.get(api('/me'), () => HttpResponse.json(me)),
  http.post(api('/auth/login'), async () => HttpResponse.json({ ok: true })),
  http.post(api('/auth/signup'), async () => HttpResponse.json({ ok: true })),
  http.post(api('/auth/logout'), async () => HttpResponse.json({ ok: true })),

  // Profile & Preferences
  http.get(api('/me/profile'), () => HttpResponse.json(profile)),
  http.put(api('/me/profile'), async ({ request }) => {
    const body = await request.json()
    profile = { ...profile, ...body }
    return HttpResponse.json(profile)
  }),
  http.get(api('/me/preferences'), () => HttpResponse.json(preferences)),
  http.put(api('/me/preferences'), async ({ request }) => {
    const body = await request.json()
    preferences = { ...preferences, ...body }
    return HttpResponse.json(preferences)
  }),

  // Alerts settings persistence
  http.get(api('/me/alerts'), () => HttpResponse.json(alertsSettings)),
  http.put(api('/me/alerts'), async ({ request }) => {
    const body = await request.json()
    alertsSettings = { ...alertsSettings, ...body }
    return HttpResponse.json(alertsSettings)
  }),

  // Analytics datasets
  http.get(api('/me/analytics'), ({ request }) => {
    const url = new URL(request.url)
    const range = url.searchParams.get('range') || '3m'
    const dataAll = [
      { month: 'Apr', apps: 3, interviews: 1, offers: 0, hires: 0 },
      { month: 'May', apps: 5, interviews: 2, offers: 1, hires: 0 },
      { month: 'Jun', apps: 4, interviews: 1, offers: 0, hires: 0 },
      { month: 'Jul', apps: 6, interviews: 3, offers: 1, hires: 1 },
      { month: 'Aug', apps: 5, interviews: 2, offers: 1, hires: 0 },
    ]
    let timeseries = dataAll
    if (range === '1m') timeseries = dataAll.slice(-1)
    else if (range === '3m') timeseries = dataAll.slice(-3)
    else if (range === '6m') timeseries = dataAll.slice(-5)
    let ttiBuckets = []
    if (range === '1m') ttiBuckets = [
      { bucket: '0-7', value: 1 },
      { bucket: '8-14', value: 0 },
      { bucket: '15-30', value: 0 },
    ]
    else if (range === '3m') ttiBuckets = [
      { bucket: '0-7', value: 2 },
      { bucket: '8-14', value: 1 },
      { bucket: '15-30', value: 1 },
    ]
    else ttiBuckets = [
      { bucket: '0-7', value: 3 },
      { bucket: '8-14', value: 2 },
      { bucket: '15-30', value: 1 },
    ]
    return HttpResponse.json({ timeseries, ttiBuckets })
  }),

  // Role breakdown and response time (range-sensitive)
  http.get(api('/me/analytics/roles'), ({ request }) => {
    const url = new URL(request.url)
    const range = url.searchParams.get('range') || '3m'
    let roles
    if (range === '1m') roles = [
      { role: 'Developer', applications: 3, interviews: 1 },
      { role: 'Analyst', applications: 2, interviews: 1 },
      { role: 'Support', applications: 0, interviews: 0 },
    ]
    else if (range === '3m') roles = [
      { role: 'Developer', applications: 5, interviews: 2 },
      { role: 'Analyst', applications: 3, interviews: 1 },
      { role: 'Support', applications: 2, interviews: 0 },
    ]
    else roles = [
      { role: 'Developer', applications: 8, interviews: 3 },
      { role: 'Analyst', applications: 5, interviews: 2 },
      { role: 'Support', applications: 3, interviews: 0 },
    ]
    return HttpResponse.json({ roles })
  }),
  http.get(api('/me/analytics/response-time'), ({ request }) => {
    const url = new URL(request.url)
    const range = url.searchParams.get('range') || '3m'
    let buckets
    if (range === '1m') buckets = [
      { bucket: '0-1d', value: 1 },
      { bucket: '2-3d', value: 1 },
    ]
    else if (range === '3m') buckets = [
      { bucket: '0-1d', value: 2 },
      { bucket: '2-3d', value: 1 },
      { bucket: '4-7d', value: 1 },
    ]
    else buckets = [
      { bucket: '0-1d', value: 3 },
      { bucket: '2-3d', value: 2 },
      { bucket: '4-7d', value: 2 },
    ]
    return HttpResponse.json({ buckets })
  }),

  http.post(api('/me/avatar-upload-url'), async () => {
    // Mock a signed URL response
    return HttpResponse.json({ uploadUrl: 'https://example.com/upload', publicUrl: 'https://example.com/avatar.jpg' })
  }),
  // CV templates & export stub
  http.get(api('/me/cv/templates'), () => HttpResponse.json({ templates: [
    { id: 'std', name: 'Standard', description: 'ATS-friendly template' },
    { id: 'pro', name: 'Professional', description: 'Polished look' }
  ]})),
  http.post(api('/me/cv/export'), async () => {
    return HttpResponse.json({ url: 'https://example.com/generated.pdf' })
  }),


  // Alerts digest preview
  http.get(api('/me/alerts/digest'), ({ request }) => {
    const url = new URL(request.url)
    const roles = (url.searchParams.get('roles') || '').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean)
    const province = url.searchParams.get('province') || ''
    const minSalary = parseInt(url.searchParams.get('minSalary') || '0', 10)
    let filtered = [...jobs]
    if (roles.length) filtered = filtered.filter(j => roles.some(r => j.title.toLowerCase().includes(r)))
    if (province && province !== 'All provinces') filtered = filtered.filter(j => j.province === province)
    if (minSalary) filtered = filtered.filter(j => (j.salaryZarMax || j.salaryZarMin || 0) >= minSalary)
    return HttpResponse.json({ items: filtered.slice(0,5) })
  }),

  // Saved jobs
  http.get(api('/me/saved-jobs'), () => HttpResponse.json({ items: savedJobs })),
  http.post(api('/me/saved-jobs'), async ({ request }) => {
    const body = await request.json()
    const job = jobs.find(j => j.id === body.jobId)
    if (job && !savedJobs.find(s => s.id === job.id)) savedJobs.push(job)
    return HttpResponse.json({ ok: true })
  }),
  http.delete(api('/me/saved-jobs/:jobId'), async ({ params }) => {
    savedJobs = savedJobs.filter(j => j.id !== params.jobId)
    return HttpResponse.json({ ok: true })
  }),

  // Jobs (filters + pagination + sort)
  http.get(api('/jobs'), ({ request }) => {
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') || '').toLowerCase()
    const province = url.searchParams.get('province') || ''
    const remote = url.searchParams.get('remote')
    const bee = url.searchParams.get('beeFriendly')
    const sort = url.searchParams.get('sort') || 'newest'
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') || '5', 10)

    let filtered = [...jobs]
    if (q) {
      filtered = filtered.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.province.toLowerCase().includes(q)
      )
    }
    if (province) filtered = filtered.filter(j => j.province === province)
    if (remote === 'true') filtered = filtered.filter(j => j.remote)
    if (remote === 'false') filtered = filtered.filter(j => !j.remote)
    if (bee === 'true') filtered = filtered.filter(j => j.beeFriendly)

    if (sort === 'newest') filtered.sort((a,b) => new Date(b.postedAt) - new Date(a.postedAt))
    if (sort === 'title_asc') filtered.sort((a,b) => a.title.localeCompare(b.title))
    if (sort === 'salary_desc') filtered.sort((a,b) => (b.salaryZarMax||0)-(a.salaryZarMax||0))
    if (sort === 'salary_asc') filtered.sort((a,b) => (a.salaryZarMin||0)-(b.salaryZarMin||0))

    const total = filtered.length
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const items = filtered.slice(start, end)

    return HttpResponse.json({ items, page, pageSize, total })
  }),
  http.get(api('/jobs/:id'), ({ params }) => {
    const job = jobs.find((j) => j.id === params.id)
    if (!job) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    const detail = {
      ...job,
      descriptionHtml: '<p>Great opportunity in South Africa to grow your career.</p>',
      requirements: ['Team player', '1+ year experience', 'Passion for learning'],
      company: { id: 'comp_1', name: job.company },
    }
    return HttpResponse.json(detail)
  }),

  // Applications + status update + detail + notes
  http.get(api('/applications'), () => HttpResponse.json({ items: applications })),
  http.get(api('/applications/:id'), ({ params }) => {
    const app = applications.find((a) => a.id === params.id)
    if (!app) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    const job = jobs.find((j) => j.id === app.jobId) || null
    const notes = [
      { id: 'n1', text: 'Followed up by email', createdAt: '2025-08-06T09:00:00Z' },
      { id: 'n2', text: 'HR scheduled interview', createdAt: '2025-08-08T11:30:00Z' },
    ]
    return HttpResponse.json({ ...app, job, notes })
  }),
  http.patch(api('/applications/:id'), async ({ params, request }) => {
    const body = await request.json()
    applications = applications.map((a) => (a.id === params.id ? { ...a, status: body.status } : a))
    return HttpResponse.json({ ok: true })
  }),
  http.post(api('/applications/:id/notes'), async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: 'note_'+Date.now(), text: body.text, createdAt: new Date().toISOString() })
  })
]

