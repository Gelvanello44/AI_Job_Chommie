import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';

const prisma = new PrismaClient();

export interface ScrapingTaskRequest {
  source: string;
  keywords?: string;
  location?: string;
  maxJobs?: number;
  userId?: string;
  priority?: 'low' | 'medium' | 'high';
  tier?: 'FREE' | 'PROFESSIONAL' | 'EXECUTIVE' | 'ENTERPRISE';
}

export interface ScrapingTaskResponse {
  taskId: string;
  status: string;
  message: string;
  estimatedCompletion?: number;
  orchestratorStatus?: {
    activeWorkers: number;
    queueSize: number;
    jobsScrapedToday: number;
  };
}

export interface ScrapingTaskStatus {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  jobsFound: number;
  startedAt: number;
  estimatedCompletion?: number;
  errors?: string[];
  source?: string;
  message?: string;
}

class ScrapingIntegrationService {
  private readonly scrapingServiceUrl: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor() {
    // Get scraping service URL from environment
    this.scrapingServiceUrl = config.SCRAPING_SERVICE_URL || 'http://localhost:8000';
  }

  /**
   * Start a new scraping task via the Python scraping service
   */
  async startScrapingTask(request: ScrapingTaskRequest): Promise<ScrapingTaskResponse> {
    try {
      logger.info('Starting scraping task', { 
        source: request.source, 
        keywords: request.keywords,
        userId: request.userId 
      });

      const response = await this.makeRequest('POST', '/api/v1/scrape/jobs', {
        params: {
          source: request.source,
          keywords: request.keywords,
          location: request.location || 'South Africa',
          max_jobs: request.maxJobs || 100
        }
      });

      const taskResponse: ScrapingTaskResponse = {
        taskId: response.data.task_id,
        status: response.data.status,
        message: response.data.message,
        estimatedCompletion: response.data.timestamp + 600, // 10 minutes estimate
        orchestratorStatus: response.data.orchestrator_status
      };

      // Log the task in our database for tracking
      await this.logScrapingTask(request, taskResponse);

      return taskResponse;

    } catch (error) {
      logger.error('Failed to start scraping task', { error, request });
      throw new AppError(500, 'Failed to start scraping task', 'SCRAPING_START_ERROR');
    }
  }

  /**
   * Get the status of a scraping task
   */
  async getTaskStatus(taskId: string): Promise<ScrapingTaskStatus> {
    try {
      const response = await this.makeRequest('GET', `/api/v1/scrape/status/${taskId}`);
      
      return {
        taskId: response.data.job_id,
        status: response.data.status,
        progress: response.data.progress,
        jobsFound: response.data.jobs_found,
        startedAt: response.data.started_at,
        estimatedCompletion: response.data.estimated_completion,
        errors: response.data.errors,
        source: response.data.source,
        message: response.data.message
      };

    } catch (error) {
      logger.error('Failed to get task status', { error, taskId });
      throw new AppError(500, 'Failed to get scraping task status', 'SCRAPING_STATUS_ERROR');
    }
  }

  /**
   * Get orchestrator status from the Python scraping service
   */
  async getOrchestratorStatus() {
    try {
      const response = await this.makeRequest('GET', '/api/v1/orchestrator/status');
      
      return {
        orchestratorRunning: response.data.orchestrator_running,
        activeWorkers: response.data.active_workers,
        queueSize: response.data.queue_size,
        workerPools: response.data.worker_pools,
        metrics: response.data.metrics,
        health: response.data.health,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      logger.error('Failed to get orchestrator status', { error });
      throw new AppError(500, 'Failed to get orchestrator status', 'ORCHESTRATOR_STATUS_ERROR');
    }
  }

  /**
   * Start the scraping orchestrator
   */
  async startOrchestrator() {
    try {
      const response = await this.makeRequest('POST', '/api/v1/orchestrator/start');
      
      logger.info('Orchestrator started', response.data);
      
      return {
        message: response.data.message,
        status: response.data.status,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      logger.error('Failed to start orchestrator', { error });
      throw new AppError(500, 'Failed to start orchestrator', 'ORCHESTRATOR_START_ERROR');
    }
  }

  /**
   * Stop the scraping orchestrator
   */
  async stopOrchestrator() {
    try {
      const response = await this.makeRequest('POST', '/api/v1/orchestrator/stop');
      
      logger.info('Orchestrator stopped', response.data);
      
      return {
        message: response.data.message,
        status: response.data.status,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      logger.error('Failed to stop orchestrator', { error });
      throw new AppError(500, 'Failed to stop orchestrator', 'ORCHESTRATOR_STOP_ERROR');
    }
  }

  /**
   * Check health of the Python scraping service
   */
  async checkScrapingServiceHealth() {
    try {
      const response = await this.makeRequest('GET', '/health');
      
      return {
        status: response.data.status,
        version: response.data.version,
        environment: response.data.environment,
        services: response.data.services,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      logger.warn('Scraping service health check failed', { error });
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Bulk scraping for admin/system use
   */
  async bulkScrapeJobs(sources: string[], keywords?: string[], userId?: string) {
    try {
      const tasks = [];

      for (const source of sources) {
        const task = await this.startScrapingTask({
          source,
          keywords: keywords?.join(','),
          location: 'South Africa',
          maxJobs: 200,
          userId,
          priority: 'medium',
          tier: 'ENTERPRISE'
        });
        tasks.push(task);

        // Small delay between task submissions
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      logger.info('Bulk scraping tasks started', { 
        taskCount: tasks.length, 
        sources, 
        userId 
      });

      return {
        tasksStarted: tasks.length,
        taskIds: tasks.map(t => t.taskId),
        sources,
        estimatedCompletion: Math.max(...tasks.map(t => t.estimatedCompletion || 0))
      };

    } catch (error) {
      logger.error('Bulk scraping failed', { error, sources, userId });
      throw new AppError(500, 'Failed to start bulk scraping', 'BULK_SCRAPING_ERROR');
    }
  }

  /**
   * Make HTTP request to Python scraping service with retry logic
   */
  private async makeRequest(method: 'GET' | 'POST', endpoint: string, data?: any) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const config: any = {
          method,
          url: `${this.scrapingServiceUrl}${endpoint}`,
          timeout: 30000, // 30 seconds
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'AI-Job-Chommie-Backend/1.0'
          },
          ...(data && { data })
        };

        if (method === 'GET' && data?.params) {
          config.params = data.params;
          delete config.data;
        }

        const response = await axios(config);
        return response;

      } catch (error: any) {
        lastError = error;
        
        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          const delay = this.retryDelay * attempt;
          logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${this.maxRetries})`, {
            endpoint,
            error: error.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    logger.error('Request failed after all retries', { 
      endpoint, 
      error: lastError,
      attempts: this.maxRetries 
    });
    
    throw new AppError(
      503, 
      'Scraping service unavailable', 
      'SCRAPING_SERVICE_UNAVAILABLE'
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx responses
    return !error.response || 
           error.code === 'ECONNREFUSED' || 
           error.code === 'ETIMEDOUT' || 
           (error.response?.status >= 500);
  }

  /**
   * Log scraping task to database for tracking
   */
  private async logScrapingTask(request: ScrapingTaskRequest, response: ScrapingTaskResponse) {
    try {
      // Create a scraping task record in the database
      // This would require a ScrapingTask model in Prisma
      logger.info('Scraping task logged', {
        taskId: response.taskId,
        source: request.source,
        userId: request.userId,
        status: response.status
      });

      // For now, just log the task
      // In a full implementation, you would save this to a ScrapingTask table
      
    } catch (error) {
      logger.error('Failed to log scraping task', { error, request, response });
      // Don't throw here - logging failure shouldn't fail the main operation
    }
  }

  /**
   * Get scraping task history for a user
   */
  async getUserScrapingHistory(userId: string, limit: number = 10) {
    try {
      // This would query the ScrapingTask table once it exists
      // For now, return empty array
      logger.info('Getting user scraping history', { userId, limit });
      
      return {
        tasks: [],
        totalTasks: 0,
        recentActivity: {
          lastTaskAt: null,
          tasksThisWeek: 0,
          totalJobsScraped: 0
        }
      };

    } catch (error) {
      logger.error('Failed to get user scraping history', { error, userId });
      throw new AppError(500, 'Failed to get scraping history', 'SCRAPING_HISTORY_ERROR');
    }
  }

  /**
   * Get system-wide scraping statistics
   */
  async getSystemScrapingStats() {
    try {
      const orchestratorStatus = await this.getOrchestratorStatus();
      const serviceHealth = await this.checkScrapingServiceHealth();
      
      // Get database stats about scraped jobs
      const [
        totalScrapedJobs,
        recentJobs,
        jobsBySource
      ] = await Promise.all([
        prisma.job.count({ where: { externalId: { not: null } } }),
        prisma.job.count({
          where: {
            externalId: { not: null },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        prisma.job.groupBy({
          by: ['sourceUrl'],
          where: { externalId: { not: null } },
          _count: true,
          take: 10
        })
      ]);

      return {
        orchestrator: orchestratorStatus,
        service: serviceHealth,
        database: {
          totalScrapedJobs,
          jobsScrapedToday: recentJobs,
          topSources: jobsBySource.map(source => ({
            domain: this.extractDomainFromUrl(source.sourceUrl || ''),
            count: source._count
          }))
        },
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error('Failed to get system scraping stats', { error });
      throw new AppError(500, 'Failed to get system scraping statistics', 'SYSTEM_STATS_ERROR');
    }
  }

  private extractDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }
}

export default new ScrapingIntegrationService();
