/**
 * cost_optimizer.ts - Intelligent Cost Optimization & Budget Management System
 * Advanced cost analysis, optimization recommendations, and budget tracking
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { ExpenseTracker } from '../expense/expense_monitor.js';
import { serviceMonitor } from '../services/service_monitor.js';
import logger from '../../config/logger.js';

export interface CostOptimizationRule {
  id: string;
  name: string;
  description: string;
  category: 'usage' | 'resource' | 'service' | 'storage' | 'compute' | 'network';
  priority: 'low' | 'medium' | 'high' | 'critical';
  trigger: {
    type: 'threshold' | 'trend' | 'pattern' | 'schedule';
    conditions: Array<{
      metric: string;
      operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'trend_up' | 'trend_down';
      value: any;
      timeframe?: string; // e.g., '1h', '24h', '7d', '30d'
    }>;
  };
  actions: Array<{
    type: 'alert' | 'recommend' | 'auto_optimize' | 'scale_down' | 'shutdown' | 'migrate';
    target: string;
    parameters: Record<string, any>;
    autoExecute: boolean;
  }>;
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  estimatedSavings: {
    monthly: number;
    annual: number;
    confidence: number; // 0-1
  };
}

export interface BudgetCategory {
  id: string;
  name: string;
  description: string;
  parentId?: string; // for hierarchical budgets
  budgetAmount: {
    monthly: number;
    quarterly: number;
    annual: number;
  };
  spentAmount: {
    monthly: number;
    quarterly: number;
    annual: number;
  };
  allocatedServices: string[]; // service IDs
  thresholds: {
    warning: number; // percentage of budget
    critical: number; // percentage of budget
  };
  restrictions: {
    maxDailySpend: number;
    maxSingleTransaction: number;
    requireApproval: boolean;
    approvalThreshold: number;
  };
  rolloverPolicy: {
    enabled: boolean;
    maxRolloverPercent: number;
  };
  lastUpdated: Date;
  status: 'healthy' | 'warning' | 'over_budget' | 'exceeded';
}

export interface CostAnalysis {
  id: string;
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  };
  totalCost: number;
  breakdown: {
    byService: Record<string, number>;
    byCategory: Record<string, number>;
    byRegion: Record<string, number>;
    byUsageType: Record<string, number>;
  };
  trends: {
    direction: 'increasing' | 'decreasing' | 'stable';
    rate: number; // percentage change
    confidence: number; // 0-1
    forecast: {
      next30Days: number;
      next90Days: number;
      nextYear: number;
    };
  };
  anomalies: Array<{
    service: string;
    metric: string;
    expectedValue: number;
    actualValue: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    possibleCauses: string[];
  }>;
  recommendations: CostRecommendation[];
}

export interface CostRecommendation {
  id: string;
  type: 'rightsizing' | 'reserved_instances' | 'spot_instances' | 'storage_optimization' | 
        'service_consolidation' | 'region_optimization' | 'usage_optimization' | 'lifecycle_management';
  title: string;
  description: string;
  service: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact: {
    monthlySavings: number;
    annualSavings: number;
    implementationCost: number;
    paybackPeriod: number; // months
    confidence: number; // 0-1
  };
  implementation: {
    effort: 'low' | 'medium' | 'high';
    timeToImplement: number; // hours
    riskLevel: 'low' | 'medium' | 'high';
    prerequisites: string[];
    steps: Array<{
      step: number;
      description: string;
      command?: string;
      automated: boolean;
    }>;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed' | 'failed';
  createdAt: Date;
  implementedAt?: Date;
  dismissedAt?: Date;
  actualSavings?: number;
}

export interface BudgetAlert {
  id: string;
  budgetCategoryId: string;
  type: 'threshold_warning' | 'threshold_critical' | 'overspend' | 'forecast_exceeded' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: {
    currentSpend: number;
    budgetAmount: number;
    percentageUsed: number;
    projectedMonthlySpend?: number;
    anomalyDescription?: string;
  };
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
  actions: string[];
}

export interface CostOptimizationMetrics {
  totalSavingsIdentified: number;
  totalSavingsRealized: number;
  savingsRealizationRate: number; // percentage
  activeRecommendations: number;
  implementedRecommendations: number;
  avgImplementationTime: number; // hours
  costEfficiencyScore: number; // 0-100
  budgetUtilization: number; // percentage
  forecastAccuracy: number; // percentage
  anomaliesDetected: number;
}

export class CostOptimizer extends EventEmitter {
  private prisma: PrismaClient;
  private expenseTracker: ExpenseTracker;
  private optimizationRules: Map<string, CostOptimizationRule> = new Map();
  private budgetCategories: Map<string, BudgetCategory> = new Map();
  private costAnalysisHistory: Map<string, CostAnalysis> = new Map();
  private recommendations: Map<string, CostRecommendation> = new Map();
  private budgetAlerts: Map<string, BudgetAlert> = new Map();
  private cronJobs: Map<string, any> = new Map();
  private isRunning: boolean = false;

  // Configuration
  private readonly ANALYSIS_RETENTION_DAYS = 365;
  private readonly RECOMMENDATION_RETENTION_DAYS = 90;
  private readonly ALERT_RETENTION_DAYS = 30;

  constructor(expenseTracker: ExpenseTracker) {
    super();
    this.prisma = new PrismaClient();
    this.expenseTracker = expenseTracker;
    this.initializeOptimizationRules();
    this.initializeBudgetCategories();
  }

  /**
   * Start cost optimization system
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    logger.info('Starting cost optimization system');

    // Load historical data
    await this.loadHistoricalData();

    // Schedule analysis jobs
    this.scheduleAnalysisJobs();

    // Schedule budget monitoring
    this.scheduleBudgetMonitoring();

    // Schedule cleanup jobs
    this.scheduleCleanupJobs();

    // Start real-time monitoring
    this.startRealtimeMonitoring();

    this.isRunning = true;
    this.emit('started');

    logger.info('Cost optimization system started');
  }

  /**
   * Stop cost optimization system
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('Stopping cost optimization system');

    // Stop cron jobs
    for (const [jobId, job] of this.cronJobs) {
      job.destroy();
      logger.debug(`Stopped job: ${jobId}`);
    }

    this.isRunning = false;
    this.emit('stopped');

    logger.info('Cost optimization system stopped');
  }

  /**
   * Initialize optimization rules
   */
  private initializeOptimizationRules(): void {
    const rules: CostOptimizationRule[] = [
      {
        id: 'high_api_usage',
        name: 'High API Usage Detection',
        description: 'Detect unusually high API usage that may indicate inefficient usage patterns',
        category: 'usage',
        priority: 'high',
        trigger: {
          type: 'threshold',
          conditions: [
            {
              metric: 'daily_api_calls',
              operator: '>',
              value: 10000,
              timeframe: '24h'
            }
          ]
        },
        actions: [
          {
            type: 'alert',
            target: 'cost_team',
            parameters: { channel: 'slack', urgency: 'high' },
            autoExecute: true
          },
          {
            type: 'recommend',
            target: 'api_optimization',
            parameters: { type: 'usage_pattern_analysis' },
            autoExecute: true
          }
        ],
        enabled: true,
        triggerCount: 0,
        estimatedSavings: {
          monthly: 500,
          annual: 6000,
          confidence: 0.8
        }
      },
      {
        id: 'storage_growth_anomaly',
        name: 'Storage Growth Anomaly',
        description: 'Detect abnormal storage growth patterns',
        category: 'storage',
        priority: 'medium',
        trigger: {
          type: 'trend',
          conditions: [
            {
              metric: 'storage_usage',
              operator: 'trend_up',
              value: 50, // 50% increase
              timeframe: '7d'
            }
          ]
        },
        actions: [
          {
            type: 'recommend',
            target: 'storage_cleanup',
            parameters: { type: 'lifecycle_management' },
            autoExecute: true
          },
          {
            type: 'alert',
            target: 'ops_team',
            parameters: { severity: 'warning' },
            autoExecute: true
          }
        ],
        enabled: true,
        triggerCount: 0,
        estimatedSavings: {
          monthly: 200,
          annual: 2400,
          confidence: 0.7
        }
      },
      {
        id: 'unused_service_detection',
        name: 'Unused Service Detection',
        description: 'Identify services with zero or minimal usage',
        category: 'service',
        priority: 'medium',
        trigger: {
          type: 'threshold',
          conditions: [
            {
              metric: 'service_usage',
              operator: '<',
              value: 1, // Less than 1% of typical usage
              timeframe: '30d'
            }
          ]
        },
        actions: [
          {
            type: 'recommend',
            target: 'service_consolidation',
            parameters: { action: 'decommission_candidate' },
            autoExecute: true
          }
        ],
        enabled: true,
        triggerCount: 0,
        estimatedSavings: {
          monthly: 300,
          annual: 3600,
          confidence: 0.9
        }
      },
      {
        id: 'cost_spike_detection',
        name: 'Cost Spike Detection',
        description: 'Detect sudden cost increases',
        category: 'usage',
        priority: 'critical',
        trigger: {
          type: 'threshold',
          conditions: [
            {
              metric: 'daily_cost',
              operator: '>',
              value: 1.5, // 150% of average
              timeframe: '1d'
            }
          ]
        },
        actions: [
          {
            type: 'alert',
            target: 'cost_team',
            parameters: { urgency: 'critical', immediate: true },
            autoExecute: true
          },
          {
            type: 'recommend',
            target: 'emergency_optimization',
            parameters: { type: 'immediate_action' },
            autoExecute: true
          }
        ],
        enabled: true,
        triggerCount: 0,
        estimatedSavings: {
          monthly: 1000,
          annual: 12000,
          confidence: 0.6
        }
      },
      {
        id: 'regional_cost_optimization',
        name: 'Regional Cost Optimization',
        description: 'Identify opportunities to optimize costs by region',
        category: 'resource',
        priority: 'low',
        trigger: {
          type: 'pattern',
          conditions: [
            {
              metric: 'regional_cost_variance',
              operator: '>',
              value: 0.3, // 30% variance between regions
              timeframe: '30d'
            }
          ]
        },
        actions: [
          {
            type: 'recommend',
            target: 'region_optimization',
            parameters: { type: 'workload_migration' },
            autoExecute: true
          }
        ],
        enabled: true,
        triggerCount: 0,
        estimatedSavings: {
          monthly: 150,
          annual: 1800,
          confidence: 0.5
        }
      }
    ];

    rules.forEach(rule => {
      this.optimizationRules.set(rule.id, rule);
    });

    logger.info(`Initialized ${rules.length} cost optimization rules`);
  }

  /**
   * Initialize budget categories
   */
  private initializeBudgetCategories(): void {
    const categories: BudgetCategory[] = [
      {
        id: 'ai_services',
        name: 'AI & Machine Learning Services',
        description: 'Budget for AI/ML services like OpenAI, model training, etc.',
        budgetAmount: {
          monthly: 2000,
          quarterly: 6000,
          annual: 24000
        },
        spentAmount: {
          monthly: 0,
          quarterly: 0,
          annual: 0
        },
        allocatedServices: ['openai_api', 'custom_ml_models'],
        thresholds: {
          warning: 80,
          critical: 95
        },
        restrictions: {
          maxDailySpend: 200,
          maxSingleTransaction: 500,
          requireApproval: false,
          approvalThreshold: 1000
        },
        rolloverPolicy: {
          enabled: true,
          maxRolloverPercent: 20
        },
        lastUpdated: new Date(),
        status: 'healthy'
      },
      {
        id: 'data_services',
        name: 'Data & Analytics Services',
        description: 'Budget for data processing, storage, and analytics',
        budgetAmount: {
          monthly: 800,
          quarterly: 2400,
          annual: 9600
        },
        spentAmount: {
          monthly: 0,
          quarterly: 0,
          annual: 0
        },
        allocatedServices: ['serp_api', 'data_processing', 'analytics'],
        thresholds: {
          warning: 75,
          critical: 90
        },
        restrictions: {
          maxDailySpend: 100,
          maxSingleTransaction: 200,
          requireApproval: false,
          approvalThreshold: 500
        },
        rolloverPolicy: {
          enabled: true,
          maxRolloverPercent: 15
        },
        lastUpdated: new Date(),
        status: 'healthy'
      },
      {
        id: 'infrastructure',
        name: 'Core Infrastructure',
        description: 'Budget for hosting, CDN, storage, and core infrastructure',
        budgetAmount: {
          monthly: 1200,
          quarterly: 3600,
          annual: 14400
        },
        spentAmount: {
          monthly: 0,
          quarterly: 0,
          annual: 0
        },
        allocatedServices: ['cloudinary', 'hosting', 'cdn', 'database'],
        thresholds: {
          warning: 85,
          critical: 95
        },
        restrictions: {
          maxDailySpend: 150,
          maxSingleTransaction: 300,
          requireApproval: true,
          approvalThreshold: 400
        },
        rolloverPolicy: {
          enabled: false,
          maxRolloverPercent: 0
        },
        lastUpdated: new Date(),
        status: 'healthy'
      },
      {
        id: 'payment_processing',
        name: 'Payment Processing',
        description: 'Budget for payment gateway fees and processing',
        budgetAmount: {
          monthly: 600,
          quarterly: 1800,
          annual: 7200
        },
        spentAmount: {
          monthly: 0,
          quarterly: 0,
          annual: 0
        },
        allocatedServices: ['paystack', 'payment_processing'],
        thresholds: {
          warning: 70,
          critical: 85
        },
        restrictions: {
          maxDailySpend: 80,
          maxSingleTransaction: 100,
          requireApproval: false,
          approvalThreshold: 200
        },
        rolloverPolicy: {
          enabled: true,
          maxRolloverPercent: 10
        },
        lastUpdated: new Date(),
        status: 'healthy'
      },
      {
        id: 'communications',
        name: 'Communications & Notifications',
        description: 'Budget for SMS, email, and other communication services',
        budgetAmount: {
          monthly: 300,
          quarterly: 900,
          annual: 3600
        },
        spentAmount: {
          monthly: 0,
          quarterly: 0,
          annual: 0
        },
        allocatedServices: ['twilio', 'sendgrid', 'push_notifications'],
        thresholds: {
          warning: 75,
          critical: 90
        },
        restrictions: {
          maxDailySpend: 30,
          maxSingleTransaction: 50,
          requireApproval: false,
          approvalThreshold: 100
        },
        rolloverPolicy: {
          enabled: true,
          maxRolloverPercent: 25
        },
        lastUpdated: new Date(),
        status: 'healthy'
      },
      {
        id: 'monitoring_observability',
        name: 'Monitoring & Observability',
        description: 'Budget for monitoring, logging, and observability tools',
        budgetAmount: {
          monthly: 200,
          quarterly: 600,
          annual: 2400
        },
        spentAmount: {
          monthly: 0,
          quarterly: 0,
          annual: 0
        },
        allocatedServices: ['monitoring_tools', 'logging', 'apm'],
        thresholds: {
          warning: 80,
          critical: 95
        },
        restrictions: {
          maxDailySpend: 20,
          maxSingleTransaction: 30,
          requireApproval: false,
          approvalThreshold: 50
        },
        rolloverPolicy: {
          enabled: true,
          maxRolloverPercent: 30
        },
        lastUpdated: new Date(),
        status: 'healthy'
      }
    ];

    categories.forEach(category => {
      this.budgetCategories.set(category.id, category);
    });

    logger.info(`Initialized ${categories.length} budget categories`);
  }

  /**
   * Schedule analysis jobs
   */
  private scheduleAnalysisJobs(): void {
    // Daily cost analysis
    const dailyJob = cron.schedule('0 8 * * *', async () => {
      await this.performCostAnalysis('daily');
    }, { timezone: 'UTC' });

    // Weekly cost analysis
    const weeklyJob = cron.schedule('0 9 * * 1', async () => {
      await this.performCostAnalysis('weekly');
    }, { timezone: 'UTC' });

    // Monthly cost analysis
    const monthlyJob = cron.schedule('0 10 1 * *', async () => {
      await this.performCostAnalysis('monthly');
    }, { timezone: 'UTC' });

    // Optimization rule evaluation
    const optimizationJob = cron.schedule('0 */2 * * *', async () => {
      await this.evaluateOptimizationRules();
    }, { timezone: 'UTC' });

    this.cronJobs.set('daily_analysis', dailyJob);
    this.cronJobs.set('weekly_analysis', weeklyJob);
    this.cronJobs.set('monthly_analysis', monthlyJob);
    this.cronJobs.set('optimization_evaluation', optimizationJob);

    // Start jobs
    dailyJob.start();
    weeklyJob.start();
    monthlyJob.start();
    optimizationJob.start();

    logger.info('Scheduled cost analysis jobs');
  }

  /**
   * Schedule budget monitoring
   */
  private scheduleBudgetMonitoring(): void {
    // Hourly budget monitoring
    const budgetJob = cron.schedule('0 * * * *', async () => {
      await this.monitorBudgets();
    }, { timezone: 'UTC' });

    // Daily budget reporting
    const reportingJob = cron.schedule('0 18 * * *', async () => {
      await this.generateBudgetReports();
    }, { timezone: 'UTC' });

    this.cronJobs.set('budget_monitoring', budgetJob);
    this.cronJobs.set('budget_reporting', reportingJob);

    budgetJob.start();
    reportingJob.start();

    logger.info('Scheduled budget monitoring jobs');
  }

  /**
   * Schedule cleanup jobs
   */
  private scheduleCleanupJobs(): void {
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldData();
    }, { timezone: 'UTC' });

    this.cronJobs.set('cleanup', cleanupJob);
    cleanupJob.start();

    logger.info('Scheduled cleanup jobs');
  }

  /**
   * Start real-time monitoring
   */
  private startRealtimeMonitoring(): void {
    // Listen to expense tracker events (commented out until ExpenseTracker is properly implemented)
    // this.expenseTracker.on('expenseRecorded', (expense) => {
    //   this.handleExpenseEvent(expense);
    // });

    // this.expenseTracker.on('budgetAlert', (alert) => {
    //   this.handleBudgetAlertFromTracker(alert);
    // });

    // Listen to service monitor events for cost implications
    serviceMonitor.on('alertGenerated', (alert) => {
      this.handleServiceAlert(alert);
    });

    logger.info('Started real-time cost monitoring');
  }

  /**
   * Perform cost analysis
   */
  private async performCostAnalysis(period: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    logger.info(`Performing ${period} cost analysis`);

    try {
      const { start, end } = this.getPeriodDates(period);
      
      // Get expense data from expense tracker (commented out until ExpenseTracker is properly implemented)
      // const expenses = await this.expenseTracker.getExpensesByDateRange(start, end);
      const expenses: any[] = []; // Mock empty array for now
      
      // Calculate total cost
      const totalCost = expenses.reduce((sum, expense) => sum + expense.amount, 0);

      // Create cost breakdown
      const breakdown = this.createCostBreakdown(expenses);

      // Calculate trends
      const trends = await this.calculateCostTrends(period, totalCost);

      // Detect anomalies
      const anomalies = await this.detectCostAnomalies(expenses);

      // Generate recommendations
      const recommendations = await this.generateCostRecommendations(expenses, anomalies);

      // Create analysis
      const analysis: CostAnalysis = {
        id: `analysis_${Date.now()}_${period}`,
        timestamp: new Date(),
        period: { start, end, type: period },
        totalCost,
        breakdown,
        trends,
        anomalies,
        recommendations
      };

      // Store analysis
      this.costAnalysisHistory.set(analysis.id, analysis);

      // Store recommendations
      recommendations.forEach(rec => {
        this.recommendations.set(rec.id, rec);
      });

      // Emit event
      this.emit('costAnalysisCompleted', analysis);

      logger.info(`${period} cost analysis completed: $${totalCost.toFixed(2)}`);

    } catch (error) {
      logger.error(`Failed to perform ${period} cost analysis`, { error });
    }
  }

  /**
   * Get period dates
   */
  private getPeriodDates(period: 'daily' | 'weekly' | 'monthly'): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);

    let start: Date;
    switch (period) {
      case 'daily':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      default:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  /**
   * Create cost breakdown
   */
  private createCostBreakdown(expenses: any[]): CostAnalysis['breakdown'] {
    const breakdown = {
      byService: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byRegion: {} as Record<string, number>,
      byUsageType: {} as Record<string, number>
    };

    expenses.forEach(expense => {
      // By service
      breakdown.byService[expense.service] = (breakdown.byService[expense.service] || 0) + expense.amount;

      // By category
      const category = this.getServiceCategory(expense.service);
      breakdown.byCategory[category] = (breakdown.byCategory[category] || 0) + expense.amount;

      // By region (simulated)
      const region = expense.metadata?.region || 'us-east-1';
      breakdown.byRegion[region] = (breakdown.byRegion[region] || 0) + expense.amount;

      // By usage type
      const usageType = expense.metadata?.usageType || 'standard';
      breakdown.byUsageType[usageType] = (breakdown.byUsageType[usageType] || 0) + expense.amount;
    });

    return breakdown;
  }

  /**
   * Get service category
   */
  private getServiceCategory(service: string): string {
    const categoryMap: Record<string, string> = {
      'openai_api': 'AI/ML',
      'serp_api': 'Data',
      'cloudinary': 'Storage',
      'paystack': 'Payment',
      'twilio': 'Communication',
      'sendgrid': 'Communication',
      'redis_cloud': 'Infrastructure'
    };

    return categoryMap[service] || 'Other';
  }

  /**
   * Calculate cost trends
   */
  private async calculateCostTrends(period: string, currentCost: number): Promise<CostAnalysis['trends']> {
    // Get previous period cost for comparison
    const previousPeriodCost = await this.getPreviousPeriodCost(period);
    
    const rate = previousPeriodCost > 0 ? 
      ((currentCost - previousPeriodCost) / previousPeriodCost) * 100 : 0;

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(rate) > 5) {
      direction = rate > 0 ? 'increasing' : 'decreasing';
    }

    // Generate forecast based on trend
    const forecast = this.generateCostForecast(currentCost, rate);

    return {
      direction,
      rate,
      confidence: 0.75, // Simplified confidence score
      forecast
    };
  }

  /**
   * Get previous period cost
   */
  private async getPreviousPeriodCost(period: string): Promise<number> {
    // Simulate getting previous period cost
    // In real implementation, this would query historical data
    return Math.random() * 1000 + 500;
  }

  /**
   * Generate cost forecast
   */
  private generateCostForecast(currentCost: number, trendRate: number): CostAnalysis['trends']['forecast'] {
    const monthlyMultiplier = 30;
    const quarterlyMultiplier = 90;
    const yearlyMultiplier = 365;

    const trendMultiplier = 1 + (trendRate / 100);

    return {
      next30Days: currentCost * monthlyMultiplier * trendMultiplier,
      next90Days: currentCost * quarterlyMultiplier * trendMultiplier,
      nextYear: currentCost * yearlyMultiplier * trendMultiplier
    };
  }

  /**
   * Detect cost anomalies
   */
  private async detectCostAnomalies(expenses: any[]): Promise<CostAnalysis['anomalies']> {
    const anomalies: CostAnalysis['anomalies'] = [];

    // Group expenses by service
    const serviceExpenses = expenses.reduce((groups, expense) => {
      if (!groups[expense.service]) {
        groups[expense.service] = [];
      }
      groups[expense.service].push(expense);
      return groups;
    }, {} as Record<string, any[]>);

    // Check each service for anomalies
    for (const [service, serviceExpenseList] of Object.entries(serviceExpenses)) {
      const totalCost = (serviceExpenseList as any[]).reduce((sum, exp) => sum + exp.amount, 0);
      const expectedCost = await this.getExpectedServiceCost(service);

      const deviation = Math.abs((totalCost - expectedCost) / expectedCost);

      if (deviation > 0.3) { // 30% deviation threshold
        anomalies.push({
          service,
          metric: 'total_cost',
          expectedValue: expectedCost,
          actualValue: totalCost,
          severity: deviation > 0.8 ? 'critical' : 
                   deviation > 0.6 ? 'high' :
                   deviation > 0.4 ? 'medium' : 'low',
          possibleCauses: this.identifyPossibleCauses(service, deviation)
        });
      }
    }

    return anomalies;
  }

  /**
   * Get expected service cost
   */
  private async getExpectedServiceCost(service: string): Promise<number> {
    // Simulate expected cost calculation based on historical data
    const baseCosts: Record<string, number> = {
      'openai_api': 300,
      'serp_api': 150,
      'cloudinary': 100,
      'paystack': 80,
      'twilio': 40,
      'sendgrid': 20,
      'redis_cloud': 60
    };

    return baseCosts[service] || 50;
  }

  /**
   * Identify possible causes for anomalies
   */
  private identifyPossibleCauses(service: string, deviation: number): string[] {
    const causes: string[] = [];

    if (deviation > 0.5) {
      causes.push('Unusual spike in usage');
      causes.push('Service pricing changes');
    }

    if (deviation > 0.3) {
      causes.push('Increased user activity');
      causes.push('New feature deployment');
      causes.push('System inefficiencies');
    }

    // Service-specific causes
    switch (service) {
      case 'openai_api':
        causes.push('Increased AI model usage', 'Token usage spike');
        break;
      case 'cloudinary':
        causes.push('Image processing surge', 'Storage growth');
        break;
      case 'twilio':
        causes.push('SMS campaign', 'Notification volume increase');
        break;
    }

    return causes;
  }

  /**
   * Generate cost recommendations
   */
  private async generateCostRecommendations(expenses: any[], anomalies: CostAnalysis['anomalies']): Promise<CostRecommendation[]> {
    const recommendations: CostRecommendation[] = [];

    // Generate recommendations based on anomalies
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
        recommendations.push(await this.createAnomalyRecommendation(anomaly));
      }
    }

    // Generate general optimization recommendations
    const serviceUsage = this.analyzeServiceUsage(expenses);
    recommendations.push(...await this.generateUsageOptimizationRecommendations(serviceUsage));

    return recommendations;
  }

  /**
   * Create anomaly-based recommendation
   */
  private async createAnomalyRecommendation(anomaly: CostAnalysis['anomalies'][0]): Promise<CostRecommendation> {
    const potentialSavings = (anomaly.actualValue - anomaly.expectedValue) * 0.7; // Assume 70% of anomaly can be saved

    return {
      id: `rec_anomaly_${Date.now()}_${anomaly.service}`,
      type: 'usage_optimization',
      title: `Address cost anomaly in ${anomaly.service}`,
      description: `${anomaly.service} shows ${anomaly.severity} cost anomaly with ${((anomaly.actualValue - anomaly.expectedValue) / anomaly.expectedValue * 100).toFixed(1)}% increase`,
      service: anomaly.service,
      priority: anomaly.severity,
      impact: {
        monthlySavings: potentialSavings,
        annualSavings: potentialSavings * 12,
        implementationCost: 100,
        paybackPeriod: 0.5,
        confidence: 0.8
      },
      implementation: {
        effort: 'medium',
        timeToImplement: 4,
        riskLevel: 'low',
        prerequisites: ['Usage analysis', 'Service configuration review'],
        steps: [
          {
            step: 1,
            description: 'Analyze service usage patterns',
            automated: false
          },
          {
            step: 2,
            description: 'Implement usage optimization',
            automated: true
          },
          {
            step: 3,
            description: 'Monitor cost reduction',
            automated: true
          }
        ]
      },
      status: 'pending',
      createdAt: new Date()
    };
  }

  /**
   * Analyze service usage
   */
  private analyzeServiceUsage(expenses: any[]): Record<string, any> {
    const usage: Record<string, any> = {};

    expenses.forEach(expense => {
      if (!usage[expense.service]) {
        usage[expense.service] = {
          totalCost: 0,
          transactionCount: 0,
          avgTransactionCost: 0,
          peakUsage: 0
        };
      }

      usage[expense.service].totalCost += expense.amount;
      usage[expense.service].transactionCount += 1;
      usage[expense.service].peakUsage = Math.max(usage[expense.service].peakUsage, expense.amount);
    });

    // Calculate averages
    Object.values(usage).forEach((serviceUsage: any) => {
      serviceUsage.avgTransactionCost = serviceUsage.totalCost / serviceUsage.transactionCount;
    });

    return usage;
  }

  /**
   * Generate usage optimization recommendations
   */
  private async generateUsageOptimizationRecommendations(serviceUsage: Record<string, any>): Promise<CostRecommendation[]> {
    const recommendations: CostRecommendation[] = [];

    for (const [service, usage] of Object.entries(serviceUsage)) {
      // High transaction count with low average cost
      if (usage.transactionCount > 1000 && usage.avgTransactionCost < 1) {
        recommendations.push({
          id: `rec_batch_${Date.now()}_${service}`,
          type: 'usage_optimization',
          title: `Implement request batching for ${service}`,
          description: 'High transaction volume detected. Batching requests could reduce costs.',
          service,
          priority: 'medium',
          impact: {
            monthlySavings: usage.totalCost * 0.2,
            annualSavings: usage.totalCost * 0.2 * 12,
            implementationCost: 200,
            paybackPeriod: 1,
            confidence: 0.7
          },
          implementation: {
            effort: 'medium',
            timeToImplement: 8,
            riskLevel: 'low',
            prerequisites: ['API batching support'],
            steps: [
              {
                step: 1,
                description: 'Implement request batching',
                automated: false
              },
              {
                step: 2,
                description: 'Test batching implementation',
                automated: true
              }
            ]
          },
          status: 'pending',
          createdAt: new Date()
        });
      }

      // High peak usage suggests possible inefficiencies
      if (usage.peakUsage > usage.avgTransactionCost * 10) {
        recommendations.push({
          id: `rec_peak_${Date.now()}_${service}`,
          type: 'usage_optimization',
          title: `Optimize peak usage for ${service}`,
          description: 'Peak usage significantly higher than average, indicating potential inefficiencies.',
          service,
          priority: 'medium',
          impact: {
            monthlySavings: usage.peakUsage * 0.3,
            annualSavings: usage.peakUsage * 0.3 * 12,
            implementationCost: 150,
            paybackPeriod: 0.8,
            confidence: 0.6
          },
          implementation: {
            effort: 'low',
            timeToImplement: 4,
            riskLevel: 'low',
            prerequisites: ['Usage pattern analysis'],
            steps: [
              {
                step: 1,
                description: 'Analyze peak usage patterns',
                automated: true
              },
              {
                step: 2,
                description: 'Implement usage smoothing',
                automated: false
              }
            ]
          },
          status: 'pending',
          createdAt: new Date()
        });
      }
    }

    return recommendations;
  }

  /**
   * Evaluate optimization rules
   */
  private async evaluateOptimizationRules(): Promise<void> {
    logger.debug('Evaluating cost optimization rules');

    for (const rule of this.optimizationRules.values()) {
      if (!rule.enabled) continue;

      try {
        const shouldTrigger = await this.evaluateRuleConditions(rule);
        
        if (shouldTrigger) {
          await this.executeRuleActions(rule);
          rule.lastTriggered = new Date();
          rule.triggerCount++;

          logger.info(`Optimization rule triggered: ${rule.name}`);
          this.emit('optimizationRuleTriggered', rule);
        }
      } catch (error) {
        logger.error(`Failed to evaluate rule ${rule.name}`, { error });
      }
    }
  }

  /**
   * Evaluate rule conditions
   */
  private async evaluateRuleConditions(rule: CostOptimizationRule): Promise<boolean> {
    for (const condition of rule.trigger.conditions) {
      const metricValue = await this.getMetricValue(condition.metric, condition.timeframe);
      
      if (!this.evaluateCondition(metricValue, condition.operator, condition.value)) {
        return false; // All conditions must be true
      }
    }

    return true;
  }

  /**
   * Get metric value
   */
  private async getMetricValue(metric: string, timeframe?: string): Promise<number> {
    // Simulate metric retrieval
    const metrics: Record<string, number> = {
      'daily_api_calls': Math.random() * 15000,
      'storage_usage': Math.random() * 1000,
      'service_usage': Math.random() * 100,
      'daily_cost': Math.random() * 200,
      'regional_cost_variance': Math.random() * 0.5
    };

    return metrics[metric] || 0;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(value: number, operator: string, threshold: any): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      case 'trend_up':
        // Simplified trend detection
        return value > threshold;
      case 'trend_down':
        return value < threshold;
      default:
        return false;
    }
  }

  /**
   * Execute rule actions
   */
  private async executeRuleActions(rule: CostOptimizationRule): Promise<void> {
    for (const action of rule.actions) {
      if (!action.autoExecute) continue;

      try {
        switch (action.type) {
          case 'alert':
            await this.sendAlert(rule, action);
            break;
          case 'recommend':
            await this.createRecommendation(rule, action);
            break;
          case 'auto_optimize':
            await this.performAutoOptimization(rule, action);
            break;
        }
      } catch (error) {
        logger.error(`Failed to execute action ${action.type} for rule ${rule.name}`, { error });
      }
    }
  }

  /**
   * Send alert
   */
  private async sendAlert(rule: CostOptimizationRule, action: any): Promise<void> {
    logger.warn(`Cost optimization alert: ${rule.name}`, {
      rule: rule.id,
      priority: rule.priority,
      description: rule.description
    });

    // In a real implementation, this would integrate with notification services
    this.emit('costAlert', {
      rule: rule.id,
      message: rule.description,
      priority: rule.priority,
      parameters: action.parameters
    });
  }

  /**
   * Create recommendation
   */
  private async createRecommendation(rule: CostOptimizationRule, action: any): Promise<void> {
    const recommendation: CostRecommendation = {
      id: `rec_rule_${Date.now()}_${rule.id}`,
      type: this.mapRuleToRecommendationType(rule.category),
      title: `Optimization: ${rule.name}`,
      description: rule.description,
      service: 'system',
      priority: rule.priority,
      impact: {
        monthlySavings: rule.estimatedSavings.monthly,
        annualSavings: rule.estimatedSavings.annual,
        implementationCost: 100,
        paybackPeriod: 1,
        confidence: rule.estimatedSavings.confidence
      },
      implementation: {
        effort: 'medium',
        timeToImplement: 4,
        riskLevel: 'low',
        prerequisites: [],
        steps: [
          {
            step: 1,
            description: 'Implement optimization based on rule trigger',
            automated: true
          }
        ]
      },
      status: 'pending',
      createdAt: new Date()
    };

    this.recommendations.set(recommendation.id, recommendation);
    this.emit('recommendationCreated', recommendation);
  }

  /**
   * Map rule category to recommendation type
   */
  private mapRuleToRecommendationType(category: string): CostRecommendation['type'] {
    const mapping: Record<string, CostRecommendation['type']> = {
      'usage': 'usage_optimization',
      'resource': 'rightsizing',
      'service': 'service_consolidation',
      'storage': 'storage_optimization',
      'compute': 'rightsizing',
      'network': 'usage_optimization'
    };

    return mapping[category] || 'usage_optimization';
  }

  /**
   * Perform auto optimization
   */
  private async performAutoOptimization(rule: CostOptimizationRule, action: any): Promise<void> {
    logger.info(`Performing auto optimization for rule: ${rule.name}`);

    // Simulated auto-optimization actions
    switch (action.target) {
      case 'api_optimization':
        logger.info('Implementing API usage optimization');
        break;
      case 'storage_cleanup':
        logger.info('Performing storage cleanup');
        break;
      case 'service_consolidation':
        logger.info('Consolidating services');
        break;
      default:
        logger.info(`Unknown optimization target: ${action.target}`);
    }

    this.emit('autoOptimizationPerformed', { rule: rule.id, action: action.target });
  }

  /**
   * Monitor budgets
   */
  private async monitorBudgets(): Promise<void> {
    logger.debug('Monitoring budgets');

    for (const budget of this.budgetCategories.values()) {
      try {
        await this.updateBudgetSpending(budget);
        await this.checkBudgetThresholds(budget);
      } catch (error) {
        logger.error(`Failed to monitor budget ${budget.name}`, { error });
      }
    }
  }

  /**
   * Update budget spending
   */
  private async updateBudgetSpending(budget: BudgetCategory): Promise<void> {
    // Get current spending for services in this budget
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    let monthlySpend = 0;
    for (const serviceId of budget.allocatedServices) {
      const serviceSpend = await this.getServiceSpendForPeriod(serviceId, currentMonth, new Date());
      monthlySpend += serviceSpend;
    }

    budget.spentAmount.monthly = monthlySpend;
    budget.lastUpdated = new Date();

    // Update status based on spending
    const monthlyUsagePercent = (monthlySpend / budget.budgetAmount.monthly) * 100;

    if (monthlyUsagePercent >= 100) {
      budget.status = 'exceeded';
    } else if (monthlyUsagePercent >= budget.thresholds.critical) {
      budget.status = 'over_budget';
    } else if (monthlyUsagePercent >= budget.thresholds.warning) {
      budget.status = 'warning';
    } else {
      budget.status = 'healthy';
    }
  }

  /**
   * Get service spend for period
   */
  private async getServiceSpendForPeriod(serviceId: string, start: Date, end: Date): Promise<number> {
    // Simulate getting service spending
    return Math.random() * 100;
  }

  /**
   * Check budget thresholds
   */
  private async checkBudgetThresholds(budget: BudgetCategory): Promise<void> {
    const monthlyUsagePercent = (budget.spentAmount.monthly / budget.budgetAmount.monthly) * 100;

    if (monthlyUsagePercent >= budget.thresholds.critical) {
      await this.generateBudgetAlert(budget, 'threshold_critical', monthlyUsagePercent);
    } else if (monthlyUsagePercent >= budget.thresholds.warning) {
      await this.generateBudgetAlert(budget, 'threshold_warning', monthlyUsagePercent);
    }

    // Check for overspend
    if (budget.spentAmount.monthly > budget.budgetAmount.monthly) {
      await this.generateBudgetAlert(budget, 'overspend', monthlyUsagePercent);
    }
  }

  /**
   * Generate budget alert
   */
  private async generateBudgetAlert(
    budget: BudgetCategory, 
    type: BudgetAlert['type'], 
    usagePercent: number
  ): Promise<void> {
    const alertId = `budget_alert_${Date.now()}_${budget.id}`;

    const alert: BudgetAlert = {
      id: alertId,
      budgetCategoryId: budget.id,
      type,
      severity: type === 'threshold_critical' || type === 'overspend' ? 'critical' : 'medium',
      message: `Budget ${type.replace('_', ' ')} for ${budget.name}`,
      details: {
        currentSpend: budget.spentAmount.monthly,
        budgetAmount: budget.budgetAmount.monthly,
        percentageUsed: usagePercent
      },
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      actions: this.generateBudgetAlertActions(budget, type)
    };

    this.budgetAlerts.set(alertId, alert);

    logger.warn(`Budget alert generated: ${budget.name}`, {
      alertId,
      type,
      usage: `${usagePercent.toFixed(1)}%`
    });

    this.emit('budgetAlert', alert);
  }

  /**
   * Generate budget alert actions
   */
  private generateBudgetAlertActions(budget: BudgetCategory, type: BudgetAlert['type']): string[] {
    const actions: string[] = [];

    switch (type) {
      case 'threshold_warning':
        actions.push('Monitor spending closely');
        actions.push('Review budget allocation');
        break;
      case 'threshold_critical':
        actions.push('Implement spending controls');
        actions.push('Request budget increase');
        actions.push('Optimize service usage');
        break;
      case 'overspend':
        actions.push('Immediate spending halt');
        actions.push('Emergency budget review');
        actions.push('Cost optimization measures');
        break;
    }

    return actions;
  }

  /**
   * Generate budget reports
   */
  private async generateBudgetReports(): Promise<void> {
    logger.info('Generating daily budget reports');

    const report = {
      timestamp: new Date(),
      budgets: Array.from(this.budgetCategories.values()).map(budget => ({
        name: budget.name,
        monthlyBudget: budget.budgetAmount.monthly,
        monthlySpent: budget.spentAmount.monthly,
        usagePercent: (budget.spentAmount.monthly / budget.budgetAmount.monthly) * 100,
        status: budget.status,
        daysRemaining: this.getDaysRemainingInMonth()
      })),
      totalBudget: Array.from(this.budgetCategories.values())
        .reduce((sum, b) => sum + b.budgetAmount.monthly, 0),
      totalSpent: Array.from(this.budgetCategories.values())
        .reduce((sum, b) => sum + b.spentAmount.monthly, 0)
    };

    this.emit('budgetReport', report);
    logger.info('Budget report generated');
  }

  /**
   * Get days remaining in month
   */
  private getDaysRemainingInMonth(): number {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate();
  }

  /**
   * Handle expense event from tracker
   */
  private handleExpenseEvent(expense: any): void {
    // Update relevant budget categories
    for (const budget of this.budgetCategories.values()) {
      if (budget.allocatedServices.includes(expense.service)) {
        budget.spentAmount.monthly += expense.amount;
        budget.lastUpdated = new Date();

        // Check if this expense violates restrictions
        if (expense.amount > budget.restrictions.maxSingleTransaction) {
          this.generateBudgetAlert(budget, 'anomaly', 0);
        }
      }
    }
  }

  /**
   * Handle budget alert from expense tracker
   */
  private handleBudgetAlertFromTracker(alert: any): void {
    logger.info('Received budget alert from expense tracker', { alert });
    // Process alert from expense tracker
    this.emit('externalBudgetAlert', alert);
  }

  /**
   * Handle service alert
   */
  private handleServiceAlert(alert: any): void {
    // Check if service alert has cost implications
    if (alert.type === 'downtime' || alert.type === 'performance') {
      // Service downtime might affect cost patterns
      logger.info('Service alert may have cost implications', { 
        service: alert.serviceId, 
        type: alert.type 
      });
    }
  }

  /**
   * Clean up old data
   */
  private async cleanupOldData(): Promise<void> {
    logger.debug('Cleaning up old cost data');

    const now = Date.now();

    // Clean up old analyses
    for (const [id, analysis] of this.costAnalysisHistory) {
      if (now - analysis.timestamp.getTime() > this.ANALYSIS_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
        this.costAnalysisHistory.delete(id);
      }
    }

    // Clean up old recommendations
    for (const [id, rec] of this.recommendations) {
      if (now - rec.createdAt.getTime() > this.RECOMMENDATION_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
        this.recommendations.delete(id);
      }
    }

    // Clean up old alerts
    for (const [id, alert] of this.budgetAlerts) {
      if (alert.resolved && now - alert.timestamp.getTime() > this.ALERT_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
        this.budgetAlerts.delete(id);
      }
    }

    logger.debug('Cost data cleanup completed');
  }

  /**
   * Load historical data
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      logger.info('Loading historical cost data');
      // In a real implementation, this would load from database
    } catch (error) {
      logger.error('Failed to load historical cost data', { error });
    }
  }

  /**
   * Get cost optimization metrics
   */
  public getCostOptimizationMetrics(): CostOptimizationMetrics {
    const activeRecs = Array.from(this.recommendations.values()).filter(r => r.status === 'pending');
    const implementedRecs = Array.from(this.recommendations.values()).filter(r => r.status === 'completed');
    
    const totalSavingsIdentified = Array.from(this.recommendations.values())
      .reduce((sum, r) => sum + r.impact.monthlySavings, 0);
    
    const totalSavingsRealized = implementedRecs
      .reduce((sum, r) => sum + (r.actualSavings || r.impact.monthlySavings), 0);

    const budgets = Array.from(this.budgetCategories.values());
    const totalBudget = budgets.reduce((sum, b) => sum + b.budgetAmount.monthly, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount.monthly, 0);

    return {
      totalSavingsIdentified,
      totalSavingsRealized,
      savingsRealizationRate: totalSavingsIdentified > 0 ? 
        (totalSavingsRealized / totalSavingsIdentified) * 100 : 0,
      activeRecommendations: activeRecs.length,
      implementedRecommendations: implementedRecs.length,
      avgImplementationTime: implementedRecs.length > 0 ?
        implementedRecs.reduce((sum, r) => sum + r.implementation.timeToImplement, 0) / implementedRecs.length : 0,
      costEfficiencyScore: totalBudget > 0 ? 
        Math.max(0, 100 - ((totalSpent / totalBudget) * 100)) : 100,
      budgetUtilization: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      forecastAccuracy: 85, // Simulated
      anomaliesDetected: Array.from(this.costAnalysisHistory.values())
        .reduce((sum, analysis) => sum + analysis.anomalies.length, 0)
    };
  }

  /**
   * Get budget overview
   */
  public getBudgetOverview(): {
    categories: BudgetCategory[];
    totalBudget: number;
    totalSpent: number;
    activeAlerts: number;
    healthyBudgets: number;
    warningBudgets: number;
    criticalBudgets: number;
  } {
    const categories = Array.from(this.budgetCategories.values());
    const totalBudget = categories.reduce((sum, c) => sum + c.budgetAmount.monthly, 0);
    const totalSpent = categories.reduce((sum, c) => sum + c.spentAmount.monthly, 0);
    const activeAlerts = Array.from(this.budgetAlerts.values()).filter(a => !a.resolved).length;

    return {
      categories,
      totalBudget,
      totalSpent,
      activeAlerts,
      healthyBudgets: categories.filter(c => c.status === 'healthy').length,
      warningBudgets: categories.filter(c => c.status === 'warning').length,
      criticalBudgets: categories.filter(c => c.status === 'over_budget' || c.status === 'exceeded').length
    };
  }

  /**
   * Get cost recommendations
   */
  public getCostRecommendations(status?: CostRecommendation['status']): CostRecommendation[] {
    const recommendations = Array.from(this.recommendations.values());
    
    if (status) {
      return recommendations.filter(r => r.status === status);
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority] ||
             b.impact.monthlySavings - a.impact.monthlySavings;
    });
  }

  /**
   * Implement recommendation
   */
  public async implementRecommendation(recommendationId: string): Promise<boolean> {
    const recommendation = this.recommendations.get(recommendationId);
    if (!recommendation) return false;

    recommendation.status = 'in_progress';
    
    try {
      // Simulate implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      recommendation.status = 'completed';
      recommendation.implementedAt = new Date();
      recommendation.actualSavings = recommendation.impact.monthlySavings * (0.8 + Math.random() * 0.4); // 80-120% of estimated

      this.emit('recommendationImplemented', recommendation);
      return true;
    } catch (error) {
      recommendation.status = 'failed';
      logger.error(`Failed to implement recommendation ${recommendationId}`, { error });
      return false;
    }
  }

  /**
   * Dismiss recommendation
   */
  public dismissRecommendation(recommendationId: string): boolean {
    const recommendation = this.recommendations.get(recommendationId);
    if (!recommendation) return false;

    recommendation.status = 'dismissed';
    recommendation.dismissedAt = new Date();

    this.emit('recommendationDismissed', recommendation);
    return true;
  }
}

// Export for integration with expense tracker
export default CostOptimizer;
