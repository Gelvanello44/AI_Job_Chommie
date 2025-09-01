/**
 * Enhanced Payment Analytics Service
 * Provides comprehensive insights into payment performance, provider comparisons, and business metrics
 */

import { PaymentProviderType } from './PaymentService';
import { paymentHealthMonitor } from './PaymentHealthMonitor';
import { logger } from '../../utils/logger';
import { prisma } from '../../utils/prisma';
import { SubscriptionPlan } from '@prisma/client';

export interface PaymentAnalytics {
  overview: {
    totalRevenue: number;
    totalTransactions: number;
    successRate: number;
    averageTransactionValue: number;
    revenueGrowth: number;
    transactionGrowth: number;
  };
  providerComparison: {
    yoco: ProviderMetrics;
    paystack: ProviderMetrics;
  };
  conversionFunnel: {
    paymentInitialized: number;
    paymentCompleted: number;
    subscriptionCreated: number;
    conversionRate: number;
  };
  revenueBreakdown: {
    byProvider: Record<PaymentProviderType, number>;
    byPlan: Record<SubscriptionPlan, number>;
    byCurrency: Record<string, number>;
    byTimeSegment: Array<{ date: string; revenue: number; transactions: number; }>;
  };
  subscriptionMetrics: {
    newSubscriptions: number;
    upgrades: number;
    downgrades: number;
    cancellations: number;
    churnRate: number;
    lifetimeValue: number;
  };
}

export interface ProviderMetrics {
  revenue: number;
  transactions: number;
  successRate: number;
  averageResponseTime: number;
  uptime: number;
  marketShare: number;
  customerSatisfaction: number;
  fees: {
    total: number;
    percentage: number;
  };
}

export interface PaymentInsights {
  trends: Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
  }>;
  recommendations: Array<{
    type: 'cost_optimization' | 'conversion_improvement' | 'provider_optimization';
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
  }>;
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    actionRequired: boolean;
  }>;
}

export class PaymentAnalyticsService {
  /**
   * Get comprehensive payment analytics for a time period
   */
  async getPaymentAnalytics(
    timeRange: '7d' | '30d' | '90d' | '1y' = '30d',
    currency: string = 'ZAR'
  ): Promise<PaymentAnalytics> {
    try {
      const { startDate, endDate } = this.getDateRange(timeRange);
      const previousPeriodStart = this.getPreviousPeriodStart(startDate, timeRange);

      // Get current period data
      const currentPeriodData = await this.getBasicMetrics(startDate, endDate, currency);
      
      // Get previous period data for growth calculations
      const previousPeriodData = await this.getBasicMetrics(previousPeriodStart, startDate, currency);

      // Calculate growth rates
      const revenueGrowth = this.calculateGrowthRate(
        currentPeriodData.totalRevenue,
        previousPeriodData.totalRevenue
      );
      const transactionGrowth = this.calculateGrowthRate(
        currentPeriodData.totalTransactions,
        previousPeriodData.totalTransactions
      );

      // Get provider comparison
      const providerComparison = await this.getProviderComparison(startDate, endDate, currency);

      // Get conversion funnel
      const conversionFunnel = await this.getConversionFunnel(startDate, endDate);

      // Get revenue breakdown
      const revenueBreakdown = await this.getRevenueBreakdown(startDate, endDate);

      // Get subscription metrics
      const subscriptionMetrics = await this.getSubscriptionMetrics(startDate, endDate);

      return {
        overview: {
          ...currentPeriodData,
          revenueGrowth,
          transactionGrowth
        },
        providerComparison,
        conversionFunnel,
        revenueBreakdown,
        subscriptionMetrics
      };
    } catch (error) {
      logger.error('Error getting payment analytics', { timeRange, currency, error });
      throw error;
    }
  }

  /**
   * Get provider performance comparison
   */
  async getProviderComparison(
    startDate: Date,
    endDate: Date,
    currency: string = 'ZAR'
  ): Promise<{ yoco: ProviderMetrics; paystack: ProviderMetrics; }> {
    try {
      const providers: PaymentProviderType[] = ['yoco', 'paystack'];
      const comparison: any = {};

      for (const provider of providers) {
        const metrics = await this.getProviderMetrics(provider, startDate, endDate, currency);
        comparison[provider] = metrics;
      }

      return comparison;
    } catch (error) {
      logger.error('Error getting provider comparison', { startDate, endDate, currency, error });
      throw error;
    }
  }

  /**
   * Get detailed metrics for a specific provider
   */
  async getProviderMetrics(
    provider: PaymentProviderType,
    startDate: Date,
    endDate: Date,
    currency: string = 'ZAR'
  ): Promise<ProviderMetrics> {
    try {
      // Get transaction data
      const [transactions, healthData] = await Promise.all([
        prisma.transaction.findMany({
          where: {
            provider: provider.toUpperCase(),
            currency: currency.toUpperCase(),
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        paymentHealthMonitor.getProviderHealth(provider)
      ]);

      const totalTransactions = transactions.length;
      const successfulTransactions = transactions.filter(t => t.status === 'SUCCESS').length;
      const totalRevenue = transactions
        .filter(t => t.status === 'SUCCESS')
        .reduce((sum, t) => sum + t.amount, 0);

      const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

      // Calculate fees (estimated based on provider fee structure)
      const feeRate = provider === 'yoco' ? 0.029 : 0.015; // 2.9% for Yoco, 1.5% for Paystack
      const totalFees = totalRevenue * feeRate;
      const feePercentage = totalRevenue > 0 ? (totalFees / totalRevenue) * 100 : 0;

      // Get market share
      const allTransactions = await prisma.transaction.count({
        where: {
          currency: currency.toUpperCase(),
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const marketShare = allTransactions > 0 ? (totalTransactions / allTransactions) * 100 : 0;

      // Calculate customer satisfaction based on successful payment rate and response times
      const avgResponseTime = healthData?.avgResponseTime || 0;
      const uptime = healthData?.uptime || 100;
      const customerSatisfaction = Math.min(100, (successRate * 0.6) + (uptime * 0.3) + ((3000 - avgResponseTime) / 30));

      return {
        revenue: totalRevenue,
        transactions: totalTransactions,
        successRate,
        averageResponseTime: avgResponseTime,
        uptime: uptime,
        marketShare,
        customerSatisfaction: Math.max(0, customerSatisfaction),
        fees: {
          total: totalFees,
          percentage: feePercentage
        }
      };
    } catch (error) {
      logger.error('Error getting provider metrics', { provider, startDate, endDate, error });
      throw error;
    }
  }

  /**
   * Get conversion funnel metrics
   */
  async getConversionFunnel(startDate: Date, endDate: Date): Promise<{
    paymentInitialized: number;
    paymentCompleted: number;
    subscriptionCreated: number;
    conversionRate: number;
  }> {
    try {
      const [paymentIntents, completedPayments, subscriptions] = await Promise.all([
        prisma.paymentIntent.count({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        prisma.transaction.count({
          where: {
            status: 'SUCCESS',
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        prisma.subscription.count({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        })
      ]);

      const conversionRate = paymentIntents > 0 ? (completedPayments / paymentIntents) * 100 : 0;

      return {
        paymentInitialized: paymentIntents,
        paymentCompleted: completedPayments,
        subscriptionCreated: subscriptions,
        conversionRate
      };
    } catch (error) {
      logger.error('Error getting conversion funnel', { startDate, endDate, error });
      throw error;
    }
  }

  /**
   * Get revenue breakdown by various dimensions
   */
  async getRevenueBreakdown(startDate: Date, endDate: Date): Promise<{
    byProvider: Record<PaymentProviderType, number>;
    byPlan: Record<SubscriptionPlan, number>;
    byCurrency: Record<string, number>;
    byTimeSegment: Array<{ date: string; revenue: number; transactions: number; }>;
  }> {
    try {
      // Revenue by provider
      const providerRevenue = await prisma.transaction.groupBy({
        by: ['provider'],
        where: {
          status: 'SUCCESS',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { amount: true },
        _count: { id: true }
      });

      const byProvider: Record<PaymentProviderType, number> = { yoco: 0, paystack: 0 };
      providerRevenue.forEach(item => {
        const provider = item.provider.toLowerCase() as PaymentProviderType;
        if (provider === 'yoco' || provider === 'paystack') {
          byProvider[provider] = item._sum.amount || 0;
        }
      });

      // Revenue by currency
      const currencyRevenue = await prisma.transaction.groupBy({
        by: ['currency'],
        where: {
          status: 'SUCCESS',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { amount: true }
      });

      const byCurrency: Record<string, number> = {};
      currencyRevenue.forEach(item => {
        byCurrency[item.currency] = item._sum.amount || 0;
      });

      // Revenue by subscription plan (approximate from user subscription data)
      const planRevenue = await prisma.user.groupBy({
        by: ['subscriptionPlan'],
        where: {
          subscription: {
            status: 'ACTIVE'
          }
        },
        _count: { id: true }
      });

      const byPlan: Record<SubscriptionPlan, number> = { FREE: 0, PROFESSIONAL: 0, EXECUTIVE: 0 };
      planRevenue.forEach(item => {
        // Estimate revenue based on plan pricing and user count
        const planPrice = this.getPlanPrice(item.subscriptionPlan);
        byPlan[item.subscriptionPlan] = (item._count.id * planPrice);
      });

      // Daily revenue for time series
      const dailyRevenue = await prisma.transaction.groupBy({
        by: ['createdAt'],
        where: {
          status: 'SUCCESS',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { amount: true },
        _count: { id: true }
      });

      const byTimeSegment = dailyRevenue.map(item => ({
        date: new Date(item.createdAt).toISOString().split('T')[0],
        revenue: item._sum.amount || 0,
        transactions: item._count.id
      }));

      return {
        byProvider,
        byPlan,
        byCurrency,
        byTimeSegment
      };
    } catch (error) {
      logger.error('Error getting revenue breakdown', { startDate, endDate, error });
      throw error;
    }
  }

  /**
   * Get subscription-specific metrics
   */
  async getSubscriptionMetrics(startDate: Date, endDate: Date): Promise<{
    newSubscriptions: number;
    upgrades: number;
    downgrades: number;
    cancellations: number;
    churnRate: number;
    lifetimeValue: number;
  }> {
    try {
      const [newSubscriptions, subscriptionEvents, allActiveSubscriptions] = await Promise.all([
        prisma.subscription.count({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        prisma.subscriptionEvent.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        prisma.subscription.count({
          where: {
            status: 'ACTIVE'
          }
        })
      ]);

      const upgrades = subscriptionEvents.filter(e => e.eventType === 'UPGRADED').length;
      const downgrades = subscriptionEvents.filter(e => e.eventType === 'DOWNGRADED').length;
      const cancellations = subscriptionEvents.filter(e => e.eventType === 'CANCELLED').length;

      // Calculate churn rate
      const startOfPeriodSubscriptions = await prisma.subscription.count({
        where: {
          createdAt: {
            lt: startDate
          },
          status: 'ACTIVE'
        }
      });

      const churnRate = startOfPeriodSubscriptions > 0 ? (cancellations / startOfPeriodSubscriptions) * 100 : 0;

      // Calculate average lifetime value
      const avgSubscriptionRevenue = await prisma.subscription.aggregate({
        where: {
          status: 'ACTIVE'
        },
        _avg: { amount: true }
      });

      const avgLifetimeMonths = 12; // Assume 12 months average lifetime
      const lifetimeValue = (avgSubscriptionRevenue._avg.amount || 0) * avgLifetimeMonths;

      return {
        newSubscriptions,
        upgrades,
        downgrades,
        cancellations,
        churnRate,
        lifetimeValue
      };
    } catch (error) {
      logger.error('Error getting subscription metrics', { startDate, endDate, error });
      throw error;
    }
  }

  /**
   * Generate payment insights and recommendations
   */
  async getPaymentInsights(timeRange: '30d' | '90d' = '30d'): Promise<PaymentInsights> {
    try {
      const { startDate, endDate } = this.getDateRange(timeRange);
      const analytics = await this.getPaymentAnalytics(timeRange);

      const trends = await this.calculateTrends(analytics, timeRange);
      const recommendations = this.generateRecommendations(analytics);
      const alerts = await this.generateAlerts(analytics);

      return {
        trends,
        recommendations,
        alerts
      };
    } catch (error) {
      logger.error('Error getting payment insights', { timeRange, error });
      throw error;
    }
  }

  /**
   * Get provider cost analysis
   */
  async getProviderCostAnalysis(
    provider: PaymentProviderType,
    timeRange: '30d' | '90d' | '1y' = '30d'
  ): Promise<{
    totalRevenue: number;
    processingFees: number;
    netRevenue: number;
    feePercentage: number;
    transactionCount: number;
    averageTransactionSize: number;
    costPerTransaction: number;
    projectedAnnualCost: number;
  }> {
    try {
      const { startDate, endDate } = this.getDateRange(timeRange);

      const transactions = await prisma.transaction.findMany({
        where: {
          provider: provider.toUpperCase(),
          status: 'SUCCESS',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
      const transactionCount = transactions.length;
      const averageTransactionSize = transactionCount > 0 ? totalRevenue / transactionCount : 0;

      // Calculate fees based on provider fee structure
      const feeStructure = this.getProviderFeeStructure(provider);
      const processingFees = this.calculateProcessingFees(transactions, feeStructure);
      const netRevenue = totalRevenue - processingFees;
      const feePercentage = totalRevenue > 0 ? (processingFees / totalRevenue) * 100 : 0;
      const costPerTransaction = transactionCount > 0 ? processingFees / transactionCount : 0;

      // Project annual cost
      const daysInPeriod = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const projectedAnnualCost = (processingFees / daysInPeriod) * 365;

      return {
        totalRevenue,
        processingFees,
        netRevenue,
        feePercentage,
        transactionCount,
        averageTransactionSize,
        costPerTransaction,
        projectedAnnualCost
      };
    } catch (error) {
      logger.error('Error getting provider cost analysis', { provider, timeRange, error });
      throw error;
    }
  }

  /**
   * Get revenue attribution by marketing channels or sources
   */
  async getRevenueAttribution(timeRange: '30d' | '90d' = '30d'): Promise<{
    bySource: Record<string, { revenue: number; transactions: number; }>;
    byGeography: Record<string, { revenue: number; transactions: number; }>;
    byUserType: Record<string, { revenue: number; transactions: number; }>;
  }> {
    try {
      const { startDate, endDate } = this.getDateRange(timeRange);

      const transactions = await prisma.transaction.findMany({
        where: {
          status: 'SUCCESS',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          user: {
            select: {
              country: true,
              subscriptionPlan: true,
              createdAt: true
            }
          }
        }
      });

      // Revenue by source (from metadata)
      const bySource: Record<string, { revenue: number; transactions: number; }> = {};
      
      // Revenue by geography
      const byGeography: Record<string, { revenue: number; transactions: number; }> = {};
      
      // Revenue by user type
      const byUserType: Record<string, { revenue: number; transactions: number; }> = {};

      transactions.forEach(transaction => {
        const revenue = transaction.amount;
        const country = transaction.user.country || 'Unknown';
        const userPlan = transaction.user.subscriptionPlan;

        // Source attribution (simplified)
        const source = transaction.metadata?.source || 'direct';
        if (!bySource[source]) {
          bySource[source] = { revenue: 0, transactions: 0 };
        }
        bySource[source].revenue += revenue;
        bySource[source].transactions += 1;

        // Geography attribution
        if (!byGeography[country]) {
          byGeography[country] = { revenue: 0, transactions: 0 };
        }
        byGeography[country].revenue += revenue;
        byGeography[country].transactions += 1;

        // User type attribution
        if (!byUserType[userPlan]) {
          byUserType[userPlan] = { revenue: 0, transactions: 0 };
        }
        byUserType[userPlan].revenue += revenue;
        byUserType[userPlan].transactions += 1;
      });

      return {
        bySource,
        byGeography,
        byUserType
      };
    } catch (error) {
      logger.error('Error getting revenue attribution', { timeRange, error });
      throw error;
    }
  }

  /**
   * Export payment data for reporting
   */
  async exportPaymentData(
    format: 'csv' | 'json',
    filters: {
      provider?: PaymentProviderType;
      status?: 'SUCCESS' | 'FAILED' | 'PENDING';
      startDate?: Date;
      endDate?: Date;
      currency?: string;
    } = {}
  ): Promise<string> {
    try {
      const whereClause: any = {};

      if (filters.provider) {
        whereClause.provider = filters.provider.toUpperCase();
      }
      if (filters.status) {
        whereClause.status = filters.status;
      }
      if (filters.startDate || filters.endDate) {
        whereClause.createdAt = {};
        if (filters.startDate) whereClause.createdAt.gte = filters.startDate;
        if (filters.endDate) whereClause.createdAt.lte = filters.endDate;
      }
      if (filters.currency) {
        whereClause.currency = filters.currency.toUpperCase();
      }

      const transactions = await prisma.transaction.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
              country: true,
              subscriptionPlan: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (format === 'csv') {
        return this.convertToCSV(transactions);
      } else {
        return JSON.stringify(transactions, null, 2);
      }
    } catch (error) {
      logger.error('Error exporting payment data', { format, filters, error });
      throw error;
    }
  }

  // ======================================
  // PRIVATE HELPER METHODS
  // ======================================

  private getDateRange(timeRange: string): { startDate: Date; endDate: Date; } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  }

  private getPreviousPeriodStart(currentStart: Date, timeRange: string): Date {
    const periodLength = currentStart.getTime() - new Date().getTime();
    return new Date(currentStart.getTime() + periodLength);
  }

  private async getBasicMetrics(
    startDate: Date,
    endDate: Date,
    currency: string
  ): Promise<{
    totalRevenue: number;
    totalTransactions: number;
    successRate: number;
    averageTransactionValue: number;
  }> {
    const [revenueData, transactionCounts] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          status: 'SUCCESS',
          currency: currency.toUpperCase(),
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.transaction.groupBy({
        by: ['status'],
        where: {
          currency: currency.toUpperCase(),
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: { id: true }
      })
    ]);

    const totalRevenue = revenueData._sum.amount || 0;
    const successfulTransactions = revenueData._count.id || 0;
    const totalTransactions = transactionCounts.reduce((sum, item) => sum + item._count.id, 0);
    const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;
    const averageTransactionValue = successfulTransactions > 0 ? totalRevenue / successfulTransactions : 0;

    return {
      totalRevenue,
      totalTransactions,
      successRate,
      averageTransactionValue
    };
  }

  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private getPlanPrice(plan: SubscriptionPlan): number {
    const prices = { FREE: 0, PROFESSIONAL: 8, EXECUTIVE: 17 };
    return prices[plan] || 0;
  }

  private getProviderFeeStructure(provider: PaymentProviderType): {
    percentageFee: number;
    fixedFee: number;
  } {
    const feeStructures = {
      yoco: { percentageFee: 0.029, fixedFee: 0 }, // 2.9%
      paystack: { percentageFee: 0.015, fixedFee: 100 } // 1.5% + R1.00
    };

    return feeStructures[provider];
  }

  private calculateProcessingFees(
    transactions: any[],
    feeStructure: { percentageFee: number; fixedFee: number; }
  ): number {
    return transactions.reduce((total, transaction) => {
      const percentageFee = transaction.amount * feeStructure.percentageFee;
      const fixedFee = feeStructure.fixedFee;
      return total + percentageFee + fixedFee;
    }, 0);
  }

  private async calculateTrends(analytics: PaymentAnalytics, timeRange: string): Promise<Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
  }>> {
    return [
      {
        metric: 'revenue',
        direction: analytics.overview.revenueGrowth > 5 ? 'up' : 
                  analytics.overview.revenueGrowth < -5 ? 'down' : 'stable',
        change: analytics.overview.revenueGrowth,
        period: timeRange
      },
      {
        metric: 'transactions',
        direction: analytics.overview.transactionGrowth > 5 ? 'up' : 
                  analytics.overview.transactionGrowth < -5 ? 'down' : 'stable',
        change: analytics.overview.transactionGrowth,
        period: timeRange
      },
      {
        metric: 'success_rate',
        direction: analytics.overview.successRate > 95 ? 'up' : 
                  analytics.overview.successRate < 85 ? 'down' : 'stable',
        change: analytics.overview.successRate,
        period: timeRange
      }
    ];
  }

  private generateRecommendations(analytics: PaymentAnalytics): Array<{
    type: 'cost_optimization' | 'conversion_improvement' | 'provider_optimization';
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
  }> {
    const recommendations: Array<any> = [];

    // Cost optimization recommendations
    const yocoFees = analytics.providerComparison.yoco.fees.percentage;
    const paystackFees = analytics.providerComparison.paystack.fees.percentage;
    
    if (yocoFees < paystackFees) {
      recommendations.push({
        type: 'cost_optimization',
        title: 'Prioritize Yoco for ZAR transactions',
        description: `Yoco has lower fees (${yocoFees.toFixed(2)}%) compared to Paystack (${paystackFees.toFixed(2)}%) for ZAR transactions`,
        impact: 'medium',
        effort: 'low'
      });
    }

    // Conversion improvement recommendations
    if (analytics.conversionFunnel.conversionRate < 80) {
      recommendations.push({
        type: 'conversion_improvement',
        title: 'Improve payment conversion rate',
        description: `Current conversion rate is ${analytics.conversionFunnel.conversionRate.toFixed(1)}%. Consider optimizing the payment flow.`,
        impact: 'high',
        effort: 'medium'
      });
    }

    // Provider optimization recommendations
    if (analytics.providerComparison.yoco.uptime < 99) {
      recommendations.push({
        type: 'provider_optimization',
        title: 'Monitor Yoco stability',
        description: `Yoco uptime is ${analytics.providerComparison.yoco.uptime.toFixed(1)}%. Consider implementing better failover mechanisms.`,
        impact: 'medium',
        effort: 'medium'
      });
    }

    return recommendations;
  }

  private async generateAlerts(analytics: PaymentAnalytics): Promise<Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    actionRequired: boolean;
  }>> {
    const alerts: Array<any> = [];

    // Check for critical success rate
    if (analytics.overview.successRate < 85) {
      alerts.push({
        type: 'error',
        message: `Payment success rate is critically low at ${analytics.overview.successRate.toFixed(1)}%`,
        actionRequired: true
      });
    }

    // Check for high churn rate
    if (analytics.subscriptionMetrics.churnRate > 10) {
      alerts.push({
        type: 'warning',
        message: `Subscription churn rate is high at ${analytics.subscriptionMetrics.churnRate.toFixed(1)}%`,
        actionRequired: true
      });
    }

    // Check provider health
    if (analytics.providerComparison.yoco.uptime < 95) {
      alerts.push({
        type: 'warning',
        message: `Yoco uptime is below threshold at ${analytics.providerComparison.yoco.uptime.toFixed(1)}%`,
        actionRequired: false
      });
    }

    return alerts;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = [
      'ID', 'Reference', 'Amount', 'Currency', 'Status', 'Provider',
      'User Email', 'User Name', 'Country', 'Plan', 'Created At'
    ];

    const csvRows = [headers.join(',')];

    data.forEach(transaction => {
      const row = [
        transaction.id,
        transaction.reference,
        transaction.amount,
        transaction.currency,
        transaction.status,
        transaction.provider,
        transaction.user.email,
        `"${transaction.user.firstName} ${transaction.user.lastName}"`,
        transaction.user.country || '',
        transaction.user.subscriptionPlan,
        transaction.createdAt.toISOString()
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }
}

// Export singleton instance
export const paymentAnalyticsService = new PaymentAnalyticsService();
