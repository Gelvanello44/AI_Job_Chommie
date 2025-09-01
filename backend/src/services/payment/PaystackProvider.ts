/**
 * Paystack Payment Provider Implementation
 * Handles payments and subscriptions through Paystack
 */

import axios from 'axios';
import crypto from 'crypto';
import { PaymentProvider, PaymentCustomer, PaymentTransaction, PaymentSubscription } from './PaymentProvider.interface';
import { logger } from '../../utils/logger';
import { prisma } from '../../utils/prisma';

export class PaystackProvider implements PaymentProvider {
  name: 'paystack' = 'paystack';
  private secretKey: string;
  private publicKey: string;
  private webhookSecret: string;
  private baseUrl: string = 'https://api.paystack.co';
  
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY || '';
    this.webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || '';
    
    if (!this.secretKey) {
      logger.warn('Paystack secret key not configured');
    }
  }
  
  /**
   * Initialize a payment with Paystack
   */
  async initializePayment(params: {
    email: string;
    amount: number;
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
  }): Promise<{ authorization_url: string; access_code: string; reference: string; }> {
    try {
      const reference = params.reference || `paystack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email: params.email,
          amount: params.amount, // Paystack expects amount in kobo (cents)
          reference: reference,
          callback_url: params.callback_url || `${process.env.FRONTEND_URL}/payment/verify`,
          metadata: {
            custom_fields: [
              {
                display_name: "Email",
                variable_name: "email",
                value: params.email
              }
            ],
            ...params.metadata
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to initialize payment');
      }
      
      logger.info('Paystack payment initialized', { reference, email: params.email });
      
      return {
        authorization_url: response.data.data.authorization_url,
        access_code: response.data.data.access_code,
        reference: response.data.data.reference
      };
    } catch (error) {
      logger.error('Error initializing Paystack payment:', error);
      throw new Error('Failed to initialize payment with Paystack');
    }
  }
  
  /**
   * Verify a payment with Paystack
   */
  async verifyPayment(reference: string): Promise<PaymentTransaction> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`
          }
        }
      );
      
      if (!response.data.status) {
        throw new Error('Payment verification failed');
      }
      
      const transaction = response.data.data;
      
      let status: 'pending' | 'success' | 'failed' = 'pending';
      if (transaction.status === 'success') {
        status = 'success';
      } else if (transaction.status === 'failed') {
        status = 'failed';
      }
      
      return {
        reference: transaction.reference,
        amount: transaction.amount,
        status: status,
        provider: 'paystack',
        metadata: transaction.metadata
      };
    } catch (error) {
      logger.error('Error verifying Paystack payment:', error);
      throw new Error('Failed to verify payment with Paystack');
    }
  }
  
  /**
   * Create a subscription with Paystack
   */
  async createSubscription(params: {
    customer: PaymentCustomer;
    plan: string;
    authorization?: string;
  }): Promise<PaymentSubscription> {
    try {
      // First, create or get customer
      let customerCode: string;
      
      // Check if customer exists
      const customerCheckResponse = await axios.get(
        `${this.baseUrl}/customer/${params.customer.email}`,
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`
          }
        }
      ).catch(() => null);
      
      if (customerCheckResponse && customerCheckResponse.data.status) {
        customerCode = customerCheckResponse.data.data.customer_code;
      } else {
        // Create new customer
        const customerResponse = await axios.post(
          `${this.baseUrl}/customer`,
          {
            email: params.customer.email,
            first_name: params.customer.firstName,
            last_name: params.customer.lastName,
            phone: params.customer.phone,
            metadata: params.customer.metadata
          },
          {
            headers: {
              'Authorization': `Bearer ${this.secretKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!customerResponse.data.status) {
          throw new Error('Failed to create customer');
        }
        
        customerCode = customerResponse.data.data.customer_code;
      }
      
      // Create subscription
      const subscriptionResponse = await axios.post(
        `${this.baseUrl}/subscription`,
        {
          customer: customerCode,
          plan: params.plan,
          authorization: params.authorization
        },
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!subscriptionResponse.data.status) {
        throw new Error('Failed to create subscription');
      }
      
      const subscription = subscriptionResponse.data.data;
      
      return {
        id: subscription.subscription_code,
        customerEmail: params.customer.email,
        planCode: params.plan,
        status: subscription.status === 'active' ? 'active' : 'paused',
        nextPaymentDate: subscription.next_payment_date ? new Date(subscription.next_payment_date) : undefined,
        provider: 'paystack'
      };
    } catch (error) {
      logger.error('Error creating Paystack subscription:', error);
      throw new Error('Failed to create subscription with Paystack');
    }
  }
  
  /**
   * Cancel a subscription with Paystack
   */
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/subscription/disable`,
        {
          code: subscriptionId,
          token: subscriptionId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.status === true;
    } catch (error) {
      logger.error('Error cancelling Paystack subscription:', error);
      throw new Error('Failed to cancel subscription with Paystack');
    }
  }
  
  /**
   * Get subscription details from Paystack
   */
  async getSubscription(subscriptionId: string): Promise<PaymentSubscription> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/subscription/${subscriptionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`
          }
        }
      );
      
      if (!response.data.status) {
        throw new Error('Subscription not found');
      }
      
      const subscription = response.data.data;
      
      return {
        id: subscription.subscription_code,
        customerEmail: subscription.customer.email,
        planCode: subscription.plan.plan_code,
        status: subscription.status === 'active' ? 'active' : 
                subscription.status === 'cancelled' ? 'cancelled' : 'paused',
        nextPaymentDate: subscription.next_payment_date ? new Date(subscription.next_payment_date) : undefined,
        provider: 'paystack'
      };
    } catch (error) {
      logger.error('Error getting Paystack subscription:', error);
      throw new Error('Failed to get subscription from Paystack');
    }
  }
  
  /**
   * Verify webhook signature from Paystack
   */
  verifyWebhookSignature(body: any, signature: string): boolean {
    try {
      const hash = crypto
        .createHmac('sha512', this.webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');
      
      return hash === signature;
    } catch (error) {
      logger.error('Error verifying Paystack webhook signature:', error);
      return false;
    }
  }
  
  /**
   * Handle webhook events from Paystack
   */
  async handleWebhook(event: any): Promise<void> {
    try {
      logger.info('Handling Paystack webhook event', { event: event.event });
      
      switch (event.event) {
        case 'charge.success':
          await this.handleChargeSuccess(event.data);
          break;
          
        case 'charge.failed':
          await this.handleChargeFailed(event.data);
          break;
          
        case 'subscription.create':
          await this.handleSubscriptionCreate(event.data);
          break;
          
        case 'subscription.disable':
          await this.handleSubscriptionDisable(event.data);
          break;
          
        case 'invoice.create':
        case 'invoice.update':
          await this.handleInvoiceEvent(event.data);
          break;
          
        default:
          logger.warn('Unhandled Paystack webhook event type', { event: event.event });
      }
    } catch (error) {
      logger.error('Error handling Paystack webhook:', error);
      throw error;
    }
  }
  
  /**
   * Handle successful charge
   */
  private async handleChargeSuccess(data: any): Promise<void> {
    const reference = data.reference;
    const amount = data.amount;
    const email = data.customer.email;
    
    // Update user's subscription based on the payment
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      logger.error('User not found for payment', { email });
      return;
    }
    
    // Record the transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: amount / 100, // Convert from kobo to Naira
        currency: data.currency,
        reference: reference,
        status: 'SUCCESS',
        provider: 'PAYSTACK',
        metadata: data
      }
    });
    
    logger.info('Payment success recorded', { userId: user.id, reference });
  }
  
  /**
   * Handle failed charge
   */
  private async handleChargeFailed(data: any): Promise<void> {
    const reference = data.reference;
    const email = data.customer.email;
    
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) return;
    
    // Record the failed transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: data.amount / 100,
        currency: data.currency,
        reference: reference,
        status: 'FAILED',
        provider: 'PAYSTACK',
        metadata: data
      }
    });
    
    logger.info('Payment failure recorded', { userId: user.id, reference });
  }
  
  /**
   * Handle subscription creation
   */
  private async handleSubscriptionCreate(data: any): Promise<void> {
    logger.info('Subscription created via Paystack', { 
      subscriptionCode: data.subscription_code,
      customer: data.customer.email
    });
    
    // You can add additional logic here to update user's subscription status
  }
  
  /**
   * Handle subscription disable
   */
  private async handleSubscriptionDisable(data: any): Promise<void> {
    logger.info('Subscription disabled via Paystack', { 
      subscriptionCode: data.subscription_code
    });
    
    // Update user's subscription status in database
  }
  
  /**
   * Handle invoice events
   */
  private async handleInvoiceEvent(data: any): Promise<void> {
    logger.info('Invoice event received from Paystack', { 
      invoiceCode: data.invoice_code,
      status: data.status
    });
  }
}
