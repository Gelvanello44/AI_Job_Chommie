/**
 * prevention_monitor.ts - Preventive Maintenance Engine
 * Integrates error prevention system with reliability monitoring for comprehensive maintenance
 */

import { EventEmitter } from 'events';
import cron from 'node-cron';
import { ErrorPreventionSystem } from './error_prevention.js';
import { SystemReliabilityManager } from '../reliability/SystemReliabilityManager.js';
import logger from '../../config/logger.js';

export interface MaintenanceSchedule {
  id: string;
  name: string;
  description: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  cronPattern: string;
  category: 'preventive' | 'predictive' | 'corrective';
  priority: 'low' | 'medium' | 'high' | 'critical';
  automated: boolean;
  actions: MaintenanceAction[];
  dependencies: string[];
  estimatedDuration: number; // in minutes
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
}

export interface MaintenanceAction {
  id: string;
  type: 'script' | 'api_call' | 'database_query' | 'file_operation' | 'service_restart';
  description: string;
  command?: string;
  parameters: Record<string, any>;
  timeout: number; // in seconds
  retries: number;
  rollbackAction?: MaintenanceAction;
}

export interface MaintenanceExecution {
  id: string;
  scheduleId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  actions: Array<{
    actionId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: Date;
    endTime?: Date;
    result?: any;
    error?: string;
  }>;
  logs: string[];
  metrics: Record<string, number>;
}

export interface SystemHealthScore {
  overall: number;
  components: Record<string, number>;
  trends: Record<string, 'improving' | 'degrading' | 'stable'>;
  riskFactors: Array<{
    component: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impact: number;
    mitigation: string[];
  }>;
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: 'performance' | 'reliability' | 'security' | 'maintenance';
    description: string;
    actions: string[];
    timeline: string;
  }>;
}

export class PreventiveMaintenanceEngine extends EventEmitter {
  private errorPrevention: ErrorPreventionSystem;
  private reliabilityManager: SystemReliabilityManager;
  private maintenanceSchedules: Map<string, MaintenanceSchedule> = new Map();
  private executionHistory: Map<string, MaintenanceExecution> = new Map();
  private cronJobs: Map<string, any> = new Map();
  private healthHistory: SystemHealthScore[] = [];
  private isRunning: boolean = false;

  // Configuration
  private readonly MAX_EXECUTION_HISTORY = 1000;
  private readonly HEALTH_ASSESSMENT_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly TREND_ANALYSIS_WINDOW = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    super();
    this.errorPrevention = new ErrorPreventionSystem();
    this.reliabilityManager = new SystemReliabilityManager();
    this.setupEventListeners();
    this.initializeMaintenanceSchedules();
  }

  /**
   * Start preventive maintenance engine
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    logger.info('Starting preventive maintenance engine');

    // Start underlying systems
    await this.errorPrevention.start();
    await this.reliabilityManager.start();

    // Schedule maintenance tasks
    this.scheduleMaintenanceTasks();

    // Start health assessment
    setInterval(() => {
      this.assessSystemHealth();
    }, this.HEALTH_ASSESSMENT_INTERVAL);

    // Start trend analysis
    setInterval(() => {
      this.analyzeTrends();
    }, this.TREND_ANALYSIS_WINDOW / 24); // Every hour

    this.isRunning = true;
    this.emit('started');

    logger.info('Preventive maintenance engine started');
  }

  /**
   * Stop preventive maintenance engine
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('Stopping preventive maintenance engine');

    // Stop cron jobs
    for (const [scheduleId, job] of this.cronJobs) {
      job.stop();
      logger.debug(`Stopped maintenance job: ${scheduleId}`);
    }

    // Stop underlying systems
    await this.errorPrevention.stop();
    await this.reliabilityManager.stop();

    this.isRunning = false;
    this.emit('stopped');

    logger.info('Preventive maintenance engine stopped');
  }

  /**
   * Setup event listeners for integrated systems
   */
  private setupEventListeners(): void {
    // Error prevention system events
    this.errorPrevention.on('maintenanceAlert', (alert) => {
      this.handleMaintenanceAlert(alert);
    });

    this.errorPrevention.on('patternAlert', (alert) => {
      this.handlePatternAlert(alert);
    });

    this.errorPrevention.on('diagnosticAlert', (alert) => {
      this.handleDiagnosticAlert(alert);
    });

    // Reliability manager events
    this.reliabilityManager.on('serviceDown', (service) => {
      this.handleServiceDown(service);
    });

    this.reliabilityManager.on('performanceDegraded', (metric) => {
      this.handlePerformanceDegraded(metric);
    });

    this.reliabilityManager.on('alertGenerated', (alert) => {
      this.handleReliabilityAlert(alert);
    });
  }

  /**
   * Initialize default maintenance schedules
   */
  private initializeMaintenanceSchedules(): void {
    const schedules: MaintenanceSchedule[] = [
      {
        id: 'daily_health_check',
        name: 'Daily System Health Check',
        description: 'Comprehensive daily system health assessment',
        frequency: 'daily',
        cronPattern: '0 6 * * *', // 6 AM daily
        category: 'preventive',
        priority: 'medium',
        automated: true,
        actions: [
          {
            id: 'run_diagnostics',
            type: 'api_call',
            description: 'Run comprehensive diagnostics',
            parameters: { comprehensive: true },
            timeout: 300,
            retries: 2
          },
          {
            id: 'check_error_patterns',
            type: 'api_call',
            description: 'Analyze error patterns',
            parameters: { timeframe: '24h' },
            timeout: 120,
            retries: 1
          },
          {
            id: 'generate_health_report',
            type: 'script',
            description: 'Generate daily health report',
            command: 'generateHealthReport',
            parameters: { format: 'json', include_trends: true },
            timeout: 60,
            retries: 1
          }
        ],
        dependencies: [],
        estimatedDuration: 15,
        enabled: true
      },
      {
        id: 'weekly_maintenance',
        name: 'Weekly System Maintenance',
        description: 'Weekly maintenance tasks including cleanup and optimization',
        frequency: 'weekly',
        cronPattern: '0 3 * * 0', // 3 AM every Sunday
        category: 'preventive',
        priority: 'high',
        automated: true,
        actions: [
          {
            id: 'log_cleanup',
            type: 'script',
            description: 'Clean up old log files',
            command: 'cleanupLogs',
            parameters: { retention_days: 30 },
            timeout: 300,
            retries: 2
          },
          {
            id: 'database_maintenance',
            type: 'database_query',
            description: 'Database maintenance tasks',
            parameters: { 
              operations: ['analyze', 'vacuum', 'reindex'],
              tables: ['logs', 'metrics', 'events']
            },
            timeout: 1800,
            retries: 1
          },
          {
            id: 'cache_cleanup',
            type: 'api_call',
            description: 'Clear expired cache entries',
            parameters: { cleanup_expired: true },
            timeout: 180,
            retries: 2
          },
          {
            id: 'performance_analysis',
            type: 'script',
            description: 'Weekly performance analysis',
            command: 'analyzeWeeklyPerformance',
            parameters: { generate_report: true },
            timeout: 300,
            retries: 1
          }
        ],
        dependencies: ['daily_health_check'],
        estimatedDuration: 45,
        enabled: true
      },
      {
        id: 'monthly_optimization',
        name: 'Monthly System Optimization',
        description: 'Monthly optimization and capacity planning',
        frequency: 'monthly',
        cronPattern: '0 2 1 * *', // 2 AM on 1st of every month
        category: 'predictive',
        priority: 'high',
        automated: true,
        actions: [
          {
            id: 'capacity_analysis',
            type: 'script',
            description: 'Analyze system capacity trends',
            command: 'analyzeCapacityTrends',
            parameters: { forecast_months: 3 },
            timeout: 600,
            retries: 1
          },
          {
            id: 'cost_optimization',
            type: 'api_call',
            description: 'Generate cost optimization recommendations',
            parameters: { analyze_usage: true, suggest_alternatives: true },
            timeout: 300,
            retries: 2
          },
          {
            id: 'security_audit',
            type: 'script',
            description: 'Monthly security audit',
            command: 'runSecurityAudit',
            parameters: { comprehensive: true },
            timeout: 900,
            retries: 1
          },
          {
            id: 'backup_verification',
            type: 'script',
            description: 'Verify backup integrity',
            command: 'verifyBackups',
            parameters: { test_restore: true },
            timeout: 1800,
            retries: 1
          }
        ],
        dependencies: ['weekly_maintenance'],
        estimatedDuration: 90,
        enabled: true
      },
      {
        id: 'emergency_response_test',
        name: 'Emergency Response Test',
        description: 'Test emergency response procedures',
        frequency: 'monthly',
        cronPattern: '0 4 15 * *', // 4 AM on 15th of every month
        category: 'corrective',
        priority: 'medium',
        automated: false, // Manual approval required
        actions: [
          {
            id: 'test_failover',
            type: 'script',
            description: 'Test system failover procedures',
            command: 'testFailover',
            parameters: { simulation: true },
            timeout: 300,
            retries: 0, // No retries for tests
            rollbackAction: {
              id: 'restore_primary',
              type: 'script',
              description: 'Restore primary system',
              command: 'restorePrimary',
              parameters: {},
              timeout: 180,
              retries: 2
            }
          },
          {
            id: 'test_backup_restore',
            type: 'script',
            description: 'Test backup restoration',
            command: 'testBackupRestore',
            parameters: { test_environment: true },
            timeout: 600,
            retries: 0
          }
        ],
        dependencies: [],
        estimatedDuration: 60,
        enabled: true
      }
    ];

    schedules.forEach(schedule => {
      this.maintenanceSchedules.set(schedule.id, schedule);
    });

    logger.info(`Initialized ${schedules.length} maintenance schedules`);
  }

  /**
   * Schedule maintenance tasks using cron
   */
  private scheduleMaintenanceTasks(): void {
    for (const [scheduleId, schedule] of this.maintenanceSchedules) {
      if (!schedule.enabled) continue;

      const job = cron.schedule(schedule.cronPattern, async () => {
        await this.executeMaintenance(scheduleId);
      }, {
        timezone: 'UTC'
      });

      // Calculate next run time
      schedule.nextRun = this.getNextRunTime(schedule.cronPattern);

      this.cronJobs.set(scheduleId, job);
      job.start();

      logger.debug(`Scheduled maintenance task: ${schedule.name}`);
    }

    logger.info(`Scheduled ${this.cronJobs.size} maintenance tasks`);
  }

  /**
   * Execute maintenance schedule
   */
  private async executeMaintenance(scheduleId: string): Promise<void> {
    const schedule = this.maintenanceSchedules.get(scheduleId);
    if (!schedule) {
      logger.error(`Maintenance schedule not found: ${scheduleId}`);
      return;
    }

    const executionId = `exec_${Date.now()}_${scheduleId}`;
    const execution: MaintenanceExecution = {
      id: executionId,
      scheduleId,
      startTime: new Date(),
      status: 'running',
      actions: schedule.actions.map(action => ({
        actionId: action.id,
        status: 'pending'
      })),
      logs: [],
      metrics: {}
    };

    this.executionHistory.set(executionId, execution);
    schedule.lastRun = new Date();

    logger.info(`Starting maintenance execution: ${schedule.name}`, { executionId });

    try {
      // Check dependencies
      if (schedule.dependencies.length > 0) {
        const dependenciesMet = await this.checkDependencies(schedule.dependencies);
        if (!dependenciesMet) {
          throw new Error('Dependencies not met');
        }
      }

      // Execute actions sequentially
      for (let i = 0; i < schedule.actions.length; i++) {
        const action = schedule.actions[i];
        const actionStatus = execution.actions[i];

        actionStatus.status = 'running';
        actionStatus.startTime = new Date();

        try {
          const result = await this.executeMaintenanceAction(action);
          actionStatus.result = result;
          actionStatus.status = 'completed';
          execution.logs.push(`Action ${action.id} completed successfully`);
        } catch (error) {
          actionStatus.error = error instanceof Error ? error.message : 'Unknown error';
          actionStatus.status = 'failed';
          execution.logs.push(`Action ${action.id} failed: ${actionStatus.error}`);

          // Execute rollback if available
          if (action.rollbackAction) {
            try {
              await this.executeMaintenanceAction(action.rollbackAction);
              execution.logs.push(`Rollback for ${action.id} completed`);
            } catch (rollbackError) {
              execution.logs.push(`Rollback for ${action.id} failed: ${rollbackError}`);
            }
          }

          // Stop execution if critical action fails
          if (schedule.priority === 'critical') {
            throw error;
          }
        } finally {
          actionStatus.endTime = new Date();
        }
      }

      execution.status = 'completed';
      execution.endTime = new Date();

      logger.info(`Maintenance execution completed: ${schedule.name}`, {
        executionId,
        duration: execution.endTime.getTime() - execution.startTime.getTime()
      });

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.logs.push(`Execution failed: ${error}`);

      logger.error(`Maintenance execution failed: ${schedule.name}`, {
        executionId,
        error: error instanceof Error ? error.message : error
      });

      // Emit alert for failed critical maintenance
      if (schedule.priority === 'critical') {
        this.emit('maintenanceFailure', {
          scheduleId,
          execution,
          error
        });
      }
    }

    // Update next run time
    schedule.nextRun = this.getNextRunTime(schedule.cronPattern);

    // Clean up old executions
    if (this.executionHistory.size > this.MAX_EXECUTION_HISTORY) {
      const oldestKeys = Array.from(this.executionHistory.keys())
        .sort()
        .slice(0, this.executionHistory.size - this.MAX_EXECUTION_HISTORY);
      
      oldestKeys.forEach(key => this.executionHistory.delete(key));
    }

    this.emit('maintenanceCompleted', { scheduleId, execution });
  }

  /**
   * Execute individual maintenance action
   */
  private async executeMaintenanceAction(action: MaintenanceAction): Promise<any> {
    let attempt = 0;
    const maxAttempts = action.retries + 1;

    while (attempt < maxAttempts) {
      try {
        switch (action.type) {
          case 'script':
            return await this.executeScript(action);
          case 'api_call':
            return await this.executeApiCall(action);
          case 'database_query':
            return await this.executeDatabaseQuery(action);
          case 'file_operation':
            return await this.executeFileOperation(action);
          case 'service_restart':
            return await this.executeServiceRestart(action);
          default:
            throw new Error(`Unknown action type: ${action.type}`);
        }
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Execute script action
   */
  private async executeScript(action: MaintenanceAction): Promise<any> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const process = spawn('node', ['-e', `
        const { ${action.command} } = require('./maintenance-scripts');
        ${action.command}(${JSON.stringify(action.parameters)})
          .then(result => console.log(JSON.stringify(result)))
          .catch(error => {
            console.error(error.message);
            process.exit(1);
          });
      `]);

      let output = '';
      let error = '';

      process.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      process.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });

      const timeout = setTimeout(() => {
        process.kill();
        reject(new Error(`Script timeout: ${action.command}`));
      }, action.timeout * 1000);

      process.on('close', (code: number) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          try {
            resolve(JSON.parse(output));
          } catch {
            resolve(output);
          }
        } else {
          reject(new Error(error || `Script failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Execute API call action
   */
  private async executeApiCall(action: MaintenanceAction): Promise<any> {
    // Simulate API calls to maintenance endpoints
    switch (action.description) {
      case 'Run comprehensive diagnostics':
        return await this.errorPrevention.performDiagnostics();
      
      case 'Analyze error patterns':
        return this.errorPrevention.getErrorPatternsSummary();
      
      case 'Generate cost optimization recommendations':
        return { recommendations: ['Optimize database queries', 'Review API usage'] };
      
      case 'Clear expired cache entries':
        return { cleared: Math.floor(Math.random() * 1000) };
      
      default:
        return { success: true, message: 'Action completed' };
    }
  }

  /**
   * Execute database query action
   */
  private async executeDatabaseQuery(action: MaintenanceAction): Promise<any> {
    // Simulate database maintenance operations
    const operations = action.parameters.operations || [];
    const results: Record<string, any> = {};

    for (const operation of operations) {
      switch (operation) {
        case 'analyze':
          results[operation] = { tablesAnalyzed: 5, duration: 30 };
          break;
        case 'vacuum':
          results[operation] = { spaceReclaimed: '125MB', duration: 120 };
          break;
        case 'reindex':
          results[operation] = { indexesRebuilt: 15, duration: 90 };
          break;
      }
    }

    return results;
  }

  /**
   * Execute file operation action
   */
  private async executeFileOperation(action: MaintenanceAction): Promise<any> {
    // Simulate file operations
    return {
      success: true,
      filesProcessed: Math.floor(Math.random() * 100),
      sizeProcessed: `${Math.floor(Math.random() * 500)}MB`
    };
  }

  /**
   * Execute service restart action
   */
  private async executeServiceRestart(action: MaintenanceAction): Promise<any> {
    // Simulate service restart
    const serviceName = action.parameters.service || 'unknown';
    
    return {
      service: serviceName,
      restartTime: new Date(),
      success: true,
      startupDuration: Math.floor(Math.random() * 30) + 5
    };
  }

  /**
   * Check if dependencies are met
   */
  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    for (const depId of dependencies) {
      const schedule = this.maintenanceSchedules.get(depId);
      if (!schedule || !schedule.lastRun) {
        logger.warn(`Dependency not met: ${depId}`);
        return false;
      }

      // Check if dependency ran within acceptable timeframe
      const maxAge = 25 * 60 * 60 * 1000; // 25 hours for daily tasks
      if (Date.now() - schedule.lastRun.getTime() > maxAge) {
        logger.warn(`Dependency too old: ${depId}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get next run time for cron pattern
   */
  private getNextRunTime(cronPattern: string): Date {
    const cronParser = require('cron-parser');
    try {
      const interval = cronParser.parseExpression(cronPattern);
      return interval.next().toDate();
    } catch (error) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 24 hours
    }
  }

  /**
   * Assess overall system health
   */
  private async assessSystemHealth(): Promise<SystemHealthScore> {
    logger.debug('Assessing system health');

    try {
      // Get diagnostics from error prevention system
      const diagnosticSummary = this.errorPrevention.getDiagnosticSummary();
      const errorPatterns = this.errorPrevention.getErrorPatternsSummary();
      const maintenanceAlerts = this.errorPrevention.getActiveMaintenanceAlerts();

      // Get reliability metrics
      const reliabilityHealth = await this.reliabilityManager.getHealthSummary();

      // Calculate component scores
      const componentScores: Record<string, number> = {
        ...diagnosticSummary.componentScores,
        reliability: this.calculateReliabilityScore(reliabilityHealth),
        maintenance: this.calculateMaintenanceScore()
      };

      // Calculate overall score
      const overall = Object.values(componentScores).reduce((sum, score) => sum + score, 0) 
        / Object.values(componentScores).length;

      // Analyze trends
      const trends = this.calculateHealthTrends(componentScores);

      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(componentScores, errorPatterns, maintenanceAlerts);

      // Generate recommendations
      const recommendations = this.generateHealthRecommendations(componentScores, riskFactors);

      const healthScore: SystemHealthScore = {
        overall,
        components: componentScores,
        trends,
        riskFactors,
        recommendations
      };

      // Add to history
      this.healthHistory.push(healthScore);

      // Keep history within limits
      if (this.healthHistory.length > 1000) {
        this.healthHistory = this.healthHistory.slice(-1000);
      }

      this.emit('healthAssessment', healthScore);

      return healthScore;

    } catch (error) {
      logger.error('Health assessment failed', { error });
      throw error;
    }
  }

  /**
   * Calculate reliability score from health status
   */
  private calculateReliabilityScore(healthStatus: any): number {
    if (!healthStatus || !healthStatus.services) return 50;

    const services = Object.values(healthStatus.services) as any[];
    const healthyServices = services.filter(s => s.status === 'healthy').length;
    
    return (healthyServices / services.length) * 100;
  }

  /**
   * Calculate maintenance score based on recent executions
   */
  private calculateMaintenanceScore(): number {
    const recentExecutions = Array.from(this.executionHistory.values())
      .filter(exec => Date.now() - exec.startTime.getTime() < 7 * 24 * 60 * 60 * 1000);

    if (recentExecutions.length === 0) return 75; // Default score

    const successfulExecutions = recentExecutions.filter(exec => exec.status === 'completed');
    return (successfulExecutions.length / recentExecutions.length) * 100;
  }

  /**
   * Calculate health trends
   */
  private calculateHealthTrends(currentScores: Record<string, number>): Record<string, 'improving' | 'degrading' | 'stable'> {
    const trends: Record<string, any> = {};
    
    // Need historical data for trend calculation
    if (this.healthHistory.length < 3) {
      Object.keys(currentScores).forEach(component => {
        trends[component] = 'stable';
      });
      return trends;
    }

    const previousScores = this.healthHistory[this.healthHistory.length - 1].components;
    
    for (const component of Object.keys(currentScores)) {
      const current = currentScores[component] || 0;
      const previous = previousScores[component] || 0;
      const diff = current - previous;

      if (Math.abs(diff) < 5) trends[component] = 'stable';
      else if (diff > 0) trends[component] = 'improving';
      else trends[component] = 'degrading';
    }

    return trends;
  }

  /**
   * Identify system risk factors
   */
  private identifyRiskFactors(
    componentScores: Record<string, number>,
    errorPatterns: any[],
    maintenanceAlerts: any[]
  ): SystemHealthScore['riskFactors'] {
    const riskFactors: SystemHealthScore['riskFactors'] = [];

    // Component-based risks
    for (const [component, score] of Object.entries(componentScores)) {
      if (score < 60) {
        riskFactors.push({
          component,
          risk: score < 30 ? 'critical' : score < 50 ? 'high' : 'medium',
          description: `${component} health score is low (${score.toFixed(1)})`,
          impact: (60 - score) / 10,
          mitigation: [
            `Investigate ${component} issues`,
            `Review ${component} configuration`,
            `Consider ${component} scaling`
          ]
        });
      }
    }

    // Error pattern risks
    const criticalPatterns = errorPatterns.filter(p => p.pattern.severity === 'critical' && p.recentFrequency > 0);
    for (const pattern of criticalPatterns) {
      riskFactors.push({
        component: pattern.pattern.category,
        risk: pattern.recentFrequency > 10 ? 'critical' : 'high',
        description: `Critical error pattern: ${pattern.pattern.name} (${pattern.recentFrequency} occurrences)`,
        impact: Math.min(pattern.recentFrequency / 5, 10),
        mitigation: pattern.pattern.preventionMeasures
      });
    }

    // Maintenance alert risks
    const criticalAlerts = maintenanceAlerts.filter((a: any) => a.priority === 'critical');
    for (const alert of criticalAlerts) {
      riskFactors.push({
        component: alert.component,
        risk: 'critical',
        description: alert.description,
        impact: 8,
        mitigation: alert.recommendations
      });
    }

    return riskFactors.sort((a, b) => {
      const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return riskOrder[b.risk] - riskOrder[a.risk];
    });
  }

  /**
   * Generate health-based recommendations
   */
  private generateHealthRecommendations(
    componentScores: Record<string, number>,
    riskFactors: SystemHealthScore['riskFactors']
  ): SystemHealthScore['recommendations'] {
    const recommendations: SystemHealthScore['recommendations'] = [];

    // Critical risk recommendations
    const criticalRisks = riskFactors.filter(r => r.risk === 'critical');
    if (criticalRisks.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'reliability',
        description: `Address ${criticalRisks.length} critical system risks immediately`,
        actions: criticalRisks.flatMap(r => r.mitigation),
        timeline: 'immediate'
      });
    }

    // Low component scores
    const lowScoreComponents = Object.entries(componentScores)
      .filter(([_, score]) => score < 70)
      .map(([component]) => component);

    if (lowScoreComponents.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        description: `Improve health of underperforming components: ${lowScoreComponents.join(', ')}`,
        actions: [
          'Run comprehensive diagnostics',
          'Review system resources',
          'Optimize configurations',
          'Consider scaling'
        ],
        timeline: 'within 24 hours'
      });
    }

    // Maintenance recommendations
    const failedMaintenanceTasks = Array.from(this.executionHistory.values())
      .filter(exec => exec.status === 'failed' && 
        Date.now() - exec.startTime.getTime() < 7 * 24 * 60 * 60 * 1000);

    if (failedMaintenanceTasks.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'maintenance',
        description: `Review and retry ${failedMaintenanceTasks.length} failed maintenance tasks`,
        actions: [
          'Investigate failure causes',
          'Fix underlying issues',
          'Retry failed tasks',
          'Update maintenance procedures'
        ],
        timeline: 'within 48 hours'
      });
    }

    return recommendations;
  }

  /**
   * Analyze trends for predictive maintenance
   */
  private async analyzeTrends(): Promise<void> {
    if (this.healthHistory.length < 10) return; // Need sufficient data

    logger.debug('Analyzing system trends for predictive maintenance');

    // Analyze component trends
    const componentTrends = this.analyzeComponentTrends();
    
    // Generate predictive alerts
    for (const [component, trend] of Object.entries(componentTrends)) {
      if (trend.prediction === 'failure' && trend.confidence > 0.7) {
        await this.generatePredictiveAlert(component, trend);
      }
    }

    this.emit('trendAnalysisCompleted', componentTrends);
  }

  /**
   * Analyze component trends
   */
  private analyzeComponentTrends(): Record<string, any> {
    const trends: Record<string, any> = {};
    const recentHistory = this.healthHistory.slice(-20); // Last 20 assessments

    // Get all components
    const allComponents = new Set<string>();
    recentHistory.forEach(h => {
      Object.keys(h.components).forEach(comp => allComponents.add(comp));
    });

    for (const component of allComponents) {
      const scores = recentHistory
        .map(h => h.components[component] || 0)
        .filter(score => score > 0);

      if (scores.length < 5) continue; // Need minimum data points

      // Simple trend analysis
      const first = scores.slice(0, Math.floor(scores.length / 2));
      const second = scores.slice(Math.floor(scores.length / 2));
      
      const firstAvg = first.reduce((sum, score) => sum + score, 0) / first.length;
      const secondAvg = second.reduce((sum, score) => sum + score, 0) / second.length;
      
      const trendDirection = secondAvg > firstAvg ? 'improving' : 
                            secondAvg < firstAvg ? 'degrading' : 'stable';
      
      const slope = (secondAvg - firstAvg) / (scores.length / 2);
      
      // Predict failure if strong degrading trend
      let prediction = 'stable';
      let confidence = 0;
      
      if (trendDirection === 'degrading' && Math.abs(slope) > 5) {
        const stepsToFailure = (secondAvg - 30) / Math.abs(slope); // Predict failure at score 30
        if (stepsToFailure < 10) { // Less than 10 assessment periods
          prediction = 'failure';
          confidence = Math.min(0.9, Math.abs(slope) / 20);
        }
      }

      trends[component] = {
        direction: trendDirection,
        slope,
        prediction,
        confidence,
        currentScore: scores[scores.length - 1],
        averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length
      };
    }

    return trends;
  }

  /**
   * Generate predictive maintenance alert
   */
  private async generatePredictiveAlert(component: string, trend: any): Promise<void> {
    const alertId = `predictive_${Date.now()}_${component}`;
    
    const alert = {
      id: alertId,
      type: 'predictive',
      priority: 'high',
      component,
      description: `Predictive alert: ${component} showing degrading trend (confidence: ${(trend.confidence * 100).toFixed(1)}%)`,
      predictions: {
        direction: trend.direction,
        confidence: trend.confidence,
        estimatedFailureTime: trend.stepsToFailure ? 
          new Date(Date.now() + trend.stepsToFailure * this.HEALTH_ASSESSMENT_INTERVAL) : null
      },
      recommendations: [
        `Investigate ${component} performance issues`,
        `Review ${component} resource utilization`,
        `Plan proactive maintenance for ${component}`,
        'Consider scaling or optimization'
      ],
      timestamp: new Date()
    };

    logger.warn('Predictive maintenance alert generated', alert);
    this.emit('predictiveAlert', alert);
  }

  // Event handlers for integrated systems

  private async handleMaintenanceAlert(alert: any): Promise<void> {
    logger.info('Handling maintenance alert', { alertId: alert.id });

    // Schedule immediate maintenance if critical
    if (alert.priority === 'critical') {
      await this.scheduleEmergencyMaintenance(alert);
    }
  }

  private async handlePatternAlert(alert: any): Promise<void> {
    logger.info('Handling pattern alert', { alertId: alert.id });

    // Add pattern-specific maintenance task
    const maintenanceActions = this.generatePatternMaintenanceActions(alert);
    if (maintenanceActions.length > 0) {
      await this.scheduleAdHocMaintenance(alert.component, maintenanceActions);
    }
  }

  private async handleDiagnosticAlert(alert: any): Promise<void> {
    logger.info('Handling diagnostic alert', { alertId: alert.id });

    // Schedule diagnostic-specific maintenance
    if (alert.priority === 'critical') {
      await this.scheduleEmergencyMaintenance(alert);
    }
  }

  private async handleServiceDown(service: any): Promise<void> {
    logger.error('Service down detected', { service });

    // Trigger emergency maintenance
    await this.scheduleEmergencyMaintenance({
      component: 'reliability',
      description: `Service down: ${service.name}`,
      priority: 'critical',
      recommendations: ['Restart service', 'Check dependencies', 'Review logs']
    });
  }

  private async handlePerformanceDegraded(metric: any): Promise<void> {
    logger.warn('Performance degradation detected', { metric });
    
    // Schedule performance optimization maintenance
    await this.scheduleAdHocMaintenance('performance', [
      {
        id: 'performance_optimization',
        type: 'script',
        description: `Optimize performance for ${metric.name}`,
        command: 'optimizePerformance',
        parameters: { metric: metric.name, threshold: metric.threshold },
        timeout: 300,
        retries: 2
      }
    ]);
  }

  private async handleReliabilityAlert(alert: any): Promise<void> {
    logger.info('Handling reliability alert', { alertId: alert.id });

    if (alert.severity === 'critical') {
      await this.scheduleEmergencyMaintenance(alert);
    }
  }

  /**
   * Schedule emergency maintenance
   */
  private async scheduleEmergencyMaintenance(alert: any): Promise<void> {
    const scheduleId = `emergency_${Date.now()}_${alert.component}`;
    
    const emergencySchedule: MaintenanceSchedule = {
      id: scheduleId,
      name: `Emergency Maintenance - ${alert.component}`,
      description: alert.description,
      frequency: 'daily', // Placeholder
      cronPattern: '* * * * *', // Immediate
      category: 'corrective',
      priority: 'critical',
      automated: true,
      actions: this.generateEmergencyActions(alert),
      dependencies: [],
      estimatedDuration: 30,
      enabled: true
    };

    this.maintenanceSchedules.set(scheduleId, emergencySchedule);

    // Execute immediately
    setImmediate(() => this.executeMaintenance(scheduleId));

    logger.warn('Emergency maintenance scheduled', { scheduleId, component: alert.component });
  }

  /**
   * Schedule ad-hoc maintenance
   */
  private async scheduleAdHocMaintenance(component: string, actions: MaintenanceAction[]): Promise<void> {
    const scheduleId = `adhoc_${Date.now()}_${component}`;
    
    const adhocSchedule: MaintenanceSchedule = {
      id: scheduleId,
      name: `Ad-hoc Maintenance - ${component}`,
      description: `Targeted maintenance for ${component}`,
      frequency: 'daily', // Placeholder
      cronPattern: '* * * * *', // Immediate
      category: 'corrective',
      priority: 'medium',
      automated: true,
      actions,
      dependencies: [],
      estimatedDuration: 15,
      enabled: true
    };

    this.maintenanceSchedules.set(scheduleId, adhocSchedule);

    // Execute with slight delay to avoid overwhelming the system
    setTimeout(() => this.executeMaintenance(scheduleId), 5000);

    logger.info('Ad-hoc maintenance scheduled', { scheduleId, component });
  }

  /**
   * Generate emergency maintenance actions
   */
  private generateEmergencyActions(alert: any): MaintenanceAction[] {
    const actions: MaintenanceAction[] = [
      {
        id: 'emergency_diagnostic',
        type: 'api_call',
        description: `Emergency diagnostic for ${alert.component}`,
        parameters: { component: alert.component, emergency: true },
        timeout: 120,
        retries: 1
      }
    ];

    // Add specific actions based on alert recommendations
    if (alert.recommendations) {
      alert.recommendations.forEach((rec: string, index: number) => {
        actions.push({
          id: `emergency_action_${index}`,
          type: 'script',
          description: rec,
          command: 'executeEmergencyAction',
          parameters: { action: rec, component: alert.component },
          timeout: 180,
          retries: 2
        });
      });
    }

    return actions;
  }

  /**
   * Generate pattern-specific maintenance actions
   */
  private generatePatternMaintenanceActions(alert: any): MaintenanceAction[] {
    // Generate actions based on pattern type and recommendations
    return [
      {
        id: 'pattern_mitigation',
        type: 'script',
        description: `Mitigate pattern: ${alert.description}`,
        command: 'mitigateErrorPattern',
        parameters: { pattern: alert.pattern, component: alert.component },
        timeout: 300,
        retries: 2
      }
    ];
  }

  /**
   * Get maintenance status overview
   */
  public getMaintenanceStatus(): {
    schedules: MaintenanceSchedule[];
    recentExecutions: MaintenanceExecution[];
    healthScore: SystemHealthScore | null;
    upcomingMaintenance: Array<{ schedule: MaintenanceSchedule; nextRun: Date }>;
  } {
    const recentExecutions = Array.from(this.executionHistory.values())
      .filter(exec => Date.now() - exec.startTime.getTime() < 24 * 60 * 60 * 1000)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    const upcomingMaintenance = Array.from(this.maintenanceSchedules.values())
      .filter(schedule => schedule.enabled && schedule.nextRun)
      .map(schedule => ({ schedule, nextRun: schedule.nextRun! }))
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());

    const healthScore = this.healthHistory.length > 0 
      ? this.healthHistory[this.healthHistory.length - 1] 
      : null;

    return {
      schedules: Array.from(this.maintenanceSchedules.values()),
      recentExecutions,
      healthScore,
      upcomingMaintenance
    };
  }

  /**
   * Get system metrics
   */
  public getSystemMetrics(): {
    totalSchedules: number;
    activeSchedules: number;
    executionsToday: number;
    successRate: number;
    overallHealth: number;
    criticalAlerts: number;
  } {
    const totalSchedules = this.maintenanceSchedules.size;
    const activeSchedules = Array.from(this.maintenanceSchedules.values())
      .filter(s => s.enabled).length;

    const today = new Date().toDateString();
    const executionsToday = Array.from(this.executionHistory.values())
      .filter(exec => exec.startTime.toDateString() === today).length;

    const recentExecutions = Array.from(this.executionHistory.values())
      .filter(exec => Date.now() - exec.startTime.getTime() < 7 * 24 * 60 * 60 * 1000);
    
    const successfulExecutions = recentExecutions.filter(exec => exec.status === 'completed').length;
    const successRate = recentExecutions.length > 0 
      ? (successfulExecutions / recentExecutions.length) * 100 
      : 100;

    const healthScore = this.healthHistory.length > 0 
      ? this.healthHistory[this.healthHistory.length - 1] 
      : null;

    const overallHealth = healthScore ? healthScore.overall : 0;
    const criticalAlerts = healthScore 
      ? healthScore.riskFactors.filter(r => r.risk === 'critical').length 
      : 0;

    return {
      totalSchedules,
      activeSchedules,
      executionsToday,
      successRate,
      overallHealth,
      criticalAlerts
    };
  }
}

// Export singleton instance
export const preventiveMaintenanceEngine = new PreventiveMaintenanceEngine();
export default PreventiveMaintenanceEngine;
