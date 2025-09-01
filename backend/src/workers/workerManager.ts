/**
 * Worker Manager
 * Central orchestrator for all background jobs and workers
 */

import cluster from 'cluster';
import os from 'os';
import logger from '../config/logger.js';
import { queues, closeQueues } from './queues/queue.config.js';
import './jobs/applicationAutomation.worker.js';
import './jobs/emailNotification.worker.js';
import './jobs/allWorkers.js';
import { scheduleAutomatedApplications } from './jobs/applicationAutomation.worker.js';
import { scheduleDailyDigest } from './jobs/emailNotification.worker.js';

const NUM_WORKERS = process.env.WORKER_PROCESSES ? parseInt(process.env.WORKER_PROCESSES) : os.cpus().length;

class WorkerManager {
  private workers: Map<number, cluster.Worker> = new Map();
  private isShuttingDown = false;

  /**
   * Start the worker manager
   */
  async start() {
    if (cluster.isPrimary) {
      logger.info(`Worker Manager starting with ${NUM_WORKERS} workers`);
      
      // Fork workers
      for (let i = 0; i < NUM_WORKERS; i++) {
        this.forkWorker();
      }

      // Handle worker events
      cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died`, { code, signal });
        this.workers.delete(worker.process.pid!);
        
        if (!this.isShuttingDown) {
          logger.info('Starting a new worker');
          this.forkWorker();
        }
      });

      // Schedule recurring jobs (only in primary)
      await this.scheduleJobs();

      // Monitor queue health
      this.monitorQueues();

      // Handle shutdown signals
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());

    } else {
      // Worker process
      logger.info(`Worker ${process.pid} started`);
      
      // Workers will automatically process jobs from queues
      // The queue processors are registered in the imported worker files
    }
  }

  /**
   * Fork a new worker
   */
  private forkWorker() {
    const worker = cluster.fork();
    this.workers.set(worker.process.pid!, worker);
    logger.info(`Forked worker ${worker.process.pid}`);
  }

  /**
   * Schedule recurring jobs
   */
  private async scheduleJobs() {
    try {
      // Schedule automated job applications for premium users
      await scheduleAutomatedApplications();
      
      // Schedule daily email digests
      await scheduleDailyDigest();

      // Add cleanup jobs
      await this.scheduleCleanupJobs();

      logger.info('Recurring jobs scheduled successfully');
    } catch (error) {
      logger.error('Failed to schedule recurring jobs', { error });
    }
  }

  /**
   * Schedule cleanup jobs
   */
  private async scheduleCleanupJobs() {
    // Clean completed jobs older than 7 days
    queues.applicationQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
    queues.emailQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
    queues.resumeQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
    
    // Clean failed jobs older than 30 days
    queues.applicationQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed');
    queues.emailQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed');
    queues.resumeQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed');

    logger.info('Cleanup jobs scheduled');
  }

  /**
   * Monitor queue health
   */
  private monitorQueues() {
    setInterval(async () => {
      try {
        const stats = await this.getQueueStats();
        
        // Log queue statistics
        logger.info('Queue health check', stats);

        // Alert if queues are backing up
        Object.entries(stats).forEach(([queueName, queueStats]) => {
          if (queueStats.waiting > 1000) {
            logger.warn(`Queue ${queueName} has high waiting count`, queueStats);
          }
          
          if (queueStats.failed > 100) {
            logger.error(`Queue ${queueName} has high failure rate`, queueStats);
          }
        });
      } catch (error) {
        logger.error('Queue health check failed', { error });
      }
    }, 60000); // Check every minute
  }

  /**
   * Get queue statistics
   */
  private async getQueueStats() {
    const stats: Record<string, any> = {};

    for (const [name, queue] of Object.entries(queues)) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      stats[name] = {
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    }

    return stats;
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown...');

    try {
      // Stop accepting new jobs
      await this.pauseQueues();

      // Wait for active jobs to complete (max 30 seconds)
      await this.waitForActiveJobs(30000);

      // Close all queues
      await closeQueues();

      // Kill all workers
      for (const worker of this.workers.values()) {
        worker.kill();
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }

  /**
   * Pause all queues
   */
  private async pauseQueues() {
    await Promise.all(
      Object.values(queues).map(queue => queue.pause())
    );
    logger.info('All queues paused');
  }

  /**
   * Wait for active jobs to complete
   */
  private async waitForActiveJobs(timeout: number) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const activeJobs = await this.getActiveJobCount();
      
      if (activeJobs === 0) {
        logger.info('All active jobs completed');
        return;
      }

      logger.info(`Waiting for ${activeJobs} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.warn('Timeout waiting for active jobs');
  }

  /**
   * Get total active job count
   */
  private async getActiveJobCount() {
    let total = 0;
    
    for (const queue of Object.values(queues)) {
      total += await queue.getActiveCount();
    }

    return total;
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isPrimary: cluster.isPrimary,
      workerId: cluster.worker?.id,
      workerPid: process.pid,
      activeWorkers: this.workers.size,
      totalWorkers: NUM_WORKERS,
      isShuttingDown: this.isShuttingDown,
    };
  }
}

// Create and export worker manager instance
const workerManager = new WorkerManager();

// Start worker manager if this is the main module
if (require.main === module) {
  workerManager.start().catch(error => {
    logger.error('Failed to start worker manager', { error });
    process.exit(1);
  });
}

export default workerManager;
