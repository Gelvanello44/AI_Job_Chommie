/**
 * Payment Service
 * Manages multiple payment providers and handles provider selection
 */

import { PaymentProvider, PaymentCustomer, PaymentTransaction, PaymentSubscription } from './PaymentProvider.interface';
import { YocoProvider } from './YocoProvider';
import { PaystackProvider } from './PaystackProvider';
import { paymentHealthMonitor } from './PaymentHealthMonitor';
import { logger } from '../../utils/logger';
import { prisma } from '../../utils/prisma';

export type PaymentProviderType = 'yoco' | 'paystack';

interface PaymentInitParams {
  provider?: PaymentProviderType;
  email: string;
  amount: number;
  currency?: string;
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
}

interface SubscriptionParams {
  provider?: PaymentProviderType;
  customer: PaymentCustomer;
  plan: string;
  authorization?: string;
}

export class PaymentService {
  private providers: Map<PaymentProviderType, PaymentProvider>;
  private defaultProvider: PaymentProviderType;
  
  constructor() {
    this.providers = new Map();
    
    // Initialize providers
    this.providers.set('yoco', new YocoProvider());
    this.providers.set('paystack', new PaystackProvider());
    
    // Set default provider based on environment configuration
    this.defaultProvider = (process.env.DEFAULT_PAYMENT_PROVIDER as PaymentProviderType) || 'paystack';
    
    logger.info('Payment service initialized', { 
      defaultProvider: this.defaultProvider,
      availableProviders: Array.from(this.providers.keys())
    });
  }
  
  /**
   * Get a specific payment provider
   */
  private getProvider(providerName?: PaymentProviderType): PaymentProvider {
    const provider = providerName || this.defaultProvider;
    const paymentProvider = this.providers.get(provider);
    
    if (!paymentProvider) {
      throw new Error(`Payment provider ${provider} not found`);
    }
    
    return paymentProvider;
  }
  
  /**
   * Determine the best provider based on various factors with enhanced Yoco prioritization
   */
  async determineProvider(params: {
    country?: string;
    currency?: string;
    userPreference?: PaymentProviderType;
    amount?: number;
    paymentType?: 'one-time' | 'subscription';
  }): Promise<PaymentProviderType> {
    // User preference takes priority
    if (params.userPreference && this.providers.has(params.userPreference)) {
      // Validate that the preferred provider supports the currency/country
      if (await this.validateProviderSupport(params.userPreference, params)) {
        return params.userPreference;
      }
      logger.warn('User preferred provider not supported for request', {
        userPreference: params.userPreference,
        country: params.country,
        currency: params.currency
      });
    }
    
    // Enhanced currency-based selection with regional optimization
    if (params.currency) {
      const currency = params.currency.toUpperCase();
      
      // Prioritize Yoco for ZAR transactions (South African focus)
      if (currency === 'ZAR') {
        if (await this.isProviderHealthy('yoco')) {
          logger.info('Selected Yoco for ZAR transaction', { currency, country: params.country });
          return 'yoco';
        }
        // Fallback to Paystack if Yoco is unhealthy
        logger.warn('Yoco unavailable, falling back to Paystack for ZAR', { currency });
        return 'paystack';
      }
      
      // Paystack for other African currencies
      if (['NGN', 'GHS', 'KES', 'EGP'].includes(currency)) {
        return 'paystack';
      }
      
      // USD support - prefer Yoco for South African users, Paystack otherwise
      if (currency === 'USD') {
        if (params.country === 'ZA' || this.defaultProvider === 'yoco') {
          return 'yoco';
        }
        return 'paystack';
      }
    }
    
    // Enhanced country-based selection
    if (params.country) {
      const countryCode = params.country.toUpperCase();
      
      // South Africa - strongly prioritize Yoco
      if (countryCode === 'ZA') {
        if (await this.isProviderHealthy('yoco')) {
          return 'yoco';
        }
        // Fallback to Paystack if Yoco is down
        logger.warn('Yoco unavailable for ZA user, using Paystack fallback');
        return 'paystack';
      }
      
      // Other African countries - use Paystack
      if (['NG', 'GH', 'KE', 'EG', 'TZ', 'UG', 'RW'].includes(countryCode)) {
        return 'paystack';
      }
    }
    
    // Provider health-based fallback logic
    const primaryProvider = this.defaultProvider;
    if (await this.isProviderHealthy(primaryProvider)) {
      return primaryProvider;
    }
    
    // Find healthy fallback provider
    const fallbackProvider = primaryProvider === 'yoco' ? 'paystack' : 'yoco';
    if (await this.isProviderHealthy(fallbackProvider)) {
      logger.warn('Primary provider unhealthy, using fallback', {
        primaryProvider,
        fallbackProvider
      });
      return fallbackProvider;
    }
    
    // Last resort - return default provider
    logger.error('All providers appear unhealthy, using default');
    return this.defaultProvider;
  }
  
  /**
   * Initialize a payment with automatic provider selection
   */
  async initializePayment(params: PaymentInitParams): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
    provider: PaymentProviderType;
  }> {
    try {
      // Determine provider if not specified
      let provider = params.provider;
      if (!provider) {
        // Try to get user's country from their profile
        const user = await prisma.user.findUnique({
          where: { email: params.email },
          select: { country: true, preferredPaymentProvider: true }
        });
        
        provider = await this.determineProvider({
          country: user?.country || undefined,
          currency: params.currency,
          userPreference: user?.preferredPaymentProvider as PaymentProviderType
        });
      }
      
      const paymentProvider = this.getProvider(provider);
      const result = await paymentProvider.initializePayment({
        email: params.email,
        amount: params.amount,
        reference: params.reference,
        callback_url: params.callback_url,
        metadata: {
          ...params.metadata,
          provider: provider // Include provider in metadata
        }
      });
      
      // Store payment intent in database
      await prisma.paymentIntent.create({
        data: {
          reference: result.reference,
          provider: provider.toUpperCase(),
          amount: params.amount,
          currency: params.currency || 'NGN',
          email: params.email,
          status: 'PENDING',
          metadata: params.metadata
        }
      });
      
      return {
        ...result,
        provider
      };
    } catch (error) {
      logger.error('Error initializing payment', { error, params });
      throw error;
    }
  }
  
  /**
   * Verify a payment
   */
  async verifyPayment(reference: string, provider?: PaymentProviderType): Promise<PaymentTransaction> {
    try {
      // If provider not specified, try to determine from reference prefix or database
      if (!provider) {
        if (reference.startsWith('yoco_')) {
          provider = 'yoco';
        } else if (reference.startsWith('paystack_')) {
          provider = 'paystack';
        } else {
          // Check database for payment intent
          const intent = await prisma.paymentIntent.findUnique({
            where: { reference }
          });
          
          if (intent?.provider) {
            provider = intent.provider.toLowerCase() as PaymentProviderType;
          }
        }
      }
      
      const paymentProvider = this.getProvider(provider);
      const transaction = await paymentProvider.verifyPayment(reference);
      
      // Update payment intent status
      await prisma.paymentIntent.update({
        where: { reference },
        data: { 
          status: transaction.status === 'success' ? 'SUCCESS' : 
                 transaction.status === 'failed' ? 'FAILED' : 'PENDING'
        }
      });
      
      return transaction;
    } catch (error) {
      logger.error('Error verifying payment', { error, reference, provider });
      throw error;
    }
  }
  
  /**
   * Create a subscription
   */
  async createSubscription(params: SubscriptionParams): Promise<PaymentSubscription> {
    try {
      const provider = params.provider || this.defaultProvider;
      const paymentProvider = this.getProvider(provider);
      
      const subscription = await paymentProvider.createSubscription({
        customer: params.customer,
        plan: params.plan,
        authorization: params.authorization
      });
      
      // Store subscription in database
      const user = await prisma.user.findUnique({
        where: { email: params.customer.email }
      });
      
      if (user) {
        await prisma.subscription.create({
          data: {
            userId: user.id,
            subscriptionCode: subscription.id,
            provider: provider.toUpperCase(),
            planCode: params.plan,
            status: subscription.status.toUpperCase(),
            nextPaymentDate: subscription.nextPaymentDate
          }
        });
      }
      
      return subscription;
    } catch (error) {
      logger.error('Error creating subscription', { error, params });
      throw error;
    }
  }
  
  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, provider?: PaymentProviderType): Promise<boolean> {
    try {
      // If provider not specified, check database
      if (!provider) {
        const subscription = await prisma.subscription.findUnique({
          where: { subscriptionCode: subscriptionId }
        });
        
        if (subscription?.provider) {
          provider = subscription.provider.toLowerCase() as PaymentProviderType;
        }
      }
      
      const paymentProvider = this.getProvider(provider);
      const result = await paymentProvider.cancelSubscription(subscriptionId);
      
      // Update subscription status in database
      if (result) {
        await prisma.subscription.update({
          where: { subscriptionCode: subscriptionId },
          data: { status: 'CANCELLED' }
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Error cancelling subscription', { error, subscriptionId, provider });
      throw error;
    }
  }
  
  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string, provider?: PaymentProviderType): Promise<PaymentSubscription> {
    try {
      // If provider not specified, check database
      if (!provider) {
        const subscription = await prisma.subscription.findUnique({
          where: { subscriptionCode: subscriptionId }
        });
        
        if (subscription?.provider) {
          provider = subscription.provider.toLowerCase() as PaymentProviderType;
        }
      }
      
      const paymentProvider = this.getProvider(provider);
      return await paymentProvider.getSubscription(subscriptionId);
    } catch (error) {
      logger.error('Error getting subscription', { error, subscriptionId, provider });
      throw error;
    }
  }
  
  /**
   * Handle webhook verification
   */
  verifyWebhookSignature(provider: PaymentProviderType, body: any, signature: string): boolean {
    try {
      const paymentProvider = this.getProvider(provider);
      return paymentProvider.verifyWebhookSignature(body, signature);
    } catch (error) {
      logger.error('Error verifying webhook signature', { error, provider });
      return false;
    }
  }
  
  /**
   * Handle webhook events
   */
  async handleWebhook(provider: PaymentProviderType, event: any): Promise<void> {
    try {
      const paymentProvider = this.getProvider(provider);
      await paymentProvider.handleWebhook(event);
    } catch (error) {
      logger.error('Error handling webhook', { error, provider, event });
      throw error;
    }
  }
  
  /**
   * Get all available providers
   */
  getAvailableProviders(): PaymentProviderType[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Get provider configuration
   */
  getProviderConfig(provider: PaymentProviderType): {
    name: string;
    supportedCurrencies: string[];
    supportedCountries: string[];
  } {
    const configs = {
      yoco: {
        name: 'Yoco',
        supportedCurrencies: ['ZAR', 'USD'],
        supportedCountries: ['ZA']
      },
      paystack: {
        name: 'Paystack',
        supportedCurrencies: ['NGN', 'GHS', 'ZAR', 'USD', 'KES', 'EGP'],
        supportedCountries: ['NG', 'GH', 'ZA', 'KE', 'EG', 'TZ', 'UG', 'RW']
      }
    };
    
    return configs[provider];
  }
  
  /**
   * Validate if a provider supports the given currency and country
   */
  private async validateProviderSupport(
    provider: PaymentProviderType,
    params: { currency?: string; country?: string }
  ): Promise<boolean> {
    const config = this.getProviderConfig(provider);
    
    // Check currency support
    if (params.currency) {
      const currency = params.currency.toUpperCase();
      if (!config.supportedCurrencies.includes(currency)) {
        return false;
      }
    }
    
    // Check country support
    if (params.country) {
      const country = params.country.toUpperCase();
      if (!config.supportedCountries.includes(country)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check provider health status using health monitor
   */
  private async isProviderHealthy(provider: PaymentProviderType): Promise<boolean> {
    try {
      return await paymentHealthMonitor.shouldUseProvider(provider);
    } catch (error) {
      logger.error('Error checking provider health', { provider, error });
      // Assume healthy if we can't check
      return true;
    }
  }
  
  /**
   * Perform actual health check against provider API
   */
  private async performHealthCheck(provider: PaymentProviderType): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      if (provider === 'yoco') {
        // Simple API call to check Yoco health
        const response = await fetch(`${process.env.NODE_ENV === 'production' ? 'https://payments.yoco.com/api/v1' : 'https://payments-sandbox.yoco.com/api/v1'}/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.YOCO_SECRET_KEY}`
          },
          timeout: 5000
        }).catch(() => null);
        
        const responseTime = Date.now() - startTime;
        const isHealthy = response?.ok && responseTime < 3000;
        
        // Log health check metrics
        await this.logProviderMetrics(provider, {
          responseTime,
          status: response?.status || 0,
          healthy: isHealthy
        });
        
        return isHealthy;
      } else if (provider === 'paystack') {
        // Simple API call to check Paystack health
        const response = await fetch('https://api.paystack.co/bank', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          },
          timeout: 5000
        }).catch(() => null);
        
        const responseTime = Date.now() - startTime;
        const isHealthy = response?.ok && responseTime < 3000;
        
        // Log health check metrics
        await this.logProviderMetrics(provider, {
          responseTime,
          status: response?.status || 0,
          healthy: isHealthy
        });
        
        return isHealthy;
      }
      
      return true; // Unknown provider, assume healthy
    } catch (error) {
      logger.error('Health check failed', { provider, error });
      return false;
    }
  }
  
  /**
   * Get cached health status from Redis
   */
  private async getCachedHealth(cacheKey: string): Promise<boolean | null> {
    try {
      // This would use Redis in a real implementation
      // For now, return null to always perform health checks
      return null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Cache health status in Redis
   */
  private async setCachedHealth(cacheKey: string, isHealthy: boolean, ttl: number): Promise<void> {
    try {
      // This would use Redis in a real implementation
      logger.debug('Caching provider health status', { cacheKey, isHealthy, ttl });
    } catch (error) {
      logger.warn('Failed to cache health status', { cacheKey, error });
    }
  }
  
  /**
   * Log provider performance metrics
   */
  private async logProviderMetrics(provider: PaymentProviderType, metrics: {
    responseTime: number;
    status: number;
    healthy: boolean;
  }): Promise<void> {
    try {
      logger.info('Provider health check completed', {
        provider,
        responseTime: metrics.responseTime,
        status: metrics.status,
        healthy: metrics.healthy,
        timestamp: new Date().toISOString()
      });
      
      // In a production system, you would store these metrics for monitoring
      // await this.storeMetricsInDatabase(provider, metrics);
    } catch (error) {
      logger.warn('Failed to log provider metrics', { provider, error });
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
