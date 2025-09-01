import Bull from 'bull';
import { config } from '../../config/index.js';
import logger from '../../config/logger.js';

// Redis connection configuration
const redisConfig = {
  host: config.REDIS_HOST || 'localhost',
  port: config.REDIS_PORT || 6379,
  username: config.REDIS_USERNAME || 'default',
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB || 0,
};

// Queue options
const defaultQueueOptions = {
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// Create queues for different job types
export const queues = {
  applicationQueue: new Bull('job-applications', {
    redis: redisConfig,
    ...defaultQueueOptions,
  }),
  
  emailQueue: new Bull('email-notifications', {
    redis: redisConfig,
    ...defaultQueueOptions,
  }),
  
  resumeQueue: new Bull('resume-optimization', {
    redis: redisConfig,
    ...defaultQueueOptions,
  }),
  
  analyticsQueue: new Bull('analytics-aggregation', {
    redis: redisConfig,
    ...defaultQueueOptions,
  }),
  
  quotaQueue: new Bull('quota-reset', {
    redis: redisConfig,
    ...defaultQueueOptions,
  }),
  
  backupQueue: new Bull('data-backup', {
    redis: redisConfig,
    ...defaultQueueOptions,
  }),
};

// Queue event handlers
Object.entries(queues).forEach(([name, queue]) => {
  queue.on('completed', (job) => {
    logger.info(`Job completed in ${name}`, {
      jobId: job.id,
      data: job.data,
    });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Job failed in ${name}`, {
      jobId: job.id,
      error: err.message,
      stack: err.stack,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Job stalled in ${name}`, {
      jobId: job.id,
    });
  });

  queue.on('error', (error) => {
    logger.error(`Queue error in ${name}`, {
      error: error.message,
    });
  });
});

// Graceful shutdown
export const closeQueues = async () => {
  logger.info('Closing all queues...');
  await Promise.all(
    Object.values(queues).map((queue) => queue.close())
  );
  logger.info('All queues closed');
};

process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);

export default queues;
