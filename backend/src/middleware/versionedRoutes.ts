/**
 * Versioned Route Adapters
 * Integrates API versioning with existing route handlers
 */

import { Router } from 'express';
import { VersionedRouter, API_VERSIONS, requireFeature } from './versioning';

// Import version compatibility from versioning module
const VERSION_COMPATIBILITY = {
  v1: { deprecated: false },
  v2: { deprecated: false },
};

// Import existing route handlers
import authRoutes from '../routes/auth.routes';
import jobRoutes from '../routes/job.routes';
import userRoutes from '../routes/user.routes';
import paymentRoutes from '../routes/payment.routes';
import quotaRoutes from '../routes/quota.routes';
import fileRoutes from '../routes/fileRoutes';
import cvRoutes from '../routes/cv.routes';
import skillsAssessmentRoutes from '../routes/skillsAssessment.routes';
import jobSearchRoutes from '../routes/jobSearchRoutes';
import webhookRoutes from '../routes/webhook.routes';

/**
 * Create versioned API router
 */
export function createVersionedApiRouter(): Router {
  const versionedRouter = new VersionedRouter();
  const mainRouter = Router();
  
  // ==============================================
  // VERSION 1 ROUTES (Legacy/Backward Compatible)
  // ==============================================
  
  // V1 - Basic authentication and user management
  versionedRouter.addRoute(API_VERSIONS.V1, 'use', '/auth', authRoutes);
  versionedRouter.addRoute(API_VERSIONS.V1, 'use', '/users', userRoutes);
  
  // V1 - Basic job operations
  versionedRouter.addRoute(API_VERSIONS.V1, 'use', '/jobs', jobRoutes);
  versionedRouter.addRoute(API_VERSIONS.V1, 'use', '/search', jobSearchRoutes);
  
  // V1 - Basic file operations
  versionedRouter.addRoute(API_VERSIONS.V1, 'use', '/files', fileRoutes);
  versionedRouter.addRoute(API_VERSIONS.V1, 'use', '/cv', cvRoutes);
  
  // V1 - Basic payment operations (limited features)
  const v1PaymentRouter = Router();
  v1PaymentRouter.use(createV1PaymentCompatibility());
  v1PaymentRouter.use(paymentRoutes);
  versionedRouter.addRoute(API_VERSIONS.V1, 'use', '/payments', v1PaymentRouter);
  
  // ==============================================
  // VERSION 2 ROUTES (Current/Full Features)
  // ==============================================
  
  // V2 - Enhanced authentication with OAuth
  versionedRouter.addRoute(API_VERSIONS.V2, 'use', '/auth', authRoutes);
  versionedRouter.addRoute(API_VERSIONS.V2, 'use', '/users', userRoutes);
  
  // V2 - Enhanced job operations
  versionedRouter.addRoute(API_VERSIONS.V2, 'use', '/jobs', jobRoutes);
  versionedRouter.addRoute(API_VERSIONS.V2, 'use', '/search', jobSearchRoutes);
  
  // V2 - AI/ML features (V2 only)
  const v2AIRouter = Router();
  v2AIRouter.use(requireFeature('ai_features'));
  v2AIRouter.use('/skills-assessment', skillsAssessmentRoutes);
  versionedRouter.addRoute(API_VERSIONS.V2, 'use', '/ai', v2AIRouter);
  
  // V2 - Full payment features
  versionedRouter.addRoute(API_VERSIONS.V2, 'use', '/payments', paymentRoutes);
  
  // V2 - Subscription and quota management
  versionedRouter.addRoute(API_VERSIONS.V2, 'use', '/quota', quotaRoutes);
  
  // V2 - File operations with enhanced features
  versionedRouter.addRoute(API_VERSIONS.V2, 'use', '/files', fileRoutes);
  versionedRouter.addRoute(API_VERSIONS.V2, 'use', '/cv', cvRoutes);
  
  // V2 - Webhooks (V2 only)
  const v2WebhookRouter = Router();
  v2WebhookRouter.use(requireFeature('webhooks'));
  v2WebhookRouter.use(webhookRoutes);
  versionedRouter.addRoute(API_VERSIONS.V2, 'use', '/webhooks', v2WebhookRouter);
  
  // ==============================================
  // VERSION ROUTING SETUP
  // ==============================================
  
  // Mount version-specific routes
  Object.values(API_VERSIONS).forEach(version => {
    const router = versionedRouter.getRouter(version);
    if (router) {
      mainRouter.use(`/${version}`, router);
    }
  });
  
  // Add version routing middleware for dynamic routing
  mainRouter.use(versionedRouter.getVersionRoutingMiddleware());
  
  return mainRouter;
}

/**
 * V1 Payment compatibility middleware
 * Transforms V1 payment requests to work with V2 payment handlers
 */
function createV1PaymentCompatibility() {
  return (req: any, res: any, next: any) => {
    // V1 used different field names for payment initialization
    if (req.body && req.method === 'POST') {
      // Transform V1 payment fields to V2 format
      if (req.body.payment_amount && !req.body.amount) {
        req.body.amount = req.body.payment_amount;
        delete req.body.payment_amount;
      }
      
      if (req.body.payment_currency && !req.body.currency) {
        req.body.currency = req.body.payment_currency;
        delete req.body.payment_currency;
      }
      
      if (req.body.payment_method && !req.body.provider) {
        req.body.provider = req.body.payment_method;
        delete req.body.payment_method;
      }
    }
    
    // Transform response for V1 compatibility
    const originalJson = res.json;
    res.json = function (data: any) {
      if (data && typeof data === 'object') {
        const v1Data = { ...data };
        
        // Transform response fields back to V1 format
        if (v1Data.amount && !v1Data.payment_amount) {
          v1Data.payment_amount = v1Data.amount;
          delete v1Data.amount;
        }
        
        if (v1Data.currency && !v1Data.payment_currency) {
          v1Data.payment_currency = v1Data.currency;
          delete v1Data.currency;
        }
        
        if (v1Data.provider && !v1Data.payment_method) {
          v1Data.payment_method = v1Data.provider;
          delete v1Data.provider;
        }
        
        // Remove V2-only payment features
        delete v1Data.subscriptionData;
        delete v1Data.webhookEvents;
        
        return originalJson.call(this, v1Data);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Create version-aware route handler
 */
export function createVersionAwareHandler(handlers: {
  [key in ApiVersion]?: any;
}) {
  return (req: any, res: any, next: any) => {
    const version = req.apiVersion;
    const handler = handlers[version] || handlers[API_VERSIONS.V2]; // Fallback to V2
    
    if (!handler) {
      return res.status(501).json({
        success: false,
        error: `Handler not implemented for version ${version}`,
        timestamp: new Date().toISOString(),
      });
    }
    
    return handler(req, res, next);
  };
}

/**
 * Migration helper for upgrading routes from V1 to V2
 */
export class RouteMigrationHelper {
  private migrations: Map<string, {
    fromVersion: ApiVersion;
    toVersion: ApiVersion;
    transformRequest?: (req: any) => void;
    transformResponse?: (data: any) => any;
  }> = new Map();
  
  addMigration(
    endpoint: string,
    fromVersion: ApiVersion,
    toVersion: ApiVersion,
    transforms?: {
      transformRequest?: (req: any) => void;
      transformResponse?: (data: any) => any;
    }
  ) {
    this.migrations.set(endpoint, {
      fromVersion,
      toVersion,
      ...transforms,
    });
  }
  
  getMigrationMiddleware() {
    return (req: any, res: any, next: any) => {
      const endpoint = req.route?.path || req.path;
      const migration = this.migrations.get(endpoint);
      
      if (migration && req.apiVersion === migration.fromVersion) {
        // Apply request transformation
        if (migration.transformRequest) {
          migration.transformRequest(req);
        }
        
        // Apply response transformation
        if (migration.transformResponse) {
          const originalJson = res.json;
          res.json = function (data: any) {
            const transformedData = migration.transformResponse!(data);
            return originalJson.call(this, transformedData);
          };
        }
        
        // Add migration headers
        res.set({
          'X-Migration-Available': migration.toVersion,
          'X-Migration-Endpoint': endpoint,
        });
      }
      
      next();
    };
  }
}

/**
 * Version-specific middleware stacks
 */
export const versionSpecificMiddleware = {
  [API_VERSIONS.V1]: [
    // V1 specific middleware
    (req: any, res: any, next: any) => {
      // Add V1 specific headers
      res.set('X-API-Legacy', 'true');
      next();
    },
  ],
  
  [API_VERSIONS.V2]: [
    // V2 specific middleware
    (req: any, res: any, next: any) => {
      // Add V2 specific headers
      res.set('X-API-Enhanced', 'true');
      next();
    },
  ],
};

/**
 * Health check endpoints for each version
 */
export const versionHealthEndpoints = {
  [API_VERSIONS.V1]: (req: any, res: any) => {
    res.json({
      version: API_VERSIONS.V1,
      status: 'healthy',
      features: ['auth', 'jobs', 'users', 'payments'],
      deprecated: VERSION_COMPATIBILITY[API_VERSIONS.V1].deprecated,
      timestamp: new Date().toISOString(),
    });
  },
  
  [API_VERSIONS.V2]: (req: any, res: any) => {
    res.json({
      version: API_VERSIONS.V2,
      status: 'healthy',
      features: ['auth', 'oauth', 'jobs', 'users', 'payments', 'ai', 'webhooks'],
      deprecated: VERSION_COMPATIBILITY[API_VERSIONS.V2].deprecated,
      timestamp: new Date().toISOString(),
    });
  },
};

// Create and export the migration helper instance
export const routeMigrationHelper = new RouteMigrationHelper();

// Example migrations
routeMigrationHelper.addMigration(
  '/users/profile',
  API_VERSIONS.V1,
  API_VERSIONS.V2,
  {
    transformRequest: (req) => {
      // V1 to V2 profile transformation
      if (req.body.phone_number) {
        req.body.phone = req.body.phone_number;
        delete req.body.phone_number;
      }
    },
    transformResponse: (data) => {
      // V2 to V1 response transformation
      if (data.phone) {
        data.phone_number = data.phone;
        delete data.phone;
      }
      return data;
    },
  }
);

export default {
  createVersionedApiRouter,
  createVersionAwareHandler,
  RouteMigrationHelper,
  routeMigrationHelper,
  versionSpecificMiddleware,
  versionHealthEndpoints,
};
