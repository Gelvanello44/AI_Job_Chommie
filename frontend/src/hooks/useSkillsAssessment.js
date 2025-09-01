import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Mock API service for now - will be replaced with actual backend calls
const skillsAssessmentService = {
  async submitAssessment(data) {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const result = {
      id: Date.now().toString(),
      topSkills: data.topSkills,
      skillScores: data.skillScores,
      answers: data.answers,
      completedAt: new Date().toISOString(),
      nextRetakeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    }
    
    // Store in localStorage for persistence
    const existing = JSON.parse(localStorage.getItem('skillsAssessmentResults') || '[]')
    existing.unshift(result)
    localStorage.setItem('skillsAssessmentResults', JSON.stringify(existing.slice(0, 5))) // Keep last 5 results
    
    return result
  },
  
  async getAssessmentResults() {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const results = JSON.parse(localStorage.getItem('skillsAssessmentResults') || '[]')
    return results
  },
  
  async getAssessmentHistory() {
    // Simulate API call  
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const results = JSON.parse(localStorage.getItem('skillsAssessmentResults') || '[]')
    return results.map(result => ({
      ...result,
      insights: this.generateInsights(result)
    }))
  },
  
  generateInsights(result) {
    const { topSkills, skillScores, completedAt } = result
    
    return {
      strengths: topSkills.map(skill => ({
        skill: skill.label,
        description: this.getSkillDescription(skill.id),
        careerApplications: this.getCareerApplications(skill.id)
      })),
      development: Object.entries(skillScores)
        .filter(([_, score]) => score <= 1)
        .map(([skillId]) => ({
          skill: skillId,
          recommendations: this.getDevelopmentRecommendations(skillId)
        })),
      trends: {
        improvement: this.calculateImprovement(result),
        consistency: this.calculateConsistency(result)
      }
    }
  },
  
  getSkillDescription(skillId) {
    const descriptions = {
      'communication': 'Strong ability to convey ideas clearly and build rapport with others.',
      'technical': 'Proficiency with technology and digital tools essential for modern workplaces.',
      'leadership': 'Natural capacity to guide, motivate, and coordinate team efforts.',
      'problem-solving': 'Analytical mindset with strong critical thinking abilities.',
      'creativity': 'Innovative thinking and ability to generate novel solutions.',
      'adaptability': 'Flexibility to adjust to changing circumstances and learn quickly.',
      'organization': 'Excellent planning and time management capabilities.',
      'analytical': 'Strong research skills and data-driven decision making.'
    }
    return descriptions[skillId] || 'Valuable professional skill'
  },
  
  getCareerApplications(skillId) {
    const applications = {
      'communication': ['Team leadership', 'Client relations', 'Public speaking', 'Training delivery'],
      'technical': ['Digital transformation', 'Process automation', 'Data analysis', 'System optimization'],
      'leadership': ['Team management', 'Project leadership', 'Change management', 'Strategic planning'],
      'problem-solving': ['Process improvement', 'Troubleshooting', 'Innovation projects', 'Quality assurance'],
      'creativity': ['Product development', 'Marketing campaigns', 'Process design', 'User experience'],
      'adaptability': ['Change management', 'Learning new systems', 'Cross-functional projects', 'Agile environments'],
      'organization': ['Project management', 'Event planning', 'Resource coordination', 'Workflow optimization'],
      'analytical': ['Data analysis', 'Research projects', 'Performance metrics', 'Decision support']
    }
    return applications[skillId] || ['Professional development', 'Team collaboration']
  },
  
  getDevelopmentRecommendations(skillId) {
    const recommendations = {
      'communication': ['Practice active listening', 'Join public speaking groups', 'Take presentation skills courses'],
      'technical': ['Enroll in relevant tech courses', 'Practice with digital tools', 'Seek mentorship'],
      'leadership': ['Take leadership training', 'Volunteer for team projects', 'Find a leadership mentor'],
      'problem-solving': ['Practice case studies', 'Learn analytical frameworks', 'Join problem-solving workshops'],
      'creativity': ['Brainstorm regularly', 'Explore new perspectives', 'Take creative thinking courses'],
      'adaptability': ['Embrace change opportunities', 'Learn continuously', 'Practice flexibility exercises'],
      'organization': ['Use planning tools', 'Create structured workflows', 'Practice time management'],
      'analytical': ['Learn data analysis tools', 'Practice research methods', 'Study analytical frameworks']
    }
    return recommendations[skillId] || ['Seek learning opportunities', 'Practice regularly']
  },
  
  calculateImprovement(result) {
    // For now, return mock data - in real implementation would compare with previous results
    return {
      overallTrend: 'positive',
      improvementAreas: ['communication', 'leadership'],
      percentageIncrease: 15
    }
  },
  
  calculateConsistency(result) {
    return {
      consistentStrengths: result.topSkills.slice(0, 2).map(s => s.id),
      emergingStrengths: [result.topSkills[2]?.id].filter(Boolean)
    }
  }
}

export function useSkillsAssessmentMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: skillsAssessmentService.submitAssessment,
    onSuccess: () => {
      // Invalidate and refetch assessment results
      queryClient.invalidateQueries({ queryKey: ['assessmentResults'] })
      queryClient.invalidateQueries({ queryKey: ['assessmentHistory'] })
    }
  })
}

export function useAssessmentResultsQuery() {
  return useQuery({
    queryKey: ['assessmentResults'],
    queryFn: skillsAssessmentService.getAssessmentResults,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useAssessmentHistoryQuery() {
  return useQuery({
    queryKey: ['assessmentHistory'],
    queryFn: skillsAssessmentService.getAssessmentHistory,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useAssessmentInsights() {
  const { data: history } = useAssessmentHistoryQuery()
  
  return {
    data: history?.[0]?.insights || null,
    isLoading: !history,
    hasMultipleResults: history?.length > 1
  }
}
