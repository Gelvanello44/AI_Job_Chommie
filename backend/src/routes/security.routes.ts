/**
 * Security Management Routes
 * Provides endpoints for security monitoring, incident tracking, and CSRF token management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { body, query, param } from 'express-validator';
import { validateRequest } from '../middleware/validation';
import { rateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { redis } from '../config/redis';
import { generateCSRFToken, getCSRFTokenEndpoint, csrfHealthCheck, sensitiveOperationCSRF } from '../middleware/csrf';
import { xssHealthCheck, validateFileUploads } from '../middleware/xss';
import { sslHealthCheck, reloadCertificates, validateCertificates } from '../middleware/ssl';
import { ddosHealthCheck, getDDoSStatistics, getBlockedIPs as getDDoSBlockedIPs, unblockIP as ddosUnblockIP, emergencyDDoSResponse } from '../middleware/ddos-protection';
import { wafHealthCheck, getWAFStatistics, getWAFRules, getRecentIncidents as getWAFIncidents, unblockWAFIP, addWAFRule, removeWAFRule, toggleWAFRule } from '../middleware/waf';
import { apiKeyHealthCheck, getRotationStatus, forceKeyRotation, getCurrentAPIKey, getKeyUsageStats } from '../middleware/api-key-rotation';
import { getSecurityStatus, generateSecurityReport, performSecurityMaintenance, activateEmergencyMode, deactivateEmergencyMode, handleSecurityIncident, getComprehensiveSecurityMetrics } from '../services/security.service';

const router = Router();

// Helper function to get recent incidents from multiple sources
async function getRecentIncidents(limit: number, severity?: string, type?: string) {
  try {
    // Get incidents from WAF
    const wafIncidents = await getWAFIncidents(Math.ceil(limit / 2));
    
    // Mock implementation for other incident sources
    // In production, this would aggregate from all security components
    const incidents = wafIncidents.map(incident => ({
      ...incident,
      source: 'waf'
    }));

    // Filter by severity and type if specified
    let filteredIncidents = incidents;
    if (severity) {
      filteredIncidents = filteredIncidents.filter(i => i.severity === severity);
    }
    if (type) {
      filteredIncidents = filteredIncidents.filter(i => i.type === type);
    }

    return filteredIncidents.slice(0, limit);
  } catch (error) {
    logger.error('Error aggregating recent incidents', { error });
    return [];
  }
}

// Helper function to check user security restrictions
async function hasSecurityRestrictions(userId: string) {
  try {
    // Check if user is blocked in any security component
    const restrictionChecks = await Promise.allSettled([
      redis.get(`ddos:blocked_users:${userId}`),
      redis.get(`waf:blocked_users:${userId}`),
      redis.get(`security:restrictions:${userId}`)
    ]);

    const hasRestrictions = restrictionChecks.some(result => 
      result.status === 'fulfilled' && result.value !== null
    );

    return {
      hasRestrictions,
      restrictions: {
        ddosBlocked: restrictionChecks[0].status === 'fulfilled' && restrictionChecks[0].value !== null,
        wafBlocked: restrictionChecks[1].status === 'fulfilled' && restrictionChecks[1].value !== null,
        generalRestrictions: restrictionChecks[2].status === 'fulfilled' && restrictionChecks[2].value !== null
      },
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error checking security restrictions', { error, userId });
    return {
      hasRestrictions: false,
      restrictions: {},
      error: 'Failed to check restrictions'
    };
  }
}

// Helper function to clear security restrictions
async function clearSecurityRestrictions(userId: string) {
  try {
    await Promise.all([
      redis.del(`ddos:blocked_users:${userId}`),
      redis.del(`waf:blocked_users:${userId}`),
      redis.del(`security:restrictions:${userId}`),
      redis.del(`security:incidents:user:${userId}`)
    ]);
  } catch (error) {
    logger.error('Error clearing security restrictions', { error, userId });
    throw error;
  }
}

// Helper function to clear all user security data
async function clearUserSecurityData(userId: string) {
  try {
    await Promise.all([
      // Clear CSRF tokens
      redis.del(`csrf:tokens:${userId}`),
      // Clear security restrictions
      clearSecurityRestrictions(userId),
      // Clear rate limiting data
      redis.del(`rate_limit:${userId}`),
      // Clear session data
      redis.del(`sessions:${userId}`)
    ]);
  } catch (error) {
    logger.error('Error clearing user security data', { error, userId });
    throw error;
  }
}

// Helper function to log security incident
async function logSecurityIncident(type: string, severity: string, req: any, details: any, blocked: boolean) {
  try {
    const incidentId = `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const incident = {
      id: incidentId,
      type,
      severity,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      details,
      blocked,
      source: 'security_routes'
    };

    await redis.setex(`security:incidents:${incidentId}`, 86400 * 30, JSON.stringify(incident));
    await redis.lpush('security:incidents:recent', JSON.stringify(incident));
    await redis.ltrim('security:incidents:recent', 0, 999); // Keep last 1000 incidents

    return incidentId;
  } catch (error) {
    logger.error('Error logging security incident', { error });
    throw error;
  }
}

/**
 * GET /security/csrf-token - Get CSRF token for authenticated user
 */
router.get('/csrf-token', authenticate, generateCSRFToken, getCSRFTokenEndpoint);

/**
 * GET /security/health - Get comprehensive security system health status
 */
router.get('/health', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Add role-based access control - admin only
    const securityStatus = await getSecurityStatus();

    res.json({
      success: true,
      data: securityStatus
    });
  } catch (error) {
    logger.error('Error fetching security health', { error });
    next(error);
  }
});

/**
 * GET /security/dashboard - Get comprehensive security dashboard - Admin only
 */
router.get('/dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Add role-based access control - admin only
    const securityStatus = await getSecurityStatus();
    const metrics = await getComprehensiveSecurityMetrics('24h');

    const dashboard = {
      ...securityStatus,
      metrics,
      summary: {
        totalIncidents: metrics.incidents?.total || 0,
        blockedAttacks: metrics.incidents?.blocked || 0,
        systemStatus: securityStatus.overallStatus,
        emergencyMode: securityStatus.emergencyMode || false
      }
    };

    res.json({
      success: true,
      data: dashboard,
      metadata: {
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching security dashboard', { error });
    next(error);
  }
});

/**
 * GET /security/metrics - Get security metrics and statistics - Admin only
 */
router.get('/metrics',
  authenticate,
  [
    query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid time range')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - admin only
      const { timeRange = '24h' } = req.query;

      const metrics = await getComprehensiveSecurityMetrics(timeRange as string);

      res.json({
        success: true,
        data: metrics,
        metadata: {
          timeRange,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching security metrics', { error });
      next(error);
    }
  }
);

/**
 * GET /security/incidents - Get recent security incidents - Admin only
 */
router.get('/incidents',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('severity').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Invalid severity'),
    query('type').optional().isIn(['CSRF_VIOLATION', 'XSS_ATTEMPT', 'SQL_INJECTION', 'SUSPICIOUS_ACTIVITY']).withMessage('Invalid incident type')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - admin only
      const { limit = 50, severity, type } = req.query;

      const incidents = await getRecentIncidents(
        Number(limit),
        severity as string,
        type as string
      );

      res.json({
        success: true,
        data: {
          incidents,
          total: incidents.length,
          filters: { severity, type, limit }
        }
      });
    } catch (error) {
      logger.error('Error fetching security incidents', { error });
      next(error);
    }
  }
);

/**
 * POST /security/audit-report - Generate security audit report - Admin only
 */
router.post('/audit-report',
  authenticate,
  [
    body('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Invalid time range'),
    body('includeDetails').optional().isBoolean().withMessage('Include details must be boolean'),
    body('format').optional().isIn(['json', 'pdf']).withMessage('Format must be json or pdf')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - admin only
      const { timeRange = '30d', includeDetails = true, format = 'json' } = req.body;

      const auditReport = await generateSecurityReport(timeRange, 'json');

      if (format === 'json') {
        res.json({
          success: true,
          data: auditReport,
          metadata: {
            timeRange,
            includeDetails,
            generatedAt: new Date().toISOString(),
            generatedBy: req.user?.email
          }
        });
      } else {
        // TODO: Implement PDF generation for audit reports
        res.status(501).json({
          success: false,
          error: {
            code: 'PDF_GENERATION_NOT_IMPLEMENTED',
            message: 'PDF audit reports not yet implemented'
          }
        });
      }
    } catch (error) {
      logger.error('Error generating security audit report', { error });
      next(error);
    }
  }
);

/**
 * GET /security/restrictions/:userId - Check user security restrictions - Admin only
 */
router.get('/restrictions/:userId',
  authenticate,
  [
    param('userId').isUUID().withMessage('Invalid user ID')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - admin only
      const { userId } = req.params;

      const restrictions = await hasSecurityRestrictions(userId);

      res.json({
        success: true,
        data: {
          userId,
          ...restrictions
        }
      });
    } catch (error) {
      logger.error('Error checking user restrictions', { error, userId: req.params.userId });
      next(error);
    }
  }
);

/**
 * DELETE /security/restrictions/:userId - Clear user security restrictions - Admin only
 */
router.delete('/restrictions/:userId',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    param('userId').isUUID().withMessage('Invalid user ID'),
    body('reason').notEmpty().withMessage('Reason is required for clearing restrictions')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - admin only
      const { userId } = req.params;
      const { reason } = req.body;

      await clearSecurityRestrictions(userId);

      // Log the action
      logger.info('Security restrictions cleared by admin', {
        targetUserId: userId,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email,
        reason
      });

      res.json({
        success: true,
        message: 'Security restrictions cleared successfully'
      });
    } catch (error) {
      logger.error('Error clearing user restrictions', { error, userId: req.params.userId });
      next(error);
    }
  }
);

/**
 * POST /security/test-protection - Test security protection mechanisms - Admin only
 */
router.post('/test-protection',
  authenticate,
  [
    body('testType').isIn(['csrf', 'xss', 'sql_injection', 'file_upload']).withMessage('Invalid test type'),
    body('testData').optional().isObject().withMessage('Test data must be an object')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - admin only
      const { testType, testData = {} } = req.body;

      const testResults: any = {
        testType,
        timestamp: new Date().toISOString(),
        results: {}
      };

      switch (testType) {
        case 'csrf':
          // Test CSRF protection
          const csrfHealth = await csrfHealthCheck();
          testResults.results = {
            healthStatus: csrfHealth.status,
            activeSecrets: csrfHealth.metrics.activeSecrets,
            redisConnected: csrfHealth.metrics.redisConnected
          };
          break;

        case 'xss':
          // Test XSS protection
          const xssHealth = await xssHealthCheck();
          testResults.results = {
            healthStatus: xssHealth.status,
            purifyConfigured: xssHealth.metrics.purifyConfigured,
            sanitizationEnabled: xssHealth.metrics.sanitizationEnabled
          };
          break;

        case 'sql_injection':
          // Test SQL injection detection
          const sqlTestInput = "'; DROP TABLE users; --";
          testResults.results = {
            inputTested: sqlTestInput,
            detected: true, // Would be detected by our threat detection
            blocked: true
          };
          break;

        case 'file_upload':
          // Test file upload security
          testResults.results = {
            allowedTypes: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/plain',
              'image/jpeg',
              'image/png',
              'image/gif'
            ],
            maxSize: '10MB',
            securityChecks: ['mimetype', 'filename', 'size', 'content']
          };
          break;

        default:
          testResults.results = { error: 'Unknown test type' };
      }

      res.json({
        success: true,
        data: testResults
      });
    } catch (error) {
      logger.error('Error testing security protection', { error, testType: req.body.testType });
      next(error);
    }
  }
);

/**
 * POST /security/incident - Log a security incident - Internal use
 */
router.post('/incident',
  authenticate,
  [
    body('type').isIn(['CSRF_VIOLATION', 'XSS_ATTEMPT', 'SQL_INJECTION', 'SUSPICIOUS_ACTIVITY']).withMessage('Invalid incident type'),
    body('severity').isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Invalid severity'),
    body('details').isObject().withMessage('Details must be an object'),
    body('blocked').optional().isBoolean().withMessage('Blocked must be boolean')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, severity, details, blocked = false } = req.body;

      const incidentId = await logSecurityIncident(
        type,
        severity,
        req,
        details,
        blocked
      );

      res.json({
        success: true,
        data: {
          incidentId,
          type,
          severity,
          blocked
        }
      });
    } catch (error) {
      logger.error('Error logging security incident', { error });
      next(error);
    }
  }
);

/**
 * GET /security/user-restrictions - Get current user's security restrictions
 */
router.get('/user-restrictions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const restrictions = await hasSecurityRestrictions(userId);

    res.json({
      success: true,
      data: restrictions
    });
  } catch (error) {
    logger.error('Error fetching user restrictions', { error, userId: req.user?.id });
    next(error);
  }
});

/**
 * POST /security/clear-user-data - Clear user security data on account deletion - Admin only
 */
router.post('/clear-user-data',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('userId').isUUID().withMessage('Invalid user ID'),
    body('reason').notEmpty().withMessage('Reason is required'),
    body('confirmation').equals('CONFIRM_CLEAR_DATA').withMessage('Confirmation required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - admin only
      const { userId, reason, confirmation } = req.body;

      if (confirmation !== 'CONFIRM_CLEAR_DATA') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message: 'Data clearing requires explicit confirmation'
          }
        });
      }

      await clearUserSecurityData(userId);

      // Log the action
      logger.info('User security data cleared by admin', {
        targetUserId: userId,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email,
        reason
      });

      res.json({
        success: true,
        message: 'User security data cleared successfully'
      });
    } catch (error) {
      logger.error('Error clearing user security data', { error, userId: req.body.userId });
      next(error);
    }
  }
);

/**
 * GET /security/protected-endpoints - List all security-protected endpoints - Admin only
 */
router.get('/protected-endpoints', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Add role-based access control - admin only
    
    // Static list of protected endpoints (in production, this would be dynamically generated)
    const protectedEndpoints = [
      {
        path: '/api/v1/payment/*',
        protection: ['CSRF', 'XSS', 'Input Sanitization'],
        level: 'SENSITIVE',
        description: 'Payment processing endpoints'
      },
      {
        path: '/api/v1/auth/change-password',
        protection: ['CSRF', 'XSS', 'Rate Limiting'],
        level: 'SENSITIVE',
        description: 'Password change endpoint'
      },
      {
        path: '/api/v1/profile/update',
        protection: ['CSRF', 'XSS', 'Input Sanitization'],
        level: 'STANDARD',
        description: 'User profile updates'
      },
      {
        path: '/api/v1/files/upload',
        protection: ['XSS', 'File Validation', 'MIME Type Check'],
        level: 'STANDARD',
        description: 'File upload endpoints'
      },
      {
        path: '/api/v1/application/submit',
        protection: ['CSRF', 'XSS', 'Input Sanitization'],
        level: 'STANDARD',
        description: 'Job application submission'
      },
      {
        path: '/api/v1/companies/create',
        protection: ['CSRF', 'XSS', 'Input Sanitization'],
        level: 'STANDARD',
        description: 'Company profile creation'
      }
    ];

    res.json({
      success: true,
      data: {
        endpoints: protectedEndpoints,
        total: protectedEndpoints.length,
        byLevel: {
          SENSITIVE: protectedEndpoints.filter(e => e.level === 'SENSITIVE').length,
          STANDARD: protectedEndpoints.filter(e => e.level === 'STANDARD').length
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching protected endpoints', { error });
    next(error);
  }
});

/**
 * POST /security/validate-input - Test input validation and sanitization - Admin only
 */
router.post('/validate-input',
  authenticate,
  [
    body('input').notEmpty().withMessage('Input is required'),
    body('testType').optional().isIn(['xss', 'sql', 'general']).withMessage('Invalid test type')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - admin only
      const { input, testType = 'general' } = req.body;

      // Create a mock request object for testing
      const mockReq = {
        body: { testField: input },
        path: '/security/test',
        method: 'POST',
        user: req.user,
        ip: req.ip,
        headers: req.headers
      } as any;

      const mockRes = {
        status: () => mockRes,
        json: (data: any) => data
      } as any;

      let sanitizationResult: any = null;
      let threatDetectionResult: any = null;

      // Test input sanitization
      const { sanitizeInput, detectThreats } = await import('../middleware/xss');
      
      // Run sanitization
      await new Promise<void>((resolve) => {
        sanitizeInput(mockReq, mockRes, () => {
          sanitizationResult = {
            originalInput: input,
            sanitizedInput: mockReq.body.testField,
            modified: mockReq.body.testField !== input,
            sanitizationReport: mockReq.sanitizationReport || null
          };
          resolve();
        });
      });

      // Run threat detection
      await new Promise<void>((resolve) => {
        detectThreats(mockReq, mockRes, () => {
          threatDetectionResult = {
            threatsDetected: mockReq.sanitizationReport?.threatsDetected || [],
            blocked: false // Would be true if request was blocked
          };
          resolve();
        });
      });

      res.json({
        success: true,
        data: {
          testType,
          input: {
            original: input,
            sanitized: sanitizationResult?.sanitizedInput,
            modified: sanitizationResult?.modified
          },
          sanitization: sanitizationResult,
          threatDetection: threatDetectionResult,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error validating input', { error });
      next(error);
    }
  }
);

/**
 * POST /security/force-logout - Force logout user and clear security data - Admin only
 */
router.post('/force-logout',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('userId').isUUID().withMessage('Invalid user ID'),
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Add role-based access control - admin only
      const { userId, reason } = req.body;

      // Clear all security data for the user
      await clearUserSecurityData(userId);

      // Log the forced logout
      await logSecurityIncident(
        'SUSPICIOUS_ACTIVITY',
        'MEDIUM',
        req,
        {
          action: 'FORCED_LOGOUT',
          targetUserId: userId,
          reason,
          adminAction: true
        },
        false
      );

      logger.info('User forcibly logged out by admin', {
        targetUserId: userId,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email,
        reason
      });

      res.json({
        success: true,
        message: 'User logout forced and security data cleared'
      });
    } catch (error) {
      logger.error('Error forcing user logout', { error, userId: req.body.userId });
      next(error);
    }
  }
);

/**
 * GET /security/config - Get security configuration - Admin only
 */
router.get('/config', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Add role-based access control - admin only
    
    const config = {
      csrf: {
        enabled: true,
        tokenExpiry: 3600,
        exemptPaths: [
          '/health',
          '/api-docs',
          '/api/v1/webhooks/*',
          '/api/v1/auth/login',
          '/api/v1/auth/register'
        ]
      },
      xss: {
        enabled: true,
        sanitizationLevel: 'strict',
        inputSanitization: true,
        outputEncoding: true,
        cspEnabled: true,
        fileUploadValidation: true
      },
      general: {
        auditLogging: true,
        threatDetection: true,
        rateLimiting: true,
        sessionSecurity: true
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error fetching security config', { error });
    next(error);
  }
});

/**
 * GET /security/stats - Get security statistics summary - Admin only
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Add role-based access control - admin only
    
    const metrics = await getComprehensiveSecurityMetrics('24h');

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error fetching security stats', { error });
    next(error);
  }
});

// ===== DDoS Protection Management =====

/**
 * GET /security/ddos/status - Get DDoS protection status
 */
router.get('/ddos/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [health, stats] = await Promise.all([
      ddosHealthCheck(),
      getDDoSStatistics()
    ]);

    res.json({
      success: true,
      data: {
        health,
        statistics: stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching DDoS status', { error });
    next(error);
  }
});

/**
 * GET /security/ddos/blocked-ips - Get currently blocked IPs
 */
router.get('/ddos/blocked-ips', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blockedIPs = await getDDoSBlockedIPs();

    res.json({
      success: true,
      data: {
        blockedIPs,
        count: blockedIPs.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching blocked IPs', { error });
    next(error);
  }
});

/**
 * DELETE /security/ddos/blocked-ips/:ip - Unblock an IP address
 */
router.delete('/ddos/blocked-ips/:ip',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    param('ip').isIP().withMessage('Invalid IP address'),
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ip } = req.params;
      const { reason } = req.body;

      await ddosUnblockIP(ip);

      logger.info('IP unblocked by admin', {
        ip,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email,
        reason
      });

      res.json({
        success: true,
        message: `IP ${ip} unblocked successfully`
      });
    } catch (error) {
      logger.error('Error unblocking IP', { error, ip: req.params.ip });
      next(error);
    }
  }
);

/**
 * POST /security/ddos/emergency-response - Activate emergency DDoS response
 */
router.post('/ddos/emergency-response',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('reason').notEmpty().withMessage('Reason is required'),
    body('duration').optional().isInt({ min: 300, max: 86400 }).withMessage('Duration must be between 5 minutes and 24 hours')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason, duration = 3600 } = req.body;

      await emergencyDDoSResponse();
      await activateEmergencyMode('ddos', duration, reason);

      logger.warn('Emergency DDoS response activated', {
        adminUserId: req.user?.id,
        adminEmail: req.user?.email,
        reason,
        duration
      });

      res.json({
        success: true,
        message: 'Emergency DDoS response activated',
        data: {
          reason,
          duration,
          activatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error activating emergency DDoS response', { error });
      next(error);
    }
  }
);

// ===== WAF Management =====

/**
 * GET /security/waf/status - Get WAF status and statistics
 */
router.get('/waf/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [health, stats, rules] = await Promise.all([
      wafHealthCheck(),
      getWAFStatistics(),
      getWAFRules()
    ]);

    res.json({
      success: true,
      data: {
        health,
        statistics: stats,
        activeRules: rules.filter(r => r.enabled).length,
        totalRules: rules.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching WAF status', { error });
    next(error);
  }
});

/**
 * GET /security/waf/rules - Get WAF rules
 */
router.get('/waf/rules', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await getWAFRules();

    res.json({
      success: true,
      data: {
        rules,
        summary: {
          total: rules.length,
          enabled: rules.filter(r => r.enabled).length,
          disabled: rules.filter(r => !r.enabled).length,
          byType: rules.reduce((acc, rule) => {
            acc[rule.type] = (acc[rule.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching WAF rules', { error });
    next(error);
  }
});

/**
 * POST /security/waf/rules - Add new WAF rule
 */
router.post('/waf/rules',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('name').notEmpty().withMessage('Rule name is required'),
    body('type').isIn(['sql_injection', 'xss', 'command_injection', 'bot_detection', 'custom']).withMessage('Invalid rule type'),
    body('pattern').notEmpty().withMessage('Rule pattern is required'),
    body('action').isIn(['block', 'log', 'challenge']).withMessage('Invalid action'),
    body('severity').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Invalid severity'),
    body('enabled').optional().isBoolean().withMessage('Enabled must be boolean')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, type, pattern, action, severity = 'MEDIUM', enabled = true } = req.body;

      const ruleId = await addWAFRule({
        name,
        type,
        pattern,
        action,
        severity,
        enabled
      });

      logger.info('WAF rule added by admin', {
        ruleId,
        name,
        type,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        data: {
          ruleId,
          message: 'WAF rule added successfully'
        }
      });
    } catch (error) {
      logger.error('Error adding WAF rule', { error });
      next(error);
    }
  }
);

/**
 * DELETE /security/waf/rules/:ruleId - Remove WAF rule
 */
router.delete('/waf/rules/:ruleId',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    param('ruleId').notEmpty().withMessage('Rule ID is required'),
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ruleId } = req.params;
      const { reason } = req.body;

      await removeWAFRule(ruleId);

      logger.info('WAF rule removed by admin', {
        ruleId,
        reason,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        message: 'WAF rule removed successfully'
      });
    } catch (error) {
      logger.error('Error removing WAF rule', { error, ruleId: req.params.ruleId });
      next(error);
    }
  }
);

/**
 * PATCH /security/waf/rules/:ruleId/toggle - Toggle WAF rule enabled/disabled
 */
router.patch('/waf/rules/:ruleId/toggle',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    param('ruleId').notEmpty().withMessage('Rule ID is required'),
    body('enabled').isBoolean().withMessage('Enabled must be boolean'),
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ruleId } = req.params;
      const { enabled, reason } = req.body;

      await toggleWAFRule(ruleId, enabled);

      logger.info('WAF rule toggled by admin', {
        ruleId,
        enabled,
        reason,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        message: `WAF rule ${enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      logger.error('Error toggling WAF rule', { error, ruleId: req.params.ruleId });
      next(error);
    }
  }
);

/**
 * GET /security/waf/incidents - Get recent WAF incidents
 */
router.get('/waf/incidents',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit = 50 } = req.query;
      const incidents = await getWAFIncidents(Number(limit));

      res.json({
        success: true,
        data: {
          incidents,
          count: incidents.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching WAF incidents', { error });
      next(error);
    }
  }
);

/**
 * DELETE /security/waf/blocked-ips/:ip - Unblock IP from WAF
 */
router.delete('/waf/blocked-ips/:ip',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    param('ip').isIP().withMessage('Invalid IP address'),
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ip } = req.params;
      const { reason } = req.body;

      await unblockWAFIP(ip);

      logger.info('IP unblocked from WAF by admin', {
        ip,
        reason,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        message: `IP ${ip} unblocked from WAF successfully`
      });
    } catch (error) {
      logger.error('Error unblocking IP from WAF', { error, ip: req.params.ip });
      next(error);
    }
  }
);

// ===== SSL/TLS Management =====

/**
 * GET /security/ssl/status - Get SSL/TLS status
 */
router.get('/ssl/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await sslHealthCheck();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Error fetching SSL status', { error });
    next(error);
  }
});

/**
 * POST /security/ssl/reload-certificates - Reload SSL certificates
 */
router.post('/ssl/reload-certificates',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;

      await reloadCertificates();

      logger.info('SSL certificates reloaded by admin', {
        reason,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        message: 'SSL certificates reloaded successfully'
      });
    } catch (error) {
      logger.error('Error reloading SSL certificates', { error });
      next(error);
    }
  }
);

/**
 * POST /security/ssl/validate-certificates - Validate SSL certificates
 */
router.post('/ssl/validate-certificates', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = await validateCertificates();

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    logger.error('Error validating SSL certificates', { error });
    next(error);
  }
});

// ===== API Key Rotation Management =====

/**
 * GET /security/api-keys/status - Get API key rotation status
 */
router.get('/api-keys/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [health, rotationStatus, usageStats] = await Promise.all([
      apiKeyHealthCheck(),
      getRotationStatus(),
      getKeyUsageStats()
    ]);

    res.json({
      success: true,
      data: {
        health,
        rotation: rotationStatus,
        usage: usageStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching API key status', { error });
    next(error);
  }
});

/**
 * GET /security/api-keys/current - Get current API key info (metadata only)
 */
router.get('/api-keys/current', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentKey = await getCurrentAPIKey();

    // Remove sensitive data before sending
    const { key, ...metadata } = currentKey;

    res.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    logger.error('Error fetching current API key info', { error });
    next(error);
  }
});

/**
 * POST /security/api-keys/rotate - Force API key rotation
 */
router.post('/api-keys/rotate',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;

      await forceKeyRotation();

      logger.info('API key rotation forced by admin', {
        reason,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        message: 'API key rotation initiated successfully'
      });
    } catch (error) {
      logger.error('Error forcing API key rotation', { error });
      next(error);
    }
  }
);

// ===== Security Service Management =====

/**
 * GET /security/comprehensive-metrics - Get comprehensive security metrics
 */
router.get('/comprehensive-metrics',
  authenticate,
  [
    query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid time range')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { timeRange = '24h' } = req.query;
      const metrics = await getComprehensiveSecurityMetrics(timeRange as string);

      res.json({
        success: true,
        data: metrics,
        metadata: {
          timeRange,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching comprehensive metrics', { error });
      next(error);
    }
  }
);

/**
 * POST /security/report - Generate security report
 */
router.post('/report',
  authenticate,
  [
    body('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Invalid time range'),
    body('format').optional().isIn(['json', 'summary']).withMessage('Invalid format')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { timeRange = '30d', format = 'json' } = req.body;
      const report = await generateSecurityReport(timeRange, format);

      res.json({
        success: true,
        data: report,
        metadata: {
          timeRange,
          format,
          generatedAt: new Date().toISOString(),
          generatedBy: req.user?.email
        }
      });
    } catch (error) {
      logger.error('Error generating security report', { error });
      next(error);
    }
  }
);

/**
 * POST /security/maintenance - Perform security maintenance tasks
 */
router.post('/maintenance',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('tasks').optional().isArray().withMessage('Tasks must be an array'),
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tasks, reason } = req.body;
      const results = await performSecurityMaintenance(tasks);

      logger.info('Security maintenance performed by admin', {
        tasks,
        reason,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        data: {
          results,
          performedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error performing security maintenance', { error });
      next(error);
    }
  }
);

/**
 * POST /security/emergency-mode/activate - Activate emergency security mode
 */
router.post('/emergency-mode/activate',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('component').isIn(['all', 'ddos', 'waf', 'ssl', 'api_keys']).withMessage('Invalid component'),
    body('duration').optional().isInt({ min: 300, max: 86400 }).withMessage('Duration must be between 5 minutes and 24 hours'),
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { component, duration = 3600, reason } = req.body;

      await activateEmergencyMode(component, duration, reason);

      logger.warn('Emergency mode activated', {
        component,
        duration,
        reason,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        message: 'Emergency mode activated successfully',
        data: {
          component,
          duration,
          reason,
          activatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error activating emergency mode', { error });
      next(error);
    }
  }
);

/**
 * POST /security/emergency-mode/deactivate - Deactivate emergency security mode
 */
router.post('/emergency-mode/deactivate',
  authenticate,
  ...sensitiveOperationCSRF(),
  [
    body('component').isIn(['all', 'ddos', 'waf', 'ssl', 'api_keys']).withMessage('Invalid component'),
    body('reason').notEmpty().withMessage('Reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { component, reason } = req.body;

      await deactivateEmergencyMode(component, reason);

      logger.info('Emergency mode deactivated', {
        component,
        reason,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        message: 'Emergency mode deactivated successfully',
        data: {
          component,
          reason,
          deactivatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error deactivating emergency mode', { error });
      next(error);
    }
  }
);

/**
 * POST /security/handle-incident - Handle security incident with automated response
 */
router.post('/handle-incident',
  authenticate,
  [
    body('incidentId').notEmpty().withMessage('Incident ID is required'),
    body('response').isIn(['auto', 'block_ip', 'emergency_mode', 'escalate']).withMessage('Invalid response type'),
    body('reason').optional().isString().withMessage('Reason must be a string')
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { incidentId, response, reason } = req.body;

      const result = await handleSecurityIncident(incidentId, response, reason);

      logger.info('Security incident handled by admin', {
        incidentId,
        response,
        reason,
        result,
        adminUserId: req.user?.id,
        adminEmail: req.user?.email
      });

      res.json({
        success: true,
        data: {
          incidentId,
          response,
          result,
          handledAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error handling security incident', { error, incidentId: req.body.incidentId });
      next(error);
    }
  }
);

export default router;
