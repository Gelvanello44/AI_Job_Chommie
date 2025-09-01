/**
 * ExpenseTracker - Comprehensive expense monitoring and tracking system
 * Tracks all project-related service costs in real-time with predictive analytics
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import logger from '../../config/logger.js';

export interface ServiceConfig {
  id: string;
  name: string;
  category: 'hosting' | 'api' | 'storage' | 'analytics' | 'email' | 'payment' | 'ai' | 'database' | 'monitoring';
  provider: string;
  pricingModel: 'fixed' | 'usage' | 'tier' | 'hybrid';
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'daily' | 'per-request';
  trialEndDate?: Date;
  subscriptionId?: string;
  apiEndpoint?: string;
  costPerUnit?: number;
  freeAllowance?: number;
  costThresholds: {
    warning: number;
    critical: number;
    maximum: number;
  };
}

export interface ExpenseRecord {
  id: string;
  serviceId: string;
  timestamp: Date;
  amount: number;
  currency: string;
  usage?: number;
  description: string;
  category: string;
  isProjected: boolean;
  metadata: Record<string, any>;
}

export interface BudgetAlert {
  id: string;
  serviceId: string;
  type: 'warning' | 'critical' | 'trial_expiring' | 'cost_spike' | 'optimization';
  threshold: number;
  currentAmount: number;
  projectedAmount?: number;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export class ExpenseTracker extends EventEmitter {
  private prisma: PrismaClient;
  private services: Map<string, ServiceConfig>;
  private expenses: Map<string, ExpenseRecord[]>;
  private alerts: Map<string, BudgetAlert>;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isActive: boolean = false;

  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.services = new Map();
    this.expenses = new Map();
    this.alerts = new Map();
    this.setupDefaultServices();
  }

  /**
   * Initialize default services configuration
   */
  private setupDefaultServices(): void {
    const defaultServices: ServiceConfig[] = [
      {
        id: 'openai',
        name: 'OpenAI API',
        category: 'ai',
        provider: 'OpenAI',
        pricingModel: 'usage',
        currency: 'USD',
        billingCycle: 'monthly',
        costPerUnit: 0.002, // per 1K tokens
        freeAllowance: 0,
        costThresholds: { warning: 50, critical: 100, maximum: 200 }
      },
      {
        id: 'huggingface',
        name: 'HuggingFace Inference API',
        category: 'ai',
        provider: 'HuggingFace',
        pricingModel: 'usage',
        currency: 'USD',
        billingCycle: 'monthly',
        costPerUnit: 0.001,
        freeAllowance: 1000,
        costThresholds: { warning: 25, critical: 50, maximum: 100 }
      },
      {
        id: 'serpapi',
        name: 'SerpAPI',
        category: 'api',
        provider: 'SerpAPI',
        pricingModel: 'usage',
        currency: 'USD',
        billingCycle: 'monthly',
        costPerUnit: 0.1, // per search
        freeAllowance: 100,
        costThresholds: { warning: 30, critical: 75, maximum: 150 }
      },
      {
        id: 'cloudinary',
        name: 'Cloudinary',
        category: 'storage',
        provider: 'Cloudinary',
        pricingModel: 'tier',
        currency: 'USD',
        billingCycle: 'monthly',
        freeAllowance: 25000, // 25K images
        costThresholds: { warning: 20, critical: 50, maximum: 100 }
      },
      {
        id: 'paystack',
        name: 'Paystack',
        category: 'payment',
        provider: 'Paystack',
        pricingModel: 'usage',
        currency: 'ZAR',
        billingCycle: 'monthly',
        costPerUnit: 0.029, // 2.9% per transaction
        costThresholds: { warning: 500, critical: 1000, maximum: 2000 }
      },
      {
        id: 'twilio',
        name: 'Twilio SMS',
        category: 'api',
        provider: 'Twilio',
        pricingModel: 'usage',
        currency: 'USD',
        billingCycle: 'monthly',
        costPerUnit: 0.075, // per SMS
        costThresholds: { warning: 20, critical: 50, maximum: 100 }
      },
      {
        id: 'redis_cloud',
        name: 'Redis Cloud',
        category: 'database',
        provider: 'Redis',
        pricingModel: 'tier',
        currency: 'USD',
        billingCycle: 'monthly',
        freeAllowance: 30, // 30MB free
        costThresholds: { warning: 15, critical: 30, maximum: 60 }
      },
      {
        id: 'sentry',
        name: 'Sentry Error Monitoring',
        category: 'monitoring',
        provider: 'Sentry',
        pricingModel: 'usage',
        currency: 'USD',
        billingCycle: 'monthly',
        freeAllowance: 5000, // 5K errors/month
        costThresholds: { warning: 25, critical: 50, maximum: 100 }
      }
    ];

    defaultServices.forEach(service => {
      this.services.set(service.id, service);
      this.expenses.set(service.id, []);
    });
  }

  /**
   * Start expense monitoring
   */
  public async start(): Promise<void> {
    if (this.isActive) return;

    this.isActive = true;
    logger.info('Starting expense tracking system');

    // Initial data load
    await this.loadExpenseData();
    
    // Start periodic monitoring (every hour)
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCycle();
    }, 60 * 60 * 1000);

    // Initial monitoring cycle
    await this.performMonitoringCycle();

    this.emit('started');
  }

  /**
   * Stop expense monitoring
   */
  public async stop(): Promise<void> {
    if (!this.isActive) return;

    this.isActive = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Stopped expense tracking system');
    this.emit('stopped');
  }

  /**
   * Add or update service configuration
   */
  public addService(config: ServiceConfig): void {
    this.services.set(config.id, config);
    if (!this.expenses.has(config.id)) {
      this.expenses.set(config.id, []);
    }
    logger.info(`Added service: ${config.name}`);
  }

  /**
   * Record an expense for a service
   */
  public async recordExpense(expense: Omit<ExpenseRecord, 'id' | 'timestamp'>): Promise<void> {
    const record: ExpenseRecord = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...expense
    };

    // Add to memory
    const serviceExpenses = this.expenses.get(expense.serviceId) || [];
    serviceExpenses.push(record);
    this.expenses.set(expense.serviceId, serviceExpenses);

    // Persist to database (commented out until expenseRecord table is added to schema)
    try {
      // await this.prisma.expenseRecord.create({
      //   data: {
      //     id: record.id,
      //     serviceId: record.serviceId,
      //     amount: record.amount,
      //     currency: record.currency,
      //     usage: record.usage,
      //     description: record.description,
      //     category: record.category,
      //     isProjected: record.isProjected,
      //     metadata: record.metadata,
      //     timestamp: record.timestamp
      //   }
      // });
      logger.debug('Expense record created (in-memory only)', { recordId: record.id });
    } catch (error) {
      logger.error('Failed to persist expense record', { error, record });
    }

    // Check for threshold violations
    await this.checkThresholds(expense.serviceId);

    this.emit('expenseRecorded', record);
  }

  /**
   * Calculate current month expenses by service
   */
  public getCurrentMonthExpenses(): Map<string, number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const expenses = new Map<string, number>();

    this.services.forEach((service, serviceId) => {
      const serviceExpenses = this.expenses.get(serviceId) || [];
      const monthlyTotal = serviceExpenses
        .filter(expense => 
          expense.timestamp >= startOfMonth && 
          !expense.isProjected
        )
        .reduce((sum, expense) => sum + expense.amount, 0);
      
      expenses.set(serviceId, monthlyTotal);
    });

    return expenses;
  }

  /**
   * Calculate projected monthly costs based on current usage patterns
   */
  public getProjectedMonthlyCosts(): Map<string, number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projections = new Map<string, number>();

    this.services.forEach((service, serviceId) => {
      const serviceExpenses = this.expenses.get(serviceId) || [];
      const monthToDateTotal = serviceExpenses
        .filter(expense => 
          expense.timestamp >= startOfMonth && 
          !expense.isProjected
        )
        .reduce((sum, expense) => sum + expense.amount, 0);

      // Project based on current daily average
      const dailyAverage = monthToDateTotal / dayOfMonth;
      const projectedMonthly = dailyAverage * daysInMonth;
      
      projections.set(serviceId, projectedMonthly);
    });

    return projections;
  }

  /**
   * Get trial periods expiring soon (within 7 days)
   */
  public getExpiringTrials(): ServiceConfig[] {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    return Array.from(this.services.values())
      .filter(service => 
        service.trialEndDate && 
        service.trialEndDate <= sevenDaysFromNow
      );
  }

  /**
   * Generate cost optimization recommendations
   */
  public generateOptimizationRecommendations(): Array<{
    serviceId: string;
    type: 'downgrade' | 'usage_optimization' | 'alternative' | 'consolidation';
    recommendation: string;
    potentialSavings: number;
    confidence: number;
  }> {
    const recommendations: Array<any> = [];
    const currentExpenses = this.getCurrentMonthExpenses();
    const projections = this.getProjectedMonthlyCosts();

    this.services.forEach((service, serviceId) => {
      const currentCost = currentExpenses.get(serviceId) || 0;
      const projectedCost = projections.get(serviceId) || 0;

      // Low usage services
      if (projectedCost < service.costThresholds.warning * 0.3) {
        recommendations.push({
          serviceId,
          type: 'downgrade',
          recommendation: `Consider downgrading ${service.name} plan due to low usage`,
          potentialSavings: projectedCost * 0.4,
          confidence: 0.8
        });
      }

      // High growth services
      if (projectedCost > currentCost * 1.5) {
        recommendations.push({
          serviceId,
          type: 'usage_optimization',
          recommendation: `Optimize ${service.name} usage to control costs`,
          potentialSavings: (projectedCost - currentCost) * 0.3,
          confidence: 0.7
        });
      }
    });

    return recommendations;
  }

  /**
   * Get active budget alerts
   */
  public getActiveAlerts(): BudgetAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
    }
  }

  /**
   * Get comprehensive expense analytics
   */
  public getExpenseAnalytics(days: number = 30): {
    totalExpenses: number;
    expensesByCategory: Map<string, number>;
    expensesByService: Map<string, number>;
    dailyExpenses: Array<{ date: string; amount: number }>;
    topExpenses: ExpenseRecord[];
    trends: {
      direction: 'increasing' | 'decreasing' | 'stable';
      percentChange: number;
    };
  } {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const allExpenses: ExpenseRecord[] = [];

    // Collect all expenses within date range
    this.expenses.forEach(serviceExpenses => {
      const recentExpenses = serviceExpenses.filter(
        expense => expense.timestamp >= cutoffDate && !expense.isProjected
      );
      allExpenses.push(...recentExpenses);
    });

    // Calculate totals
    const totalExpenses = allExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Group by category
    const expensesByCategory = new Map<string, number>();
    allExpenses.forEach(expense => {
      const current = expensesByCategory.get(expense.category) || 0;
      expensesByCategory.set(expense.category, current + expense.amount);
    });

    // Group by service
    const expensesByService = new Map<string, number>();
    allExpenses.forEach(expense => {
      const current = expensesByService.get(expense.serviceId) || 0;
      expensesByService.set(expense.serviceId, current + expense.amount);
    });

    // Daily breakdown
    const dailyExpenses = this.calculateDailyExpenses(allExpenses, days);

    // Top expenses
    const topExpenses = allExpenses
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Trend analysis
    const trends = this.calculateTrends(dailyExpenses);

    return {
      totalExpenses,
      expensesByCategory,
      expensesByService,
      dailyExpenses,
      topExpenses,
      trends
    };
  }

  /**
   * Perform monitoring cycle
   */
  private async performMonitoringCycle(): Promise<void> {
    try {
      // Update usage data from APIs
      await this.updateUsageData();
      
      // Check all thresholds
      for (const serviceId of this.services.keys()) {
        await this.checkThresholds(serviceId);
      }

      // Check trial expirations
      await this.checkTrialExpirations();

      // Detect cost spikes
      await this.detectCostSpikes();

      logger.info('Completed expense monitoring cycle');
    } catch (error) {
      logger.error('Error in monitoring cycle', { error });
    }
  }

  /**
   * Load expense data from database
   */
  private async loadExpenseData(): Promise<void> {
    try {
      // Commented out until expenseRecord table is added to schema
      // const records = await this.prisma.expenseRecord.findMany({
      //   where: {
      //     timestamp: {
      //       gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
      //     }
      //   }
      // });

      // records.forEach(record => {
      //   const serviceExpenses = this.expenses.get(record.serviceId) || [];
      //   serviceExpenses.push({
      //     id: record.id,
      //     serviceId: record.serviceId,
      //     timestamp: record.timestamp,
      //     amount: record.amount,
      //     currency: record.currency,
      //     usage: record.usage || undefined,
      //     description: record.description,
      //     category: record.category,
      //     isProjected: record.isProjected,
      //     metadata: record.metadata as Record<string, any>
      //   });
      //   this.expenses.set(record.serviceId, serviceExpenses);
      // });

      // logger.info(`Loaded ${records.length} expense records`);
      logger.info('Expense data loading skipped (in-memory mode)');
    } catch (error) {
      logger.error('Failed to load expense data', { error });
    }
  }

  /**
   * Update usage data from external APIs
   */
  private async updateUsageData(): Promise<void> {
    // This would integrate with actual service APIs
    // For now, simulate with random usage patterns
    const services = Array.from(this.services.values());
    
    for (const service of services) {
      if (service.pricingModel === 'usage') {
        const simulatedUsage = Math.floor(Math.random() * 100);
        const cost = simulatedUsage * (service.costPerUnit || 0.01);
        
        if (cost > 0) {
          await this.recordExpense({
            serviceId: service.id,
            amount: cost,
            currency: service.currency,
            usage: simulatedUsage,
            description: `Automated usage tracking - ${simulatedUsage} units`,
            category: service.category,
            isProjected: false,
            metadata: { automated: true, usage: simulatedUsage }
          });
        }
      }
    }
  }

  /**
   * Check budget thresholds
   */
  private async checkThresholds(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) return;

    const currentExpenses = this.getCurrentMonthExpenses();
    const currentCost = currentExpenses.get(serviceId) || 0;
    const projectedCost = this.getProjectedMonthlyCosts().get(serviceId) || 0;

    // Check warning threshold
    if (currentCost >= service.costThresholds.warning && currentCost < service.costThresholds.critical) {
      await this.createAlert({
        serviceId,
        type: 'warning',
        threshold: service.costThresholds.warning,
        currentAmount: currentCost,
        projectedAmount: projectedCost,
        message: `${service.name} expenses have reached warning threshold of ${service.currency} ${service.costThresholds.warning}`
      });
    }

    // Check critical threshold
    if (currentCost >= service.costThresholds.critical) {
      await this.createAlert({
        serviceId,
        type: 'critical',
        threshold: service.costThresholds.critical,
        currentAmount: currentCost,
        projectedAmount: projectedCost,
        message: `${service.name} expenses have reached critical threshold of ${service.currency} ${service.costThresholds.critical}`
      });
    }
  }

  /**
   * Check trial expirations
   */
  private async checkTrialExpirations(): Promise<void> {
    const expiringTrials = this.getExpiringTrials();
    
    for (const service of expiringTrials) {
      const daysUntilExpiry = Math.ceil(
        (service.trialEndDate!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );

      await this.createAlert({
        serviceId: service.id,
        type: 'trial_expiring',
        threshold: 0,
        currentAmount: 0,
        message: `${service.name} trial expires in ${daysUntilExpiry} day(s)`
      });
    }
  }

  /**
   * Detect unusual cost spikes
   */
  private async detectCostSpikes(): Promise<void> {
    const projections = this.getProjectedMonthlyCosts();
    const currentExpenses = this.getCurrentMonthExpenses();

    projections.forEach(async (projected, serviceId) => {
      const current = currentExpenses.get(serviceId) || 0;
      const service = this.services.get(serviceId);
      
      if (service && projected > current * 2) { // 100% spike
        await this.createAlert({
          serviceId,
          type: 'cost_spike',
          threshold: current * 2,
          currentAmount: current,
          projectedAmount: projected,
          message: `Unusual cost spike detected for ${service.name}. Projected: ${service.currency} ${projected.toFixed(2)}`
        });
      }
    });
  }

  /**
   * Create budget alert
   */
  private async createAlert(alertData: Omit<BudgetAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    const alert: BudgetAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      ...alertData
    };

    // Avoid duplicate alerts
    const existingAlert = Array.from(this.alerts.values()).find(
      existing => 
        existing.serviceId === alert.serviceId && 
        existing.type === alert.type && 
        !existing.acknowledged &&
        (Date.now() - existing.timestamp.getTime()) < 60 * 60 * 1000 // Within 1 hour
    );

    if (!existingAlert) {
      this.alerts.set(alert.id, alert);
      this.emit('budgetAlert', alert);
      logger.warn('Budget alert created', alert);
    }
  }

  /**
   * Calculate daily expenses breakdown
   */
  private calculateDailyExpenses(expenses: ExpenseRecord[], days: number): Array<{ date: string; amount: number }> {
    const dailyMap = new Map<string, number>();
    
    expenses.forEach(expense => {
      const dateKey = expense.timestamp.toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || 0;
      dailyMap.set(dateKey, current + expense.amount);
    });

    const result: Array<{ date: string; amount: number }> = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      result.unshift({
        date: dateKey,
        amount: dailyMap.get(dateKey) || 0
      });
    }

    return result;
  }

  /**
   * Calculate expense trends
   */
  private calculateTrends(dailyExpenses: Array<{ date: string; amount: number }>): {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentChange: number;
  } {
    if (dailyExpenses.length < 7) {
      return { direction: 'stable', percentChange: 0 };
    }

    const recentWeek = dailyExpenses.slice(-7);
    const previousWeek = dailyExpenses.slice(-14, -7);

    const recentAverage = recentWeek.reduce((sum, day) => sum + day.amount, 0) / 7;
    const previousAverage = previousWeek.reduce((sum, day) => sum + day.amount, 0) / 7;

    const percentChange = previousAverage > 0 
      ? ((recentAverage - previousAverage) / previousAverage) * 100 
      : 0;

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(percentChange) > 10) {
      direction = percentChange > 0 ? 'increasing' : 'decreasing';
    }

    return { direction, percentChange };
  }
}

export default ExpenseTracker;
