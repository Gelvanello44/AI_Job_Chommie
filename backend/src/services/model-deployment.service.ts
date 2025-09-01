import logger from '../config/logger.js';
import { HuggingFaceService } from './huggingface.service.js';
import AiMatchingService from './ai-matching.service.js';
import CvAnalysisService from './cv-analysis.service.js';
import { SemanticMatchingService } from './semantic-matching.service.js';

interface ModelDeploymentStatus {
  huggingFace: {
    deployed: boolean;
    modelsLoaded: string[];
    apiConnected: boolean;
    warmUpComplete: boolean;
    lastHealthCheck: Date | null;
  };
  aiServices: {
    aiMatching: boolean;
    cvAnalysis: boolean;
    semanticMatching: boolean;
  };
  deployment: {
    status: 'initializing' | 'ready' | 'partial' | 'failed';
    startTime: Date;
    readyTime: Date | null;
    errors: string[];
  };
}

export class ModelDeploymentService {
  private hfService: HuggingFaceService;
  private aiMatchingService: AiMatchingService;
  private cvAnalysisService: CvAnalysisService;
  private semanticMatchingService: SemanticMatchingService;
  private deploymentStatus: ModelDeploymentStatus;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.hfService = HuggingFaceService.getInstance();
    this.aiMatchingService = new AiMatchingService();
    this.cvAnalysisService = new CvAnalysisService();
    this.semanticMatchingService = new SemanticMatchingService();
    
    this.deploymentStatus = {
      huggingFace: {
        deployed: false,
        modelsLoaded: [],
        apiConnected: false,
        warmUpComplete: false,
        lastHealthCheck: null
      },
      aiServices: {
        aiMatching: false,
        cvAnalysis: false,
        semanticMatching: false
      },
      deployment: {
        status: 'initializing',
        startTime: new Date(),
        readyTime: null,
        errors: []
      }
    };
  }

  /**
   *  MAGIC: Initialize and deploy all AI models
   */
  async deployModels(): Promise<ModelDeploymentStatus> {
    try {
      logger.info(' Starting AI model deployment...');

      this.deploymentStatus.deployment.status = 'initializing';
      this.deploymentStatus.deployment.errors = [];

      // Step 1: Check HuggingFace API connection
      await this.checkHuggingFaceConnection();

      // Step 2: Warm up HuggingFace models
      await this.warmUpHuggingFaceModels();

      // Step 3: Initialize AI services
      await this.initializeAIServices();

      // Step 4: Verify all systems
      await this.verifyDeployment();

      // Step 5: Start health monitoring
      this.startHealthMonitoring();

      this.deploymentStatus.deployment.status = 'ready';
      this.deploymentStatus.deployment.readyTime = new Date();

      logger.info(' AI model deployment completed successfully');
      return this.deploymentStatus;

    } catch (error) {
      logger.error(' AI model deployment failed', { error });
      this.deploymentStatus.deployment.status = 'failed';
      this.deploymentStatus.deployment.errors.push(
        error instanceof Error ? error.message : 'Unknown deployment error'
      );
      
      // Even if deployment fails partially, try to get services working
      await this.attemptPartialDeployment();
      
      return this.deploymentStatus;
    }
  }

  /**
   *  MAGIC: Check HuggingFace API connection and authentication
   */
  private async checkHuggingFaceConnection(): Promise<void> {
    try {
      logger.info(' Checking HuggingFace API connection...');

      const isHealthy = await this.hfService.checkHealth();
      
      if (isHealthy) {
        this.deploymentStatus.huggingFace.apiConnected = true;
        this.deploymentStatus.huggingFace.lastHealthCheck = new Date();
        logger.info(' HuggingFace API connection successful');
      } else {
        logger.warn(' HuggingFace API connection failed, will use fallback responses');
        this.deploymentStatus.huggingFace.apiConnected = false;
        this.deploymentStatus.deployment.errors.push('HuggingFace API connection failed');
      }

      // Get available models configuration
      const models = this.hfService.getAvailableModels();
      logger.info(' HuggingFace models configured', { models });

    } catch (error) {
      logger.error('Failed to check HuggingFace connection', { error });
      this.deploymentStatus.deployment.errors.push('HuggingFace connection check failed');
    }
  }

  /**
   *  MAGIC: Warm up HuggingFace models for better performance
   */
  private async warmUpHuggingFaceModels(): Promise<void> {
    try {
      logger.info(' Warming up HuggingFace models...');

      if (!this.deploymentStatus.huggingFace.apiConnected) {
        logger.info('Skipping model warm-up - API not connected');
        return;
      }

      await this.hfService.warmUpModels();
      
      this.deploymentStatus.huggingFace.warmUpComplete = true;
      this.deploymentStatus.huggingFace.modelsLoaded = [
        process.env.HF_TEXT_MODEL || 'distilgpt2',
        process.env.HF_CLASSIFICATION_MODEL || 'cardiffnlp/twitter-roberta-base-sentiment-latest',
        process.env.HF_RESUME_ANALYSIS_MODEL || 'sentence-transformers/all-MiniLM-L6-v2'
      ];

      logger.info(' HuggingFace models warmed up successfully');

    } catch (error) {
      logger.error('Failed to warm up models', { error });
      this.deploymentStatus.deployment.errors.push('Model warm-up failed');
    }
  }

  /**
   *  MAGIC: Initialize AI services
   */
  private async initializeAIServices(): Promise<void> {
    try {
      logger.info(' Initializing AI services...');

      // Initialize AI Matching Service
      try {
        const aiMatchingHealth = await this.aiMatchingService.checkHealth();
        this.deploymentStatus.aiServices.aiMatching = aiMatchingHealth;
        logger.info(` AI Matching Service: ${aiMatchingHealth ? 'Ready' : 'Fallback mode'}`);
      } catch (error) {
        logger.warn('AI Matching Service initialization failed', { error });
        this.deploymentStatus.aiServices.aiMatching = false;
      }

      // Initialize CV Analysis Service
      try {
        const cvAnalysisHealth = await this.cvAnalysisService.checkHealth();
        this.deploymentStatus.aiServices.cvAnalysis = cvAnalysisHealth;
        logger.info(` CV Analysis Service: ${cvAnalysisHealth ? 'Ready' : 'Fallback mode'}`);
      } catch (error) {
        logger.warn('CV Analysis Service initialization failed', { error });
        this.deploymentStatus.aiServices.cvAnalysis = false;
      }

      // Initialize Semantic Matching Service
      try {
        const semanticHealth = await this.semanticMatchingService.checkHealth();
        this.deploymentStatus.aiServices.semanticMatching = semanticHealth;
        logger.info(` Semantic Matching Service: ${semanticHealth ? 'Ready' : 'Fallback mode'}`);
      } catch (error) {
        logger.warn('Semantic Matching Service initialization failed', { error });
        this.deploymentStatus.aiServices.semanticMatching = false;
      }

      logger.info(' AI services initialization completed');

    } catch (error) {
      logger.error('Failed to initialize AI services', { error });
      this.deploymentStatus.deployment.errors.push('AI services initialization failed');
    }
  }

  /**
   *  MAGIC: Verify complete deployment
   */
  private async verifyDeployment(): Promise<void> {
    try {
      logger.info(' Verifying AI deployment...');

      const verificationResults = {
        huggingFaceHealth: await this.hfService.checkHealth(),
        aiServicesCount: Object.values(this.deploymentStatus.aiServices).filter(Boolean).length,
        modelsLoaded: this.deploymentStatus.huggingFace.modelsLoaded.length,
        errorsCount: this.deploymentStatus.deployment.errors.length
      };

      logger.info(' Deployment verification results', { verificationResults });

      // Determine if deployment is fully ready
      if (verificationResults.huggingFaceHealth && verificationResults.aiServicesCount >= 2) {
        this.deploymentStatus.huggingFace.deployed = true;
        logger.info(' Full AI deployment verified');
      } else if (verificationResults.aiServicesCount >= 1) {
        this.deploymentStatus.deployment.status = 'partial';
        logger.warn(' Partial AI deployment - some services may use fallback responses');
      } else {
        throw new Error('Critical AI services failed to initialize');
      }

    } catch (error) {
      logger.error('Deployment verification failed', { error });
      this.deploymentStatus.deployment.errors.push('Deployment verification failed');
      throw error;
    }
  }

  /**
   *  MAGIC: Attempt partial deployment as fallback
   */
  private async attemptPartialDeployment(): Promise<void> {
    try {
      logger.info(' Attempting partial deployment...');

      // Try to get at least basic services working
      const partialServices = [];

      // Test each service individually
      try {
        const hfHealth = await this.hfService.checkHealth();
        if (hfHealth) partialServices.push('HuggingFace');
      } catch (error) {
        logger.warn('HuggingFace service not available for partial deployment');
      }

      if (partialServices.length > 0) {
        this.deploymentStatus.deployment.status = 'partial';
        logger.info(` Partial deployment successful with: ${partialServices.join(', ')}`);
      } else {
        this.deploymentStatus.deployment.status = 'failed';
        logger.error(' Complete deployment failure - all services will use mock responses');
      }

    } catch (error) {
      logger.error('Partial deployment attempt failed', { error });
      this.deploymentStatus.deployment.status = 'failed';
    }
  }

  /**
   *  MAGIC: Start continuous health monitoring
   */
  private startHealthMonitoring(): void {
    // Check health every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.hfService.checkHealth();
        this.deploymentStatus.huggingFace.lastHealthCheck = new Date();
        
        if (!isHealthy && this.deploymentStatus.huggingFace.apiConnected) {
          logger.warn(' HuggingFace service became unhealthy');
          this.deploymentStatus.huggingFace.apiConnected = false;
        } else if (isHealthy && !this.deploymentStatus.huggingFace.apiConnected) {
          logger.info(' HuggingFace service recovered');
          this.deploymentStatus.huggingFace.apiConnected = true;
        }
      } catch (error) {
        logger.error('Health check failed', { error });
      }
    }, 5 * 60 * 1000); // 5 minutes

    logger.info(' Health monitoring started');
  }

  /**
   *  MAGIC: Get current deployment status
   */
  getDeploymentStatus(): ModelDeploymentStatus {
    return { ...this.deploymentStatus };
  }

  /**
   *  MAGIC: Restart model deployment
   */
  async restartDeployment(): Promise<ModelDeploymentStatus> {
    try {
      logger.info(' Restarting model deployment...');

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Clear caches
      this.hfService.clearCache();

      // Restart deployment
      return await this.deployModels();

    } catch (error) {
      logger.error('Failed to restart deployment', { error });
      throw error;
    }
  }

  /**
   *  MAGIC: Cleanup deployment resources
   */
  cleanup(): void {
    try {
      logger.info(' Cleaning up model deployment resources...');

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Clear caches
      this.hfService.clearCache();

      logger.info(' Model deployment cleanup completed');

    } catch (error) {
      logger.error('Failed to cleanup deployment', { error });
    }
  }

  /**
   *  MAGIC: Get deployment metrics
   */
  getDeploymentMetrics(): {
    uptime: number;
    healthChecks: number;
    errorsCount: number;
    servicesReady: number;
    modelsLoaded: number;
    deploymentDuration: number;
  } {
    const now = Date.now();
    const startTime = this.deploymentStatus.deployment.startTime.getTime();
    const readyTime = this.deploymentStatus.deployment.readyTime?.getTime();

    return {
      uptime: now - startTime,
      healthChecks: this.deploymentStatus.huggingFace.lastHealthCheck ? 1 : 0,
      errorsCount: this.deploymentStatus.deployment.errors.length,
      servicesReady: Object.values(this.deploymentStatus.aiServices).filter(Boolean).length,
      modelsLoaded: this.deploymentStatus.huggingFace.modelsLoaded.length,
      deploymentDuration: readyTime ? readyTime - startTime : now - startTime
    };
  }

  /**
   *  MAGIC: Test all AI services functionality
   */
  async testAllServices(): Promise<{
    huggingFace: { status: boolean; response?: any; error?: string };
    aiMatching: { status: boolean; response?: any; error?: string };
    cvAnalysis: { status: boolean; response?: any; error?: string };
    semanticMatching: { status: boolean; response?: any; error?: string };
  }> {
    const results = {
      huggingFace: { status: false },
      aiMatching: { status: false },
      cvAnalysis: { status: false },
      semanticMatching: { status: false }
    };

    // Test HuggingFace service
    try {
      const hfTest = await this.hfService.performSentimentAnalysis('This is a positive test message');
      results.huggingFace = { status: true, response: hfTest };
    } catch (error) {
      results.huggingFace = { 
        status: false, 
        error: error instanceof Error ? error.message : 'HF test failed' 
      };
    }

    // Test AI Matching service
    try {
      const aiMatchingTest = await this.aiMatchingService.checkHealth();
      results.aiMatching = { status: aiMatchingTest, response: { healthy: aiMatchingTest } };
    } catch (error) {
      results.aiMatching = { 
        status: false, 
        error: error instanceof Error ? error.message : 'AI Matching test failed' 
      };
    }

    // Test CV Analysis service
    try {
      const cvTest = await this.cvAnalysisService.checkHealth();
      results.cvAnalysis = { status: cvTest, response: { healthy: cvTest } };
    } catch (error) {
      results.cvAnalysis = { 
        status: false, 
        error: error instanceof Error ? error.message : 'CV Analysis test failed' 
      };
    }

    // Test Semantic Matching service
    try {
      const semanticTest = await this.semanticMatchingService.checkHealth();
      results.semanticMatching = { status: semanticTest, response: { healthy: semanticTest } };
    } catch (error) {
      results.semanticMatching = { 
        status: false, 
        error: error instanceof Error ? error.message : 'Semantic Matching test failed' 
      };
    }

    return results;
  }

  /**
   *  MAGIC: Get comprehensive model information
   */
  getModelInformation(): {
    huggingFace: {
      models: {
        textModel: string;
        classificationModel: string;
        embeddingModel: string;
      };
      configuration: {
        apiKeyConfigured: boolean;
        maxTokens: string;
        cacheExpiry: string;
        rateLimitPerMinute: number;
      };
    };
    deployment: {
      environment: string;
      nodeVersion: string;
      memoryUsage: NodeJS.MemoryUsage;
      cpuUsage: NodeJS.CpuUsage;
    };
  } {
    const models = this.hfService.getAvailableModels();
    const healthStats = this.hfService.getServiceHealth();

    return {
      huggingFace: {
        models: {
          textModel: models.textModel,
          classificationModel: models.classificationModel,
          embeddingModel: models.embeddingModel
        },
        configuration: {
          apiKeyConfigured: Boolean(process.env.HUGGINGFACE_API_KEY),
          maxTokens: process.env.HF_MAX_TOKENS || '1000',
          cacheExpiry: '1 hour',
          rateLimitPerMinute: 100
        }
      },
      deployment: {
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };
  }
}

// Singleton instance for global use
export const modelDeploymentService = new ModelDeploymentService();

export default ModelDeploymentService;
