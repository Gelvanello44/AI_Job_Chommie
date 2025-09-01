/**
 * CSRF Protection Middleware
 * Implements comprehensive Cross-Site Request Forgery protection for sensitive endpoints
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { redis } from '../config/redis';

export interface CSRFConfig {
  secretLength: number;
  tokenExpiry: number; // seconds
  cookieName: string;
  headerName: string;
  ignoreMethods: string[];
  exemptPaths: string[];
  saltLength: number;
}

export interface CSRFRequest extends Request {
  csrfToken?: string;
  csrfSecret?: string;
}

class CSRFProtection {
  private config: CSRFConfig;

  constructor(config?: Partial<CSRFConfig>) {
    this.config = {
      secretLength: 32,
      tokenExpiry: 3600, // 1 hour
      cookieName: '_csrf',
      headerName: 'x-csrf-token',
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
      exemptPaths: [
        '/health',
        '/api-docs',
        '/api/v1/webhooks', // Webhooks don't use CSRF tokens
        '/api/v1/auth/login', // Initial login doesn't have token yet
        '/api/v1/auth/register'
      ],
      saltLength: 16,
      ...config
    };
  }

  /**
   * Generate a CSRF secret for the user session
   */
  private generateSecret(): string {
    return crypto.randomBytes(this.config.secretLength).toString('hex');
  }

  /**
   * Generate a CSRF token from a secret
   */
  private generateToken(secret: string): string {
    const salt = crypto.randomBytes(this.config.saltLength).toString('hex');
    const hash = crypto
      .createHmac('sha256', secret)
      .update(salt)
      .digest('hex');
    
    return `${salt}.${hash}`;
  }

  /**
   * Verify a CSRF token against a secret
   */
  private verifyToken(token: string, secret: string): boolean {
    try {
      const [salt, hash] = token.split('.');
      if (!salt || !hash) return false;

      const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(salt)
        .digest('hex');

      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(expectedHash, 'hex')
      );
    } catch (error) {
      logger.warn('CSRF token verification error', { error: error.message });
      return false;
    }
  }

  /**
   * Check if the request should be exempt from CSRF protection
   */
  private isExempt(req: Request): boolean {
    // Check HTTP method
    if (this.config.ignoreMethods.includes(req.method)) {
      return true;
    }

    // Check exempt paths
    const requestPath = req.path;
    return this.config.exemptPaths.some(exemptPath => {
      if (exemptPath.endsWith('*')) {
        return requestPath.startsWith(exemptPath.slice(0, -1));
      }
      return requestPath === exemptPath;
    });
  }

  /**
   * Store CSRF secret in Redis with expiry
   */
  private async storeSecret(userId: string, secret: string): Promise<void> {
    const key = `csrf:secret:${userId}`;
    await redis.setex(key, this.config.tokenExpiry, secret);
  }

  /**
   * Retrieve CSRF secret from Redis
   */
  private async getSecret(userId: string): Promise<string | null> {
    const key = `csrf:secret:${userId}`;
    return await redis.get(key);
  }

  /**
   * Middleware to generate and provide CSRF tokens
   */
  generateToken() {
    return async (req: CSRFRequest, res: Response, next: NextFunction) => {
      try {
        // Only generate tokens for authenticated users
        if (!req.user) {
          return next();
        }

        const userId = req.user.id;
        let secret = await this.getSecret(userId);

        // Generate new secret if none exists or expired
        if (!secret) {
          secret = this.generateSecret();
          await this.storeSecret(userId, secret);
        }

        // Generate token from secret
        const token = this.generateToken(secret);
        
        // Store secret in request for later validation
        req.csrfSecret = secret;
        req.csrfToken = token;

        // Set CSRF token in cookie (httpOnly for security)
        res.cookie(this.config.cookieName, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: this.config.tokenExpiry * 1000
        });

        // Also provide token in response header for SPA usage
        res.setHeader('X-CSRF-Token', token);

        next();
      } catch (error) {
        logger.error('CSRF token generation error', { 
          error: error.message,
          userId: req.user?.id 
        });
        next(error);
      }
    };
  }

  /**
   * Middleware to validate CSRF tokens
   */
  validateToken() {
    return async (req: CSRFRequest, res: Response, next: NextFunction) => {
      try {
        // Skip validation for exempt requests
        if (this.isExempt(req)) {
          return next();
        }

        // Require authentication for CSRF validation
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required for CSRF protection'
            }
          });
        }

        const userId = req.user.id;
        
        // Get token from header, body, or query (in order of preference)
        const token = req.headers[this.config.headerName] as string ||
                     req.body._csrf ||
                     req.query._csrf ||
                     req.cookies[this.config.cookieName];

        if (!token) {
          logger.warn('CSRF token missing', { 
            userId,
            method: req.method,
            path: req.path,
            headers: Object.keys(req.headers)
          });
          
          return res.status(403).json({
            success: false,
            error: {
              code: 'CSRF_TOKEN_MISSING',
              message: 'CSRF token is required',
              details: {
                headerName: this.config.headerName,
                cookieName: this.config.cookieName
              }
            }
          });
        }

        // Get stored secret
        const secret = await this.getSecret(userId);
        if (!secret) {
          logger.warn('CSRF secret not found', { userId });
          
          return res.status(403).json({
            success: false,
            error: {
              code: 'CSRF_SECRET_EXPIRED',
              message: 'CSRF secret has expired, please refresh the page'
            }
          });
        }

        // Validate token
        if (!this.verifyToken(token, secret)) {
          logger.warn('CSRF token validation failed', { 
            userId,
            method: req.method,
            path: req.path,
            tokenProvided: !!token,
            secretExists: !!secret
          });
          
          return res.status(403).json({
            success: false,
            error: {
              code: 'CSRF_TOKEN_INVALID',
              message: 'Invalid CSRF token'
            }
          });
        }

        // Token is valid, proceed
        req.csrfSecret = secret;
        req.csrfToken = token;
        
        logger.debug('CSRF token validated successfully', { 
          userId,
          method: req.method,
          path: req.path 
        });

        next();
      } catch (error) {
        logger.error('CSRF validation error', { 
          error: error.message,
          userId: req.user?.id,
          method: req.method,
          path: req.path
        });
        
        res.status(500).json({
          success: false,
          error: {
            code: 'CSRF_VALIDATION_ERROR',
            message: 'Error validating CSRF token'
          }
        });
      }
    };
  }

  /**
   * Endpoint to get CSRF token for authenticated users
   */
  getTokenEndpoint() {
    return async (req: CSRFRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required to get CSRF token'
            }
          });
        }

        const userId = req.user.id;
        let secret = await this.getSecret(userId);

        if (!secret) {
          secret = this.generateSecret();
          await this.storeSecret(userId, secret);
        }

        const token = this.generateToken(secret);

        res.json({
          success: true,
          data: {
            token,
            expiresIn: this.config.tokenExpiry,
            headerName: this.config.headerName
          }
        });
      } catch (error) {
        logger.error('Error generating CSRF token endpoint', { 
          error: error.message,
          userId: req.user?.id 
        });
        
        res.status(500).json({
          success: false,
          error: {
            code: 'CSRF_TOKEN_GENERATION_ERROR',
            message: 'Error generating CSRF token'
          }
        });
      }
    };
  }

  /**
   * Clear CSRF secret for user (on logout)
   */
  async clearSecret(userId: string): Promise<void> {
    try {
      const key = `csrf:secret:${userId}`;
      await redis.del(key);
      logger.debug('CSRF secret cleared', { userId });
    } catch (error) {
      logger.error('Error clearing CSRF secret', { error: error.message, userId });
    }
  }

  /**
   * Middleware to add CSRF token to response for forms
   */
  addTokenToResponse() {
    return (req: CSRFRequest, res: Response, next: NextFunction) => {
      if (req.csrfToken) {
        res.locals.csrfToken = req.csrfToken;
      }
      next();
    };
  }

  /**
   * Get configuration for debugging
   */
  getConfig(): CSRFConfig {
    return { ...this.config };
  }

  /**
   * Health check for CSRF system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      activeSecrets: number;
      redisConnected: boolean;
      configValid: boolean;
    };
    issues: string[];
  }> {
    try {
      const issues: string[] = [];
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Check Redis connectivity
      const redisConnected = await this.checkRedisConnection();
      if (!redisConnected) {
        issues.push('Redis connection failed');
        status = 'unhealthy';
      }

      // Count active secrets (approximate)
      let activeSecrets = 0;
      try {
        const keys = await redis.keys('csrf:secret:*');
        activeSecrets = keys.length;
      } catch (error) {
        issues.push('Unable to count active CSRF secrets');
        if (status === 'healthy') status = 'degraded';
      }

      // Validate configuration
      const configValid = this.validateConfig();
      if (!configValid) {
        issues.push('Invalid CSRF configuration');
        status = 'unhealthy';
      }

      return {
        status,
        metrics: {
          activeSecrets,
          redisConnected,
          configValid
        },
        issues
      };
    } catch (error) {
      logger.error('CSRF health check error', { error: error.message });
      return {
        status: 'unhealthy',
        metrics: {
          activeSecrets: 0,
          redisConnected: false,
          configValid: false
        },
        issues: ['Health check failed']
      };
    }
  }

  private async checkRedisConnection(): Promise<boolean> {
    try {
      await redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  private validateConfig(): boolean {
    return (
      this.config.secretLength >= 16 &&
      this.config.tokenExpiry > 0 &&
      this.config.saltLength >= 8 &&
      this.config.cookieName.length > 0 &&
      this.config.headerName.length > 0
    );
  }
}

// Create and export CSRF protection instance
export const csrfProtection = new CSRFProtection({
  secretLength: 32,
  tokenExpiry: 3600, // 1 hour
  cookieName: '_csrf',
  headerName: 'x-csrf-token',
  saltLength: 16,
  exemptPaths: [
    '/health',
    '/api-docs',
    '/api/v1/webhooks/*', // All webhook endpoints
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password'
  ]
});

// Export middleware functions
export const generateCSRFToken = csrfProtection.generateToken();
export const validateCSRFToken = csrfProtection.validateToken();
export const addCSRFTokenToResponse = csrfProtection.addTokenToResponse();
export const getCSRFTokenEndpoint = csrfProtection.getTokenEndpoint();

// Export utility functions
export const clearCSRFSecret = (userId: string) => csrfProtection.clearSecret(userId);
export const csrfHealthCheck = () => csrfProtection.healthCheck();

/**
 * CSRF protection for specific route groups
 */
export const csrfProtectPayments = [generateCSRFToken, validateCSRFToken];
export const csrfProtectAuth = [generateCSRFToken, validateCSRFToken];
export const csrfProtectUserData = [generateCSRFToken, validateCSRFToken];

/**
 * Double-submit cookie pattern for additional security
 */
export const doubleSubmitCookie = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (csrfProtection['isExempt'](req)) {
      return next();
    }

    const cookieToken = req.cookies[csrfProtection['config'].cookieName];
    const headerToken = req.headers[csrfProtection['config'].headerName] as string;

    if (!cookieToken || !headerToken) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_DOUBLE_SUBMIT_FAILED',
          message: 'CSRF token required in both cookie and header'
        }
      });
    }

    if (cookieToken !== headerToken) {
      logger.warn('CSRF double-submit mismatch', {
        userId: req.user?.id,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_MISMATCH',
          message: 'CSRF token mismatch between cookie and header'
        }
      });
    }

    next();
  };
};

/**
 * CSRF protection specifically for API endpoints
 */
export const apiCSRFProtection = () => {
  return [
    // Generate token for authenticated users
    (req: Request, res: Response, next: NextFunction) => {
      if (req.user) {
        generateCSRFToken(req, res, next);
      } else {
        next();
      }
    },
    // Validate token for state-changing operations
    validateCSRFToken,
    // Add token to response for frontend consumption
    addCSRFTokenToResponse
  ];
};

/**
 * Enhanced CSRF protection for sensitive operations
 */
export const sensitiveOperationCSRF = () => {
  return [
    generateCSRFToken,
    validateCSRFToken,
    doubleSubmitCookie(),
    // Additional verification for critical operations
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Rate limiting for sensitive operations
        const userId = req.user?.id;
        if (userId) {
          const rateLimitKey = `csrf:sensitive:${userId}`;
          const attempts = await redis.incr(rateLimitKey);
          
          if (attempts === 1) {
            await redis.expire(rateLimitKey, 300); // 5 minutes window
          }
          
          if (attempts > 10) { // Max 10 sensitive operations per 5 minutes
            logger.warn('CSRF sensitive operation rate limit exceeded', {
              userId,
              path: req.path,
              attempts
            });
            
            return res.status(429).json({
              success: false,
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many sensitive operations, please try again later'
              }
            });
          }
        }

        next();
      } catch (error) {
        logger.error('Sensitive operation CSRF check error', { error: error.message });
        next(error);
      }
    }
  ];
};

/**
 * CSRF protection for form submissions
 */
export const formCSRFProtection = () => {
  return [
    generateCSRFToken,
    addCSRFTokenToResponse,
    (req: Request, res: Response, next: NextFunction) => {
      // For form submissions, the token can be in the body
      if (req.method === 'POST' && req.body._csrf) {
        req.headers[csrfProtection['config'].headerName] = req.body._csrf;
      }
      next();
    },
    validateCSRFToken
  ];
};
