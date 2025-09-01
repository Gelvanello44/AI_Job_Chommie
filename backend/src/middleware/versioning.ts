/**
 * API Versioning Middleware and Infrastructure
 * Implements URL-based API versioning with backward compatibility,
 * deprecation warnings, and version-specific routing
 */

import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import logger from '../config/logger';

// Supported API versions
export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2',
} as const;

export type ApiVersion = (typeof API_VERSIONS)[keyof typeof API_VERSIONS];

// Version compatibility matrix
const VERSION_COMPATIBILITY = {
  [API_VERSIONS.V1]: {
    deprecated: false,
    sunsetDate: null,
    supportedFeatures: ['basic_auth', 'jobs', 'users', 'payments'],
  },
  [API_VERSIONS.V2]: {
    deprecated: false,
    sunsetDate: null,
    supportedFeatures: ['basic_auth', 'oauth', 'jobs', 'users', 'payments', 'ai_features', 'webhooks'],
  },
};

// Default version if not specified
const DEFAULT_VERSION = API_VERSIONS.V2;

/**
 * Extract API version from request
 */
export function extractApiVersion(req: Request): ApiVersion {
  // 1. Check URL path parameter (/api/v1/users)
  const pathVersion = req.path.match(/^\/api\/(v\d+)/)?.[1];
  if (pathVersion && Object.values(API_VERSIONS).includes(pathVersion as ApiVersion)) {
    return pathVersion as ApiVersion;
  }
  
  // 2. Check Accept header version (Accept: application/vnd.jobchommie.v1+json)
  const acceptHeader = req.headers.accept;
  if (acceptHeader) {
    const headerVersion = acceptHeader.match(/vnd\.jobchommie\.(v\d+)/)?.[1];
    if (headerVersion && Object.values(API_VERSIONS).includes(headerVersion as ApiVersion)) {
      return headerVersion as ApiVersion;
    }
  }
  
  // 3. Check custom version header
  const versionHeader = req.headers['x-api-version'] as string;
  if (versionHeader && Object.values(API_VERSIONS).includes(versionHeader as ApiVersion)) {
    return versionHeader as ApiVersion;
  }
  
  // 4. Check query parameter
  const queryVersion = req.query.version as string;
  if (queryVersion && Object.values(API_VERSIONS).includes(queryVersion as ApiVersion)) {
    return queryVersion as ApiVersion;
  }
  
  return DEFAULT_VERSION;
}

/**
 * API versioning middleware
 */
export const apiVersionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const version = extractApiVersion(req);
  const versionConfig = VERSION_COMPATIBILITY[version];
  
  if (!versionConfig) {
    return res.status(400).json({
      success: false,
      error: 'Unsupported API version',
      supportedVersions: Object.values(API_VERSIONS),
      timestamp: new Date().toISOString(),
    });
  }
  
  // Add version info to request object
  (req as any).apiVersion = version;
  (req as any).versionConfig = versionConfig;
  
  // Add version headers to response
  res.set({
    'X-API-Version': version,
    'X-API-Supported-Versions': Object.values(API_VERSIONS).join(', '),
  });
  
  // Add deprecation warning if version is deprecated
  if (versionConfig.deprecated) {
    res.set('Deprecation', 'true');
    if (versionConfig.sunsetDate) {
      res.set('Sunset', versionConfig.sunsetDate);
    }
    
    logger.warn('Deprecated API version used', {
      version,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
    });
  }
  
  next();
};

/**
 * Version-specific feature gate middleware
 */
export const requireFeature = (feature: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const versionConfig = (req as any).versionConfig;
    
    if (!versionConfig?.supportedFeatures.includes(feature)) {
      return res.status(501).json({
        success: false,
        error: `Feature '${feature}' not supported in API version ${(req as any).apiVersion}`,
        upgradeRequired: true,
        supportedVersions: Object.entries(VERSION_COMPATIBILITY)
          .filter(([_, config]) => config.supportedFeatures.includes(feature))
          .map(([version]) => version),
        timestamp: new Date().toISOString(),
      });
    }
    
    next();
  };
};

/**
 * Backward compatibility transformer middleware
 */
export const backwardCompatibilityTransformer = (req: Request, res: Response, next: NextFunction) => {
  const version = (req as any).apiVersion;
  
  // Transform request for backward compatibility
  if (version === API_VERSIONS.V1) {
    // V1 specific transformations
    transformRequestForV1(req);
    
    // Override response.json to transform response
    const originalJson = res.json;
    res.json = function (data: any) {
      const transformedData = transformResponseForV1(data);
      return originalJson.call(this, transformedData);
    };
  }
  
  next();
};

/**
 * Transform request data for V1 compatibility
 */
function transformRequestForV1(req: Request) {
  // Example: V1 used 'phone_number' instead of 'phone'
  if (req.body && req.body.phone_number && !req.body.phone) {
    req.body.phone = req.body.phone_number;
    delete req.body.phone_number;
  }
  
  // Example: V1 used different field names for jobs
  if (req.body && req.body.job_type && !req.body.type) {
    req.body.type = req.body.job_type;
    delete req.body.job_type;
  }
}

/**
 * Transform response data for V1 compatibility
 */
function transformResponseForV1(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(transformResponseForV1);
  }
  
  const transformed = { ...data };
  
  // Transform field names for V1
  if (transformed.phone && !transformed.phone_number) {
    transformed.phone_number = transformed.phone;
    delete transformed.phone;
  }
  
  if (transformed.type && !transformed.job_type) {
    transformed.job_type = transformed.type;
    delete transformed.type;
  }
  
  // Remove V2-only fields
  delete transformed.aiFeatures;
  delete transformed.webhooks;
  
  // Recursively transform nested objects
  Object.keys(transformed).forEach(key => {
    if (typeof transformed[key] === 'object' && transformed[key] !== null) {
      transformed[key] = transformResponseForV1(transformed[key]);
    }
  });
  
  return transformed;
}

/**
 * Version-specific router creator
 */
export class VersionedRouter {
  private routers: Map<ApiVersion, Router> = new Map();
  
  constructor() {
    // Initialize routers for each version
    Object.values(API_VERSIONS).forEach(version => {
      this.routers.set(version, Router());
    });
  }
  
  /**
   * Add route for specific version
   */
  addRoute(
    version: ApiVersion,
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    ...handlers: any[]
  ) {
    const router = this.routers.get(version);
    if (!router) {
      throw new Error(`No router found for version ${version}`);
    }
    
    router[method](path, ...handlers);
  }
  
  /**
   * Add route for all versions
   */
  addRouteForAllVersions(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    ...handlers: any[]
  ) {
    Object.values(API_VERSIONS).forEach(version => {
      this.addRoute(version, method, path, ...handlers);
    });
  }
  
  /**
   * Get router for version
   */
  getRouter(version: ApiVersion): Router | undefined {
    return this.routers.get(version);
  }
  
  /**
   * Get middleware that routes to correct version
   */
  getVersionRoutingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const version = (req as any).apiVersion;
      const router = this.routers.get(version);
      
      if (!router) {
        return res.status(400).json({
          success: false,
          error: `No router configured for version ${version}`,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Remove version from path for routing
      const originalPath = req.path;
      req.path = req.path.replace(/^\/api\/v\d+/, '');
      
      router(req, res, (err: any) => {
        // Restore original path
        req.path = originalPath;
        next(err);
      });
    };
  }
}

/**
 * API deprecation manager
 */
export class DeprecationManager {
  private deprecationWarnings: Map<string, {
    message: string;
    sunsetDate?: string;
    alternativeVersion?: ApiVersion;
    alternativeEndpoint?: string;
  }> = new Map();
  
  /**
   * Mark version as deprecated
   */
  deprecateVersion(
    version: ApiVersion,
    message: string,
    sunsetDate?: string,
    alternativeVersion?: ApiVersion
  ) {
    VERSION_COMPATIBILITY[version].deprecated = true;
    VERSION_COMPATIBILITY[version].sunsetDate = sunsetDate || null;
    
    this.deprecationWarnings.set(version, {
      message,
      sunsetDate,
      alternativeVersion,
    });
    
    logger.info('API version deprecated', {
      version,
      message,
      sunsetDate,
      alternativeVersion,
    });
  }
  
  /**
   * Mark specific endpoint as deprecated
   */
  deprecateEndpoint(
    endpoint: string,
    message: string,
    alternativeEndpoint?: string
  ) {
    this.deprecationWarnings.set(endpoint, {
      message,
      alternativeEndpoint,
    });
  }
  
  /**
   * Get deprecation middleware for specific endpoint
   */
  getDeprecationMiddleware(endpoint: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const warning = this.deprecationWarnings.get(endpoint);
      
      if (warning) {
        res.set('Deprecation', 'true');
        res.set('X-Deprecation-Warning', warning.message);
        
        if (warning.alternativeEndpoint) {
          res.set('X-Alternative-Endpoint', warning.alternativeEndpoint);
        }
        
        logger.warn('Deprecated endpoint accessed', {
          endpoint,
          message: warning.message,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }
      
      next();
    };
  }
}

/**
 * Version content negotiation
 */
export const contentNegotiationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const version = (req as any).apiVersion;
  const acceptHeader = req.headers.accept;
  
  // Set content type based on version
  if (acceptHeader?.includes('application/vnd.jobchommie')) {
    res.type(`application/vnd.jobchommie.${version}+json`);
  } else {
    res.type('application/json');
  }
  
  next();
};

/**
 * API version health check
 */
export const versionHealthCheck = (req: Request, res: Response) => {
  const version = extractApiVersion(req);
  const versionConfig = VERSION_COMPATIBILITY[version];
  
  res.json({
    success: true,
    version,
    deprecated: versionConfig.deprecated,
    sunsetDate: versionConfig.sunsetDate,
    supportedFeatures: versionConfig.supportedFeatures,
    supportedVersions: Object.keys(VERSION_COMPATIBILITY),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Global version statistics
 */
export class VersionAnalytics {
  private usageStats: Map<ApiVersion, {
    requests: number;
    lastUsed: Date;
    popularEndpoints: Map<string, number>;
  }> = new Map();
  
  constructor() {
    // Initialize stats for each version
    Object.values(API_VERSIONS).forEach(version => {
      this.usageStats.set(version, {
        requests: 0,
        lastUsed: new Date(),
        popularEndpoints: new Map(),
      });
    });
  }
  
  /**
   * Track version usage
   */
  trackUsage(version: ApiVersion, endpoint: string) {
    const stats = this.usageStats.get(version);
    if (stats) {
      stats.requests++;
      stats.lastUsed = new Date();
      
      const currentCount = stats.popularEndpoints.get(endpoint) || 0;
      stats.popularEndpoints.set(endpoint, currentCount + 1);
    }
  }
  
  /**
   * Get usage statistics
   */
  getStats(): any {
    const stats: any = {};
    
    this.usageStats.forEach((versionStats, version) => {
      const popularEndpoints = Array.from(versionStats.popularEndpoints.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count }));
      
      stats[version] = {
        requests: versionStats.requests,
        lastUsed: versionStats.lastUsed,
        popularEndpoints,
      };
    });
    
    return stats;
  }
  
  /**
   * Get analytics middleware
   */
  getAnalyticsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const version = (req as any).apiVersion;
      const endpoint = req.originalUrl;
      
      this.trackUsage(version, endpoint);
      next();
    };
  }
}

// Create global instances
export const deprecationManager = new DeprecationManager();
export const versionAnalytics = new VersionAnalytics();

// Complete versioning middleware stack
export const versioningMiddlewareStack = [
  apiVersionMiddleware,
  contentNegotiationMiddleware,
  backwardCompatibilityTransformer,
  versionAnalytics.getAnalyticsMiddleware(),
];

/**
 * Utility function to create version-specific error responses
 */
export function createVersionedErrorResponse(
  version: ApiVersion,
  error: string,
  details?: any,
  statusCode: number = 400
) {
  const baseResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
  
  if (version === API_VERSIONS.V1) {
    // V1 format
    return {
      ...baseResponse,
      message: error, // V1 used 'message' instead of 'error'
      ...(details && { details }),
    };
  }
  
  // V2+ format
  return {
    ...baseResponse,
    ...(details && { details }),
    version,
  };
}

export default {
  API_VERSIONS,
  extractApiVersion,
  apiVersionMiddleware,
  requireFeature,
  backwardCompatibilityTransformer,
  VersionedRouter,
  DeprecationManager,
  deprecationManager,
  versionAnalytics,
  versioningMiddlewareStack,
  versionHealthCheck,
  createVersionedErrorResponse,
};
