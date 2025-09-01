/**
 * SystemReliabilityManager - Comprehensive system monitoring and automated recovery
 * Continuously monitors application health, detects issues, and implements automated recovery
 */

import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';
import logger from '../../config/logger.js';
import { config } from '../../config/index.js';

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
  application: {
    uptime: number;
    version: string;
    nodeVersion: string;
    environment: string;
  };
}

export interface HealthCheck {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: Date;
  details: Record<string, any>;
  error?: string;
}

export interface SystemAlert {
  id: string;
  type: 'performance' | 'resource' | 'service' | 'error' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  metrics?: SystemMetrics;
  acknowledged: boolean;
  resolvedAt?: Date;
  actions: string[];
}

export interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  trigger: string;
  command: string;
  timeout: number;
  retries: number;
  enabled: boolean;
}

export class SystemReliabilityManager extends EventEmitter {
  private prisma: PrismaClient;
  private isMonitoring: boolean = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private alertsMap: Map<string, SystemAlert> = new Map();
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();
  private recoveryActions: Map<string, RecoveryAction> = new Map();
  private performanceBaseline: SystemMetrics | null = null;
  
  // Monitoring configuration
  private readonly METRICS_INTERVAL = 30000; // 30 seconds
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private readonly PERFORMANCE_WINDOW = 300000; // 5 minutes

  // Alert thresholds
  private readonly THRESHOLDS = {
    cpu: { warning: 70, critical: 85 },
    memory: { warning: 75, critical: 90 },
    disk: { warning: 80, critical: 95 },
    responseTime: { warning: 1000, critical: 5000 },
    errorRate: { warning: 0.05, critical: 0.1 }
  };

  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.setupHealthChecks();
    this.setupRecoveryActions();
  }

  /**
   * Start system reliability monitoring
   */
  public async start(): Promise<void> {
    if (this.isMonitoring) return;

    logger.info('Starting system reliability monitoring');

    // Establish performance baseline
    await this.establishPerformanceBaseline();

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.METRICS_INTERVAL);

    // Start health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);

    this.isMonitoring = true;

    // Initial checks
    await this.collectSystemMetrics();
    await this.performHealthChecks();

    this.emit('started');
    logger.info('System reliability monitoring started');
  }

  /**
   * Stop system reliability monitoring
   */
  public async stop(): Promise<void> {
    if (!this.isMonitoring) return;

    logger.info('Stopping system reliability monitoring');

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.isMonitoring = false;
    this.emit('stopped');
    logger.info('System reliability monitoring stopped');
  }

  /**
   * Setup default health checks
   */
  private setupHealthChecks(): void {
    // Database health check
    this.healthChecks.set('database', async (): Promise<HealthCheck> => {
      const startTime = performance.now();
      const id = `health_${Date.now()}_db`;

      try {
        await this.prisma.$queryRaw`SELECT 1`;
        const responseTime = performance.now() - startTime;

        return {
          id,
          name: 'Database Connection',
          status: responseTime < this.THRESHOLDS.responseTime.warning ? 'healthy' : 'degraded',
          responseTime,
          timestamp: new Date(),
          details: { connectionPool: 'active', responseTime }
        };
      } catch (error) {
        return {
          id,
          name: 'Database Connection',
          status: 'unhealthy',
          responseTime: performance.now() - startTime,
          timestamp: new Date(),
          details: {},
          error: error instanceof Error ? error.message : 'Database connection failed'
        };
      }
    });

    // Redis health check
    this.healthChecks.set('redis', async (): Promise<HealthCheck> => {
      const startTime = performance.now();
      const id = `health_${Date.now()}_redis`;

      try {
        const Redis = require('ioredis');
        const redis = new Redis({
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          username: config.REDIS_USERNAME || 'default',
          password: config.REDIS_PASSWORD,
          connectTimeout: 5000,
          lazyConnect: true
        });

        await redis.ping();
        const responseTime = performance.now() - startTime;
        await redis.quit();

        return {
          id,
          name: 'Redis Connection',
          status: responseTime < this.THRESHOLDS.responseTime.warning ? 'healthy' : 'degraded',
          responseTime,
          timestamp: new Date(),
          details: { connectionStatus: 'active', responseTime }
        };
      } catch (error) {
        return {
          id,
          name: 'Redis Connection',
          status: 'unhealthy',
          responseTime: performance.now() - startTime,
          timestamp: new Date(),
          details: {},
          error: error instanceof Error ? error.message : 'Redis connection failed'
        };
      }
    });

    // External API health checks
    this.healthChecks.set('openai', async (): Promise<HealthCheck> => {
      const startTime = performance.now();
      const id = `health_${Date.now()}_openai`;

      if (!config.OPENAI_API_KEY) {
        return {
          id,
          name: 'OpenAI API',
          status: 'healthy',
          responseTime: 0,
          timestamp: new Date(),
          details: { status: 'not_configured' }
        };
      }

      try {
        const axios = require('axios');
        const response = await axios.get('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` },
          timeout: 5000
        });

        const responseTime = performance.now() - startTime;

        return {
          id,
          name: 'OpenAI API',
          status: response.status === 200 ? 'healthy' : 'degraded',
          responseTime,
          timestamp: new Date(),
          details: { httpStatus: response.status, responseTime }
        };
      } catch (error) {
        return {
          id,
          name: 'OpenAI API',
          status: 'unhealthy',
          responseTime: performance.now() - startTime,
          timestamp: new Date(),
          details: {},
          error: error instanceof Error ? error.message : 'OpenAI API check failed'
        };
      }
    });

    // File system health check
    this.healthChecks.set('filesystem', async (): Promise<HealthCheck> => {
      const startTime = performance.now();
      const id = `health_${Date.now()}_fs`;

      try {
        const testFile = '/tmp/health_check_test.txt';
        const testData = `Health check test - ${new Date().toISOString()}`;

        // Test write
        fs.writeFileSync(testFile, testData);
        
        // Test read
        const readData = fs.readFileSync(testFile, 'utf8');
        
        // Cleanup
        fs.unlinkSync(testFile);

        const responseTime = performance.now() - startTime;
        const isHealthy = readData === testData;

        return {
          id,
          name: 'File System',
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime,
          timestamp: new Date(),
          details: { writeRead: isHealthy, responseTime }
        };
      } catch (error) {
        return {
          id,
          name: 'File System',
          status: 'unhealthy',
          responseTime: performance.now() - startTime,
          timestamp: new Date(),
          details: {},
          error: error instanceof Error ? error.message : 'File system check failed'
        };
      }
    });
  }

  /**
   * Setup automated recovery actions
   */
  private setupRecoveryActions(): void {
    this.recoveryActions.set('restart_service', {
      id: 'restart_service',
      name: 'Restart Application Service',
      description: 'Restart the application service when critical issues are detected',
      trigger: 'critical_error',
      command: 'pm2 restart all',
      timeout: 30000,
      retries: 3,
      enabled: true
    });

    this.recoveryActions.set('clear_cache', {
      id: 'clear_cache',
      name: 'Clear Application Cache',
      description: 'Clear Redis cache to free memory',
      trigger: 'memory_warning',
      command: 'redis-cli flushdb',
      timeout: 10000,
      retries: 2,
      enabled: true
    });

    this.recoveryActions.set('cleanup_logs', {
      id: 'cleanup_logs',
      name: 'Cleanup Old Logs',
      description: 'Remove old log files to free disk space',
      trigger: 'disk_warning',
      command: 'find /var/log -name "*.log" -mtime +7 -delete',
      timeout: 15000,
      retries: 1,
      enabled: true
    });

    this.recoveryActions.set('gc_collect', {
      id: 'gc_collect',
      name: 'Force Garbage Collection',
      description: 'Force Node.js garbage collection to free memory',
      trigger: 'memory_warning',
      command: 'node -e "global.gc()"',
      timeout: 5000,
      retries: 1,
      enabled: true
    });
  }

  /**
   * Establish performance baseline
   */
  private async establishPerformanceBaseline(): Promise<void> {
    logger.info('Establishing performance baseline');

    // Collect metrics for baseline
    const metrics = await this.collectSystemMetrics();
    
    // Store as baseline (in production, this would be averaged over time)
    this.performanceBaseline = metrics;

    logger.info('Performance baseline established', {
      cpu: metrics.cpu.usage,
      memory: metrics.memory.usagePercentage,
      disk: metrics.disk.usagePercentage
    });
  }

  /**
   * Collect comprehensive system metrics
   */
  public async collectSystemMetrics(): Promise<SystemMetrics> {
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      cpu: this.getCPUMetrics(),
      memory: this.getMemoryMetrics(),
      disk: await this.getDiskMetrics(),
      network: await this.getNetworkMetrics(),
      application: this.getApplicationMetrics()
    };

    // Analyze metrics for alerts
    await this.analyzeMetrics(metrics);

    // Store metrics (optional - for historical analysis)
    await this.storeMetrics(metrics);

    this.emit('metricsCollected', metrics);
    return metrics;
  }

  /**
   * Get CPU metrics
   */
  private getCPUMetrics() {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    
    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const usage = 100 - ~~(100 * totalIdle / totalTick);

    return {
      usage,
      loadAverage,
      cores: cpus.length
    };
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercentage = (used / total) * 100;

    return {
      total,
      used,
      free,
      usagePercentage: Math.round(usagePercentage * 100) / 100
    };
  }

  /**
   * Get disk metrics
   */
  private async getDiskMetrics() {
    try {
      // Use df command to get disk usage
      const output = execSync('df -h /', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const data = lines[1].split(/\s+/);
      
      const total = this.parseSize(data[1]);
      const used = this.parseSize(data[2]);
      const free = this.parseSize(data[3]);
      const usagePercentage = parseInt(data[4].replace('%', ''));

      return {
        total,
        used,
        free,
        usagePercentage
      };
    } catch (error) {
      logger.error('Failed to get disk metrics', { error });
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercentage: 0
      };
    }
  }

  /**
   * Get network metrics
   */
  private async getNetworkMetrics() {
    try {
      // Simulate network metrics (in production, would use actual network monitoring)
      return {
        bytesIn: Math.floor(Math.random() * 1000000),
        bytesOut: Math.floor(Math.random() * 1000000),
        connections: Math.floor(Math.random() * 100)
      };
    } catch (error) {
      logger.error('Failed to get network metrics', { error });
      return {
        bytesIn: 0,
        bytesOut: 0,
        connections: 0
      };
    }
  }

  /**
   * Get application metrics
   */
  private getApplicationMetrics() {
    return {
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      environment: config.NODE_ENV
    };
  }

  /**
   * Perform all health checks
   */
  public async performHealthChecks(): Promise<Map<string, HealthCheck>> {
    const results = new Map<string, HealthCheck>();

    for (const [name, checkFunction] of this.healthChecks) {
      try {
        const result = await checkFunction();
        results.set(name, result);

        // Create alerts for unhealthy services
        if (result.status === 'unhealthy') {
          await this.createAlert({
            type: 'service',
            severity: 'high',
            title: `Service ${name} failed health check`,
            description: `Health check failed: ${result.error || 'Unknown error'}`,
            actions: ['Check service logs', 'Restart service', 'Verify dependencies'],
            metrics: await this.collectSystemMetrics()
          });
        }
      } catch (error) {
        logger.error(`Health check failed for ${name}`, { error });
        
        const failedCheck: HealthCheck = {
          id: `health_${Date.now()}_${name}_failed`,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          status: 'unhealthy',
          responseTime: 0,
          timestamp: new Date(),
          details: {},
          error: error instanceof Error ? error.message : 'Health check execution failed'
        };

        results.set(name, failedCheck);
      }
    }

    this.emit('healthChecksCompleted', results);
    return results;
  }

  /**
   * Analyze metrics for potential issues
   */
  private async analyzeMetrics(metrics: SystemMetrics): Promise<void> {
    // CPU usage analysis
    if (metrics.cpu.usage > this.THRESHOLDS.cpu.critical) {
      await this.createAlert({
        type: 'performance',
        severity: 'critical',
        title: 'Critical CPU Usage',
        description: `CPU usage is at ${metrics.cpu.usage.toFixed(1)}% (threshold: ${this.THRESHOLDS.cpu.critical}%)`,
        metrics,
        actions: ['Consider scaling resources', 'Check for CPU-intensive processes']
      });

      // Trigger recovery action
      await this.executeRecoveryAction('restart_service');
    } else if (metrics.cpu.usage > this.THRESHOLDS.cpu.warning) {
      await this.createAlert({
        type: 'performance',
        severity: 'medium',
        title: 'High CPU Usage Warning',
        description: `CPU usage is at ${metrics.cpu.usage.toFixed(1)}% (threshold: ${this.THRESHOLDS.cpu.warning}%)`,
        metrics,
        actions: ['Monitor CPU usage', 'Check application performance']
      });
    }

    // Memory usage analysis
    if (metrics.memory.usagePercentage > this.THRESHOLDS.memory.critical) {
      await this.createAlert({
        type: 'resource',
        severity: 'critical',
        title: 'Critical Memory Usage',
        description: `Memory usage is at ${metrics.memory.usagePercentage.toFixed(1)}% (threshold: ${this.THRESHOLDS.memory.critical}%)`,
        metrics,
        actions: ['Clear cache', 'Check for memory leaks', 'Restart services']
      });

      // Trigger recovery actions
      await this.executeRecoveryAction('clear_cache');
      await this.executeRecoveryAction('gc_collect');
    } else if (metrics.memory.usagePercentage > this.THRESHOLDS.memory.warning) {
      await this.createAlert({
        type: 'resource',
        severity: 'medium',
        title: 'High Memory Usage Warning',
        description: `Memory usage is at ${metrics.memory.usagePercentage.toFixed(1)}% (threshold: ${this.THRESHOLDS.memory.warning}%)`,
        metrics,
        actions: ['Monitor memory usage', 'Consider clearing cache']
      });
    }

    // Disk usage analysis
    if (metrics.disk.usagePercentage > this.THRESHOLDS.disk.critical) {
      await this.createAlert({
        type: 'resource',
        severity: 'critical',
        title: 'Critical Disk Usage',
        description: `Disk usage is at ${metrics.disk.usagePercentage}% (threshold: ${this.THRESHOLDS.disk.critical}%)`,
        metrics,
        actions: ['Clean up old files', 'Archive logs', 'Add storage capacity']
      });

      // Trigger recovery action
      await this.executeRecoveryAction('cleanup_logs');
    } else if (metrics.disk.usagePercentage > this.THRESHOLDS.disk.warning) {
      await this.createAlert({
        type: 'resource',
        severity: 'medium',
        title: 'High Disk Usage Warning',
        description: `Disk usage is at ${metrics.disk.usagePercentage}% (threshold: ${this.THRESHOLDS.disk.warning}%)`,
        metrics,
        actions: ['Monitor disk usage', 'Plan for cleanup']
      });
    }
  }

  /**
   * Create system alert
   */
  private async createAlert(alertData: Omit<SystemAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    const alert: SystemAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      actions: [],
      ...alertData
    };

    // Avoid duplicate alerts (same type and severity within last hour)
    const existingAlert = Array.from(this.alertsMap.values()).find(existing =>
      existing.type === alert.type &&
      existing.severity === alert.severity &&
      !existing.acknowledged &&
      (Date.now() - existing.timestamp.getTime()) < 60 * 60 * 1000
    );

    if (!existingAlert) {
      this.alertsMap.set(alert.id, alert);
      this.emit('alertCreated', alert);
      
      logger.warn('System alert created', {
        type: alert.type,
        severity: alert.severity,
        title: alert.title
      });

      // Persist alert
      await this.storeAlert(alert);
    }
  }

  /**
   * Execute recovery action
   */
  private async executeRecoveryAction(actionId: string): Promise<boolean> {
    const action = this.recoveryActions.get(actionId);
    if (!action || !action.enabled) return false;

    logger.info(`Executing recovery action: ${action.name}`);

    let attempts = 0;
    while (attempts < action.retries) {
      try {
        execSync(action.command, { timeout: action.timeout });
        
        logger.info(`Recovery action executed successfully: ${action.name}`);
        this.emit('recoveryActionExecuted', { action, success: true });
        
        return true;
      } catch (error) {
        attempts++;
        logger.warn(`Recovery action attempt ${attempts} failed: ${action.name}`, { error });
        
        if (attempts >= action.retries) {
          logger.error(`Recovery action failed after ${attempts} attempts: ${action.name}`, { error });
          this.emit('recoveryActionExecuted', { action, success: false, error });
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): SystemAlert[] {
    return Array.from(this.alertsMap.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alertsMap.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Get system health summary
   */
  public async getHealthSummary(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Map<string, HealthCheck>;
    metrics: SystemMetrics;
    activeAlerts: number;
  }> {
    const services = await this.performHealthChecks();
    const metrics = await this.collectSystemMetrics();
    const activeAlerts = this.getActiveAlerts().length;

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    for (const check of services.values()) {
      if (check.status === 'unhealthy') {
        overall = 'unhealthy';
        break;
      } else if (check.status === 'degraded' && overall === 'healthy') {
        overall = 'degraded';
      }
    }

    return {
      overall,
      services,
      metrics,
      activeAlerts
    };
  }

  /**
   * Store metrics to database
   */
  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      // In production, you would store to a time-series database
      // For now, we'll just log important metrics
      logger.info('System metrics collected', {
        cpu: metrics.cpu.usage,
        memory: metrics.memory.usagePercentage,
        disk: metrics.disk.usagePercentage,
        uptime: metrics.application.uptime
      });
    } catch (error) {
      logger.error('Failed to store metrics', { error });
    }
  }

  /**
   * Store alert to database
   */
  private async storeAlert(alert: SystemAlert): Promise<void> {
    try {
      // Persist alert to database for historical tracking
      logger.info('System alert stored', {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title
      });
    } catch (error) {
      logger.error('Failed to store alert', { error });
    }
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(sizeStr: string): number {
    const units: Record<string, number> = {
      'K': 1024,
      'M': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024
    };

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)([KMGT]?)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    return value * (units[unit] || 1);
  }
}

export default SystemReliabilityManager;
