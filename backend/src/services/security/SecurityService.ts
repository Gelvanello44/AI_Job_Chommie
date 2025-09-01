/**
 * Security Service
 * Comprehensive security management coordinating CSRF, XSS, and other security measures
 */

import { Request, Response, NextFunction } from 'express';
import { csrfHealthCheck, clearCSRFSecret } from '../../middleware/csrf';
import { xssHealthCheck } from '../../middleware/xss';
import { logger } from '../../utils/logger';
import { redis } from '../../config/redis';
import { prisma } from '../../utils/prisma';

export interface SecurityIncident {
  id: string;
  type: 'CSRF_VIOLATION' | 'XSS_ATTEMPT' | 'SQL_INJECTION' | 'SUSPICIOUS_ACTIVITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  details: Record<string, any>;
  blocked: boolean;
  createdAt: Date;
}

export interface SecurityMetrics {
  incidents: {
    total: number;
    blocked: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  protection: {
    csrfHealth: any;
    xssHealth: any;
    activeUsers: number;
    protectedEndpoints: number;
  };
  performance: {
    averageProcessingTime: number;
    successRate: number;
    falsePositiveRate: number;
  };
}

export class SecurityService {
  /**
   * Initialize security monitoring and protection
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing security service...');

      // Start background tasks
      this.startSecurityMonitoring();
      this.startIncidentCleanup();

      logger.info('Security service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize security service', { error: error.message });
      throw error;
    }
  }

  /**
   * Log and track security incidents
   */
  async logSecurityIncident(
    type: SecurityIncident['type'],
    severity: SecurityIncident['severity'],
    req: Request,
    details: Record<string, any>,
    blocked: boolean = false
  ): Promise<string> {
    try {
      const incident: SecurityIncident = {
        id: this.generateIncidentId(),
        type,
        severity,
        userId: req.user?.id,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        path: req.path,
        method: req.method,
        details,
        blocked,
        createdAt: new Date()
      };

      // Store in Redis for quick access (expire after 24 hours)
      const redisKey = `security:incident:${incident.id}`;
      await redis.setex(redisKey, 86400, JSON.stringify(incident));

      // Store in database for long-term tracking
      await prisma.securityIncident.create({
        data: {
          id: incident.id,
          type: incident.type,
          severity: incident.severity,
          userId: incident.userId,
          ip: incident.ip,
          userAgent: incident.userAgent,
          path: incident.path,
          method: incident.method,
          details: incident.details,
          blocked: incident.blocked,
          createdAt: incident.createdAt
        }
      });

      // Alert for critical incidents
      if (severity === 'CRITICAL') {
        await this.alertCriticalIncident(incident);
      }

      // Rate limiting for suspicious users
      if (blocked && incident.userId) {
        await this.applySecurityRestrictions(incident.userId, type);
      }

      logger.warn('Security incident logged', {
        incidentId: incident.id,
        type,
        severity,
        userId: incident.userId,
        blocked
      });

      return incident.id;
    } catch (error) {
      logger.error('Error logging security incident', { error: error.message, type, severity });
      throw error;
    }
  }

  /**
   * Get security metrics and statistics
   */
  async getSecurityMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<SecurityMetrics> {
    try {
      const cutoffDate = this.getDateFromTimeRange(timeRange);

      // Get incident statistics
      const [totalIncidents, blockedIncidents, incidentsByType, incidentsBySeverity] = await Promise.all([
        prisma.securityIncident.count({
          where: { createdAt: { gte: cutoffDate } }
        }),
        prisma.securityIncident.count({
          where: { 
            createdAt: { gte: cutoffDate },
            blocked: true 
          }
        }),
        prisma.securityIncident.groupBy({
          by: ['type'],
          where: { createdAt: { gte: cutoffDate } },
          _count: { id: true }
        }),
        prisma.securityIncident.groupBy({
          by: ['severity'],
          where: { createdAt: { gte: cutoffDate } },
          _count: { id: true }
        })
      ]);

      // Get protection health
      const [csrfHealth, xssHealth] = await Promise.all([
        csrfHealthCheck(),
        xssHealthCheck()
      ]);

      // Get active user count (approximate)
      const activeUsers = await this.getActiveUserCount();

      // Calculate performance metrics
      const averageProcessingTime = await this.getAverageSecurityProcessingTime();
      const successRate = await this.calculateSecuritySuccessRate(cutoffDate);

      const byType: Record<string, number> = {};
      incidentsByType.forEach(item => {
        byType[item.type] = item._count.id;
      });

      const bySeverity: Record<string, number> = {};
      incidentsBySeverity.forEach(item => {
        bySeverity[item.severity] = item._count.id;
      });

      return {
        incidents: {
          total: totalIncidents,
          blocked: blockedIncidents,
          byType,
          bySeverity
        },
        protection: {
          csrfHealth,
          xssHealth,
          activeUsers,
          protectedEndpoints: this.getProtectedEndpointsCount()
        },
        performance: {
          averageProcessingTime,
          successRate,
          falsePositiveRate: this.calculateFalsePositiveRate(totalIncidents, blockedIncidents)
        }
      };
    } catch (error) {
      logger.error('Error getting security metrics', { error: error.message, timeRange });
      throw error;
    }
  }

  /**
   * Get recent security incidents
   */
  async getRecentIncidents(
    limit: number = 50,
    severity?: SecurityIncident['severity'],
    type?: SecurityIncident['type']
  ): Promise<SecurityIncident[]> {
    try {
      const whereClause: any = {};
      
      if (severity) whereClause.severity = severity;
      if (type) whereClause.type = type;

      const incidents = await prisma.securityIncident.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return incidents;
    } catch (error) {
      logger.error('Error getting recent incidents', { error: error.message });
      throw error;
    }
  }

  /**
   * Apply security restrictions to a user
   */
  async applySecurityRestrictions(
    userId: string,
    violationType: SecurityIncident['type'],
    duration: number = 3600 // 1 hour in seconds
  ): Promise<void> {
    try {
      const restrictionKey = `security:restriction:${userId}`;
      const restriction = {
        userId,
        type: violationType,
        appliedAt: new Date(),
        expiresAt: new Date(Date.now() + duration * 1000),
        restrictions: this.getRestrictionsForViolation(violationType)
      };

      await redis.setex(restrictionKey, duration, JSON.stringify(restriction));

      logger.info('Security restrictions applied', {
        userId,
        violationType,
        duration,
        restrictions: restriction.restrictions
      });
    } catch (error) {
      logger.error('Error applying security restrictions', { error: error.message, userId });
    }
  }

  /**
   * Check if user has active security restrictions
   */
  async hasSecurityRestrictions(userId: string): Promise<{
    restricted: boolean;
    restrictions?: any;
    expiresAt?: Date;
  }> {
    try {
      const restrictionKey = `security:restriction:${userId}`;
      const restrictionData = await redis.get(restrictionKey);

      if (!restrictionData) {
        return { restricted: false };
      }

      const restriction = JSON.parse(restrictionData);
      return {
        restricted: true,
        restrictions: restriction.restrictions,
        expiresAt: new Date(restriction.expiresAt)
      };
    } catch (error) {
      logger.error('Error checking security restrictions', { error: error.message, userId });
      return { restricted: false };
    }
  }

  /**
   * Clear user security restrictions
   */
  async clearSecurityRestrictions(userId: string): Promise<void> {
    try {
      const restrictionKey = `security:restriction:${userId}`;
      await redis.del(restrictionKey);

      logger.info('Security restrictions cleared', { userId });
    } catch (error) {
      logger.error('Error clearing security restrictions', { error: error.message, userId });
    }
  }

  /**
   * Generate security audit report
   */
  async generateSecurityAuditReport(timeRange: '7d' | '30d' | '90d' = '30d'): Promise<{
    summary: {
      totalIncidents: number;
      criticalIncidents: number;
      blockedAttacks: number;
      uniqueAttackers: number;
      mostTargetedEndpoints: Array<{ path: string; incidents: number; }>;
    };
    trends: {
      dailyIncidents: Array<{ date: string; incidents: number; blocked: number; }>;
      incidentTypes: Array<{ type: string; count: number; trend: string; }>;
    };
    recommendations: Array<{
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      title: string;
      description: string;
      action: string;
    }>;
  }> {
    try {
      const cutoffDate = this.getDateFromTimeRange(timeRange);

      // Get incident summary
      const [totalIncidents, criticalIncidents, blockedAttacks, endpointStats] = await Promise.all([
        prisma.securityIncident.count({
          where: { createdAt: { gte: cutoffDate } }
        }),
        prisma.securityIncident.count({
          where: { 
            createdAt: { gte: cutoffDate },
            severity: 'CRITICAL'
          }
        }),
        prisma.securityIncident.count({
          where: { 
            createdAt: { gte: cutoffDate },
            blocked: true 
          }
        }),
        prisma.securityIncident.groupBy({
          by: ['path'],
          where: { createdAt: { gte: cutoffDate } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10
        })
      ]);

      // Get unique attackers
      const uniqueAttackers = await prisma.securityIncident.findMany({
        where: { createdAt: { gte: cutoffDate } },
        select: { ip: true },
        distinct: ['ip']
      });

      // Get daily incident trends
      const dailyIncidents = await prisma.securityIncident.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: cutoffDate } },
        _count: { id: true }
      });

      // Get incident type trends
      const incidentTypes = await prisma.securityIncident.groupBy({
        by: ['type'],
        where: { createdAt: { gte: cutoffDate } },
        _count: { id: true }
      });

      // Generate recommendations
      const recommendations = this.generateSecurityRecommendations({
        totalIncidents,
        criticalIncidents,
        blockedAttacks,
        timeRange
      });

      // Process trends data
      const dailyTrends = this.processDailyTrends(dailyIncidents);
      const typeTrends = incidentTypes.map(item => ({
        type: item.type,
        count: item._count.id,
        trend: 'stable' // Would calculate actual trend in full implementation
      }));

      return {
        summary: {
          totalIncidents,
          criticalIncidents,
          blockedAttacks,
          uniqueAttackers: uniqueAttackers.length,
          mostTargetedEndpoints: endpointStats.map(stat => ({
            path: stat.path,
            incidents: stat._count.id
          }))
        },
        trends: {
          dailyIncidents: dailyTrends,
          incidentTypes: typeTrends
        },
        recommendations
      };
    } catch (error) {
      logger.error('Error generating security audit report', { error: error.message, timeRange });
      throw error;
    }
  }

  /**
   * Security middleware for sensitive endpoints
   */
  sensitiveEndpointProtection() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Check if user has active restrictions
        if (req.user) {
          const restrictions = await this.hasSecurityRestrictions(req.user.id);
          if (restrictions.restricted) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'SECURITY_RESTRICTIONS_ACTIVE',
                message: 'Access temporarily restricted due to security concerns',
                details: {
                  expiresAt: restrictions.expiresAt,
                  restrictions: restrictions.restrictions
                }
              }
            });
          }
        }

        // Add security context to request
        req.securityContext = {
          protectionLevel: 'SENSITIVE',
          auditRequired: true,
          rateLimitStrict: true
        };

        next();
      } catch (error) {
        logger.error('Sensitive endpoint protection error', { error: error.message });
        next(error);
      }
    };
  }

  /**
   * Security audit logging middleware
   */
  auditSecurity() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Override res.end to log after response
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const processingTime = Date.now() - startTime;
        
        // Log security-relevant requests
        if (req.path.includes('/payment') || req.path.includes('/auth') || req.method !== 'GET') {
          logger.info('Security audit log', {
            userId: req.user?.id,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            processingTime,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            sanitized: (req as any).sanitized,
            csrfValidated: (req as any).csrfToken ? 'valid' : 'not_required'
          });
        }

        return originalEnd.apply(this, args);
      };

      next();
    };
  }

  /**
   * Clear all security data for a user (on account deletion)
   */
  async clearUserSecurityData(userId: string): Promise<void> {
    try {
      await Promise.all([
        clearCSRFSecret(userId),
        this.clearSecurityRestrictions(userId),
        redis.del(`security:user:${userId}:*`)
      ]);

      logger.info('User security data cleared', { userId });
    } catch (error) {
      logger.error('Error clearing user security data', { error: error.message, userId });
    }
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(): Promise<{
    status: 'SECURE' | 'AT_RISK' | 'COMPROMISED';
    alerts: Array<{
      type: string;
      message: string;
      severity: string;
      actionRequired: boolean;
    }>;
    metrics: SecurityMetrics;
    recentIncidents: SecurityIncident[];
  }> {
    try {
      const [metrics, recentIncidents] = await Promise.all([
        this.getSecurityMetrics('24h'),
        this.getRecentIncidents(20)
      ]);

      // Determine overall security status
      let status: 'SECURE' | 'AT_RISK' | 'COMPROMISED' = 'SECURE';
      const alerts: Array<any> = [];

      // Check for critical issues
      if (metrics.incidents.bySeverity.CRITICAL > 0) {
        status = 'COMPROMISED';
        alerts.push({
          type: 'CRITICAL_INCIDENTS',
          message: `${metrics.incidents.bySeverity.CRITICAL} critical security incidents detected`,
          severity: 'CRITICAL',
          actionRequired: true
        });
      }

      // Check protection health
      if (metrics.protection.csrfHealth.status !== 'healthy' || 
          metrics.protection.xssHealth.status !== 'healthy') {
        status = status === 'SECURE' ? 'AT_RISK' : status;
        alerts.push({
          type: 'PROTECTION_DEGRADED',
          message: 'Security protection systems are not fully operational',
          severity: 'HIGH',
          actionRequired: true
        });
      }

      // Check incident volume
      if (metrics.incidents.total > 100) {
        status = status === 'SECURE' ? 'AT_RISK' : status;
        alerts.push({
          type: 'HIGH_INCIDENT_VOLUME',
          message: 'Unusually high number of security incidents',
          severity: 'MEDIUM',
          actionRequired: false
        });
      }

      return {
        status,
        alerts,
        metrics,
        recentIncidents
      };
    } catch (error) {
      logger.error('Error getting security dashboard', { error: error.message });
      throw error;
    }
  }

  // ======================================
  // PRIVATE HELPER METHODS
  // ======================================

  private generateIncidentId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDateFromTimeRange(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private getRestrictionsForViolation(type: SecurityIncident['type']): string[] {
    const restrictions = {
      CSRF_VIOLATION: ['payment_restricted', 'profile_update_restricted'],
      XSS_ATTEMPT: ['content_creation_restricted', 'file_upload_restricted'],
      SQL_INJECTION: ['database_access_restricted', 'admin_features_restricted'],
      SUSPICIOUS_ACTIVITY: ['rate_limited', 'monitoring_increased']
    };

    return restrictions[type] || ['general_restrictions'];
  }

  private async alertCriticalIncident(incident: SecurityIncident): Promise<void> {
    try {
      // In production, this would send alerts via email, Slack, etc.
      logger.error('CRITICAL SECURITY INCIDENT', {
        incidentId: incident.id,
        type: incident.type,
        userId: incident.userId,
        ip: incident.ip,
        path: incident.path,
        details: incident.details
      });

      // Store alert in database for tracking
      await prisma.securityAlert.create({
        data: {
          incidentId: incident.id,
          type: 'CRITICAL_INCIDENT',
          message: `Critical security incident: ${incident.type}`,
          severity: 'CRITICAL',
          acknowledged: false,
          createdAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Error alerting critical incident', { error: error.message });
    }
  }

  private startSecurityMonitoring(): void {
    // Monitor security health every 5 minutes
    setInterval(async () => {
      try {
        const [csrfHealth, xssHealth] = await Promise.all([
          csrfHealthCheck(),
          xssHealthCheck()
        ]);

        if (csrfHealth.status !== 'healthy' || xssHealth.status !== 'healthy') {
          logger.warn('Security system health degraded', { csrfHealth, xssHealth });
        }
      } catch (error) {
        logger.error('Security monitoring error', { error: error.message });
      }
    }, 5 * 60 * 1000);
  }

  private startIncidentCleanup(): void {
    // Clean up old incidents every hour
    setInterval(async () => {
      try {
        const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days

        const deletedCount = await prisma.securityIncident.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
            severity: { in: ['LOW', 'MEDIUM'] }
          }
        });

        if (deletedCount.count > 0) {
          logger.info('Security incident cleanup completed', { deletedCount: deletedCount.count });
        }
      } catch (error) {
        logger.error('Security incident cleanup error', { error: error.message });
      }
    }, 60 * 60 * 1000);
  }

  private async getActiveUserCount(): Promise<number> {
    try {
      const keys = await redis.keys('csrf:secret:*');
      return keys.length;
    } catch (error) {
      return 0;
    }
  }

  private getProtectedEndpointsCount(): number {
    // Count endpoints that require security protection
    return 45; // Approximate count of protected endpoints
  }

  private async getAverageSecurityProcessingTime(): Promise<number> {
    // This would be tracked in real implementation
    return 25; // milliseconds
  }

  private async calculateSecuritySuccessRate(cutoffDate: Date): Promise<number> {
    try {
      const totalRequests = await prisma.securityIncident.count({
        where: { createdAt: { gte: cutoffDate } }
      });

      const blockedRequests = await prisma.securityIncident.count({
        where: { 
          createdAt: { gte: cutoffDate },
          blocked: true 
        }
      });

      return totalRequests > 0 ? ((totalRequests - blockedRequests) / totalRequests) * 100 : 100;
    } catch (error) {
      return 95; // Default success rate
    }
  }

  private calculateFalsePositiveRate(total: number, blocked: number): number {
    // Estimate false positive rate (would be calculated from user feedback in production)
    return blocked > 0 ? Math.min(5, (blocked * 0.1 / total) * 100) : 0;
  }

  private processDailyTrends(incidents: any[]): Array<{ date: string; incidents: number; blocked: number; }> {
    const dailyData: Record<string, { incidents: number; blocked: number; }> = {};

    incidents.forEach(incident => {
      const date = new Date(incident.createdAt).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { incidents: 0, blocked: 0 };
      }
      dailyData[date].incidents += incident._count.id;
      // Would track blocked separately in real implementation
    });

    return Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private generateSecurityRecommendations(stats: any): Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    action: string;
  }> {
    const recommendations: Array<any> = [];

    if (stats.criticalIncidents > 0) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Address Critical Security Incidents',
        description: `${stats.criticalIncidents} critical incidents detected in the last ${stats.timeRange}`,
        action: 'Review incident logs and implement additional security measures'
      });
    }

    if (stats.totalIncidents > 50) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'High Security Activity',
        description: 'Unusually high number of security incidents detected',
        action: 'Review and potentially tighten security policies'
      });
    }

    if (stats.blockedAttacks < stats.totalIncidents * 0.8) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Improve Attack Detection',
        description: 'Some potentially malicious requests may not be properly blocked',
        action: 'Review and enhance threat detection rules'
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const securityService = new SecurityService();

// Export types
export type { SecurityIncident, SecurityMetrics };
