import * as Sentry from '@sentry/react'
import { isProduction, isDevelopment } from './apiConfig'

// Sentry configuration
export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    if (isDevelopment) {
      console.warn('Sentry DSN not configured - error tracking disabled')
    }
    return
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    
    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    
    // Performance Monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0, // Capture 10% of transactions in production
    
    // Session Replay
    replaysSessionSampleRate: isProduction ? 0.01 : 0.1, // 1% in production, 10% in dev
    replaysOnErrorSampleRate: 1.0, // Always capture replays on errors
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION,
    
    // Filter out known non-critical errors
    beforeSend(event) {
      // Filter out network errors that are expected
      if (event.exception?.values?.[0]?.type === 'NetworkError') {
        return null
      }
      
      // Filter out ResizeObserver errors (common browser quirk)
      if (event.message?.includes('ResizeObserver')) {
        return null
      }
      
      return event
    },
    
    // Additional context
    initialScope: {
      tags: {
        component: 'ai-job-chommie-frontend'
      }
    }
  })
}

// Custom error tracking functions
export function trackError(error, context = {}) {
  Sentry.withScope((scope) => {
    // Add context
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value)
    })
    
    // Capture the error
    Sentry.captureException(error)
  })
}

// Funnel event tracking
export function trackFunnelEvent(event, properties = {}) {
  Sentry.addBreadcrumb({
    message: event,
    category: 'funnel',
    level: 'info',
    data: properties
  })
  
  // Also send as custom event for analytics
  Sentry.captureMessage(`Funnel: ${event}`, {
    level: 'info',
    tags: {
      type: 'funnel_event',
      event: event
    },
    extra: properties
  })
}

// Key funnel events
export const FUNNEL_EVENTS = {
  // Authentication
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  LOGIN_COMPLETED: 'login_completed',
  
  // Job search
  JOB_SEARCH_PERFORMED: 'job_search_performed',
  JOB_VIEWED: 'job_viewed',
  JOB_APPLIED: 'job_applied',
  
  // Alerts
  ALERT_CREATED: 'alert_created',
  ALERT_PREVIEW_VIEWED: 'alert_preview_viewed',
  
  // CV Builder
  CV_BUILDER_OPENED: 'cv_builder_opened',
  CV_TEMPLATE_SELECTED: 'cv_template_selected',
  CV_EXPORTED: 'cv_exported',
  
  // Contact
  CONTACT_FORM_SUBMITTED: 'contact_form_submitted',
  
  // Payments
  PRICING_PAGE_VIEWED: 'pricing_page_viewed',
  PLAN_SELECTED: 'plan_selected',
  PAYMENT_COMPLETED: 'payment_completed',
  
  // Errors
  API_ERROR: 'api_error',
  FORM_VALIDATION_ERROR: 'form_validation_error'
}

// Helper functions for common tracking scenarios
export function trackApiError(endpoint, error, requestData = {}) {
  trackFunnelEvent(FUNNEL_EVENTS.API_ERROR, {
    endpoint,
    error: error.message,
    status: error.status,
    requestData
  })
  
  trackError(error, {
    api: {
      endpoint,
      requestData,
      status: error.status
    }
  })
}

export function trackFormError(formName, errors) {
  trackFunnelEvent(FUNNEL_EVENTS.FORM_VALIDATION_ERROR, {
    form: formName,
    errors
  })
}

export function trackJobApplication(jobId, jobTitle, company) {
  trackFunnelEvent(FUNNEL_EVENTS.JOB_APPLIED, {
    jobId,
    jobTitle,
    company,
    timestamp: new Date().toISOString()
  })
}

export function trackCvExport(templateId, format) {
  trackFunnelEvent(FUNNEL_EVENTS.CV_EXPORTED, {
    templateId,
    format,
    timestamp: new Date().toISOString()
  })
}

// Performance tracking
export function trackPerformance(metric, value, context = {}) {
  Sentry.addBreadcrumb({
    message: `Performance: ${metric}`,
    category: 'performance',
    level: 'info',
    data: {
      metric,
      value,
      ...context
    }
  })
}

// User context helpers
export function setUserContext(user) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    plan: user.plan,
    verified: user.verified
  })
}

export function clearUserContext() {
  Sentry.setUser(null)
}

// Route change tracking
export function trackRouteChange(from, to) {
  Sentry.addBreadcrumb({
    message: `Route change: ${from} → ${to}`,
    category: 'navigation',
    level: 'info'
  })
}

// React Error Boundary component
export const SentryErrorBoundary = Sentry.withErrorBoundary
