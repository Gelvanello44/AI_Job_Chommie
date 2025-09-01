// API Configuration for different environments
const API_CONFIGS = {
  development: {
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1',
    useMocks: import.meta.env.VITE_USE_MOCKS === 'true', // Only use mocks if explicitly enabled
  },
  test: {
    baseURL: 'http://localhost:3001/api/v1',
    useMocks: true, // Always use mocks in tests
  },
  production: {
    baseURL: import.meta.env.VITE_API_BASE_URL || 'https://api.aijobchommie.co.za/api/v1',
    useMocks: false, // Never use mocks in production
  }
}

const environment = import.meta.env.MODE || 'development'
export const apiConfig = API_CONFIGS[environment]

// API endpoints configuration
export const API_ENDPOINTS = {
  // Authentication
  auth: {
    login: '/auth/login',
    signup: '/auth/signup',
    logout: '/auth/logout',
    me: '/auth/me',
    refresh: '/auth/refresh',
  },
  
  // Jobs
  jobs: {
    list: '/jobs',
    detail: (id) => `/jobs/${id}`,
    apply: (id) => `/jobs/${id}/apply`,
    search: '/jobs/search',
  },
  
  // User data
  user: {
    profile: '/me/profile',
    applications: '/me/applications',
    preferences: '/me/preferences',
    analytics: '/me/analytics',
    analyticsRoles: '/me/analytics/roles',
    analyticsResponseTime: '/me/analytics/response-time',
  },
  
  // Alerts
  alerts: {
    list: '/me/alerts',
    create: '/me/alerts',
    update: (id) => `/me/alerts/${id}`,
    delete: (id) => `/me/alerts/${id}`,
    preview: (id) => `/me/alerts/${id}/preview`,
  },
  
  // CV Builder
  cv: {
    templates: '/cv/templates',
    export: '/cv/export',
    save: '/cv/save',
  },
  
  // Contact
  contact: {
    submit: '/contact',
  },
  
  // Payments
  payments: {
    plans: '/payments/plans',
    subscribe: '/payments/subscribe',
    cancel: '/payments/cancel',
    usage: '/me/usage',
  }
}

// Helper function to build full API URLs
export function buildApiUrl(endpoint, params = {}) {
  let url = apiConfig.baseURL + endpoint
  
  // Replace path parameters
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, encodeURIComponent(value))
  })
  
  return url
}

// Helper function to build query string
export function buildQueryString(params) {
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v))
      } else {
        searchParams.append(key, value)
      }
    }
  })
  
  return searchParams.toString()
}

// Environment helpers
export const isDevelopment = environment === 'development'
export const isProduction = environment === 'production'
export const isTest = environment === 'test'
export const shouldUseMocks = apiConfig.useMocks

// API client configuration
export const API_CLIENT_CONFIG = {
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}
