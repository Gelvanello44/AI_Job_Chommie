const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class PaymentHistoryService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.paymentsFile = path.join(this.dataDir, 'payments.json');
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.paymentsFile)) {
      fs.writeFileSync(this.paymentsFile, JSON.stringify([]), 'utf8');
    }
  }

  /**
   * Record a new payment
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Created payment record
   */
  async recordPayment(paymentData) {
    try {
      const payment = {
        id: uuidv4(),
        userId: paymentData.userId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'USD',
        status: paymentData.status || 'pending',
        method: paymentData.method,
        type: paymentData.type, // 'subscription', 'one-time', 'invoice', 'refund'
        description: paymentData.description,
        invoiceId: paymentData.invoiceId || null,
        subscriptionId: paymentData.subscriptionId || null,
        paymentIntentId: paymentData.paymentIntentId || null,
        cardLast4: paymentData.cardLast4 || null,
        cardBrand: paymentData.cardBrand || null,
        billingAddress: paymentData.billingAddress || null,
        metadata: paymentData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        processedAt: null,
        failureReason: null,
        refundedAmount: 0,
        refunds: []
      };

      // Save payment
      await this.savePayment(payment);

      // If payment is successful, update processed timestamp
      if (payment.status === 'succeeded') {
        payment.processedAt = new Date().toISOString();
        await this.updatePayment(payment.id, { processedAt: payment.processedAt });
      }

      return {
        success: true,
        payment
      };
    } catch (error) {
      console.error('Error recording payment:', error);
      throw new Error('Failed to record payment');
    }
  }

  /**
   * Save payment to storage
   * @param {Object} payment - Payment data
   */
  async savePayment(payment) {
    const payments = await this.getAllPayments();
    payments.push(payment);
    fs.writeFileSync(this.paymentsFile, JSON.stringify(payments, null, 2));
  }

  /**
   * Get all payments
   * @returns {Promise<Array>} All payments
   */
  async getAllPayments() {
    try {
      const data = fs.readFileSync(this.paymentsFile, 'utf8');
      return JSON.parse(data) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get payment by ID
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment record
   */
  async getPaymentById(paymentId) {
    const payments = await this.getAllPayments();
    const payment = payments.find(p => p.id === paymentId);
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    return payment;
  }

  /**
   * Get user payment history
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Payment history with pagination
   */
  async getUserPaymentHistory(userId, options = {}) {
    try {
      const payments = await this.getAllPayments();
      let userPayments = payments.filter(p => p.userId === userId);

      // Apply filters
      if (options.status) {
        userPayments = userPayments.filter(p => p.status === options.status);
      }

      if (options.type) {
        userPayments = userPayments.filter(p => p.type === options.type);
      }

      if (options.method) {
        userPayments = userPayments.filter(p => p.method === options.method);
      }

      if (options.startDate) {
        const startDate = new Date(options.startDate);
        userPayments = userPayments.filter(p => new Date(p.createdAt) >= startDate);
      }

      if (options.endDate) {
        const endDate = new Date(options.endDate);
        userPayments = userPayments.filter(p => new Date(p.createdAt) <= endDate);
      }

      if (options.minAmount) {
        userPayments = userPayments.filter(p => p.amount >= parseFloat(options.minAmount));
      }

      if (options.maxAmount) {
        userPayments = userPayments.filter(p => p.amount <= parseFloat(options.maxAmount));
      }

      // Sort payments (newest first by default)
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';
      
      userPayments.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (sortOrder === 'desc') {
          return aValue > bValue ? -1 : 1;
        } else {
          return aValue < bValue ? -1 : 1;
        }
      });

      // Calculate statistics
      const stats = this.calculatePaymentStats(userPayments);

      // Pagination
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      
      const paginatedPayments = userPayments.slice(startIndex, endIndex);

      return {
        payments: paginatedPayments,
        stats,
        pagination: {
          total: userPayments.length,
          page,
          limit,
          totalPages: Math.ceil(userPayments.length / limit),
          hasMore: endIndex < userPayments.length
        }
      };
    } catch (error) {
      console.error('Error fetching payment history:', error);
      throw new Error('Failed to fetch payment history');
    }
  }

  /**
   * Calculate payment statistics
   * @param {Array} payments - Payment records
   * @returns {Object} Payment statistics
   */
  calculatePaymentStats(payments) {
    const stats = {
      totalAmount: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      totalPending: 0,
      totalRefunded: 0,
      averageAmount: 0,
      lastPaymentDate: null,
      paymentMethods: {},
      monthlyTotals: {}
    };

    payments.forEach(payment => {
      // Total amounts by status
      if (payment.status === 'succeeded') {
        stats.totalAmount += payment.amount;
        stats.totalSuccessful++;
      } else if (payment.status === 'failed') {
        stats.totalFailed++;
      } else if (payment.status === 'pending') {
        stats.totalPending++;
      }

      // Refunded amount
      stats.totalRefunded += payment.refundedAmount || 0;

      // Payment methods distribution
      if (payment.method) {
        stats.paymentMethods[payment.method] = (stats.paymentMethods[payment.method] || 0) + 1;
      }

      // Monthly totals
      const month = new Date(payment.createdAt).toISOString().substring(0, 7);
      if (payment.status === 'succeeded') {
        stats.monthlyTotals[month] = (stats.monthlyTotals[month] || 0) + payment.amount;
      }

      // Last payment date
      if (!stats.lastPaymentDate || new Date(payment.createdAt) > new Date(stats.lastPaymentDate)) {
        stats.lastPaymentDate = payment.createdAt;
      }
    });

    // Calculate average
    if (stats.totalSuccessful > 0) {
      stats.averageAmount = stats.totalAmount / stats.totalSuccessful;
    }

    return stats;
  }

  /**
   * Update payment status
   * @param {string} paymentId - Payment ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated payment
   */
  async updatePayment(paymentId, updates) {
    try {
      const payments = await this.getAllPayments();
      const paymentIndex = payments.findIndex(p => p.id === paymentId);
      
      if (paymentIndex === -1) {
        throw new Error('Payment not found');
      }

      // Update payment
      payments[paymentIndex] = {
        ...payments[paymentIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Handle status changes
      if (updates.status === 'succeeded' && !payments[paymentIndex].processedAt) {
        payments[paymentIndex].processedAt = new Date().toISOString();
      }

      // Save updated payments
      fs.writeFileSync(this.paymentsFile, JSON.stringify(payments, null, 2));
      
      return payments[paymentIndex];
    } catch (error) {
      console.error('Error updating payment:', error);
      throw new Error('Failed to update payment');
    }
  }

  /**
   * Process refund for a payment
   * @param {string} paymentId - Payment ID
   * @param {Object} refundData - Refund data
   * @returns {Promise<Object>} Updated payment with refund
   */
  async processRefund(paymentId, refundData) {
    try {
      const payment = await this.getPaymentById(paymentId);
      
      if (payment.status !== 'succeeded') {
        throw new Error('Can only refund successful payments');
      }

      const refundAmount = refundData.amount || payment.amount;
      
      if (refundAmount > (payment.amount - payment.refundedAmount)) {
        throw new Error('Refund amount exceeds available amount');
      }

      const refund = {
        id: uuidv4(),
        amount: refundAmount,
        reason: refundData.reason || 'requested_by_customer',
        status: 'pending',
        createdAt: new Date().toISOString(),
        processedAt: null,
        metadata: refundData.metadata || {}
      };

      // Update payment
      const updates = {
        refundedAmount: (payment.refundedAmount || 0) + refundAmount,
        refunds: [...(payment.refunds || []), refund]
      };

      if (updates.refundedAmount >= payment.amount) {
        updates.status = 'refunded';
      } else if (updates.refundedAmount > 0) {
        updates.status = 'partially_refunded';
      }

      const updatedPayment = await this.updatePayment(paymentId, updates);

      // Simulate refund processing
      setTimeout(async () => {
        const payments = await this.getAllPayments();
        const paymentIndex = payments.findIndex(p => p.id === paymentId);
        const refundIndex = payments[paymentIndex].refunds.findIndex(r => r.id === refund.id);
        
        payments[paymentIndex].refunds[refundIndex].status = 'succeeded';
        payments[paymentIndex].refunds[refundIndex].processedAt = new Date().toISOString();
        
        fs.writeFileSync(this.paymentsFile, JSON.stringify(payments, null, 2));
      }, 2000);

      return {
        success: true,
        payment: updatedPayment,
        refund
      };
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Get payment analytics
   * @param {string} userId - User ID
   * @param {Object} period - Time period
   * @returns {Promise<Object>} Payment analytics
   */
  async getPaymentAnalytics(userId, period = {}) {
    try {
      const { payments, stats } = await this.getUserPaymentHistory(userId, period);
      
      const analytics = {
        overview: stats,
        trends: this.calculateTrends(payments),
        projections: this.calculateProjections(payments),
        recommendations: this.generateRecommendations(stats)
      };

      return analytics;
    } catch (error) {
      console.error('Error generating payment analytics:', error);
      throw new Error('Failed to generate payment analytics');
    }
  }

  /**
   * Calculate payment trends
   * @param {Array} payments - Payment records
   * @returns {Object} Trend data
   */
  calculateTrends(payments) {
    const monthlyData = {};
    
    payments.forEach(payment => {
      if (payment.status === 'succeeded') {
        const month = new Date(payment.createdAt).toISOString().substring(0, 7);
        if (!monthlyData[month]) {
          monthlyData[month] = {
            total: 0,
            count: 0,
            average: 0
          };
        }
        monthlyData[month].total += payment.amount;
        monthlyData[month].count++;
      }
    });

    // Calculate averages and growth
    const months = Object.keys(monthlyData).sort();
    months.forEach(month => {
      monthlyData[month].average = monthlyData[month].total / monthlyData[month].count;
    });

    // Calculate month-over-month growth
    const growth = [];
    for (let i = 1; i < months.length; i++) {
      const prevMonth = monthlyData[months[i - 1]];
      const currMonth = monthlyData[months[i]];
      const growthRate = ((currMonth.total - prevMonth.total) / prevMonth.total) * 100;
      
      growth.push({
        month: months[i],
        growthRate: growthRate.toFixed(2)
      });
    }

    return {
      monthlyData,
      growth,
      trend: growth.length > 0 && growth[growth.length - 1].growthRate > 0 ? 'increasing' : 'decreasing'
    };
  }

  /**
   * Calculate payment projections
   * @param {Array} payments - Payment records
   * @returns {Object} Projection data
   */
  calculateProjections(payments) {
    // Simple linear projection based on recent trends
    const recentPayments = payments
      .filter(p => p.status === 'succeeded')
      .filter(p => {
        const paymentDate = new Date(p.createdAt);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return paymentDate >= threeMonthsAgo;
      });

    if (recentPayments.length === 0) {
      return { nextMonth: 0, nextQuarter: 0, nextYear: 0 };
    }

    const monthlyAverage = recentPayments.reduce((sum, p) => sum + p.amount, 0) / 3;

    return {
      nextMonth: Math.round(monthlyAverage),
      nextQuarter: Math.round(monthlyAverage * 3),
      nextYear: Math.round(monthlyAverage * 12)
    };
  }

  /**
   * Generate recommendations based on payment data
   * @param {Object} stats - Payment statistics
   * @returns {Array} Recommendations
   */
  generateRecommendations(stats) {
    const recommendations = [];

    if (stats.totalFailed > stats.totalSuccessful * 0.1) {
      recommendations.push({
        type: 'warning',
        title: 'High failure rate',
        description: 'More than 10% of payments are failing. Consider reviewing payment methods or implementing retry logic.'
      });
    }

    if (stats.totalRefunded > stats.totalAmount * 0.05) {
      recommendations.push({
        type: 'info',
        title: 'Refund rate analysis',
        description: 'Refunds exceed 5% of total revenue. Consider investigating common refund reasons.'
      });
    }

    if (Object.keys(stats.paymentMethods).length === 1) {
      recommendations.push({
        type: 'suggestion',
        title: 'Diversify payment methods',
        description: 'Consider adding more payment options to improve conversion rates.'
      });
    }

    return recommendations;
  }

  /**
   * Export payment history
   * @param {string} userId - User ID
   * @param {string} format - Export format (csv, json)
   * @returns {Promise<Object>} Export data
   */
  async exportPaymentHistory(userId, format = 'csv') {
    try {
      const { payments } = await this.getUserPaymentHistory(userId, { limit: 10000 });
      
      if (format === 'csv') {
        const csv = this.convertToCSV(payments);
        return {
          format: 'csv',
          data: csv,
          filename: `payment-history-${userId}-${Date.now()}.csv`
        };
      } else if (format === 'json') {
        return {
          format: 'json',
          data: JSON.stringify(payments, null, 2),
          filename: `payment-history-${userId}-${Date.now()}.json`
        };
      } else {
        throw new Error('Unsupported export format');
      }
    } catch (error) {
      console.error('Error exporting payment history:', error);
      throw new Error('Failed to export payment history');
    }
  }

  /**
   * Convert payments to CSV format
   * @param {Array} payments - Payment records
   * @returns {string} CSV data
   */
  convertToCSV(payments) {
    const headers = [
      'ID', 'Date', 'Amount', 'Currency', 'Status', 'Method', 
      'Type', 'Description', 'Card Last 4', 'Card Brand'
    ];
    
    const rows = payments.map(p => [
      p.id,
      new Date(p.createdAt).toLocaleString(),
      p.amount,
      p.currency,
      p.status,
      p.method || '',
      p.type || '',
      p.description || '',
      p.cardLast4 || '',
      p.cardBrand || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }
}

module.exports = new PaymentHistoryService();
