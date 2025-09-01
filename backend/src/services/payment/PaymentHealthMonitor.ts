/**
 * Payment Provider Health Monitoring Service
 * Monitors provider availability, performance, and enables automatic failover
 */

import { PaymentProviderType } from './PaymentService';
import { logger } from '../../utils/logger';
import { redis } from '../../config/redis';
import { prisma } from '../../utils/prisma';

export interface ProviderHealthMetrics {
  provider: PaymentProviderType;
  isHealthy: boolean;
  responseTime: number;
  successRate: number;
  lastCheck: Date;
  consecutiveFailures: number;
  uptime: number; // Percentage
  avgResponseTime: number;
  errorRate: number;
}

export interface HealthCheckResult {
  provider: PaymentProviderType;
  healthy: boolean;
  responseTime: number;
  status: number;
  error?: string;
  timestamp: Date;
}

export class PaymentHealthMonitor {
  private static readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static readonly METRICS_TTL = 24 * 60 * 60; // 24 hours
  private static readonly MAX_CONSECUTIVE_FAILURES = 3;
  private static readonly RESPONSE_TIME_THRESHOLD = 3000; // 3 seconds
  
  private healthCheckTimers: Map<PaymentProviderType, NodeJS.Timeout> = new Map();
  private providerHealthStatus: Map<PaymentProviderType, boolean> = new Map();

  constructor() {
    this.initializeHealthChecks();
  }

  /**
   * Start health monitoring for all providers
   */
  private initializeHealthChecks(): void {
    const providers: PaymentProviderType[] = ['yoco', 'paystack'];
    
    providers.forEach(provider => {
      this.startHealthChecks(provider);
    });

    logger.info('Payment provider health monitoring started', {
      providers,
      interval: PaymentHealthMonitor.HEALTH_CHECK_INTERVAL
    });
  }

  /**
   * Start periodic health checks for a provider
   */
  private startHealthChecks(provider: PaymentProviderType): void {
    // Initial health check
    this.performHealthCheck(provider);

    // Schedule periodic checks
    const timer = setInterval(() => {
      this.performHealthCheck(provider);
    }, PaymentHealthMonitor.HEALTH_CHECK_INTERVAL);

    this.healthCheckTimers.set(provider, timer);
  }

  /**
   * Perform comprehensive health check for a provider
   */
  async performHealthCheck(provider: PaymentProviderType): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      let response: Response | null = null;
      let error: string | undefined;
      let healthy = false;

      if (provider === 'yoco') {
        const yocoHealthUrl = process.env.NODE_ENV === 'production' 
          ? 'https://payments.yoco.com/api/v1/ping'
          : 'https://payments-sandbox.yoco.com/api/v1/ping';

        try {
          response = await fetch(yocoHealthUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.YOCO_SECRET_KEY}`,
              'User-Agent': 'AI-Job-Chommie-HealthCheck/1.0'
            },
            timeout: 10000
          });
        } catch (fetchError: any) {
          error = fetchError.message;
        }
      } else if (provider === 'paystack') {
        try {
          response = await fetch('https://api.paystack.co/bank', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              'User-Agent': 'AI-Job-Chommie-HealthCheck/1.0'
            },
            timeout: 10000
          });
        } catch (fetchError: any) {
          error = fetchError.message;
        }
      }

      const responseTime = Date.now() - startTime;
      healthy = response ? (response.ok && responseTime < PaymentHealthMonitor.RESPONSE_TIME_THRESHOLD && !error) : false;

      result = {
        provider,
        healthy,
        responseTime,
        status: response?.status || 0,
        error,
        timestamp: new Date()
      };

      // Update provider health status
      this.providerHealthStatus.set(provider, healthy);

      // Store metrics
      await this.storeHealthMetrics(result);

      // Handle health status changes
      await this.handleHealthStatusChange(provider, healthy);

      logger.debug('Health check completed', {
        provider,
        healthy,
        responseTime,
        status: response?.status
      });

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      result = {
        provider,
        healthy: false,
        responseTime,
        status: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };

      this.providerHealthStatus.set(provider, false);
      await this.storeHealthMetrics(result);
      await this.handleHealthStatusChange(provider, false);

      logger.error('Health check failed', { provider, error, responseTime });
      return result;
    }
  }

  /**
   * Store health metrics in Redis and database
   */
  private async storeHealthMetrics(result: HealthCheckResult): Promise<void> {
    try {
      const metricsKey = `payment_health_metrics:${result.provider}`;
      const checkResultKey = `payment_health_check:${result.provider}:${Date.now()}`;

      // Store individual check result in Redis
      await redis.setex(
        checkResultKey,
        PaymentHealthMonitor.METRICS_TTL,
        JSON.stringify(result)
      );

      // Update aggregated metrics
      await this.updateAggregatedMetrics(result);

      // Store in database for long-term analytics
      await prisma.providerHealthCheck.create({
        data: {
          provider: result.provider.toUpperCase(),
          healthy: result.healthy,
          responseTime: result.responseTime,
          status: result.status,
          error: result.error || null,
          timestamp: result.timestamp
        }
      });
    } catch (error) {
      logger.warn('Failed to store health metrics', { 
        provider: result.provider, 
        error 
      });
    }
  }

  /**
   * Update aggregated provider metrics
   */
  private async updateAggregatedMetrics(result: HealthCheckResult): Promise<void> {
    try {
      const metricsKey = `payment_provider_metrics:${result.provider}`;
      const existingMetrics = await redis.get(metricsKey);

      let metrics: ProviderHealthMetrics;

      if (existingMetrics) {
        metrics = JSON.parse(existingMetrics);
      } else {
        metrics = {
          provider: result.provider,
          isHealthy: true,
          responseTime: 0,
          successRate: 100,
          lastCheck: new Date(),
          consecutiveFailures: 0,
          uptime: 100,
          avgResponseTime: 0,
          errorRate: 0
        };
      }

      // Update metrics
      metrics.lastCheck = result.timestamp;
      metrics.responseTime = result.responseTime;
      metrics.isHealthy = result.healthy;

      if (result.healthy) {
        metrics.consecutiveFailures = 0;
      } else {
        metrics.consecutiveFailures += 1;
      }

      // Calculate rolling averages (simplified)
      const alpha = 0.1; // Smoothing factor for exponential moving average
      metrics.avgResponseTime = metrics.avgResponseTime * (1 - alpha) + result.responseTime * alpha;

      // Update success rate based on recent checks
      const recentChecks = await this.getRecentHealthChecks(result.provider, 100);
      const successfulChecks = recentChecks.filter(check => check.healthy).length;
      metrics.successRate = recentChecks.length > 0 ? (successfulChecks / recentChecks.length) * 100 : 0;
      metrics.errorRate = 100 - metrics.successRate;

      // Calculate uptime
      metrics.uptime = await this.calculateUptime(result.provider);

      // Store updated metrics
      await redis.setex(
        metricsKey,
        PaymentHealthMonitor.METRICS_TTL,
        JSON.stringify(metrics)
      );

      logger.debug('Provider metrics updated', {
        provider: result.provider,
        isHealthy: metrics.isHealthy,
        successRate: metrics.successRate,
        avgResponseTime: metrics.avgResponseTime,
        consecutiveFailures: metrics.consecutiveFailures
      });
    } catch (error) {
      logger.warn('Failed to update aggregated metrics', { 
        provider: result.provider, 
        error 
      });
    }
  }

  /**
   * Handle provider health status changes
   */
  private async handleHealthStatusChange(provider: PaymentProviderType, isHealthy: boolean): Promise<void> {
    try {
      const previousStatus = this.providerHealthStatus.get(provider);

      // If status changed, log and notify
      if (previousStatus !== undefined && previousStatus !== isHealthy) {
        const statusChange = isHealthy ? 'recovered' : 'failed';
        
        logger.warn(`Payment provider ${provider} health status changed`, {
          provider,
          previousStatus,
          newStatus: isHealthy,
          statusChange
        });

        // Store status change event
        await prisma.providerStatusChange.create({
          data: {
            provider: provider.toUpperCase(),
            fromStatus: previousStatus ? 'HEALTHY' : 'UNHEALTHY',
            toStatus: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
            timestamp: new Date(),
            metadata: {
              detectedBy: 'health_monitor',
              automaticFailover: !isHealthy
            }
          }
        });

        // Trigger alerts for admin/manager if provider goes down
        if (!isHealthy) {
          await this.sendProviderDownAlert(provider);
        } else {
          await this.sendProviderRecoveryAlert(provider);
        }
      }
    } catch (error) {
      logger.error('Error handling health status change', { provider, isHealthy, error });
    }
  }

  /**
   * Get current health status for a provider
   */
  async getProviderHealth(provider: PaymentProviderType): Promise<ProviderHealthMetrics | null> {
    try {
      const metricsKey = `payment_provider_metrics:${provider}`;
      const metricsData = await redis.get(metricsKey);

      if (metricsData) {
        return JSON.parse(metricsData);
      }

      // If no cached metrics, perform a health check
      await this.performHealthCheck(provider);
      
      // Try to get metrics again
      const refreshedMetrics = await redis.get(metricsKey);
      return refreshedMetrics ? JSON.parse(refreshedMetrics) : null;
    } catch (error) {
      logger.error('Error getting provider health', { provider, error });
      return null;
    }
  }

  /**
   * Get health status for all providers
   */
  async getAllProvidersHealth(): Promise<Record<PaymentProviderType, ProviderHealthMetrics | null>> {
    const providers: PaymentProviderType[] = ['yoco', 'paystack'];
    const healthStatuses: Record<PaymentProviderType, ProviderHealthMetrics | null> = {} as any;

    await Promise.all(
      providers.map(async (provider) => {
        healthStatuses[provider] = await this.getProviderHealth(provider);
      })
    );

    return healthStatuses;
  }

  /**
   * Get recent health check results
   */
  private async getRecentHealthChecks(provider: PaymentProviderType, limit: number = 50): Promise<HealthCheckResult[]> {
    try {
      const pattern = `payment_health_check:${provider}:*`;
      const keys = await redis.keys(pattern);
      
      // Sort keys by timestamp (descending) and take the most recent
      const sortedKeys = keys
        .sort((a, b) => {
          const timestampA = parseInt(a.split(':').pop() || '0');
          const timestampB = parseInt(b.split(':').pop() || '0');
          return timestampB - timestampA;
        })
        .slice(0, limit);

      const checks: HealthCheckResult[] = [];
      
      for (const key of sortedKeys) {
        const data = await redis.get(key);
        if (data) {
          checks.push(JSON.parse(data));
        }
      }

      return checks;
    } catch (error) {
      logger.error('Error getting recent health checks', { provider, error });
      return [];
    }
  }

  /**
   * Calculate uptime percentage
   */
  private async calculateUptime(provider: PaymentProviderType): Promise<number> {
    try {
      // Get health checks from last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const healthChecks = await prisma.providerHealthCheck.findMany({
        where: {
          provider: provider.toUpperCase(),
          timestamp: {
            gte: oneDayAgo
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      if (healthChecks.length === 0) {
        return 100; // No data available, assume healthy
      }

      const healthyChecks = healthChecks.filter(check => check.healthy).length;
      return (healthyChecks / healthChecks.length) * 100;
    } catch (error) {
      logger.error('Error calculating uptime', { provider, error });
      return 0;
    }
  }

  /**
   * Get provider performance analytics
   */
  async getProviderAnalytics(
    provider: PaymentProviderType,
    timeRange: '1h' | '6h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    uptime: number;
    avgResponseTime: number;
    successRate: number;
    totalChecks: number;
    healthyChecks: number;
    unhealthyChecks: number;
    responseTimeHistory: Array<{ timestamp: Date; responseTime: number; }>;
    statusHistory: Array<{ timestamp: Date; healthy: boolean; }>;
  }> {
    try {
      const timeRangeMs = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const startTime = new Date(Date.now() - timeRangeMs[timeRange]);

      const healthChecks = await prisma.providerHealthCheck.findMany({
        where: {
          provider: provider.toUpperCase(),
          timestamp: {
            gte: startTime
          }
        },
        orderBy: { timestamp: 'asc' }
      });

      const totalChecks = healthChecks.length;
      const healthyChecks = healthChecks.filter(check => check.healthy).length;
      const unhealthyChecks = totalChecks - healthyChecks;

      const successRate = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 0;
      const uptime = successRate;

      const avgResponseTime = totalChecks > 0 
        ? healthChecks.reduce((sum, check) => sum + check.responseTime, 0) / totalChecks 
        : 0;

      const responseTimeHistory = healthChecks.map(check => ({
        timestamp: check.timestamp,
        responseTime: check.responseTime
      }));

      const statusHistory = healthChecks.map(check => ({
        timestamp: check.timestamp,
        healthy: check.healthy
      }));

      return {
        uptime,
        avgResponseTime,
        successRate,
        totalChecks,
        healthyChecks,
        unhealthyChecks,
        responseTimeHistory,
        statusHistory
      };
    } catch (error) {
      logger.error('Error getting provider analytics', { provider, timeRange, error });
      throw error;
    }
  }

  /**
   * Check if provider should be used based on health status
   */
  async shouldUseProvider(provider: PaymentProviderType): Promise<boolean> {
    try {
      const health = await this.getProviderHealth(provider);
      
      if (!health) {
        // No health data available, perform immediate check
        const checkResult = await this.performHealthCheck(provider);
        return checkResult.healthy;
      }

      // Consider provider unhealthy if:
      // 1. Current health status is false
      // 2. Too many consecutive failures
      // 3. Success rate is too low
      // 4. Response time is too high
      return health.isHealthy && 
             health.consecutiveFailures < PaymentHealthMonitor.MAX_CONSECUTIVE_FAILURES &&
             health.successRate > 80 &&
             health.avgResponseTime < PaymentHealthMonitor.RESPONSE_TIME_THRESHOLD;
    } catch (error) {
      logger.error('Error checking if provider should be used', { provider, error });
      return false;
    }
  }

  /**
   * Get recommended provider based on health metrics
   */
  async getRecommendedProvider(
    preferredProvider?: PaymentProviderType,
    fallbackProvider?: PaymentProviderType
  ): Promise<PaymentProviderType> {
    try {
      const providers: PaymentProviderType[] = ['yoco', 'paystack'];
      const healthStatuses = await this.getAllProvidersHealth();

      // If preferred provider is healthy, use it
      if (preferredProvider && await this.shouldUseProvider(preferredProvider)) {
        return preferredProvider;
      }

      // If fallback provider is healthy, use it
      if (fallbackProvider && await this.shouldUseProvider(fallbackProvider)) {
        logger.warn('Using fallback provider due to preferred provider health issues', {
          preferredProvider,
          fallbackProvider
        });
        return fallbackProvider;
      }

      // Find the healthiest provider
      let bestProvider: PaymentProviderType = 'yoco'; // Default
      let bestScore = -1;

      for (const provider of providers) {
        const health = healthStatuses[provider];
        if (health) {
          // Calculate composite health score
          const score = (health.successRate * 0.4) + 
                       ((100 - (health.avgResponseTime / 100)) * 0.3) + 
                       (health.uptime * 0.3);

          if (score > bestScore) {
            bestScore = score;
            bestProvider = provider;
          }
        }
      }

      logger.info('Selected provider based on health metrics', {
        selectedProvider: bestProvider,
        healthScore: bestScore,
        preferredProvider,
        fallbackProvider
      });

      return bestProvider;
    } catch (error) {
      logger.error('Error getting recommended provider', { error });
      return 'yoco'; // Default fallback
    }
  }

  /**
   * Send alert when provider goes down
   */
  private async sendProviderDownAlert(provider: PaymentProviderType): Promise<void> {
    try {
      const health = await this.getProviderHealth(provider);
      
      // Send notification to admin/manager
      logger.error('PAYMENT PROVIDER DOWN ALERT', {
        provider,
        consecutiveFailures: health?.consecutiveFailures,
        lastSuccessfulCheck: health?.lastCheck,
        impact: 'Payment processing may be affected'
      });

      // Store alert in database
      await prisma.systemAlert.create({
        data: {
          type: 'PAYMENT_PROVIDER_DOWN',
          severity: 'HIGH',
          title: `Payment Provider Down: ${provider.toUpperCase()}`,
          description: `Payment provider ${provider} is currently unavailable. Automatic failover to backup provider may be in effect.`,
          metadata: {
            provider,
            consecutiveFailures: health?.consecutiveFailures,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error sending provider down alert', { provider, error });
    }
  }

  /**
   * Send alert when provider recovers
   */
  private async sendProviderRecoveryAlert(provider: PaymentProviderType): Promise<void> {
    try {
      logger.info('PAYMENT PROVIDER RECOVERY', {
        provider,
        message: 'Payment provider has recovered and is now healthy'
      });

      // Store recovery event in database
      await prisma.systemAlert.create({
        data: {
          type: 'PAYMENT_PROVIDER_RECOVERY',
          severity: 'INFO',
          title: `Payment Provider Recovered: ${provider.toUpperCase()}`,
          description: `Payment provider ${provider} has recovered and is now processing payments normally.`,
          metadata: {
            provider,
            recoveredAt: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error sending provider recovery alert', { provider, error });
    }
  }

  /**
   * Get provider health dashboard data
   */
  async getHealthDashboard(): Promise<{
    providers: Record<PaymentProviderType, ProviderHealthMetrics | null>;
    overallHealth: {
      healthyProviders: number;
      totalProviders: number;
      criticalIssues: number;
    };
    recentAlerts: Array<any>;
    recommendations: Array<{
      type: string;
      message: string;
      priority: 'low' | 'medium' | 'high';
    }>;
  }> {
    try {
      const providers = await this.getAllProvidersHealth();
      const recommendations: Array<any> = [];

      // Calculate overall health
      const totalProviders = Object.keys(providers).length;
      const healthyProviders = Object.values(providers).filter(
        health => health?.isHealthy && health.successRate > 80
      ).length;

      let criticalIssues = 0;

      // Analyze each provider and generate recommendations
      for (const [providerName, health] of Object.entries(providers)) {
        if (health) {
          if (!health.isHealthy || health.successRate < 50) {
            criticalIssues++;
            recommendations.push({
              type: 'provider_critical',
              message: `Provider ${providerName} is experiencing critical issues`,
              priority: 'high' as const
            });
          } else if (health.successRate < 80) {
            recommendations.push({
              type: 'provider_warning',
              message: `Provider ${providerName} has degraded performance`,
              priority: 'medium' as const
            });
          }

          if (health.avgResponseTime > PaymentHealthMonitor.RESPONSE_TIME_THRESHOLD) {
            recommendations.push({
              type: 'response_time',
              message: `Provider ${providerName} has high response times`,
              priority: 'medium' as const
            });
          }
        }
      }

      // Get recent alerts
      const recentAlerts = await prisma.systemAlert.findMany({
        where: {
          type: {
            in: ['PAYMENT_PROVIDER_DOWN', 'PAYMENT_PROVIDER_RECOVERY']
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      return {
        providers,
        overallHealth: {
          healthyProviders,
          totalProviders,
          criticalIssues
        },
        recentAlerts,
        recommendations
      };
    } catch (error) {
      logger.error('Error getting health dashboard', { error });
      throw error;
    }
  }

  /**
   * Force health check for all providers
   */
  async forceHealthCheck(): Promise<Record<PaymentProviderType, HealthCheckResult>> {
    const providers: PaymentProviderType[] = ['yoco', 'paystack'];
    const results: Record<PaymentProviderType, HealthCheckResult> = {} as any;

    await Promise.all(
      providers.map(async (provider) => {
        results[provider] = await this.performHealthCheck(provider);
      })
    );

    logger.info('Forced health check completed for all providers', { results });
    return results;
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    this.healthCheckTimers.forEach((timer, provider) => {
      clearInterval(timer);
      logger.info('Stopped health monitoring', { provider });
    });

    this.healthCheckTimers.clear();
    this.providerHealthStatus.clear();
  }

  /**
   * Restart health monitoring
   */
  restartHealthMonitoring(): void {
    this.stopHealthMonitoring();
    this.initializeHealthChecks();
    logger.info('Health monitoring restarted');
  }
}

// Export singleton instance
export const paymentHealthMonitor = new PaymentHealthMonitor();
