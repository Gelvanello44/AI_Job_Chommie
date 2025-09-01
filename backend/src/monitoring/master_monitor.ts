/**
 * master_monitor.ts - Master Monitoring Integration System
 * Coordinates all monitoring systems into a unified platform
 */

import { EventEmitter } from 'events';
import { ExpenseTracker } from './expense/expense_monitor.js';
import { SystemReliabilityManager } from './reliability/SystemReliabilityManager.js';
import { ErrorPreventionSystem } from './prevention/error_prevention.js';
import { PreventiveMaintenanceEngine } from './prevention/prevention_monitor.js';
import { MaintenanceScheduler } from './maintenance/maintenance_scheduler.js';
import { ServiceMonitor } from './services/service_monitor.js';
import CostOptimizer from './cost/cost_optimizer.js';
import logger from '../config/logger.js';

export interface MasterMonitoringStatus {
  overall: {
    status: 'healthy' | 'warning' | 'critical' | 'maintenance';
    score: number; // 0-100
    uptime: number; // hours
    lastHealthCheck: Date;
  };
  systems: {
    expenses: {
      status: 'active' | 'inactive' | 'error';
      totalExpenses: number;
      monthlyBudget: number;
      utilizationPercent: number;
      alertsCount: number;
    };
    reliability: {
      status: 'active' | 'inactive' | 'error';
      servicesMonitored: number;
      healthyServices: number;
      downtimeMinutes: number;
      alertsCount: number;
    };
    errorPrevention: {
      status: 'active' | 'inactive' | 'error';
      patternsTracked: number;
      diagnosticsRun: number;
      preventionScore: number;
      maintenanceAlerts: number;
    };
    maintenance: {
      status: 'active' | 'inactive' | 'error';
      scheduledTasks: number;
      completedTasks: number;
      successRate: number;
      nextMaintenance: Date;
    };
    services: {
      status: 'active' | 'inactive' | 'error';
      externalServices: number;
      healthyServices: number;
      circuitBreakersOpen: number;
      serviceAlerts: number;
    };
    costOptimization: {
      status: 'active' | 'inactive' | 'error';
      savingsIdentified: number;
      recommendationsActive: number;
      budgetUtilization: number;
      costEfficiencyScore: number;
    };
  };
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  recommendations: {
    cost: number;
    performance: number;
    reliability: number;
    maintenance: number;
    total: number;
  };
}

export interface SystemMetrics {
  timestamp: Date;
  period: '1h' | '24h' | '7d' | '30d';
  metrics: {
    availability: number;
    performance: number;
    cost: number;
    efficiency: number;
    security: number;
    reliability: number;
  };
  trends: {
    [key: string]: {
      direction: 'up' | 'down' | 'stable';
      change: number; // percentage
      confidence: number; // 0-1
    };
  };
}

export class MasterMonitor extends EventEmitter {
  private expenseTracker: ExpenseTracker;
  private reliabilityManager: SystemReliabilityManager;
  private errorPrevention: ErrorPreventionSystem;
  private maintenanceEngine: PreventiveMaintenanceEngine;
  private maintenanceScheduler: MaintenanceScheduler;
  private serviceMonitor: ServiceMonitor;
  private costOptimizer: CostOptimizer;

  private isRunning: boolean = false;
  private systemStatus: MasterMonitoringStatus;
  private startTime: Date;

  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 60 * 1000; // 1 minute
  private readonly METRICS_COLLECTION_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly STATUS_UPDATE_INTERVAL = 30 * 1000; // 30 seconds

  constructor() {
    super();
    
    this.startTime = new Date();
    
    // Initialize all monitoring systems
    this.expenseTracker = new ExpenseTracker();
    this.reliabilityManager = new SystemReliabilityManager();
    this.errorPrevention = new ErrorPreventionSystem();
    this.maintenanceEngine = new PreventiveMaintenanceEngine();
    this.maintenanceScheduler = new MaintenanceScheduler();
    this.serviceMonitor = new ServiceMonitor();
    this.costOptimizer = new CostOptimizer(this.expenseTracker);

    this.systemStatus = this.initializeSystemStatus();
    this.setupEventListeners();
  }

  /**
   * Start all monitoring systems
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    logger.info(' Starting Master Monitoring System');

    try {
      // Start all subsystems in order
      logger.info(' Starting Expense Tracker...');
      await this.expenseTracker.start();

      logger.info(' Starting Reliability Manager...');
      await this.reliabilityManager.start();

      logger.info(' Starting Error Prevention System...');
      await this.errorPrevention.start();

      logger.info(' Starting Maintenance Engine...');
      await this.maintenanceEngine.start();

      logger.info(' Starting Maintenance Scheduler...');
      await this.maintenanceScheduler.start();

      logger.info(' Starting Service Monitor...');
      await this.serviceMonitor.start();

      logger.info(' Starting Cost Optimizer...');
      await this.costOptimizer.start();

      // Start monitoring intervals
      this.startMonitoringIntervals();

      this.isRunning = true;
      this.emit('started');

      logger.info(' Master Monitoring System started successfully!');
      this.logSystemOverview();

    } catch (error) {
      logger.error(' Failed to start Master Monitoring System', { error });
      throw error;
    }
  }

  /**
   * Stop all monitoring systems
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info(' Stopping Master Monitoring System');

    try {
      // Stop all subsystems
      await Promise.allSettled([
        this.expenseTracker.stop(),
        this.reliabilityManager.stop(),
        this.errorPrevention.stop(),
        this.maintenanceEngine.stop(),
        this.maintenanceScheduler.stop(),
        this.serviceMonitor.stop(),
        this.costOptimizer.stop()
      ]);

      this.isRunning = false;
      this.emit('stopped');

      logger.info(' Master Monitoring System stopped successfully');

    } catch (error) {
      logger.error(' Failed to stop Master Monitoring System', { error });
      throw error;
    }
  }

  /**
   * Initialize system status structure
   */
  private initializeSystemStatus(): MasterMonitoringStatus {
    return {
      overall: {
        status: 'healthy',
        score: 100,
        uptime: 0,
        lastHealthCheck: new Date()
      },
      systems: {
        expenses: {
          status: 'inactive',
          totalExpenses: 0,
          monthlyBudget: 0,
          utilizationPercent: 0,
          alertsCount: 0
        },
        reliability: {
          status: 'inactive',
          servicesMonitored: 0,
          healthyServices: 0,
          downtimeMinutes: 0,
          alertsCount: 0
        },
        errorPrevention: {
          status: 'inactive',
          patternsTracked: 0,
          diagnosticsRun: 0,
          preventionScore: 0,
          maintenanceAlerts: 0
        },
        maintenance: {
          status: 'inactive',
          scheduledTasks: 0,
          completedTasks: 0,
          successRate: 0,
          nextMaintenance: new Date()
        },
        services: {
          status: 'inactive',
          externalServices: 0,
          healthyServices: 0,
          circuitBreakersOpen: 0,
          serviceAlerts: 0
        },
        costOptimization: {
          status: 'inactive',
          savingsIdentified: 0,
          recommendationsActive: 0,
          budgetUtilization: 0,
          costEfficiencyScore: 0
        }
      },
      alerts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      },
      recommendations: {
        cost: 0,
        performance: 0,
        reliability: 0,
        maintenance: 0,
        total: 0
      }
    };
  }

  /**
   * Setup event listeners for all subsystems
   */
  private setupEventListeners(): void {
    // Expense Tracker Events
    this.expenseTracker.on('expenseRecorded', (data) => {
      this.emit('expenseRecorded', data);
    });

    this.expenseTracker.on('budgetAlert', (alert) => {
      this.handleAlert('expense', alert);
    });

    // Reliability Manager Events
    this.reliabilityManager.on('serviceDown', (service) => {
      this.handleAlert('reliability', { 
        type: 'service_down', 
        severity: 'critical', 
        service 
      });
    });

    this.reliabilityManager.on('alertGenerated', (alert) => {
      this.handleAlert('reliability', alert);
    });

    // Error Prevention Events
    this.errorPrevention.on('maintenanceAlert', (alert) => {
      this.handleAlert('error_prevention', alert);
    });

    this.errorPrevention.on('diagnosticsCompleted', (results) => {
      this.emit('diagnosticsCompleted', results);
    });

    // Maintenance Engine Events
    this.maintenanceEngine.on('maintenanceCompleted', (data) => {
      this.emit('maintenanceCompleted', data);
    });

    this.maintenanceEngine.on('healthAssessment', (assessment) => {
      this.emit('healthAssessment', assessment);
    });

    // Service Monitor Events
    this.serviceMonitor.on('alertGenerated', (alert) => {
      this.handleAlert('service', alert);
    });

    this.serviceMonitor.on('circuitBreakerOpened', (data) => {
      this.handleAlert('service', { 
        type: 'circuit_breaker', 
        severity: 'high', 
        data 
      });
    });

    // Cost Optimizer Events
    this.costOptimizer.on('budgetAlert', (alert) => {
      this.handleAlert('cost', alert);
    });

    this.costOptimizer.on('recommendationCreated', (recommendation) => {
      this.emit('recommendationCreated', recommendation);
    });

    logger.info('Event listeners setup completed');
  }

  /**
   * Start monitoring intervals
   */
  private startMonitoringIntervals(): void {
    // Health check interval
    setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    // Status update interval
    setInterval(() => {
      this.updateSystemStatus();
    }, this.STATUS_UPDATE_INTERVAL);

    // Metrics collection interval
    setInterval(() => {
      this.collectSystemMetrics();
    }, this.METRICS_COLLECTION_INTERVAL);

    logger.info('Monitoring intervals started');
  }

  /**
   * Handle alerts from all subsystems
   */
  private handleAlert(source: string, alert: any): void {
    logger.info(`Alert received from ${source}`, { 
      type: alert.type, 
      severity: alert.severity 
    });

    // Update alert counts
    const severity = alert.severity || 'medium';
    this.systemStatus.alerts[severity as keyof typeof this.systemStatus.alerts]++;
    this.systemStatus.alerts.total++;

    // Update overall status based on alert severity
    if (alert.severity === 'critical') {
      this.systemStatus.overall.status = 'critical';
      this.systemStatus.overall.score = Math.min(this.systemStatus.overall.score, 60);
    } else if (alert.severity === 'high' && this.systemStatus.overall.status === 'healthy') {
      this.systemStatus.overall.status = 'warning';
      this.systemStatus.overall.score = Math.min(this.systemStatus.overall.score, 80);
    }

    // Emit master alert event
    this.emit('alert', {
      source,
      alert,
      timestamp: new Date(),
      systemStatus: this.systemStatus
    });
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthResults = {
        expenses: this.checkExpenseSystemHealth(),
        reliability: await this.checkReliabilitySystemHealth(),
        errorPrevention: this.checkErrorPreventionHealth(),
        maintenance: this.checkMaintenanceSystemHealth(),
        services: this.checkServiceMonitorHealth(),
        costOptimization: this.checkCostOptimizerHealth()
      };

      // Calculate overall health score
      const scores = Object.values(healthResults).map(result => result.score);
      const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

      // Update system status
      this.systemStatus.overall.score = overallScore;
      this.systemStatus.overall.lastHealthCheck = new Date();
      this.systemStatus.overall.uptime = (Date.now() - this.startTime.getTime()) / (1000 * 60 * 60); // hours

      // Determine overall status
      if (overallScore >= 90) {
        this.systemStatus.overall.status = 'healthy';
      } else if (overallScore >= 70) {
        this.systemStatus.overall.status = 'warning';
      } else {
        this.systemStatus.overall.status = 'critical';
      }

      this.emit('healthCheckCompleted', {
        overall: this.systemStatus.overall,
        subsystems: healthResults
      });

    } catch (error) {
      logger.error('Health check failed', { error });
      this.systemStatus.overall.status = 'critical';
      this.systemStatus.overall.score = 0;
    }
  }

  /**
   * Check expense system health
   */
  private checkExpenseSystemHealth(): { score: number; status: string; details: any } {
    try {
      const monthlyExpenses = this.expenseTracker.getCurrentMonthExpenses();
      const totalExpenses = Array.from(monthlyExpenses.values()).reduce((sum: number, amount: number) => sum + amount, 0);
      // Budget calculation - simplified for now
      const budget = 1000; // Would come from configuration or calculation
      const utilizationPercent = budget > 0 ? (totalExpenses / budget) * 100 : 0;

      let score = 100;
      if (utilizationPercent > 90) score = 60;
      else if (utilizationPercent > 80) score = 80;

      return {
        score,
        status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
        details: { totalExpenses, budget, utilizationPercent }
      };
    } catch (error) {
      return { score: 0, status: 'error', details: { error } };
    }
  }

  /**
   * Check reliability system health
   */
  private async checkReliabilitySystemHealth(): Promise<{ score: number; status: string; details: any }> {
    try {
      const healthSummary = await this.reliabilityManager.getHealthSummary();
      const servicesArray = Array.from(healthSummary.services.values());
      const healthyCount = servicesArray.filter((s: any) => s.status === 'healthy').length;
      const totalCount = servicesArray.length;
      
      const score = totalCount > 0 ? (healthyCount / totalCount) * 100 : 100;

      return {
        score,
        status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
        details: { healthyCount, totalCount, services: Array.from(healthSummary.services.entries()) }
      };
    } catch (error) {
      return { score: 0, status: 'error', details: { error } };
    }
  }

  /**
   * Check error prevention health
   */
  private checkErrorPreventionHealth(): { score: number; status: string; details: any } {
    try {
      const diagnosticSummary = this.errorPrevention.getDiagnosticSummary();
      const patternsSummary = this.errorPrevention.getErrorPatternsSummary();
      const activeAlerts = this.errorPrevention.getActiveMaintenanceAlerts();

      const score = Math.max(0, 100 - (activeAlerts.length * 10));

      return {
        score,
        status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
        details: { 
          diagnostics: diagnosticSummary,
          patterns: patternsSummary.length,
          alerts: activeAlerts.length
        }
      };
    } catch (error) {
      return { score: 0, status: 'error', details: { error } };
    }
  }

  /**
   * Check maintenance system health
   */
  private checkMaintenanceSystemHealth(): { score: number; status: string; details: any } {
    try {
      const maintenanceStatus = this.maintenanceEngine.getMaintenanceStatus();
      const metrics = this.maintenanceEngine.getSystemMetrics();

      const score = Math.min(100, metrics.successRate + 
        (metrics.overallHealth > 0 ? metrics.overallHealth : 0));

      return {
        score,
        status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
        details: {
          successRate: metrics.successRate,
          overallHealth: metrics.overallHealth,
          activeSchedules: metrics.activeSchedules
        }
      };
    } catch (error) {
      return { score: 0, status: 'error', details: { error } };
    }
  }

  /**
   * Check service monitor health
   */
  private checkServiceMonitorHealth(): { score: number; status: string; details: any } {
    try {
      const servicesSummary = this.serviceMonitor.getServiceMetricsSummary();
      const healthyPercent = servicesSummary.totalServices > 0 ? 
        (servicesSummary.healthyServices / servicesSummary.totalServices) * 100 : 100;

      const score = Math.max(0, healthyPercent - (servicesSummary.circuitBreakersOpen * 20));

      return {
        score,
        status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
        details: {
          totalServices: servicesSummary.totalServices,
          healthyServices: servicesSummary.healthyServices,
          circuitBreakersOpen: servicesSummary.circuitBreakersOpen,
          activeAlerts: servicesSummary.activeAlerts
        }
      };
    } catch (error) {
      return { score: 0, status: 'error', details: { error } };
    }
  }

  /**
   * Check cost optimizer health
   */
  private checkCostOptimizerHealth(): { score: number; status: string; details: any } {
    try {
      const metrics = this.costOptimizer.getCostOptimizationMetrics();
      const budgetOverview = this.costOptimizer.getBudgetOverview();

      const score = Math.min(100, metrics.costEfficiencyScore + 
        (metrics.savingsRealizationRate / 2));

      return {
        score,
        status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
        details: {
          costEfficiencyScore: metrics.costEfficiencyScore,
          budgetUtilization: metrics.budgetUtilization,
          activeRecommendations: metrics.activeRecommendations,
          totalSavings: metrics.totalSavingsRealized
        }
      };
    } catch (error) {
      return { score: 0, status: 'error', details: { error } };
    }
  }

  /**
   * Update system status
   */
  private async updateSystemStatus(): Promise<void> {
    try {
      // Update expense system status
      const monthlyExpenses = this.expenseTracker.getCurrentMonthExpenses();
      const totalExpenses = Array.from(monthlyExpenses.values()).reduce((sum: number, amount: number) => sum + amount, 0);
      const activeAlerts = this.expenseTracker.getActiveAlerts();
      const budget = 1000; // Would come from configuration
      
      this.systemStatus.systems.expenses = {
        status: 'active',
        totalExpenses,
        monthlyBudget: budget,
        utilizationPercent: budget > 0 ? (totalExpenses / budget) * 100 : 0,
        alertsCount: activeAlerts.length
      };

      // Update reliability system status
      const healthSummary = await this.reliabilityManager.getHealthSummary();
      const servicesArray = Array.from(healthSummary.services.values());
      this.systemStatus.systems.reliability = {
        status: 'active',
        servicesMonitored: servicesArray.length,
        healthyServices: servicesArray.filter((s: any) => s.status === 'healthy').length,
        downtimeMinutes: 0, // Would calculate from actual data
        alertsCount: servicesArray.filter((s: any) => s.error).length
      };

      // Update other systems...
      const serviceMetrics = this.serviceMonitor.getServiceMetricsSummary();
      this.systemStatus.systems.services = {
        status: 'active',
        externalServices: serviceMetrics.totalServices,
        healthyServices: serviceMetrics.healthyServices,
        circuitBreakersOpen: serviceMetrics.circuitBreakersOpen,
        serviceAlerts: serviceMetrics.activeAlerts
      };

      const costMetrics = this.costOptimizer.getCostOptimizationMetrics();
      this.systemStatus.systems.costOptimization = {
        status: 'active',
        savingsIdentified: costMetrics.totalSavingsIdentified,
        recommendationsActive: costMetrics.activeRecommendations,
        budgetUtilization: costMetrics.budgetUtilization,
        costEfficiencyScore: costMetrics.costEfficiencyScore
      };

      this.emit('statusUpdated', this.systemStatus);

    } catch (error) {
      logger.error('Failed to update system status', { error });
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics: SystemMetrics = {
        timestamp: new Date(),
        period: '1h',
        metrics: {
          availability: this.calculateAvailabilityMetric(),
          performance: await this.calculatePerformanceMetric(),
          cost: this.calculateCostMetric(),
          efficiency: this.calculateEfficiencyMetric(),
          security: this.calculateSecurityMetric(),
          reliability: this.calculateReliabilityMetric()
        },
        trends: this.calculateTrends()
      };

      this.emit('metricsCollected', metrics);

    } catch (error) {
      logger.error('Failed to collect metrics', { error });
    }
  }

  /**
   * Calculate availability metric
   */
  private calculateAvailabilityMetric(): number {
    const serviceMetrics = this.serviceMonitor.getServiceMetricsSummary();
    return serviceMetrics.totalServices > 0 ? 
      (serviceMetrics.healthyServices / serviceMetrics.totalServices) * 100 : 100;
  }

  /**
   * Calculate performance metric
   */
  private async calculatePerformanceMetric(): Promise<number> {
    // Simplified performance calculation
    return this.systemStatus.overall.score;
  }

  /**
   * Calculate cost metric
   */
  private calculateCostMetric(): number {
    const costMetrics = this.costOptimizer.getCostOptimizationMetrics();
    return costMetrics.costEfficiencyScore;
  }

  /**
   * Calculate efficiency metric
   */
  private calculateEfficiencyMetric(): number {
    const maintenanceMetrics = this.maintenanceEngine.getSystemMetrics();
    return maintenanceMetrics.successRate;
  }

  /**
   * Calculate security metric
   */
  private calculateSecurityMetric(): number {
    // Simplified security score based on alerts
    const criticalAlerts = this.systemStatus.alerts.critical;
    return Math.max(0, 100 - (criticalAlerts * 20));
  }

  /**
   * Calculate reliability metric
   */
  private calculateReliabilityMetric(): number {
    const uptime = this.systemStatus.overall.uptime;
    const targetUptime = 24 * 30; // 30 days
    return Math.min(100, (uptime / targetUptime) * 100);
  }

  /**
   * Calculate trends
   */
  private calculateTrends(): Record<string, any> {
    // Simplified trend calculation
    return {
      availability: { direction: 'stable', change: 0, confidence: 0.8 },
      performance: { direction: 'stable', change: 0, confidence: 0.8 },
      cost: { direction: 'down', change: -5, confidence: 0.7 },
      efficiency: { direction: 'up', change: 2, confidence: 0.9 }
    };
  }

  /**
   * Log system overview
   */
  private logSystemOverview(): void {
    logger.info(`
 AI Job Chommie Monitoring Dashboard
=====================================
 Systems Status:
   • Expense Tracker: ACTIVE
   • Reliability Manager: ACTIVE  
   • Error Prevention: ACTIVE
   • Maintenance Engine: ACTIVE
   • Service Monitor: ACTIVE
   • Cost Optimizer: ACTIVE

 Key Metrics:
   • Overall Health Score: ${this.systemStatus.overall.score}/100
   • Services Monitored: ${this.systemStatus.systems.services.externalServices}
   • Budget Utilization: ${this.systemStatus.systems.expenses.utilizationPercent.toFixed(1)}%
   • Cost Efficiency: ${this.systemStatus.systems.costOptimization.costEfficiencyScore}/100

 Alert Summary:
   • Critical: ${this.systemStatus.alerts.critical}
   • High: ${this.systemStatus.alerts.high}
   • Medium: ${this.systemStatus.alerts.medium}
   • Total: ${this.systemStatus.alerts.total}

 Active Recommendations: ${this.systemStatus.recommendations.total}
=====================================
 All systems operational and monitoring!
    `);
  }

  /**
   * Get current system status
   */
  public getSystemStatus(): MasterMonitoringStatus {
    return { ...this.systemStatus };
  }

  /**
   * Get system health summary
   */
  public getHealthSummary(): {
    status: string;
    score: number;
    uptime: string;
    criticalIssues: number;
    recommendations: number;
  } {
    const uptimeHours = this.systemStatus.overall.uptime;
    const uptimeStr = uptimeHours > 24 ? 
      `${Math.floor(uptimeHours / 24)}d ${Math.floor(uptimeHours % 24)}h` :
      `${Math.floor(uptimeHours)}h ${Math.floor((uptimeHours % 1) * 60)}m`;

    return {
      status: this.systemStatus.overall.status,
      score: Math.round(this.systemStatus.overall.score),
      uptime: uptimeStr,
      criticalIssues: this.systemStatus.alerts.critical + this.systemStatus.alerts.high,
      recommendations: this.systemStatus.recommendations.total
    };
  }

  /**
   * Get subsystem instances for direct access
   */
  public getSubsystems() {
    return {
      expenseTracker: this.expenseTracker,
      reliabilityManager: this.reliabilityManager,
      errorPrevention: this.errorPrevention,
      maintenanceEngine: this.maintenanceEngine,
      maintenanceScheduler: this.maintenanceScheduler,
      serviceMonitor: this.serviceMonitor,
      costOptimizer: this.costOptimizer
    };
  }

  /**
   * Force health check
   */
  public async forceHealthCheck(): Promise<void> {
    await this.performHealthCheck();
  }

  /**
   * Get running status
   */
  public isSystemRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const masterMonitor = new MasterMonitor();
export default MasterMonitor;
