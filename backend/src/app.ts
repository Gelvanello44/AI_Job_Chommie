// Import everything except express first
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

// Import configurations
import { config, corsOptions, rateLimitConfig } from './config/index.js';
import { httpLogStream, requestLogger, errorLogger } from './config/logger.js';
import logger from './config/logger.js';
import { Sentry } from './config/sentry.js';

// Import express types for TypeScript (but not express itself yet)
import type { Application } from 'express';

// Import middleware
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { generateCSRFToken, validateCSRFToken } from './middleware/csrf';
import { sanitizeInput, detectThreats, setCSPHeaders, basicXSSProtection } from './middleware/xss';
import { securityService } from './services/security/SecurityService';

// Import routes
import authRoutes from './routes/auth.routes.js';
import quotaRoutes from './routes/quota.routes.js';
import skillsAssessmentRoutes from './routes/skillsAssessment.routes.js';
import cvRoutes from './routes/cv.routes.js';
import fileRoutes from './routes/fileRoutes.js';
import jobSearchRoutes from './routes/jobSearchRoutes.js';
import userProfileRoutes from './routes/userProfileRoutes.js';
import jobApplicationRoutes from './routes/jobApplicationRoutes.js';
import companyProfileRoutes from './routes/companyProfileRoutes.js';
import jobManagementRoutes from './routes/jobManagementRoutes.js';
import enhancedFileRoutes from './routes/enhancedFileRoutes.js';
import scrapingIntegrationRoutes from './routes/scrapingIntegration.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import applicationRoutes from './routes/application.routes.js';
import jobRoutes from './routes/job.routes.js';
import multilingualRoutes from './routes/multilingual.routes.js';
import matchExplanationRoutes from './routes/matchExplanation.routes.js';
import modelMonitoringRoutes from './routes/modelMonitoring.routes.js';
import { enhancedMatchingRoutes } from './routes/enhanced-matching.routes.js';
import { featureExtractionRoutes } from './routes/feature-extraction.routes.js';
import { inferencePipelineRoutes } from './routes/inference-pipeline.routes.js';
import magicRoutes from './routes/magic.routes.js';
import { scoringSystemRoutes } from './routes/scoring-system.routes.js';
import { similarityEngineRoutes } from './routes/similarity-engine.routes.js';
import { skillsTaxonomyRoutes } from './routes/skills-taxonomy.routes.js';
import newsletterRoutes from './routes/newsletter.routes.js';
import reminderRoutes from './routes/reminder.routes.js';
import badgeRoutes from './routes/badges.routes.js';
import contentCalendarRoutes from './routes/content-calendar.routes.js';
import mockInterviewRoutes from './routes/mock-interview.routes.js';
import hiddenMarketRoutes from './routes/hidden-market.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import coverLetterRoutes from './routes/cover-letter.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import integrationsRoutes from './routes/integrations.routes.js';
import securityRoutes from './routes/security.routes.js';
import careerDNARoutes from './routes/career-dna.routes.js';
import aiServicesRoutes from './routes/ai-services.routes.js';
import careerTrajectoryRoutes from './routes/career-trajectory.routes.js';
import modelDeploymentRoutes from './routes/model-deployment.routes.js';

// Import file upload utilities
import { setupStaticFileServing } from './middleware/upload.js';

// Import health check route
import { checkDatabaseHealth } from './config/database.js';
import { checkRedisHealth } from './config/redis.js';

/**
 * Create Express application
 */
export function createApp(): Application {
  console.log(' Initializing Express app...');
  // Import express AFTER Sentry has been initialized
  const express = require('express');
  const app = express();
  console.log(' Express instance created');

  // Trust proxy for accurate IP addresses
  app.set('trust proxy', 1);

  // Sentry middleware is now setup automatically with expressIntegration()
  // and setupExpressErrorHandler() after routes

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
  }));

  // CSRF and XSS Protection
  app.use(setCSPHeaders);
  app.use(sanitizeInput);
  app.use(detectThreats);
  app.use(securityService.auditSecurity());

  // CORS configuration
  app.use(cors(corsOptions));

  // Rate limiting
  if (config.NODE_ENV === 'production') {
    app.use(rateLimit(rateLimitConfig));
  }

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(config.SESSION_SECRET));

  // Compression middleware
  app.use(compression());

  // Logging middleware
  if (config.NODE_ENV !== 'test') {
    app.use(morgan('combined', { stream: httpLogStream }));
    app.use(requestLogger);
  }

  // API Documentation
  if (config.NODE_ENV !== 'production') {
    const swaggerDocument = {
      openapi: '3.0.0',
      info: {
        title: 'AI Job Chommie API',
        version: '1.0.0',
        description: 'AI-powered job search platform API for South Africa',
        contact: {
          name: 'API Support',
          email: 'support@aijobchommie.co.za',
        },
      },
      servers: [
        {
          url: config.BACKEND_URL,
          description: 'Development server',
        },
      ],
      paths: {},
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    };

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    try {
      const dbHealth = await checkDatabaseHealth();
      const redisHealth = await checkRedisHealth();
      
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.NODE_ENV,
        services: {
          database: dbHealth ? 'healthy' : 'unhealthy',
          redis: redisHealth ? 'healthy' : 'unhealthy',
        },
      };

      const statusCode = dbHealth && redisHealth ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  });

  // Security endpoints
  app.get('/api/v1/security/csrf-token', generateCSRFToken, (req: any, res) => {
    res.json({
      success: true,
      data: {
        token: req.csrfToken,
        expiresIn: 3600
      }
    });
  });

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      message: 'AI Job Chommie API',
      version: '1.0.0',
      environment: config.NODE_ENV,
      documentation: config.NODE_ENV !== 'production' ? '/api-docs' : undefined,
      health: '/health',
    });
  });

  // Sentry debug endpoint (development only)
  if (config.NODE_ENV !== 'production') {
    app.get('/sentry-debug', (_req, res) => {
      try {
        throw new Error('Test error from Node.js Backend - Sentry Debug Endpoint');
      } catch (error) {
        res.status(500).json({
          message: 'Test error thrown and captured by Sentry',
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  // Setup static file serving for uploads
  setupStaticFileServing(app, express);

  // API Routes
  app.use(`/api/${config.API_VERSION}/auth`, authRoutes);
  app.use(`/api/${config.API_VERSION}/quota`, quotaRoutes);
  app.use(`/api/${config.API_VERSION}/assessments`, skillsAssessmentRoutes);
  app.use(`/api/${config.API_VERSION}/cv`, cvRoutes);
  app.use(`/api/${config.API_VERSION}/resume`, resumeRoutes);
  app.use(`/api/${config.API_VERSION}/cover-letter`, coverLetterRoutes);
  app.use(`/api/${config.API_VERSION}/interview`, interviewRoutes);
  app.use(`/api/${config.API_VERSION}/analytics`, analyticsRoutes);
  app.use(`/api/${config.API_VERSION}/notifications`, notificationsRoutes);
  app.use(`/api/${config.API_VERSION}/integrations`, integrationsRoutes);
  app.use(`/api/${config.API_VERSION}/security`, securityRoutes);
  app.use(`/api/${config.API_VERSION}/career-dna`, careerDNARoutes);
  app.use(`/api/${config.API_VERSION}/ai-services`, aiServicesRoutes);
  app.use(`/api/${config.API_VERSION}/career-trajectory`, careerTrajectoryRoutes);
  app.use(`/api/${config.API_VERSION}/model-deployment`, modelDeploymentRoutes);
  app.use(`/api/${config.API_VERSION}/files`, fileRoutes);
  app.use(`/api/${config.API_VERSION}/file-management`, enhancedFileRoutes);
  app.use(`/api/${config.API_VERSION}/jobs`, jobSearchRoutes);
  app.use(`/api/${config.API_VERSION}/job`, jobRoutes);
  app.use(`/api/${config.API_VERSION}/profile`, userProfileRoutes);
  app.use(`/api/${config.API_VERSION}/application`, applicationRoutes);
  app.use(`/api/${config.API_VERSION}/applications`, jobApplicationRoutes);
  app.use(`/api/${config.API_VERSION}/companies`, companyProfileRoutes);
  app.use(`/api/${config.API_VERSION}/job-management`, jobManagementRoutes);
  app.use(`/api/${config.API_VERSION}/scraping`, scrapingIntegrationRoutes);
  app.use(`/api/${config.API_VERSION}/payment`, paymentRoutes);
  app.use(`/api/${config.API_VERSION}/webhooks`, webhookRoutes);
  app.use(`/api/${config.API_VERSION}/multilingual`, multilingualRoutes);
  app.use(`/api/${config.API_VERSION}/newsletter`, newsletterRoutes);
  app.use(`/api/${config.API_VERSION}/reminders`, reminderRoutes);
  app.use(`/api/${config.API_VERSION}/badges`, badgeRoutes);
  app.use(`/api/${config.API_VERSION}/content-calendar`, contentCalendarRoutes);
  app.use(`/api/${config.API_VERSION}/mock-interview`, mockInterviewRoutes);
  app.use(`/api/${config.API_VERSION}/hidden-market`, hiddenMarketRoutes);
  
  // AI & ML Routes
  app.use(`/api/${config.API_VERSION}/match-explanations`, matchExplanationRoutes);
  app.use(`/api/${config.API_VERSION}/monitoring`, modelMonitoringRoutes);
  app.use(`/api/${config.API_VERSION}/enhanced-matching`, enhancedMatchingRoutes);
  app.use(`/api/${config.API_VERSION}/feature-extraction`, featureExtractionRoutes);
  app.use(`/api/${config.API_VERSION}/inference-pipeline`, inferencePipelineRoutes);
  app.use(`/api/${config.API_VERSION}/scoring-system`, scoringSystemRoutes);
  app.use(`/api/${config.API_VERSION}/similarity-engine`, similarityEngineRoutes);
  app.use(`/api/${config.API_VERSION}/skills-taxonomy`, skillsTaxonomyRoutes);
  app.use(`/api/${config.API_VERSION}/magic`, magicRoutes);

  // 404 handler
  app.use(notFound);

  // Sentry error handler (must be before other error handlers)
  Sentry.setupExpressErrorHandler(app);

  // Error handling middleware
  app.use(errorLogger);
  app.use(errorHandler);

  return app;
}

export default createApp;
