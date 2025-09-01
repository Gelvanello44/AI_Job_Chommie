/**
 * Advanced Rate Limiting Middleware
 * Implements sophisticated rate limiting using Redis with subscription-aware limits,
 * sliding window algorithm, and comprehensive monitoring
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis.js';
import logger from '../config/logger.js';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

// Subscription tier rate limits configuration
const SUBSCRIPTION_LIMITS = {
  FREE: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstLimit: 10,
  },
  BASIC: {
    requestsPerMinute: 120,
    requestsPerHour: 3000,
    requestsPerDay: 50000,
    burstLimit: 20,
  },
  PROFESSIONAL: {
    requestsPerMinute: 300,
    requestsPerHour: 10000,
    requestsPerDay: 200000,
    burstLimit: 50,
  },
  ENTERPRISE: {
    requestsPerMinute: 1000,
    requestsPerHour: 50000,
    requestsPerDay: 1000000,
    burstLimit: 100,
  },
};

// Rate limiting windows
const WINDOWS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
};

/**
 * Advanced rate limiter with subscription-aware limits
 */
export function createAdvancedRateLimiter(config: {
  windowMs: number;
  defaultMax: number;
  subscriptionMultiplier?: boolean;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  prefix?: string;
  customLimits?: Record<string, number>;
}) {
  const store = new RedisStore({
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
    prefix: config.prefix || 'rl:advanced:',
  });
  
  return rateLimit({
    windowMs: config.windowMs,
    max: async (req: Request) => {
      // Get user subscription tier
      const user = (req as any).user;
      if (!user) {
        return config.defaultMax;
      }
      
      // Apply subscription-based limits
      if (config.subscriptionMultiplier) {
        const subscriptionTier = user.subscription?.plan || 'FREE';
        const tierLimits = SUBSCRIPTION_LIMITS[subscriptionTier as keyof typeof SUBSCRIPTION_LIMITS];
        
        // Determine which limit to use based on window
        if (config.windowMs <= WINDOWS.MINUTE) {
          return tierLimits.requestsPerMinute;
        } else if (config.windowMs <= WINDOWS.HOUR) {
          return tierLimits.requestsPerHour;
        } else {
          return tierLimits.requestsPerDay;
        }
      }
      
      // Check for custom limits based on user ID or other criteria
      if (config.customLimits) {
        const customKey = config.keyGenerator ? config.keyGenerator(req) : user.id;
        return config.customLimits[customKey] || config.defaultMax;
      }
      
      return config.defaultMax;
    },
    keyGenerator: config.keyGenerator || ((req: Request) => {
      const user = (req as any).user;
      return user?.id || req.ip || 'unknown';
    }),
    store,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    handler: (req: Request, res: Response) => {
      const user = (req as any).user;
      
      logger.warn('Advanced rate limit exceeded', {
        userId: user?.id,
        subscriptionTier: user?.subscription?.plan,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
      });
      
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.round(config.windowMs / 1000),
        limit: 'subscription-based',
        timestamp: new Date().toISOString(),
      });
    },
  });
}

/**
 * Sliding window rate limiter implementation
 */
export class SlidingWindowRateLimiter {
  private redis: any;
  private windowSize: number;
  private maxRequests: number;
  private keyPrefix: string;
  
  constructor(options: {
    windowSize: number;
    maxRequests: number;
    keyPrefix?: string;
  }) {
    this.redis = redis;
    this.windowSize = options.windowSize;
    this.maxRequests = options.maxRequests;
    this.keyPrefix = options.keyPrefix || 'sliding_window:';
  }
  
  async checkLimit(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    const redisKey = `${this.keyPrefix}${key}`;
    
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.multi();
      
      // Remove old entries outside the window
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      
      // Count current requests in window
      pipeline.zcard(redisKey);
      
      // Add current request
      pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
      
      // Set expiration
      pipeline.expire(redisKey, Math.ceil(this.windowSize / 1000));
      
      const results = await pipeline.exec();
      const currentCount = results[1][1] as number;
      
      const allowed = currentCount < this.maxRequests;
      const remaining = Math.max(0, this.maxRequests - currentCount - (allowed ? 1 : 0));
      const resetTime = now + this.windowSize;
      
      return { allowed, remaining, resetTime };
    } catch (error) {
      logger.error('Sliding window rate limiter error', error);
      // Fail open - allow request if Redis is down
      return { allowed: true, remaining: this.maxRequests, resetTime: now + this.windowSize };
    }
  }
  
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      const key = user?.id || req.ip || 'unknown';
      
      const result = await this.checkLimit(key);
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': this.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      });
      
      if (!result.allowed) {
        logger.warn('Sliding window rate limit exceeded', {
          userId: user?.id,
          ip: req.ip,
          endpoint: req.originalUrl,
          remaining: result.remaining,
        });
        
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.round((result.resetTime - Date.now()) / 1000),
          remaining: result.remaining,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      
      next();
    };
  }
}

// Function to create rate limiter with Redis store
export function rateLimiter(options: any = {}) {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100,
    message: options.message || {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req: any) => req.ip || 'unknown'),
    store: new RedisStore({
      sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
      prefix: options.prefix || 'rl:default:',
    }),
    handler: options.handler || ((req: any, res: any) => {
      logger.warn('Rate limit exceeded', { 
        ip: req.ip || 'unknown', 
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl 
      });
      res.status(429).json({
        success: false,
        message: 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString(),
      });
    })
  });
}

// Default rate limiter - 100 requests per 15 minutes
export const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
    prefix: 'rl:general:',
  }),
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl 
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    });
  }
});

// Strict rate limiter for sensitive operations - 10 requests per hour
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many sensitive requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
    prefix: 'rl:strict:',
  }),
  handler: (req, res) => {
    logger.warn('Strict rate limit exceeded', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl 
    });
    res.status(429).json({
      success: false,
      message: 'Too many sensitive requests, please try again later.'
    });
  }
});

// API rate limiter for authenticated users - 200 requests per 15 minutes
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: {
    success: false,
    message: 'API rate limit exceeded, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
    prefix: 'rl:api:',
  }),
  keyGenerator: (req) => {
    // Use user ID if available, otherwise fall back to IP
    return (req as any).user?.id || req.ip || 'unknown';
  },
  handler: (req, res) => {
    logger.warn('API rate limit exceeded', { 
      userId: (req as any).user?.id,
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl 
    });
    res.status(429).json({
      success: false,
      message: 'API rate limit exceeded, please try again later.'
    });
  }
});

// Auth rate limiter - 5 login attempts per 15 minutes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
    prefix: 'rl:auth:',
  }),
  keyGenerator: (req) => {
    // Use email from request body if available for login attempts
    return req.body?.email || req.ip || 'unknown';
  },
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', { 
      email: req.body?.email,
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl 
    });
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.'
    });
  }
});

/**
 * Subscription-aware rate limiters
 */
export const subscriptionRateLimiters = {
  // Minute-based rate limiting with subscription tiers
  perMinute: createAdvancedRateLimiter({
    windowMs: WINDOWS.MINUTE,
    defaultMax: 60,
    subscriptionMultiplier: true,
    prefix: 'rl:sub:minute:',
  }),
  
  // Hour-based rate limiting with subscription tiers
  perHour: createAdvancedRateLimiter({
    windowMs: WINDOWS.HOUR,
    defaultMax: 1000,
    subscriptionMultiplier: true,
    prefix: 'rl:sub:hour:',
  }),
  
  // Daily rate limiting with subscription tiers
  perDay: createAdvancedRateLimiter({
    windowMs: WINDOWS.DAY,
    defaultMax: 10000,
    subscriptionMultiplier: true,
    prefix: 'rl:sub:day:',
  }),
};

/**
 * Burst protection rate limiter
 */
export const burstProtectionLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const subscriptionTier = user?.subscription?.plan || 'FREE';
  const tierLimits = SUBSCRIPTION_LIMITS[subscriptionTier as keyof typeof SUBSCRIPTION_LIMITS];
  
  const slidingLimiter = new SlidingWindowRateLimiter({
    windowSize: 10 * 1000, // 10 seconds
    maxRequests: tierLimits.burstLimit,
    keyPrefix: 'burst:',
  });
  
  const burstMiddleware = slidingLimiter.middleware();
  return burstMiddleware(req, res, next);
};

/**
 * Feature-specific rate limiters
 */
export const featureRateLimiters = {
  // File upload rate limiting
  fileUpload: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    store: new RedisStore({
      sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
      prefix: 'rl:upload:',
    }),
    keyGenerator: (req) => (req as any).user?.id || req.ip || 'unknown',
    message: {
      success: false,
      error: 'File upload rate limit exceeded',
      retryAfter: 60,
    },
  }),
  
  // Email sending rate limiting
  emailSending: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    store: new RedisStore({
      sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
      prefix: 'rl:email:',
    }),
    keyGenerator: (req) => (req as any).user?.id || req.ip || 'unknown',
    message: {
      success: false,
      error: 'Email rate limit exceeded',
      retryAfter: 3600,
    },
  }),
  
  // AI/ML API rate limiting
  aiApi: createAdvancedRateLimiter({
    windowMs: WINDOWS.HOUR,
    defaultMax: 100,
    subscriptionMultiplier: true,
    prefix: 'rl:ai:',
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
  }),
  
  // Search API rate limiting
  search: createAdvancedRateLimiter({
    windowMs: WINDOWS.MINUTE,
    defaultMax: 30,
    subscriptionMultiplier: true,
    prefix: 'rl:search:',
  }),
  
  // Payment operations rate limiting
  payment: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    store: new RedisStore({
      sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
      prefix: 'rl:payment:',
    }),
    keyGenerator: (req) => (req as any).user?.id || req.ip || 'unknown',
    message: {
      success: false,
      error: 'Payment rate limit exceeded for security',
      retryAfter: 60,
    },
  }),
};

/**
 * Dynamic rate limiter that adjusts based on system load
 */
export class AdaptiveRateLimiter {
  private baseLimit: number;
  private keyPrefix: string;
  private redis: any;
  
  constructor(options: {
    baseLimit: number;
    keyPrefix?: string;
  }) {
    this.baseLimit = options.baseLimit;
    this.keyPrefix = options.keyPrefix || 'adaptive:';
    this.redis = redis;
  }
  
  async getSystemLoad(): Promise<number> {
    try {
      // Get system metrics from Redis (you could also use system metrics)
      const activeConnections = await this.redis.get('system:active_connections') || 0;
      const cpuUsage = await this.redis.get('system:cpu_usage') || 0;
      
      // Calculate load factor (0.5 to 2.0)
      const loadFactor = Math.max(0.5, Math.min(2.0, (activeConnections / 1000) + (cpuUsage / 100)));
      return loadFactor;
    } catch (error) {
      logger.error('Error getting system load', error);
      return 1.0; // Default load factor
    }
  }
  
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const loadFactor = await this.getSystemLoad();
      const adjustedLimit = Math.floor(this.baseLimit / loadFactor);
      
      const dynamicLimiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: adjustedLimit,
        store: new RedisStore({
          sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
          prefix: this.keyPrefix,
        }),
        keyGenerator: (req) => (req as any).user?.id || req.ip || 'unknown',
        handler: (req, res) => {
          logger.warn('Adaptive rate limit exceeded', {
            userId: (req as any).user?.id,
            ip: req.ip,
            adjustedLimit,
            loadFactor,
            endpoint: req.originalUrl,
          });
          
          res.status(429).json({
            success: false,
            error: 'Rate limit exceeded (adaptive)',
            retryAfter: 60,
            systemLoad: loadFactor,
            timestamp: new Date().toISOString(),
          });
        },
      });
      
      return dynamicLimiter(req, res, next);
    };
  }
}

/**
 * Rate limit bypass for whitelisted IPs/users
 */
export const createBypassableRateLimiter = (limiter: any, bypassList: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const ip = req.ip;
    
    // Check if user or IP is whitelisted
    const shouldBypass = bypassList.includes(user?.id) || 
                        bypassList.includes(ip) || 
                        user?.role === 'ADMIN' ||
                        user?.role === 'SYSTEM';
    
    if (shouldBypass) {
      logger.info('Rate limit bypassed', {
        userId: user?.id,
        ip,
        reason: 'whitelisted',
        endpoint: req.originalUrl,
      });
      return next();
    }
    
    return limiter(req, res, next);
  };
};

/**
 * Rate limit monitoring and alerting
 */
export const rateLimitMonitor = {
  async getStats(timeRange: 'hour' | 'day' | 'week' = 'hour'): Promise<any> {
    const now = Date.now();
    let windowStart: number;
    
    switch (timeRange) {
      case 'hour':
        windowStart = now - WINDOWS.HOUR;
        break;
      case 'day':
        windowStart = now - WINDOWS.DAY;
        break;
      case 'week':
        windowStart = now - (7 * WINDOWS.DAY);
        break;
    }
    
    try {
      const keys = await redis.keys('rl:*');
      const stats: any = {
        totalKeys: keys.length,
        timeRange,
        timestamp: new Date().toISOString(),
      };
      
      // Get detailed stats for each rate limiter
      for (const key of keys.slice(0, 100)) { // Limit to prevent performance issues
        const ttl = await redis.ttl(key);
        const type = await redis.type(key);
        stats[key] = { ttl, type };
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting rate limit stats', error);
      return { error: 'Unable to retrieve stats' };
    }
  },
  
  async clearUserLimits(userId: string): Promise<void> {
    try {
      const userKeys = await redis.keys(`*:${userId}`);
      if (userKeys.length > 0) {
        await redis.del(...userKeys);
        logger.info('Cleared rate limits for user', { userId, keysCleared: userKeys.length });
      }
    } catch (error) {
      logger.error('Error clearing user rate limits', error);
    }
  },
  
  async alertOnHighUsage(threshold: number = 0.8): Promise<void> {
    try {
      const keys = await redis.keys('rl:*');
      
      for (const key of keys) {
        const info = await redis.get(`${key}:info`);
        if (info) {
          const usage = JSON.parse(info);
          if (usage.current / usage.limit > threshold) {
            logger.warn('High rate limit usage detected', {
              key,
              usage: `${usage.current}/${usage.limit}`,
              percentage: (usage.current / usage.limit * 100).toFixed(2),
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error checking rate limit usage', error);
    }
  },
};

/**
 * Middleware to add rate limit headers to all responses
 */
export const addRateLimitHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Add standard rate limit headers
  res.set({
    'X-RateLimit-Policy': 'subscription-based',
    'X-RateLimit-Window': '15min',
  });
  
  next();
};

export default rateLimiter;
