/**
 * Enhanced Yoco Payment Provider Implementation
 * Handles payments, subscriptions, and advanced features through Yoco
 */

import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { PaymentProvider, PaymentCustomer, PaymentTransaction, PaymentSubscription } from './PaymentProvider.interface';
import { logger } from '../../utils/logger';
import { prisma } from '../../utils/prisma';
import { NotificationService } from '../notification.service';
import { quotaService } from '../quota.service';
import { SubscriptionPlan } from '@prisma/client';

export class YocoProvider implements PaymentProvider {
  name: 'yoco' = 'yoco';
  private apiKey: string;
  private publicKey: string;
  private webhookSecret: string;
  private baseUrl: string;
  
  constructor() {
    this.apiKey = process.env.YOCO_SECRET_KEY || '';
    this.publicKey = process.env.YOCO_PUBLIC_KEY || '';
    this.webhookSecret = process.env.YOCO_WEBHOOK_SECRET || '';
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://payments.yoco.com/api/v1'
      : 'https://payments-sandbox.yoco.com/api/v1';
      
    if (!this.apiKey) {
      logger.warn('Yoco API key not configured');
    }
  }
  
  /**
   * Initialize a payment with Yoco with enhanced error handling and validation
   */
  async initializePayment(params: {
    email: string;
    amount: number;
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
  }): Promise<{ authorization_url: string; access_code: string; reference: string; }> {
    try {
      // Validate input parameters
      if (!params.email || !params.amount) {
        throw new Error('Email and amount are required for Yoco payment');
      }
      
      if (params.amount < 100) {
        throw new Error('Minimum payment amount is R1.00 (100 cents)');
      }
      
      const reference = params.reference || `yoco_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const payload = {
        amount: Math.round(params.amount), // Ensure amount is in cents and rounded
        currency: 'ZAR',
        reference: reference,
        metadata: {
          email: params.email,
          timestamp: new Date().toISOString(),
          source: 'ai-job-chommie',
          ...params.metadata
        },
        successUrl: params.callback_url || `${process.env.FRONTEND_URL}/payment/success?ref=${reference}`,
        cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel?ref=${reference}`,
        failureUrl: `${process.env.FRONTEND_URL}/payment/failed?ref=${reference}`,
        webhookUrl: `${process.env.BACKEND_URL}/api/v1/webhooks/yoco`
      };
      
      const response = await this.makeApiCall('POST', '/checkouts', payload, {
        maxRetries: 3,
        timeout: 10000
      });
      
      if (!response.data?.redirectUrl) {
        throw new Error('Invalid response from Yoco: missing redirectUrl');
      }
      
      logger.info('Yoco payment initialized successfully', { 
        reference, 
        email: params.email,
        amount: params.amount,
        checkoutId: response.data.id
      });
      
      return {
        authorization_url: response.data.redirectUrl,
        access_code: response.data.id,
        reference: reference
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      logger.error('Error initializing Yoco payment:', {
        error: errorMessage,
        email: params.email,
        amount: params.amount,
        reference: params.reference
      });
      throw new Error(`Failed to initialize payment with Yoco: ${errorMessage}`);
    }
  }
  
  /**
   * Verify a payment with Yoco
   */
  async verifyPayment(reference: string): Promise<PaymentTransaction> {
    try {
      // First, try to find the checkout by reference
      const response = await axios.get(
        `${this.baseUrl}/checkouts?reference=${reference}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      if (!response.data.data || response.data.data.length === 0) {
        throw new Error('Payment not found');
      }
      
      const checkout = response.data.data[0];
      
      let status: 'pending' | 'success' | 'failed' = 'pending';
      if (checkout.status === 'succeeded') {
        status = 'success';
      } else if (checkout.status === 'failed' || checkout.status === 'cancelled') {
        status = 'failed';
      }
      
      return {
        reference: reference,
        amount: checkout.amount,
        status: status,
        provider: 'yoco',
        metadata: checkout.metadata
      };
    } catch (error) {
      logger.error('Error verifying Yoco payment:', error);
      throw new Error('Failed to verify payment with Yoco');
    }
  }
  
  /**
   * Create a subscription with Yoco
   * Note: Yoco subscription API might differ from this implementation
   */
  async createSubscription(params: {
    customer: PaymentCustomer;
    plan: string;
    authorization?: string;
  }): Promise<PaymentSubscription> {
    try {
      // First create or get customer
      const customerResponse = await axios.post(
        `${this.baseUrl}/customers`,
        {
          email: params.customer.email,
          firstName: params.customer.firstName,
          lastName: params.customer.lastName,
          phone: params.customer.phone,
          metadata: params.customer.metadata
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const customerId = customerResponse.data.id;
      
      // Create subscription
      const subscriptionResponse = await axios.post(
        `${this.baseUrl}/subscriptions`,
        {
          customerId: customerId,
          planId: params.plan,
          paymentMethodId: params.authorization
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const subscription = subscriptionResponse.data;
      
      return {
        id: subscription.id,
        customerEmail: params.customer.email,
        planCode: params.plan,
        status: subscription.status === 'active' ? 'active' : 'paused',
        nextPaymentDate: subscription.nextPaymentDate ? new Date(subscription.nextPaymentDate) : undefined,
        provider: 'yoco'
      };
    } catch (error) {
      logger.error('Error creating Yoco subscription:', error);
      throw new Error('Failed to create subscription with Yoco');
    }
  }
  
  /**
   * Cancel a subscription with Yoco
   */
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await axios.delete(
        `${this.baseUrl}/subscriptions/${subscriptionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return true;
    } catch (error) {
      logger.error('Error cancelling Yoco subscription:', error);
      throw new Error('Failed to cancel subscription with Yoco');
    }
  }
  
  /**
   * Get subscription details from Yoco
   */
  async getSubscription(subscriptionId: string): Promise<PaymentSubscription> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/subscriptions/${subscriptionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      const subscription = response.data;
      
      // Get customer email
      const customerResponse = await axios.get(
        `${this.baseUrl}/customers/${subscription.customerId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return {
        id: subscription.id,
        customerEmail: customerResponse.data.email,
        planCode: subscription.planId,
        status: subscription.status === 'active' ? 'active' : 
                subscription.status === 'cancelled' ? 'cancelled' : 'paused',
        nextPaymentDate: subscription.nextPaymentDate ? new Date(subscription.nextPaymentDate) : undefined,
        provider: 'yoco'
      };
    } catch (error) {
      logger.error('Error getting Yoco subscription:', error);
      throw new Error('Failed to get subscription from Yoco');
    }
  }
  
  /**
   * Verify webhook signature from Yoco
   */
  verifyWebhookSignature(body: any, signature: string): boolean {
    try {
      const payload = JSON.stringify(body);
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');
      
      return expectedSignature === signature;
    } catch (error) {
      logger.error('Error verifying Yoco webhook signature:', error);
      return false;
    }
  }
  
  /**
   * Handle webhook events from Yoco
   */
  async handleWebhook(event: any): Promise<void> {
    try {
      logger.info('Handling Yoco webhook event', { type: event.type });
      
      switch (event.type) {
        case 'checkout.succeeded':
          await this.handlePaymentSuccess(event.data);
          break;
          
        case 'checkout.failed':
          await this.handlePaymentFailed(event.data);
          break;
          
        case 'subscription.created':
          await this.handleSubscriptionCreated(event.data);
          break;
          
        case 'subscription.updated':
          await this.handleSubscriptionUpdated(event.data);
          break;
          
        case 'subscription.cancelled':
          await this.handleSubscriptionCancelled(event.data);
          break;
          
        default:
          logger.warn('Unhandled Yoco webhook event type', { type: event.type });
      }
    } catch (error) {
      logger.error('Error handling Yoco webhook:', error);
      throw error;
    }
  }
  
  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(data: any): Promise<void> {
    const reference = data.reference;
    const amount = data.amount;
    const email = data.metadata?.email;
    const plan = data.metadata?.plan || 'Professional';
    
    if (!email) {
      logger.error('No email found in payment metadata');
      return;
    }
    
    // Update user's subscription based on the payment
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      logger.error('User not found for payment', { email });
      return;
    }
    
    // Record the transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: amount / 100, // Convert from cents to Rands
        currency: 'ZAR',
        reference: reference,
        status: 'SUCCESS',
        provider: 'YOCO',
        metadata: data
      }
    });
    
    // Send payment confirmation email to customer only
    try {
      const notificationService = new NotificationService();
      await notificationService.sendPaymentConfirmation(user.id, {
        reference: reference,
        amount: amount,
        currency: 'ZAR',
        plan: plan,
        provider: 'yoco',
        date: new Date()
      });
      
      logger.info('Payment confirmation email sent to customer', { userId: user.id, reference });
      // Note: Manager can view payment data in Manager Dashboard - no email notifications sent to manager
    } catch (error) {
      logger.error('Failed to send payment confirmation email', { userId: user.id, error });
    }
    
    logger.info('Payment success recorded', { userId: user.id, reference });
  }
  
  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(data: any): Promise<void> {
    const reference = data.reference;
    const email = data.metadata?.email;
    
    if (!email) return;
    
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) return;
    
    // Record the failed transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: data.amount / 100,
        currency: 'ZAR',
        reference: reference,
        status: 'FAILED',
        provider: 'YOCO',
        metadata: data
      }
    });
    
    logger.info('Payment failure recorded', { userId: user.id, reference });
  }
  
  /**
   * Handle subscription created
   */
  private async handleSubscriptionCreated(data: any): Promise<void> {
    // Implementation depends on Yoco's subscription webhook structure
    logger.info('Subscription created via Yoco', { subscriptionId: data.id });
  }
  
  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(data: any): Promise<void> {
    // Implementation depends on Yoco's subscription webhook structure
    logger.info('Subscription updated via Yoco', { subscriptionId: data.id });
  }
  
  /**
   * Handle subscription cancelled
   */
  private async handleSubscriptionCancelled(data: any): Promise<void> {
    try {
      const subscriptionId = data.id;
      const customerId = data.customerId;
      
      // Find the subscription in our database
      const subscription = await prisma.subscription.findFirst({
        where: {
          subscriptionCode: subscriptionId,
          provider: 'YOCO'
        },
        include: { user: true }
      });
      
      if (subscription) {
        // Update subscription status
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date()
          }
        });
        
        // Downgrade user to FREE plan
        await this.downgradeUserToFree(subscription.userId);
        
        logger.info('Subscription cancelled and user downgraded', {
          subscriptionId,
          userId: subscription.userId
        });
      }
    } catch (error) {
      logger.error('Error handling subscription cancellation', { data, error });
    }
  }
  
  /**
   * Enhanced API call with retry logic and error handling
   */
  private async makeApiCall(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    options: {
      maxRetries?: number;
      timeout?: number;
      headers?: Record<string, string>;
    } = {}
  ): Promise<any> {
    const { maxRetries = 3, timeout = 10000, headers = {} } = options;
    const url = `${this.baseUrl}${endpoint}`;
    
    const requestConfig = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...headers
      },
      timeout,
      data: method !== 'GET' ? data : undefined,
      params: method === 'GET' ? data : undefined
    };
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios(requestConfig);
        
        // Log successful API call
        logger.debug('Yoco API call successful', {
          method,
          endpoint,
          attempt,
          status: response.status
        });
        
        return response;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const axiosError = error as AxiosError;
        
        logger.warn('Yoco API call failed', {
          method,
          endpoint,
          attempt,
          maxRetries,
          status: axiosError.response?.status,
          error: axiosError.message,
          isLastAttempt
        });
        
        // Don't retry on certain error types
        if (axiosError.response?.status && [
          400, // Bad Request
          401, // Unauthorized
          403, // Forbidden
          404, // Not Found
          422  // Unprocessable Entity
        ].includes(axiosError.response.status)) {
          throw error;
        }
        
        if (isLastAttempt) {
          throw error;
        }
        
        // Exponential backoff: wait 2^attempt seconds
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  /**
   * Extract meaningful error message from various error types
   */
  private getErrorMessage(error: any): string {
    if (error instanceof AxiosError) {
      if (error.response?.data?.message) {
        return error.response.data.message;
      }
      if (error.response?.data?.error) {
        return error.response.data.error;
      }
      if (error.response?.statusText) {
        return `HTTP ${error.response.status}: ${error.response.statusText}`;
      }
      return error.message;
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'Unknown error occurred';
  }
  
  /**
   * Tokenize a payment method for future use
   */
  async tokenizePaymentMethod(params: {
    customerId: string;
    cardNumber: string;
    expiryMonth: number;
    expiryYear: number;
    cvv: string;
  }): Promise<{ tokenId: string; last4: string; }> {
    try {
      const response = await this.makeApiCall('POST', '/payment-methods', {
        customerId: params.customerId,
        card: {
          number: params.cardNumber,
          expiryMonth: params.expiryMonth,
          expiryYear: params.expiryYear,
          cvv: params.cvv
        }
      });
      
      return {
        tokenId: response.data.id,
        last4: response.data.card.last4
      };
    } catch (error) {
      logger.error('Error tokenizing payment method:', error);
      throw new Error('Failed to tokenize payment method');
    }
  }
  
  /**
   * Get customer payment methods
   */
  async getCustomerPaymentMethods(customerId: string): Promise<any[]> {
    try {
      const response = await this.makeApiCall('GET', `/customers/${customerId}/payment-methods`);
      return response.data.data || [];
    } catch (error) {
      logger.error('Error getting customer payment methods:', error);
      return [];
    }
  }
  
  /**
   * Process refund for a payment
   */
  async processRefund(paymentId: string, amount?: number, reason?: string): Promise<{
    refundId: string;
    amount: number;
    status: string;
  }> {
    try {
      const payload: any = { paymentId };
      if (amount) payload.amount = amount;
      if (reason) payload.reason = reason;
      
      const response = await this.makeApiCall('POST', '/refunds', payload);
      
      return {
        refundId: response.data.id,
        amount: response.data.amount,
        status: response.data.status
      };
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw new Error('Failed to process refund');
    }
  }
  
  /**
   * Downgrade user to FREE plan after subscription cancellation
   */
  private async downgradeUserToFree(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: 'FREE',
          creditsRemaining: 2, // FREE plan quota
          monthlyQuota: 2,
          quotaResetDate: this.getNextQuotaResetDate(),
          subscriptionExpiry: null
        }
      });
      
      logger.info('User downgraded to FREE plan', { userId });
    } catch (error) {
      logger.error('Error downgrading user to FREE plan', { userId, error });
    }
  }
  
  /**
   * Get next quota reset date (first day of next month)
   */
  private getNextQuotaResetDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  
  /**
   * Upgrade user subscription and handle quota changes
   */
  async upgradeUserSubscription(
    userId: string,
    newPlan: SubscriptionPlan,
    paymentData: any
  ): Promise<void> {
    try {
      // Get plan quotas
      const quotas = await quotaService.getPlanQuotas(newPlan);
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: newPlan,
          creditsRemaining: quotas.monthlyApplications,
          monthlyQuota: quotas.monthlyApplications,
          quotaResetDate: this.getNextQuotaResetDate(),
          subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      });
      
      // Send upgrade confirmation
      try {
        const notificationService = new NotificationService();
        await notificationService.sendSubscriptionUpgradeConfirmation(userId, {
          newPlan,
          quotas,
          paymentData
        });
      } catch (error) {
        logger.error('Failed to send upgrade confirmation', { userId, error });
      }
      
      logger.info('User subscription upgraded successfully', {
        userId,
        newPlan,
        newQuota: quotas.monthlyApplications
      });
    } catch (error) {
      logger.error('Error upgrading user subscription', { userId, newPlan, error });
      throw error;
    }
  }
  
  /**
   * Create or get Yoco customer
   */
  async createOrGetCustomer(customerData: PaymentCustomer): Promise<string> {
    try {
      // First try to find existing customer
      const existingCustomer = await this.findCustomerByEmail(customerData.email);
      if (existingCustomer) {
        logger.info('Found existing Yoco customer', { 
          email: customerData.email,
          customerId: existingCustomer.id 
        });
        return existingCustomer.id;
      }
      
      // Create new customer
      const response = await this.makeApiCall('POST', '/customers', {
        email: customerData.email,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        phone: customerData.phone,
        metadata: {
          source: 'ai-job-chommie',
          ...customerData.metadata
        }
      });
      
      logger.info('Created new Yoco customer', {
        email: customerData.email,
        customerId: response.data.id
      });
      
      return response.data.id;
    } catch (error) {
      logger.error('Error creating/getting Yoco customer:', error);
      throw new Error('Failed to create or get customer');
    }
  }
  
  /**
   * Find customer by email
   */
  private async findCustomerByEmail(email: string): Promise<any | null> {
    try {
      const response = await this.makeApiCall('GET', '/customers', { email });
      const customers = response.data.data || [];
      return customers.find((customer: any) => customer.email === email) || null;
    } catch (error) {
      logger.debug('Customer not found or error searching', { email, error });
      return null;
    }
  }
  
  /**
   * Enhanced payment verification with detailed status checking
   */
  async getPaymentDetails(paymentId: string): Promise<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    reference: string;
    createdAt: Date;
    metadata?: any;
  }> {
    try {
      const response = await this.makeApiCall('GET', `/payments/${paymentId}`);
      const payment = response.data;
      
      return {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.reference,
        createdAt: new Date(payment.createdAt),
        metadata: payment.metadata
      };
    } catch (error) {
      logger.error('Error getting payment details:', error);
      throw new Error('Failed to get payment details');
    }
  }
  
  /**
   * Check if Yoco service is healthy
   */
  async isServiceHealthy(): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      // Make a simple API call to check service health
      await this.makeApiCall('GET', '/ping', undefined, {
        maxRetries: 1,
        timeout: 5000
      });
      
      const responseTime = Date.now() - startTime;
      const isHealthy = responseTime < 3000; // Consider healthy if response time < 3s
      
      logger.debug('Yoco health check completed', {
        responseTime,
        healthy: isHealthy
      });
      
      return isHealthy;
    } catch (error) {
      logger.warn('Yoco health check failed', { error: this.getErrorMessage(error) });
      return false;
    }
  }
  
  /**
   * Get transaction fees and currency conversion rates
   */
  async getTransactionFees(amount: number, currency: string = 'ZAR'): Promise<{
    processingFee: number;
    platformFee: number;
    totalFees: number;
    netAmount: number;
  }> {
    try {
      // Yoco's standard fees for South Africa
      const processingFeeRate = 0.029; // 2.9%
      const fixedFee = 0; // No fixed fee for most transactions
      
      const processingFee = Math.round((amount * processingFeeRate) + fixedFee);
      const platformFee = 0; // No additional platform fee
      const totalFees = processingFee + platformFee;
      const netAmount = amount - totalFees;
      
      return {
        processingFee,
        platformFee,
        totalFees,
        netAmount
      };
    } catch (error) {
      logger.error('Error calculating transaction fees:', error);
      throw new Error('Failed to calculate transaction fees');
    }
  }
  
  /**
   * Create a one-time payment link
   */
  async createPaymentLink(params: {
    amount: number;
    description: string;
    reference: string;
    expiresAt?: Date;
    metadata?: Record<string, any>;
  }): Promise<{
    paymentLinkId: string;
    url: string;
    expiresAt: Date;
  }> {
    try {
      const expiresAt = params.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours default
      
      const response = await this.makeApiCall('POST', '/payment-links', {
        amount: params.amount,
        currency: 'ZAR',
        description: params.description,
        reference: params.reference,
        expiresAt: expiresAt.toISOString(),
        metadata: params.metadata
      });
      
      return {
        paymentLinkId: response.data.id,
        url: response.data.url,
        expiresAt: new Date(response.data.expiresAt)
      };
    } catch (error) {
      logger.error('Error creating payment link:', error);
      throw new Error('Failed to create payment link');
    }
  }
}
