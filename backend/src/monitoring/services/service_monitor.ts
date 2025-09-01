/**
 * service_monitor.ts - Third-Party Service Monitoring System
 * Comprehensive external dependency tracking with automated failover procedures
 */

import { EventEmitter } from 'events';
import axios, { AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import logger from '../../config/logger.js';

export interface ExternalService {
  id: string;
  name: string;
  description: string;
  category: 'api' | 'database' | 'storage' | 'payment' | 'email' | 'sms' | 'auth' | 'cdn' | 'other';
  provider: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  endpoints: ServiceEndpoint[];
  dependencies: string[]; // service IDs this service depends on
  dependents: string[]; // service IDs that depend on this service
  sla: {
    uptime: number; // percentage
    responseTime: number; // milliseconds
    errorRate: number; // percentage
  };
  configuration: {
    timeout: number;
    retries: number;
    retryDelay: number;
    circuitBreakerThreshold: number;
    circuitBreakerTimeout: number;
  };
  credentials: {
    type: 'api_key' | 'basic_auth' | 'oauth' | 'bearer_token' | 'custom';
    apiKey?: string;
    username?: string;
    password?: string;
    token?: string;
    customHeaders?: Record<string, string>;
  };
  monitoring: {
    enabled: boolean;
    interval: number; // seconds
    healthCheckPath?: string;
    customHealthCheck?: string;
  };
  failover: {
    enabled: boolean;
    strategy: 'circuit_breaker' | 'retry' | 'fallback' | 'load_balance';
    fallbackService?: string;
    alternativeServices: string[];
    gracefulDegradation: boolean;
  };
  lastCheck?: Date;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  metrics: ServiceMetrics;
}

export interface ServiceEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';
  isHealthCheck: boolean;
  headers?: Record<string, string>;
  body?: any;
  expectedStatus: number[];
  expectedResponse?: any;
  timeout: number;
  rateLimits?: {
    requests: number;
    window: number; // seconds
  };
}

export interface ServiceMetrics {
  uptime: number;
  avgResponseTime: number;
  errorRate: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastUptime: Date;
  lastDowntime?: Date;
  downtimeToday: number; // minutes
  downtimeThisMonth: number; // minutes
  responseTimeHistory: Array<{
    timestamp: Date;
    responseTime: number;
  }>;
  errorHistory: Array<{
    timestamp: Date;
    error: string;
    statusCode?: number;
  }>;
}

export interface ServiceHealthCheck {
  id: string;
  serviceId: string;
  timestamp: Date;
  status: 'success' | 'failure' | 'timeout' | 'error';
  responseTime: number;
  statusCode?: number;
  response?: any;
  error?: string;
  endpointId: string;
}

export interface ServiceAlert {
  id: string;
  serviceId: string;
  type: 'downtime' | 'performance' | 'error_rate' | 'sla_breach' | 'dependency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  escalationLevel: number;
  notificationsSent: string[];
}

export interface CircuitBreaker {
  serviceId: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  successCount: number;
  threshold: number;
  timeout: number;
}

export interface LoadBalancerConfig {
  serviceId: string;
  strategy: 'round_robin' | 'random' | 'least_connections' | 'weighted';
  endpoints: Array<{
    url: string;
    weight: number;
    active: boolean;
    connectionCount: number;
  }>;
  currentIndex: number;
}

export class ServiceMonitor extends EventEmitter {
  private prisma: PrismaClient;
  private services: Map<string, ExternalService> = new Map();
  private healthCheckHistory: Map<string, ServiceHealthCheck[]> = new Map();
  private alerts: Map<string, ServiceAlert> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private loadBalancers: Map<string, LoadBalancerConfig> = new Map();
  private monitoringJobs: Map<string, any> = new Map();
  private isRunning: boolean = false;

  // Configuration
  private readonly MAX_HEALTH_CHECK_HISTORY = 1000;
  private readonly MAX_RESPONSE_TIME_HISTORY = 500;
  private readonly ALERT_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.initializeServices();
  }

  /**
   * Start service monitoring
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    logger.info('Starting third-party service monitoring');

    // Initialize circuit breakers
    this.initializeCircuitBreakers();

    // Initialize load balancers
    this.initializeLoadBalancers();

    // Start monitoring jobs
    this.startMonitoringJobs();

    // Start alert cleanup
    this.startAlertCleanup();

    // Load historical data
    await this.loadHistoricalData();

    this.isRunning = true;
    this.emit('started');

    logger.info('Third-party service monitoring started');
  }

  /**
   * Stop service monitoring
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('Stopping third-party service monitoring');

    // Stop monitoring jobs
    for (const [serviceId, job] of this.monitoringJobs) {
      if (job.destroy) {
        job.destroy();
      }
      logger.debug(`Stopped monitoring job for service: ${serviceId}`);
    }

    this.isRunning = false;
    this.emit('stopped');

    logger.info('Third-party service monitoring stopped');
  }

  /**
   * Initialize external services configuration
   */
  private initializeServices(): void {
    const services: ExternalService[] = [
      {
        id: 'openai_api',
        name: 'OpenAI API',
        description: 'OpenAI GPT API for AI functionality',
        category: 'api',
        provider: 'OpenAI',
        criticality: 'critical',
        endpoints: [
          {
            id: 'openai_health',
            name: 'OpenAI Health Check',
            url: 'https://api.openai.com/v1/models',
            method: 'GET',
            isHealthCheck: true,
            expectedStatus: [200],
            timeout: 5000
          },
          {
            id: 'openai_completion',
            name: 'OpenAI Completion',
            url: 'https://api.openai.com/v1/chat/completions',
            method: 'POST',
            isHealthCheck: false,
            expectedStatus: [200],
            timeout: 30000,
            rateLimits: { requests: 60, window: 60 }
          }
        ],
        dependencies: [],
        dependents: ['job_matching_service'],
        sla: {
          uptime: 99.9,
          responseTime: 2000,
          errorRate: 0.1
        },
        configuration: {
          timeout: 30000,
          retries: 3,
          retryDelay: 1000,
          circuitBreakerThreshold: 5,
          circuitBreakerTimeout: 60000
        },
        credentials: {
          type: 'bearer_token',
          token: process.env.OPENAI_API_KEY
        },
        monitoring: {
          enabled: true,
          interval: 300, // 5 minutes
          healthCheckPath: '/v1/models'
        },
        failover: {
          enabled: true,
          strategy: 'circuit_breaker',
          alternativeServices: [],
          gracefulDegradation: true
        },
        status: 'unknown',
        metrics: this.initializeMetrics()
      },
      {
        id: 'serp_api',
        name: 'SERP API',
        description: 'Search Engine Results API for job scraping',
        category: 'api',
        provider: 'SerpAPI',
        criticality: 'high',
        endpoints: [
          {
            id: 'serp_health',
            name: 'SERP API Health',
            url: 'https://serpapi.com/search.json?engine=google&q=test&api_key=' + process.env.SERP_API_KEY,
            method: 'GET',
            isHealthCheck: true,
            expectedStatus: [200],
            timeout: 10000
          }
        ],
        dependencies: [],
        dependents: ['job_scraping_service'],
        sla: {
          uptime: 99.5,
          responseTime: 5000,
          errorRate: 0.5
        },
        configuration: {
          timeout: 10000,
          retries: 2,
          retryDelay: 2000,
          circuitBreakerThreshold: 3,
          circuitBreakerTimeout: 120000
        },
        credentials: {
          type: 'api_key',
          apiKey: process.env.SERP_API_KEY
        },
        monitoring: {
          enabled: true,
          interval: 600, // 10 minutes
        },
        failover: {
          enabled: true,
          strategy: 'retry',
          alternativeServices: [],
          gracefulDegradation: true
        },
        status: 'unknown',
        metrics: this.initializeMetrics()
      },
      {
        id: 'cloudinary',
        name: 'Cloudinary CDN',
        description: 'Image and media hosting service',
        category: 'cdn',
        provider: 'Cloudinary',
        criticality: 'medium',
        endpoints: [
          {
            id: 'cloudinary_health',
            name: 'Cloudinary Health',
            url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/image/fetch`,
            method: 'GET',
            isHealthCheck: true,
            expectedStatus: [200, 400], // 400 is acceptable for health check
            timeout: 5000
          }
        ],
        dependencies: [],
        dependents: ['profile_service', 'job_service'],
        sla: {
          uptime: 99.9,
          responseTime: 3000,
          errorRate: 0.2
        },
        configuration: {
          timeout: 10000,
          retries: 2,
          retryDelay: 1500,
          circuitBreakerThreshold: 4,
          circuitBreakerTimeout: 90000
        },
        credentials: {
          type: 'basic_auth',
          username: process.env.CLOUDINARY_API_KEY,
          password: process.env.CLOUDINARY_API_SECRET
        },
        monitoring: {
          enabled: true,
          interval: 300, // 5 minutes
        },
        failover: {
          enabled: true,
          strategy: 'fallback',
          alternativeServices: [],
          gracefulDegradation: true
        },
        status: 'unknown',
        metrics: this.initializeMetrics()
      },
      {
        id: 'paystack',
        name: 'Paystack Payment Gateway',
        description: 'Payment processing service',
        category: 'payment',
        provider: 'Paystack',
        criticality: 'critical',
        endpoints: [
          {
            id: 'paystack_health',
            name: 'Paystack Health',
            url: 'https://api.paystack.co/bank',
            method: 'GET',
            isHealthCheck: true,
            expectedStatus: [200],
            timeout: 8000
          }
        ],
        dependencies: [],
        dependents: ['payment_service'],
        sla: {
          uptime: 99.95,
          responseTime: 2000,
          errorRate: 0.05
        },
        configuration: {
          timeout: 15000,
          retries: 3,
          retryDelay: 2000,
          circuitBreakerThreshold: 3,
          circuitBreakerTimeout: 300000
        },
        credentials: {
          type: 'bearer_token',
          token: process.env.PAYSTACK_SECRET_KEY
        },
        monitoring: {
          enabled: true,
          interval: 180, // 3 minutes
        },
        failover: {
          enabled: true,
          strategy: 'circuit_breaker',
          alternativeServices: [],
          gracefulDegradation: false // Payment failures should not degrade
        },
        status: 'unknown',
        metrics: this.initializeMetrics()
      },
      {
        id: 'twilio',
        name: 'Twilio SMS Service',
        description: 'SMS and communication service',
        category: 'sms',
        provider: 'Twilio',
        criticality: 'medium',
        endpoints: [
          {
            id: 'twilio_health',
            name: 'Twilio Health',
            url: `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`,
            method: 'GET',
            isHealthCheck: true,
            expectedStatus: [200],
            timeout: 5000
          }
        ],
        dependencies: [],
        dependents: ['notification_service'],
        sla: {
          uptime: 99.5,
          responseTime: 3000,
          errorRate: 0.3
        },
        configuration: {
          timeout: 10000,
          retries: 2,
          retryDelay: 2000,
          circuitBreakerThreshold: 4,
          circuitBreakerTimeout: 120000
        },
        credentials: {
          type: 'basic_auth',
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN
        },
        monitoring: {
          enabled: true,
          interval: 450, // 7.5 minutes
        },
        failover: {
          enabled: true,
          strategy: 'retry',
          alternativeServices: [],
          gracefulDegradation: true
        },
        status: 'unknown',
        metrics: this.initializeMetrics()
      },
      {
        id: 'sendgrid',
        name: 'SendGrid Email Service',
        description: 'Email delivery service',
        category: 'email',
        provider: 'SendGrid',
        criticality: 'medium',
        endpoints: [
          {
            id: 'sendgrid_health',
            name: 'SendGrid Health',
            url: 'https://api.sendgrid.com/v3/user/profile',
            method: 'GET',
            isHealthCheck: true,
            expectedStatus: [200],
            timeout: 5000
          }
        ],
        dependencies: [],
        dependents: ['email_service'],
        sla: {
          uptime: 99.5,
          responseTime: 2000,
          errorRate: 0.2
        },
        configuration: {
          timeout: 8000,
          retries: 2,
          retryDelay: 1500,
          circuitBreakerThreshold: 4,
          circuitBreakerTimeout: 180000
        },
        credentials: {
          type: 'bearer_token',
          token: process.env.SENDGRID_API_KEY
        },
        monitoring: {
          enabled: true,
          interval: 600, // 10 minutes
        },
        failover: {
          enabled: true,
          strategy: 'retry',
          alternativeServices: [],
          gracefulDegradation: true
        },
        status: 'unknown',
        metrics: this.initializeMetrics()
      },
      {
        id: 'redis_cloud',
        name: 'Redis Cloud',
        description: 'Cloud Redis instance for caching',
        category: 'database',
        provider: 'Redis Labs',
        criticality: 'high',
        endpoints: [
          {
            id: 'redis_health',
            name: 'Redis Health',
            url: 'redis://custom-health-check', // Custom health check
            method: 'GET',
            isHealthCheck: true,
            expectedStatus: [200],
            timeout: 3000
          }
        ],
        dependencies: [],
        dependents: ['cache_service', 'session_service'],
        sla: {
          uptime: 99.9,
          responseTime: 100,
          errorRate: 0.1
        },
        configuration: {
          timeout: 5000,
          retries: 3,
          retryDelay: 1000,
          circuitBreakerThreshold: 5,
          circuitBreakerTimeout: 60000
        },
        credentials: {
          type: 'custom',
          customHeaders: {
            'Authorization': `Bearer ${process.env.REDIS_PASSWORD}`
          }
        },
        monitoring: {
          enabled: true,
          interval: 120, // 2 minutes
          customHealthCheck: 'redis_ping'
        },
        failover: {
          enabled: true,
          strategy: 'circuit_breaker',
          alternativeServices: [],
          gracefulDegradation: true
        },
        status: 'unknown',
        metrics: this.initializeMetrics()
      }
    ];

    services.forEach(service => {
      this.services.set(service.id, service);
    });

    logger.info(`Initialized ${services.length} external services`);
  }

  /**
   * Initialize service metrics
   */
  private initializeMetrics(): ServiceMetrics {
    return {
      uptime: 100,
      avgResponseTime: 0,
      errorRate: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastUptime: new Date(),
      downtimeToday: 0,
      downtimeThisMonth: 0,
      responseTimeHistory: [],
      errorHistory: []
    };
  }

  /**
   * Initialize circuit breakers
   */
  private initializeCircuitBreakers(): void {
    for (const service of this.services.values()) {
      this.circuitBreakers.set(service.id, {
        serviceId: service.id,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        threshold: service.configuration.circuitBreakerThreshold,
        timeout: service.configuration.circuitBreakerTimeout
      });
    }

    logger.debug(`Initialized ${this.circuitBreakers.size} circuit breakers`);
  }

  /**
   * Initialize load balancers
   */
  private initializeLoadBalancers(): void {
    for (const service of this.services.values()) {
      if (service.failover.strategy === 'load_balance' && service.failover.alternativeServices.length > 0) {
        const endpoints = service.endpoints.map(endpoint => ({
          url: endpoint.url,
          weight: 1,
          active: true,
          connectionCount: 0
        }));

        this.loadBalancers.set(service.id, {
          serviceId: service.id,
          strategy: 'round_robin',
          endpoints,
          currentIndex: 0
        });
      }
    }

    logger.debug(`Initialized ${this.loadBalancers.size} load balancers`);
  }

  /**
   * Start monitoring jobs for all services
   */
  private startMonitoringJobs(): void {
    for (const service of this.services.values()) {
      if (!service.monitoring.enabled) continue;

      const intervalMs = service.monitoring.interval * 1000;
      
      const job = setInterval(async () => {
        await this.performHealthCheck(service.id);
      }, intervalMs);

      this.monitoringJobs.set(service.id, job);

      // Perform initial health check
      setTimeout(() => {
        this.performHealthCheck(service.id);
      }, Math.random() * 10000); // Stagger initial checks

      logger.debug(`Started monitoring job for ${service.name} (interval: ${service.monitoring.interval}s)`);
    }

    logger.info(`Started ${this.monitoringJobs.size} monitoring jobs`);
  }

  /**
   * Start alert cleanup job
   */
  private startAlertCleanup(): void {
    setInterval(() => {
      this.cleanupOldAlerts();
    }, this.ALERT_CLEANUP_INTERVAL);
  }

  /**
   * Perform health check for a service
   */
  private async performHealthCheck(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) {
      logger.error(`Service not found for health check: ${serviceId}`);
      return;
    }

    const circuitBreaker = this.circuitBreakers.get(serviceId);
    if (circuitBreaker && circuitBreaker.state === 'open') {
      if (Date.now() < (circuitBreaker.nextAttemptTime?.getTime() || 0)) {
        logger.debug(`Circuit breaker open for ${service.name}, skipping health check`);
        return;
      } else {
        circuitBreaker.state = 'half_open';
        logger.info(`Circuit breaker transitioning to half-open for ${service.name}`);
      }
    }

    const healthCheckEndpoints = service.endpoints.filter(ep => ep.isHealthCheck);
    if (healthCheckEndpoints.length === 0) {
      logger.warn(`No health check endpoints defined for ${service.name}`);
      return;
    }

    for (const endpoint of healthCheckEndpoints) {
      try {
        const healthCheck = await this.executeHealthCheck(service, endpoint);
        this.recordHealthCheck(healthCheck);
        this.updateServiceMetrics(service, healthCheck);
        this.updateCircuitBreaker(service, healthCheck.status === 'success');

        // Update service status
        service.status = healthCheck.status === 'success' ? 'healthy' : 'error';
        service.lastCheck = new Date();

        this.emit('healthCheckCompleted', { service: service.id, healthCheck });

      } catch (error) {
        logger.error(`Health check failed for ${service.name}:${endpoint.name}`, { error });
        
        const failedHealthCheck: ServiceHealthCheck = {
          id: `hc_${Date.now()}_${serviceId}`,
          serviceId,
          timestamp: new Date(),
          status: 'error',
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          endpointId: endpoint.id
        };

        this.recordHealthCheck(failedHealthCheck);
        this.updateServiceMetrics(service, failedHealthCheck);
        this.updateCircuitBreaker(service, false);
        
        service.status = 'error';
        service.lastCheck = new Date();

        this.emit('healthCheckFailed', { service: service.id, error, healthCheck: failedHealthCheck });
      }
    }

    // Check SLA breaches
    this.checkSLABreach(service);
  }

  /**
   * Execute health check for a specific endpoint
   */
  private async executeHealthCheck(service: ExternalService, endpoint: ServiceEndpoint): Promise<ServiceHealthCheck> {
    const startTime = Date.now();
    let status: ServiceHealthCheck['status'] = 'success';
    let statusCode: number | undefined;
    let response: any;
    let error: string | undefined;

    try {
      if (service.monitoring.customHealthCheck) {
        // Custom health check logic
        const result = await this.performCustomHealthCheck(service.monitoring.customHealthCheck, service);
        return {
          id: `hc_${Date.now()}_${service.id}`,
          serviceId: service.id,
          timestamp: new Date(),
          status: result.success ? 'success' : 'failure',
          responseTime: Date.now() - startTime,
          response: result.data,
          error: result.error,
          endpointId: endpoint.id
        };
      }

      const config: any = {
        method: endpoint.method,
        url: endpoint.url,
        timeout: endpoint.timeout || service.configuration.timeout,
        headers: {
          ...endpoint.headers,
          ...this.getAuthHeaders(service)
        }
      };

      if (endpoint.body) {
        config.data = endpoint.body;
      }

      const axiosResponse = await axios(config);
      statusCode = axiosResponse.status;
      response = axiosResponse.data;

      if (!endpoint.expectedStatus.includes(statusCode)) {
        status = 'failure';
        error = `Unexpected status code: ${statusCode}`;
      }

      // Validate expected response if specified
      if (endpoint.expectedResponse && status === 'success') {
        if (!this.validateResponse(response, endpoint.expectedResponse)) {
          status = 'failure';
          error = 'Response validation failed';
        }
      }

    } catch (err) {
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError;
        statusCode = axiosError.response?.status;
        
        if (axiosError.code === 'ECONNABORTED') {
          status = 'timeout';
          error = 'Request timeout';
        } else if (axiosError.code === 'ECONNREFUSED') {
          status = 'failure';
          error = 'Connection refused';
        } else {
          status = 'error';
          error = axiosError.message;
        }
      } else {
        status = 'error';
        error = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    return {
      id: `hc_${Date.now()}_${service.id}`,
      serviceId: service.id,
      timestamp: new Date(),
      status,
      responseTime: Date.now() - startTime,
      statusCode,
      response,
      error,
      endpointId: endpoint.id
    };
  }

  /**
   * Perform custom health check
   */
  private async performCustomHealthCheck(checkType: string, service: ExternalService): Promise<{success: boolean; data?: any; error?: string}> {
    switch (checkType) {
      case 'redis_ping':
        try {
          const Redis = require('ioredis');
          const redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            username: process.env.REDIS_USERNAME || 'default',
            password: process.env.REDIS_PASSWORD,
            connectTimeout: 3000,
            lazyConnect: true
          });
          
          const result = await redis.ping();
          await redis.quit();
          
          return {
            success: result === 'PONG',
            data: { ping: result }
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Redis ping failed'
          };
        }

      default:
        return {
          success: false,
          error: `Unknown custom health check: ${checkType}`
        };
    }
  }

  /**
   * Get authentication headers for service
   */
  private getAuthHeaders(service: ExternalService): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (service.credentials.type) {
      case 'api_key':
        if (service.credentials.apiKey) {
          headers['X-API-Key'] = service.credentials.apiKey;
        }
        break;

      case 'bearer_token':
        if (service.credentials.token) {
          headers['Authorization'] = `Bearer ${service.credentials.token}`;
        }
        break;

      case 'basic_auth':
        if (service.credentials.username && service.credentials.password) {
          const encoded = Buffer.from(`${service.credentials.username}:${service.credentials.password}`).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        }
        break;

      case 'custom':
        if (service.credentials.customHeaders) {
          Object.assign(headers, service.credentials.customHeaders);
        }
        break;
    }

    return headers;
  }

  /**
   * Validate response against expected response
   */
  private validateResponse(actual: any, expected: any): boolean {
    if (typeof expected === 'object' && expected !== null) {
      if (typeof actual !== 'object' || actual === null) return false;
      
      for (const key in expected) {
        if (!(key in actual)) return false;
        if (!this.validateResponse(actual[key], expected[key])) return false;
      }
      
      return true;
    }
    
    return actual === expected;
  }

  /**
   * Record health check result
   */
  private recordHealthCheck(healthCheck: ServiceHealthCheck): void {
    if (!this.healthCheckHistory.has(healthCheck.serviceId)) {
      this.healthCheckHistory.set(healthCheck.serviceId, []);
    }

    const history = this.healthCheckHistory.get(healthCheck.serviceId)!;
    history.push(healthCheck);

    // Keep history within limits
    if (history.length > this.MAX_HEALTH_CHECK_HISTORY) {
      history.splice(0, history.length - this.MAX_HEALTH_CHECK_HISTORY);
    }

    // Store in database (async)
    this.storeHealthCheck(healthCheck).catch(error => {
      logger.error('Failed to store health check', { error, healthCheck });
    });
  }

  /**
   * Update service metrics based on health check
   */
  private updateServiceMetrics(service: ExternalService, healthCheck: ServiceHealthCheck): void {
    const metrics = service.metrics;
    metrics.totalRequests++;

    if (healthCheck.status === 'success') {
      metrics.successfulRequests++;
      metrics.lastUptime = new Date();
    } else {
      metrics.failedRequests++;
      
      if (!metrics.lastDowntime) {
        metrics.lastDowntime = new Date();
      }
      
      // Update downtime counters
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      if (metrics.lastDowntime >= today) {
        metrics.downtimeToday += service.monitoring.interval / 60; // convert to minutes
      }
      if (metrics.lastDowntime >= thisMonth) {
        metrics.downtimeThisMonth += service.monitoring.interval / 60;
      }
    }

    // Calculate uptime percentage
    metrics.uptime = metrics.totalRequests > 0 ? 
      (metrics.successfulRequests / metrics.totalRequests) * 100 : 100;

    // Calculate error rate
    metrics.errorRate = metrics.totalRequests > 0 ? 
      (metrics.failedRequests / metrics.totalRequests) * 100 : 0;

    // Update response time history
    if (healthCheck.responseTime > 0) {
      metrics.responseTimeHistory.push({
        timestamp: healthCheck.timestamp,
        responseTime: healthCheck.responseTime
      });

      // Keep history within limits
      if (metrics.responseTimeHistory.length > this.MAX_RESPONSE_TIME_HISTORY) {
        metrics.responseTimeHistory.shift();
      }

      // Calculate average response time
      metrics.avgResponseTime = metrics.responseTimeHistory.reduce((sum, entry) => sum + entry.responseTime, 0) / 
        metrics.responseTimeHistory.length;
    }

    // Update error history
    if (healthCheck.status !== 'success') {
      metrics.errorHistory.push({
        timestamp: healthCheck.timestamp,
        error: healthCheck.error || 'Unknown error',
        statusCode: healthCheck.statusCode
      });

      // Keep error history within limits
      if (metrics.errorHistory.length > this.MAX_RESPONSE_TIME_HISTORY) {
        metrics.errorHistory.shift();
      }
    }
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(service: ExternalService, success: boolean): void {
    const circuitBreaker = this.circuitBreakers.get(service.id);
    if (!circuitBreaker) return;

    if (success) {
      circuitBreaker.successCount++;
      
      if (circuitBreaker.state === 'half_open') {
        if (circuitBreaker.successCount >= 2) { // Require 2 successes to close
          circuitBreaker.state = 'closed';
          circuitBreaker.failureCount = 0;
          circuitBreaker.successCount = 0;
          logger.info(`Circuit breaker closed for ${service.name}`);
          this.emit('circuitBreakerClosed', { service: service.id });
        }
      } else if (circuitBreaker.state === 'closed') {
        circuitBreaker.failureCount = Math.max(0, circuitBreaker.failureCount - 1);
      }
    } else {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = new Date();
      circuitBreaker.successCount = 0;

      if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
        if (circuitBreaker.state !== 'open') {
          circuitBreaker.state = 'open';
          circuitBreaker.nextAttemptTime = new Date(Date.now() + circuitBreaker.timeout);
          logger.warn(`Circuit breaker opened for ${service.name}`);
          this.emit('circuitBreakerOpened', { service: service.id, failureCount: circuitBreaker.failureCount });
          this.generateAlert(service, 'dependency', 'high', 'Circuit breaker opened due to repeated failures');
        }
      }
    }
  }

  /**
   * Check for SLA breaches
   */
  private checkSLABreach(service: ExternalService): void {
    const metrics = service.metrics;
    const sla = service.sla;

    // Check uptime SLA
    if (metrics.uptime < sla.uptime) {
      this.generateAlert(service, 'sla_breach', 'high', 
        `Uptime SLA breach: ${metrics.uptime.toFixed(2)}% (target: ${sla.uptime}%)`);
    }

    // Check response time SLA
    if (metrics.avgResponseTime > sla.responseTime) {
      this.generateAlert(service, 'performance', 'medium',
        `Response time SLA breach: ${metrics.avgResponseTime.toFixed(0)}ms (target: ${sla.responseTime}ms)`);
    }

    // Check error rate SLA
    if (metrics.errorRate > sla.errorRate) {
      this.generateAlert(service, 'error_rate', 'medium',
        `Error rate SLA breach: ${metrics.errorRate.toFixed(2)}% (target: ${sla.errorRate}%)`);
    }
  }

  /**
   * Generate service alert
   */
  private generateAlert(
    service: ExternalService, 
    type: ServiceAlert['type'], 
    severity: ServiceAlert['severity'], 
    message: string,
    details: Record<string, any> = {}
  ): void {
    const alertId = `alert_${Date.now()}_${service.id}`;
    
    const alert: ServiceAlert = {
      id: alertId,
      serviceId: service.id,
      type,
      severity,
      message,
      details: {
        serviceName: service.name,
        provider: service.provider,
        criticality: service.criticality,
        ...details
      },
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      escalationLevel: 0,
      notificationsSent: []
    };

    this.alerts.set(alertId, alert);

    logger.warn(`Service alert generated: ${service.name}`, {
      alertId,
      type,
      severity,
      message
    });

    this.emit('alertGenerated', alert);

    // Auto-escalate critical alerts
    if (severity === 'critical') {
      setTimeout(() => {
        this.escalateAlert(alertId);
      }, 300000); // 5 minutes
    }
  }

  /**
   * Escalate alert
   */
  private escalateAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.acknowledged || alert.resolved) return;

    alert.escalationLevel++;
    
    logger.warn(`Alert escalated to level ${alert.escalationLevel}`, {
      alertId,
      serviceId: alert.serviceId
    });

    this.emit('alertEscalated', alert);

    // Continue escalating if not resolved
    if (alert.escalationLevel < 3) {
      setTimeout(() => {
        this.escalateAlert(alertId);
      }, 600000); // 10 minutes
    }
  }

  /**
   * Clean up old alerts
   */
  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    const toDelete: string[] = [];

    for (const [alertId, alert] of this.alerts) {
      if (alert.resolved && alert.timestamp.getTime() < cutoffTime) {
        toDelete.push(alertId);
      }
    }

    toDelete.forEach(alertId => {
      this.alerts.delete(alertId);
    });

    if (toDelete.length > 0) {
      logger.debug(`Cleaned up ${toDelete.length} old alerts`);
    }
  }

  /**
   * Load historical data from database
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      // In a real implementation, this would load from database
      logger.info('Historical service data loaded');
    } catch (error) {
      logger.error('Failed to load historical service data', { error });
    }
  }

  /**
   * Store health check in database
   */
  private async storeHealthCheck(healthCheck: ServiceHealthCheck): Promise<void> {
    try {
      // In a real implementation, this would store in database
      // await this.prisma.serviceHealthCheck.create({ data: healthCheck });
    } catch (error) {
      logger.error('Failed to store health check', { error });
    }
  }

  /**
   * Get service status
   */
  public getServiceStatus(serviceId: string): ExternalService | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Get all services status
   */
  public getAllServicesStatus(): ExternalService[] {
    return Array.from(this.services.values());
  }

  /**
   * Get service health history
   */
  public getServiceHealthHistory(serviceId: string, limit: number = 100): ServiceHealthCheck[] {
    const history = this.healthCheckHistory.get(serviceId) || [];
    return history.slice(-limit);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): ServiceAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity] || 
               b.timestamp.getTime() - a.timestamp.getTime();
      });
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Resolve alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get service dependencies
   */
  public getServiceDependencies(serviceId: string): {
    dependencies: ExternalService[];
    dependents: ExternalService[];
  } {
    const service = this.services.get(serviceId);
    if (!service) {
      return { dependencies: [], dependents: [] };
    }

    const dependencies = service.dependencies
      .map(id => this.services.get(id))
      .filter((s): s is ExternalService => s !== undefined);

    const dependents = service.dependents
      .map(id => this.services.get(id))
      .filter((s): s is ExternalService => s !== undefined);

    return { dependencies, dependents };
  }

  /**
   * Get service metrics summary
   */
  public getServiceMetricsSummary(): {
    totalServices: number;
    healthyServices: number;
    warningServices: number;
    errorServices: number;
    criticalServices: number;
    totalAlerts: number;
    activeAlerts: number;
    circuitBreakersOpen: number;
  } {
    const services = Array.from(this.services.values());
    const alerts = Array.from(this.alerts.values());
    const circuitBreakers = Array.from(this.circuitBreakers.values());

    return {
      totalServices: services.length,
      healthyServices: services.filter(s => s.status === 'healthy').length,
      warningServices: services.filter(s => s.status === 'warning').length,
      errorServices: services.filter(s => s.status === 'error').length,
      criticalServices: services.filter(s => s.criticality === 'critical' && s.status === 'error').length,
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => !a.resolved).length,
      circuitBreakersOpen: circuitBreakers.filter(cb => cb.state === 'open').length
    };
  }

  /**
   * Force health check for service
   */
  public async forceHealthCheck(serviceId: string): Promise<ServiceHealthCheck[]> {
    await this.performHealthCheck(serviceId);
    return this.getServiceHealthHistory(serviceId, 1);
  }

  /**
   * Update service configuration
   */
  public updateServiceConfiguration(serviceId: string, updates: Partial<ExternalService>): boolean {
    const service = this.services.get(serviceId);
    if (!service) return false;

    // Update service configuration
    Object.assign(service, updates);

    // Restart monitoring if interval changed
    if (updates.monitoring?.interval) {
      const job = this.monitoringJobs.get(serviceId);
      if (job) {
        clearInterval(job);
        const newJob = setInterval(() => {
          this.performHealthCheck(serviceId);
        }, service.monitoring.interval * 1000);
        
        this.monitoringJobs.set(serviceId, newJob);
        logger.info(`Updated monitoring interval for ${service.name} to ${service.monitoring.interval}s`);
      }
    }

    this.emit('serviceConfigurationUpdated', { serviceId, updates });
    return true;
  }
}

// Export singleton instance
export const serviceMonitor = new ServiceMonitor();
export default ServiceMonitor;
