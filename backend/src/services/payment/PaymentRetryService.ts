/**
 * Payment Retry and Recovery Service
 * Implements intelligent retry mechanisms with provider fallback for improved transaction success
 */

import { PaymentProviderType, PaymentService } from './PaymentService';
import { paymentHealthMonitor } from './PaymentHealthMonitor';
import { logger } from '../../utils/logger';
import { prisma } from '../../utils/prisma';
import { redis } from '../../config/redis';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  enableProviderFallback: boolean;
  retryableErrors: string[];
}

export interface PaymentAttempt {
  id: string;
  transactionId: string;
  provider: PaymentProviderType;
  attemptNumber: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  errorCode?: string;
  errorMessage?: string;
  responseTime?: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan';
    value: any;
  }>;
  action: 'retry_same_provider' | 'switch_provider' | 'adjust_amount' | 'delay_retry' | 'manual_review';
  parameters?: Record<string, any>;
}

export class PaymentRetryService {
  private paymentService: PaymentService;
  private defaultRetryConfig: RetryConfig;
  private recoveryStrategies: RecoveryStrategy[];

  constructor(paymentService: PaymentService) {
    this.paymentService = paymentService;
    this.defaultRetryConfig = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      enableProviderFallback: true,
      retryableErrors: [
        'NETWORK_ERROR',
        'TIMEOUT',
        'RATE_LIMITED',
        'TEMPORARY_UNAVAILABLE',
        'GATEWAY_ERROR',
        'CONNECTION_REFUSED'
      ]
    };

    this.recoveryStrategies = this.initializeRecoveryStrategies();
  }

  /**
   * Process payment with intelligent retry and recovery
   */
  async processPaymentWithRetry(
    paymentData: {
      amount: number;
      currency: string;
      userId: string;
      description?: string;
      metadata?: Record<string, any>;
    },
    preferredProvider?: PaymentProviderType,
    customConfig?: Partial<RetryConfig>
  ): Promise<{
    success: boolean;
    transaction?: any;
    attempts: PaymentAttempt[];
    finalProvider?: PaymentProviderType;
    totalTime: number;
    recovery?: {
      strategyUsed: string;
      reason: string;
    };
  }> {
    const startTime = Date.now();
    const config = { ...this.defaultRetryConfig, ...customConfig };
    const attempts: PaymentAttempt[] = [];
    
    let currentProvider = preferredProvider || this.paymentService.getOptimalProvider(paymentData.currency);
    let lastError: any = null;

    try {
      // Create initial transaction record
      const transactionId = await this.createRetryTransaction(paymentData, currentProvider);

      for (let attemptNumber = 1; attemptNumber <= config.maxAttempts; attemptNumber++) {
        const attemptId = `${transactionId}-${attemptNumber}`;
        const attemptStartTime = Date.now();

        logger.info('Starting payment attempt', {
          transactionId,
          attemptNumber,
          provider: currentProvider,
          amount: paymentData.amount
        });

        // Record attempt start
        const attempt: PaymentAttempt = {
          id: attemptId,
          transactionId,
          provider: currentProvider,
          attemptNumber,
          status: 'pending',
          createdAt: new Date()
        };
        attempts.push(attempt);

        try {
          // Check provider health before attempting
          const providerHealth = await paymentHealthMonitor.getProviderHealth(currentProvider);
          if (providerHealth && providerHealth.uptime < 95) {
            throw new Error(`Provider ${currentProvider} is experiencing issues (${providerHealth.uptime}% uptime)`);
          }

          // Attempt payment
          const result = await this.attemptPayment(paymentData, currentProvider);
          
          // Update attempt record
          attempt.status = 'success';
          attempt.responseTime = Date.now() - attemptStartTime;
          attempt.completedAt = new Date();

          // Update transaction status
          await this.updateTransactionStatus(transactionId, 'SUCCESS', result);

          logger.info('Payment successful', {
            transactionId,
            attemptNumber,
            provider: currentProvider,
            responseTime: attempt.responseTime
          });

          return {
            success: true,
            transaction: result,
            attempts,
            finalProvider: currentProvider,
            totalTime: Date.now() - startTime
          };

        } catch (error) {
          lastError = error;
          attempt.status = 'failed';
          attempt.errorCode = error.code || 'UNKNOWN_ERROR';
          attempt.errorMessage = error.message;
          attempt.responseTime = Date.now() - attemptStartTime;
          attempt.completedAt = new Date();

          logger.warn('Payment attempt failed', {
            transactionId,
            attemptNumber,
            provider: currentProvider,
            error: error.message,
            errorCode: error.code
          });

          // Check if error is retryable
          if (!this.isRetryableError(error, config)) {
            logger.error('Non-retryable error encountered', {
              transactionId,
              error: error.message,
              errorCode: error.code
            });
            break;
          }

          // Apply recovery strategy
          const recoveryResult = await this.applyRecoveryStrategy(
            error,
            currentProvider,
            attemptNumber,
            paymentData,
            config
          );

          if (recoveryResult.shouldStop) {
            logger.info('Recovery strategy suggests stopping', {
              transactionId,
              strategy: recoveryResult.strategy,
              reason: recoveryResult.reason
            });
            break;
          }

          // Update provider if strategy suggests switching
          if (recoveryResult.newProvider && recoveryResult.newProvider !== currentProvider) {
            logger.info('Switching payment provider', {
              transactionId,
              from: currentProvider,
              to: recoveryResult.newProvider,
              reason: recoveryResult.reason
            });
            currentProvider = recoveryResult.newProvider;
          }

          // Wait before retry (with exponential backoff)
          if (attemptNumber < config.maxAttempts) {
            const delay = Math.min(
              config.baseDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1),
              config.maxDelayMs
            );

            logger.info('Waiting before retry', { transactionId, delay, nextAttempt: attemptNumber + 1 });
            await this.delay(delay);
          }
        }
      }

      // All attempts failed
      await this.updateTransactionStatus(transactionId, 'FAILED', null, lastError);

      logger.error('All payment attempts failed', {
        transactionId,
        totalAttempts: config.maxAttempts,
        totalTime: Date.now() - startTime,
        finalError: lastError?.message
      });

      return {
        success: false,
        attempts,
        finalProvider: currentProvider,
        totalTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Payment retry process failed', {
        error: error.message,
        paymentData: { ...paymentData, userId: '[REDACTED]' }
      });
      throw error;
    }
  }

  /**
   * Recover failed payments in batch
   */
  async recoverFailedPayments(
    batchSize: number = 50,
    maxAge: string = '24h'
  ): Promise<{
    processed: number;
    recovered: number;
    stillFailed: number;
    details: Array<{
      transactionId: string;
      outcome: 'recovered' | 'failed' | 'skipped';
      reason: string;
    }>;
  }> {
    try {
      const cutoffDate = this.getDateFromAge(maxAge);
      
      // Get failed transactions to retry
      const failedTransactions = await prisma.transaction.findMany({
        where: {
          status: 'FAILED',
          createdAt: {
            gte: cutoffDate
          },
          retryCount: {
            lt: this.defaultRetryConfig.maxAttempts
          }
        },
        take: batchSize,
        orderBy: { createdAt: 'desc' }
      });

      const results = {
        processed: 0,
        recovered: 0,
        stillFailed: 0,
        details: [] as Array<any>
      };

      for (const transaction of failedTransactions) {
        results.processed++;

        try {
          // Extract payment data from transaction
          const paymentData = {
            amount: transaction.amount,
            currency: transaction.currency,
            userId: transaction.userId,
            description: transaction.description || undefined,
            metadata: transaction.metadata || undefined
          };

          // Attempt recovery
          const recoveryResult = await this.processPaymentWithRetry(
            paymentData,
            transaction.provider.toLowerCase() as PaymentProviderType,
            { maxAttempts: 2 } // Reduced attempts for batch recovery
          );

          if (recoveryResult.success) {
            results.recovered++;
            results.details.push({
              transactionId: transaction.id,
              outcome: 'recovered',
              reason: `Recovered using ${recoveryResult.finalProvider} after ${recoveryResult.attempts.length} attempts`
            });
          } else {
            results.stillFailed++;
            results.details.push({
              transactionId: transaction.id,
              outcome: 'failed',
              reason: 'All recovery attempts failed'
            });
          }

        } catch (error) {
          results.stillFailed++;
          results.details.push({
            transactionId: transaction.id,
            outcome: 'skipped',
            reason: `Recovery error: ${error.message}`
          });
        }
      }

      logger.info('Batch payment recovery completed', results);
      return results;

    } catch (error) {
      logger.error('Error during batch payment recovery', { error, batchSize, maxAge });
      throw error;
    }
  }

  /**
   * Get retry statistics and insights
   */
  async getRetryStatistics(timeRange: '24h' | '7d' | '30d' = '7d'): Promise<{
    totalRetries: number;
    successfulRetries: number;
    retrySuccessRate: number;
    commonFailureReasons: Array<{ reason: string; count: number; }>;
    providerPerformance: Record<PaymentProviderType, {
      retries: number;
      recoveries: number;
      successRate: number;
    }>;
    averageRecoveryTime: number;
    strategiesUsed: Array<{ strategy: string; usage: number; successRate: number; }>;
  }> {
    try {
      const cutoffDate = this.getDateFromAge(timeRange);

      // Get retry attempts from cache or database
      const retryAttempts = await this.getRetryAttempts(cutoffDate);

      const totalRetries = retryAttempts.length;
      const successfulRetries = retryAttempts.filter(a => a.status === 'success').length;
      const retrySuccessRate = totalRetries > 0 ? (successfulRetries / totalRetries) * 100 : 0;

      // Analyze failure reasons
      const failureReasons: Record<string, number> = {};
      retryAttempts
        .filter(a => a.status === 'failed')
        .forEach(attempt => {
          const reason = attempt.errorCode || 'UNKNOWN';
          failureReasons[reason] = (failureReasons[reason] || 0) + 1;
        });

      const commonFailureReasons = Object.entries(failureReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Provider performance analysis
      const providerPerformance: Record<PaymentProviderType, any> = {
        yoco: { retries: 0, recoveries: 0, successRate: 0 },
        paystack: { retries: 0, recoveries: 0, successRate: 0 }
      };

      retryAttempts.forEach(attempt => {
        const provider = attempt.provider;
        if (provider in providerPerformance) {
          providerPerformance[provider].retries++;
          if (attempt.status === 'success') {
            providerPerformance[provider].recoveries++;
          }
        }
      });

      // Calculate success rates
      Object.keys(providerPerformance).forEach(provider => {
        const perf = providerPerformance[provider as PaymentProviderType];
        perf.successRate = perf.retries > 0 ? (perf.recoveries / perf.retries) * 100 : 0;
      });

      // Calculate average recovery time
      const successfulAttempts = retryAttempts.filter(a => a.status === 'success' && a.responseTime);
      const averageRecoveryTime = successfulAttempts.length > 0 ?
        successfulAttempts.reduce((sum, a) => sum + (a.responseTime || 0), 0) / successfulAttempts.length : 0;

      // Mock strategy usage (would be tracked in real implementation)
      const strategiesUsed = [
        { strategy: 'Provider Switch', usage: 15, successRate: 75 },
        { strategy: 'Exponential Backoff', usage: 42, successRate: 65 },
        { strategy: 'Amount Adjustment', usage: 3, successRate: 90 }
      ];

      return {
        totalRetries,
        successfulRetries,
        retrySuccessRate,
        commonFailureReasons,
        providerPerformance,
        averageRecoveryTime,
        strategiesUsed
      };

    } catch (error) {
      logger.error('Error getting retry statistics', { timeRange, error });
      throw error;
    }
  }

  /**
   * Configure retry behavior for specific error patterns
   */
  async configureRetryStrategy(
    strategy: RecoveryStrategy
  ): Promise<void> {
    try {
      // Store strategy in Redis for quick access
      const strategyKey = `payment:retry:strategy:${strategy.name}`;
      await redis.setex(strategyKey, 3600 * 24, JSON.stringify(strategy));

      // Also store in database for persistence
      await prisma.paymentRetryStrategy.upsert({
        where: { name: strategy.name },
        update: {
          description: strategy.description,
          enabled: strategy.enabled,
          priority: strategy.priority,
          conditions: strategy.conditions,
          action: strategy.action,
          parameters: strategy.parameters || {}
        },
        create: {
          name: strategy.name,
          description: strategy.description,
          enabled: strategy.enabled,
          priority: strategy.priority,
          conditions: strategy.conditions,
          action: strategy.action,
          parameters: strategy.parameters || {}
        }
      });

      // Update local strategies cache
      const existingIndex = this.recoveryStrategies.findIndex(s => s.name === strategy.name);
      if (existingIndex >= 0) {
        this.recoveryStrategies[existingIndex] = strategy;
      } else {
        this.recoveryStrategies.push(strategy);
      }

      // Sort by priority
      this.recoveryStrategies.sort((a, b) => b.priority - a.priority);

      logger.info('Retry strategy configured', { strategyName: strategy.name });
    } catch (error) {
      logger.error('Error configuring retry strategy', { strategy: strategy.name, error });
      throw error;
    }
  }

  /**
   * Get payment recovery recommendations
   */
  async getRecoveryRecommendations(
    transactionId: string
  ): Promise<Array<{
    strategy: string;
    description: string;
    likelihood: number;
    estimatedCost: number;
    timeToRecover: string;
  }>> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { user: true }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const recommendations: Array<any> = [];

      // Analyze failure pattern
      const errorPattern = await this.analyzeFailurePattern(transaction);

      // Provider switch recommendation
      if (errorPattern.providerIssue && this.defaultRetryConfig.enableProviderFallback) {
        const alternativeProvider = transaction.provider.toLowerCase() === 'yoco' ? 'paystack' : 'yoco';
        const altProviderHealth = await paymentHealthMonitor.getProviderHealth(alternativeProvider);

        if (altProviderHealth && altProviderHealth.uptime > 95) {
          recommendations.push({
            strategy: 'Provider Switch',
            description: `Switch to ${alternativeProvider} due to ${transaction.provider} instability`,
            likelihood: 75,
            estimatedCost: 0,
            timeToRecover: '2-5 minutes'
          });
        }
      }

      // Amount adjustment recommendation
      if (errorPattern.amountIssue) {
        recommendations.push({
          strategy: 'Amount Adjustment',
          description: 'Adjust payment amount to avoid processing limits',
          likelihood: 60,
          estimatedCost: 0,
          timeToRecover: '1-2 minutes'
        });
      }

      // Delayed retry recommendation
      if (errorPattern.temporaryIssue) {
        recommendations.push({
          strategy: 'Delayed Retry',
          description: 'Wait for temporary provider issues to resolve',
          likelihood: 50,
          estimatedCost: 0,
          timeToRecover: '10-30 minutes'
        });
      }

      // Manual review recommendation
      if (errorPattern.requiresManualReview) {
        recommendations.push({
          strategy: 'Manual Review',
          description: 'Transaction requires manual verification due to security concerns',
          likelihood: 90,
          estimatedCost: 50, // Staff time cost
          timeToRecover: '2-24 hours'
        });
      }

      return recommendations.sort((a, b) => b.likelihood - a.likelihood);

    } catch (error) {
      logger.error('Error getting recovery recommendations', { transactionId, error });
      throw error;
    }
  }

  /**
   * Monitor and report on retry system health
   */
  async getRetrySystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    metrics: {
      retryQueueSize: number;
      averageRetryTime: number;
      retrySuccessRate: number;
      providerFailoverRate: number;
    };
    issues: Array<{
      type: 'performance' | 'reliability' | 'configuration';
      message: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    try {
      const recentStats = await this.getRetryStatistics('24h');
      const queueSize = await this.getRetryQueueSize();

      const metrics = {
        retryQueueSize: queueSize,
        averageRetryTime: recentStats.averageRecoveryTime,
        retrySuccessRate: recentStats.retrySuccessRate,
        providerFailoverRate: this.calculateProviderFailoverRate(recentStats)
      };

      // Determine system health
      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      const issues: Array<any> = [];

      if (metrics.retrySuccessRate < 50) {
        status = 'critical';
        issues.push({
          type: 'reliability',
          message: 'Retry success rate is critically low',
          severity: 'high'
        });
      } else if (metrics.retrySuccessRate < 70) {
        status = 'degraded';
        issues.push({
          type: 'reliability',
          message: 'Retry success rate is below optimal threshold',
          severity: 'medium'
        });
      }

      if (metrics.averageRetryTime > 30000) {
        status = status === 'healthy' ? 'degraded' : status;
        issues.push({
          type: 'performance',
          message: 'Average retry time is too high',
          severity: 'medium'
        });
      }

      if (metrics.retryQueueSize > 100) {
        status = status === 'healthy' ? 'degraded' : status;
        issues.push({
          type: 'performance',
          message: 'Retry queue is backing up',
          severity: 'medium'
        });
      }

      return {
        status,
        metrics,
        issues
      };

    } catch (error) {
      logger.error('Error getting retry system health', { error });
      throw error;
    }
  }

  // ======================================
  // PRIVATE HELPER METHODS
  // ======================================

  private async attemptPayment(
    paymentData: any,
    provider: PaymentProviderType
  ): Promise<any> {
    // Delegate to PaymentService with specified provider
    return await this.paymentService.createPayment({
      ...paymentData,
      preferredProvider: provider
    });
  }

  private async createRetryTransaction(
    paymentData: any,
    provider: PaymentProviderType
  ): Promise<string> {
    const transaction = await prisma.transaction.create({
      data: {
        amount: paymentData.amount,
        currency: paymentData.currency.toUpperCase(),
        status: 'PENDING',
        provider: provider.toUpperCase(),
        userId: paymentData.userId,
        description: paymentData.description,
        metadata: paymentData.metadata,
        retryCount: 0
      }
    });

    return transaction.id;
  }

  private async updateTransactionStatus(
    transactionId: string,
    status: 'SUCCESS' | 'FAILED' | 'PENDING',
    result?: any,
    error?: any
  ): Promise<void> {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status,
        ...(result && { 
          reference: result.reference,
          providerTransactionId: result.id,
          metadata: { ...result.metadata }
        }),
        ...(error && {
          errorCode: error.code,
          errorMessage: error.message
        }),
        updatedAt: new Date()
      }
    });
  }

  private isRetryableError(error: any, config: RetryConfig): boolean {
    const errorCode = error.code || error.type || 'UNKNOWN';
    return config.retryableErrors.some(retryableError => 
      errorCode.includes(retryableError) || error.message?.includes(retryableError)
    );
  }

  private async applyRecoveryStrategy(
    error: any,
    currentProvider: PaymentProviderType,
    attemptNumber: number,
    paymentData: any,
    config: RetryConfig
  ): Promise<{
    shouldStop: boolean;
    newProvider?: PaymentProviderType;
    strategy?: string;
    reason: string;
  }> {
    try {
      // Find applicable recovery strategy
      const applicableStrategy = this.recoveryStrategies.find(strategy => 
        strategy.enabled && this.strategyMatches(strategy, error, currentProvider, attemptNumber)
      );

      if (!applicableStrategy) {
        return {
          shouldStop: attemptNumber >= config.maxAttempts,
          reason: 'No applicable recovery strategy found'
        };
      }

      switch (applicableStrategy.action) {
        case 'switch_provider':
          const alternativeProvider = currentProvider === 'yoco' ? 'paystack' : 'yoco';
          const healthCheck = await paymentHealthMonitor.getProviderHealth(alternativeProvider);
          
          if (healthCheck && healthCheck.uptime > 95) {
            return {
              shouldStop: false,
              newProvider: alternativeProvider,
              strategy: applicableStrategy.name,
              reason: 'Switching to healthier provider'
            };
          }
          break;

        case 'delay_retry':
          const delayMs = applicableStrategy.parameters?.delayMs || 5000;
          await this.delay(delayMs);
          return {
            shouldStop: false,
            strategy: applicableStrategy.name,
            reason: `Applied ${delayMs}ms delay before retry`
          };

        case 'manual_review':
          // Flag for manual review
          await this.flagForManualReview(paymentData, error);
          return {
            shouldStop: true,
            strategy: applicableStrategy.name,
            reason: 'Flagged for manual review'
          };

        case 'retry_same_provider':
        default:
          return {
            shouldStop: false,
            strategy: applicableStrategy.name,
            reason: 'Continue with same provider'
          };
      }

      return {
        shouldStop: attemptNumber >= config.maxAttempts,
        reason: 'Default: Continue until max attempts reached'
      };

    } catch (error) {
      logger.error('Error applying recovery strategy', { error });
      return {
        shouldStop: true,
        reason: 'Recovery strategy application failed'
      };
    }
  }

  private strategyMatches(
    strategy: RecoveryStrategy,
    error: any,
    provider: PaymentProviderType,
    attemptNumber: number
  ): boolean {
    return strategy.conditions.every(condition => {
      let value: any;

      switch (condition.field) {
        case 'errorCode':
          value = error.code || error.type;
          break;
        case 'provider':
          value = provider;
          break;
        case 'attemptNumber':
          value = attemptNumber;
          break;
        case 'errorMessage':
          value = error.message;
          break;
        default:
          return false;
      }

      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'contains':
          return value && value.includes(condition.value);
        case 'greaterThan':
          return value > condition.value;
        case 'lessThan':
          return value < condition.value;
        default:
          return false;
      }
    });
  }

  private async flagForManualReview(paymentData: any, error: any): Promise<void> {
    await prisma.paymentReviewQueue.create({
      data: {
        userId: paymentData.userId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        errorDetails: {
          code: error.code,
          message: error.message,
          stack: error.stack
        },
        priority: 'HIGH',
        status: 'PENDING'
      }
    });
  }

  private async getRetryAttempts(cutoffDate: Date): Promise<PaymentAttempt[]> {
    // In a real implementation, this would query a dedicated retry attempts table
    // For now, we'll simulate with transaction data
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: cutoffDate },
        retryCount: { gt: 0 }
      }
    });

    return transactions.map(t => ({
      id: `${t.id}-1`,
      transactionId: t.id,
      provider: t.provider.toLowerCase() as PaymentProviderType,
      attemptNumber: t.retryCount,
      status: t.status === 'SUCCESS' ? 'success' : 'failed',
      errorCode: t.errorCode,
      errorMessage: t.errorMessage,
      responseTime: 2000, // Mock response time
      createdAt: t.createdAt,
      completedAt: t.updatedAt
    }));
  }

  private async getRetryQueueSize(): Promise<number> {
    // Check for pending retries in Redis queue
    const queueLength = await redis.llen('payment:retry:queue');
    return queueLength || 0;
  }

  private calculateProviderFailoverRate(stats: any): number {
    const totalProviderSwitches = stats.strategiesUsed
      .find((s: any) => s.strategy === 'Provider Switch')?.usage || 0;
    
    return stats.totalRetries > 0 ? (totalProviderSwitches / stats.totalRetries) * 100 : 0;
  }

  private getDateFromAge(age: string): Date {
    const now = new Date();
    const match = age.match(/^(\d+)([hd])$/);
    
    if (!match) return new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default 24h
    
    const [, value, unit] = match;
    const numValue = parseInt(value);
    
    switch (unit) {
      case 'h':
        return new Date(now.getTime() - numValue * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() - numValue * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private async analyzeFailurePattern(transaction: any): Promise<{
    providerIssue: boolean;
    amountIssue: boolean;
    temporaryIssue: boolean;
    requiresManualReview: boolean;
  }> {
    const errorCode = transaction.errorCode || '';
    const errorMessage = transaction.errorMessage || '';

    return {
      providerIssue: ['GATEWAY_ERROR', 'TIMEOUT', 'CONNECTION_REFUSED'].some(e => errorCode.includes(e)),
      amountIssue: ['AMOUNT_TOO_HIGH', 'INSUFFICIENT_FUNDS', 'LIMIT_EXCEEDED'].some(e => errorCode.includes(e)),
      temporaryIssue: ['RATE_LIMITED', 'TEMPORARY_UNAVAILABLE'].some(e => errorCode.includes(e)),
      requiresManualReview: ['FRAUD_SUSPECTED', 'COMPLIANCE_CHECK', 'VERIFICATION_REQUIRED'].some(e => errorCode.includes(e))
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'Provider Health Failover',
        description: 'Switch to alternative provider when current provider is unhealthy',
        enabled: true,
        priority: 100,
        conditions: [
          { field: 'errorCode', operator: 'contains', value: 'GATEWAY_ERROR' }
        ],
        action: 'switch_provider'
      },
      {
        name: 'Rate Limit Backoff',
        description: 'Apply extended delay when rate limited',
        enabled: true,
        priority: 90,
        conditions: [
          { field: 'errorCode', operator: 'equals', value: 'RATE_LIMITED' }
        ],
        action: 'delay_retry',
        parameters: { delayMs: 10000 }
      },
      {
        name: 'Timeout Retry',
        description: 'Retry with same provider for timeout errors',
        enabled: true,
        priority: 80,
        conditions: [
          { field: 'errorCode', operator: 'equals', value: 'TIMEOUT' },
          { field: 'attemptNumber', operator: 'lessThan', value: 3 }
        ],
        action: 'retry_same_provider'
      },
      {
        name: 'Fraud Review',
        description: 'Flag suspicious transactions for manual review',
        enabled: true,
        priority: 150,
        conditions: [
          { field: 'errorCode', operator: 'contains', value: 'FRAUD' }
        ],
        action: 'manual_review'
      }
    ];
  }
}

// Export singleton instance
export const paymentRetryService = new PaymentRetryService(
  new PaymentService() // This will be injected properly in production
);
