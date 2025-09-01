const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');
const os = require('os');
const v8 = require('v8');
const fs = require('fs');
const path = require('path');

/**
 * Application Performance Monitoring Service
 * Tracks performance metrics, traces, and system health
 */
class APMService {
  constructor() {
    this.metrics = {
      requests: new Map(),
      databases: new Map(),
      cache: new Map(),
      custom: new Map()
    };
    
    this.traces = [];
    this.systemMetrics = [];
    this.performanceThresholds = {
      responseTime: 1000, // ms
      dbQueryTime: 100, // ms
      cacheHitRate: 0.8, // 80%
      errorRate: 0.01, // 1%
      cpuUsage: 0.8, // 80%
      memoryUsage: 0.9 // 90%
    };
    
    this.initializeSentry();
    this.startSystemMonitoring();
  }

  /**
   * Initialize Sentry for backend
   */
  initializeSentry() {
    const environment = process.env.NODE_ENV || 'development';
    const dsn = process.env.SENTRY_DSN;

    if (!dsn && environment === 'production') {
      console.warn('Sentry DSN not configured for backend');
      return;
    }

    Sentry.init({
      dsn,
      environment,
      integrations: [
        // HTTP integration
        new Sentry.Integrations.Http({ tracing: true }),
        // Express integration
        new Sentry.Integrations.Express({
          app: true,
          router: true
        }),
        // Profiling
        new ProfilingIntegration(),
        // Prisma/Database
        new Sentry.Integrations.Prisma({ client: true }),
        // GraphQL if used
        new Sentry.Integrations.GraphQL(),
      ],
      
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      profilesSampleRate: 0.1,
      
      release: process.env.APP_VERSION || '1.0.0',
      
      beforeSend(event, hint) {
        // Add server context
        event.contexts = {
          ...event.contexts,
          runtime: {
            name: 'node',
            version: process.version
          },
          server: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            memory: os.totalmem()
          }
        };
        
        // Filter sensitive data
        if (event.request) {
          event.request = this.sanitizeRequest(event.request);
        }
        
        return event;
      },
      
      beforeSendTransaction(transaction) {
        // Add performance metrics
        transaction.setMeasurement('memory.used', process.memoryUsage().heapUsed);
        transaction.setMeasurement('cpu.usage', process.cpuUsage().user);
        
        return transaction;
      }
    });
  }

  /**
   * Start system metrics monitoring
   */
  startSystemMonitoring() {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Cleanup old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      cpu: this.getCPUMetrics(),
      memory: this.getMemoryMetrics(),
      process: this.getProcessMetrics(),
      disk: this.getDiskMetrics(),
      network: this.getNetworkMetrics()
    };

    this.systemMetrics.push(metrics);
    
    // Check thresholds and alert if needed
    this.checkPerformanceThresholds(metrics);
    
    // Keep only last 24 hours of metrics
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.systemMetrics = this.systemMetrics.filter(m => 
      new Date(m.timestamp).getTime() > dayAgo
    );
  }

  /**
   * Get CPU metrics
   */
  getCPUMetrics() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return {
      usage: usage / 100,
      count: cpus.length,
      model: cpus[0].model,
      speed: cpus[0].speed,
      loadAverage: os.loadavg()
    };
  }

  /**
   * Get memory metrics
   */
  getMemoryMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    const processMemory = process.memoryUsage();
    
    return {
      system: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usage: usedMem / totalMem
      },
      process: {
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external,
        arrayBuffers: processMemory.arrayBuffers
      },
      heap: v8.getHeapStatistics()
    };
  }

  /**
   * Get process metrics
   */
  getProcessMetrics() {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      versions: process.versions,
      cpuUsage: process.cpuUsage(),
      resourceUsage: process.resourceUsage ? process.resourceUsage() : null
    };
  }

  /**
   * Get disk metrics
   */
  getDiskMetrics() {
    // This is a simplified version - in production, use a library like 'diskusage'
    const stats = fs.statfsSync(process.cwd());
    
    return {
      available: stats.bavail * stats.bsize,
      free: stats.bfree * stats.bsize,
      total: stats.blocks * stats.bsize,
      usage: 1 - (stats.bavail / stats.blocks)
    };
  }

  /**
   * Get network metrics (placeholder)
   */
  getNetworkMetrics() {
    // In production, integrate with network monitoring tools
    return {
      interfaces: os.networkInterfaces(),
      connections: {
        active: 0,
        established: 0,
        timeWait: 0
      }
    };
  }

  /**
   * Track HTTP request
   */
  trackRequest(req, res, responseTime) {
    const key = `${req.method} ${req.route?.path || req.url}`;
    
    if (!this.metrics.requests.has(key)) {
      this.metrics.requests.set(key, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        statusCodes: {}
      });
    }
    
    const metric = this.metrics.requests.get(key);
    metric.count++;
    metric.totalTime += responseTime;
    metric.minTime = Math.min(metric.minTime, responseTime);
    metric.maxTime = Math.max(metric.maxTime, responseTime);
    
    const statusCode = res.statusCode;
    metric.statusCodes[statusCode] = (metric.statusCodes[statusCode] || 0) + 1;
    
    if (statusCode >= 400) {
      metric.errors++;
    }
    
    // Create trace
    this.addTrace({
      type: 'http',
      method: req.method,
      path: req.route?.path || req.url,
      statusCode,
      responseTime,
      timestamp: new Date().toISOString(),
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // Send to Sentry if slow
    if (responseTime > this.performanceThresholds.responseTime) {
      Sentry.captureMessage(`Slow request: ${key}`, 'warning', {
        tags: {
          path: req.route?.path || req.url,
          method: req.method,
          responseTime
        }
      });
    }
  }

  /**
   * Track database query
   */
  trackDatabaseQuery(query, duration, error = null) {
    const operation = this.extractQueryOperation(query);
    
    if (!this.metrics.databases.has(operation)) {
      this.metrics.databases.set(operation, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0
      });
    }
    
    const metric = this.metrics.databases.get(operation);
    metric.count++;
    metric.totalTime += duration;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);
    
    if (error) {
      metric.errors++;
    }
    
    // Create trace
    this.addTrace({
      type: 'database',
      operation,
      query: this.sanitizeQuery(query),
      duration,
      error: error?.message,
      timestamp: new Date().toISOString()
    });
    
    // Alert on slow queries
    if (duration > this.performanceThresholds.dbQueryTime) {
      console.warn(`Slow database query (${duration}ms):`, operation);
    }
  }

  /**
   * Track cache operation
   */
  trackCacheOperation(operation, key, hit, duration) {
    if (!this.metrics.cache.has(operation)) {
      this.metrics.cache.set(operation, {
        count: 0,
        hits: 0,
        misses: 0,
        totalTime: 0
      });
    }
    
    const metric = this.metrics.cache.get(operation);
    metric.count++;
    metric.totalTime += duration;
    
    if (hit) {
      metric.hits++;
    } else {
      metric.misses++;
    }
    
    // Create trace
    this.addTrace({
      type: 'cache',
      operation,
      key: this.sanitizeKey(key),
      hit,
      duration,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track custom metric
   */
  trackCustomMetric(name, value, unit = 'count', tags = {}) {
    const key = `${name}_${JSON.stringify(tags)}`;
    
    if (!this.metrics.custom.has(key)) {
      this.metrics.custom.set(key, {
        name,
        unit,
        tags,
        values: [],
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity
      });
    }
    
    const metric = this.metrics.custom.get(key);
    metric.values.push({ value, timestamp: Date.now() });
    metric.count++;
    metric.sum += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    
    // Keep only last hour of values
    const hourAgo = Date.now() - 60 * 60 * 1000;
    metric.values = metric.values.filter(v => v.timestamp > hourAgo);
  }

  /**
   * Add trace
   */
  addTrace(trace) {
    this.traces.push(trace);
    
    // Keep only last 1000 traces
    if (this.traces.length > 1000) {
      this.traces = this.traces.slice(-1000);
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport(duration = 3600000) {
    const now = Date.now();
    const since = now - duration;
    
    // Request metrics
    const requests = {};
    for (const [key, metric] of this.metrics.requests) {
      requests[key] = {
        count: metric.count,
        avgResponseTime: metric.totalTime / metric.count,
        minResponseTime: metric.minTime,
        maxResponseTime: metric.maxTime,
        errorRate: metric.errors / metric.count,
        statusCodes: metric.statusCodes
      };
    }
    
    // Database metrics
    const databases = {};
    for (const [key, metric] of this.metrics.databases) {
      databases[key] = {
        count: metric.count,
        avgDuration: metric.totalTime / metric.count,
        minDuration: metric.minTime,
        maxDuration: metric.maxTime,
        errorRate: metric.errors / metric.count
      };
    }
    
    // Cache metrics
    const cache = {};
    for (const [key, metric] of this.metrics.cache) {
      cache[key] = {
        count: metric.count,
        hitRate: metric.hits / metric.count,
        missRate: metric.misses / metric.count,
        avgDuration: metric.totalTime / metric.count
      };
    }
    
    // Custom metrics
    const custom = {};
    for (const [key, metric] of this.metrics.custom) {
      custom[metric.name] = {
        count: metric.count,
        sum: metric.sum,
        avg: metric.sum / metric.count,
        min: metric.min,
        max: metric.max,
        unit: metric.unit,
        tags: metric.tags
      };
    }
    
    // System metrics
    const latestSystemMetrics = this.systemMetrics[this.systemMetrics.length - 1] || {};
    
    return {
      timestamp: new Date().toISOString(),
      duration: duration / 1000, // seconds
      requests,
      databases,
      cache,
      custom,
      system: latestSystemMetrics,
      traces: this.traces.slice(-100) // Last 100 traces
    };
  }

  /**
   * Check performance thresholds
   */
  checkPerformanceThresholds(metrics) {
    const alerts = [];
    
    // Check CPU usage
    if (metrics.cpu.usage > this.performanceThresholds.cpuUsage) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `High CPU usage: ${(metrics.cpu.usage * 100).toFixed(2)}%`
      });
    }
    
    // Check memory usage
    if (metrics.memory.system.usage > this.performanceThresholds.memoryUsage) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${(metrics.memory.system.usage * 100).toFixed(2)}%`
      });
    }
    
    // Check disk usage
    if (metrics.disk.usage > 0.9) {
      alerts.push({
        type: 'disk',
        severity: 'critical',
        message: `Critical disk usage: ${(metrics.disk.usage * 100).toFixed(2)}%`
      });
    }
    
    // Send alerts
    alerts.forEach(alert => {
      console.warn(`[APM Alert] ${alert.message}`);
      Sentry.captureMessage(alert.message, alert.severity);
    });
    
    return alerts;
  }

  /**
   * Cleanup old metrics
   */
  cleanupOldMetrics() {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    
    // Clean traces
    this.traces = this.traces.filter(t => 
      new Date(t.timestamp).getTime() > hourAgo
    );
    
    // Reset metrics if they're too old
    for (const [key, metric] of this.metrics.requests) {
      if (metric.count === 0) {
        this.metrics.requests.delete(key);
      }
    }
  }

  /**
   * Express middleware
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Track response
      const originalSend = res.send;
      res.send = function(data) {
        const responseTime = Date.now() - startTime;
        this.trackRequest(req, res, responseTime);
        return originalSend.call(this, data);
      }.bind(this);
      
      next();
    };
  }

  /**
   * Helper methods
   */
  extractQueryOperation(query) {
    const normalized = query.toLowerCase().trim();
    if (normalized.startsWith('select')) return 'SELECT';
    if (normalized.startsWith('insert')) return 'INSERT';
    if (normalized.startsWith('update')) return 'UPDATE';
    if (normalized.startsWith('delete')) return 'DELETE';
    return 'OTHER';
  }

  sanitizeQuery(query) {
    // Remove sensitive data from query
    return query.substring(0, 100);
  }

  sanitizeKey(key) {
    // Remove sensitive parts from cache keys
    return key.replace(/user:\d+/, 'user:***');
  }

  sanitizeRequest(request) {
    // Remove sensitive headers and data
    const sanitized = { ...request };
    
    if (sanitized.headers) {
      delete sanitized.headers.authorization;
      delete sanitized.headers.cookie;
    }
    
    if (sanitized.data) {
      delete sanitized.data.password;
      delete sanitized.data.token;
      delete sanitized.data.creditCard;
    }
    
    return sanitized;
  }
}

module.exports = new APMService();
