/**
 * Enhanced Subscription Payment Service
 * Integrates subscription management with payment providers for seamless upgrades/downgrades
 */

import { SubscriptionPlan, User } from '@prisma/client';
import { PaymentProviderType, paymentService } from './PaymentService';
import { SubscriptionService } from '../subscription.service';
import { quotaService } from '../quota.service';
import { logger } from '../../utils/logger';
import { prisma } from '../../utils/prisma';
import { PLAN_QUOTAS, getPlanPrice, getMonthlyQuota } from '../../utils/subscriptionQuotas';
import { NotificationService } from '../notification.service';

export interface SubscriptionChangeRequest {
  userId: string;
  newPlan: SubscriptionPlan;
  billingCycle?: 'monthly' | 'yearly';
  paymentMethodId?: string;
  promoCode?: string;
}

export interface SubscriptionChangeResult {
  success: boolean;
  subscription: any;
  paymentRequired: boolean;
  paymentUrl?: string;
  proratedAmount?: number;
  quotaChanges: {
    oldQuota: number;
    newQuota: number;
    creditsAdjustment: number;
  };
}

export class SubscriptionPaymentService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Handle subscription upgrade with payment processing
   */
  async upgradeSubscription(request: SubscriptionChangeRequest): Promise<SubscriptionChangeResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        include: { subscription: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentPlan = user.subscriptionPlan;
      const newPlan = request.newPlan;

      // Validate upgrade path
      if (!this.isValidUpgrade(currentPlan, newPlan)) {
        throw new Error(`Invalid upgrade from ${currentPlan} to ${newPlan}`);
      }

      // Calculate pricing and prorated amounts
      const pricingDetails = this.calculateUpgradePricing(
        user,
        newPlan,
        request.billingCycle || 'monthly'
      );

      let paymentResult = null;
      let paymentRequired = pricingDetails.chargeAmount > 0;

      // Process payment if required
      if (paymentRequired) {
        // Determine best payment provider for user
        const provider = await paymentService.determineProvider({
          country: user.country || 'ZA',
          currency: 'ZAR',
          userPreference: user.preferredPaymentProvider as PaymentProviderType,
          paymentType: 'subscription'
        });

        // Initialize payment
        paymentResult = await paymentService.initializePayment({
          email: user.email,
          amount: Math.round(pricingDetails.chargeAmount * 100), // Convert to cents
          currency: 'ZAR',
          provider,
          metadata: {
            type: 'subscription_upgrade',
            userId: request.userId,
            fromPlan: currentPlan,
            toPlan: newPlan,
            billingCycle: request.billingCycle || 'monthly',
            proratedAmount: pricingDetails.chargeAmount
          }
        });

        logger.info('Payment initialized for subscription upgrade', {
          userId: request.userId,
          fromPlan: currentPlan,
          toPlan: newPlan,
          amount: pricingDetails.chargeAmount,
          provider,
          reference: paymentResult.reference
        });
      } else {
        // No payment required, upgrade immediately
        await this.processSubscriptionUpgrade(request.userId, newPlan, request.billingCycle);
      }

      // Calculate quota changes
      const oldQuota = getMonthlyQuota(currentPlan);
      const newQuota = getMonthlyQuota(newPlan);
      const creditsAdjustment = newQuota - user.creditsRemaining;

      return {
        success: true,
        subscription: user.subscription,
        paymentRequired,
        paymentUrl: paymentResult?.authorization_url,
        proratedAmount: pricingDetails.chargeAmount,
        quotaChanges: {
          oldQuota,
          newQuota,
          creditsAdjustment: Math.max(0, creditsAdjustment)
        }
      };
    } catch (error) {
      logger.error('Error upgrading subscription', { request, error });
      throw error;
    }
  }

  /**
   * Handle subscription downgrade with grace period
   */
  async downgradeSubscription(request: SubscriptionChangeRequest): Promise<SubscriptionChangeResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        include: { subscription: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentPlan = user.subscriptionPlan;
      const newPlan = request.newPlan;

      // Validate downgrade path
      if (!this.isValidDowngrade(currentPlan, newPlan)) {
        throw new Error(`Invalid downgrade from ${currentPlan} to ${newPlan}`);
      }

      // Calculate refund amount (if any)
      const refundDetails = this.calculateDowngradeRefund(user, newPlan);

      // Schedule downgrade for end of current billing period
      const effectiveDate = user.subscription?.currentPeriodEnd || new Date();
      
      await prisma.subscription.update({
        where: { id: user.subscription!.id },
        data: {
          status: 'CANCELLING',
          cancelledAt: new Date(),
          cancellationReason: `Downgrade to ${newPlan}`,
          // Will be downgraded at end of current period
        }
      });

      // Schedule the actual downgrade
      await this.scheduleSubscriptionDowngrade(request.userId, newPlan, effectiveDate);

      // Send downgrade confirmation
      await this.notificationService.sendSubscriptionDowngradeConfirmation(request.userId, {
        currentPlan,
        newPlan,
        effectiveDate,
        refundAmount: refundDetails.refundAmount
      });

      const oldQuota = getMonthlyQuota(currentPlan);
      const newQuota = getMonthlyQuota(newPlan);

      logger.info('Subscription downgrade scheduled', {
        userId: request.userId,
        fromPlan: currentPlan,
        toPlan: newPlan,
        effectiveDate,
        refundAmount: refundDetails.refundAmount
      });

      return {
        success: true,
        subscription: user.subscription,
        paymentRequired: false,
        quotaChanges: {
          oldQuota,
          newQuota,
          creditsAdjustment: Math.min(0, newQuota - user.creditsRemaining)
        }
      };
    } catch (error) {
      logger.error('Error downgrading subscription', { request, error });
      throw error;
    }
  }

  /**
   * Process immediate subscription upgrade after successful payment
   */
  async processSubscriptionUpgrade(
    userId: string, 
    newPlan: SubscriptionPlan, 
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const newQuota = getMonthlyQuota(newPlan);
      const planPrice = getPlanPrice(newPlan);
      const subscriptionAmount = billingCycle === 'yearly' ? planPrice * 12 * 0.8 : planPrice; // 20% yearly discount

      // Calculate new subscription period
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date();
      if (billingCycle === 'yearly') {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      } else {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      }

      // Update user and subscription in transaction
      await prisma.$transaction(async (tx) => {
        // Update user plan and quotas
        await tx.user.update({
          where: { id: userId },
          data: {
            subscriptionPlan: newPlan,
            creditsRemaining: Math.max(user.creditsRemaining, newQuota), // Give user at least the new plan's quota
            monthlyQuota: newQuota,
            quotaResetDate: this.getNextQuotaResetDate(),
            subscriptionExpiry: currentPeriodEnd
          }
        });

        // Update or create subscription
        if (user.subscription) {
          await tx.subscription.update({
            where: { id: user.subscription.id },
            data: {
              plan: newPlan,
              status: 'ACTIVE',
              billingCycle,
              amount: subscriptionAmount,
              currentPeriodStart,
              currentPeriodEnd,
              updatedAt: new Date()
            }
          });
        } else {
          await tx.subscription.create({
            data: {
              userId,
              plan: newPlan,
              status: 'ACTIVE',
              billingCycle,
              amount: subscriptionAmount,
              currency: 'ZAR',
              currentPeriodStart,
              currentPeriodEnd
            }
          });
        }

        // Log subscription event
        await tx.subscriptionEvent.create({
          data: {
            userId,
            eventType: 'UPGRADED',
            description: `Subscription upgraded to ${newPlan}`,
            metadata: {
              oldPlan: user.subscriptionPlan,
              newPlan,
              billingCycle,
              amount: subscriptionAmount
            }
          }
        });
      });

      // Send upgrade confirmation
      await this.notificationService.sendSubscriptionUpgradeConfirmation(userId, {
        oldPlan: user.subscriptionPlan,
        newPlan,
        newQuota,
        billingCycle,
        amount: subscriptionAmount
      });

      logger.info('Subscription upgrade completed successfully', {
        userId,
        oldPlan: user.subscriptionPlan,
        newPlan,
        newQuota,
        billingCycle
      });
    } catch (error) {
      logger.error('Error processing subscription upgrade', { userId, newPlan, error });
      throw error;
    }
  }

  /**
   * Calculate upgrade pricing with prorated billing
   */
  private calculateUpgradePricing(
    user: User,
    newPlan: SubscriptionPlan,
    billingCycle: 'monthly' | 'yearly'
  ): {
    currentPlanPrice: number;
    newPlanPrice: number;
    proratedCredit: number;
    chargeAmount: number;
    billingCycleMultiplier: number;
  } {
    const currentPlanPrice = getPlanPrice(user.subscriptionPlan);
    const newPlanPrice = getPlanPrice(newPlan);
    const billingCycleMultiplier = billingCycle === 'yearly' ? 12 * 0.8 : 1; // 20% yearly discount

    // Calculate remaining days in current subscription period
    const now = new Date();
    const subscriptionExpiry = user.subscriptionExpiry || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const remainingDays = Math.max(0, (subscriptionExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const totalDaysInPeriod = 30; // Assume monthly billing

    // Calculate prorated amounts
    const proratedCredit = (currentPlanPrice * remainingDays) / totalDaysInPeriod;
    const newPlanCost = newPlanPrice * billingCycleMultiplier;
    const chargeAmount = Math.max(0, newPlanCost - proratedCredit);

    return {
      currentPlanPrice,
      newPlanPrice,
      proratedCredit,
      chargeAmount,
      billingCycleMultiplier
    };
  }

  /**
   * Calculate downgrade refund amount
   */
  private calculateDowngradeRefund(
    user: User,
    newPlan: SubscriptionPlan
  ): {
    refundAmount: number;
    effectiveDate: Date;
  } {
    const currentPlanPrice = getPlanPrice(user.subscriptionPlan);
    const newPlanPrice = getPlanPrice(newPlan);

    // Calculate remaining days in current subscription period
    const now = new Date();
    const subscriptionExpiry = user.subscriptionExpiry || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const remainingDays = Math.max(0, (subscriptionExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const totalDaysInPeriod = 30; // Assume monthly billing

    // Calculate prorated refund
    const priceDifference = currentPlanPrice - newPlanPrice;
    const refundAmount = Math.max(0, (priceDifference * remainingDays) / totalDaysInPeriod);

    return {
      refundAmount,
      effectiveDate: subscriptionExpiry
    };
  }

  /**
   * Schedule subscription downgrade for end of billing period
   */
  private async scheduleSubscriptionDowngrade(
    userId: string,
    newPlan: SubscriptionPlan,
    effectiveDate: Date
  ): Promise<void> {
    try {
      // Store downgrade schedule in database
      await prisma.scheduledSubscriptionChange.create({
        data: {
          userId,
          fromPlan: (await prisma.user.findUnique({ where: { id: userId } }))!.subscriptionPlan,
          toPlan: newPlan,
          changeType: 'DOWNGRADE',
          scheduledFor: effectiveDate,
          status: 'SCHEDULED',
          metadata: {
            scheduledAt: new Date().toISOString(),
            reason: 'user_requested_downgrade'
          }
        }
      });

      logger.info('Subscription downgrade scheduled', {
        userId,
        newPlan,
        effectiveDate
      });
    } catch (error) {
      logger.error('Error scheduling subscription downgrade', { userId, newPlan, error });
      throw error;
    }
  }

  /**
   * Handle subscription billing cycle change
   */
  async changeBillingCycle(
    userId: string,
    newBillingCycle: 'monthly' | 'yearly'
  ): Promise<SubscriptionChangeResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true }
      });

      if (!user || !user.subscription) {
        throw new Error('User or subscription not found');
      }

      const currentBillingCycle = user.subscription.billingCycle;
      if (currentBillingCycle === newBillingCycle) {
        throw new Error('Billing cycle is already set to ' + newBillingCycle);
      }

      // Calculate new amount based on billing cycle
      const basePlanPrice = getPlanPrice(user.subscriptionPlan);
      const newAmount = newBillingCycle === 'yearly' ? basePlanPrice * 12 * 0.8 : basePlanPrice; // 20% yearly discount

      // Calculate prorated amount for billing cycle change
      const proratedDetails = this.calculateBillingCycleChange(user, newBillingCycle);

      let paymentRequired = proratedDetails.additionalCharge > 0;
      let paymentResult = null;

      if (paymentRequired) {
        // Determine best payment provider
        const provider = await paymentService.determineProvider({
          country: user.country || 'ZA',
          currency: 'ZAR',
          userPreference: user.preferredPaymentProvider as PaymentProviderType,
          paymentType: 'subscription'
        });

        // Initialize payment for additional charge
        paymentResult = await paymentService.initializePayment({
          email: user.email,
          amount: Math.round(proratedDetails.additionalCharge * 100),
          currency: 'ZAR',
          provider,
          metadata: {
            type: 'billing_cycle_change',
            userId,
            fromCycle: currentBillingCycle,
            toCycle: newBillingCycle,
            additionalCharge: proratedDetails.additionalCharge
          }
        });
      } else {
        // Update billing cycle immediately if no additional payment required
        await prisma.subscription.update({
          where: { id: user.subscription.id },
          data: {
            billingCycle: newBillingCycle,
            amount: newAmount,
            updatedAt: new Date()
          }
        });

        await this.notificationService.sendBillingCycleChangeConfirmation(userId, {
          newBillingCycle,
          newAmount,
          effectiveDate: new Date()
        });
      }

      const quota = getMonthlyQuota(user.subscriptionPlan);

      return {
        success: true,
        subscription: user.subscription,
        paymentRequired,
        paymentUrl: paymentResult?.authorization_url,
        proratedAmount: proratedDetails.additionalCharge,
        quotaChanges: {
          oldQuota: quota,
          newQuota: quota,
          creditsAdjustment: 0 // No quota change for billing cycle change
        }
      };
    } catch (error) {
      logger.error('Error changing billing cycle', { userId, newBillingCycle, error });
      throw error;
    }
  }

  /**
   * Cancel subscription with options for immediate or end-of-period cancellation
   */
  async cancelSubscription(
    userId: string,
    options: {
      immediate?: boolean;
      reason?: string;
      feedback?: string;
    } = {}
  ): Promise<{
    success: boolean;
    effectiveDate: Date;
    refundAmount?: number;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true }
      });

      if (!user || !user.subscription) {
        throw new Error('User or subscription not found');
      }

      const effectiveDate = options.immediate 
        ? new Date() 
        : (user.subscription.currentPeriodEnd || new Date());

      let refundAmount = 0;

      if (options.immediate) {
        // Calculate prorated refund for immediate cancellation
        refundAmount = this.calculateImmediateCancellationRefund(user);
        
        // Process immediate downgrade to FREE
        await this.processSubscriptionDowngrade(userId, 'FREE');
      } else {
        // Schedule cancellation for end of billing period
        await prisma.subscription.update({
          where: { id: user.subscription.id },
          data: {
            status: 'CANCELLING',
            cancelledAt: new Date(),
            cancellationReason: options.reason || 'User requested cancellation'
          }
        });

        // Schedule downgrade to FREE plan
        await this.scheduleSubscriptionDowngrade(userId, 'FREE', effectiveDate);
      }

      // Record cancellation event
      await prisma.subscriptionEvent.create({
        data: {
          userId,
          eventType: 'CANCELLED',
          description: options.immediate ? 'Immediate cancellation' : 'Scheduled cancellation',
          metadata: {
            immediate: options.immediate,
            reason: options.reason,
            feedback: options.feedback,
            effectiveDate: effectiveDate.toISOString(),
            refundAmount
          }
        }
      });

      // Send cancellation confirmation
      await this.notificationService.sendSubscriptionCancellationConfirmation(userId, {
        currentPlan: user.subscriptionPlan,
        effectiveDate,
        immediate: options.immediate,
        refundAmount
      });

      logger.info('Subscription cancellation processed', {
        userId,
        plan: user.subscriptionPlan,
        immediate: options.immediate,
        effectiveDate,
        refundAmount
      });

      return {
        success: true,
        effectiveDate,
        refundAmount: refundAmount > 0 ? refundAmount : undefined
      };
    } catch (error) {
      logger.error('Error cancelling subscription', { userId, options, error });
      throw error;
    }
  }

  /**
   * Process subscription downgrade
   */
  private async processSubscriptionDowngrade(
    userId: string,
    newPlan: SubscriptionPlan
  ): Promise<void> {
    try {
      const newQuota = getMonthlyQuota(newPlan);

      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: newPlan,
          creditsRemaining: Math.min(newQuota, await this.getCurrentCredits(userId)),
          monthlyQuota: newQuota,
          quotaResetDate: this.getNextQuotaResetDate(),
          subscriptionExpiry: newPlan === 'FREE' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      logger.info('Subscription downgrade processed', {
        userId,
        newPlan,
        newQuota
      });
    } catch (error) {
      logger.error('Error processing subscription downgrade', { userId, newPlan, error });
      throw error;
    }
  }

  /**
   * Calculate billing cycle change costs
   */
  private calculateBillingCycleChange(
    user: User,
    newBillingCycle: 'monthly' | 'yearly'
  ): {
    additionalCharge: number;
    creditAmount: number;
  } {
    const basePlanPrice = getPlanPrice(user.subscriptionPlan);
    const currentAmount = user.subscription?.amount || basePlanPrice;
    const newAmount = newBillingCycle === 'yearly' ? basePlanPrice * 12 * 0.8 : basePlanPrice;

    // Calculate remaining value in current subscription
    const now = new Date();
    const subscriptionExpiry = user.subscriptionExpiry || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const remainingDays = Math.max(0, (subscriptionExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const totalDaysInPeriod = user.subscription?.billingCycle === 'yearly' ? 365 : 30;

    const creditAmount = (currentAmount * remainingDays) / totalDaysInPeriod;
    const additionalCharge = Math.max(0, newAmount - creditAmount);

    return {
      additionalCharge,
      creditAmount
    };
  }

  /**
   * Calculate immediate cancellation refund
   */
  private calculateImmediateCancellationRefund(user: User): number {
    const planPrice = getPlanPrice(user.subscriptionPlan);
    const billingCycle = user.subscription?.billingCycle || 'monthly';
    const subscriptionAmount = billingCycle === 'yearly' ? planPrice * 12 * 0.8 : planPrice;

    // Calculate remaining days
    const now = new Date();
    const subscriptionExpiry = user.subscriptionExpiry || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const remainingDays = Math.max(0, (subscriptionExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const totalDaysInPeriod = billingCycle === 'yearly' ? 365 : 30;

    // Calculate prorated refund (minus processing fees)
    const refundAmount = (subscriptionAmount * remainingDays) / totalDaysInPeriod;
    const processingFee = refundAmount * 0.05; // 5% processing fee for refunds

    return Math.max(0, refundAmount - processingFee);
  }

  /**
   * Validate if upgrade path is allowed
   */
  private isValidUpgrade(currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): boolean {
    const planHierarchy: SubscriptionPlan[] = ['FREE', 'PROFESSIONAL', 'EXECUTIVE'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    const newIndex = planHierarchy.indexOf(newPlan);
    
    return newIndex > currentIndex;
  }

  /**
   * Validate if downgrade path is allowed
   */
  private isValidDowngrade(currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): boolean {
    const planHierarchy: SubscriptionPlan[] = ['FREE', 'PROFESSIONAL', 'EXECUTIVE'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    const newIndex = planHierarchy.indexOf(newPlan);
    
    return newIndex < currentIndex;
  }

  /**
   * Get current user credits
   */
  private async getCurrentCredits(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditsRemaining: true }
    });
    return user?.creditsRemaining || 0;
  }

  /**
   * Get next quota reset date
   */
  private getNextQuotaResetDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  /**
   * Handle subscription payment webhook
   */
  async handleSubscriptionPaymentWebhook(
    provider: PaymentProviderType,
    event: any
  ): Promise<void> {
    try {
      const metadata = event.data?.metadata || {};
      const type = metadata.type;

      switch (type) {
        case 'subscription_upgrade':
          await this.handleUpgradePaymentSuccess(event.data);
          break;
        case 'billing_cycle_change':
          await this.handleBillingCyclePaymentSuccess(event.data);
          break;
        default:
          logger.warn('Unhandled subscription payment webhook type', { type, provider });
      }
    } catch (error) {
      logger.error('Error handling subscription payment webhook', { provider, event, error });
      throw error;
    }
  }

  /**
   * Handle successful upgrade payment
   */
  private async handleUpgradePaymentSuccess(paymentData: any): Promise<void> {
    try {
      const metadata = paymentData.metadata;
      const userId = metadata.userId;
      const newPlan = metadata.toPlan;
      const billingCycle = metadata.billingCycle || 'monthly';

      await this.processSubscriptionUpgrade(userId, newPlan, billingCycle);

      logger.info('Subscription upgrade payment processed successfully', {
        userId,
        newPlan,
        paymentReference: paymentData.reference
      });
    } catch (error) {
      logger.error('Error handling upgrade payment success', { paymentData, error });
      throw error;
    }
  }

  /**
   * Handle successful billing cycle change payment
   */
  private async handleBillingCyclePaymentSuccess(paymentData: any): Promise<void> {
    try {
      const metadata = paymentData.metadata;
      const userId = metadata.userId;
      const newBillingCycle = metadata.toCycle;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true }
      });

      if (!user || !user.subscription) {
        throw new Error('User or subscription not found');
      }

      const newAmount = newBillingCycle === 'yearly' 
        ? getPlanPrice(user.subscriptionPlan) * 12 * 0.8 
        : getPlanPrice(user.subscriptionPlan);

      // Update subscription billing cycle
      await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: {
          billingCycle: newBillingCycle,
          amount: newAmount,
          updatedAt: new Date()
        }
      });

      // Send confirmation
      await this.notificationService.sendBillingCycleChangeConfirmation(userId, {
        newBillingCycle,
        newAmount,
        effectiveDate: new Date()
      });

      logger.info('Billing cycle change payment processed successfully', {
        userId,
        newBillingCycle,
        newAmount,
        paymentReference: paymentData.reference
      });
    } catch (error) {
      logger.error('Error handling billing cycle payment success', { paymentData, error });
      throw error;
    }
  }

  /**
   * Get subscription change options for a user
   */
  async getSubscriptionChangeOptions(userId: string): Promise<{
    availableUpgrades: SubscriptionPlan[];
    availableDowngrades: SubscriptionPlan[];
    currentPlan: SubscriptionPlan;
    billingCycleOptions: ('monthly' | 'yearly')[];
    pricingInfo: Record<SubscriptionPlan, { monthly: number; yearly: number; }>;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentPlan = user.subscriptionPlan;
      const planHierarchy: SubscriptionPlan[] = ['FREE', 'PROFESSIONAL', 'EXECUTIVE'];
      const currentIndex = planHierarchy.indexOf(currentPlan);

      const availableUpgrades = planHierarchy.slice(currentIndex + 1);
      const availableDowngrades = planHierarchy.slice(0, currentIndex);

      // Build pricing info
      const pricingInfo: Record<SubscriptionPlan, { monthly: number; yearly: number; }> = {
        FREE: { monthly: 0, yearly: 0 },
        PROFESSIONAL: { monthly: getPlanPrice('PROFESSIONAL'), yearly: getPlanPrice('PROFESSIONAL') * 12 * 0.8 },
        EXECUTIVE: { monthly: getPlanPrice('EXECUTIVE'), yearly: getPlanPrice('EXECUTIVE') * 12 * 0.8 }
      };

      return {
        availableUpgrades,
        availableDowngrades,
        currentPlan,
        billingCycleOptions: ['monthly', 'yearly'],
        pricingInfo
      };
    } catch (error) {
      logger.error('Error getting subscription change options', { userId, error });
      throw error;
    }
  }
}

// Export singleton instance
export const subscriptionPaymentService = new SubscriptionPaymentService();
