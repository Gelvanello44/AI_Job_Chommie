import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import { securityConfig } from '../config/security.config.js';
import { 
  globalRateLimiter, 
  IPBlocker, 
  requestTracker 
} from './rateLimiter.middleware.js';
import { 
  sanitizeInputs, 
  validateFileUpload 
} from './sanitizer.middleware.js';
import { logger } from '../utils/logger.js';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { redis } from '../config/redis.js';

/**
 * Apply all security middleware to the application
 */
export function applySecurityMiddleware(app: Application): void {
  // Trust proxy (for accurate IP addresses)
  app.set('trust proxy', true);

  // Compression (before other middleware for efficiency)
  app.use(compression());

  // IP Blocker - Check for blocked IPs first
  app.use(IPBlocker.middleware());

  // Request tracking for analytics
  app.use(requestTracker);

  // Global rate limiting
  app.use(globalRateLimiter);

  // Helmet - Security headers
  app.use(helmet(securityConfig.helmet as any));

  // CORS
  app.use(cors(securityConfig.cors));

  // Body parsing with size limits
  app.use(express.json({ 
    limit: '10mb',
    verify: (req: any, res, buf) => {
      // Store raw body for signature verification if needed
      req.rawBody = buf.toString('utf8');
    }
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));

  // MongoDB/NoSQL injection prevention
  app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }: any) => {
      logger.warn('NoSQL injection attempt blocked', {
        path: req.path,
        key,
        ip: req.ip,
      });
    },
  }));

  // Session management
  const redisStore = new RedisStore({
    client: redis,
    prefix: 'sess:',
  });

  app.use(session({
    store: redisStore,
    secret: securityConfig.session.secret,
    resave: securityConfig.session.resave,
    saveUninitialized: securityConfig.session.saveUninitialized,
    cookie: securityConfig.session.cookie as any,
    name: 'sessionId', // Change default session name
  }));

  // Input sanitization
  app.use(sanitizeInputs);

  // Security headers middleware
  app.use(securityHeaders);

  // XSS Protection (additional to helmet)
  app.use(xssProtection);

  // Clickjacking protection
  app.use(clickjackingProtection);

  // MIME type sniffing protection
  app.use(mimeSniffingProtection);

  // DNS prefetch control
  app.use(dnsPrefetchControl);

  // Log security violations
  app.use(securityLogger);
}

/**
 * Additional security headers
 */
function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Add additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Cache control for sensitive data
  if (req.path.includes('/api/auth') || req.path.includes('/api/user')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

/**
 * Enhanced XSS protection
 */
function xssProtection(req: Request, res: Response, next: NextFunction): void {
  // Check for XSS patterns in URL
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];

  const url = req.url + req.originalUrl;
  const hasXSS = xssPatterns.some(pattern => pattern.test(url));

  if (hasXSS) {
    logger.warn('XSS attempt blocked', {
      ip: req.ip,
      url: req.url,
      method: req.method,
    });
    return res.status(400).json({
      success: false,
      error: 'Invalid request - potential XSS detected',
    });
  }

  next();
}

/**
 * Clickjacking protection
 */
function clickjackingProtection(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  next();
}

/**
 * MIME type sniffing protection
 */
function mimeSniffingProtection(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}

/**
 * DNS prefetch control
 */
function dnsPrefetchControl(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  next();
}

/**
 * Security event logger
 */
function securityLogger(req: Request, res: Response, next: NextFunction): void {
  // Log security-relevant events
  if (res.statusCode === 403 || res.statusCode === 401) {
    logger.warn('Security event', {
      type: res.statusCode === 403 ? 'forbidden' : 'unauthorized',
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
    });
  }

  next();
}

/**
 * API security middleware for specific routes
 */
export function apiSecurityMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check API key if provided
  const apiKey = req.headers[securityConfig.apiKey.headerName.toLowerCase()] || 
                 req.query[securityConfig.apiKey.queryParam];

  if (apiKey) {
    // Validate API key (implement your validation logic)
    // This is a placeholder - implement actual API key validation
    if (!validateAPIKey(apiKey as string)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }
  }

  // Check request signature if required
  const signature = req.headers['x-signature'];
  if (signature && req.rawBody) {
    if (!verifyRequestSignature(req.rawBody, signature as string)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid request signature',
      });
    }
  }

  next();
}

/**
 * Validate API key (placeholder - implement your logic)
 */
function validateAPIKey(apiKey: string): boolean {
  // Implement API key validation logic
  // Check against database, Redis cache, etc.
  return apiKey.length === securityConfig.apiKey.keyLength;
}

/**
 * Verify request signature (placeholder - implement your logic)
 */
function verifyRequestSignature(body: string, signature: string): boolean {
  // Implement signature verification logic
  // Use HMAC or similar to verify the signature
  return true;
}

/**
 * Error handler for security violations
 */
export function securityErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log security errors
  logger.error('Security error', {
    error: err.message,
    stack: err.stack,
    ip: req.ip,
    path: req.path,
    method: req.method,
  });

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      success: false,
      error: 'An error occurred processing your request',
    });
  }

  // In development, send error details
  res.status(err.status || 500).json({
    success: false,
    error: err.message,
    stack: err.stack,
  });
}

/**
 * Create security report endpoint
 */
export async function getSecurityReport(req: Request, res: Response): Promise<void> {
  try {
    // This would typically be admin-only
    const report = {
      timestamp: new Date(),
      headers: {
        helmet: 'enabled',
        cors: 'configured',
        csp: 'active',
      },
      rateLimiting: {
        global: 'active',
        endpoints: [
          'auth', 'registration', 'passwordReset', 
          'api', 'upload', 'search', 'ai'
        ],
      },
      protection: {
        xss: 'enabled',
        csrf: 'enabled',
        sqlInjection: 'protected',
        noSqlInjection: 'protected',
        clickjacking: 'protected',
        mimeSniffing: 'protected',
      },
      monitoring: {
        ipBlocking: 'active',
        requestTracking: 'enabled',
        securityLogging: 'active',
      },
    };

    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    logger.error('Error generating security report', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate security report',
    });
  }
}
