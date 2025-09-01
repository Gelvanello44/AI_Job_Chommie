/**
 * Security Integration Example
 * Demonstrates how to integrate the complete security system into an Express application
 */

import express from 'express';
import { json, urlencoded } from 'express-parser';
import { 
  initializeSecurity, 
  protectSensitiveRoute, 
  protectAPIRoute, 
  protectFileUpload,
  SecurityOptions 
} from '../middleware/security';
import securityRoutes from '../routes/security.routes';
import { logger } from '../utils/logger';

/**
 * Example Express application with complete security integration
 */
async function createSecureApp() {
  const app = express();

  // Basic middleware
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Security configuration
  const securityOptions: SecurityOptions = {
    enableSSL: process.env.NODE_ENV === 'production',
    enableDDoSProtection: true,
    enableWAF: true,
    enableCSRF: true,
    enableXSS: true,
    enableAPIKeyRotation: false, // Enable for API endpoints only
    skipHealthCheck: false
  };

  // Initialize comprehensive security
  try {
    const securityInit = await initializeSecurity(app, securityOptions);
    logger.info('Security system initialized', { status: securityInit.status.overallStatus });
  } catch (error) {
    logger.error('Failed to initialize security system', { error });
    process.exit(1);
  }

  // Security management routes
  app.use('/api/v1/security', securityRoutes);

  // Example: Standard protected routes
  app.get('/api/v1/users', protectAPIRoute, async (req, res) => {
    res.json({ message: 'Users endpoint with API protection' });
  });

  // Example: Sensitive operation (payments, password changes, etc.)
  app.post('/api/v1/payment/process', 
    protectSensitiveRoute, 
    async (req, res) => {
      // Payment processing logic with maximum security
      res.json({ message: 'Payment processed securely' });
    }
  );

  // Example: File upload with security validation
  app.post('/api/v1/files/upload', 
    protectFileUpload, 
    async (req, res) => {
      // File upload logic with security validation
      res.json({ message: 'File uploaded securely' });
    }
  );

  // Example: Admin-only endpoint with enhanced security
  app.get('/api/v1/admin/dashboard', 
    protectSensitiveRoute,
    // TODO: Add role-based access control middleware here
    async (req, res) => {
      res.json({ message: 'Admin dashboard with enhanced security' });
    }
  );

  // Example: Public API with rate limiting only
  app.get('/api/v1/public/data', 
    // Only DDoS protection for public endpoints
    async (req, res) => {
      res.json({ message: 'Public data with DDoS protection' });
    }
  );

  // Example: Webhook endpoint (typically CSRF-exempt)
  app.post('/api/v1/webhooks/payment', 
    // Skip CSRF for webhooks but keep other protections
    protectAPIRoute, 
    async (req, res) => {
      res.json({ message: 'Webhook processed securely' });
    }
  );

  // Health check endpoint (minimal security)
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // Security status endpoint for monitoring
  app.get('/status/security', async (req, res) => {
    try {
      const { getSecurityStatus } = await import('../services/security.service');
      const status = await getSecurityStatus();
      res.json(status);
    } catch (error) {
      logger.error('Failed to get security status', { error });
      res.status(500).json({ error: 'Failed to get security status' });
    }
  });

  // Global error handler
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production' 
          ? 'An error occurred' 
          : error.message
      }
    });
  });

  return app;
}

/**
 * Example of configuring security for different environments
 */
export function getSecurityConfigForEnvironment(env: string): SecurityOptions {
  const baseConfig: SecurityOptions = {
    enableSSL: false,
    enableDDoSProtection: true,
    enableWAF: true,
    enableCSRF: true,
    enableXSS: true,
    enableAPIKeyRotation: false
  };

  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        enableSSL: false, // Disable SSL in development
        enableDDoSProtection: false, // Less strict in development
        enableWAF: false // Disable WAF in development
      };

    case 'staging':
      return {
        ...baseConfig,
        enableSSL: true,
        enableDDoSProtection: true,
        enableWAF: true
      };

    case 'production':
      return {
        ...baseConfig,
        enableSSL: true,
        enableDDoSProtection: true,
        enableWAF: true,
        enableAPIKeyRotation: true // Enable for production APIs
      };

    default:
      return baseConfig;
  }
}

/**
 * Example of emergency mode activation
 */
export async function handleSecurityEmergency(app: express.Express, emergencyType: string) {
  try {
    logger.warn('Security emergency detected', { emergencyType });

    // Import emergency functions
    const { activateEmergencyMode, emergencySecurityMiddleware } = await import('../middleware/security');

    // Activate emergency mode
    await activateEmergencyMode('all', 3600, `Emergency: ${emergencyType}`);

    // Apply emergency middleware to new routes
    app.use(emergencySecurityMiddleware);

    logger.warn('Emergency security mode activated', { 
      emergencyType,
      duration: 3600,
      timestamp: new Date().toISOString()
    });

    return { success: true, message: 'Emergency mode activated' };
  } catch (error) {
    logger.error('Failed to activate emergency mode', { error, emergencyType });
    throw error;
  }
}

/**
 * Example of security monitoring setup
 */
export function setupSecurityMonitoring(app: express.Express) {
  // Set up interval for security health monitoring
  setInterval(async () => {
    try {
      const { getSecurityStatus } = await import('../services/security.service');
      const status = await getSecurityStatus();

      if (status.overallStatus === 'unhealthy') {
        logger.error('Security system unhealthy', { status });
        // In production, trigger alerts here
      } else if (status.overallStatus === 'degraded') {
        logger.warn('Security system degraded', { status });
        // In production, trigger warnings here
      }
    } catch (error) {
      logger.error('Security monitoring check failed', { error });
    }
  }, 30000); // Check every 30 seconds

  logger.info('Security monitoring setup completed');
}

/**
 * Example usage in main application file
 */
export async function example_main() {
  try {
    // Create secure Express app
    const app = await createSecureApp();

    // Setup security monitoring
    setupSecurityMonitoring(app);

    // Start server
    const PORT = process.env.PORT || 3000;
    const HTTPS_PORT = process.env.HTTPS_PORT || 443;

    if (process.env.NODE_ENV === 'production') {
      // Production: HTTPS only
      const https = require('https');
      const fs = require('fs');

      const httpsOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH)
      };

      https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
        logger.info(`Secure server running on port ${HTTPS_PORT}`);
      });

      // Redirect HTTP to HTTPS
      const http = require('http');
      http.createServer((req: any, res: any) => {
        res.writeHead(301, { 
          Location: `https://${req.headers.host}${req.url}` 
        });
        res.end();
      }).listen(PORT);

    } else {
      // Development: HTTP only
      app.listen(PORT, () => {
        logger.info(`Development server running on port ${PORT}`);
      });
    }

  } catch (error) {
    logger.error('Failed to start secure application', { error });
    process.exit(1);
  }
}

/**
 * Example of custom security middleware
 */
export const customSecurityMiddleware = [
  // Example: IP whitelist for admin endpoints
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/v1/admin/')) {
      const allowedIPs = process.env.ADMIN_WHITELIST_IPS?.split(',') || [];
      
      if (allowedIPs.length > 0 && !allowedIPs.includes(req.ip)) {
        logger.warn('Admin access denied - IP not whitelisted', { 
          ip: req.ip, 
          path: req.path 
        });
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'IP_NOT_WHITELISTED',
            message: 'Access denied'
          }
        });
      }
    }
    next();
  },

  // Example: Additional rate limiting for API endpoints
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/v1/') && req.method === 'POST') {
      // Additional validation for POST requests
      if (!req.headers['content-type']?.includes('application/json')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: 'JSON content type required'
          }
        });
      }
    }
    next();
  }
];

/**
 * Example of environment-specific security setup
 */
export async function setupEnvironmentSecurity(app: express.Express) {
  const env = process.env.NODE_ENV || 'development';
  const securityConfig = getSecurityConfigForEnvironment(env);

  logger.info('Setting up environment-specific security', { 
    environment: env, 
    config: securityConfig 
  });

  await initializeSecurity(app, securityConfig);

  // Add custom middleware for specific environments
  if (env === 'production') {
    app.use(customSecurityMiddleware);
  }

  logger.info('Environment security setup completed', { environment: env });
}

// Export main functions
export default {
  createSecureApp,
  setupSecurityMonitoring,
  handleSecurityEmergency,
  getSecurityConfigForEnvironment,
  setupEnvironmentSecurity
};
