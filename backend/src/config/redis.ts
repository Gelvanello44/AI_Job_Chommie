import { Redis } from 'ioredis';
import { redisConfig, bullRedisConfig } from './index.js';

/**
 * Main Redis client for caching and sessions
 */
export const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  username: redisConfig.username || 'default',
  password: redisConfig.password,
  db: redisConfig.db,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

/**
 * Bull Queue Redis client
 */
export const bullRedis = new Redis({
  host: bullRedisConfig.host,
  port: bullRedisConfig.port,
  username: bullRedisConfig.username || 'default',
  password: bullRedisConfig.password,
  maxRetriesPerRequest: null, // Required for Bull
  enableReadyCheck: false,
});

// Redis event handlers
redis.on('connect', () => {
  console.log(' Redis connected successfully');
});

redis.on('error', (err: Error) => {
  console.error(' Redis connection error:', err);
});

redis.on('close', () => {
  console.log(' Redis connection closed');
});

bullRedis.on('connect', () => {
  console.log(' Bull Redis connected successfully');
});

bullRedis.on('error', (err: Error) => {
  console.error(' Bull Redis connection error:', err);
});

/**
 * Cache wrapper with TTL
 */
export class CacheManager {
  private static instance: CacheManager;
  private defaultTTL = 3600; // 1 hour

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      if (ttl) {
        await redis.setex(key, ttl, stringValue);
      } else {
        await redis.setex(key, this.defaultTTL, stringValue);
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string | string[]): Promise<void> {
    try {
      if (Array.isArray(key)) {
        await redis.del(...key);
      } else {
        await redis.del(key);
      }
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error(`Cache clear pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }
}

/**
 * Session store for Express
 */
export const createSessionStore = () => {
  const RedisStore = require('connect-redis').default;
  return new RedisStore({
    client: redis,
    prefix: 'sess:',
    ttl: 86400, // 1 day
  });
};

/**
 * Rate limiter store
 */
export const createRateLimiterStore = () => {
  const RedisStore = require('rate-limit-redis').default;
  return new RedisStore({
    client: redis,
    prefix: 'rl:',
  });
};

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

export const cache = CacheManager.getInstance();

export default redis;
