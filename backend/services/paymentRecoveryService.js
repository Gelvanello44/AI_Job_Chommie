const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class PaymentRecoveryService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.recoveryFile = path.join(this.dataDir, 'payment-recovery.json');
    this.retryScheduleFile = path.join(this.dataDir, 'retry-schedule.json');
    this.ensureDirectoryExists();
    this.initializeRetrySchedule();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.recoveryFile)) {
      fs.writeFileSync(this.recoveryFile, JSON.stringify([]), 'utf8');
    }
    if (!fs.existsSync(this.retryScheduleFile)) {
      fs.writeFileSync(this.retryScheduleFile, JSON.stringify([]), 'utf8');
    }
  }

  initializeRetrySchedule() {
    // Default retry schedule configuration
    this.retryConfig = {
      maxRetries: 4,
      retryIntervals: [
        { attempt: 1, delay: 1, unit: 'days' },    // 1 day after failure
        { attempt: 2, delay: 3, unit: 'days' },    // 3 days after first retry
        { attempt: 3, delay: 5, unit: 'days' },    // 5 days after second retry
        { attempt: 4, delay: 7, unit: 'days' }     // 7 days after third retry
      ],
      strategies: {
        subscription: 'smart_retry',
        one_time: 'standard',
        invoice: 'escalating'
      },
      notifications: {
        email: true,
        sms: false,
        inApp: true
      }
    };
  }

  /**
   * Create a recovery case for failed payment
   * @param {Object} paymentData - Failed payment data
   * @returns {Promise<Object>} Recovery case
   */
  async createRecoveryCase(paymentData) {
    try {
      const recoveryCase = {
        id: uuidv4(),
        paymentId: paymentData.paymentId,
        userId: paymentData.userId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'USD',
        paymentType: paymentData.paymentType, // 'subscription', 'one_time', 'invoice'
        failureReason: paymentData.failureReason,
        failureCode: paymentData.failureCode,
        paymentMethodId: paymentData.paymentMethodId,
        subscriptionId: paymentData.subscriptionId || null,
        invoiceId: paymentData.invoiceId || null,
        status: 'active',
        retryCount: 0,
        maxRetries: this.retryConfig.maxRetries,
        nextRetryAt: this.calculateNextRetryTime(0),
        recoveryStrategy: this.determineStrategy(paymentData),
        notifications: [],
        timeline: [{
          timestamp: new Date().toISOString(),
          event: 'case_created',
          details: `Recovery case created for failed payment of ${paymentData.currency} ${paymentData.amount}`
        }],
        metadata: paymentData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save recovery case
      const cases = this.getRecoveryCases();
      cases.push(recoveryCase);
      fs.writeFileSync(this.recoveryFile, JSON.stringify(cases, null, 2));

      // Schedule first retry
      await this.scheduleRetry(recoveryCase);

      // Send initial notification
      await this.sendFailureNotification(recoveryCase);

      return {
        success: true,
        recoveryCase
      };
    } catch (error) {
      console.error('Error creating recovery case:', error);
      throw new Error('Failed to create recovery case');
    }
  }

  /**
   * Determine recovery strategy based on payment type and failure reason
   * @param {Object} paymentData - Payment data
   * @returns {string} Strategy name
   */
  determineStrategy(paymentData) {
    const { paymentType, failureReason, failureCode } = paymentData;

    // Insufficient funds - use gentle reminders
    if (failureCode === 'insufficient_funds' || failureCode === 'card_declined') {
      return 'gentle_retry';
    }

    // Expired card - prompt for update
    if (failureCode === 'expired_card') {
      return 'update_payment_method';
    }

    // Processing error - retry quickly
    if (failureCode === 'processing_error' || failureCode === 'network_error') {
      return 'quick_retry';
    }

    // Default strategies by payment type
    return this.retryConfig.strategies[paymentType] || 'standard';
  }

  /**
   * Process retry attempt
   * @param {string} caseId - Recovery case ID
   * @returns {Promise<Object>} Retry result
   */
  async processRetry(caseId) {
    try {
      const cases = this.getRecoveryCases();
      const caseIndex = cases.findIndex(c => c.id === caseId);
      
      if (caseIndex === -1) {
        throw new Error('Recovery case not found');
      }

      const recoveryCase = cases[caseIndex];
      
      if (recoveryCase.status !== 'active') {
        return {
          success: false,
          message: 'Recovery case is not active'
        };
      }

      // Simulate payment retry
      const retryResult = await this.attemptPaymentRetry(recoveryCase);
      
      recoveryCase.retryCount++;
      recoveryCase.timeline.push({
        timestamp: new Date().toISOString(),
        event: 'retry_attempted',
        details: `Retry attempt #${recoveryCase.retryCount}`,
        result: retryResult.success ? 'success' : 'failed'
      });

      if (retryResult.success) {
        // Payment succeeded
        recoveryCase.status = 'recovered';
        recoveryCase.recoveredAt = new Date().toISOString();
        recoveryCase.recoveredAmount = recoveryCase.amount;
        
        // Send success notification
        await this.sendRecoverySuccessNotification(recoveryCase);
      } else {
        // Payment failed again
        if (recoveryCase.retryCount >= recoveryCase.maxRetries) {
          // Max retries reached
          recoveryCase.status = 'failed';
          recoveryCase.failedAt = new Date().toISOString();
          
          // Escalate to manual review or alternative recovery
          await this.escalateCase(recoveryCase);
        } else {
          // Schedule next retry
          recoveryCase.nextRetryAt = this.calculateNextRetryTime(recoveryCase.retryCount);
          await this.scheduleRetry(recoveryCase);
          
          // Send retry notification
          await this.sendRetryNotification(recoveryCase, retryResult);
        }
      }

      recoveryCase.updatedAt = new Date().toISOString();
      cases[caseIndex] = recoveryCase;
      fs.writeFileSync(this.recoveryFile, JSON.stringify(cases, null, 2));

      return {
        success: retryResult.success,
        recoveryCase,
        retryResult
      };
    } catch (error) {
      console.error('Error processing retry:', error);
      throw new Error('Failed to process retry');
    }
  }

  /**
   * Attempt payment retry (mock implementation)
   * @param {Object} recoveryCase - Recovery case
   * @returns {Promise<Object>} Payment result
   */
  async attemptPaymentRetry(recoveryCase) {
    // In production, this would integrate with payment processor
    // Mock success rate based on failure reason and retry count
    
    const successProbability = this.calculateSuccessProbability(recoveryCase);
    const success = Math.random() < successProbability;
    
    return {
      success,
      transactionId: success ? uuidv4() : null,
      failureReason: success ? null : this.getRetryFailureReason(recoveryCase),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate success probability for retry
   * @param {Object} recoveryCase - Recovery case
   * @returns {number} Success probability (0-1)
   */
  calculateSuccessProbability(recoveryCase) {
    const { failureCode, retryCount, recoveryStrategy } = recoveryCase;
    
    // Base probabilities by failure reason
    const baseProbabilities = {
      insufficient_funds: 0.3,
      card_declined: 0.25,
      expired_card: 0.1,
      processing_error: 0.7,
      network_error: 0.8,
      do_not_honor: 0.2
    };
    
    let probability = baseProbabilities[failureCode] || 0.3;
    
    // Adjust based on retry count
    if (retryCount > 0) {
      probability += 0.1 * retryCount; // Increase chance over time
    }
    
    // Adjust based on strategy
    if (recoveryStrategy === 'smart_retry') {
      probability += 0.15;
    }
    
    return Math.min(probability, 0.9); // Cap at 90%
  }

  /**
   * Get retry failure reason
   * @param {Object} recoveryCase - Recovery case
   * @returns {string} Failure reason
   */
  getRetryFailureReason(recoveryCase) {
    const reasons = [
      'insufficient_funds',
      'card_declined',
      'processing_error',
      'do_not_honor'
    ];
    
    // Return same reason 70% of the time
    if (Math.random() < 0.7) {
      return recoveryCase.failureReason;
    }
    
    return reasons[Math.floor(Math.random() * reasons.length)];
  }

  /**
   * Calculate next retry time
   * @param {number} retryCount - Current retry count
   * @returns {string} Next retry timestamp
   */
  calculateNextRetryTime(retryCount) {
    const interval = this.retryConfig.retryIntervals[retryCount];
    
    if (!interval) {
      return null;
    }
    
    const nextRetry = new Date();
    
    switch (interval.unit) {
      case 'hours':
        nextRetry.setHours(nextRetry.getHours() + interval.delay);
        break;
      case 'days':
        nextRetry.setDate(nextRetry.getDate() + interval.delay);
        break;
      case 'weeks':
        nextRetry.setDate(nextRetry.getDate() + (interval.delay * 7));
        break;
      default:
        nextRetry.setDate(nextRetry.getDate() + interval.delay);
    }
    
    return nextRetry.toISOString();
  }

  /**
   * Schedule retry attempt
   * @param {Object} recoveryCase - Recovery case
   */
  async scheduleRetry(recoveryCase) {
    // In production, this would integrate with a job scheduler
    const schedules = this.getRetrySchedules();
    
    const schedule = {
      id: uuidv4(),
      caseId: recoveryCase.id,
      scheduledFor: recoveryCase.nextRetryAt,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    schedules.push(schedule);
    fs.writeFileSync(this.retryScheduleFile, JSON.stringify(schedules, null, 2));
  }

  /**
   * Send failure notification
   * @param {Object} recoveryCase - Recovery case
   */
  async sendFailureNotification(recoveryCase) {
    const notification = {
      id: uuidv4(),
      type: 'payment_failed',
      channels: [],
      sentAt: new Date().toISOString()
    };

    if (this.retryConfig.notifications.email) {
      // Send email notification
      notification.channels.push('email');
      console.log(`Email sent: Payment failed for ${recoveryCase.amount} ${recoveryCase.currency}`);
    }

    if (this.retryConfig.notifications.sms) {
      // Send SMS notification
      notification.channels.push('sms');
      console.log(`SMS sent: Payment failed`);
    }

    if (this.retryConfig.notifications.inApp) {
      // Send in-app notification
      notification.channels.push('in_app');
    }

    recoveryCase.notifications.push(notification);
  }

  /**
   * Send retry notification
   * @param {Object} recoveryCase - Recovery case
   * @param {Object} retryResult - Retry result
   */
  async sendRetryNotification(recoveryCase, retryResult) {
    const notification = {
      id: uuidv4(),
      type: 'retry_failed',
      channels: [],
      sentAt: new Date().toISOString(),
      details: {
        attemptNumber: recoveryCase.retryCount,
        nextRetryAt: recoveryCase.nextRetryAt,
        failureReason: retryResult.failureReason
      }
    };

    if (this.retryConfig.notifications.email) {
      notification.channels.push('email');
      console.log(`Email sent: Retry attempt ${recoveryCase.retryCount} failed`);
    }

    recoveryCase.notifications.push(notification);
  }

  /**
   * Send recovery success notification
   * @param {Object} recoveryCase - Recovery case
   */
  async sendRecoverySuccessNotification(recoveryCase) {
    const notification = {
      id: uuidv4(),
      type: 'payment_recovered',
      channels: [],
      sentAt: new Date().toISOString()
    };

    if (this.retryConfig.notifications.email) {
      notification.channels.push('email');
      console.log(`Email sent: Payment successfully recovered for ${recoveryCase.amount} ${recoveryCase.currency}`);
    }

    recoveryCase.notifications.push(notification);
  }

  /**
   * Escalate failed recovery case
   * @param {Object} recoveryCase - Recovery case
   */
  async escalateCase(recoveryCase) {
    // Actions for escalated cases
    const escalationActions = [];

    // Send escalation notification to admin
    escalationActions.push({
      type: 'admin_notification',
      details: 'Case escalated to manual review'
    });

    // Suspend service if subscription
    if (recoveryCase.paymentType === 'subscription') {
      escalationActions.push({
        type: 'service_suspension',
        details: 'Subscription service suspended due to payment failure'
      });
    }

    // Send final notice to customer
    escalationActions.push({
      type: 'final_notice',
      details: 'Final payment failure notice sent to customer'
    });

    recoveryCase.escalation = {
      escalatedAt: new Date().toISOString(),
      actions: escalationActions
    };

    console.log(`Case ${recoveryCase.id} escalated after ${recoveryCase.retryCount} failed attempts`);
  }

  /**
   * Get recovery cases
   * @returns {Array} Recovery cases
   */
  getRecoveryCases() {
    try {
      const data = fs.readFileSync(this.recoveryFile, 'utf8');
      return JSON.parse(data) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get retry schedules
   * @returns {Array} Retry schedules
   */
  getRetrySchedules() {
    try {
      const data = fs.readFileSync(this.retryScheduleFile, 'utf8');
      return JSON.parse(data) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get recovery statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Recovery statistics
   */
  async getRecoveryStatistics(filters = {}) {
    try {
      const cases = this.getRecoveryCases();
      let filteredCases = cases;

      // Apply filters
      if (filters.startDate) {
        filteredCases = filteredCases.filter(c => 
          new Date(c.createdAt) >= new Date(filters.startDate)
        );
      }
      if (filters.endDate) {
        filteredCases = filteredCases.filter(c => 
          new Date(c.createdAt) <= new Date(filters.endDate)
        );
      }
      if (filters.status) {
        filteredCases = filteredCases.filter(c => c.status === filters.status);
      }

      const stats = {
        total: filteredCases.length,
        recovered: filteredCases.filter(c => c.status === 'recovered').length,
        failed: filteredCases.filter(c => c.status === 'failed').length,
        active: filteredCases.filter(c => c.status === 'active').length,
        totalAmount: filteredCases.reduce((sum, c) => sum + c.amount, 0),
        recoveredAmount: filteredCases
          .filter(c => c.status === 'recovered')
          .reduce((sum, c) => sum + c.amount, 0),
        recoveryRate: 0,
        averageRetries: 0,
        byFailureReason: {},
        byPaymentType: {},
        timeline: this.generateRecoveryTimeline(filteredCases)
      };

      // Calculate recovery rate
      if (stats.total > 0) {
        stats.recoveryRate = (stats.recovered / stats.total) * 100;
      }

      // Calculate average retries for recovered cases
      const recoveredCases = filteredCases.filter(c => c.status === 'recovered');
      if (recoveredCases.length > 0) {
        stats.averageRetries = recoveredCases.reduce((sum, c) => sum + c.retryCount, 0) / recoveredCases.length;
      }

      // Group by failure reason
      filteredCases.forEach(c => {
        if (!stats.byFailureReason[c.failureReason]) {
          stats.byFailureReason[c.failureReason] = {
            total: 0,
            recovered: 0,
            failed: 0
          };
        }
        stats.byFailureReason[c.failureReason].total++;
        if (c.status === 'recovered') {
          stats.byFailureReason[c.failureReason].recovered++;
        } else if (c.status === 'failed') {
          stats.byFailureReason[c.failureReason].failed++;
        }
      });

      // Group by payment type
      filteredCases.forEach(c => {
        if (!stats.byPaymentType[c.paymentType]) {
          stats.byPaymentType[c.paymentType] = {
            total: 0,
            recovered: 0,
            failed: 0
          };
        }
        stats.byPaymentType[c.paymentType].total++;
        if (c.status === 'recovered') {
          stats.byPaymentType[c.paymentType].recovered++;
        } else if (c.status === 'failed') {
          stats.byPaymentType[c.paymentType].failed++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting recovery statistics:', error);
      throw new Error('Failed to get recovery statistics');
    }
  }

  /**
   * Generate recovery timeline
   * @param {Array} cases - Recovery cases
   * @returns {Object} Timeline data
   */
  generateRecoveryTimeline(cases) {
    const timeline = {};
    
    cases.forEach(c => {
      const date = new Date(c.createdAt).toISOString().split('T')[0];
      
      if (!timeline[date]) {
        timeline[date] = {
          created: 0,
          recovered: 0,
          failed: 0
        };
      }
      
      timeline[date].created++;
      
      if (c.status === 'recovered') {
        const recoveredDate = new Date(c.recoveredAt).toISOString().split('T')[0];
        if (!timeline[recoveredDate]) {
          timeline[recoveredDate] = {
            created: 0,
            recovered: 0,
            failed: 0
          };
        }
        timeline[recoveredDate].recovered++;
      } else if (c.status === 'failed' && c.failedAt) {
        const failedDate = new Date(c.failedAt).toISOString().split('T')[0];
        if (!timeline[failedDate]) {
          timeline[failedDate] = {
            created: 0,
            recovered: 0,
            failed: 0
          };
        }
        timeline[failedDate].failed++;
      }
    });
    
    return timeline;
  }

  /**
   * Update recovery configuration
   * @param {Object} config - New configuration
   * @returns {Object} Updated configuration
   */
  updateConfiguration(config) {
    Object.assign(this.retryConfig, config);
    return {
      success: true,
      configuration: this.retryConfig
    };
  }

  /**
   * Process pending retries (batch job)
   * @returns {Promise<Object>} Processing result
   */
  async processPendingRetries() {
    try {
      const schedules = this.getRetrySchedules();
      const now = new Date();
      const pending = schedules.filter(s => 
        s.status === 'pending' && new Date(s.scheduledFor) <= now
      );

      const results = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: []
      };

      for (const schedule of pending) {
        try {
          const result = await this.processRetry(schedule.caseId);
          results.processed++;
          
          if (result.success) {
            results.succeeded++;
          } else {
            results.failed++;
          }
          
          // Update schedule status
          schedule.status = 'completed';
          schedule.completedAt = new Date().toISOString();
        } catch (error) {
          results.errors.push({
            scheduleId: schedule.id,
            error: error.message
          });
        }
      }

      // Save updated schedules
      fs.writeFileSync(this.retryScheduleFile, JSON.stringify(schedules, null, 2));

      return results;
    } catch (error) {
      console.error('Error processing pending retries:', error);
      throw new Error('Failed to process pending retries');
    }
  }
}

module.exports = new PaymentRecoveryService();
