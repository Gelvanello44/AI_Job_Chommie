const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class CouponService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.couponsFile = path.join(this.dataDir, 'coupons.json');
    this.usageFile = path.join(this.dataDir, 'coupon-usage.json');
    this.ensureDirectoryExists();
    this.initializeDefaultCoupons();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.couponsFile)) {
      fs.writeFileSync(this.couponsFile, JSON.stringify([]), 'utf8');
    }
    if (!fs.existsSync(this.usageFile)) {
      fs.writeFileSync(this.usageFile, JSON.stringify([]), 'utf8');
    }
  }

  initializeDefaultCoupons() {
    const coupons = this.getAllCoupons();
    
    if (coupons.length === 0) {
      const defaultCoupons = [
        {
          id: uuidv4(),
          code: 'WELCOME20',
          description: '20% off your first month',
          type: 'percentage',
          value: 20,
          minimumAmount: 0,
          maximumDiscount: null,
          applicablePlans: ['plan_starter', 'plan_pro', 'plan_enterprise'],
          applicableProducts: [],
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          usageLimit: 1000,
          usageCount: 0,
          usageLimitPerUser: 1,
          requiresNewUser: true,
          requiresMinimumPurchase: false,
          active: true,
          metadata: {
            campaign: 'new_user_acquisition'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          code: 'SAVE50',
          description: '50% off for 3 months',
          type: 'percentage',
          value: 50,
          minimumAmount: 19.99,
          maximumDiscount: 50,
          applicablePlans: ['plan_starter', 'plan_pro'],
          applicableProducts: [],
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          usageLimit: 100,
          usageCount: 0,
          usageLimitPerUser: 1,
          durationMonths: 3,
          requiresNewUser: false,
          requiresMinimumPurchase: true,
          active: true,
          metadata: {
            campaign: 'summer_promotion'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          code: 'FRIEND10',
          description: '$10 off any plan',
          type: 'fixed',
          value: 10,
          minimumAmount: 10,
          maximumDiscount: null,
          applicablePlans: ['plan_starter', 'plan_pro', 'plan_enterprise'],
          applicableProducts: [],
          validFrom: new Date().toISOString(),
          validUntil: null,
          usageLimit: null,
          usageCount: 0,
          usageLimitPerUser: 3,
          requiresNewUser: false,
          requiresMinimumPurchase: true,
          active: true,
          metadata: {
            campaign: 'referral_program'
          },
          createdAt: new Date().toISOString()
        }
      ];

      fs.writeFileSync(this.couponsFile, JSON.stringify(defaultCoupons, null, 2));
    }
  }

  /**
   * Get all coupons
   * @returns {Array} All coupons
   */
  getAllCoupons() {
    try {
      const data = fs.readFileSync(this.couponsFile, 'utf8');
      return JSON.parse(data) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all coupon usage records
   * @returns {Array} Usage records
   */
  getAllUsage() {
    try {
      const data = fs.readFileSync(this.usageFile, 'utf8');
      return JSON.parse(data) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Create a new coupon
   * @param {Object} couponData - Coupon data
   * @returns {Promise<Object>} Created coupon
   */
  async createCoupon(couponData) {
    try {
      // Check if coupon code already exists
      const existingCoupons = this.getAllCoupons();
      if (existingCoupons.some(c => c.code === couponData.code.toUpperCase())) {
        throw new Error('Coupon code already exists');
      }

      const coupon = {
        id: uuidv4(),
        code: couponData.code.toUpperCase(),
        description: couponData.description,
        type: couponData.type, // 'percentage', 'fixed', 'free_trial'
        value: couponData.value,
        minimumAmount: couponData.minimumAmount || 0,
        maximumDiscount: couponData.maximumDiscount || null,
        applicablePlans: couponData.applicablePlans || [],
        applicableProducts: couponData.applicableProducts || [],
        validFrom: couponData.validFrom || new Date().toISOString(),
        validUntil: couponData.validUntil || null,
        usageLimit: couponData.usageLimit || null,
        usageCount: 0,
        usageLimitPerUser: couponData.usageLimitPerUser || null,
        durationMonths: couponData.durationMonths || null,
        requiresNewUser: couponData.requiresNewUser || false,
        requiresMinimumPurchase: couponData.minimumAmount > 0,
        active: true,
        metadata: couponData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      existingCoupons.push(coupon);
      fs.writeFileSync(this.couponsFile, JSON.stringify(existingCoupons, null, 2));

      return {
        success: true,
        coupon
      };
    } catch (error) {
      console.error('Error creating coupon:', error);
      throw error;
    }
  }

  /**
   * Validate coupon code
   * @param {string} code - Coupon code
   * @param {Object} context - Validation context (userId, amount, planId, etc.)
   * @returns {Promise<Object>} Validation result
   */
  async validateCoupon(code, context) {
    try {
      const coupons = this.getAllCoupons();
      const coupon = coupons.find(c => c.code === code.toUpperCase() && c.active);

      if (!coupon) {
        return {
          valid: false,
          error: 'Invalid or expired coupon code'
        };
      }

      // Check validity period
      const now = new Date();
      if (coupon.validFrom && new Date(coupon.validFrom) > now) {
        return {
          valid: false,
          error: 'Coupon is not yet valid'
        };
      }

      if (coupon.validUntil && new Date(coupon.validUntil) < now) {
        return {
          valid: false,
          error: 'Coupon has expired'
        };
      }

      // Check usage limits
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return {
          valid: false,
          error: 'Coupon usage limit reached'
        };
      }

      // Check user-specific usage limit
      if (coupon.usageLimitPerUser && context.userId) {
        const userUsageCount = this.getUserCouponUsage(context.userId, coupon.id);
        if (userUsageCount >= coupon.usageLimitPerUser) {
          return {
            valid: false,
            error: 'You have already used this coupon the maximum number of times'
          };
        }
      }

      // Check if requires new user
      if (coupon.requiresNewUser && context.isExistingUser) {
        return {
          valid: false,
          error: 'This coupon is only valid for new users'
        };
      }

      // Check minimum purchase requirement
      if (coupon.requiresMinimumPurchase && context.amount < coupon.minimumAmount) {
        return {
          valid: false,
          error: `Minimum purchase of $${coupon.minimumAmount} required`
        };
      }

      // Check applicable plans
      if (coupon.applicablePlans.length > 0 && context.planId) {
        if (!coupon.applicablePlans.includes(context.planId)) {
          return {
            valid: false,
            error: 'Coupon is not valid for this plan'
          };
        }
      }

      // Check applicable products
      if (coupon.applicableProducts.length > 0 && context.productIds) {
        const hasApplicableProduct = context.productIds.some(
          pid => coupon.applicableProducts.includes(pid)
        );
        if (!hasApplicableProduct) {
          return {
            valid: false,
            error: 'Coupon is not valid for these products'
          };
        }
      }

      // Calculate discount
      const discount = this.calculateDiscount(coupon, context.amount);

      return {
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          type: coupon.type,
          value: coupon.value,
          durationMonths: coupon.durationMonths
        },
        discount,
        finalAmount: Math.max(0, context.amount - discount)
      };
    } catch (error) {
      console.error('Error validating coupon:', error);
      return {
        valid: false,
        error: 'Failed to validate coupon'
      };
    }
  }

  /**
   * Apply coupon
   * @param {string} code - Coupon code
   * @param {Object} context - Application context
   * @returns {Promise<Object>} Application result
   */
  async applyCoupon(code, context) {
    try {
      const validation = await this.validateCoupon(code, context);
      
      if (!validation.valid) {
        return validation;
      }

      // Record usage
      const usage = {
        id: uuidv4(),
        couponId: validation.coupon.id,
        couponCode: validation.coupon.code,
        userId: context.userId,
        orderId: context.orderId || null,
        subscriptionId: context.subscriptionId || null,
        originalAmount: context.amount,
        discountAmount: validation.discount,
        finalAmount: validation.finalAmount,
        appliedAt: new Date().toISOString(),
        metadata: context.metadata || {}
      };

      // Save usage record
      const usageRecords = this.getAllUsage();
      usageRecords.push(usage);
      fs.writeFileSync(this.usageFile, JSON.stringify(usageRecords, null, 2));

      // Update coupon usage count
      const coupons = this.getAllCoupons();
      const couponIndex = coupons.findIndex(c => c.id === validation.coupon.id);
      if (couponIndex !== -1) {
        coupons[couponIndex].usageCount++;
        coupons[couponIndex].updatedAt = new Date().toISOString();
        fs.writeFileSync(this.couponsFile, JSON.stringify(coupons, null, 2));
      }

      return {
        success: true,
        ...validation,
        usageId: usage.id
      };
    } catch (error) {
      console.error('Error applying coupon:', error);
      throw new Error('Failed to apply coupon');
    }
  }

  /**
   * Calculate discount amount
   * @param {Object} coupon - Coupon object
   * @param {number} amount - Original amount
   * @returns {number} Discount amount
   */
  calculateDiscount(coupon, amount) {
    let discount = 0;

    switch (coupon.type) {
      case 'percentage':
        discount = (amount * coupon.value) / 100;
        if (coupon.maximumDiscount) {
          discount = Math.min(discount, coupon.maximumDiscount);
        }
        break;
      
      case 'fixed':
        discount = Math.min(coupon.value, amount);
        break;
      
      case 'free_trial':
        discount = amount; // Full discount for trial period
        break;
      
      default:
        discount = 0;
    }

    return Math.round(discount * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get user's coupon usage count
   * @param {string} userId - User ID
   * @param {string} couponId - Coupon ID
   * @returns {number} Usage count
   */
  getUserCouponUsage(userId, couponId) {
    const usageRecords = this.getAllUsage();
    return usageRecords.filter(
      u => u.userId === userId && u.couponId === couponId
    ).length;
  }

  /**
   * Get coupon by code
   * @param {string} code - Coupon code
   * @returns {Promise<Object>} Coupon details
   */
  async getCouponByCode(code) {
    const coupons = this.getAllCoupons();
    const coupon = coupons.find(c => c.code === code.toUpperCase());
    
    if (!coupon) {
      throw new Error('Coupon not found');
    }
    
    return coupon;
  }

  /**
   * Update coupon
   * @param {string} couponId - Coupon ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated coupon
   */
  async updateCoupon(couponId, updates) {
    try {
      const coupons = this.getAllCoupons();
      const couponIndex = coupons.findIndex(c => c.id === couponId);
      
      if (couponIndex === -1) {
        throw new Error('Coupon not found');
      }

      // Don't allow changing the code if it's been used
      if (updates.code && coupons[couponIndex].usageCount > 0) {
        throw new Error('Cannot change code of a used coupon');
      }

      coupons[couponIndex] = {
        ...coupons[couponIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.couponsFile, JSON.stringify(coupons, null, 2));
      
      return {
        success: true,
        coupon: coupons[couponIndex]
      };
    } catch (error) {
      console.error('Error updating coupon:', error);
      throw error;
    }
  }

  /**
   * Deactivate coupon
   * @param {string} couponId - Coupon ID
   * @returns {Promise<Object>} Deactivated coupon
   */
  async deactivateCoupon(couponId) {
    return this.updateCoupon(couponId, { active: false });
  }

  /**
   * Get coupon statistics
   * @param {string} couponId - Coupon ID
   * @returns {Promise<Object>} Coupon statistics
   */
  async getCouponStats(couponId) {
    try {
      const coupon = this.getAllCoupons().find(c => c.id === couponId);
      
      if (!coupon) {
        throw new Error('Coupon not found');
      }

      const usageRecords = this.getAllUsage().filter(u => u.couponId === couponId);
      
      const stats = {
        coupon: {
          code: coupon.code,
          description: coupon.description,
          type: coupon.type,
          value: coupon.value
        },
        usage: {
          total: usageRecords.length,
          limit: coupon.usageLimit,
          remaining: coupon.usageLimit ? coupon.usageLimit - usageRecords.length : null
        },
        revenue: {
          totalDiscounted: usageRecords.reduce((sum, u) => sum + u.discountAmount, 0),
          totalRevenue: usageRecords.reduce((sum, u) => sum + u.finalAmount, 0),
          averageDiscount: usageRecords.length > 0 
            ? usageRecords.reduce((sum, u) => sum + u.discountAmount, 0) / usageRecords.length
            : 0
        },
        users: {
          unique: new Set(usageRecords.map(u => u.userId)).size,
          topUsers: this.getTopUsers(usageRecords, 5)
        },
        timeline: this.getUsageTimeline(usageRecords),
        performance: {
          conversionRate: this.calculateConversionRate(coupon),
          roi: this.calculateROI(coupon, usageRecords)
        }
      };

      return stats;
    } catch (error) {
      console.error('Error fetching coupon stats:', error);
      throw new Error('Failed to fetch coupon statistics');
    }
  }

  /**
   * Get all active coupons
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Active coupons
   */
  async getActiveCoupons(filters = {}) {
    let coupons = this.getAllCoupons().filter(c => c.active);
    
    const now = new Date();
    coupons = coupons.filter(c => {
      if (c.validFrom && new Date(c.validFrom) > now) return false;
      if (c.validUntil && new Date(c.validUntil) < now) return false;
      if (c.usageLimit && c.usageCount >= c.usageLimit) return false;
      return true;
    });

    // Apply filters
    if (filters.type) {
      coupons = coupons.filter(c => c.type === filters.type);
    }

    if (filters.planId) {
      coupons = coupons.filter(c => 
        c.applicablePlans.length === 0 || c.applicablePlans.includes(filters.planId)
      );
    }

    if (filters.newUserOnly !== undefined) {
      coupons = coupons.filter(c => c.requiresNewUser === filters.newUserOnly);
    }

    return coupons;
  }

  /**
   * Get top users by coupon usage
   * @param {Array} usageRecords - Usage records
   * @param {number} limit - Number of top users
   * @returns {Array} Top users
   */
  getTopUsers(usageRecords, limit = 5) {
    const userUsage = {};
    
    usageRecords.forEach(record => {
      if (!userUsage[record.userId]) {
        userUsage[record.userId] = {
          userId: record.userId,
          count: 0,
          totalDiscount: 0
        };
      }
      userUsage[record.userId].count++;
      userUsage[record.userId].totalDiscount += record.discountAmount;
    });

    return Object.values(userUsage)
      .sort((a, b) => b.totalDiscount - a.totalDiscount)
      .slice(0, limit);
  }

  /**
   * Get usage timeline
   * @param {Array} usageRecords - Usage records
   * @returns {Object} Usage timeline
   */
  getUsageTimeline(usageRecords) {
    const timeline = {};
    
    usageRecords.forEach(record => {
      const date = new Date(record.appliedAt).toISOString().split('T')[0];
      if (!timeline[date]) {
        timeline[date] = {
          count: 0,
          totalDiscount: 0
        };
      }
      timeline[date].count++;
      timeline[date].totalDiscount += record.discountAmount;
    });

    return timeline;
  }

  /**
   * Calculate conversion rate
   * @param {Object} coupon - Coupon object
   * @returns {number} Conversion rate
   */
  calculateConversionRate(coupon) {
    // In a real implementation, this would compare views to usage
    // For now, return a mock value based on usage
    const usageRate = coupon.usageLimit 
      ? (coupon.usageCount / coupon.usageLimit) * 100
      : Math.min(coupon.usageCount * 2, 100);
    
    return Math.round(usageRate * 100) / 100;
  }

  /**
   * Calculate ROI
   * @param {Object} coupon - Coupon object
   * @param {Array} usageRecords - Usage records
   * @returns {number} ROI percentage
   */
  calculateROI(coupon, usageRecords) {
    const totalRevenue = usageRecords.reduce((sum, u) => sum + u.finalAmount, 0);
    const totalDiscount = usageRecords.reduce((sum, u) => sum + u.discountAmount, 0);
    
    if (totalDiscount === 0) return 0;
    
    const roi = ((totalRevenue - totalDiscount) / totalDiscount) * 100;
    return Math.round(roi * 100) / 100;
  }

  /**
   * Bulk create coupons
   * @param {Array} couponsData - Array of coupon data
   * @returns {Promise<Object>} Creation result
   */
  async bulkCreateCoupons(couponsData) {
    const results = {
      success: [],
      failed: []
    };

    for (const couponData of couponsData) {
      try {
        const result = await this.createCoupon(couponData);
        results.success.push(result.coupon);
      } catch (error) {
        results.failed.push({
          data: couponData,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new CouponService();
