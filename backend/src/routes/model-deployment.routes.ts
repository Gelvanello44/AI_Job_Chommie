import express from 'express';
import rateLimit from 'express-rate-limit';
import { modelDeploymentService } from '../services/model-deployment.service.js';
import logger from '../config/logger.js';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Rate limiting for deployment operations
const deploymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many deployment requests. Please try again later.',
    retryAfter: '15 minutes'
  }
});

const statusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per minute
  message: {
    error: 'Too many status requests. Please try again later.',
    retryAfter: '1 minute'
  }
});

/**
 *  MAGIC: Deploy AI models
 * POST /api/v1/model-deployment/deploy
 */
router.post('/deploy', deploymentLimiter, authenticate, async (req, res) => {
  try {
    logger.info(' Starting model deployment request', { 
      userId: req.user?.id,
      userEmail: req.user?.email
    });

    const deploymentResult = await modelDeploymentService.deployModels();

    res.status(200).json({
      success: true,
      message: 'Model deployment initiated',
      data: {
        deploymentStatus: deploymentResult,
        timestamp: new Date().toISOString()
      },
      meta: {
        requestId: req.headers['x-request-id'],
        deploymentTime: deploymentResult.deployment.readyTime 
          ? deploymentResult.deployment.readyTime.getTime() - deploymentResult.deployment.startTime.getTime()
          : null
      }
    });

  } catch (error) {
    logger.error('Model deployment failed', { 
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Model deployment failed',
      error: error instanceof Error ? error.message : 'Unknown deployment error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Get deployment status
 * GET /api/v1/model-deployment/status
 */
router.get('/status', statusLimiter, async (req, res) => {
  try {
    const status = modelDeploymentService.getDeploymentStatus();
    const metrics = modelDeploymentService.getDeploymentMetrics();

    res.status(200).json({
      success: true,
      message: 'Deployment status retrieved',
      data: {
        status,
        metrics,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get deployment status', { error });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve deployment status',
      error: error instanceof Error ? error.message : 'Status retrieval error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Test all AI services
 * GET /api/v1/model-deployment/test-services
 */
router.get('/test-services', deploymentLimiter, authenticate, async (req, res) => {
  try {
    logger.info(' Running AI services test', { 
      userId: req.user?.id
    });

    const testResults = await modelDeploymentService.testAllServices();

    const overallHealth = Object.values(testResults).every(result => result.status);

    res.status(200).json({
      success: true,
      message: 'AI services test completed',
      data: {
        testResults,
        overallHealth,
        summary: {
          total: Object.keys(testResults).length,
          healthy: Object.values(testResults).filter(result => result.status).length,
          failed: Object.values(testResults).filter(result => !result.status).length
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('AI services test failed', { 
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'AI services test failed',
      error: error instanceof Error ? error.message : 'Test execution error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Get model information
 * GET /api/v1/model-deployment/models
 */
router.get('/models', statusLimiter, async (req, res) => {
  try {
    const modelInfo = modelDeploymentService.getModelInformation();

    res.status(200).json({
      success: true,
      message: 'Model information retrieved',
      data: {
        modelInfo,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get model information', { error });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve model information',
      error: error instanceof Error ? error.message : 'Model info retrieval error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Restart deployment
 * POST /api/v1/model-deployment/restart
 */
router.post('/restart', deploymentLimiter, authenticate, async (req, res) => {
  try {
    logger.info(' Restarting model deployment', { 
      userId: req.user?.id,
      userEmail: req.user?.email
    });

    const restartResult = await modelDeploymentService.restartDeployment();

    res.status(200).json({
      success: true,
      message: 'Model deployment restarted',
      data: {
        deploymentStatus: restartResult,
        timestamp: new Date().toISOString()
      },
      meta: {
        requestId: req.headers['x-request-id'],
        restartTime: Date.now()
      }
    });

  } catch (error) {
    logger.error('Model deployment restart failed', { 
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Model deployment restart failed',
      error: error instanceof Error ? error.message : 'Restart failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Get deployment metrics
 * GET /api/v1/model-deployment/metrics
 */
router.get('/metrics', statusLimiter, authenticate, async (req, res) => {
  try {
    const metrics = modelDeploymentService.getDeploymentMetrics();
    const status = modelDeploymentService.getDeploymentStatus();

    // Calculate additional metrics
    const uptimeHours = metrics.uptime / (1000 * 60 * 60);
    const deploymentSuccess = status.deployment.status === 'ready';

    res.status(200).json({
      success: true,
      message: 'Deployment metrics retrieved',
      data: {
        metrics: {
          ...metrics,
          uptimeHours: Math.round(uptimeHours * 100) / 100,
          deploymentSuccess,
          lastHealthCheck: status.huggingFace.lastHealthCheck,
          apiConnected: status.huggingFace.apiConnected
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get deployment metrics', { 
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve deployment metrics',
      error: error instanceof Error ? error.message : 'Metrics retrieval error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Health check endpoint
 * GET /api/v1/model-deployment/health
 */
router.get('/health', async (req, res) => {
  try {
    const status = modelDeploymentService.getDeploymentStatus();
    const metrics = modelDeploymentService.getDeploymentMetrics();

    const healthStatus = {
      healthy: status.deployment.status === 'ready' || status.deployment.status === 'partial',
      status: status.deployment.status,
      services: {
        huggingFace: status.huggingFace.apiConnected,
        aiMatching: status.aiServices.aiMatching,
        cvAnalysis: status.aiServices.cvAnalysis,
        semanticMatching: status.aiServices.semanticMatching
      },
      uptime: metrics.uptime,
      errors: status.deployment.errors.length,
      modelsLoaded: status.huggingFace.modelsLoaded.length
    };

    const httpStatus = healthStatus.healthy ? 200 : 503;

    res.status(httpStatus).json({
      success: healthStatus.healthy,
      message: healthStatus.healthy ? 'All systems operational' : 'Some systems degraded',
      data: {
        health: healthStatus,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Health check failed', { error });

    res.status(503).json({
      success: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Health check error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Cleanup deployment (Admin only)
 * POST /api/v1/model-deployment/cleanup
 */
router.post('/cleanup', deploymentLimiter, authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required for cleanup operations',
        timestamp: new Date().toISOString()
      });
    }

    logger.info(' Cleaning up model deployment', { 
      userId: req.user?.id,
      userEmail: req.user?.email
    });

    modelDeploymentService.cleanup();

    res.status(200).json({
      success: true,
      message: 'Model deployment cleanup completed',
      data: {
        cleanupTime: new Date().toISOString()
      },
      meta: {
        requestId: req.headers['x-request-id']
      }
    });

  } catch (error) {
    logger.error('Model deployment cleanup failed', { 
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Model deployment cleanup failed',
      error: error instanceof Error ? error.message : 'Cleanup failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Get detailed deployment report (Admin only)
 * GET /api/v1/model-deployment/report
 */
router.get('/report', statusLimiter, authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required for deployment reports',
        timestamp: new Date().toISOString()
      });
    }

    const status = modelDeploymentService.getDeploymentStatus();
    const metrics = modelDeploymentService.getDeploymentMetrics();
    const modelInfo = modelDeploymentService.getModelInformation();
    const testResults = await modelDeploymentService.testAllServices();

    const report = {
      summary: {
        deploymentStatus: status.deployment.status,
        totalServices: Object.keys(status.aiServices).length,
        healthyServices: Object.values(status.aiServices).filter(Boolean).length,
        modelsLoaded: status.huggingFace.modelsLoaded.length,
        uptime: metrics.uptime,
        errors: status.deployment.errors
      },
      services: {
        huggingFace: {
          deployed: status.huggingFace.deployed,
          apiConnected: status.huggingFace.apiConnected,
          modelsLoaded: status.huggingFace.modelsLoaded,
          warmUpComplete: status.huggingFace.warmUpComplete,
          lastHealthCheck: status.huggingFace.lastHealthCheck
        },
        aiServices: status.aiServices
      },
      models: modelInfo.huggingFace,
      testResults,
      metrics: {
        ...metrics,
        uptimeHours: Math.round(metrics.uptime / (1000 * 60 * 60) * 100) / 100
      },
      system: modelInfo.deployment
    };

    res.status(200).json({
      success: true,
      message: 'Deployment report generated',
      data: {
        report,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to generate deployment report', { 
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to generate deployment report',
      error: error instanceof Error ? error.message : 'Report generation error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Force model warm-up (Admin only)
 * POST /api/v1/model-deployment/warm-up
 */
router.post('/warm-up', deploymentLimiter, authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required for model warm-up',
        timestamp: new Date().toISOString()
      });
    }

    logger.info(' Manual model warm-up requested', { 
      userId: req.user?.id,
      userEmail: req.user?.email
    });

    // Get HuggingFace service and warm up models
    const hfService = new (await import('../services/huggingface.service.js')).HuggingFaceService();
    await hfService.warmUpModels();

    res.status(200).json({
      success: true,
      message: 'Model warm-up completed',
      data: {
        warmUpTime: new Date().toISOString(),
        models: hfService.getAvailableModels()
      },
      meta: {
        requestId: req.headers['x-request-id']
      }
    });

  } catch (error) {
    logger.error('Model warm-up failed', { 
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Model warm-up failed',
      error: error instanceof Error ? error.message : 'Warm-up failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Quick health check
 * GET /api/v1/model-deployment/quick-health
 */
router.get('/quick-health', async (req, res) => {
  try {
    const status = modelDeploymentService.getDeploymentStatus();
    
    const isHealthy = status.deployment.status === 'ready' || status.deployment.status === 'partial';
    const httpStatus = isHealthy ? 200 : 503;

    res.status(httpStatus).json({
      success: isHealthy,
      message: isHealthy ? 'Systems operational' : 'Systems degraded',
      data: {
        healthy: isHealthy,
        status: status.deployment.status,
        servicesCount: Object.values(status.aiServices).filter(Boolean).length,
        huggingFaceConnected: status.huggingFace.apiConnected,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Quick health check failed', { error });

    res.status(503).json({
      success: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Health check error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 *  MAGIC: Get deployment statistics (Admin only)
 * GET /api/v1/model-deployment/stats
 */
router.get('/stats', statusLimiter, authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required for deployment statistics',
        timestamp: new Date().toISOString()
      });
    }

    const metrics = modelDeploymentService.getDeploymentMetrics();
    const status = modelDeploymentService.getDeploymentStatus();
    const modelInfo = modelDeploymentService.getModelInformation();

    const stats = {
      deployment: {
        status: status.deployment.status,
        uptime: {
          milliseconds: metrics.uptime,
          hours: Math.round(metrics.uptime / (1000 * 60 * 60) * 100) / 100,
          days: Math.round(metrics.uptime / (1000 * 60 * 60 * 24) * 100) / 100
        },
        startTime: status.deployment.startTime,
        readyTime: status.deployment.readyTime,
        errors: status.deployment.errors
      },
      services: {
        huggingFace: {
          connected: status.huggingFace.apiConnected,
          modelsLoaded: status.huggingFace.modelsLoaded.length,
          warmUpComplete: status.huggingFace.warmUpComplete,
          lastHealthCheck: status.huggingFace.lastHealthCheck
        },
        aiServices: {
          total: Object.keys(status.aiServices).length,
          ready: Object.values(status.aiServices).filter(Boolean).length,
          details: status.aiServices
        }
      },
      system: {
        environment: modelInfo.deployment.environment,
        nodeVersion: modelInfo.deployment.nodeVersion,
        memory: {
          used: Math.round(modelInfo.deployment.memoryUsage.used / 1024 / 1024 * 100) / 100, // MB
          heap: Math.round(modelInfo.deployment.memoryUsage.heapUsed / 1024 / 1024 * 100) / 100 // MB
        }
      }
    };

    res.status(200).json({
      success: true,
      message: 'Deployment statistics retrieved',
      data: {
        stats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get deployment statistics', { 
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve deployment statistics',
      error: error instanceof Error ? error.message : 'Statistics retrieval error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
