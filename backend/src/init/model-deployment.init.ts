import logger from '../config/logger.js';
import { modelDeploymentService } from '../services/model-deployment.service.js';

/**
 *  MAGIC: Initialize AI models on server startup
 */
export async function initializeModelsOnStartup(): Promise<void> {
  try {
    logger.info(' Starting automatic model deployment on server startup...');

    // Check if we should skip auto-deployment
    if (process.env.SKIP_MODEL_DEPLOYMENT === 'true') {
      logger.info('⏭ Skipping model deployment (SKIP_MODEL_DEPLOYMENT=true)');
      return;
    }

    // Deploy models with a timeout
    const deploymentPromise = modelDeploymentService.deployModels();
    
    // Set a reasonable timeout (2 minutes)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Model deployment timeout - taking longer than 2 minutes'));
      }, 2 * 60 * 1000);
    });

    // Race between deployment and timeout
    const deploymentResult = await Promise.race([deploymentPromise, timeoutPromise]) as any;

    if (deploymentResult.deployment.status === 'ready') {
      logger.info(' Model deployment completed successfully on startup', {
        status: deploymentResult.deployment.status,
        modelsLoaded: deploymentResult.huggingFace.modelsLoaded.length,
        servicesReady: Object.values(deploymentResult.aiServices).filter(Boolean).length
      });
    } else if (deploymentResult.deployment.status === 'partial') {
      logger.warn(' Partial model deployment on startup - some services using fallbacks', {
        status: deploymentResult.deployment.status,
        errors: deploymentResult.deployment.errors
      });
    } else {
      logger.error(' Model deployment failed on startup', {
        status: deploymentResult.deployment.status,
        errors: deploymentResult.deployment.errors
      });
    }

  } catch (error) {
    logger.error(' Critical error during model deployment initialization', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Don't throw - let the server start even if models fail to deploy
    // Services will fall back to mock responses
    logger.warn(' Server will continue with fallback AI responses');
  }
}

/**
 *  MAGIC: Setup graceful shutdown for model deployment
 */
export function setupModelDeploymentShutdown(): void {
  // Graceful shutdown handlers
  const shutdownHandler = (signal: string) => {
    logger.info(` Received ${signal}, cleaning up model deployment...`);
    
    try {
      modelDeploymentService.cleanup();
      logger.info(' Model deployment cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup model deployment', { error });
    }
    
    // Exit after cleanup
    process.exit(0);
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  
  // Handle uncaught exceptions and cleanup
  process.on('uncaughtException', (error) => {
    logger.error(' Uncaught exception, cleaning up...', { error });
    try {
      modelDeploymentService.cleanup();
    } catch (cleanupError) {
      logger.error('Failed to cleanup after uncaught exception', { cleanupError });
    }
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(' Unhandled rejection, cleaning up...', { 
      reason: reason instanceof Error ? reason.message : reason,
      promise 
    });
    try {
      modelDeploymentService.cleanup();
    } catch (cleanupError) {
      logger.error('Failed to cleanup after unhandled rejection', { cleanupError });
    }
    process.exit(1);
  });

  logger.info(' Model deployment shutdown handlers registered');
}

/**
 *  MAGIC: Check if models are ready
 */
export function areModelsReady(): boolean {
  try {
    const status = modelDeploymentService.getDeploymentStatus();
    return status.deployment.status === 'ready' || status.deployment.status === 'partial';
  } catch (error) {
    logger.error('Failed to check model readiness', { error });
    return false;
  }
}

/**
 *  MAGIC: Get model deployment summary for startup logs
 */
export function getStartupSummary(): {
  ready: boolean;
  status: string;
  models: number;
  services: number;
  errors: number;
} {
  try {
    const status = modelDeploymentService.getDeploymentStatus();
    const metrics = modelDeploymentService.getDeploymentMetrics();

    return {
      ready: status.deployment.status === 'ready',
      status: status.deployment.status,
      models: status.huggingFace.modelsLoaded.length,
      services: Object.values(status.aiServices).filter(Boolean).length,
      errors: status.deployment.errors.length
    };
  } catch (error) {
    logger.error('Failed to get startup summary', { error });
    return {
      ready: false,
      status: 'error',
      models: 0,
      services: 0,
      errors: 1
    };
  }
}

export default {
  initializeModelsOnStartup,
  setupModelDeploymentShutdown,
  areModelsReady,
  getStartupSummary
};
