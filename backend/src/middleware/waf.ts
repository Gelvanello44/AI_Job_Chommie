/**
 * Web Application Firewall (WAF) Middleware
 * Implements custom security rules, request inspection, and automated threat response
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export interface WAFRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  pattern: RegExp;
  target: 'url' | 'headers' | 'body' | 'query' | 'all';
  action: 'block' | 'log' | 'challenge' | 'rate_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  blockDuration?: number; // seconds
  rateLimitWindow?: number; // milliseconds
  rateLimitMax?: number;
}

export interface WAFConfig {
  enabled: boolean;
  logAllRequests: boolean;
  blockSuspiciousRequests: boolean;
  enableCustomRules: boolean;
  enableOWASPRules: boolean;
  defaultAction: 'block' | 'log';
  maxRequestSize: number; // bytes
  enableGeoBlocking: boolean;
  blockedCountries: string[];
  trustedUserAgents: string[];
  suspiciousUserAgents: string[];
}

export interface WAFRequest extends Request {
  wafInfo?: {
    ruleTriggered?: string;
    action: string;
    severity: string;
    riskScore: number;
    blocked: boolean;
  };
}

export interface WAFIncident {
  id: string;
  timestamp: Date;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  ruleTriggered: string;
  action: string;
  severity: string;
  payload?: any;
  blocked: boolean;
}

class WAFManager {
  private config: WAFConfig;
  private rules: Map<string, WAFRule> = new Map();
  private incidents: Map<string, WAFIncident[]> = new Map();

  constructor(config?: Partial<WAFConfig>) {
    this.config = {
      enabled: true,
      logAllRequests: false,
      blockSuspiciousRequests: true,
      enableCustomRules: true,
      enableOWASPRules: true,
      defaultAction: 'block',
      maxRequestSize: 1024 * 1024, // 1MB
      enableGeoBlocking: false,
      blockedCountries: [],
      trustedUserAgents: [
        'GoogleBot',
        'BingBot',
        'SlackBot',
        'facebookexternalhit'
      ],
      suspiciousUserAgents: [
        'curl',
        'wget',
        'python-requests',
        'PostmanRuntime',
        'Insomnia'
      ],
      ...config
    };

    this.initializeRules();
    this.startIncidentCleanup();
  }

  /**
   * Initialize default WAF rules
   */
  private initializeRules(): void {
    const defaultRules: WAFRule[] = [
      // SQL Injection Rules
      {
        id: 'sql_injection_1',
        name: 'SQL Injection - UNION attacks',
        description: 'Detects SQL UNION injection attempts',
        enabled: true,
        priority: 1,
        pattern: /(union\s+(all\s+)?select|union\s+select)/gi,
        target: 'all',
        action: 'block',
        severity: 'high',
        blockDuration: 3600
      },
      {
        id: 'sql_injection_2',
        name: 'SQL Injection - Comment attacks',
        description: 'Detects SQL comment injection attempts',
        enabled: true,
        priority: 1,
        pattern: /(--|\/\*|\*\/|#)/g,
        target: 'all',
        action: 'block',
        severity: 'high',
        blockDuration: 3600
      },
      {
        id: 'sql_injection_3',
        name: 'SQL Injection - Common patterns',
        description: 'Detects common SQL injection patterns',
        enabled: true,
        priority: 1,
        pattern: /((\%27)|(\'))\s*((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
        target: 'all',
        action: 'block',
        severity: 'high',
        blockDuration: 3600
      },

      // XSS Rules
      {
        id: 'xss_script_tag',
        name: 'XSS - Script tag injection',
        description: 'Detects script tag injection attempts',
        enabled: true,
        priority: 1,
        pattern: /<script[^>]*>.*?<\/script>/gi,
        target: 'all',
        action: 'block',
        severity: 'high',
        blockDuration: 1800
      },
      {
        id: 'xss_javascript_protocol',
        name: 'XSS - JavaScript protocol',
        description: 'Detects javascript: protocol usage',
        enabled: true,
        priority: 1,
        pattern: /javascript\s*:/gi,
        target: 'all',
        action: 'block',
        severity: 'medium',
        blockDuration: 1800
      },
      {
        id: 'xss_event_handlers',
        name: 'XSS - Event handlers',
        description: 'Detects HTML event handler injection',
        enabled: true,
        priority: 2,
        pattern: /on(load|error|click|mouseover|focus|blur|submit)\s*=/gi,
        target: 'all',
        action: 'block',
        severity: 'medium',
        blockDuration: 1800
      },

      // Path Traversal Rules
      {
        id: 'path_traversal',
        name: 'Path Traversal',
        description: 'Detects directory traversal attempts',
        enabled: true,
        priority: 1,
        pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/gi,
        target: 'url',
        action: 'block',
        severity: 'high',
        blockDuration: 3600
      },

      // Command Injection Rules
      {
        id: 'command_injection',
        name: 'Command Injection',
        description: 'Detects command injection attempts',
        enabled: true,
        priority: 1,
        pattern: /(\||&|;|`|\$\(|\${)/g,
        target: 'all',
        action: 'block',
        severity: 'high',
        blockDuration: 3600
      },

      // File Upload Rules
      {
        id: 'malicious_file_upload',
        name: 'Malicious File Upload',
        description: 'Detects potentially malicious file uploads',
        enabled: true,
        priority: 2,
        pattern: /\.(php|asp|aspx|jsp|exe|bat|cmd|scr|vbs|js|jar|py|rb|pl|sh)$/gi,
        target: 'all',
        action: 'block',
        severity: 'high',
        blockDuration: 3600
      },

      // Bot Detection Rules
      {
        id: 'suspicious_user_agent',
        name: 'Suspicious User Agent',
        description: 'Detects suspicious user agents',
        enabled: true,
        priority: 3,
        pattern: /(sqlmap|nmap|nikto|masscan|zap|burp|w3af|acunetix|netsparker)/gi,
        target: 'headers',
        action: 'block',
        severity: 'medium',
        blockDuration: 1800
      },

      // Rate Limiting Rules
      {
        id: 'api_abuse',
        name: 'API Abuse Detection',
        description: 'Detects API abuse patterns',
        enabled: true,
        priority: 4,
        pattern: /(\/api\/.*){20,}/g, // More than 20 API calls in pattern
        target: 'url',
        action: 'rate_limit',
        severity: 'medium',
        rateLimitWindow: 60000,
        rateLimitMax: 50
      },

      // OWASP Top 10 Rules
      {
        id: 'owasp_injection',
        name: 'OWASP - Injection',
        description: 'OWASP Top 10 - Injection attacks',
        enabled: true,
        priority: 1,
        pattern: /(\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b|\bexec\b)/gi,
        target: 'all',
        action: 'log',
        severity: 'medium'
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });

    logger.info('WAF rules initialized', { totalRules: this.rules.size });
  }

  /**
   * Get target content from request
   */
  private getTargetContent(req: Request, target: string): string {
    switch (target) {
      case 'url':
        return req.originalUrl || req.url;
      case 'headers':
        return JSON.stringify(req.headers);
      case 'body':
        return typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      case 'query':
        return JSON.stringify(req.query);
      case 'all':
        return JSON.stringify({
          url: req.originalUrl || req.url,
          headers: req.headers,
          body: req.body,
          query: req.query
        });
      default:
        return '';
    }
  }

  /**
   * Evaluate request against WAF rules
   */
  private async evaluateRequest(req: Request): Promise<{
    triggered: boolean;
    rules: {
      ruleId: string;
      ruleName: string;
      action: string;
      severity: string;
      match: string;
    }[];
    highestSeverity: string;
    recommendedAction: string;
  }> {
    const triggeredRules = [];
    let highestSeverityLevel = 0;
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };

    // Sort rules by priority
    const sortedRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      const content = this.getTargetContent(req, rule.target);
      const matches = content.match(rule.pattern);

      if (matches) {
        triggeredRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
          severity: rule.severity,
          match: matches[0].substring(0, 100) // Truncate match for logging
        });

        const currentSeverityLevel = severityLevels[rule.severity];
        if (currentSeverityLevel > highestSeverityLevel) {
          highestSeverityLevel = currentSeverityLevel;
        }
      }
    }

    const highestSeverity = Object.keys(severityLevels)[highestSeverityLevel - 1] || 'low';
    const recommendedAction = this.determineRecommendedAction(triggeredRules);

    return {
      triggered: triggeredRules.length > 0,
      rules: triggeredRules,
      highestSeverity,
      recommendedAction
    };
  }

  /**
   * Determine recommended action based on triggered rules
   */
  private determineRecommendedAction(triggeredRules: any[]): string {
    if (triggeredRules.length === 0) return 'allow';

    const hasBlockAction = triggeredRules.some(rule => rule.action === 'block');
    const hasCriticalSeverity = triggeredRules.some(rule => rule.severity === 'critical');
    const hasHighSeverity = triggeredRules.some(rule => rule.severity === 'high');

    if (hasBlockAction || hasCriticalSeverity) return 'block';
    if (hasHighSeverity) return 'challenge';
    return 'log';
  }

  /**
   * Log security incident
   */
  private async logIncident(req: Request, evaluation: any): Promise<void> {
    try {
      const clientIP = this.getClientIP(req);
      const incident: WAFIncident = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        ip: clientIP,
        userAgent: req.headers['user-agent'] || 'unknown',
        path: req.path,
        method: req.method,
        ruleTriggered: evaluation.rules.map((r: any) => r.ruleName).join(', '),
        action: evaluation.recommendedAction,
        severity: evaluation.highestSeverity,
        payload: {
          headers: req.headers,
          body: req.body,
          query: req.query
        },
        blocked: evaluation.recommendedAction === 'block'
      };

      // Store incident in Redis with expiry
      const incidentKey = `waf:incidents:${clientIP}:${incident.id}`;
      await redis.setex(incidentKey, 24 * 60 * 60, JSON.stringify(incident)); // 24 hours

      // Add to IP-specific incidents list
      if (!this.incidents.has(clientIP)) {
        this.incidents.set(clientIP, []);
      }
      this.incidents.get(clientIP)!.push(incident);

      // Keep only last 50 incidents per IP in memory
      const ipIncidents = this.incidents.get(clientIP)!;
      if (ipIncidents.length > 50) {
        this.incidents.set(clientIP, ipIncidents.slice(-50));
      }

      logger.warn('WAF security incident logged', {
        incidentId: incident.id,
        ip: clientIP,
        path: req.path,
        rulesTriggered: evaluation.rules.length,
        severity: evaluation.highestSeverity,
        action: evaluation.recommendedAction
      });

    } catch (error) {
      logger.error('Error logging WAF incident', { error: error.message });
    }
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Block IP for specified duration
   */
  private async blockIP(ip: string, reason: string, duration: number): Promise<void> {
    try {
      const blockData = {
        reason,
        blockedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (duration * 1000)).toISOString(),
        source: 'WAF'
      };

      const blockKey = `waf:blocked:${ip}`;
      await redis.setex(blockKey, duration, JSON.stringify(blockData));

      logger.warn('IP blocked by WAF', { ip, reason, duration });
    } catch (error) {
      logger.error('Error blocking IP in WAF', { ip, error: error.message });
    }
  }

  /**
   * Check if IP is blocked by WAF
   */
  private async isIPBlocked(ip: string): Promise<boolean> {
    try {
      const blockKey = `waf:blocked:${ip}`;
      const blockData = await redis.get(blockKey);
      return !!blockData;
    } catch (error) {
      logger.error('Error checking WAF IP block status', { ip, error: error.message });
      return false;
    }
  }

  /**
   * Main WAF middleware
   */
  inspect() {
    return async (req: WAFRequest, res: Response, next: NextFunction) => {
      try {
        if (!this.config.enabled) {
          return next();
        }

        const clientIP = this.getClientIP(req);
        const userAgent = req.headers['user-agent'] || 'unknown';

        // Check if IP is already blocked
        if (await this.isIPBlocked(clientIP)) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'IP_BLOCKED_BY_WAF',
              message: 'Access denied by Web Application Firewall'
            }
          });
        }

        // Check request size
        const contentLength = parseInt(req.headers['content-length'] || '0');
        if (contentLength > this.config.maxRequestSize) {
          await this.logIncident(req, {
            rules: [{ ruleName: 'Request Size Limit', severity: 'medium' }],
            recommendedAction: 'block',
            highestSeverity: 'medium'
          });

          return res.status(413).json({
            success: false,
            error: {
              code: 'REQUEST_TOO_LARGE',
              message: 'Request size exceeds limit'
            }
          });
        }

        // Evaluate request against rules
        const evaluation = await this.evaluateRequest(req);

        if (evaluation.triggered) {
          await this.logIncident(req, evaluation);

          // Add WAF info to request
          req.wafInfo = {
            ruleTriggered: evaluation.rules.map(r => r.ruleName).join(', '),
            action: evaluation.recommendedAction,
            severity: evaluation.highestSeverity,
            riskScore: this.calculateRiskScore(evaluation),
            blocked: evaluation.recommendedAction === 'block'
          };

          // Take action based on recommendation
          switch (evaluation.recommendedAction) {
            case 'block':
              const blockDuration = this.getBlockDuration(evaluation);
              await this.blockIP(clientIP, evaluation.rules[0].ruleName, blockDuration);

              return res.status(403).json({
                success: false,
                error: {
                  code: 'WAF_REQUEST_BLOCKED',
                  message: 'Request blocked by Web Application Firewall',
                  details: {
                    ruleTriggered: evaluation.rules[0].ruleName,
                    severity: evaluation.highestSeverity
                  }
                }
              });

            case 'challenge':
              // For now, just log and continue with warning
              res.setHeader('X-WAF-Challenge', 'suspicious-request');
              break;

            case 'rate_limit':
              // Apply rate limiting
              await this.applyRateLimit(clientIP, evaluation.rules[0]);
              break;
          }
        }

        // Log all requests if enabled
        if (this.config.logAllRequests) {
          logger.debug('WAF request processed', {
            ip: clientIP,
            path: req.path,
            method: req.method,
            userAgent,
            rulesTriggered: evaluation.rules.length
          });
        }

        next();
      } catch (error) {
        logger.error('WAF inspection error', { error: error.message });
        next(); // Continue on error to avoid blocking legitimate requests
      }
    };
  }

  /**
   * Calculate risk score based on evaluation
   */
  private calculateRiskScore(evaluation: any): number {
    let score = 0;
    const severityWeights = { low: 10, medium: 25, high: 50, critical: 100 };

    for (const rule of evaluation.rules) {
      score += severityWeights[rule.severity as keyof typeof severityWeights] || 0;
    }

    return Math.min(score, 100);
  }

  /**
   * Get block duration for evaluation
   */
  private getBlockDuration(evaluation: any): number {
    const highestPriorityRule = evaluation.rules
      .sort((a: any, b: any) => a.priority - b.priority)[0];
    
    return this.rules.get(highestPriorityRule.ruleId)?.blockDuration || 3600;
  }

  /**
   * Apply rate limiting for specific rule
   */
  private async applyRateLimit(ip: string, rule: any): Promise<void> {
    try {
      const rateLimitKey = `waf:ratelimit:${ip}:${rule.ruleId}`;
      const current = await redis.incr(rateLimitKey);
      
      if (current === 1) {
        const windowSeconds = (rule.rateLimitWindow || 60000) / 1000;
        await redis.expire(rateLimitKey, windowSeconds);
      }

      if (current > (rule.rateLimitMax || 10)) {
        await this.blockIP(ip, `Rate limit exceeded for rule: ${rule.ruleName}`, 1800);
      }
    } catch (error) {
      logger.error('Error applying rate limit', { ip, rule: rule.ruleId, error: error.message });
    }
  }

  /**
   * Add custom WAF rule
   */
  addRule(rule: WAFRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Custom WAF rule added', { ruleId: rule.id, ruleName: rule.name });
  }

  /**
   * Remove WAF rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info('WAF rule removed', { ruleId });
    }
    return removed;
  }

  /**
   * Enable/disable WAF rule
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      logger.info('WAF rule toggled', { ruleId, enabled });
      return true;
    }
    return false;
  }

  /**
   * Get WAF statistics
   */
  async getStatistics(): Promise<{
    totalRules: number;
    enabledRules: number;
    totalIncidents: number;
    incidentsBySeverity: { [key: string]: number };
    topThreats: { ip: string; incidents: number; lastSeen: Date }[];
    blockedIPs: number;
  }> {
    try {
      const totalRules = this.rules.size;
      const enabledRules = Array.from(this.rules.values()).filter(r => r.enabled).length;

      // Count incidents by severity
      const incidentsBySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
      let totalIncidents = 0;

      // Count blocked IPs
      const blockedIPsPattern = 'waf:blocked:*';
      const blockedIPKeys = await redis.keys(blockedIPsPattern);
      const blockedIPs = blockedIPKeys.length;

      // Analyze incidents
      const ipIncidentCounts: { [ip: string]: { count: number; lastSeen: Date } } = {};

      for (const [ip, incidents] of this.incidents) {
        totalIncidents += incidents.length;
        
        for (const incident of incidents) {
          incidentsBySeverity[incident.severity as keyof typeof incidentsBySeverity]++;
          
          if (!ipIncidentCounts[ip]) {
            ipIncidentCounts[ip] = { count: 0, lastSeen: incident.timestamp };
          }
          ipIncidentCounts[ip].count++;
          
          if (incident.timestamp > ipIncidentCounts[ip].lastSeen) {
            ipIncidentCounts[ip].lastSeen = incident.timestamp;
          }
        }
      }

      // Get top threats
      const topThreats = Object.entries(ipIncidentCounts)
        .map(([ip, data]) => ({ ip, incidents: data.count, lastSeen: data.lastSeen }))
        .sort((a, b) => b.incidents - a.incidents)
        .slice(0, 10);

      return {
        totalRules,
        enabledRules,
        totalIncidents,
        incidentsBySeverity,
        topThreats,
        blockedIPs
      };
    } catch (error) {
      logger.error('Error getting WAF statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Health check for WAF
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      enabled: boolean;
      totalRules: number;
      enabledRules: number;
      recentIncidents: number;
      blockedIPs: number;
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

      // Get statistics
      const stats = await this.getStatistics();
      
      // Check for high incident rate
      const recentIncidents = Array.from(this.incidents.values())
        .flat()
        .filter(incident => Date.now() - incident.timestamp.getTime() < 60 * 60 * 1000) // Last hour
        .length;

      if (recentIncidents > 100) {
        issues.push(`High incident rate: ${recentIncidents} incidents in last hour`);
        status = 'degraded';
      }

      // Check if rules are loaded
      if (stats.enabledRules === 0) {
        issues.push('No enabled WAF rules');
        status = 'degraded';
      }

      return {
        status,
        metrics: {
          enabled: this.config.enabled,
          totalRules: stats.totalRules,
          enabledRules: stats.enabledRules,
          recentIncidents,
          blockedIPs: stats.blockedIPs,
          redisConnected
        },
        issues
      };
    } catch (error) {
      logger.error('WAF health check error', { error: error.message });
      return {
        status: 'unhealthy',
        metrics: {
          enabled: false,
          totalRules: 0,
          enabledRules: 0,
          recentIncidents: 0,
          blockedIPs: 0,
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
   * Start background incident cleanup
   */
  private startIncidentCleanup(): void {
    setInterval(() => {
      this.cleanupOldIncidents();
    }, 60 * 60 * 1000); // Clean up every hour
  }

  /**
   * Clean up old incidents from memory
   */
  private cleanupOldIncidents(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (const [ip, incidents] of this.incidents) {
      const recentIncidents = incidents.filter(
        incident => now - incident.timestamp.getTime() < maxAge
      );
      
      if (recentIncidents.length === 0) {
        this.incidents.delete(ip);
      } else {
        this.incidents.set(ip, recentIncidents);
      }
    }

    logger.debug('Cleaned up old WAF incidents', {
      remainingIPs: this.incidents.size
    });
  }

  /**
   * Get all WAF rules
   */
  getRules(): WAFRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get recent incidents
   */
  async getRecentIncidents(limit: number = 100): Promise<WAFIncident[]> {
    try {
      const pattern = 'waf:incidents:*';
      const keys = await redis.keys(pattern);
      const incidents: WAFIncident[] = [];

      for (const key of keys.slice(0, limit)) {
        const data = await redis.get(key);
        if (data) {
          const incident = JSON.parse(data);
          incident.timestamp = new Date(incident.timestamp);
          incidents.push(incident);
        }
      }

      return incidents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      logger.error('Error getting recent incidents', { error: error.message });
      return [];
    }
  }

  /**
   * Unblock IP address
   */
  async unblockIP(ip: string): Promise<void> {
    try {
      const blockKey = `waf:blocked:${ip}`;
      await redis.del(blockKey);
      logger.info('IP unblocked by WAF', { ip });
    } catch (error) {
      logger.error('Error unblocking IP in WAF', { ip, error: error.message });
      throw error;
    }
  }

  /**
   * Update WAF configuration
   */
  updateConfig(newConfig: Partial<WAFConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('WAF configuration updated', {
      enabled: this.config.enabled,
      blockSuspiciousRequests: this.config.blockSuspiciousRequests
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): WAFConfig {
    return { ...this.config };
  }
}

// Create and export WAF manager
export const wafManager = new WAFManager({
  enabled: process.env.WAF_ENABLED !== 'false',
  logAllRequests: process.env.WAF_LOG_ALL_REQUESTS === 'true',
  blockSuspiciousRequests: process.env.WAF_BLOCK_SUSPICIOUS !== 'false',
  enableCustomRules: process.env.WAF_CUSTOM_RULES !== 'false',
  enableOWASPRules: process.env.WAF_OWASP_RULES !== 'false',
  maxRequestSize: parseInt(process.env.WAF_MAX_REQUEST_SIZE || '1048576') // 1MB
});

// Export middleware
export const wafInspection = wafManager.inspect();

// Export utility functions
export const addWAFRule = (rule: WAFRule) => wafManager.addRule(rule);
export const removeWAFRule = (ruleId: string) => wafManager.removeRule(ruleId);
export const toggleWAFRule = (ruleId: string, enabled: boolean) => wafManager.toggleRule(ruleId, enabled);
export const getWAFRules = () => wafManager.getRules();
export const getWAFStatistics = () => wafManager.getStatistics();
export const getRecentIncidents = (limit?: number) => wafManager.getRecentIncidents(limit);
export const unblockWAFIP = (ip: string) => wafManager.unblockIP(ip);
export const wafHealthCheck = () => wafManager.healthCheck();
export const updateWAFConfig = (config: Partial<WAFConfig>) => wafManager.updateConfig(config);

/**
 * Complete WAF protection setup
 */
export const configureWAF = () => {
  return [wafInspection];
};

/**
 * Emergency WAF rules for high-threat situations
 */
export const emergencyWAFRules: WAFRule[] = [
  {
    id: 'emergency_strict_sql',
    name: 'Emergency - Strict SQL Injection',
    description: 'Ultra-strict SQL injection detection for emergencies',
    enabled: false,
    priority: 0,
    pattern: /(\b(select|insert|update|delete|drop|create|alter|exec|union)\b|\||&|;|'|"|`)/gi,
    target: 'all',
    action: 'block',
    severity: 'critical',
    blockDuration: 7200
  },
  {
    id: 'emergency_strict_xss',
    name: 'Emergency - Strict XSS',
    description: 'Ultra-strict XSS detection for emergencies',
    enabled: false,
    priority: 0,
    pattern: /(<|%3c|&lt;|&#60;|&#x3c;)/gi,
    target: 'all',
    action: 'block',
    severity: 'critical',
    blockDuration: 7200
  }
];

/**
 * Activate emergency WAF mode
 */
export const activateEmergencyWAF = async (): Promise<void> => {
  try {
    logger.warn('Activating emergency WAF mode');

    // Add emergency rules
    emergencyWAFRules.forEach(rule => {
      rule.enabled = true;
      wafManager.addRule(rule);
    });

    // Update configuration for strict mode
    wafManager.updateConfig({
      blockSuspiciousRequests: true,
      defaultAction: 'block',
      maxRequestSize: 512 * 1024 // Reduce to 512KB
    });

    logger.info('Emergency WAF mode activated');
  } catch (error) {
    logger.error('Error activating emergency WAF mode', { error: error.message });
    throw error;
  }
};

/**
 * Deactivate emergency WAF mode
 */
export const deactivateEmergencyWAF = async (): Promise<void> => {
  try {
    logger.info('Deactivating emergency WAF mode');

    // Remove emergency rules
    emergencyWAFRules.forEach(rule => {
      wafManager.removeRule(rule.id);
    });

    // Restore normal configuration
    wafManager.updateConfig({
      blockSuspiciousRequests: true,
      defaultAction: 'log',
      maxRequestSize: 1024 * 1024 // Restore to 1MB
    });

    logger.info('Emergency WAF mode deactivated');
  } catch (error) {
    logger.error('Error deactivating emergency WAF mode', { error: error.message });
    throw error;
  }
};
