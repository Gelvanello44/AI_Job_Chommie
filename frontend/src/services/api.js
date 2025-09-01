// Main API Service for AI Job Chommie
// This file provides all the API calls needed by the frontend components

import { apiGet, apiPost, apiPut, apiDelete } from '../lib/apiClient'
import { API_ENDPOINTS } from '../lib/apiConfig'

// Token management
let authToken = localStorage.getItem('authToken')

export const setAuthToken = (token) => {
  authToken = token
  if (token) {
    localStorage.setItem('authToken', token)
  } else {
    localStorage.removeItem('authToken')
  }
}

export const getAuthToken = () => authToken

// Add auth header to all requests
const getAuthHeaders = () => {
  const headers = {}
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  return headers
}

// ==================== Authentication API ====================
export const authAPI = {
  async login(email, password) {
    const response = await apiPost(API_ENDPOINTS.auth.login, { email, password })
    if (response.token) {
      setAuthToken(response.token)
    }
    return response
  },

  async signup(userData) {
    const response = await apiPost(API_ENDPOINTS.auth.signup, userData)
    if (response.token) {
      setAuthToken(response.token)
    }
    return response
  },

  async logout() {
    try {
      await apiPost(API_ENDPOINTS.auth.logout, null, {
        headers: getAuthHeaders()
      })
    } finally {
      setAuthToken(null)
    }
  },

  async getCurrentUser() {
    return apiGet(API_ENDPOINTS.auth.me, {}, {
      headers: getAuthHeaders()
    })
  },

  async refreshToken() {
    const response = await apiPost(API_ENDPOINTS.auth.refresh, null, {
      headers: getAuthHeaders()
    })
    if (response.token) {
      setAuthToken(response.token)
    }
    return response
  },

  async forgotPassword(email) {
    return apiPost('/auth/forgot-password', { email })
  },

  async resetPassword(token, password) {
    return apiPost('/auth/reset-password', { token, password })
  },

  async verifyEmail(token) {
    return apiPost('/auth/verify-email', { token })
  }
}

// ==================== Jobs API ====================
export const jobsAPI = {
  async getJobs(params = {}) {
    return apiGet(API_ENDPOINTS.jobs.list, params, {
      headers: getAuthHeaders()
    })
  },

  async getJobById(id) {
    return apiGet(API_ENDPOINTS.jobs.detail(id), {}, {
      headers: getAuthHeaders()
    })
  },

  async searchJobs(searchParams) {
    return apiGet(API_ENDPOINTS.jobs.search, searchParams, {
      headers: getAuthHeaders()
    })
  },

  async applyToJob(jobId, applicationData) {
    return apiPost(API_ENDPOINTS.jobs.apply(jobId), applicationData, {
      headers: getAuthHeaders()
    })
  },

  async saveJob(jobId) {
    return apiPost(`/jobs/${jobId}/save`, null, {
      headers: getAuthHeaders()
    })
  },

  async unsaveJob(jobId) {
    return apiDelete(`/jobs/${jobId}/save`, {
      headers: getAuthHeaders()
    })
  },

  async getSavedJobs() {
    return apiGet('/jobs/saved', {}, {
      headers: getAuthHeaders()
    })
  }
}

// ==================== User Profile API ====================
export const userAPI = {
  async getProfile() {
    return apiGet(API_ENDPOINTS.user.profile, {}, {
      headers: getAuthHeaders()
    })
  },

  async updateProfile(profileData) {
    return apiPut(API_ENDPOINTS.user.profile, profileData, {
      headers: getAuthHeaders()
    })
  },

  async uploadResume(file) {
    const formData = new FormData()
    formData.append('resume', file)
    
    return fetch(`${import.meta.env.VITE_API_BASE_URL}/user/resume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    }).then(res => res.json())
  },

  async getApplications() {
    return apiGet(API_ENDPOINTS.user.applications, {}, {
      headers: getAuthHeaders()
    })
  },

  async getPreferences() {
    return apiGet(API_ENDPOINTS.user.preferences, {}, {
      headers: getAuthHeaders()
    })
  },

  async updatePreferences(preferences) {
    return apiPut(API_ENDPOINTS.user.preferences, preferences, {
      headers: getAuthHeaders()
    })
  },

  async getAnalytics(params = {}) {
    return apiGet(API_ENDPOINTS.user.analytics, params, {
      headers: getAuthHeaders()
    })
  },

  async deleteAccount() {
    return apiDelete('/user/account', {
      headers: getAuthHeaders()
    })
  }
}

// ==================== Applications API ====================
export const applicationsAPI = {
  async getApplications(params = {}) {
    return apiGet('/applications', params, {
      headers: getAuthHeaders()
    })
  },

  async getApplicationById(id) {
    return apiGet(`/applications/${id}`, {}, {
      headers: getAuthHeaders()
    })
  },

  async updateApplication(id, data) {
    return apiPut(`/applications/${id}`, data, {
      headers: getAuthHeaders()
    })
  },

  async withdrawApplication(id) {
    return apiDelete(`/applications/${id}`, {
      headers: getAuthHeaders()
    })
  },

  async getApplicationStatus(id) {
    return apiGet(`/applications/${id}/status`, {}, {
      headers: getAuthHeaders()
    })
  }
}

// ==================== CV Builder API ====================
export const cvAPI = {
  async getTemplates() {
    return apiGet(API_ENDPOINTS.cv.templates, {}, {
      headers: getAuthHeaders()
    })
  },

  async saveCV(cvData) {
    return apiPost(API_ENDPOINTS.cv.save, cvData, {
      headers: getAuthHeaders()
    })
  },

  async exportCV(format = 'pdf', templateId) {
    return apiPost(API_ENDPOINTS.cv.export, {
      format,
      templateId
    }, {
      headers: getAuthHeaders()
    })
  },

  async parseResume(file) {
    const formData = new FormData()
    formData.append('file', file)
    
    return fetch(`${import.meta.env.VITE_API_BASE_URL}/cv/parse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    }).then(res => res.json())
  },

  async getCVScore(cvData, jobDescription) {
    return apiPost('/cv/score', {
      cv: cvData,
      jobDescription
    }, {
      headers: getAuthHeaders()
    })
  }
}

// ==================== Alerts API ====================
export const alertsAPI = {
  async getAlerts() {
    return apiGet(API_ENDPOINTS.alerts.list, {}, {
      headers: getAuthHeaders()
    })
  },

  async createAlert(alertData) {
    return apiPost(API_ENDPOINTS.alerts.create, alertData, {
      headers: getAuthHeaders()
    })
  },

  async updateAlert(id, alertData) {
    return apiPut(API_ENDPOINTS.alerts.update(id), alertData, {
      headers: getAuthHeaders()
    })
  },

  async deleteAlert(id) {
    return apiDelete(API_ENDPOINTS.alerts.delete(id), {
      headers: getAuthHeaders()
    })
  },

  async previewAlert(id) {
    return apiGet(API_ENDPOINTS.alerts.preview(id), {}, {
      headers: getAuthHeaders()
    })
  },

  async testAlert(id) {
    return apiPost(`/alerts/${id}/test`, null, {
      headers: getAuthHeaders()
    })
  }
}

// ==================== Payment API ====================
export const paymentAPI = {
  async getPlans() {
    return apiGet(API_ENDPOINTS.payments.plans)
  },

  async subscribe(planId, paymentMethod) {
    return apiPost(API_ENDPOINTS.payments.subscribe, {
      planId,
      paymentMethod
    }, {
      headers: getAuthHeaders()
    })
  },

  async cancelSubscription() {
    return apiPost(API_ENDPOINTS.payments.cancel, null, {
      headers: getAuthHeaders()
    })
  },

  async getUsage() {
    return apiGet(API_ENDPOINTS.payments.usage, {}, {
      headers: getAuthHeaders()
    })
  },

  async getBillingHistory() {
    return apiGet('/payments/history', {}, {
      headers: getAuthHeaders()
    })
  },

  async updatePaymentMethod(paymentMethod) {
    return apiPut('/payments/method', paymentMethod, {
      headers: getAuthHeaders()
    })
  }
}

// ==================== AI Services API ====================
export const aiAPI = {
  async generateCoverLetter(jobData) {
    return apiPost('/ai/cover-letter', jobData, {
      headers: getAuthHeaders()
    })
  },

  async optimizeCV(cvData, jobDescription) {
    return apiPost('/ai/optimize-cv', {
      cv: cvData,
      jobDescription
    }, {
      headers: getAuthHeaders()
    })
  },

  async matchJobs(profile) {
    return apiPost('/ai/match-jobs', profile, {
      headers: getAuthHeaders()
    })
  },

  async predictSuccess(jobId) {
    return apiPost(`/ai/predict-success/${jobId}`, null, {
      headers: getAuthHeaders()
    })
  },

  async getCareerAdvice(profile) {
    return apiPost('/ai/career-advice', profile, {
      headers: getAuthHeaders()
    })
  },

  async analyzeSkillsGap(jobDescription) {
    return apiPost('/ai/skills-gap', {
      jobDescription
    }, {
      headers: getAuthHeaders()
    })
  }
}

// ==================== Company API ====================
export const companyAPI = {
  async searchCompanies(query) {
    return apiGet('/companies/search', { q: query }, {
      headers: getAuthHeaders()
    })
  },

  async getCompanyById(id) {
    return apiGet(`/companies/${id}`, {}, {
      headers: getAuthHeaders()
    })
  },

  async getCompanyReviews(id) {
    return apiGet(`/companies/${id}/reviews`, {}, {
      headers: getAuthHeaders()
    })
  },

  async getCompanyJobs(id) {
    return apiGet(`/companies/${id}/jobs`, {}, {
      headers: getAuthHeaders()
    })
  }
}

// ==================== Notifications API ====================
export const notificationsAPI = {
  async getNotifications(params = {}) {
    return apiGet('/notifications', params, {
      headers: getAuthHeaders()
    })
  },

  async markAsRead(id) {
    return apiPut(`/notifications/${id}/read`, null, {
      headers: getAuthHeaders()
    })
  },

  async markAllAsRead() {
    return apiPut('/notifications/read-all', null, {
      headers: getAuthHeaders()
    })
  },

  async deleteNotification(id) {
    return apiDelete(`/notifications/${id}`, {
      headers: getAuthHeaders()
    })
  },

  async getPreferences() {
    return apiGet('/notifications/preferences', {}, {
      headers: getAuthHeaders()
    })
  },

  async updatePreferences(preferences) {
    return apiPut('/notifications/preferences', preferences, {
      headers: getAuthHeaders()
    })
  }
}

// ==================== Skills Assessment API ====================
export const skillsAPI = {
  async getAssessments() {
    return apiGet('/skills/assessments', {}, {
      headers: getAuthHeaders()
    })
  },

  async startAssessment(skillId) {
    return apiPost(`/skills/assessments/${skillId}/start`, null, {
      headers: getAuthHeaders()
    })
  },

  async submitAssessment(assessmentId, answers) {
    return apiPost(`/skills/assessments/${assessmentId}/submit`, {
      answers
    }, {
      headers: getAuthHeaders()
    })
  },

  async getResults(assessmentId) {
    return apiGet(`/skills/assessments/${assessmentId}/results`, {}, {
      headers: getAuthHeaders()
    })
  },

  async getCertificate(assessmentId) {
    return apiGet(`/skills/assessments/${assessmentId}/certificate`, {}, {
      headers: getAuthHeaders()
    })
  }
}

// ==================== Contact API ====================
export const contactAPI = {
  async submitContact(contactData) {
    return apiPost(API_ENDPOINTS.contact.submit, contactData)
  },

  async submitFeedback(feedback) {
    return apiPost('/contact/feedback', feedback, {
      headers: getAuthHeaders()
    })
  }
}

// ==================== Admin API ====================
export const adminAPI = {
  async getStats() {
    return apiGet('/admin/stats', {}, {
      headers: getAuthHeaders()
    })
  },

  async getUsers(params = {}) {
    return apiGet('/admin/users', params, {
      headers: getAuthHeaders()
    })
  },

  async updateUser(userId, userData) {
    return apiPut(`/admin/users/${userId}`, userData, {
      headers: getAuthHeaders()
    })
  },

  async deleteUser(userId) {
    return apiDelete(`/admin/users/${userId}`, {
      headers: getAuthHeaders()
    })
  },

  async getJobs(params = {}) {
    return apiGet('/admin/jobs', params, {
      headers: getAuthHeaders()
    })
  },

  async approveJob(jobId) {
    return apiPut(`/admin/jobs/${jobId}/approve`, null, {
      headers: getAuthHeaders()
    })
  },

  async rejectJob(jobId, reason) {
    return apiPut(`/admin/jobs/${jobId}/reject`, { reason }, {
      headers: getAuthHeaders()
    })
  }
}

// Export everything as default for easy importing
export default {
  auth: authAPI,
  jobs: jobsAPI,
  user: userAPI,
  applications: applicationsAPI,
  cv: cvAPI,
  alerts: alertsAPI,
  payment: paymentAPI,
  ai: aiAPI,
  company: companyAPI,
  notifications: notificationsAPI,
  skills: skillsAPI,
  contact: contactAPI,
  admin: adminAPI,
  setAuthToken,
  getAuthToken
}
