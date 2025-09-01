const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const { ElasticsearchTransport } = require('winston-elasticsearch');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { EventEmitter } = require('events');

/**
 * Log Aggregation Service
 * Centralized logging with search, filtering, and analysis capabilities
 */
class LogAggregationService extends EventEmitter {
  constructor() {
    super();
    
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
    
    this.loggers = new Map();
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.logStats = {
      total: 0,
      byLevel: {},
      byService: {},
      errors: []
    };
    
    this.initializeMainLogger();
    this.startLogRotation();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Initialize main logger
   */
  initializeMainLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const log = {
          timestamp,
          level,
          service: service || 'app',
          message,
          ...meta
        };
        
        // Add to buffer for real-time streaming
        this.addToBuffer(log);
        
        // Update statistics
        this.updateStats(log);
        
        return JSON.stringify(log);
      })
    );

    // Console transport for development
    const consoleTransport = new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    });

    // File transport for all logs
    const fileTransport = new DailyRotateFile({
      filename: path.join(this.logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat
    });

    // Error file transport
    const errorTransport = new DailyRotateFile({
      filename: path.join(this.logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: logFormat
    });

    // Create main logger
    this.mainLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'main' },
      transports: [
        consoleTransport,
        fileTransport,
        errorTransport
      ]
    });

    // Add Elasticsearch transport if configured
    if (process.env.ELASTICSEARCH_URL) {
      this.addElasticsearchTransport();
    }

    // Handle uncaught exceptions and rejections
    this.mainLogger.exceptions.handle(
      new winston.transports.File({ 
        filename: path.join(this.logDir, 'exceptions.log') 
      })
    );

    this.mainLogger.rejections.handle(
      new winston.transports.File({ 
        filename: path.join(this.logDir, 'rejections.log') 
      })
    );
  }

  /**
   * Add Elasticsearch transport for centralized logging
   */
  addElasticsearchTransport() {
    const esTransport = new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL,
        auth: {
          username: process.env.ELASTICSEARCH_USER,
          password: process.env.ELASTICSEARCH_PASS
        }
      },
      index: 'logs',
      dataStream: true,
      transformer: (logData) => {
        return {
          '@timestamp': logData.timestamp,
          severity: logData.level,
          service: logData.service,
          message: logData.message,
          meta: logData.meta,
          environment: process.env.NODE_ENV,
          host: require('os').hostname()
        };
      }
    });

    this.mainLogger.add(esTransport);
  }

  /**
   * Create a child logger for a specific service
   */
  createLogger(service) {
    if (this.loggers.has(service)) {
      return this.loggers.get(service);
    }

    const logger = this.mainLogger.child({ service });
    this.loggers.set(service, logger);
    
    return logger;
  }

  /**
   * Log with context
   */
  log(level, message, meta = {}) {
    const context = {
      ...meta,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    this.mainLogger.log(level, message, context);
  }

  /**
   * Structured logging methods
   */
  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, error, meta = {}) {
    const errorMeta = {
      ...meta,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      }
    };
    
    this.log('error', message, errorMeta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }

  /**
   * Log HTTP request
   */
  logRequest(req, res, responseTime) {
    const log = {
      type: 'http',
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: res.statusCode,
      responseTime,
      userId: req.user?.id,
      sessionId: req.sessionID
    };

    this.info('HTTP Request', log);
  }

  /**
   * Log database query
   */
  logDatabaseQuery(query, duration, error = null) {
    const log = {
      type: 'database',
      query: this.sanitizeQuery(query),
      duration,
      success: !error,
      error: error?.message
    };

    if (error) {
      this.error('Database query failed', error, log);
    } else {
      this.debug('Database query', log);
    }
  }

  /**
   * Log business event
   */
  logEvent(eventName, data = {}) {
    const log = {
      type: 'event',
      event: eventName,
      data,
      timestamp: new Date().toISOString()
    };

    this.info(`Event: ${eventName}`, log);
  }

  /**
   * Log security event
   */
  logSecurityEvent(event, severity = 'warn') {
    const log = {
      type: 'security',
      event: event.type,
      details: event.details,
      ip: event.ip,
      userId: event.userId,
      timestamp: new Date().toISOString()
    };

    this[severity](`Security: ${event.type}`, log);
  }

  /**
   * Add log to buffer for real-time streaming
   */
  addToBuffer(log) {
    this.logBuffer.push(log);
    
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
    
    // Emit for real-time subscribers
    this.emit('log', log);
  }

  /**
   * Update log statistics
   */
  updateStats(log) {
    this.logStats.total++;
    
    // Count by level
    this.logStats.byLevel[log.level] = (this.logStats.byLevel[log.level] || 0) + 1;
    
    // Count by service
    this.logStats.byService[log.service] = (this.logStats.byService[log.service] || 0) + 1;
    
    // Track errors
    if (log.level === 'error') {
      this.logStats.errors.push({
        timestamp: log.timestamp,
        message: log.message,
        service: log.service
      });
      
      // Keep only last 100 errors
      if (this.logStats.errors.length > 100) {
        this.logStats.errors.shift();
      }
    }
  }

  /**
   * Search logs
   */
  async searchLogs(query = {}) {
    const {
      startDate,
      endDate,
      level,
      service,
      searchText,
      limit = 100,
      offset = 0
    } = query;

    const results = [];
    const logFiles = await this.getLogFiles(startDate, endDate);

    for (const file of logFiles) {
      const logs = await this.parseLogFile(file);
      
      for (const log of logs) {
        // Apply filters
        if (level && log.level !== level) continue;
        if (service && log.service !== service) continue;
        if (searchText && !this.matchesSearch(log, searchText)) continue;
        
        results.push(log);
        
        if (results.length >= limit + offset) {
          break;
        }
      }
      
      if (results.length >= limit + offset) {
        break;
      }
    }

    return {
      logs: results.slice(offset, offset + limit),
      total: results.length,
      query
    };
  }

  /**
   * Get log files for date range
   */
  async getLogFiles(startDate, endDate) {
    const files = fs.readdirSync(this.logDir);
    const logFiles = files.filter(f => f.startsWith('application-') && f.endsWith('.log'));
    
    if (!startDate && !endDate) {
      return logFiles.map(f => path.join(this.logDir, f));
    }
    
    return logFiles
      .filter(f => {
        const dateStr = f.match(/\d{4}-\d{2}-\d{2}/)?.[0];
        if (!dateStr) return false;
        
        const fileDate = new Date(dateStr);
        if (startDate && fileDate < new Date(startDate)) return false;
        if (endDate && fileDate > new Date(endDate)) return false;
        
        return true;
      })
      .map(f => path.join(this.logDir, f));
  }

  /**
   * Parse log file
   */
  async parseLogFile(filepath) {
    const logs = [];
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filepath);
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        try {
          const log = JSON.parse(line);
          logs.push(log);
        } catch (error) {
          // Skip malformed lines
        }
      });

      rl.on('close', () => resolve(logs));
      rl.on('error', reject);
    });
  }

  /**
   * Check if log matches search text
   */
  matchesSearch(log, searchText) {
    const searchLower = searchText.toLowerCase();
    return (
      log.message?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log).toLowerCase().includes(searchLower)
    );
  }

  /**
   * Get log statistics
   */
  getStatistics(duration = 3600000) {
    const now = Date.now();
    const since = now - duration;
    
    // Filter recent errors
    const recentErrors = this.logStats.errors.filter(e => 
      new Date(e.timestamp).getTime() > since
    );
    
    return {
      total: this.logStats.total,
      byLevel: this.logStats.byLevel,
      byService: this.logStats.byService,
      recentErrors,
      buffer: this.logBuffer.slice(-50), // Last 50 logs
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Stream logs in real-time
   */
  streamLogs(filters = {}) {
    const stream = new EventEmitter();
    
    // Send initial buffer
    const filtered = this.logBuffer.filter(log => 
      this.matchesFilters(log, filters)
    );
    
    setImmediate(() => {
      filtered.forEach(log => stream.emit('log', log));
    });
    
    // Stream new logs
    const handler = (log) => {
      if (this.matchesFilters(log, filters)) {
        stream.emit('log', log);
      }
    };
    
    this.on('log', handler);
    
    // Cleanup method
    stream.stop = () => {
      this.removeListener('log', handler);
    };
    
    return stream;
  }

  /**
   * Check if log matches filters
   */
  matchesFilters(log, filters) {
    if (filters.level && log.level !== filters.level) return false;
    if (filters.service && log.service !== filters.service) return false;
    if (filters.type && log.type !== filters.type) return false;
    return true;
  }

  /**
   * Analyze log patterns
   */
  async analyzeLogs(duration = 3600000) {
    const logs = await this.searchLogs({
      startDate: new Date(Date.now() - duration),
      limit: 10000
    });

    const analysis = {
      patterns: {},
      anomalies: [],
      trends: {},
      recommendations: []
    };

    // Analyze error patterns
    const errors = logs.logs.filter(l => l.level === 'error');
    const errorPatterns = {};
    
    errors.forEach(error => {
      const pattern = this.extractErrorPattern(error);
      errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
    });
    
    analysis.patterns.errors = errorPatterns;

    // Detect anomalies
    const requestLogs = logs.logs.filter(l => l.type === 'http');
    const avgResponseTime = requestLogs.reduce((sum, l) => sum + (l.responseTime || 0), 0) / requestLogs.length;
    
    requestLogs.forEach(log => {
      if (log.responseTime > avgResponseTime * 3) {
        analysis.anomalies.push({
          type: 'slow_request',
          url: log.url,
          responseTime: log.responseTime,
          timestamp: log.timestamp
        });
      }
    });

    // Calculate trends
    const hourlyLogs = {};
    logs.logs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      hourlyLogs[hour] = (hourlyLogs[hour] || 0) + 1;
    });
    
    analysis.trends.hourly = hourlyLogs;

    // Generate recommendations
    if (Object.keys(errorPatterns).length > 10) {
      analysis.recommendations.push({
        type: 'high_error_variety',
        message: 'High variety of errors detected. Consider implementing better error handling.'
      });
    }

    if (analysis.anomalies.length > 10) {
      analysis.recommendations.push({
        type: 'performance_issues',
        message: 'Multiple performance anomalies detected. Review application performance.'
      });
    }

    return analysis;
  }

  /**
   * Extract error pattern
   */
  extractErrorPattern(error) {
    if (error.error?.code) return error.error.code;
    if (error.error?.name) return error.error.name;
    return error.message?.substring(0, 50) || 'unknown';
  }

  /**
   * Export logs
   */
  async exportLogs(query, format = 'json') {
    const results = await this.searchLogs(query);
    
    if (format === 'json') {
      return JSON.stringify(results.logs, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(results.logs);
    } else {
      throw new Error('Unsupported export format');
    }
  }

  /**
   * Convert logs to CSV
   */
  convertToCSV(logs) {
    if (logs.length === 0) return '';
    
    const headers = Object.keys(logs[0]);
    const rows = logs.map(log => 
      headers.map(h => JSON.stringify(log[h] || '')).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Start log rotation
   */
  startLogRotation() {
    // Clean old logs every day
    setInterval(() => {
      this.cleanOldLogs();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Clean old log files
   */
  cleanOldLogs() {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = Date.now();
    
    const files = fs.readdirSync(this.logDir);
    
    files.forEach(file => {
      const filepath = path.join(this.logDir, file);
      const stats = fs.statSync(filepath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filepath);
        this.info(`Deleted old log file: ${file}`);
      }
    });
  }

  /**
   * Sanitize sensitive data from queries
   */
  sanitizeQuery(query) {
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '****-****-****-****');
  }

  /**
   * Express middleware
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Log response
      const originalSend = res.send;
      res.send = function(data) {
        const responseTime = Date.now() - startTime;
        this.logRequest(req, res, responseTime);
        return originalSend.call(this, data);
      }.bind(this);
      
      next();
    };
  }
}

module.exports = new LogAggregationService();
