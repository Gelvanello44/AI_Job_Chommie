import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { applicationsAPI } from '../services/api'

// Application service with fallback to local storage for offline mode
const applicationService = {
  async getApplications(filters = {}) {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Get from localStorage or generate mock data
    const stored = JSON.parse(localStorage.getItem('applications') || '[]')
    
    if (stored.length === 0) {
      // Generate sample data
      const sampleApplications = [
        {
          id: '1',
          jobTitle: 'Senior Software Developer',
          companyName: 'TechCorp SA',
          status: 'applied',
          appliedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          location: 'Cape Town, WC',
          salaryRange: 'R45,000 - R65,000',
          jobType: 'Full-time',
          workMode: 'Hybrid',
          notes: [],
          timeline: [
            { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), status: 'applied', description: 'Application submitted' }
          ],
          nextAction: { description: 'Follow up with hiring manager', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
          source: 'LinkedIn',
          priority: 'high'
        },
        {
          id: '2',
          jobTitle: 'Frontend Developer',
          companyName: 'Digital Agency',
          status: 'interview',
          appliedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
          location: 'Johannesburg, GP',
          salaryRange: 'R35,000 - R50,000',
          jobType: 'Full-time',
          workMode: 'Remote',
          notes: [
            { id: 'n1', text: 'Great company culture mentioned in interview', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
          ],
          timeline: [
            { date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), status: 'applied', description: 'Application submitted' },
            { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), status: 'interview', description: 'First interview scheduled' }
          ],
          nextAction: { description: 'Prepare for technical interview', dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString() },
          source: 'Company Website',
          priority: 'medium'
        }
      ]
      localStorage.setItem('applications', JSON.stringify(sampleApplications))
      return { items: sampleApplications, total: sampleApplications.length }
    }
    
    // Apply filters
    let filteredApplications = [...stored]
    
    if (filters.status) {
      filteredApplications = filteredApplications.filter(app => app.status === filters.status)
    }
    
    if (filters.priority) {
      filteredApplications = filteredApplications.filter(app => app.priority === filters.priority)
    }
    
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filteredApplications = filteredApplications.filter(app => 
        app.jobTitle.toLowerCase().includes(searchTerm) ||
        app.companyName.toLowerCase().includes(searchTerm)
      )
    }
    
    return { items: filteredApplications, total: filteredApplications.length }
  },
  
  async updateApplicationStatus({ id, status }) {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const applications = JSON.parse(localStorage.getItem('applications') || '[]')
    const appIndex = applications.findIndex(app => app.id === id)
    
    if (appIndex !== -1) {
      applications[appIndex].status = status
      applications[appIndex].timeline.push({
        date: new Date().toISOString(),
        status,
        description: `Status updated to ${status}`
      })
      
      // Update next action based on status
      switch (status) {
        case 'interview':
          applications[appIndex].nextAction = {
            description: 'Prepare for interview',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          }
          break
        case 'offer':
          applications[appIndex].nextAction = {
            description: 'Review offer and negotiate if needed',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }
          break
        case 'rejected':
          applications[appIndex].nextAction = {
            description: 'Request feedback and learn from experience',
            dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
          }
          break
      }
      
      localStorage.setItem('applications', JSON.stringify(applications))
    }
    
    return applications[appIndex]
  },
  
  async createApplication(applicationData) {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const applications = JSON.parse(localStorage.getItem('applications') || '[]')
    const newApplication = {
      id: Date.now().toString(),
      ...applicationData,
      appliedAt: new Date().toISOString(),
      status: 'applied',
      notes: [],
      timeline: [
        { date: new Date().toISOString(), status: 'applied', description: 'Application submitted' }
      ],
      nextAction: {
        description: 'Follow up if no response within a week',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    }
    
    applications.unshift(newApplication)
    localStorage.setItem('applications', JSON.stringify(applications))
    
    return newApplication
  },
  
  async getApplicationStats() {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const applications = JSON.parse(localStorage.getItem('applications') || '[]')
    const stats = {
      total: applications.length,
      applied: applications.filter(app => app.status === 'applied').length,
      interview: applications.filter(app => app.status === 'interview').length,
      offer: applications.filter(app => app.status === 'offer').length,
      hired: applications.filter(app => app.status === 'hired').length,
      rejected: applications.filter(app => app.status === 'rejected').length,
      responseRate: 0,
      averageTimeToResponse: 0,
      upcomingActions: applications.filter(app => app.nextAction && new Date(app.nextAction.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length
    }
    
    // Calculate response rate (interviews + offers + hired / total)
    const responses = stats.interview + stats.offer + stats.hired
    stats.responseRate = stats.total > 0 ? Math.round((responses / stats.total) * 100) : 0
    
    // Mock average time to response (in days)
    stats.averageTimeToResponse = 7
    
    return stats
  },
  
  async getUpcomingActions() {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const applications = JSON.parse(localStorage.getItem('applications') || '[]')
    return applications
      .filter(app => app.nextAction)
      .map(app => ({
        id: app.id,
        jobTitle: app.jobTitle,
        companyName: app.companyName,
        action: app.nextAction.description,
        dueDate: app.nextAction.dueDate,
        priority: app.priority || 'medium',
        overdue: new Date(app.nextAction.dueDate) < new Date()
      }))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }
}

export function useApplicationsQuery(filters = {}) {
  return useQuery({
    queryKey: ['applications', filters],
    queryFn: () => applicationService.getApplications(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export function useUpdateApplicationStatusMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: applicationService.updateApplicationStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['applicationStats'] })
      queryClient.invalidateQueries({ queryKey: ['upcomingActions'] })
    }
  })
}

export function useCreateApplicationMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: applicationService.createApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['applicationStats'] })
    }
  })
}

export function useApplicationStatsQuery() {
  return useQuery({
    queryKey: ['applicationStats'],
    queryFn: applicationService.getApplicationStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUpcomingActionsQuery() {
  return useQuery({
    queryKey: ['upcomingActions'],
    queryFn: applicationService.getUpcomingActions,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

