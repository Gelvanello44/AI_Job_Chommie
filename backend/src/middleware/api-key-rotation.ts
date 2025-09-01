/**
 * API Key Rotation System
 * Implements automated API key rotation for external services with versioning and graceful transitions
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export interface APIKeyConfig {
  serviceName: string;
  rotationInterval: number; // hours
  keyLength: number;
  gracePeriod: number; // hours - time to keep old keys active
  maxVersions: number;
  encryptionKey: string;
  notificationThreshold: number; // hours before expiry to notify
}

export interface APIKeyVersion {
  version: number;
  key: string;
  encryptedKey: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  rotatedAt?: Date;
  usageCount: number;
}

export interface APIKeyRotationRequest extends Request {
  apiKeyInfo?: {
    serviceName: string;
    version: number;
    key: string;
    isExpiring: boolean;
  };
}

class APIKeyRotationManager {
  private services: Map<string, APIKeyConfig> = new Map();
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Temporarily disabled to fix server startup
    // this.initializeDefaultServices();
  }

  /**
   * Initialize default service configurations
   */
  private initializeDefaultServices(): void {
    const defaultServices = [
      {
        serviceName: 'paystack',
        rotationInterval: 168, // 7 days
        keyLength: 32,
        gracePeriod: 24, // 1 day
        maxVersions: 5,
        encryptionKey: process.env.API_KEY_ENCRYPTION_KEY || 'default-encryption-key',
        notificationThreshold: 24 // 1 day
      },
      {
        serviceName: 'yoco',
        rotationInterval: 168, // 7 days
        keyLength: 32,
        gracePeriod: 24,
        maxVersions: 5,
        encryptionKey: process.env.API_KEY_ENCRYPTION_KEY || 'default-encryption-key',
        notificationThreshold: 24
      },
      {
        serviceName: 'openai',
        rotationInterval: 720, // 30 days
        keyLength: 32,
        gracePeriod: 48, // 2 days
        maxVersions: 3,
        encryptionKey: process.env.API_KEY_ENCRYPTION_KEY || 'default-encryption-key',
        notificationThreshold: 72 // 3 days
      }
    ];

    defaultServices.forEach(service => {
      this.registerService(service);
    });
  }

  /**
   * Register a service for API key rotation
   */
  registerService(config: APIKeyConfig): void {
    this.services.set(config.serviceName, config);
    this.scheduleRotation(config.serviceName);
    logger.info('Service registered for API key rotation', { 
      serviceName: config.serviceName,
      rotationInterval: config.rotationInterval 
    });
  }

  /**
   * Schedule automatic key rotation for a service
   */
  private scheduleRotation(serviceName: string): void {
    const config = this.services.get(serviceName);
    if (!config) return;

    // Clear existing timer
    const existingTimer = this.rotationTimers.get(serviceName);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Schedule rotation
    const intervalMs = config.rotationInterval * 60 * 60 * 1000; // Convert hours to ms
    const timer = setInterval(async () => {
      try {
        await this.rotateAPIKey(serviceName);
      } catch (error) {
        logger.error('Scheduled API key rotation failed', {
          serviceName,
          error: error.message
        });
      }
    }, intervalMs);

    this.rotationTimers.set(serviceName, timer);
    logger.info('API key rotation scheduled', { serviceName, intervalHours: config.rotationInterval });
  }

  /**
   * Generate a new API key
   */
  private generateAPIKey(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt API key for storage
   */
  private encryptAPIKey(key: string, encryptionKey: string): string {
    // Create a proper key and IV for AES-256-CBC
    const algorithm = 'aes-256-cbc';
    const keyBuffer = crypto.createHash('sha256').update(encryptionKey).digest();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt API key
   */
  private decryptAPIKey(encryptedKey: string, encryptionKey: string): string {
    // Split IV and encrypted data
    const parts = encryptedKey.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted key format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // Create a proper key for AES-256-CBC
    const algorithm = 'aes-256-cbc';
    const keyBuffer = crypto.createHash('sha256').update(encryptionKey).digest();
    
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Store API key version in Redis
   */
  private async storeKeyVersion(serviceName: string, keyVersion: APIKeyVersion): Promise<void> {
    const key = `api_keys:${serviceName}:${keyVersion.version}`;
    const data = {
      ...keyVersion,
      createdAt: keyVersion.createdAt.toISOString(),
      expiresAt: keyVersion.expiresAt.toISOString(),
      rotatedAt: keyVersion.rotatedAt?.toISOString()
    };
    
    const ttl = Math.floor((keyVersion.expiresAt.getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await redis.setex(key, ttl, JSON.stringify(data));
    } else {
      // If TTL is negative or zero, just set without expiry
      await redis.set(key, JSON.stringify(data));
    }
    
    // Update active key pointer
    if (keyVersion.isActive) {
      await redis.set(`api_keys:${serviceName}:active`, keyVersion.version.toString());
    }
  }

  /**
   * Get API key version from Redis
   */
  private async getKeyVersion(serviceName: string, version: number): Promise<APIKeyVersion | null> {
    const key = `api_keys:${serviceName}:${version}`;
    const data = await redis.get(key);
    
    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      expiresAt: new Date(parsed.expiresAt),
      rotatedAt: parsed.rotatedAt ? new Date(parsed.rotatedAt) : undefined
    };
  }

  /**
   * Get current active API key for a service
   */
  async getCurrentAPIKey(serviceName: string): Promise<APIKeyVersion | null> {
    try {
      const activeVersionStr = await redis.get(`api_keys:${serviceName}:active`);
      if (!activeVersionStr) return null;

      const activeVersion = parseInt(activeVersionStr);
      const keyVersion = await this.getKeyVersion(serviceName, activeVersion);

      if (keyVersion && keyVersion.expiresAt > new Date()) {
        // Decrypt the key
        const config = this.services.get(serviceName);
        if (config) {
          keyVersion.key = this.decryptAPIKey(keyVersion.encryptedKey, config.encryptionKey);
        }
        return keyVersion;
      }

      return null;
    } catch (error) {
      logger.error('Error getting current API key', { serviceName, error: error.message });
      return null;
    }
  }

  /**
   * Rotate API key for a service
   */
  async rotateAPIKey(serviceName: string, force: boolean = false): Promise<APIKeyVersion> {
    try {
      const config = this.services.get(serviceName);
      if (!config) {
        throw new Error(`Service ${serviceName} not registered`);
      }

      // Get current active key
      const currentKey = await this.getCurrentAPIKey(serviceName);
      
      // Check if rotation is needed
      if (!force && currentKey) {
        const hoursUntilExpiry = (currentKey.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilExpiry > config.notificationThreshold) {
          logger.debug('API key rotation not needed yet', { 
            serviceName, 
            hoursUntilExpiry: Math.round(hoursUntilExpiry) 
          });
          return currentKey;
        }
      }

      // Generate new key
      const newKey = this.generateAPIKey(config.keyLength);
      const encryptedKey = this.encryptAPIKey(newKey, config.encryptionKey);
      
      // Get next version number
      const nextVersion = currentKey ? currentKey.version + 1 : 1;
      
      // Create new key version
      const newKeyVersion: APIKeyVersion = {
        version: nextVersion,
        key: newKey,
        encryptedKey,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (config.rotationInterval * 60 * 60 * 1000)),
        isActive: true,
        usageCount: 0
      };

      // Store new key
      await this.storeKeyVersion(serviceName, newKeyVersion);

      // Mark old key as inactive (but keep for grace period)
      if (currentKey) {
        currentKey.isActive = false;
        currentKey.rotatedAt = new Date();
        await this.storeKeyVersion(serviceName, currentKey);

        // Schedule cleanup of old key after grace period
        setTimeout(async () => {
          await this.cleanupExpiredKey(serviceName, currentKey.version);
        }, config.gracePeriod * 60 * 60 * 1000);
      }

      // Clean up old versions
      await this.cleanupOldVersions(serviceName);

      logger.info('API key rotated successfully', {
        serviceName,
        newVersion: nextVersion,
        previousVersion: currentKey?.version,
        expiresAt: newKeyVersion.expiresAt
      });

      // Return new key (without encrypted version)
      const { encryptedKey: _, ...safeKeyVersion } = newKeyVersion;
      return safeKeyVersion as APIKeyVersion;

    } catch (error) {
      logger.error('API key rotation failed', { serviceName, error: error.message });
      throw error;
    }
  }

  /**
   * Cleanup expired key version
   */
  private async cleanupExpiredKey(serviceName: string, version: number): Promise<void> {
    try {
      const key = `api_keys:${serviceName}:${version}`;
      await redis.del(key);
      logger.info('Expired API key cleaned up', { serviceName, version });
    } catch (error) {
      logger.error('Error cleaning up expired key', { serviceName, version, error: error.message });
    }
  }

  /**
   * Cleanup old key versions beyond maxVersions limit
   */
  private async cleanupOldVersions(serviceName: string): Promise<void> {
    try {
      const config = this.services.get(serviceName);
      if (!config) return;

      const pattern = `api_keys:${serviceName}:*`;
      const keys = await redis.keys(pattern);
      
      // Extract version numbers and sort
      const versions = keys
        .map(key => {
          const match = key.match(/(\d+)$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(v => v > 0)
        .sort((a, b) => b - a); // Sort descending

      // Delete versions beyond max limit
      if (versions.length > config.maxVersions) {
        const versionsToDelete = versions.slice(config.maxVersions);
        
        for (const version of versionsToDelete) {
          await this.cleanupExpiredKey(serviceName, version);
        }

        logger.info('Old API key versions cleaned up', {
          serviceName,
          deletedVersions: versionsToDelete
        });
      }
    } catch (error) {
      logger.error('Error cleaning up old versions', { serviceName, error: error.message });
    }
  }

  /**
   * Validate API key middleware
   */
  validateAPIKey(serviceName: string) {
    return async (req: APIKeyRotationRequest, res: Response, next: NextFunction) => {
      try {
        const apiKey = req.headers['x-api-key'] as string || 
                      req.headers['authorization']?.replace('Bearer ', '') ||
                      req.query.api_key as string;

        if (!apiKey) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'API_KEY_MISSING',
              message: 'API key is required'
            }
          });
        }

        // Find valid key version
        const currentKey = await this.getCurrentAPIKey(serviceName);
        
        if (!currentKey || currentKey.key !== apiKey) {
          logger.warn('Invalid API key used', {
            serviceName,
            providedKey: apiKey.substring(0, 8) + '...',
            ip: req.ip,
            userAgent: req.headers['user-agent']
          });

          return res.status(401).json({
            success: false,
            error: {
              code: 'API_KEY_INVALID',
              message: 'Invalid API key'
            }
          });
        }

        // Check expiry
        if (currentKey.expiresAt <= new Date()) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'API_KEY_EXPIRED',
              message: 'API key has expired'
            }
          });
        }

        // Update usage count
        await this.incrementUsageCount(serviceName, currentKey.version);

        // Check if key is expiring soon
        const hoursUntilExpiry = (currentKey.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
        const config = this.services.get(serviceName);
        const isExpiring = config && hoursUntilExpiry <= config.notificationThreshold;

        // Add key info to request
        req.apiKeyInfo = {
          serviceName,
          version: currentKey.version,
          key: currentKey.key,
          isExpiring: !!isExpiring
        };

        // Add warning header if key is expiring
        if (isExpiring) {
          res.setHeader('X-API-Key-Expiring', `${Math.round(hoursUntilExpiry)} hours`);
        }

        next();
      } catch (error) {
        logger.error('API key validation error', { serviceName, error: error.message });
        res.status(500).json({
          success: false,
          error: {
            code: 'API_KEY_VALIDATION_ERROR',
            message: 'Error validating API key'
          }
        });
      }
    };
  }

  /**
   * Increment usage count for API key
   */
  private async incrementUsageCount(serviceName: string, version: number): Promise<void> {
    try {
      const usageKey = `api_keys:${serviceName}:${version}:usage`;
      await redis.incr(usageKey);
      await redis.expire(usageKey, 7 * 24 * 60 * 60); // Expire usage counter after 7 days
    } catch (error) {
      logger.error('Error incrementing usage count', { serviceName, version, error: error.message });
    }
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStats(serviceName: string, version?: number): Promise<{
    currentVersion: number;
    totalUsage: number;
    versionUsage: { version: number; count: number; expiresAt: Date }[];
  }> {
    try {
      const currentKey = await this.getCurrentAPIKey(serviceName);
      if (!currentKey) {
        throw new Error('No active API key found');
      }

      const versionUsage: { version: number; count: number; expiresAt: Date }[] = [];
      
      // Get usage for specific version or all versions
      const versions = version ? [version] : await this.getAllVersions(serviceName);
      
      for (const v of versions) {
        const usageKey = `api_keys:${serviceName}:${v}:usage`;
        const count = await redis.get(usageKey);
        const keyVersion = await this.getKeyVersion(serviceName, v);
        
        if (keyVersion) {
          versionUsage.push({
            version: v,
            count: parseInt(count || '0'),
            expiresAt: keyVersion.expiresAt
          });
        }
      }

      const totalUsage = versionUsage.reduce((sum, v) => sum + v.count, 0);

      return {
        currentVersion: currentKey.version,
        totalUsage,
        versionUsage
      };
    } catch (error) {
      logger.error('Error getting usage stats', { serviceName, error: error.message });
      throw error;
    }
  }

  /**
   * Get all versions for a service
   */
  private async getAllVersions(serviceName: string): Promise<number[]> {
    const pattern = `api_keys:${serviceName}:*`;
    const keys = await redis.keys(pattern);
    
    return keys
      .map(key => {
        const match = key.match(/(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(v => v > 0)
      .sort((a, b) => b - a);
  }

  /**
   * Force rotation of API key
   */
  async forceRotation(serviceName: string): Promise<APIKeyVersion> {
    logger.info('Forcing API key rotation', { serviceName });
    return await this.rotateAPIKey(serviceName, true);
  }

  /**
   * Get rotation status for all services
   */
  async getRotationStatus(): Promise<{
    services: {
      serviceName: string;
      currentVersion: number;
      expiresAt: Date;
      hoursUntilExpiry: number;
      isExpiring: boolean;
      usageCount: number;
      status: 'healthy' | 'expiring' | 'expired';
    }[];
    totalServices: number;
    expiringServices: number;
  }> {
    const services = [];
    let expiringServices = 0;

    for (const [serviceName, config] of this.services) {
      try {
        const currentKey = await this.getCurrentAPIKey(serviceName);
        
        if (currentKey) {
          const hoursUntilExpiry = (currentKey.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
          const isExpiring = hoursUntilExpiry <= config.notificationThreshold;
          const isExpired = hoursUntilExpiry <= 0;
          
          if (isExpiring && !isExpired) expiringServices++;

          const usageKey = `api_keys:${serviceName}:${currentKey.version}:usage`;
          const usageCount = parseInt(await redis.get(usageKey) || '0');

          services.push({
            serviceName,
            currentVersion: currentKey.version,
            expiresAt: currentKey.expiresAt,
            hoursUntilExpiry: Math.round(hoursUntilExpiry),
            isExpiring,
            usageCount,
            status: isExpired ? 'expired' : isExpiring ? 'expiring' : 'healthy'
          });
        }
      } catch (error) {
        logger.error('Error getting rotation status for service', { serviceName, error: error.message });
      }
    }

    return {
      services,
      totalServices: this.services.size,
      expiringServices
    };
  }

  /**
   * Health check for API key rotation system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      totalServices: number;
      activeKeys: number;
      expiringKeys: number;
      expiredKeys: number;
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

      // Get rotation status
      const rotationStatus = await this.getRotationStatus();
      
      const expiredKeys = rotationStatus.services.filter(s => s.status === 'expired').length;
      const expiringKeys = rotationStatus.services.filter(s => s.status === 'expiring').length;

      if (expiredKeys > 0) {
        issues.push(`${expiredKeys} API keys have expired`);
        status = 'unhealthy';
      } else if (expiringKeys > 0) {
        issues.push(`${expiringKeys} API keys are expiring soon`);
        if (status === 'healthy') status = 'degraded';
      }

      return {
        status,
        metrics: {
          totalServices: rotationStatus.totalServices,
          activeKeys: rotationStatus.services.filter(s => s.status === 'healthy').length,
          expiringKeys,
          expiredKeys,
          redisConnected
        },
        issues
      };
    } catch (error) {
      logger.error('API key rotation health check error', { error: error.message });
      return {
        status: 'unhealthy',
        metrics: {
          totalServices: 0,
          activeKeys: 0,
          expiringKeys: 0,
          expiredKeys: 0,
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
   * Stop all rotation timers (for graceful shutdown)
   */
  stopAllRotations(): void {
    for (const [serviceName, timer] of this.rotationTimers) {
      clearInterval(timer);
      logger.info('API key rotation timer stopped', { serviceName });
    }
    this.rotationTimers.clear();
  }
}

// Create and export API key rotation manager
export const apiKeyRotationManager = new APIKeyRotationManager();

// Export middleware for different services
export const validatePaystackKey = apiKeyRotationManager.validateAPIKey('paystack');
export const validateYocoKey = apiKeyRotationManager.validateAPIKey('yoco');
export const validateOpenAIKey = apiKeyRotationManager.validateAPIKey('openai');

// Export utility functions
export const getCurrentAPIKey = (serviceName: string) => 
  apiKeyRotationManager.getCurrentAPIKey(serviceName);

export const forceKeyRotation = (serviceName: string) => 
  apiKeyRotationManager.forceRotation(serviceName);

export const getKeyUsageStats = (serviceName: string, version?: number) => 
  apiKeyRotationManager.getUsageStats(serviceName, version);

export const getRotationStatus = () => 
  apiKeyRotationManager.getRotationStatus();

export const apiKeyHealthCheck = () => 
  apiKeyRotationManager.healthCheck();

export const stopKeyRotations = () => 
  apiKeyRotationManager.stopAllRotations();

/**
 * Initialize API key rotation on startup
 */
export const initializeAPIKeyRotation = async (): Promise<void> => {
  try {
    logger.info('API key rotation system disabled temporarily');
    // Disabled temporarily to fix server startup
    return;
  } catch (error) {
    logger.error('Failed to initialize API key rotation', { error: error.message });
    throw error;
  }
};

/**
 * Graceful shutdown of API key rotation
 */
export const shutdownAPIKeyRotation = (): void => {
  logger.info('Shutting down API key rotation system');
  apiKeyRotationManager.stopAllRotations();
};
