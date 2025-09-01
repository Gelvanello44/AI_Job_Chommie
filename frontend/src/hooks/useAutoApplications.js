import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import aiService from '@/services/aiService'

// Auto-Application System - The core differentiator
const autoApplicationService = {
  async getMatchingJobs(userPreferences) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Mock job matching based on user preferences
    const mockJobs = [
      {
        id: 'job-1',
        title: 'Senior React Developer',
        company: 'TechCorp SA',
        location: 'Cape Town, WC',
        workMode: 'Hybrid',
        salary: 'R45,000 - R65,000',
        postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'We are looking for a Senior React Developer with 3+ years of experience in modern web technologies. You will work on cutting-edge projects using React, Node.js, and AWS.',
        requirements: [
          '3+ years React experience',
          'Strong JavaScript fundamentals', 
          'Experience with Node.js',
          'Familiarity with AWS',
          'Agile development experience'
        ],
        companyInfo: {
          industry: 'Technology',
          size: '51-200 employees',
          values: ['Innovation', 'Collaboration', 'Growth Mindset'],
          culture: 'Fast-paced, collaborative environment'
        },
        matchScore: 92,
        aiAnalysis: {
          strengths: ['Excellent technical skill match', 'Strong cultural alignment'],
          concerns: [],
          recommendations: ['Emphasize React portfolio projects', 'Highlight AWS experience']
        }
      },
      {
        id: 'job-2', 
        title: 'Frontend Developer',
        company: 'Digital Solutions',
        location: 'Johannesburg, GP',
        workMode: 'Remote',
        salary: 'R35,000 - R50,000',
        postedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Join our dynamic team as a Frontend Developer. Work with modern frameworks and create exceptional user experiences.',
        requirements: [
          '2+ years frontend experience',
          'React or Vue.js experience',
          'CSS/SASS proficiency',
          'Responsive design skills'
        ],
        companyInfo: {
          industry: 'Digital Services',
          size: '11-50 employees', 
          values: ['Customer Focus', 'Excellence', 'Innovation'],
          culture: 'Creative, flexible work environment'
        },
        matchScore: 87,
        aiAnalysis: {
          strengths: ['Good technical match', 'Remote work preference aligned'],
          concerns: ['Lower salary range'],
          recommendations: ['Highlight responsive design portfolio', 'Show creative problem-solving examples']
        }
      },
      {
        id: 'job-3',
        title: 'Full Stack Developer',
        company: 'StartupCo',
        location: 'Durban, KZN',
        workMode: 'In-office',
        salary: 'R40,000 - R55,000',
        postedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Looking for a versatile Full Stack Developer to join our growing startup. Work across the entire technology stack.',
        requirements: [
          'Full stack development experience',
          'JavaScript, Node.js, React',
          'Database design (SQL/NoSQL)',
          'API development',
          'Startup experience preferred'
        ],
        companyInfo: {
          industry: 'Technology',
          size: '1-10 employees',
          values: ['Innovation', 'Agility', 'Growth Mindset'],
          culture: 'High-energy startup environment'
        },
        matchScore: 78,
        aiAnalysis: {
          strengths: ['Full stack skills match', 'Growth opportunity'],
          concerns: ['Location preference mismatch', 'Startup environment intensity'],
          recommendations: ['Emphasize adaptability', 'Show entrepreneurial mindset']
        }
      }
    ]
    
    // Filter and sort based on user preferences
    let filteredJobs = mockJobs.filter(job => {
      if (userPreferences.locations && userPreferences.locations.length > 0) {
        const jobProvince = job.location.split(', ')[1]
        if (!userPreferences.locations.includes(jobProvince)) return false
      }
      
      if (userPreferences.workModes && userPreferences.workModes.length > 0) {
        if (!userPreferences.workModes.includes(job.workMode)) return false
      }
      
      if (userPreferences.minSalary) {
        const jobMinSalary = parseInt(job.salary.match(/R([\d,]+)/)[1].replace(',', ''))
        if (jobMinSalary < userPreferences.minSalary) return false
      }
      
      return job.matchScore >= (userPreferences.minMatchScore || 70)
    })
    
    // Sort by match score
    filteredJobs.sort((a, b) => b.matchScore - a.matchScore)
    
    return {
      jobs: filteredJobs,
      totalMatches: filteredJobs.length,
      searchCriteria: userPreferences,
      lastUpdated: new Date().toISOString()
    }
  },
  
  async scheduleAutoApplication({ jobId, userId, scheduledFor, customizations }) {
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Get existing scheduled applications
    const scheduled = JSON.parse(localStorage.getItem('scheduledApplications') || '[]')
    
    const newApplication = {
      id: `auto-app-${Date.now()}`,
      jobId,
      userId,
      scheduledFor,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      customizations: {
        coverLetterTone: customizations?.coverLetterTone || 'professional',
        cvOptimizations: customizations?.cvOptimizations || true,
        followUpEnabled: customizations?.followUpEnabled || true,
        personalizedOpening: customizations?.personalizedOpening || true,
        ...customizations
      },
      autoGenerated: true
    }
    
    scheduled.push(newApplication)
    localStorage.setItem('scheduledApplications', JSON.stringify(scheduled))
    
    return newApplication
  },
  
  async processScheduledApplications() {
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const scheduled = JSON.parse(localStorage.getItem('scheduledApplications') || '[]')
    const now = new Date()
    
    const applicationsToProcess = scheduled.filter(app => 
      app.status === 'scheduled' && 
      new Date(app.scheduledFor) <= now
    )
    
    const results = []
    
    for (const application of applicationsToProcess) {
      try {
        // Generate AI-powered application materials
        const result = await this.generateApplicationMaterials(application)
        
        // Simulate sending the application
        const sent = await this.sendApplication(application, result)
        
        // Update application status
        application.status = 'sent'
        application.sentAt = new Date().toISOString()
        application.generatedMaterials = result
        
        results.push({
          success: true,
          application,
          materials: result
        })
        
        // Add to applications tracker
        await this.addToApplicationTracker(application, result)
        
      } catch (error) {
        application.status = 'failed'
        application.error = error.message
        application.failedAt = new Date().toISOString()
        
        results.push({
          success: false,
          application,
          error: error.message
        })
      }
    }
    
    // Update localStorage
    localStorage.setItem('scheduledApplications', JSON.stringify(scheduled))
    
    return {
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }
  },
  
  async generateApplicationMaterials(application) {
    // Get job details and user profile
    const jobDetails = await this.getJobDetails(application.jobId)
    const userProfile = await this.getUserProfile(application.userId)
    const companyInfo = await aiService.analyzeCompanyIntelligence(jobDetails.company)
    
    // Generate cover letter
    const coverLetter = await aiService.generateCoverLetter({
      jobDescription: jobDetails.description,
      userProfile,
      companyInfo,
      jobTitle: jobDetails.title,
      companyName: jobDetails.company
    })
    
    // Optimize CV for this specific role
    const cvOptimization = await aiService.optimizeCV({
      currentCV: userProfile.cv,
      jobDescription: jobDetails.description,
      targetRole: jobDetails.title
    })
    
    // Get success prediction
    const successPrediction = await aiService.predictApplicationSuccess({
      jobDescription: jobDetails.description,
      userProfile,
      applicationHistory: userProfile.applicationHistory,
      companyInfo
    })
    
    return {
      coverLetter,
      cvOptimization,
      successPrediction,
      companyIntelligence: companyInfo,
      generatedAt: new Date().toISOString()
    }
  },
  
  async sendApplication(application, materials) {
    // Simulate sending application
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // In production, this would integrate with job board APIs
    // For now, simulate success/failure
    const success = Math.random() > 0.1 // 90% success rate
    
    if (!success) {
      throw new Error('Failed to submit application to job board')
    }
    
    return {
      submitted: true,
      submittedAt: new Date().toISOString(),
      confirmationId: `CONF-${Date.now()}`,
      jobBoard: 'LinkedIn', // Mock job board
      trackingUrl: `https://linkedin.com/jobs/applications/${Date.now()}`
    }
  },
  
  async addToApplicationTracker(autoApplication, materials) {
    const applications = JSON.parse(localStorage.getItem('applications') || '[]')
    const jobDetails = await this.getJobDetails(autoApplication.jobId)
    
    const trackerApplication = {
      id: `track-${Date.now()}`,
      jobTitle: jobDetails.title,
      companyName: jobDetails.company,
      status: 'applied',
      appliedAt: new Date().toISOString(),
      location: jobDetails.location,
      salaryRange: jobDetails.salary,
      jobType: 'Full-time',
      workMode: jobDetails.workMode,
      notes: [{
        id: `note-${Date.now()}`,
        text: `Auto-applied with AI-generated materials. Success prediction: ${materials.successPrediction.successProbability}%`,
        createdAt: new Date().toISOString()
      }],
      timeline: [
        { 
          date: new Date().toISOString(), 
          status: 'applied', 
          description: 'Auto-application submitted with AI optimization' 
        }
      ],
      nextAction: {
        description: 'Follow up if no response in 7 days',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      source: 'Auto-Application',
      priority: materials.successPrediction.successProbability > 70 ? 'high' : 'medium',
      autoGenerated: true,
      aiMaterials: {
        coverLetterGenerated: true,
        cvOptimized: true,
        successProbability: materials.successPrediction.successProbability
      }
    }
    
    applications.unshift(trackerApplication)
    localStorage.setItem('applications', JSON.stringify(applications))
    
    return trackerApplication
  },
  
  async getJobDetails(jobId) {
    // Mock job details - in production, fetch from job board APIs
    const mockJobs = {
      'job-1': {
        title: 'Senior React Developer',
        company: 'TechCorp SA',
        location: 'Cape Town, WC',
        workMode: 'Hybrid',
        salary: 'R45,000 - R65,000',
        description: 'We are looking for a Senior React Developer with 3+ years of experience...',
        requirements: ['React', 'JavaScript', 'Node.js', 'AWS']
      },
      'job-2': {
        title: 'Frontend Developer',
        company: 'Digital Solutions',
        location: 'Johannesburg, GP',
        workMode: 'Remote',
        salary: 'R35,000 - R50,000',
        description: 'Join our dynamic team as a Frontend Developer...',
        requirements: ['React', 'CSS', 'JavaScript']
      },
      'job-3': {
        title: 'Full Stack Developer',
        company: 'StartupCo',
        location: 'Durban, KZN',
        workMode: 'In-office',
        salary: 'R40,000 - R55,000',
        description: 'Looking for a versatile Full Stack Developer...',
        requirements: ['Full stack', 'JavaScript', 'Node.js', 'React']
      }
    }
    
    return mockJobs[jobId] || mockJobs['job-1']
  },
  
  async getUserProfile(userId) {
    // Mock user profile - in production, fetch from user database
    return {
      id: userId,
      name: 'John Doe',
      email: 'john.doe@email.com',
      skills: ['React', 'JavaScript', 'Node.js', 'Python', 'AWS'],
      topSkills: ['JavaScript', 'React', 'Problem Solving'],
      experience: '3+ years',
      interests: 'Web development and creating user-friendly applications',
      cv: 'Experienced developer with strong background in React and JavaScript...',
      applicationHistory: []
    }
  },
  
  async getScheduledApplications() {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const scheduled = JSON.parse(localStorage.getItem('scheduledApplications') || '[]')
    return scheduled.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
  },
  
  async getAutoApplicationStats() {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const scheduled = JSON.parse(localStorage.getItem('scheduledApplications') || '[]')
    const applications = JSON.parse(localStorage.getItem('applications') || '[]')
    const autoApplications = applications.filter(app => app.autoGenerated)
    
    const stats = {
      totalScheduled: scheduled.filter(app => app.status === 'scheduled').length,
      totalSent: scheduled.filter(app => app.status === 'sent').length,
      totalFailed: scheduled.filter(app => app.status === 'failed').length,
      autoApplications: autoApplications.length,
      successRate: autoApplications.length > 0 ? 
        Math.round((autoApplications.filter(app => ['interview', 'offer', 'hired'].includes(app.status)).length / autoApplications.length) * 100) : 0,
      averageMatchScore: scheduled.length > 0 ? 
        Math.round(scheduled.reduce((sum, app) => sum + (app.matchScore || 75), 0) / scheduled.length) : 0,
      nextScheduled: scheduled.find(app => app.status === 'scheduled' && new Date(app.scheduledFor) > new Date())
    }
    
    return stats
  },
  
  async cancelScheduledApplication(applicationId) {
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const scheduled = JSON.parse(localStorage.getItem('scheduledApplications') || '[]')
    const applicationIndex = scheduled.findIndex(app => app.id === applicationId)
    
    if (applicationIndex !== -1) {
      scheduled[applicationIndex].status = 'cancelled'
      scheduled[applicationIndex].cancelledAt = new Date().toISOString()
      localStorage.setItem('scheduledApplications', JSON.stringify(scheduled))
      return scheduled[applicationIndex]
    }
    
    throw new Error('Application not found')
  }
}

// Custom hooks for auto-application system
export function useMatchingJobsQuery(userPreferences) {
  return useQuery({
    queryKey: ['matchingJobs', userPreferences],
    queryFn: () => autoApplicationService.getMatchingJobs(userPreferences),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!userPreferences
  })
}

export function useScheduleAutoApplicationMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: autoApplicationService.scheduleAutoApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledApplications'] })
      queryClient.invalidateQueries({ queryKey: ['autoApplicationStats'] })
      queryClient.invalidateQueries({ queryKey: ['userQuota'] })
    }
  })
}

export function useProcessScheduledApplicationsMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: autoApplicationService.processScheduledApplications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['scheduledApplications'] })
      queryClient.invalidateQueries({ queryKey: ['autoApplicationStats'] })
    }
  })
}

export function useScheduledApplicationsQuery() {
  return useQuery({
    queryKey: ['scheduledApplications'],
    queryFn: autoApplicationService.getScheduledApplications,
    staleTime: 2 * 60 * 1000 // 2 minutes
  })
}

export function useAutoApplicationStatsQuery() {
  return useQuery({
    queryKey: ['autoApplicationStats'],
    queryFn: autoApplicationService.getAutoApplicationStats,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useCancelScheduledApplicationMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: autoApplicationService.cancelScheduledApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledApplications'] })
      queryClient.invalidateQueries({ queryKey: ['autoApplicationStats'] })
    }
  })
}
