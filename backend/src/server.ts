import { Server } from 'http';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { redis, bullRedis } from './config/redis.js';
import logger from './config/logger.js';
import createApp from './app.js';
import { initializeModelsOnStartup, setupModelDeploymentShutdown, getStartupSummary } from './init/model-deployment.init.js';

/**
 * Start the server
 */
async function startServer(): Promise<Server> {
  try {
    console.log(' Starting server initialization...');
    
    // Connect to database
    await connectDatabase();
    console.log(' Database connected successfully');

    // Create Express app
    console.log(' Creating Express app...');
    const app = createApp();
    console.log(' Express app created successfully');

    // Start server
    const server = app.listen(config.PORT, async () => {
      logger.info(` Server running on port ${config.PORT}`, {
        environment: config.NODE_ENV,
        port: config.PORT,
        version: '1.0.0',
      });
      
      if (config.NODE_ENV !== 'production') {
        logger.info(` API Documentation: http://localhost:${config.PORT}/api-docs`);
        logger.info(` Health Check: http://localhost:${config.PORT}/health`);
      }

      // Initialize AI models after server starts
      logger.info(' Starting AI model initialization...');
      await initializeModelsOnStartup();
      
      // Log deployment summary
      const summary = getStartupSummary();
      logger.info(' AI Model Deployment Summary', {
        ready: summary.ready,
        status: summary.status,
        modelsLoaded: summary.models,
        servicesReady: summary.services,
        errors: summary.errors
      });

      if (summary.ready) {
        logger.info(' All AI services are ready for production use');
      } else {
        logger.warn(' Some AI services using fallback responses - check /api/v1/model-deployment/status for details');
      }
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.PORT} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });

    // Setup model deployment shutdown handlers
    setupModelDeploymentShutdown();

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });

      try {
        // Close database connections
        await disconnectDatabase();

        // Close Redis connections
        redis.disconnect();
        bullRedis.disconnect();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

export { startServer };
export default startServer;
