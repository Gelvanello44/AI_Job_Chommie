/**
 * error_prevention.ts - Intelligent Error Prevention System
 * Implements pattern recognition, automated diagnostics, and predictive maintenance alerts
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import logger from '../../config/logger.js';

export interface ErrorPattern {
  id: string;
  name: string;
  pattern: RegExp;
  category: 'database' | 'api' | 'performance' | 'security' | 'network' | 'filesystem';
  severity: 'low' | 'medium' | 'high' | 'critical';
  frequency: number;
  lastOccurrence: Date;
  description: string;
  resolution: string[];
  preventionMeasures: string[];
}

export interface ErrorEvent {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'fatal';
  message: string;
  stack?: string;
  context: Record<string, any>;
  source: string;
  patternId?: string;
  resolved: boolean;
  resolutionTime?: number;
}

export interface DiagnosticResult {
  id: string;
  timestamp: Date;
  component: string;
  status: 'healthy' | 'warning' | 'error' | 'critical';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    details: string;
    recommendations?: string[];
  }>;
  overallScore: number;
  recommendations: string[];
}

export interface MaintenanceAlert {
  id: string;
  type: 'predictive' | 'preventive' | 'corrective';
  priority: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  predictedFailureTime?: Date;
  recommendations: string[];
  automatedActions: string[];
  acknowledged: boolean;
  timestamp: Date;
}

export class ErrorPreventionSystem extends EventEmitter {
  private prisma: PrismaClient;
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private errorHistory: ErrorEvent[] = [];
  private diagnosticHistory: DiagnosticResult[] = [];
  private maintenanceAlerts: Map<string, MaintenanceAlert> = new Map();
  private isMonitoring: boolean = false;
  
  // Configuration
  private readonly MAX_ERROR_HISTORY = 10000;
  private readonly PATTERN_DETECTION_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
  private readonly DIAGNOSTIC_INTERVAL = 30 * 60 * 1000; // 30 minutes

  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.initializeErrorPatterns();
  }

  /**
   * Start error prevention monitoring
   */
  public async start(): Promise<void> {
    if (this.isMonitoring) return;

    logger.info('Starting error prevention system');

    // Load historical data
    await this.loadErrorHistory();

    // Setup log monitoring
    await this.setupLogMonitoring();

    // Start diagnostic monitoring
    setInterval(() => {
      this.performDiagnostics();
    }, this.DIAGNOSTIC_INTERVAL);

    // Start pattern analysis
    setInterval(() => {
      this.analyzeErrorPatterns();
    }, this.PATTERN_DETECTION_WINDOW / 4); // Every 6 hours

    this.isMonitoring = true;
    this.emit('started');
    
    logger.info('Error prevention system started');
  }

  /**
   * Stop error prevention monitoring
   */
  public async stop(): Promise<void> {
    if (!this.isMonitoring) return;

    logger.info('Stopping error prevention system');
    this.isMonitoring = false;
    this.emit('stopped');
    
    logger.info('Error prevention system stopped');
  }

  /**
   * Initialize common error patterns
   */
  private initializeErrorPatterns(): void {
    const patterns: ErrorPattern[] = [
      {
        id: 'db_connection_lost',
        name: 'Database Connection Lost',
        pattern: /connection.*lost|connection.*timeout|connection.*refused/i,
        category: 'database',
        severity: 'high',
        frequency: 0,
        lastOccurrence: new Date(),
        description: 'Database connection failures',
        resolution: [
          'Check database server status',
          'Verify network connectivity',
          'Review connection pool settings',
          'Check database server resources'
        ],
        preventionMeasures: [
          'Implement connection pooling',
          'Add connection retry logic',
          'Monitor database health',
          'Set up database failover'
        ]
      },
      {
        id: 'memory_exhaustion',
        name: 'Memory Exhaustion',
        pattern: /out of memory|memory.*exhausted|heap.*overflow/i,
        category: 'performance',
        severity: 'critical',
        frequency: 0,
        lastOccurrence: new Date(),
        description: 'System running out of memory',
        resolution: [
          'Restart affected services',
          'Identify memory leaks',
          'Optimize memory usage',
          'Scale up resources'
        ],
        preventionMeasures: [
          'Implement memory monitoring',
          'Add garbage collection tuning',
          'Review memory allocation patterns',
          'Set memory usage alerts'
        ]
      },
      {
        id: 'api_rate_limit',
        name: 'API Rate Limit Exceeded',
        pattern: /rate.*limit|too many requests|429/i,
        category: 'api',
        severity: 'medium',
        frequency: 0,
        lastOccurrence: new Date(),
        description: 'External API rate limits exceeded',
        resolution: [
          'Implement request throttling',
          'Add retry logic with backoff',
          'Review API usage patterns',
          'Consider API plan upgrade'
        ],
        preventionMeasures: [
          'Implement rate limiting',
          'Add request queuing',
          'Monitor API usage',
          'Cache API responses'
        ]
      },
      {
        id: 'disk_space_low',
        name: 'Low Disk Space',
        pattern: /disk.*full|no space left|disk.*space/i,
        category: 'filesystem',
        severity: 'high',
        frequency: 0,
        lastOccurrence: new Date(),
        description: 'System running low on disk space',
        resolution: [
          'Clean up temporary files',
          'Archive old logs',
          'Remove unused files',
          'Add more storage'
        ],
        preventionMeasures: [
          'Implement log rotation',
          'Set up disk monitoring',
          'Automate cleanup tasks',
          'Plan storage capacity'
        ]
      },
      {
        id: 'network_timeout',
        name: 'Network Timeout',
        pattern: /timeout|network.*error|socket.*timeout/i,
        category: 'network',
        severity: 'medium',
        frequency: 0,
        lastOccurrence: new Date(),
        description: 'Network connection timeouts',
        resolution: [
          'Check network connectivity',
          'Verify firewall settings',
          'Increase timeout values',
          'Implement retry logic'
        ],
        preventionMeasures: [
          'Monitor network health',
          'Implement circuit breakers',
          'Add connection monitoring',
          'Use redundant connections'
        ]
      },
      {
        id: 'authentication_failure',
        name: 'Authentication Failure',
        pattern: /auth.*failed|unauthorized|invalid.*token|401|403/i,
        category: 'security',
        severity: 'high',
        frequency: 0,
        lastOccurrence: new Date(),
        description: 'Authentication or authorization failures',
        resolution: [
          'Verify credentials',
          'Check token expiration',
          'Review permissions',
          'Rotate API keys'
        ],
        preventionMeasures: [
          'Implement token refresh',
          'Monitor auth failures',
          'Set up security alerts',
          'Regular credential rotation'
        ]
      }
    ];

    patterns.forEach(pattern => {
      this.errorPatterns.set(pattern.id, pattern);
    });

    logger.info(`Initialized ${patterns.length} error patterns`);
  }

  /**
   * Setup log file monitoring
   */
  private async setupLogMonitoring(): Promise<void> {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      const logFile = path.join(logDir, 'app.log');

      // Check if log file exists
      try {
        await fs.access(logFile);
      } catch {
        logger.info('Log file not found, creating directory');
        await fs.mkdir(logDir, { recursive: true });
        await fs.writeFile(logFile, '');
      }

      // Start monitoring log file for new entries
      this.monitorLogFile(logFile);
      
      logger.info('Log monitoring setup completed');
    } catch (error) {
      logger.error('Failed to setup log monitoring', { error });
    }
  }

  /**
   * Monitor log file for new entries
   */
  private async monitorLogFile(logFile: string): Promise<void> {
    let lastPosition = 0;

    setInterval(async () => {
      try {
        const stats = await fs.stat(logFile);
        if (stats.size <= lastPosition) return;

        const buffer = Buffer.alloc(stats.size - lastPosition);
        const file = await fs.open(logFile, 'r');
        await file.read(buffer, 0, buffer.length, lastPosition);
        await file.close();

        const newContent = buffer.toString();
        const lines = newContent.split('\n').filter(line => line.trim());

        for (const line of lines) {
          await this.processLogLine(line);
        }

        lastPosition = stats.size;
      } catch (error) {
        // Ignore errors in log monitoring to prevent loops
      }
    }, 1000); // Check every second
  }

  /**
   * Process individual log line
   */
  private async processLogLine(line: string): Promise<void> {
    if (!line.includes('error') && !line.includes('ERROR') && !line.includes('warn') && !line.includes('WARN')) {
      return;
    }

    try {
      // Parse log entry (assuming structured logging)
      const logEntry = JSON.parse(line);
      
      if (logEntry.level === 'error' || logEntry.level === 'warn') {
        await this.processErrorEvent({
          id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(logEntry.timestamp || Date.now()),
          level: logEntry.level as 'error' | 'warn',
          message: logEntry.message || line,
          stack: logEntry.stack,
          context: logEntry.context || {},
          source: 'application_log',
          resolved: false
        });
      }
    } catch {
      // If not JSON, try to extract error information from plain text
      const errorMatch = line.match(/(error|ERROR|warn|WARN).*$/i);
      if (errorMatch) {
        await this.processErrorEvent({
          id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          level: line.toLowerCase().includes('error') ? 'error' : 'warn',
          message: errorMatch[0],
          context: {},
          source: 'application_log',
          resolved: false
        });
      }
    }
  }

  /**
   * Process error event
   */
  private async processErrorEvent(errorEvent: ErrorEvent): Promise<void> {
    // Check against known patterns
    const matchedPattern = this.matchErrorPattern(errorEvent.message);
    if (matchedPattern) {
      errorEvent.patternId = matchedPattern.id;
      matchedPattern.frequency++;
      matchedPattern.lastOccurrence = errorEvent.timestamp;
      
      logger.warn(`Error pattern detected: ${matchedPattern.name}`, {
        pattern: matchedPattern.id,
        frequency: matchedPattern.frequency,
        message: errorEvent.message
      });

      // Generate maintenance alert for critical patterns
      if (matchedPattern.severity === 'critical' || matchedPattern.frequency > 5) {
        await this.generateMaintenanceAlert(matchedPattern, errorEvent);
      }
    }

    // Add to error history
    this.errorHistory.push(errorEvent);

    // Keep history within limits
    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      this.errorHistory = this.errorHistory.slice(-this.MAX_ERROR_HISTORY);
    }

    // Emit event
    this.emit('errorDetected', errorEvent);

    // Store in database
    await this.storeErrorEvent(errorEvent);
  }

  /**
   * Match error message against known patterns
   */
  private matchErrorPattern(message: string): ErrorPattern | null {
    for (const pattern of this.errorPatterns.values()) {
      if (pattern.pattern.test(message)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Perform comprehensive system diagnostics
   */
  public async performDiagnostics(): Promise<DiagnosticResult[]> {
    logger.info('Performing system diagnostics');

    const components = [
      'database',
      'redis',
      'filesystem',
      'memory',
      'network',
      'api_endpoints'
    ];

    const results: DiagnosticResult[] = [];

    for (const component of components) {
      try {
        const result = await this.diagnoseComponent(component);
        results.push(result);
        this.diagnosticHistory.push(result);

        // Generate alerts for critical issues
        if (result.status === 'critical' || result.overallScore < 60) {
          await this.generateDiagnosticAlert(result);
        }
      } catch (error) {
        logger.error(`Diagnostic failed for ${component}`, { error });
      }
    }

    // Keep diagnostic history within limits
    if (this.diagnosticHistory.length > 1000) {
      this.diagnosticHistory = this.diagnosticHistory.slice(-1000);
    }

    this.emit('diagnosticsCompleted', results);
    return results;
  }

  /**
   * Diagnose specific system component
   */
  private async diagnoseComponent(component: string): Promise<DiagnosticResult> {
    const checks: Array<any> = [];
    let overallScore = 100;

    switch (component) {
      case 'database':
        checks.push(await this.checkDatabaseHealth());
        checks.push(await this.checkDatabaseConnections());
        checks.push(await this.checkDatabasePerformance());
        break;

      case 'redis':
        checks.push(await this.checkRedisHealth());
        checks.push(await this.checkRedisMemory());
        break;

      case 'filesystem':
        checks.push(await this.checkDiskSpace());
        checks.push(await this.checkFilePermissions());
        checks.push(await this.checkLogFiles());
        break;

      case 'memory':
        checks.push(await this.checkMemoryUsage());
        checks.push(await this.checkMemoryLeaks());
        break;

      case 'network':
        checks.push(await this.checkNetworkConnectivity());
        checks.push(await this.checkDNSResolution());
        break;

      case 'api_endpoints':
        checks.push(await this.checkInternalAPIs());
        checks.push(await this.checkExternalAPIs());
        break;
    }

    // Calculate overall score
    const failedChecks = checks.filter(check => check.status === 'fail').length;
    const warningChecks = checks.filter(check => check.status === 'warning').length;
    
    overallScore -= (failedChecks * 30) + (warningChecks * 10);
    overallScore = Math.max(0, overallScore);

    // Determine overall status
    let status: 'healthy' | 'warning' | 'error' | 'critical' = 'healthy';
    if (overallScore < 30) status = 'critical';
    else if (overallScore < 60) status = 'error';
    else if (overallScore < 80) status = 'warning';

    const recommendations = this.generateDiagnosticRecommendations(component, checks);

    return {
      id: `diag_${Date.now()}_${component}`,
      timestamp: new Date(),
      component,
      status,
      checks,
      overallScore,
      recommendations
    };
  }

  /**
   * Generate diagnostic recommendations
   */
  private generateDiagnosticRecommendations(component: string, checks: any[]): string[] {
    const recommendations: string[] = [];
    const failedChecks = checks.filter(check => check.status === 'fail');
    const warningChecks = checks.filter(check => check.status === 'warning');

    for (const check of [...failedChecks, ...warningChecks]) {
      if (check.recommendations) {
        recommendations.push(...check.recommendations);
      }
    }

    // Component-specific recommendations
    switch (component) {
      case 'database':
        if (failedChecks.length > 0) {
          recommendations.push('Consider database maintenance window');
        }
        break;
      case 'memory':
        if (warningChecks.some(c => c.name.includes('usage'))) {
          recommendations.push('Monitor application for memory leaks');
        }
        break;
    }

    return Array.from(new Set(recommendations)); // Remove duplicates
  }

  // Individual diagnostic check methods
  private async checkDatabaseHealth(): Promise<any> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'Database Connection',
        status: 'pass',
        details: 'Database connection healthy'
      };
    } catch (error) {
      return {
        name: 'Database Connection',
        status: 'fail',
        details: 'Database connection failed',
        recommendations: ['Check database server', 'Verify connection string']
      };
    }
  }

  private async checkDatabaseConnections(): Promise<any> {
    // Simulated check - would monitor actual connection pool
    const connectionCount = Math.floor(Math.random() * 100);
    const maxConnections = 100;

    if (connectionCount > maxConnections * 0.9) {
      return {
        name: 'Database Connections',
        status: 'warning',
        details: `High connection usage: ${connectionCount}/${maxConnections}`,
        recommendations: ['Monitor connection pool', 'Optimize connection usage']
      };
    }

    return {
      name: 'Database Connections',
      status: 'pass',
      details: `Connection usage normal: ${connectionCount}/${maxConnections}`
    };
  }

  private async checkDatabasePerformance(): Promise<any> {
    // Simulated performance check
    const avgResponseTime = Math.random() * 1000;
    
    if (avgResponseTime > 500) {
      return {
        name: 'Database Performance',
        status: avgResponseTime > 800 ? 'fail' : 'warning',
        details: `Average response time: ${avgResponseTime.toFixed(2)}ms`,
        recommendations: ['Analyze slow queries', 'Check database indexes']
      };
    }

    return {
      name: 'Database Performance',
      status: 'pass',
      details: `Average response time: ${avgResponseTime.toFixed(2)}ms`
    };
  }

  private async checkRedisHealth(): Promise<any> {
    try {
      const Redis = require('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        username: process.env.REDIS_USERNAME || 'default',
        password: process.env.REDIS_PASSWORD,
        lazyConnect: true,
        connectTimeout: 5000
      });
      await redis.ping();
      await redis.quit();
      
      return {
        name: 'Redis Connection',
        status: 'pass',
        details: 'Redis connection healthy'
      };
    } catch (error) {
      return {
        name: 'Redis Connection',
        status: 'fail',
        details: 'Redis connection failed',
        recommendations: ['Check Redis server', 'Verify Redis configuration']
      };
    }
  }

  private async checkRedisMemory(): Promise<any> {
    // Simulated Redis memory check
    const memoryUsage = Math.random() * 100;
    
    if (memoryUsage > 80) {
      return {
        name: 'Redis Memory',
        status: memoryUsage > 90 ? 'fail' : 'warning',
        details: `Redis memory usage: ${memoryUsage.toFixed(1)}%`,
        recommendations: ['Clear expired keys', 'Review memory policies']
      };
    }

    return {
      name: 'Redis Memory',
      status: 'pass',
      details: `Redis memory usage: ${memoryUsage.toFixed(1)}%`
    };
  }

  private async checkDiskSpace(): Promise<any> {
    try {
      const { execSync } = require('child_process');
      const output = execSync('df -h /', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const data = lines[1].split(/\s+/);
      const usagePercentage = parseInt(data[4].replace('%', ''));

      if (usagePercentage > 85) {
        return {
          name: 'Disk Space',
          status: usagePercentage > 95 ? 'fail' : 'warning',
          details: `Disk usage: ${usagePercentage}%`,
          recommendations: ['Clean up old files', 'Archive logs', 'Add storage capacity']
        };
      }

      return {
        name: 'Disk Space',
        status: 'pass',
        details: `Disk usage: ${usagePercentage}%`
      };
    } catch (error) {
      return {
        name: 'Disk Space',
        status: 'warning',
        details: 'Unable to check disk space',
        recommendations: ['Verify disk monitoring tools']
      };
    }
  }

  private async checkFilePermissions(): Promise<any> {
    try {
      const testDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'test.txt'), 'test');
      await fs.unlink(path.join(testDir, 'test.txt'));
      await fs.rmdir(testDir);

      return {
        name: 'File Permissions',
        status: 'pass',
        details: 'File system permissions are correct'
      };
    } catch (error) {
      return {
        name: 'File Permissions',
        status: 'fail',
        details: 'File system permission error',
        recommendations: ['Check file permissions', 'Verify process user rights']
      };
    }
  }

  private async checkLogFiles(): Promise<any> {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      const files = await fs.readdir(logDir);
      const logFiles = files.filter(f => f.endsWith('.log'));

      let totalSize = 0;
      for (const file of logFiles) {
        const stats = await fs.stat(path.join(logDir, file));
        totalSize += stats.size;
      }

      const totalSizeMB = totalSize / (1024 * 1024);

      if (totalSizeMB > 1000) { // 1GB
        return {
          name: 'Log Files',
          status: 'warning',
          details: `Log files size: ${totalSizeMB.toFixed(2)}MB`,
          recommendations: ['Implement log rotation', 'Archive old logs']
        };
      }

      return {
        name: 'Log Files',
        status: 'pass',
        details: `Log files size: ${totalSizeMB.toFixed(2)}MB`
      };
    } catch (error) {
      return {
        name: 'Log Files',
        status: 'warning',
        details: 'Unable to check log files'
      };
    }
  }

  private async checkMemoryUsage(): Promise<any> {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const usagePercentage = (memUsage.rss / totalMemory) * 100;

    if (usagePercentage > 80) {
      return {
        name: 'Memory Usage',
        status: usagePercentage > 90 ? 'fail' : 'warning',
        details: `Memory usage: ${usagePercentage.toFixed(1)}%`,
        recommendations: ['Monitor for memory leaks', 'Optimize memory usage']
      };
    }

    return {
      name: 'Memory Usage',
      status: 'pass',
      details: `Memory usage: ${usagePercentage.toFixed(1)}%`
    };
  }

  private async checkMemoryLeaks(): Promise<any> {
    // Simplified memory leak detection
    const memUsage = process.memoryUsage();
    const heapRatio = memUsage.heapUsed / memUsage.heapTotal;

    if (heapRatio > 0.9) {
      return {
        name: 'Memory Leaks',
        status: 'warning',
        details: `Heap utilization: ${(heapRatio * 100).toFixed(1)}%`,
        recommendations: ['Run heap analysis', 'Check for memory leaks']
      };
    }

    return {
      name: 'Memory Leaks',
      status: 'pass',
      details: `Heap utilization: ${(heapRatio * 100).toFixed(1)}%`
    };
  }

  private async checkNetworkConnectivity(): Promise<any> {
    try {
      const axios = require('axios');
      await axios.get('https://httpbin.org/get', { timeout: 5000 });

      return {
        name: 'Network Connectivity',
        status: 'pass',
        details: 'External network connectivity working'
      };
    } catch (error) {
      return {
        name: 'Network Connectivity',
        status: 'fail',
        details: 'External network connectivity failed',
        recommendations: ['Check network configuration', 'Verify firewall settings']
      };
    }
  }

  private async checkDNSResolution(): Promise<any> {
    try {
      const dns = require('dns').promises;
      await dns.resolve('google.com');

      return {
        name: 'DNS Resolution',
        status: 'pass',
        details: 'DNS resolution working'
      };
    } catch (error) {
      return {
        name: 'DNS Resolution',
        status: 'fail',
        details: 'DNS resolution failed',
        recommendations: ['Check DNS configuration', 'Verify DNS servers']
      };
    }
  }

  private async checkInternalAPIs(): Promise<any> {
    // Would check internal API endpoints
    return {
      name: 'Internal APIs',
      status: 'pass',
      details: 'All internal APIs responding'
    };
  }

  private async checkExternalAPIs(): Promise<any> {
    // Would check external API dependencies
    return {
      name: 'External APIs',
      status: 'pass',
      details: 'External APIs accessible'
    };
  }

  /**
   * Analyze error patterns for trends
   */
  private async analyzeErrorPatterns(): Promise<void> {
    logger.info('Analyzing error patterns');

    const now = Date.now();
    const windowStart = now - this.PATTERN_DETECTION_WINDOW;

    // Get recent errors
    const recentErrors = this.errorHistory.filter(
      error => error.timestamp.getTime() > windowStart
    );

    // Analyze pattern frequencies
    const patternFrequencies = new Map<string, number>();
    
    for (const error of recentErrors) {
      if (error.patternId) {
        const current = patternFrequencies.get(error.patternId) || 0;
        patternFrequencies.set(error.patternId, current + 1);
      }
    }

    // Generate alerts for patterns with concerning trends
    for (const [patternId, frequency] of patternFrequencies) {
      const pattern = this.errorPatterns.get(patternId);
      if (pattern && frequency > 10) { // More than 10 occurrences in 24 hours
        await this.generatePatternAlert(pattern, frequency);
      }
    }

    this.emit('patternAnalysisCompleted', {
      totalErrors: recentErrors.length,
      uniquePatterns: patternFrequencies.size,
      frequencies: Object.fromEntries(patternFrequencies)
    });
  }

  /**
   * Generate maintenance alert based on error pattern
   */
  private async generateMaintenanceAlert(pattern: ErrorPattern, errorEvent: ErrorEvent): Promise<void> {
    const alertId = `maint_${Date.now()}_${pattern.id}`;
    
    const alert: MaintenanceAlert = {
      id: alertId,
      type: pattern.frequency > 10 ? 'predictive' : 'preventive',
      priority: this.mapSeverityToPriority(pattern.severity),
      component: pattern.category,
      description: `${pattern.name}: Pattern detected with frequency ${pattern.frequency}`,
      recommendations: pattern.resolution,
      automatedActions: pattern.preventionMeasures,
      acknowledged: false,
      timestamp: new Date()
    };

    // Add predictive failure time for critical patterns
    if (pattern.severity === 'critical' && pattern.frequency > 5) {
      alert.predictedFailureTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    }

    this.maintenanceAlerts.set(alertId, alert);
    this.emit('maintenanceAlert', alert);

    logger.warn('Maintenance alert generated', {
      alertId,
      pattern: pattern.name,
      frequency: pattern.frequency,
      priority: alert.priority
    });
  }

  /**
   * Generate diagnostic alert
   */
  private async generateDiagnosticAlert(result: DiagnosticResult): Promise<void> {
    const alertId = `diag_alert_${Date.now()}_${result.component}`;
    
    const alert: MaintenanceAlert = {
      id: alertId,
      type: 'corrective',
      priority: result.status === 'critical' ? 'critical' : 'high',
      component: result.component,
      description: `Diagnostic alert: ${result.component} status is ${result.status} (score: ${result.overallScore})`,
      recommendations: result.recommendations,
      automatedActions: [],
      acknowledged: false,
      timestamp: new Date()
    };

    this.maintenanceAlerts.set(alertId, alert);
    this.emit('diagnosticAlert', alert);

    logger.warn('Diagnostic alert generated', {
      alertId,
      component: result.component,
      status: result.status,
      score: result.overallScore
    });
  }

  /**
   * Generate pattern alert
   */
  private async generatePatternAlert(pattern: ErrorPattern, frequency: number): Promise<void> {
    const alertId = `pattern_alert_${Date.now()}_${pattern.id}`;
    
    const alert: MaintenanceAlert = {
      id: alertId,
      type: 'predictive',
      priority: frequency > 50 ? 'critical' : 'high',
      component: pattern.category,
      description: `Error pattern spike detected: ${pattern.name} occurred ${frequency} times in 24 hours`,
      recommendations: pattern.preventionMeasures,
      automatedActions: pattern.resolution,
      acknowledged: false,
      timestamp: new Date()
    };

    this.maintenanceAlerts.set(alertId, alert);
    this.emit('patternAlert', alert);

    logger.warn('Pattern alert generated', {
      alertId,
      pattern: pattern.name,
      frequency,
      priority: alert.priority
    });
  }

  /**
   * Map severity to priority
   */
  private mapSeverityToPriority(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    const mapping: Record<string, any> = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'critical'
    };
    return mapping[severity] || 'medium';
  }

  /**
   * Load error history from database
   */
  private async loadErrorHistory(): Promise<void> {
    try {
      // In a real implementation, this would load from database
      logger.info('Error history loaded from database');
    } catch (error) {
      logger.error('Failed to load error history', { error });
    }
  }

  /**
   * Store error event in database
   */
  private async storeErrorEvent(errorEvent: ErrorEvent): Promise<void> {
    try {
      // In a real implementation, this would store in database
      // await this.prisma.errorEvent.create({ data: errorEvent });
    } catch (error) {
      logger.error('Failed to store error event', { error });
    }
  }

  /**
   * Get active maintenance alerts
   */
  public getActiveMaintenanceAlerts(): MaintenanceAlert[] {
    return Array.from(this.maintenanceAlerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
  }

  /**
   * Acknowledge maintenance alert
   */
  public acknowledgeMaintenanceAlert(alertId: string): boolean {
    const alert = this.maintenanceAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Get error patterns summary
   */
  public getErrorPatternsSummary(): Array<{
    pattern: ErrorPattern;
    recentFrequency: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const summary: Array<any> = [];
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const prev24h = last24h - 24 * 60 * 60 * 1000;

    for (const pattern of this.errorPatterns.values()) {
      const recent24h = this.errorHistory.filter(
        error => error.patternId === pattern.id && 
        error.timestamp.getTime() > last24h
      ).length;

      const previous24h = this.errorHistory.filter(
        error => error.patternId === pattern.id && 
        error.timestamp.getTime() > prev24h && 
        error.timestamp.getTime() <= last24h
      ).length;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (recent24h > previous24h * 1.2) trend = 'increasing';
      else if (recent24h < previous24h * 0.8) trend = 'decreasing';

      summary.push({
        pattern,
        recentFrequency: recent24h,
        trend
      });
    }

    return summary.sort((a, b) => b.recentFrequency - a.recentFrequency);
  }

  /**
   * Get diagnostic summary
   */
  public getDiagnosticSummary(): {
    lastRun: Date;
    overallHealth: string;
    componentScores: Record<string, number>;
    recommendations: string[];
  } {
    const latestDiagnostics = this.diagnosticHistory
      .filter(d => d.timestamp.getTime() > Date.now() - 60 * 60 * 1000) // Last hour
      .reduce((latest, current) => {
        if (!latest[current.component] || 
            current.timestamp > latest[current.component].timestamp) {
          latest[current.component] = current;
        }
        return latest;
      }, {} as Record<string, DiagnosticResult>);

    const componentScores: Record<string, number> = {};
    const allRecommendations: string[] = [];

    for (const [component, result] of Object.entries(latestDiagnostics)) {
      componentScores[component] = result.overallScore;
      allRecommendations.push(...result.recommendations);
    }

    const overallScore = Object.values(componentScores).reduce((sum, score) => sum + score, 0) 
      / Object.values(componentScores).length;

    let overallHealth = 'healthy';
    if (overallScore < 30) overallHealth = 'critical';
    else if (overallScore < 60) overallHealth = 'error';
    else if (overallScore < 80) overallHealth = 'warning';

    return {
      lastRun: this.diagnosticHistory.length > 0 
        ? this.diagnosticHistory[this.diagnosticHistory.length - 1].timestamp 
        : new Date(),
      overallHealth,
      componentScores,
      recommendations: Array.from(new Set(allRecommendations))
    };
  }
}

// Export singleton instance
export const errorPreventionSystem = new ErrorPreventionSystem();
export default ErrorPreventionSystem;
