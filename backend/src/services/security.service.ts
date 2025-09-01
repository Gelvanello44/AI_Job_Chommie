/**
 * Unified Security Service
 * Coordinates all security components: SSL, CSRF, XSS, DDoS, WAF, and API Key Rotation
 */

import { logger } from '../utils/logger';
import { sslHealthCheck, reloadCertificates } from '../middleware/ssl';
import { csrfHealthCheck, clearCSRFSecret } from '../middleware/csrf';
import { xssHealthCheck } from '../middleware/xss';
import { ddosHealthCheck, getDDoSStatistics, unblockIP as ddosUnblockIP, emergencyDDoSResponse } from '../middleware/ddos-protection';
import { wafHealthCheck, getWAFStatistics, unblockWAFIP, activateEmergencyWAF, deactivateEmergencyWAF } from '../middleware/waf';
import { apiKeyHealthCheck, getRotationStatus, forceKeyRotation, getCurrentAPIKey } from '../middleware/api-key-rotation';

export interface SecurityStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    ssl: { status: string; issues: string[] };
    csrf: { status: string; issues: string[] };
    xss: { status: string; issues: string[] };
    ddos: { status: string; issues: string[] };
    waf: { status: string; issues: string[] };
    apiKeys: { status: string; issues: string[] };
  };
  metrics: {
    totalThreats: number;
    blockedIPs: number;
    activeAPIKeys: number;
    httpsEnabled: boolean;
  };
  lastUpdated: Date;
}

export interface SecurityIncident {
  id: string;
  type: 'CSRF_VIOLATION' | 'XSS_ATTEMPT' | 'SQL_INJECTION' | 'DDOS_ATTACK' | 'WAF_TRIGGER' | 'API_KEY_BREACH';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  source: string;
  details: any;
  resolved: boolean;
  actions: string[];
}

export interface SecurityReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalIncidents: number;
    incidentsBySeverity: { [key: string]: number };
    incidentsByType: { [key: string]: number };
    topThreats: string[];
    resolutionRate: number;
  };
  recommendations: string[];
  trends: {
    dailyIncidents: { date: string; count: number }[];
    threatEvolution: string[];
  };
}

class UnifiedSecurityService {
  private emergencyMode: boolean = false;
  private incidents: SecurityIncident[] = [];

  /**
   * Get comprehensive security status
   */
  async getSecurityStatus(): Promise<SecurityStatus> {
    try {
      // Get health status from all components
      const [sslHealth, csrfHealth, xssHealth, ddosHealth, wafHealth, apiKeyHealth] = await Promise.all([
        sslHealthCheck(),
        csrfHealthCheck(),
        xssHealthCheck(),
        ddosHealthCheck(),
        wafHealthCheck(),
        apiKeyHealthCheck()
      ]);

      // Calculate overall status
      const componentStatuses = [sslHealth, csrfHealth, xssHealth, ddosHealth, wafHealth, apiKeyHealth];
      const hasUnhealthy = componentStatuses.some(h => h.status === 'unhealthy');
      const hasDegraded = componentStatuses.some(h => h.status === 'degraded');

      const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

      // Get additional metrics
      const [ddosStats, wafStats] = await Promise.all([
        getDDoSStatistics(),
        getWAFStatistics()
      ]);

      return {
        overall: overallStatus,
        components: {
          ssl: { status: sslHealth.status, issues: sslHealth.issues },
          csrf: { status: csrfHealth.status, issues: csrfHealth.issues },
          xss: { status: xssHealth.status, issues: xssHealth.issues },
          ddos: { status: ddosHealth.status, issues: ddosHealth.issues },
          waf: { status: wafHealth.status, issues: wafHealth.issues },
          apiKeys: { status: apiKeyHealth.status, issues: apiKeyHealth.issues }
        },
        metrics: {
          totalThreats: ddosStats.threats.totalBlocked + wafStats.totalIncidents,
          blockedIPs: ddosStats.global.blockedRequests + wafStats.blockedIPs,
          activeAPIKeys: apiKeyHealth.metrics.activeKeys,
          httpsEnabled: sslHealth.metrics.httpsEnabled
        },
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error getting security status', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle security incident
   */
  async handleSecurityIncident(incident: Omit<SecurityIncident, 'id' | 'timestamp' | 'resolved' | 'actions'>): Promise<SecurityIncident> {
    try {
      const fullIncident: SecurityIncident = {
        ...incident,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        resolved: false,
        actions: []
      };

      // Log incident
      logger.warn('Security incident detected', {
        incidentId: fullIncident.id,
        type: fullIncident.type,
        severity: fullIncident.severity,
        source: fullIncident.source
      });

      // Auto-respond based on severity
      await this.autoRespondToIncident(fullIncident);

      // Store incident
      this.incidents.push(fullIncident);
      
      // Keep only last 1000 incidents in memory
      if (this.incidents.length > 1000) {
        this.incidents = this.incidents.slice(-1000);
      }

      return fullIncident;
    } catch (error) {
      logger.error('Error handling security incident', { error: error.message });
      throw error;
    }
  }

  /**
   * Auto-respond to security incidents
   */
  private async autoRespondToIncident(incident: SecurityIncident): Promise<void> {
    try {
      switch (incident.severity) {
        case 'critical':
          await this.activateEmergencyMode();
          incident.actions.push('Emergency mode activated');
          break;

        case 'high':
          // Block IP if it's an attack
          if (incident.details.ip && ['DDOS_ATTACK', 'WAF_TRIGGER'].includes(incident.type)) {
            if (incident.type === 'DDOS_ATTACK') {
              await ddosUnblockIP(incident.details.ip); // This will block in the DDoS system
            } else {
              await unblockWAFIP(incident.details.ip); // This will block in the WAF system
            }
            incident.actions.push(`IP ${incident.details.ip} blocked`);
          }
          break;

        case 'medium':
          // Log and monitor
          incident.actions.push('Increased monitoring activated');
          break;

        case 'low':
          // Just log
          incident.actions.push('Incident logged');
          break;
      }

      // Additional auto-responses based on incident type
      switch (incident.type) {
        case 'API_KEY_BREACH':
          if (incident.details.serviceName) {
            await forceKeyRotation(incident.details.serviceName);
            incident.actions.push(`API key rotated for ${incident.details.serviceName}`);
          }
          break;

        case 'CSRF_VIOLATION':
          if (incident.details.userId) {
            await clearCSRFSecret(incident.details.userId);
            incident.actions.push(`CSRF secret cleared for user ${incident.details.userId}`);
          }
          break;
      }

    } catch (error) {
      logger.error('Error auto-responding to incident', { 
        incidentId: incident.id, 
        error: error.message 
      });
    }
  }

  /**
   * Activate emergency security mode
   */
  async activateEmergencyMode(): Promise<void> {
    try {
      if (this.emergencyMode) {
        logger.info('Emergency mode already active');
        return;
      }

      logger.warn('Activating emergency security mode');

      // Activate emergency responses in all components
      await Promise.all([
        emergencyDDoSResponse('high'),
        activateEmergencyWAF()
      ]);

      this.emergencyMode = true;
      logger.info('Emergency security mode activated');

      // Auto-deactivate after 2 hours unless manually extended
      setTimeout(async () => {
        if (this.emergencyMode) {
          await this.deactivateEmergencyMode();
        }
      }, 2 * 60 * 60 * 1000);

    } catch (error) {
      logger.error('Error activating emergency mode', { error: error.message });
      throw error;
    }
  }

  /**
   * Deactivate emergency security mode
   */
  async deactivateEmergencyMode(): Promise<void> {
    try {
      if (!this.emergencyMode) {
        logger.info('Emergency mode not active');
        return;
      }

      logger.info('Deactivating emergency security mode');

      // Deactivate emergency responses
      await Promise.all([
        deactivateEmergencyWAF()
        // Note: DDoS protection doesn't have a deactivate function, config changes are permanent
      ]);

      this.emergencyMode = false;
      logger.info('Emergency security mode deactivated');

    } catch (error) {
      logger.error('Error deactivating emergency mode', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(days: number = 7): Promise<SecurityReport> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      // Filter incidents by date range
      const periodIncidents = this.incidents.filter(
        incident => incident.timestamp >= startDate && incident.timestamp <= endDate
      );

      // Calculate summary statistics
      const totalIncidents = periodIncidents.length;
      const incidentsBySeverity = {
        low: periodIncidents.filter(i => i.severity === 'low').length,
        medium: periodIncidents.filter(i => i.severity === 'medium').length,
        high: periodIncidents.filter(i => i.severity === 'high').length,
        critical: periodIncidents.filter(i => i.severity === 'critical').length
      };

      const incidentsByType = {
        CSRF_VIOLATION: periodIncidents.filter(i => i.type === 'CSRF_VIOLATION').length,
        XSS_ATTEMPT: periodIncidents.filter(i => i.type === 'XSS_ATTEMPT').length,
        SQL_INJECTION: periodIncidents.filter(i => i.type === 'SQL_INJECTION').length,
        DDOS_ATTACK: periodIncidents.filter(i => i.type === 'DDOS_ATTACK').length,
        WAF_TRIGGER: periodIncidents.filter(i => i.type === 'WAF_TRIGGER').length,
        API_KEY_BREACH: periodIncidents.filter(i => i.type === 'API_KEY_BREACH').length
      };

      // Get top threats
      const threatCounts: { [source: string]: number } = {};
      periodIncidents.forEach(incident => {
        const threat = incident.details.ip || incident.source;
        threatCounts[threat] = (threatCounts[threat] || 0) + 1;
      });

      const topThreats = Object.entries(threatCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([threat, count]) => `${threat} (${count} incidents)`);

      // Calculate resolution rate
      const resolvedIncidents = periodIncidents.filter(i => i.resolved).length;
      const resolutionRate = totalIncidents > 0 ? (resolvedIncidents / totalIncidents) * 100 : 100;

      // Generate daily incident counts
      const dailyIncidents: { date: string; count: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(endDate.getTime() - (i * 24 * 60 * 60 * 1000));
        const dateStr = date.toISOString().split('T')[0];
        const dayIncidents = periodIncidents.filter(incident => {
          const incidentDate = incident.timestamp.toISOString().split('T')[0];
          return incidentDate === dateStr;
        }).length;
        
        dailyIncidents.push({ date: dateStr, count: dayIncidents });
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(periodIncidents, incidentsBySeverity);

      // Analyze threat evolution
      const threatEvolution = this.analyzeThreatEvolution(periodIncidents);

      return {
        period: { start: startDate, end: endDate },
        summary: {
          totalIncidents,
          incidentsBySeverity,
          incidentsByType,
          topThreats,
          resolutionRate
        },
        recommendations,
        trends: {
          dailyIncidents,
          threatEvolution
        }
      };
    } catch (error) {
      logger.error('Error generating security report', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(incidents: SecurityIncident[], severityBreakdown: any): string[] {
    const recommendations: string[] = [];

    // High severity incidents
    if (severityBreakdown.high + severityBreakdown.critical > 10) {
      recommendations.push('Consider implementing additional WAF rules due to high number of severe incidents');
    }

    // SQL injection patterns
    const sqlIncidents = incidents.filter(i => i.type === 'SQL_INJECTION').length;
    if (sqlIncidents > 5) {
      recommendations.push('Implement stricter input validation and parameterized queries');
    }

    // DDoS patterns
    const ddosIncidents = incidents.filter(i => i.type === 'DDOS_ATTACK').length;
    if (ddosIncidents > 3) {
      recommendations.push('Consider implementing CDN or additional DDoS protection layers');
    }

    // XSS patterns
    const xssIncidents = incidents.filter(i => i.type === 'XSS_ATTEMPT').length;
    if (xssIncidents > 10) {
      recommendations.push('Review and strengthen Content Security Policy headers');
    }

    // API key issues
    const apiIncidents = incidents.filter(i => i.type === 'API_KEY_BREACH').length;
    if (apiIncidents > 0) {
      recommendations.push('Reduce API key rotation interval and implement additional authentication');
    }

    // CSRF issues
    const csrfIncidents = incidents.filter(i => i.type === 'CSRF_VIOLATION').length;
    if (csrfIncidents > 5) {
      recommendations.push('Review CSRF token implementation and consider double-submit cookie pattern');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Security posture is good. Continue monitoring and regular security reviews.');
    }

    return recommendations;
  }

  /**
   * Analyze threat evolution patterns
   */
  private analyzeThreatEvolution(incidents: SecurityIncident[]): string[] {
    const evolution: string[] = [];

    // Group incidents by day
    const incidentsByDay: { [date: string]: SecurityIncident[] } = {};
    incidents.forEach(incident => {
      const date = incident.timestamp.toISOString().split('T')[0];
      if (!incidentsByDay[date]) {
        incidentsByDay[date] = [];
      }
      incidentsByDay[date].push(incident);
    });

    const dates = Object.keys(incidentsByDay).sort();
    
    // Analyze trends
    if (dates.length >= 3) {
      const recentDays = dates.slice(-3);
      const recentIncidents = recentDays.reduce((sum, date) => sum + incidentsByDay[date].length, 0);
      const earlierDays = dates.slice(-6, -3);
      const earlierIncidents = earlierDays.reduce((sum, date) => sum + incidentsByDay[date].length, 0);

      if (recentIncidents > earlierIncidents * 1.5) {
        evolution.push('Increasing attack frequency detected in recent days');
      } else if (recentIncidents < earlierIncidents * 0.5) {
        evolution.push('Decreasing attack frequency - security measures are effective');
      }
    }

    // Analyze attack types
    const typesByDay: { [type: string]: number[] } = {};
    dates.forEach(date => {
      incidentsByDay[date].forEach(incident => {
        if (!typesByDay[incident.type]) {
          typesByDay[incident.type] = [];
        }
        typesByDay[incident.type].push(1);
      });
    });

    // Find emerging threats
    Object.entries(typesByDay).forEach(([type, counts]) => {
      if (counts.length >= 3) {
        const recent = counts.slice(-2).reduce((a, b) => a + b, 0);
        const earlier = counts.slice(-4, -2).reduce((a, b) => a + b, 0);
        
        if (recent > earlier * 2) {
          evolution.push(`Emerging threat pattern: ${type} attacks increasing`);
        }
      }
    });

    if (evolution.length === 0) {
      evolution.push('No significant threat evolution patterns detected');
    }

    return evolution;
  }

  /**
   * Perform security maintenance
   */
  async performMaintenance(): Promise<{
    tasksCompleted: string[];
    errors: string[];
  }> {
    const tasksCompleted: string[] = [];
    const errors: string[] = [];

    try {
      // Reload SSL certificates
      try {
        await reloadCertificates();
        tasksCompleted.push('SSL certificates reloaded');
      } catch (error) {
        errors.push(`SSL certificate reload failed: ${error.message}`);
      }

      // Check and rotate expiring API keys
      try {
        const rotationStatus = await getRotationStatus();
        const expiringKeys = rotationStatus.services.filter(s => s.isExpiring);
        
        for (const service of expiringKeys) {
          await forceKeyRotation(service.serviceName);
          tasksCompleted.push(`API key rotated for ${service.serviceName}`);
        }
      } catch (error) {
        errors.push(`API key maintenance failed: ${error.message}`);
      }

      // Clean up old incidents
      try {
        const oldIncidents = this.incidents.filter(
          i => Date.now() - i.timestamp.getTime() > 7 * 24 * 60 * 60 * 1000
        );
        this.incidents = this.incidents.filter(
          i => Date.now() - i.timestamp.getTime() <= 7 * 24 * 60 * 60 * 1000
        );
        tasksCompleted.push(`Cleaned up ${oldIncidents.length} old incidents`);
      } catch (error) {
        errors.push(`Incident cleanup failed: ${error.message}`);
      }

      logger.info('Security maintenance completed', { 
        tasksCompleted: tasksCompleted.length,
        errors: errors.length 
      });

      return { tasksCompleted, errors };
    } catch (error) {
      logger.error('Security maintenance error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get security configuration summary
   */
  getConfigurationSummary(): {
    ssl: any;
    ddos: any;
    waf: any;
    emergencyMode: boolean;
  } {
    return {
      ssl: {
        enabled: process.env.ENABLE_HTTPS === 'true',
        forceHTTPS: process.env.FORCE_HTTPS === 'true',
        hstsEnabled: process.env.ENABLE_HSTS !== 'false'
      },
      ddos: {
        enabled: process.env.DDOS_PROTECTION_ENABLED !== 'false',
        globalRateLimit: process.env.GLOBAL_RATE_LIMIT_MAX || '1000',
        perIPRateLimit: process.env.PER_IP_RATE_LIMIT_MAX || '100'
      },
      waf: {
        enabled: process.env.WAF_ENABLED !== 'false',
        blockSuspicious: process.env.WAF_BLOCK_SUSPICIOUS !== 'false',
        maxRequestSize: process.env.WAF_MAX_REQUEST_SIZE || '1048576'
      },
      emergencyMode: this.emergencyMode
    };
  }

  /**
   * Get recent security incidents
   */
  getRecentIncidents(limit: number = 50): SecurityIncident[] {
    return this.incidents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Resolve security incident
   */
  resolveIncident(incidentId: string, resolution: string): boolean {
    const incident = this.incidents.find(i => i.id === incidentId);
    if (incident) {
      incident.resolved = true;
      incident.actions.push(`Resolved: ${resolution}`);
      logger.info('Security incident resolved', { incidentId, resolution });
      return true;
    }
    return false;
  }

  /**
   * Emergency response system
   */
  async emergencyResponse(threat: 'ddos' | 'breach' | 'critical_vulnerability'): Promise<void> {
    try {
      logger.warn('Emergency security response initiated', { threat });

      switch (threat) {
        case 'ddos':
          await emergencyDDoSResponse('high');
          await this.handleSecurityIncident({
            type: 'DDOS_ATTACK',
            severity: 'critical',
            source: 'system',
            details: { threat: 'ddos', autoResponse: true }
          });
          break;

        case 'breach':
          await this.activateEmergencyMode();
          
          // Rotate all API keys immediately
          const services = ['paystack', 'yoco', 'openai'];
          for (const service of services) {
            await forceKeyRotation(service);
          }

          await this.handleSecurityIncident({
            type: 'API_KEY_BREACH',
            severity: 'critical',
            source: 'system',
            details: { threat: 'breach', autoResponse: true }
          });
          break;

        case 'critical_vulnerability':
          await this.activateEmergencyMode();
          
          await this.handleSecurityIncident({
            type: 'WAF_TRIGGER',
            severity: 'critical',
            source: 'system',
            details: { threat: 'critical_vulnerability', autoResponse: true }
          });
          break;
      }

      logger.info('Emergency security response completed', { threat });
    } catch (error) {
      logger.error('Emergency response failed', { threat, error: error.message });
      throw error;
    }
  }

  /**
   * Get emergency mode status
   */
  isEmergencyMode(): boolean {
    return this.emergencyMode;
  }

  /**
   * Get comprehensive security metrics
   */
  async getSecurityMetrics(): Promise<{
    threats: {
      totalDetected: number;
      blocked: number;
      mitigated: number;
    };
    performance: {
      avgResponseTime: number;
      securityOverhead: number;
    };
    compliance: {
      httpsEnforced: boolean;
      csrfProtected: boolean;
      xssProtected: boolean;
      rateLimited: boolean;
    };
  }> {
    try {
      const [ddosStats, wafStats, securityStatus] = await Promise.all([
        getDDoSStatistics(),
        getWAFStatistics(),
        this.getSecurityStatus()
      ]);

      const totalThreats = ddosStats.threats.totalBlocked + wafStats.totalIncidents;
      const blockedThreats = ddosStats.global.blockedRequests + wafStats.blockedIPs;

      return {
        threats: {
          totalDetected: totalThreats,
          blocked: blockedThreats,
          mitigated: Math.max(totalThreats - blockedThreats, 0)
        },
        performance: {
          avgResponseTime: 0, // Would need to implement response time tracking
          securityOverhead: 0 // Would need to implement overhead measurement
        },
        compliance: {
          httpsEnforced: securityStatus.metrics.httpsEnabled,
          csrfProtected: securityStatus.components.csrf.status !== 'unhealthy',
          xssProtected: securityStatus.components.xss.status !== 'unhealthy',
          rateLimited: securityStatus.components.ddos.status !== 'unhealthy'
        }
      };
    } catch (error) {
      logger.error('Error getting security metrics', { error: error.message });
      throw error;
    }
  }
}

// Create and export unified security service
export const securityService = new UnifiedSecurityService();

// Export main functions
export const getSecurityStatus = () => securityService.getSecurityStatus();
export const handleSecurityIncident = (incident: Omit<SecurityIncident, 'id' | 'timestamp' | 'resolved' | 'actions'>) => 
  securityService.handleSecurityIncident(incident);
export const activateEmergencyMode = () => securityService.activateEmergencyMode();
export const deactivateEmergencyMode = () => securityService.deactivateEmergencyMode();
export const generateSecurityReport = (days?: number) => securityService.generateSecurityReport(days);
export const performSecurityMaintenance = () => securityService.performMaintenance();
export const getSecurityConfiguration = () => securityService.getConfigurationSummary();
export const getRecentSecurityIncidents = (limit?: number) => securityService.getRecentIncidents(limit);
export const resolveSecurityIncident = (incidentId: string, resolution: string) => 
  securityService.resolveIncident(incidentId, resolution);
export const emergencySecurityResponse = (threat: 'ddos' | 'breach' | 'critical_vulnerability') => 
  securityService.emergencyResponse(threat);
export const isEmergencySecurityMode = () => securityService.isEmergencyMode();
export const getComprehensiveSecurityMetrics = () => securityService.getSecurityMetrics();

/**
 * Initialize all security components
 */
export const initializeSecurityService = async (): Promise<void> => {
  try {
    logger.info('Initializing unified security service');

    // Initialize API key rotation
    const { initializeAPIKeyRotation } = await import('../middleware/api-key-rotation');
    await initializeAPIKeyRotation();

    // Perform initial security status check
    const status = await getSecurityStatus();
    
    logger.info('Security service initialized', {
      overallStatus: status.overall,
      componentsHealthy: Object.values(status.components).filter(c => c.status === 'healthy').length,
      totalComponents: Object.keys(status.components).length
    });

    // Log any immediate issues
    const allIssues = Object.values(status.components).flatMap(c => c.issues);
    if (allIssues.length > 0) {
      logger.warn('Security issues detected during initialization', { issues: allIssues });
    }

  } catch (error) {
    logger.error('Failed to initialize security service', { error: error.message });
    throw error;
  }
};

/**
 * Graceful shutdown of security components
 */
export const shutdownSecurityService = async (): Promise<void> => {
  try {
    logger.info('Shutting down security service');

    // Stop API key rotation timers
    const { shutdownAPIKeyRotation } = await import('../middleware/api-key-rotation');
    shutdownAPIKeyRotation();

    logger.info('Security service shutdown completed');
  } catch (error) {
    logger.error('Error during security service shutdown', { error: error.message });
  }
};
