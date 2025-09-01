const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class SubscriptionService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.subscriptionsFile = path.join(this.dataDir, 'subscriptions.json');
    this.plansFile = path.join(this.dataDir, 'plans.json');
    this.ensureDirectoryExists();
    this.initializePlans();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.subscriptionsFile)) {
      fs.writeFileSync(this.subscriptionsFile, JSON.stringify([]), 'utf8');
    }
  }

  initializePlans() {
    if (!fs.existsSync(this.plansFile)) {
      const defaultPlans = [
        {
          id: 'plan_free',
          name: 'Free',
          description: 'Basic features for individuals',
          price: 0,
          currency: 'USD',
          interval: 'month',
          features: [
            '5 charging sessions per month',
            'Basic analytics',
            'Email support',
            '1 vehicle profile'
          ],
          limits: {
            chargingSessions: 5,
            vehicleProfiles: 1,
            apiCalls: 1000,
            storage: 100 // MB
          },
          active: true,
          popular: false
        },
        {
          id: 'plan_starter',
          name: 'Starter',
          description: 'Perfect for regular EV users',
          price: 19.99,
          currency: 'USD',
          interval: 'month',
          features: [
            '50 charging sessions per month',
            'Advanced analytics',
            'Priority email support',
            '3 vehicle profiles',
            'Charging history export',
            'Route planning'
          ],
          limits: {
            chargingSessions: 50,
            vehicleProfiles: 3,
            apiCalls: 10000,
            storage: 1000 // MB
          },
          active: true,
          popular: true
        },
        {
          id: 'plan_pro',
          name: 'Professional',
          description: 'For power users and small fleets',
          price: 49.99,
          currency: 'USD',
          interval: 'month',
          features: [
            'Unlimited charging sessions',
            'Advanced analytics & insights',
            'Priority support (24/7)',
            '10 vehicle profiles',
            'API access',
            'Custom reports',
            'Team collaboration',
            'Bulk operations'
          ],
          limits: {
            chargingSessions: -1, // unlimited
            vehicleProfiles: 10,
            apiCalls: 100000,
            storage: 10000 // MB
          },
          active: true,
          popular: false
        },
        {
          id: 'plan_enterprise',
          name: 'Enterprise',
          description: 'Custom solutions for large organizations',
          price: -1, // Custom pricing
          currency: 'USD',
          interval: 'month',
          features: [
            'Everything in Professional',
            'Unlimited vehicle profiles',
            'Dedicated account manager',
            'Custom integrations',
            'SLA guarantee',
            'On-premise deployment option',
            'Advanced security features',
            'Custom billing'
          ],
          limits: {
            chargingSessions: -1,
            vehicleProfiles: -1,
            apiCalls: -1,
            storage: -1
          },
          active: true,
          popular: false,
          customPricing: true
        }
      ];

      fs.writeFileSync(this.plansFile, JSON.stringify(defaultPlans, null, 2));
    }
  }

  /**
   * Get all available plans
   * @returns {Promise<Array>} List of plans
   */
  async getPlans() {
    try {
      const data = fs.readFileSync(this.plansFile, 'utf8');
      const plans = JSON.parse(data);
      return plans.filter(plan => plan.active);
    } catch (error) {
      console.error('Error fetching plans:', error);
      return [];
    }
  }

  /**
   * Get plan by ID
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} Plan details
   */
  async getPlanById(planId) {
    const plans = await this.getPlans();
    const plan = plans.find(p => p.id === planId);
    
    if (!plan) {
      throw new Error('Plan not found');
    }
    
    return plan;
  }

  /**
   * Create a new subscription
   * @param {Object} subscriptionData - Subscription data
   * @returns {Promise<Object>} Created subscription
   */
  async createSubscription(subscriptionData) {
    try {
      const plan = await this.getPlanById(subscriptionData.planId);
      
      const subscription = {
        id: uuidv4(),
        userId: subscriptionData.userId,
        planId: subscriptionData.planId,
        planName: plan.name,
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: this.calculatePeriodEnd(plan.interval),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        endedAt: null,
        trialStart: subscriptionData.trialDays ? new Date().toISOString() : null,
        trialEnd: subscriptionData.trialDays ? this.calculateTrialEnd(subscriptionData.trialDays) : null,
        paymentMethodId: subscriptionData.paymentMethodId,
        pricePerPeriod: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        metadata: subscriptionData.metadata || {},
        usage: {
          chargingSessions: 0,
          vehicleProfiles: 0,
          apiCalls: 0,
          storage: 0
        },
        invoices: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save subscription
      await this.saveSubscription(subscription);

      // Schedule recurring billing
      this.scheduleRecurringBilling(subscription);

      return {
        success: true,
        subscription
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  /**
   * Save subscription to storage
   * @param {Object} subscription - Subscription data
   */
  async saveSubscription(subscription) {
    const subscriptions = await this.getAllSubscriptions();
    subscriptions.push(subscription);
    fs.writeFileSync(this.subscriptionsFile, JSON.stringify(subscriptions, null, 2));
  }

  /**
   * Get all subscriptions
   * @returns {Promise<Array>} All subscriptions
   */
  async getAllSubscriptions() {
    try {
      const data = fs.readFileSync(this.subscriptionsFile, 'utf8');
      return JSON.parse(data) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get user's subscription
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User's active subscription
   */
  async getUserSubscription(userId) {
    const subscriptions = await this.getAllSubscriptions();
    const userSubscription = subscriptions.find(
      sub => sub.userId === userId && ['active', 'trialing'].includes(sub.status)
    );
    
    if (!userSubscription) {
      return null;
    }
    
    // Check if subscription needs renewal
    if (new Date(userSubscription.currentPeriodEnd) < new Date()) {
      await this.renewSubscription(userSubscription.id);
      return await this.getUserSubscription(userId);
    }
    
    return userSubscription;
  }

  /**
   * Update subscription (upgrade/downgrade)
   * @param {string} subscriptionId - Subscription ID
   * @param {string} newPlanId - New plan ID
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Updated subscription
   */
  async updateSubscription(subscriptionId, newPlanId, options = {}) {
    try {
      const subscriptions = await this.getAllSubscriptions();
      const subIndex = subscriptions.findIndex(s => s.id === subscriptionId);
      
      if (subIndex === -1) {
        throw new Error('Subscription not found');
      }
      
      const subscription = subscriptions[subIndex];
      const currentPlan = await this.getPlanById(subscription.planId);
      const newPlan = await this.getPlanById(newPlanId);
      
      // Calculate proration if immediate
      let proration = 0;
      if (options.immediate) {
        proration = this.calculateProration(subscription, currentPlan, newPlan);
      }
      
      // Update subscription
      subscription.planId = newPlanId;
      subscription.planName = newPlan.name;
      subscription.pricePerPeriod = newPlan.price;
      subscription.updatedAt = new Date().toISOString();
      
      if (options.immediate) {
        subscription.currentPeriodStart = new Date().toISOString();
        subscription.currentPeriodEnd = this.calculatePeriodEnd(newPlan.interval);
      } else {
        subscription.scheduledPlanId = newPlanId;
        subscription.scheduledPlanName = newPlan.name;
      }
      
      // Save updated subscription
      subscriptions[subIndex] = subscription;
      fs.writeFileSync(this.subscriptionsFile, JSON.stringify(subscriptions, null, 2));
      
      return {
        success: true,
        subscription,
        proration,
        changeType: currentPlan.price < newPlan.price ? 'upgrade' : 'downgrade',
        immediate: options.immediate
      };
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  /**
   * Cancel subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} options - Cancellation options
   * @returns {Promise<Object>} Canceled subscription
   */
  async cancelSubscription(subscriptionId, options = {}) {
    try {
      const subscriptions = await this.getAllSubscriptions();
      const subIndex = subscriptions.findIndex(s => s.id === subscriptionId);
      
      if (subIndex === -1) {
        throw new Error('Subscription not found');
      }
      
      const subscription = subscriptions[subIndex];
      
      if (options.immediate) {
        subscription.status = 'canceled';
        subscription.canceledAt = new Date().toISOString();
        subscription.endedAt = new Date().toISOString();
      } else {
        subscription.cancelAtPeriodEnd = true;
        subscription.canceledAt = new Date().toISOString();
      }
      
      subscription.cancellationReason = options.reason || null;
      subscription.cancellationFeedback = options.feedback || null;
      subscription.updatedAt = new Date().toISOString();
      
      // Save updated subscription
      subscriptions[subIndex] = subscription;
      fs.writeFileSync(this.subscriptionsFile, JSON.stringify(subscriptions, null, 2));
      
      return {
        success: true,
        subscription,
        immediate: options.immediate,
        refundAmount: options.immediate ? this.calculateRefund(subscription) : 0
      };
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Reactivate canceled subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Reactivated subscription
   */
  async reactivateSubscription(subscriptionId) {
    try {
      const subscriptions = await this.getAllSubscriptions();
      const subIndex = subscriptions.findIndex(s => s.id === subscriptionId);
      
      if (subIndex === -1) {
        throw new Error('Subscription not found');
      }
      
      const subscription = subscriptions[subIndex];
      
      if (subscription.status !== 'canceled' && !subscription.cancelAtPeriodEnd) {
        throw new Error('Subscription is not canceled');
      }
      
      subscription.status = 'active';
      subscription.cancelAtPeriodEnd = false;
      subscription.canceledAt = null;
      subscription.endedAt = null;
      subscription.updatedAt = new Date().toISOString();
      
      // Save updated subscription
      subscriptions[subIndex] = subscription;
      fs.writeFileSync(this.subscriptionsFile, JSON.stringify(subscriptions, null, 2));
      
      return {
        success: true,
        subscription
      };
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw new Error('Failed to reactivate subscription');
    }
  }

  /**
   * Renew subscription for next period
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Renewed subscription
   */
  async renewSubscription(subscriptionId) {
    try {
      const subscriptions = await this.getAllSubscriptions();
      const subIndex = subscriptions.findIndex(s => s.id === subscriptionId);
      
      if (subIndex === -1) {
        throw new Error('Subscription not found');
      }
      
      const subscription = subscriptions[subIndex];
      
      // Check if should be canceled
      if (subscription.cancelAtPeriodEnd) {
        subscription.status = 'canceled';
        subscription.endedAt = subscription.currentPeriodEnd;
      } else {
        // Renew subscription
        subscription.currentPeriodStart = subscription.currentPeriodEnd;
        subscription.currentPeriodEnd = this.calculatePeriodEnd(
          subscription.interval,
          new Date(subscription.currentPeriodEnd)
        );
        
        // Reset usage for new period
        subscription.usage = {
          chargingSessions: 0,
          vehicleProfiles: subscription.usage.vehicleProfiles, // Keep profiles
          apiCalls: 0,
          storage: subscription.usage.storage // Keep storage
        };
        
        // Apply scheduled plan change if any
        if (subscription.scheduledPlanId) {
          subscription.planId = subscription.scheduledPlanId;
          subscription.planName = subscription.scheduledPlanName;
          delete subscription.scheduledPlanId;
          delete subscription.scheduledPlanName;
        }
      }
      
      subscription.updatedAt = new Date().toISOString();
      
      // Save updated subscription
      subscriptions[subIndex] = subscription;
      fs.writeFileSync(this.subscriptionsFile, JSON.stringify(subscriptions, null, 2));
      
      return subscription;
    } catch (error) {
      console.error('Error renewing subscription:', error);
      throw new Error('Failed to renew subscription');
    }
  }

  /**
   * Update subscription usage
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} usage - Usage updates
   * @returns {Promise<Object>} Updated subscription
   */
  async updateUsage(subscriptionId, usage) {
    try {
      const subscriptions = await this.getAllSubscriptions();
      const subIndex = subscriptions.findIndex(s => s.id === subscriptionId);
      
      if (subIndex === -1) {
        throw new Error('Subscription not found');
      }
      
      const subscription = subscriptions[subIndex];
      const plan = await this.getPlanById(subscription.planId);
      
      // Update usage
      Object.keys(usage).forEach(key => {
        if (subscription.usage.hasOwnProperty(key)) {
          subscription.usage[key] += usage[key];
        }
      });
      
      // Check limits
      const limitExceeded = [];
      Object.keys(subscription.usage).forEach(key => {
        if (plan.limits[key] !== -1 && subscription.usage[key] > plan.limits[key]) {
          limitExceeded.push({
            resource: key,
            used: subscription.usage[key],
            limit: plan.limits[key]
          });
        }
      });
      
      subscription.updatedAt = new Date().toISOString();
      
      // Save updated subscription
      subscriptions[subIndex] = subscription;
      fs.writeFileSync(this.subscriptionsFile, JSON.stringify(subscriptions, null, 2));
      
      return {
        subscription,
        limitExceeded: limitExceeded.length > 0 ? limitExceeded : null
      };
    } catch (error) {
      console.error('Error updating usage:', error);
      throw new Error('Failed to update usage');
    }
  }

  /**
   * Get subscription analytics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Subscription analytics
   */
  async getSubscriptionAnalytics(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription) {
        return null;
      }
      
      const plan = await this.getPlanById(subscription.planId);
      
      const analytics = {
        currentPlan: plan,
        usage: subscription.usage,
        usagePercentage: {},
        daysRemaining: Math.ceil(
          (new Date(subscription.currentPeriodEnd) - new Date()) / (1000 * 60 * 60 * 24)
        ),
        nextBillingDate: subscription.currentPeriodEnd,
        totalSpent: this.calculateTotalSpent(subscription),
        recommendedPlan: await this.recommendPlan(subscription)
      };
      
      // Calculate usage percentages
      Object.keys(subscription.usage).forEach(key => {
        if (plan.limits[key] !== -1) {
          analytics.usagePercentage[key] = (subscription.usage[key] / plan.limits[key]) * 100;
        }
      });
      
      return analytics;
    } catch (error) {
      console.error('Error fetching subscription analytics:', error);
      throw new Error('Failed to fetch subscription analytics');
    }
  }

  /**
   * Calculate period end date
   * @param {string} interval - Billing interval
   * @param {Date} startDate - Start date
   * @returns {string} Period end date
   */
  calculatePeriodEnd(interval, startDate = new Date()) {
    const date = new Date(startDate);
    
    switch (interval) {
      case 'month':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() + 1);
        break;
      case 'week':
        date.setDate(date.getDate() + 7);
        break;
      default:
        date.setMonth(date.getMonth() + 1);
    }
    
    return date.toISOString();
  }

  /**
   * Calculate trial end date
   * @param {number} trialDays - Number of trial days
   * @returns {string} Trial end date
   */
  calculateTrialEnd(trialDays) {
    const date = new Date();
    date.setDate(date.getDate() + trialDays);
    return date.toISOString();
  }

  /**
   * Calculate proration amount
   * @param {Object} subscription - Subscription
   * @param {Object} currentPlan - Current plan
   * @param {Object} newPlan - New plan
   * @returns {number} Proration amount
   */
  calculateProration(subscription, currentPlan, newPlan) {
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const periodStart = new Date(subscription.currentPeriodStart);
    
    const totalDays = (periodEnd - periodStart) / (1000 * 60 * 60 * 24);
    const remainingDays = (periodEnd - now) / (1000 * 60 * 60 * 24);
    
    const currentCredit = (currentPlan.price / totalDays) * remainingDays;
    const newCharge = (newPlan.price / totalDays) * remainingDays;
    
    return newCharge - currentCredit;
  }

  /**
   * Calculate refund amount
   * @param {Object} subscription - Subscription
   * @returns {number} Refund amount
   */
  calculateRefund(subscription) {
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const periodStart = new Date(subscription.currentPeriodStart);
    
    const totalDays = (periodEnd - periodStart) / (1000 * 60 * 60 * 24);
    const remainingDays = (periodEnd - now) / (1000 * 60 * 60 * 24);
    
    return (subscription.pricePerPeriod / totalDays) * remainingDays;
  }

  /**
   * Calculate total spent on subscription
   * @param {Object} subscription - Subscription
   * @returns {number} Total spent
   */
  calculateTotalSpent(subscription) {
    const months = Math.floor(
      (new Date() - new Date(subscription.createdAt)) / (1000 * 60 * 60 * 24 * 30)
    );
    
    return months * subscription.pricePerPeriod;
  }

  /**
   * Recommend plan based on usage
   * @param {Object} subscription - Subscription
   * @returns {Promise<Object>} Recommended plan
   */
  async recommendPlan(subscription) {
    const plans = await this.getPlans();
    const currentPlan = plans.find(p => p.id === subscription.planId);
    
    // Find plan that best fits usage
    let recommendedPlan = currentPlan;
    
    for (const plan of plans) {
      if (plan.customPricing) continue;
      
      const fitsUsage = Object.keys(subscription.usage).every(key => {
        return plan.limits[key] === -1 || subscription.usage[key] <= plan.limits[key];
      });
      
      if (fitsUsage && plan.price < recommendedPlan.price) {
        recommendedPlan = plan;
      }
    }
    
    // Check if upgrade is needed
    const needsUpgrade = Object.keys(subscription.usage).some(key => {
      return currentPlan.limits[key] !== -1 && subscription.usage[key] > currentPlan.limits[key] * 0.8;
    });
    
    if (needsUpgrade) {
      const upgradePlan = plans.find(p => 
        !p.customPricing && p.price > currentPlan.price
      );
      if (upgradePlan) {
        recommendedPlan = upgradePlan;
      }
    }
    
    return recommendedPlan.id !== currentPlan.id ? recommendedPlan : null;
  }

  /**
   * Schedule recurring billing
   * @param {Object} subscription - Subscription
   */
  scheduleRecurringBilling(subscription) {
    // In a real implementation, this would integrate with a job scheduler
    // or payment processor's subscription management
    console.log(`Scheduled recurring billing for subscription ${subscription.id}`);
  }
}

module.exports = new SubscriptionService();
