import * as Sentry from '@sentry/node';
// import { nodeProfilingIntegration } from '@sentry/profiling-node';

export const initSentry = (): void => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      // HTTP Tracing
      Sentry.httpIntegration(),
      // Express.js Integration
      Sentry.expressIntegration(),
      // Performance Profiling - Disabled for compatibility
      // nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Profile Sample Rate (CPU profiling)
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Release tracking
    release: process.env.APP_VERSION || '1.0.0',
    
    // Initial scope with useful tags
    initialScope: {
      tags: {
        component: 'backend',
        framework: 'express',
        language: 'typescript',
        service: 'ai-job-chommie-api',
      },
    },
    
    // Advanced configuration
    beforeSend(event, _hint) {
      // Filter out common development errors in production
      if (process.env.NODE_ENV === 'production') {
        // Filter out ECONNRESET errors (common in HTTP requests)
        if (event.exception?.values?.[0]?.value?.includes('ECONNRESET')) {
          return null;
        }
        
        // Filter out timeout errors for external services
        if (event.exception?.values?.[0]?.value?.includes('timeout')) {
          return null;
        }
      }
      
      return event;
    },
    
    // Custom fingerprinting for better error grouping
    beforeSendTransaction(event) {
      // Don't send health check transactions to reduce noise
      if (event.transaction === 'GET /health' || event.transaction === 'GET /api/health') {
        return null;
      }
      
      return event;
    },
  });
};

// Export Sentry for use in other modules
export { Sentry };

// Utility functions for manual error tracking
export const captureError = (error: Error, context?: Record<string, any>, user?: any) => {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('additional_context', context);
      Object.keys(context).forEach((key) => {
        scope.setTag(key, context[key]);
      });
    }
    
    if (user) {
      scope.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    }
    
    Sentry.captureException(error);
  });
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('message_context', context);
    }
    Sentry.captureMessage(message, level);
  });
};

export const addBreadcrumb = (message: string, category: string, data?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
};

export const setUserContext = (user: { id: string; email?: string; username?: string }) => {
  Sentry.setUser(user);
};

export const clearUserContext = () => {
  Sentry.setUser(null);
};
