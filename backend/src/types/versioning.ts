/**
 * Type definitions for API versioning system
 */

import { Request, Response, NextFunction } from 'express';

// API Version types
export type ApiVersion = 'v1' | 'v2';

export interface VersionConfig {
  deprecated: boolean;
  sunsetDate: string | null;
  supportedFeatures: string[];
}

export interface VersionCompatibilityMatrix {
  [version: string]: VersionConfig;
}

// Extended Request interface with version information
export interface VersionedRequest extends Request {
  apiVersion: ApiVersion;
  versionConfig: VersionConfig;
}

// Version-aware response helpers
export interface VersionedResponse {
  success: boolean;
  version?: ApiVersion;
  timestamp: string;
  [key: string]: any;
}

// Rate limiting types for subscription tiers
export interface SubscriptionLimits {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export interface SubscriptionTierLimits {
  FREE: SubscriptionLimits;
  BASIC: SubscriptionLimits;
  PROFESSIONAL: SubscriptionLimits;
  ENTERPRISE: SubscriptionLimits;
}

// Migration configuration
export interface MigrationConfig {
  fromVersion: ApiVersion;
  toVersion: ApiVersion;
  transformRequest?: (req: VersionedRequest) => void;
  transformResponse?: (data: any) => any;
}

// Deprecation warning configuration
export interface DeprecationWarning {
  message: string;
  sunsetDate?: string;
  alternativeVersion?: ApiVersion;
  alternativeEndpoint?: string;
}

// Version analytics data
export interface VersionUsageStats {
  requests: number;
  lastUsed: Date;
  popularEndpoints: Map<string, number>;
}

export interface VersionAnalyticsData {
  [version: string]: {
    requests: number;
    lastUsed: Date;
    popularEndpoints: Array<{
      endpoint: string;
      count: number;
    }>;
  };
}

// Middleware configuration types
export interface AdvancedRateLimiterConfig {
  windowMs: number;
  defaultMax: number;
  subscriptionMultiplier?: boolean;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  prefix?: string;
  customLimits?: Record<string, number>;
}

export interface SlidingWindowOptions {
  windowSize: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface SlidingWindowResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

// Version-aware route handler type
export type VersionAwareHandler = {
  [K in ApiVersion]?: (req: VersionedRequest, res: Response, next: NextFunction) => void;
};

// Feature gate configuration
export interface FeatureGateConfig {
  feature: string;
  requiredVersion?: ApiVersion;
  subscriptionTier?: string[];
  customCheck?: (req: VersionedRequest) => boolean;
}

// Error response types
export interface VersionedErrorResponse {
  success: false;
  error: string;
  version?: ApiVersion;
  details?: any;
  timestamp: string;
  upgradeRequired?: boolean;
  supportedVersions?: ApiVersion[];
}

// Health check response
export interface VersionHealthResponse {
  version: ApiVersion;
  status: 'healthy' | 'degraded' | 'deprecated';
  features: string[];
  deprecated: boolean;
  sunsetDate?: string;
  timestamp: string;
}

// Version statistics response
export interface VersionStatsResponse {
  totalKeys: number;
  timeRange: string;
  timestamp: string;
  [key: string]: any;
}

export default {
  ApiVersion,
  VersionConfig,
  VersionCompatibilityMatrix,
  VersionedRequest,
  VersionedResponse,
  SubscriptionLimits,
  SubscriptionTierLimits,
  MigrationConfig,
  DeprecationWarning,
  VersionUsageStats,
  VersionAnalyticsData,
  AdvancedRateLimiterConfig,
  SlidingWindowOptions,
  SlidingWindowResult,
  VersionAwareHandler,
  FeatureGateConfig,
  VersionedErrorResponse,
  VersionHealthResponse,
  VersionStatsResponse,
};
