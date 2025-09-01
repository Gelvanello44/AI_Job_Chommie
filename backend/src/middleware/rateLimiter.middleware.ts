import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis.js';
import { securityConfig } from '../config/security.config.js';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Create a rate limiter with Redis store
 */
function createRateLimiter(options: any) {
  const baseOptions = {
    store: new RedisStore({
      client: redis,
      prefix: 'rl:',
    }),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      // Log rate limit violations
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        headers: req.headers,
      });
      
      res.status(429).json({
        success: false,
        error: options.message || 'Too many requests, please try again later.',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    },
    ...options,
  };

  return rateLimit(baseOptions);
}

/**
 * Global rate limiter - applies to all routes
 */
export const globalRateLimiter = createRateLimiter(securityConfig.rateLimit.global);

/**
 * Authentication rate limiter - stricter limits for auth endpoints
 */
export const authRateLimiter = createRateLimiter({
  ...securityConfig.rateLimit.auth,
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Registration rate limiter
 */
export const registrationRateLimiter = createRateLimiter(securityConfig.rateLimit.registration);

/**
 * Password reset rate limiter
 */
export const passwordResetRateLimiter = createRateLimiter(securityConfig.rateLimit.passwordReset);

/**
 * API rate limiter - for general API endpoints
 */
export const apiRateLimiter = createRateLimiter(securityConfig.rateLimit.api);

/**
 * Upload rate limiter - for file upload endpoints
 */
export const uploadRateLimiter = createRateLimiter(securityConfig.rateLimit.upload);

/**
 * Search rate limiter
 */
export const searchRateLimiter = createRateLimiter(securityConfig.rateLimit.search);

/**
 * AI rate limiter - for expensive AI/ML operations
 */
export const aiRateLimiter = createRateLimiter(securityConfig.rateLimit.ai);

/**
 * Dynamic rate limiter based on user role
 */
export function dynamicRateLimiter(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user) {
    // Apply default rate limit for unauthenticated users
    return apiRateLimiter(req, res, next);
  }

  // Different limits based on user role
  let limits;
  switch (user.role) {
    case 'ADMIN':
      // Admins get higher limits
      limits = {
        windowMs: 1 * 60 * 1000,
        max: 200,
        message: 'Admin rate limit exceeded',
      };
      break;
    case 'EMPLOYER':
      // Employers get moderate limits
      limits = {
        windowMs: 1 * 60 * 1000,
        max: 100,
        message: 'Employer rate limit exceeded',
      };
      break;
    case 'JOB_SEEKER':
    default:
      // Job seekers get standard limits
      limits = {
        windowMs: 1 * 60 * 1000,
        max: 60,
        message: 'Rate limit exceeded',
      };
      break;
  }

  const limiter = createRateLimiter(limits);
  return limiter(req, res, next);
}

/**
 * IP-based blocking for suspicious activity
 */
export class IPBlocker {
  private static blockedIPs: Map<string, number> = new Map();
  private static failedAttempts: Map<string, number> = new Map();

  /**
   * Track failed attempt from an IP
   */
  static trackFailedAttempt(ip: string) {
    const attempts = this.failedAttempts.get(ip) || 0;
    this.failedAttempts.set(ip, attempts + 1);

    // Block IP after threshold
    if (attempts + 1 >= securityConfig.monitoring.blockAfterFailures) {
      this.blockIP(ip);
      this.failedAttempts.delete(ip);
    }

    // Clear attempts after tracking window
    setTimeout(() => {
      this.failedAttempts.delete(ip);
    }, securityConfig.monitoring.trackingWindow);
  }

  /**
   * Block an IP address
   */
  static blockIP(ip: string) {
    const blockUntil = Date.now() + securityConfig.monitoring.blockDuration;
    this.blockedIPs.set(ip, blockUntil);
    
    logger.warn('IP blocked due to suspicious activity', { ip, blockUntil: new Date(blockUntil) });

    // Store in Redis for distributed blocking
    redis.setex(
      `blocked:${ip}`,
      Math.floor(securityConfig.monitoring.blockDuration / 1000),
      blockUntil.toString()
    );
  }

  /**
   * Check if an IP is blocked
   */
  static async isBlocked(ip: string): Promise<boolean> {
    // Check local cache
    const localBlock = this.blockedIPs.get(ip);
    if (localBlock && localBlock > Date.now()) {
      return true;
    } else if (localBlock) {
      this.blockedIPs.delete(ip);
    }

    // Check Redis
    const redisBlock = await redis.get(`blocked:${ip}`);
    if (redisBlock) {
      const blockUntil = parseInt(redisBlock);
      if (blockUntil > Date.now()) {
        this.blockedIPs.set(ip, blockUntil);
        return true;
      }
    }

    return false;
  }

  /**
   * Middleware to check for blocked IPs
   */
  static middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.connection.remoteAddress || '';
      
      if (await IPBlocker.isBlocked(ip)) {
        logger.warn('Blocked IP attempted access', { ip, path: req.path });
        return res.status(403).json({
          success: false,
          error: 'Access denied. Your IP has been temporarily blocked due to suspicious activity.',
        });
      }

      next();
    };
  }

  /**
   * Clear failed attempts for an IP (e.g., after successful login)
   */
  static clearFailedAttempts(ip: string) {
    this.failedAttempts.delete(ip);
  }
}

/**
 * Request rate tracking for analytics
 */
export class RateTracker {
  /**
   * Track request for analytics
   */
  static async trackRequest(req: Request) {
    const key = `stats:requests:${new Date().toISOString().slice(0, 10)}`;
    const field = `${req.method}:${req.path}`;
    
    try {
      await redis.hincrby(key, field, 1);
      await redis.expire(key, 30 * 24 * 60 * 60); // Keep for 30 days
    } catch (error) {
      logger.error('Failed to track request', error);
    }
  }

  /**
   * Get request statistics
   */
  static async getStats(date?: string) {
    const key = `stats:requests:${date || new Date().toISOString().slice(0, 10)}`;
    
    try {
      const stats = await redis.hgetall(key);
      return stats;
    } catch (error) {
      logger.error('Failed to get request stats', error);
      return {};
    }
  }
}

/**
 * Middleware to track all requests
 */
export function requestTracker(req: Request, res: Response, next: NextFunction) {
  RateTracker.trackRequest(req).catch(console.error);
  next();
}
