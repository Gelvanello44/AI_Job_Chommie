/**
 * DDoS Protection Middleware
 * Implements advanced rate limiting, request throttling, IP-based blocking, and DDoS detection
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export interface DDoSConfig {
  enabled: boolean;
  globalRateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  perIPRateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  burstProtection: {
    windowMs: number;
    maxBurst: number;
  };
  suspiciousThresholds: {
    requestsPerSecond: number;
    uniqueEndpoints: number;
    errorRate: number;
  };
  blockDuration: number;
  whitelistedIPs: string[];
  trustedProxies: string[];
  enableGeolocation: boolean;
  maxConcurrentConnections: number;
  adaptiveThresholds: boolean;
}

export interface DDoSRequest extends Request {
  ddosInfo?: {
    isBlocked: boolean;
    isSuspicious: boolean;
    riskScore: number;
    blockReason?: string;
  };
}

export interface ThreatMetrics {
  requestCount: number;
  errorCount: number;
  uniqueEndpoints: Set<string>;
  userAgents: Set<string>;
  lastRequestTime: number;
  averageResponseTime: number;
  geoLocation?: string;
}

class DDoSProtectionManager {
  private config: DDoSConfig;
  private connectionCounts: Map<string, number> = new Map();
  private threatMetrics: Map<string, ThreatMetrics> = new Map();
  private adaptiveBaseline: Map<string, number> = new Map();

  constructor(config?: Partial<DDoSConfig>) {
    this.config = {
      enabled: true,
      globalRateLimit: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 1000
      },
      perIPRateLimit: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100
      },
      burstProtection: {
        windowMs: 1000, // 1 second
        maxBurst: 20
      },
      suspiciousThresholds: {
        requestsPerSecond: 10,
        uniqueEndpoints: 50,
        errorRate: 0.5 // 50%
      },
      blockDuration: 15 * 60, // 15 minutes in seconds
      whitelistedIPs: [
        '127.0.0.1',
        '::1',
        ...(process.env.WHITELISTED_IPS || '').split(',').filter(Boolean)
      ],
      trustedProxies: [
        '127.0.0.1',
        '::1',
        ...(process.env.TRUSTED_PROXIES || '').split(',').filter(Boolean)
      ],
      enableGeolocation: false,
      maxConcurrentConnections: 1000,
      adaptiveThresholds: true,
      ...config
    };

    this.startMetricsCleanup();
    this.initializeAdaptiveBaseline();
  }

  /**
   * Get client IP address considering proxies
   */
  private getClientIP(req: Request): string {
    // Check X-Forwarded-For header
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      const ips = forwardedFor.split(',').map(ip => ip.trim());
      return ips[0];
    }

    // Check X-Real-IP header
    const realIP = req.headers['x-real-ip'] as string;
    if (realIP) {
      return realIP;
    }

    // Check CF-Connecting-IP (Cloudflare)
    const cfIP = req.headers['cf-connecting-ip'] as string;
    if (cfIP) {
      return cfIP;
    }

    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Check if IP is whitelisted
   */
  private isWhitelisted(ip: string): boolean {
    return this.config.whitelistedIPs.includes(ip);
  }

  /**
   * Check if IP is currently blocked
   */
  private async isIPBlocked(ip: string): Promise<{ blocked: boolean; reason?: string; expiresAt?: Date }> {
    try {
      const blockKey = `ddos:blocked:${ip}`;
      const blockData = await redis.get(blockKey);
      
      if (blockData) {
        const parsed = JSON.parse(blockData);
        return {
          blocked: true,
          reason: parsed.reason,
          expiresAt: new Date(parsed.expiresAt)
        };
      }

      return { blocked: false };
    } catch (error) {
      logger.error('Error checking IP block status', { ip, error: error.message });
      return { blocked: false };
    }
  }

  /**
   * Block an IP address
   */
  private async blockIP(ip: string, reason: string, duration?: number): Promise<void> {
    try {
      const blockDuration = duration || this.config.blockDuration;
      const expiresAt = new Date(Date.now() + (blockDuration * 1000));
      
      const blockData = {
        reason,
        blockedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        ip
      };

      const blockKey = `ddos:blocked:${ip}`;
      await redis.setex(blockKey, blockDuration, JSON.stringify(blockData));

      logger.warn('IP address blocked', { ip, reason, duration: blockDuration, expiresAt });

      // Track blocked IPs count
      const statsKey = 'ddos:stats:blocked_ips';
      await redis.incr(statsKey);
      await redis.expire(statsKey, 24 * 60 * 60); // 24 hours

    } catch (error) {
      logger.error('Error blocking IP', { ip, reason, error: error.message });
    }
  }

  /**
   * Check rate limits for IP
   */
  private async checkRateLimits(ip: string): Promise<{
    allowed: boolean;
    limits: {
      global: { current: number; max: number; resetTime: number };
      perIP: { current: number; max: number; resetTime: number };
      burst: { current: number; max: number; resetTime: number };
    };
  }> {
    const now = Date.now();
    
    // Global rate limit
    const globalKey = 'ddos:global:requests';
    const globalCurrent = await redis.incr(globalKey);
    if (globalCurrent === 1) {
      await redis.expire(globalKey, Math.ceil(this.config.globalRateLimit.windowMs / 1000));
    }
    const globalResetTime = now + this.config.globalRateLimit.windowMs;

    // Per-IP rate limit
    const ipKey = `ddos:ip:${ip}:requests`;
    const ipCurrent = await redis.incr(ipKey);
    if (ipCurrent === 1) {
      await redis.expire(ipKey, Math.ceil(this.config.perIPRateLimit.windowMs / 1000));
    }
    const ipResetTime = now + this.config.perIPRateLimit.windowMs;

    // Burst protection
    const burstKey = `ddos:ip:${ip}:burst`;
    const burstCurrent = await redis.incr(burstKey);
    if (burstCurrent === 1) {
      await redis.expire(burstKey, Math.ceil(this.config.burstProtection.windowMs / 1000));
    }
    const burstResetTime = now + this.config.burstProtection.windowMs;

    const limits = {
      global: { current: globalCurrent, max: this.config.globalRateLimit.maxRequests, resetTime: globalResetTime },
      perIP: { current: ipCurrent, max: this.config.perIPRateLimit.maxRequests, resetTime: ipResetTime },
      burst: { current: burstCurrent, max: this.config.burstProtection.maxBurst, resetTime: burstResetTime }
    };

    const allowed = globalCurrent <= this.config.globalRateLimit.maxRequests &&
                   ipCurrent <= this.config.perIPRateLimit.maxRequests &&
                   burstCurrent <= this.config.burstProtection.maxBurst;

    return { allowed, limits };
  }

  /**
   * Update threat metrics for IP
   */
  private updateThreatMetrics(ip: string, req: Request, isError: boolean = false): void {
    if (!this.threatMetrics.has(ip)) {
      this.threatMetrics.set(ip, {
        requestCount: 0,
        errorCount: 0,
        uniqueEndpoints: new Set(),
        userAgents: new Set(),
        lastRequestTime: Date.now(),
        averageResponseTime: 0
      });
    }

    const metrics = this.threatMetrics.get(ip)!;
    metrics.requestCount++;
    metrics.uniqueEndpoints.add(req.path);
    metrics.userAgents.add(req.headers['user-agent'] || 'unknown');
    
    if (isError) {
      metrics.errorCount++;
    }

    metrics.lastRequestTime = Date.now();
  }

  /**
   * Calculate risk score for IP
   */
  private calculateRiskScore(ip: string): number {
    const metrics = this.threatMetrics.get(ip);
    if (!metrics) return 0;

    let riskScore = 0;
    const now = Date.now();
    const timeDiff = (now - metrics.lastRequestTime) / 1000; // seconds

    // Request rate scoring
    const requestsPerSecond = metrics.requestCount / Math.max(timeDiff, 1);
    if (requestsPerSecond > this.config.suspiciousThresholds.requestsPerSecond) {
      riskScore += 30;
    }

    // Error rate scoring
    const errorRate = metrics.errorCount / Math.max(metrics.requestCount, 1);
    if (errorRate > this.config.suspiciousThresholds.errorRate) {
      riskScore += 25;
    }

    // Unique endpoints scoring (possible reconnaissance)
    if (metrics.uniqueEndpoints.size > this.config.suspiciousThresholds.uniqueEndpoints) {
      riskScore += 20;
    }

    // User agent diversity (potential bot activity)
    if (metrics.userAgents.size === 1 && metrics.requestCount > 50) {
      riskScore += 15; // Same user agent for many requests
    }

    // No user agent (common in automated attacks)
    if (metrics.userAgents.has('unknown') || metrics.userAgents.has('')) {
      riskScore += 10;
    }

    return Math.min(riskScore, 100);
  }

  /**
   * DDoS protection middleware
   */
  protect() {
    return async (req: DDoSRequest, res: Response, next: NextFunction) => {
      try {
        if (!this.config.enabled) {
          return next();
        }

        const clientIP = this.getClientIP(req);
        const startTime = Date.now();

        // Skip whitelisted IPs
        if (this.isWhitelisted(clientIP)) {
          return next();
        }

        // Check if IP is blocked
        const blockStatus = await this.isIPBlocked(clientIP);
        if (blockStatus.blocked) {
          logger.warn('Blocked IP attempted access', {
            ip: clientIP,
            reason: blockStatus.reason,
            path: req.path,
            userAgent: req.headers['user-agent']
          });

          return res.status(429).json({
            success: false,
            error: {
              code: 'IP_BLOCKED',
              message: 'Your IP address has been temporarily blocked',
              details: {
                reason: blockStatus.reason,
                expiresAt: blockStatus.expiresAt
              }
            }
          });
        }

        // Check rate limits
        const rateLimitResult = await this.checkRateLimits(clientIP);
        if (!rateLimitResult.allowed) {
          // Determine which limit was exceeded
          let limitType = 'unknown';
          let resetTime = 0;

          if (rateLimitResult.limits.burst.current > rateLimitResult.limits.burst.max) {
            limitType = 'burst';
            resetTime = rateLimitResult.limits.burst.resetTime;
          } else if (rateLimitResult.limits.perIP.current > rateLimitResult.limits.perIP.max) {
            limitType = 'per_ip';
            resetTime = rateLimitResult.limits.perIP.resetTime;
          } else if (rateLimitResult.limits.global.current > rateLimitResult.limits.global.max) {
            limitType = 'global';
            resetTime = rateLimitResult.limits.global.resetTime;
          }

          // Set rate limit headers
          res.setHeader('X-RateLimit-Limit', rateLimitResult.limits.perIP.max);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitResult.limits.perIP.max - rateLimitResult.limits.perIP.current));
          res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

          logger.warn('Rate limit exceeded', {
            ip: clientIP,
            limitType,
            limits: rateLimitResult.limits,
            path: req.path,
            userAgent: req.headers['user-agent']
          });

          return res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
              details: {
                limitType,
                resetTime: new Date(resetTime).toISOString()
              }
            }
          });
        }

        // Update threat metrics
        this.updateThreatMetrics(clientIP, req);

        // Calculate risk score
        const riskScore = this.calculateRiskScore(clientIP);
        req.ddosInfo = {
          isBlocked: false,
          isSuspicious: riskScore > 70,
          riskScore
        };

        // Block highly suspicious IPs
        if (riskScore > 85) {
          await this.blockIP(clientIP, `High risk score: ${riskScore}`, this.config.blockDuration);
          req.ddosInfo.isBlocked = true;
          req.ddosInfo.blockReason = 'Suspicious activity detected';

          return res.status(429).json({
            success: false,
            error: {
              code: 'SUSPICIOUS_ACTIVITY',
              message: 'Request blocked due to suspicious activity'
            }
          });
        }

        // Add security headers
        res.setHeader('X-RateLimit-Limit', rateLimitResult.limits.perIP.max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitResult.limits.perIP.max - rateLimitResult.limits.perIP.current));
        res.setHeader('X-Risk-Score', riskScore.toString());

        // Track response time
        res.on('finish', () => {
          const responseTime = Date.now() - startTime;
          this.updateResponseTime(clientIP, responseTime);
          
          // Update error metrics
          if (res.statusCode >= 400) {
            this.updateThreatMetrics(clientIP, req, true);
          }
        });

        next();
      } catch (error) {
        logger.error('DDoS protection error', { error: error.message });
        next(); // Continue on error to avoid blocking legitimate requests
      }
    };
  }

  /**
   * Update response time metrics
   */
  private updateResponseTime(ip: string, responseTime: number): void {
    const metrics = this.threatMetrics.get(ip);
    if (metrics) {
      // Simple moving average
      metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2;
    }
  }

  /**
   * Connection limiting middleware
   */
  limitConnections() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      const clientIP = this.getClientIP(req);

      // Skip whitelisted IPs
      if (this.isWhitelisted(clientIP)) {
        return next();
      }

      // Increment connection count
      const currentConnections = this.connectionCounts.get(clientIP) || 0;
      
      if (currentConnections >= this.config.maxConcurrentConnections) {
        logger.warn('Connection limit exceeded', {
          ip: clientIP,
          currentConnections,
          maxConnections: this.config.maxConcurrentConnections
        });

        return res.status(429).json({
          success: false,
          error: {
            code: 'CONNECTION_LIMIT_EXCEEDED',
            message: 'Too many concurrent connections'
          }
        });
      }

      this.connectionCounts.set(clientIP, currentConnections + 1);

      // Clean up connection count when response finishes
      res.on('finish', () => {
        const count = this.connectionCounts.get(clientIP) || 0;
        if (count > 1) {
          this.connectionCounts.set(clientIP, count - 1);
        } else {
          this.connectionCounts.delete(clientIP);
        }
      });

      next();
    };
  }

  /**
   * Adaptive rate limiting based on system load
   */
  private async updateAdaptiveThresholds(): Promise<void> {
    try {
      if (!this.config.adaptiveThresholds) return;

      // Get current system metrics
      const globalRequestsKey = 'ddos:global:requests';
      const globalRequests = parseInt(await redis.get(globalRequestsKey) || '0');
      
      // Calculate load factor (simplified)
      const loadFactor = globalRequests / this.config.globalRateLimit.maxRequests;
      
      // Adjust thresholds based on load
      if (loadFactor > 0.8) {
        // High load - reduce thresholds
        this.config.perIPRateLimit.maxRequests = Math.floor(this.config.perIPRateLimit.maxRequests * 0.7);
        this.config.suspiciousThresholds.requestsPerSecond *= 0.8;
      } else if (loadFactor < 0.3) {
        // Low load - increase thresholds
        this.config.perIPRateLimit.maxRequests = Math.floor(this.config.perIPRateLimit.maxRequests * 1.1);
        this.config.suspiciousThresholds.requestsPerSecond *= 1.1;
      }

      logger.debug('Adaptive thresholds updated', { loadFactor, globalRequests });
    } catch (error) {
      logger.error('Error updating adaptive thresholds', { error: error.message });
    }
  }

  /**
   * Initialize adaptive baseline
   */
  private initializeAdaptiveBaseline(): void {
    if (this.config.adaptiveThresholds) {
      setInterval(() => {
        this.updateAdaptiveThresholds();
      }, 5 * 60 * 1000); // Update every 5 minutes
    }
  }

  /**
   * Geographic IP filtering (basic implementation)
   */
  private async checkGeolocation(ip: string): Promise<{ allowed: boolean; country?: string }> {
    if (!this.config.enableGeolocation) {
      return { allowed: true };
    }

    try {
      // Simplified geolocation check
      // In production, integrate with a proper geolocation service
      const blockedCountries = (process.env.BLOCKED_COUNTRIES || '').split(',').filter(Boolean);
      
      if (blockedCountries.length === 0) {
        return { allowed: true };
      }

      // For demonstration, block obviously suspicious IP ranges
      const suspiciousRanges = [
        /^0\./, // Reserved
        /^127\./, // Loopback (unless whitelisted)
        /^169\.254\./, // Link-local
        /^224\./ // Multicast
      ];

      for (const range of suspiciousRanges) {
        if (range.test(ip) && !this.isWhitelisted(ip)) {
          return { allowed: false, country: 'suspicious' };
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Geolocation check error', { ip, error: error.message });
      return { allowed: true }; // Allow on error
    }
  }

  /**
   * Start background metrics cleanup
   */
  private startMetricsCleanup(): void {
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 10 * 60 * 1000); // Clean up every 10 minutes
  }

  /**
   * Clean up old threat metrics
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [ip, metrics] of this.threatMetrics) {
      if (now - metrics.lastRequestTime > maxAge) {
        this.threatMetrics.delete(ip);
      }
    }

    logger.debug('Cleaned up old threat metrics', {
      remainingIPs: this.threatMetrics.size
    });
  }

  /**
   * Get DDoS statistics
   */
  async getStatistics(): Promise<{
    global: {
      totalRequests: number;
      blockedRequests: number;
      activeConnections: number;
    };
    topIPs: {
      ip: string;
      requests: number;
      riskScore: number;
      status: 'normal' | 'suspicious' | 'blocked';
    }[];
    threats: {
      totalBlocked: number;
      activeSuspiciousIPs: number;
      topThreats: string[];
    };
  }> {
    try {
      // Global statistics
      const globalRequestsKey = 'ddos:global:requests';
      const blockedIPsKey = 'ddos:stats:blocked_ips';
      
      const totalRequests = parseInt(await redis.get(globalRequestsKey) || '0');
      const blockedRequests = parseInt(await redis.get(blockedIPsKey) || '0');
      const activeConnections = Array.from(this.connectionCounts.values()).reduce((sum, count) => sum + count, 0);

      // Top IPs by activity
      const topIPs = Array.from(this.threatMetrics.entries())
        .map(([ip, metrics]) => ({
          ip,
          requests: metrics.requestCount,
          riskScore: this.calculateRiskScore(ip),
          status: this.calculateRiskScore(ip) > 70 ? 'suspicious' : 'normal' as 'normal' | 'suspicious' | 'blocked'
        }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 10);

      // Check for blocked IPs
      for (const ipData of topIPs) {
        const blockStatus = await this.isIPBlocked(ipData.ip);
        if (blockStatus.blocked) {
          ipData.status = 'blocked';
        }
      }

      // Threat analysis
      const activeSuspiciousIPs = topIPs.filter(ip => ip.status === 'suspicious').length;
      const topThreats = topIPs
        .filter(ip => ip.riskScore > 50)
        .map(ip => `${ip.ip} (${ip.riskScore}%)`)
        .slice(0, 5);

      return {
        global: {
          totalRequests,
          blockedRequests,
          activeConnections
        },
        topIPs,
        threats: {
          totalBlocked: blockedRequests,
          activeSuspiciousIPs,
          topThreats
        }
      };
    } catch (error) {
      logger.error('Error getting DDoS statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Health check for DDoS protection
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      enabled: boolean;
      globalRequestRate: number;
      blockedIPs: number;
      suspiciousIPs: number;
      activeConnections: number;
      redisConnected: boolean;
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

      // Get current statistics
      const stats = await this.getStatistics();
      
      // Check global request rate
      const globalRequestRate = stats.global.totalRequests;
      if (globalRequestRate > this.config.globalRateLimit.maxRequests * 0.8) {
        issues.push('High global request rate detected');
        if (status === 'healthy') status = 'degraded';
      }

      // Check for suspicious activity
      const suspiciousIPs = stats.topIPs.filter(ip => ip.status === 'suspicious').length;
      if (suspiciousIPs > 5) {
        issues.push(`High number of suspicious IPs: ${suspiciousIPs}`);
        status = 'degraded';
      }

      // Check active connections
      if (stats.global.activeConnections > this.config.maxConcurrentConnections * 0.9) {
        issues.push('High number of concurrent connections');
        if (status === 'healthy') status = 'degraded';
      }

      return {
        status,
        metrics: {
          enabled: this.config.enabled,
          globalRequestRate,
          blockedIPs: stats.global.blockedRequests,
          suspiciousIPs,
          activeConnections: stats.global.activeConnections,
          redisConnected
        },
        issues
      };
    } catch (error) {
      logger.error('DDoS protection health check error', { error: error.message });
      return {
        status: 'unhealthy',
        metrics: {
          enabled: false,
          globalRequestRate: 0,
          blockedIPs: 0,
          suspiciousIPs: 0,
          activeConnections: 0,
          redisConnected: false
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

  /**
   * Unblock an IP address
   */
  async unblockIP(ip: string): Promise<void> {
    try {
      const blockKey = `ddos:blocked:${ip}`;
      await redis.del(blockKey);
      logger.info('IP address unblocked', { ip });
    } catch (error) {
      logger.error('Error unblocking IP', { ip, error: error.message });
      throw error;
    }
  }

  /**
   * Get blocked IPs list
   */
  async getBlockedIPs(): Promise<{
    ip: string;
    reason: string;
    blockedAt: Date;
    expiresAt: Date;
  }[]> {
    try {
      const pattern = 'ddos:blocked:*';
      const keys = await redis.keys(pattern);
      const blockedIPs = [];

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          blockedIPs.push({
            ip: parsed.ip,
            reason: parsed.reason,
            blockedAt: new Date(parsed.blockedAt),
            expiresAt: new Date(parsed.expiresAt)
          });
        }
      }

      return blockedIPs.sort((a, b) => b.blockedAt.getTime() - a.blockedAt.getTime());
    } catch (error) {
      logger.error('Error getting blocked IPs', { error: error.message });
      return [];
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DDoSConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('DDoS protection configuration updated', { 
      enabled: this.config.enabled,
      globalRateLimit: this.config.globalRateLimit.maxRequests,
      perIPRateLimit: this.config.perIPRateLimit.maxRequests
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): DDoSConfig {
    return { ...this.config };
  }
}

// Create and export DDoS protection manager
export const ddosProtection = new DDoSProtectionManager({
  enabled: process.env.DDOS_PROTECTION_ENABLED !== 'false',
  globalRateLimit: {
    windowMs: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW || '60000'),
    maxRequests: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX || '1000')
  },
  perIPRateLimit: {
    windowMs: parseInt(process.env.PER_IP_RATE_LIMIT_WINDOW || '60000'),
    maxRequests: parseInt(process.env.PER_IP_RATE_LIMIT_MAX || '100')
  },
  maxConcurrentConnections: parseInt(process.env.MAX_CONCURRENT_CONNECTIONS || '1000'),
  adaptiveThresholds: process.env.ADAPTIVE_THRESHOLDS !== 'false'
});

// Export middleware functions
export const protectFromDDoS = ddosProtection.protect();
export const limitConcurrentConnections = ddosProtection.limitConnections();

// Export utility functions
export const getDDoSStatistics = () => ddosProtection.getStatistics();
export const getBlockedIPs = () => ddosProtection.getBlockedIPs();
export const unblockIP = (ip: string) => ddosProtection.unblockIP(ip);
export const ddosHealthCheck = () => ddosProtection.healthCheck();
export const updateDDoSConfig = (config: Partial<DDoSConfig>) => ddosProtection.updateConfig(config);

/**
 * Complete DDoS protection setup
 */
export const configureDDoSProtection = () => {
  return [
    limitConcurrentConnections,
    protectFromDDoS
  ];
};

/**
 * Emergency DDoS response (manual trigger)
 */
export const emergencyDDoSResponse = async (
  escalationLevel: 'low' | 'medium' | 'high'
): Promise<void> => {
  try {
    logger.warn('Emergency DDoS response activated', { escalationLevel });

    switch (escalationLevel) {
      case 'low':
        // Reduce rate limits by 30%
        ddosProtection.updateConfig({
          perIPRateLimit: {
            ...ddosProtection.getConfig().perIPRateLimit,
            maxRequests: Math.floor(ddosProtection.getConfig().perIPRateLimit.maxRequests * 0.7)
          }
        });
        break;

      case 'medium':
        // Reduce rate limits by 50%
        ddosProtection.updateConfig({
          perIPRateLimit: {
            ...ddosProtection.getConfig().perIPRateLimit,
            maxRequests: Math.floor(ddosProtection.getConfig().perIPRateLimit.maxRequests * 0.5)
          },
          burstProtection: {
            ...ddosProtection.getConfig().burstProtection,
            maxBurst: Math.floor(ddosProtection.getConfig().burstProtection.maxBurst * 0.5)
          }
        });
        break;

      case 'high':
        // Strict emergency mode
        ddosProtection.updateConfig({
          perIPRateLimit: {
            windowMs: 60 * 1000,
            maxRequests: 10
          },
          burstProtection: {
            windowMs: 1000,
            maxBurst: 2
          },
          blockDuration: 60 * 60 // 1 hour
        });
        break;
    }

    logger.info('Emergency DDoS response configuration applied', { escalationLevel });
  } catch (error) {
    logger.error('Error applying emergency DDoS response', { escalationLevel, error: error.message });
    throw error;
  }
};
