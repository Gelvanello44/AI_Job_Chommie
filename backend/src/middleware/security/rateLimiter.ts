import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// General API rate limiter
export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please wait before making more requests.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:auth:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: 'Too many authentication attempts, please try again later.'
});

// AI endpoint limiter (more expensive operations)
export const aiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:ai:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each user to 20 AI requests per hour
  keyGenerator: (req) => req.user?.id || req.ip, // Rate limit by user ID if authenticated
  message: 'AI request limit exceeded. Please upgrade your plan for more requests.'
});

// File upload limiter
export const uploadLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:upload:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads per hour
  message: 'Upload limit exceeded. Please try again later.'
});

// Dynamic rate limiting based on user plan
export const dynamicLimiter = (req: any, res: any, next: any) => {
  const userPlan = req.user?.subscriptionPlan || 'free';
  
  const limits = {
    free: { windowMs: 60 * 60 * 1000, max: 50 },
    basic: { windowMs: 60 * 60 * 1000, max: 200 },
    pro: { windowMs: 60 * 60 * 1000, max: 500 },
    enterprise: { windowMs: 60 * 60 * 1000, max: 2000 }
  };

  const planLimit = limits[userPlan] || limits.free;

  const limiter = rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: `rate-limit:dynamic:${userPlan}:`
    }),
    windowMs: planLimit.windowMs,
    max: planLimit.max,
    keyGenerator: (req) => req.user?.id || req.ip,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You have exceeded your ${userPlan} plan limit. Consider upgrading for more requests.`,
        currentPlan: userPlan,
        limit: planLimit.max,
        windowMs: planLimit.windowMs
      });
    }
  });

  limiter(req, res, next);
};
