/**
 * expense_monitor.ts - Automated expense tracking across all project components
 * Monitors service usage, calculates costs, and provides real-time expense visibility
 */

import axios from 'axios';
import * as cron from 'node-cron';
import ExpenseTracker, { ServiceConfig, ExpenseRecord } from './ExpenseTracker.js';
import logger from '../../config/logger.js';
import { config } from '../../config/index.js';

interface APIUsageData {
  serviceId: string;
  requests: number;
  tokens?: number;
  dataTransfer?: number;
  storageUsed?: number;
  period: 'hourly' | 'daily' | 'monthly';
  timestamp: Date;
}

interface CostCalculation {
  serviceId: string;
  baseCost: number;
  usageCost: number;
  totalCost: number;
  currency: string;
  billingPeriod: string;
  breakdown: Record<string, number>;
}

class ExpenseMonitor {
  private expenseTracker: ExpenseTracker;
  private isRunning: boolean = false;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  
  // Service API configurations for usage monitoring
  private serviceAPIs = new Map<string, {
    endpoint: string;
    authHeader?: string;
    usageParser: (data: any) => APIUsageData;
  }>();

  constructor() {
    this.expenseTracker = new ExpenseTracker();
    this.setupServiceAPIs();
  }

  /**
   * Initialize expense monitoring
   */
  public async initialize(): Promise<void> {
    if (this.isRunning) return;

    logger.info('Initializing expense monitoring system');

    // Start expense tracker
    await this.expenseTracker.start();

    // Setup event listeners
    this.setupEventListeners();

    // Schedule monitoring jobs
    this.scheduleMonitoringJobs();

    this.isRunning = true;
    logger.info('Expense monitoring system initialized successfully');
  }

  /**
   * Shutdown expense monitoring
   */
  public async shutdown(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('Shutting down expense monitoring system');

    // Stop all scheduled jobs
    this.scheduledJobs.forEach((job, name) => {
      job.destroy();
      logger.info(`Stopped scheduled job: ${name}`);
    });
    this.scheduledJobs.clear();

    // Stop expense tracker
    await this.expenseTracker.stop();

    this.isRunning = false;
    logger.info('Expense monitoring system shutdown complete');
  }

  /**
   * Setup service API configurations for usage monitoring
   */
  private setupServiceAPIs(): void {
    // OpenAI API Usage Monitoring
    if (config.OPENAI_API_KEY) {
      this.serviceAPIs.set('openai', {
        endpoint: 'https://api.openai.com/v1/usage',
        authHeader: `Bearer ${config.OPENAI_API_KEY}`,
        usageParser: (data) => ({
          serviceId: 'openai',
          requests: data.total_requests || 0,
          tokens: data.total_tokens || 0,
          period: 'daily',
          timestamp: new Date()
        })
      });
    }

    // HuggingFace API Usage (simulated - no direct usage API)
    this.serviceAPIs.set('huggingface', {
      endpoint: '', // No direct usage API
      usageParser: (data) => ({
        serviceId: 'huggingface',
        requests: 0, // Track via application logs
        period: 'daily',
        timestamp: new Date()
      })
    });

    // SerpAPI Usage Monitoring
    if (config.SERPAPI_API_KEY) {
      this.serviceAPIs.set('serpapi', {
        endpoint: `https://serpapi.com/account?api_key=${config.SERPAPI_API_KEY}`,
        usageParser: (data) => ({
          serviceId: 'serpapi',
          requests: data.this_month_usage || 0,
          period: 'monthly',
          timestamp: new Date()
        })
      });
    }

    // Cloudinary Usage Monitoring
    if (config.CLOUDINARY_API_KEY) {
      this.serviceAPIs.set('cloudinary', {
        endpoint: `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/usage`,
        authHeader: `Basic ${Buffer.from(`${config.CLOUDINARY_API_KEY}:${config.CLOUDINARY_API_SECRET}`).toString('base64')}`,
        usageParser: (data) => ({
          serviceId: 'cloudinary',
          requests: data.requests || 0,
          storageUsed: data.storage || 0,
          dataTransfer: data.bandwidth || 0,
          period: 'monthly',
          timestamp: new Date()
        })
      });
    }

    // Paystack Transaction Monitoring (via webhooks)
    this.serviceAPIs.set('paystack', {
      endpoint: '', // Webhook-based
      usageParser: (data) => ({
        serviceId: 'paystack',
        requests: data.transaction_count || 0,
        period: 'daily',
        timestamp: new Date()
      })
    });

    // Twilio Usage Monitoring
    if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN) {
      this.serviceAPIs.set('twilio', {
        endpoint: `https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Usage/Records.json`,
        authHeader: `Basic ${Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        usageParser: (data) => ({
          serviceId: 'twilio',
          requests: data.usage_records?.length || 0,
          period: 'daily',
          timestamp: new Date()
        })
      });
    }
  }

  /**
   * Setup event listeners for expense tracking
   */
  private setupEventListeners(): void {
    this.expenseTracker.on('budgetAlert', (alert) => {
      logger.warn('Budget alert triggered', {
        serviceId: alert.serviceId,
        type: alert.type,
        message: alert.message,
        currentAmount: alert.currentAmount,
        threshold: alert.threshold
      });

      // Send notifications (email, Slack, etc.)
      this.sendBudgetAlertNotification(alert);
    });

    this.expenseTracker.on('expenseRecorded', (expense) => {
      logger.info('Expense recorded', {
        serviceId: expense.serviceId,
        amount: expense.amount,
        currency: expense.currency,
        description: expense.description
      });
    });

    this.expenseTracker.on('started', () => {
      logger.info('ExpenseTracker started successfully');
    });

    this.expenseTracker.on('stopped', () => {
      logger.info('ExpenseTracker stopped');
    });
  }

  /**
   * Schedule automated monitoring jobs
   */
  private scheduleMonitoringJobs(): void {
    // Hourly usage monitoring
    const hourlyJob = cron.schedule('0 * * * *', async () => {
      await this.performUsageMonitoring();
    }, { timezone: 'UTC' });
    
    this.scheduledJobs.set('hourly-usage', hourlyJob);

    // Daily expense calculation
    const dailyJob = cron.schedule('0 0 * * *', async () => {
      await this.calculateDailyExpenses();
    }, { timezone: 'UTC' });
    
    this.scheduledJobs.set('daily-expenses', dailyJob);

    // Weekly optimization analysis
    const weeklyJob = cron.schedule('0 9 * * 1', async () => {
      await this.performOptimizationAnalysis();
    }, { timezone: 'UTC' });
    
    this.scheduledJobs.set('weekly-optimization', weeklyJob);

    // Monthly reporting
    const monthlyJob = cron.schedule('0 9 1 * *', async () => {
      await this.generateMonthlyReport();
    }, { timezone: 'UTC' });
    
    this.scheduledJobs.set('monthly-report', monthlyJob);

    // Start all jobs
    this.scheduledJobs.forEach((job, name) => {
      job.start();
      logger.info(`Started scheduled job: ${name}`);
    });
  }

  /**
   * Perform usage monitoring across all services
   */
  private async performUsageMonitoring(): Promise<void> {
    logger.info('Starting usage monitoring cycle');

    for (const [serviceId, apiConfig] of this.serviceAPIs) {
      try {
        if (apiConfig.endpoint) {
          const usageData = await this.fetchServiceUsage(serviceId, apiConfig);
          if (usageData) {
            await this.processUsageData(usageData);
          }
        } else {
          // For services without direct APIs, use application metrics
          await this.trackApplicationUsage(serviceId);
        }
      } catch (error) {
        logger.error(`Failed to monitor usage for ${serviceId}`, { error });
      }
    }

    logger.info('Usage monitoring cycle completed');
  }

  /**
   * Fetch service usage from external APIs
   */
  private async fetchServiceUsage(serviceId: string, apiConfig: any): Promise<APIUsageData | null> {
    try {
      const headers: any = {
        'Content-Type': 'application/json'
      };

      if (apiConfig.authHeader) {
        headers.Authorization = apiConfig.authHeader;
      }

      const response = await axios.get(apiConfig.endpoint, {
        headers,
        timeout: 10000
      });

      return apiConfig.usageParser(response.data);
    } catch (error) {
      logger.error(`Failed to fetch usage data for ${serviceId}`, { error });
      return null;
    }
  }

  /**
   * Track application usage for services without direct APIs
   */
  private async trackApplicationUsage(serviceId: string): Promise<void> {
    try {
      // This would integrate with application metrics
      // For now, we'll use Redis to track usage counters
      const redis = require('ioredis');
      const redisClient = new redis(config.REDIS_HOST, config.REDIS_PORT);

      const usageKey = `usage:${serviceId}:${new Date().toISOString().split('T')[0]}`;
      const usage = await redisClient.get(usageKey) || 0;

      if (usage > 0) {
        const usageData: APIUsageData = {
          serviceId,
          requests: parseInt(usage),
          period: 'daily',
          timestamp: new Date()
        };

        await this.processUsageData(usageData);
        
        // Reset daily counter
        await redisClient.del(usageKey);
      }

      await redisClient.quit();
    } catch (error) {
      logger.error(`Failed to track application usage for ${serviceId}`, { error });
    }
  }

  /**
   * Process usage data and calculate costs
   */
  private async processUsageData(usageData: APIUsageData): Promise<void> {
    const costCalculation = await this.calculateServiceCosts(usageData);
    
    if (costCalculation.totalCost > 0) {
      await this.expenseTracker.recordExpense({
        serviceId: costCalculation.serviceId,
        amount: costCalculation.totalCost,
        currency: costCalculation.currency,
        usage: usageData.requests,
        description: `Automated cost calculation - ${usageData.requests} requests`,
        category: this.getServiceCategory(costCalculation.serviceId),
        isProjected: false,
        metadata: {
          usageData,
          costBreakdown: costCalculation.breakdown,
          billingPeriod: costCalculation.billingPeriod
        }
      });
    }
  }

  /**
   * Calculate service costs based on usage data
   */
  private async calculateServiceCosts(usageData: APIUsageData): Promise<CostCalculation> {
    const serviceConfig = await this.getServiceConfig(usageData.serviceId);
    
    if (!serviceConfig) {
      throw new Error(`Service configuration not found: ${usageData.serviceId}`);
    }

    let usageCost = 0;
    const breakdown: Record<string, number> = {};

    // Calculate based on pricing model
    switch (serviceConfig.pricingModel) {
      case 'usage':
        const effectiveUsage = Math.max(0, usageData.requests - (serviceConfig.freeAllowance || 0));
        usageCost = effectiveUsage * (serviceConfig.costPerUnit || 0);
        breakdown.requests = usageCost;

        // Handle additional usage types
        if (usageData.tokens && serviceConfig.id === 'openai') {
          const tokenCost = usageData.tokens * 0.002; // $0.002 per 1K tokens
          usageCost += tokenCost;
          breakdown.tokens = tokenCost;
        }

        if (usageData.dataTransfer) {
          const transferCost = usageData.dataTransfer * 0.0001; // $0.0001 per MB
          usageCost += transferCost;
          breakdown.dataTransfer = transferCost;
        }
        break;

      case 'tier':
        // Tier-based pricing would need more complex logic
        usageCost = this.calculateTierBasedCost(serviceConfig, usageData);
        breakdown.tierCost = usageCost;
        break;

      case 'fixed':
        usageCost = 0; // Fixed costs are handled separately
        break;
    }

    return {
      serviceId: usageData.serviceId,
      baseCost: 0, // Fixed subscription costs
      usageCost,
      totalCost: usageCost,
      currency: serviceConfig.currency,
      billingPeriod: serviceConfig.billingCycle,
      breakdown
    };
  }

  /**
   * Calculate tier-based costs
   */
  private calculateTierBasedCost(serviceConfig: ServiceConfig, usageData: APIUsageData): number {
    // Example tier calculation for Cloudinary
    if (serviceConfig.id === 'cloudinary') {
      const freeAllowance = serviceConfig.freeAllowance || 0;
      if (usageData.requests <= freeAllowance) {
        return 0;
      }
      
      // Next tier pricing
      const excessUsage = usageData.requests - freeAllowance;
      return excessUsage * 0.001; // $0.001 per request above free tier
    }

    return 0;
  }

  /**
   * Calculate daily expenses for all services
   */
  private async calculateDailyExpenses(): Promise<void> {
    logger.info('Calculating daily expenses');

    const analytics = this.expenseTracker.getExpenseAnalytics(1);
    
    logger.info('Daily expense summary', {
      totalExpenses: analytics.totalExpenses,
      expensesByCategory: Object.fromEntries(analytics.expensesByCategory),
      topExpenses: analytics.topExpenses.slice(0, 5)
    });

    // Store daily summary
    await this.storeDailySummary(analytics);
  }

  /**
   * Perform weekly optimization analysis
   */
  private async performOptimizationAnalysis(): Promise<void> {
    logger.info('Performing weekly optimization analysis');

    const recommendations = this.expenseTracker.generateOptimizationRecommendations();
    
    if (recommendations.length > 0) {
      logger.info('Cost optimization recommendations generated', {
        count: recommendations.length,
        totalPotentialSavings: recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0)
      });

      // Send optimization report
      await this.sendOptimizationReport(recommendations);
    }
  }

  /**
   * Generate monthly expense report
   */
  private async generateMonthlyReport(): Promise<void> {
    logger.info('Generating monthly expense report');

    const monthlyAnalytics = this.expenseTracker.getExpenseAnalytics(30);
    const currentExpenses = this.expenseTracker.getCurrentMonthExpenses();
    const projectedCosts = this.expenseTracker.getProjectedMonthlyCosts();
    const activeAlerts = this.expenseTracker.getActiveAlerts();

    const report = {
      period: 'monthly',
      timestamp: new Date(),
      totalExpenses: monthlyAnalytics.totalExpenses,
      expensesByCategory: Object.fromEntries(monthlyAnalytics.expensesByCategory),
      expensesByService: Object.fromEntries(monthlyAnalytics.expensesByService),
      currentMonthExpenses: Object.fromEntries(currentExpenses),
      projectedMonthlyCosts: Object.fromEntries(projectedCosts),
      trends: monthlyAnalytics.trends,
      alerts: activeAlerts.length,
      topExpenses: monthlyAnalytics.topExpenses
    };

    logger.info('Monthly expense report generated', report);

    // Send monthly report
    await this.sendMonthlyReport(report);
  }

  /**
   * Send budget alert notification
   */
  private async sendBudgetAlertNotification(alert: any): Promise<void> {
    try {
      // Implementation would send notifications via:
      // - Email
      // - Slack
      // - SMS
      // - Push notifications
      
      logger.info('Budget alert notification sent', {
        alertId: alert.id,
        serviceId: alert.serviceId,
        type: alert.type
      });
    } catch (error) {
      logger.error('Failed to send budget alert notification', { error, alert });
    }
  }

  /**
   * Send optimization report
   */
  private async sendOptimizationReport(recommendations: any[]): Promise<void> {
    try {
      // Send optimization recommendations to stakeholders
      logger.info('Optimization report sent', {
        recommendationsCount: recommendations.length
      });
    } catch (error) {
      logger.error('Failed to send optimization report', { error });
    }
  }

  /**
   * Send monthly report
   */
  private async sendMonthlyReport(report: any): Promise<void> {
    try {
      // Send comprehensive monthly report
      logger.info('Monthly report sent', {
        totalExpenses: report.totalExpenses,
        period: report.period
      });
    } catch (error) {
      logger.error('Failed to send monthly report', { error });
    }
  }

  /**
   * Store daily expense summary
   */
  private async storeDailySummary(analytics: any): Promise<void> {
    try {
      // Store in database for historical analysis
      // Implementation would persist to database
      logger.info('Daily summary stored', {
        totalExpenses: analytics.totalExpenses
      });
    } catch (error) {
      logger.error('Failed to store daily summary', { error });
    }
  }

  /**
   * Get service configuration
   */
  private async getServiceConfig(serviceId: string): Promise<ServiceConfig | null> {
    // In a real implementation, this would fetch from database
    // For now, return mock configuration
    const mockConfigs: Record<string, ServiceConfig> = {
      openai: {
        id: 'openai',
        name: 'OpenAI API',
        category: 'ai',
        provider: 'OpenAI',
        pricingModel: 'usage',
        currency: 'USD',
        billingCycle: 'monthly',
        costPerUnit: 0.002,
        costThresholds: { warning: 50, critical: 100, maximum: 200 }
      },
      serpapi: {
        id: 'serpapi',
        name: 'SerpAPI',
        category: 'api',
        provider: 'SerpAPI',
        pricingModel: 'usage',
        currency: 'USD',
        billingCycle: 'monthly',
        costPerUnit: 0.1,
        freeAllowance: 100,
        costThresholds: { warning: 30, critical: 75, maximum: 150 }
      }
    };

    return mockConfigs[serviceId] || null;
  }

  /**
   * Get service category
   */
  private getServiceCategory(serviceId: string): string {
    const categories: Record<string, string> = {
      openai: 'ai',
      huggingface: 'ai',
      serpapi: 'api',
      cloudinary: 'storage',
      paystack: 'payment',
      twilio: 'api',
      redis_cloud: 'database',
      sentry: 'monitoring'
    };

    return categories[serviceId] || 'misc';
  }

  /**
   * Get current expense tracker instance
   */
  public getExpenseTracker(): ExpenseTracker {
    return this.expenseTracker;
  }

  /**
   * Manual expense recording
   */
  public async recordManualExpense(expense: Omit<ExpenseRecord, 'id' | 'timestamp'>): Promise<void> {
    await this.expenseTracker.recordExpense(expense);
  }

  /**
   * Get expense analytics
   */
  public getExpenseAnalytics(days: number = 30) {
    return this.expenseTracker.getExpenseAnalytics(days);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts() {
    return this.expenseTracker.getActiveAlerts();
  }
}

// Export singleton instance
export const expenseMonitor = new ExpenseMonitor();
export default ExpenseMonitor;
