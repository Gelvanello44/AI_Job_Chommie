import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { CaptureConsole } from '@sentry/integrations';

/**
 * Sentry Configuration for React Application
 * Provides comprehensive error tracking and performance monitoring
 */

const initSentry = () => {
  const environment = process.env.REACT_APP_ENV || 'development';
  const dsn = process.env.REACT_APP_SENTRY_DSN;

  if (!dsn && environment === 'production') {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      new BrowserTracing({
        // Set tracing origins to track specific domains
        tracingOrigins: [
          'localhost',
          process.env.REACT_APP_API_URL,
          /^\//
        ],
        // Track user interactions
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        ),
      }),
      new CaptureConsole({
        levels: ['error', 'warn']
      }),
      new Sentry.Replay({
        // Mask sensitive text content
        maskAllText: true,
        maskAllInputs: true,
        // Capture replays on errors
        sessionSampleRate: 0.1,
        errorSampleRate: 1.0,
      })
    ],

    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Release tracking
    release: process.env.REACT_APP_VERSION || '1.0.0',
    
    // User context
    initialScope: {
      tags: {
        component: 'frontend',
        version: process.env.REACT_APP_VERSION
      }
    },

    // Filtering
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Facebook related
      'fb_xd_fragment',
      // Network errors
      'NetworkError',
      'Network request failed',
      // Safari specific
      'Non-Error promise rejection'
    ],

    beforeSend(event, hint) {
      // Filter out specific errors
      if (event.exception) {
        const error = hint.originalException;
        
        // Filter out cancelled requests
        if (error?.name === 'AbortError') {
          return null;
        }

        // Add user context if available
        const user = getUserContext();
        if (user) {
          event.user = {
            id: user.id,
            email: user.email,
            username: user.username
          };
        }

        // Add custom context
        event.contexts = {
          ...event.contexts,
          custom: {
            buildTime: process.env.REACT_APP_BUILD_TIME,
            feature_flags: getFeatureFlags(),
            api_version: process.env.REACT_APP_API_VERSION
          }
        };
      }

      // Don't send events in development unless explicitly enabled
      if (environment === 'development' && !process.env.REACT_APP_SENTRY_DEBUG) {
        console.log('Sentry Event (dev mode):', event);
        return null;
      }

      return event;
    },

    beforeSendTransaction(transaction) {
      // Add custom transaction data
      transaction.tags = {
        ...transaction.tags,
        user_tier: getUserTier(),
        feature_area: getFeatureArea(transaction.transaction)
      };

      return transaction;
    }
  });

  // Set initial user context
  const user = getUserContext();
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
      ip_address: '{{auto}}'
    });
  }
};

/**
 * Capture custom error with context
 */
export const captureError = (error, context = {}) => {
  Sentry.withScope((scope) => {
    // Set error level
    scope.setLevel(context.level || 'error');
    
    // Set custom tags
    if (context.tags) {
      Object.keys(context.tags).forEach(key => {
        scope.setTag(key, context.tags[key]);
      });
    }
    
    // Set extra context
    if (context.extra) {
      Object.keys(context.extra).forEach(key => {
        scope.setExtra(key, context.extra[key]);
      });
    }
    
    // Set user context
    if (context.user) {
      scope.setUser(context.user);
    }
    
    // Capture the error
    Sentry.captureException(error);
  });
};

/**
 * Capture custom message
 */
export const captureMessage = (message, level = 'info', context = {}) => {
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    
    if (context.tags) {
      Object.keys(context.tags).forEach(key => {
        scope.setTag(key, context.tags[key]);
      });
    }
    
    if (context.extra) {
      Object.keys(context.extra).forEach(key => {
        scope.setExtra(key, context.extra[key]);
      });
    }
    
    Sentry.captureMessage(message, level);
  });
};

/**
 * Track custom performance transaction
 */
export const trackTransaction = (name, operation, callback) => {
  const transaction = Sentry.startTransaction({
    name,
    op: operation
  });
  
  Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));
  
  try {
    const result = callback(transaction);
    
    if (result instanceof Promise) {
      return result.finally(() => {
        transaction.finish();
      });
    }
    
    transaction.finish();
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    transaction.finish();
    throw error;
  }
};

/**
 * Create breadcrumb for user actions
 */
export const addBreadcrumb = (message, category = 'user', data = {}) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
    timestamp: Date.now() / 1000
  });
};

/**
 * Profile a React component
 */
export const withProfiler = (Component, name) => {
  return Sentry.withProfiler(Component, { name });
};

/**
 * Error Boundary component
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    Sentry.withScope((scope) => {
      scope.setExtras(errorInfo);
      scope.setTag('component', this.props.name || 'Unknown');
      Sentry.captureException(error);
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * React Router Error Handler
 */
export const routeErrorHandler = (error, errorInfo) => {
  console.error('Route Error:', error, errorInfo);
  
  Sentry.withScope((scope) => {
    scope.setTag('error_boundary', 'router');
    scope.setContext('errorInfo', errorInfo);
    Sentry.captureException(error);
  });
};

/**
 * API Error Handler
 */
export const handleApiError = (error, endpoint, method) => {
  const context = {
    tags: {
      api_endpoint: endpoint,
      api_method: method,
      status_code: error.response?.status
    },
    extra: {
      request_data: error.config?.data,
      response_data: error.response?.data,
      headers: error.config?.headers
    }
  };
  
  captureError(error, context);
};

// Helper functions
const getUserContext = () => {
  // Get user from your auth system
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

const getUserTier = () => {
  const user = getUserContext();
  return user?.subscription?.tier || 'free';
};

const getFeatureFlags = () => {
  // Get feature flags from your feature flag system
  return {
    new_dashboard: true,
    beta_features: false
  };
};

const getFeatureArea = (transaction) => {
  if (transaction.includes('/dashboard')) return 'dashboard';
  if (transaction.includes('/billing')) return 'billing';
  if (transaction.includes('/settings')) return 'settings';
  return 'general';
};

export default initSentry;
