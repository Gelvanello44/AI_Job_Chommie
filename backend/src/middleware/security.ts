/**
 * Security Middleware Index
 * Centralized export of all security middleware components for easy integration
 */

import { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

// Import all security middleware
import { sslMiddleware, httpsRedirect, enforceSecureHeaders } from './ssl';
import { csrfProtection, generateCSRFToken } from './csrf';
import { sanitizeInput, detectThreats, validateFileUploads } from './xss';
import { ddosProtection } from './ddos-protection';
import { wafProtection } from './waf';
import { apiKeyValidation } from './api-key-rotation';

// Import security service
import { getSecurityStatus } from '../services/security.service';
import { logger } from '../utils/logger';

/**
 * Core security middleware configuration
 */
export const coreSecurityMiddleware = [
  // Basic security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        workerSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Allow for development
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }),

  // CORS configuration
  cors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com', 'https://www.yourdomain.com']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    exposedHeaders: ['X-CSRF-Token']
  }),

  // Compression
  compression({
    filter: (req: Request, res: Response) => {
      // Don't compress responses if the client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Use compression filter function
      return compression.filter(req, res);
    },
    level: 6,
    threshold: 1024
  })
];

/**
 * Advanced security middleware stack
 */
export const advancedSecurityMiddleware = [
  // SSL/TLS protection
  sslMiddleware,
  httpsRedirect,
  enforceSecureHeaders,

  // DDoS protection (first line of defense)
  ddosProtection,

  // Web Application Firewall
  wafProtection,

  // CSRF protection
  csrfProtection,

  // XSS protection
  sanitizeInput,
  detectThreats,

  // API key validation (for API endpoints)
  apiKeyValidation
];

/**
 * Security middleware for file uploads
 */
export const fileUploadSecurityMiddleware = [
  validateFileUploads
];

/**
 * Complete security middleware stack
 */
export const securityMiddleware = [
  ...coreSecurityMiddleware,
  ...advancedSecurityMiddleware
];

/**
 * Apply security middleware to Express app
 * @param app Express application instance
 * @param options Security configuration options
 */
export function applySecurity(app: Express, options: SecurityOptions = {}) {
  const {
    enableSSL = true,
    enableDDoSProtection = true,
    enableWAF = true,
    enableCSRF = true,
    enableXSS = true,
    enableAPIKeyRotation = false, // Disabled by default for regular routes
    customMiddleware = [],
    skipHealthCheck = false
  } = options;

  logger.info('Applying security middleware', { 
    enableSSL, 
    enableDDoSProtection, 
    enableWAF, 
    enableCSRF, 
    enableXSS,
    enableAPIKeyRotation
  });

  // Apply core security first
  app.use(...coreSecurityMiddleware);

  // Apply SSL/TLS if enabled
  if (enableSSL) {
    app.use(sslMiddleware);
    app.use(httpsRedirect);
    app.use(enforceSecureHeaders);
  }

  // Apply DDoS protection if enabled
  if (enableDDoSProtection) {
    app.use(ddosProtection);
  }

  // Apply WAF protection if enabled
  if (enableWAF) {
    app.use(wafProtection);
  }

  // Apply CSRF protection if enabled
  if (enableCSRF) {
    app.use(csrfProtection);
  }

  // Apply XSS protection if enabled
  if (enableXSS) {
    app.use(sanitizeInput);
    app.use(detectThreats);
  }

  // Apply API key validation if enabled
  if (enableAPIKeyRotation) {
    app.use('/api/', apiKeyValidation);
  }

  // Apply custom middleware
  if (customMiddleware.length > 0) {
    app.use(...customMiddleware);
  }

  // Security health check endpoint (unless skipped)
  if (!skipHealthCheck) {
    app.get('/security/health-check', async (req: Request, res: Response) => {
      try {
        const status = await getSecurityStatus();
        res.json({
          success: true,
          data: status,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Security health check failed', { error });
        res.status(500).json({
          success: false,
          error: {
            code: 'HEALTH_CHECK_FAILED',
            message: 'Security health check failed'
          }
        });
      }
    });
  }

  logger.info('Security middleware applied successfully');
}

/**
 * Security middleware for specific route protection
 */
export const protectSensitiveRoute = [
  csrfProtection,
  sanitizeInput,
  detectThreats,
  (req: Request, res: Response, next: NextFunction) => {
    // Additional logging for sensitive routes
    logger.info('Sensitive route accessed', {
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    next();
  }
];

/**
 * Security middleware for API endpoints
 */
export const protectAPIRoute = [
  ddosProtection,
  wafProtection,
  apiKeyValidation,
  sanitizeInput
];

/**
 * Security middleware for file upload endpoints
 */
export const protectFileUpload = [
  ddosProtection,
  wafProtection,
  validateFileUploads,
  sanitizeInput,
  detectThreats
];

/**
 * Emergency security middleware (maximum protection)
 */
export const emergencySecurityMiddleware = [
  // Enhanced DDoS protection
  (req: Request, res: Response, next: NextFunction) => {
    req.securityLevel = 'EMERGENCY';
    next();
  },
  ddosProtection,
  wafProtection,
  csrfProtection,
  sanitizeInput,
  detectThreats,
  
  // Additional emergency checks
  (req: Request, res: Response, next: NextFunction) => {
    // Check if system is in emergency mode
    if (req.path.startsWith('/api/') && req.method !== 'GET') {
      // More strict validation in emergency mode
      if (!req.headers['x-csrf-token'] && req.method !== 'GET') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'EMERGENCY_MODE_CSRF_REQUIRED',
            message: 'CSRF token required during emergency mode'
          }
        });
      }
    }
    next();
  }
];

/**
 * Security configuration options
 */
export interface SecurityOptions {
  enableSSL?: boolean;
  enableDDoSProtection?: boolean;
  enableWAF?: boolean;
  enableCSRF?: boolean;
  enableXSS?: boolean;
  enableAPIKeyRotation?: boolean;
  customMiddleware?: any[];
  skipHealthCheck?: boolean;
}

/**
 * Security metrics collection middleware
 */
export const securityMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Track request
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const isSecurityEndpoint = req.path.startsWith('/api/v1/security/');
    
    // Log security-related metrics
    if (isSecurityEndpoint || req.securityLevel) {
      logger.info('Security request completed', {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        securityLevel: req.securityLevel || 'STANDARD',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id
      });
    }
  });

  next();
};

/**
 * Security error handler
 */
export const securityErrorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  // Handle security-specific errors
  if (error.type === 'SECURITY_ERROR') {
    logger.error('Security error occurred', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    });

    return res.status(error.statusCode || 403).json({
      success: false,
      error: {
        code: error.code || 'SECURITY_ERROR',
        message: error.message || 'A security error occurred'
      }
    });
  }

  // Pass non-security errors to next handler
  next(error);
};

/**
 * Development security middleware (less strict for development)
 */
export const developmentSecurityMiddleware = [
  ...coreSecurityMiddleware,
  // Less strict versions for development
  (req: Request, res: Response, next: NextFunction) => {
    // Skip some security checks in development
    if (process.env.NODE_ENV === 'development') {
      req.developmentMode = true;
    }
    next();
  },
  sanitizeInput,
  detectThreats
];

/**
 * Initialize security system
 */
export async function initializeSecurity(app: Express, options: SecurityOptions = {}) {
  try {
    logger.info('Initializing security system...');

    // Apply security middleware
    applySecurity(app, options);

    // Add metrics collection
    app.use(securityMetricsMiddleware);

    // Add security error handler
    app.use(securityErrorHandler);

    // Verify security status
    const status = await getSecurityStatus();
    
    if (status.overallStatus === 'unhealthy') {
      logger.warn('Security system initialized with unhealthy components', { status });
    } else {
      logger.info('Security system initialized successfully', { 
        overallStatus: status.overallStatus,
        components: Object.keys(status.components || {}).length
      });
    }

    return { success: true, status };
  } catch (error) {
    logger.error('Failed to initialize security system', { error });
    throw error;
  }
}

// Export individual components for selective use
export {
  sslMiddleware,
  httpsRedirect,
  enforceSecureHeaders,
  csrfProtection,
  generateCSRFToken,
  sanitizeInput,
  detectThreats,
  validateFileUploads,
  ddosProtection,
  wafProtection,
  apiKeyValidation
};

// Export security service functions
export {
  getSecurityStatus,
  generateSecurityReport,
  performSecurityMaintenance,
  activateEmergencyMode,
  deactivateEmergencyMode,
  handleSecurityIncident,
  getComprehensiveSecurityMetrics
} from '../services/security.service';
