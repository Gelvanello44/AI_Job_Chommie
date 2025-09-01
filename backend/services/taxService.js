const fs = require('fs');
const path = require('path');

class TaxService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.taxRatesFile = path.join(this.dataDir, 'tax-rates.json');
    this.taxRecordsFile = path.join(this.dataDir, 'tax-records.json');
    this.ensureDirectoryExists();
    this.initializeTaxRates();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.taxRecordsFile)) {
      fs.writeFileSync(this.taxRecordsFile, JSON.stringify([]), 'utf8');
    }
  }

  initializeTaxRates() {
    if (!fs.existsSync(this.taxRatesFile)) {
      // Default tax rates for US states and international countries
      const defaultRates = {
        US: {
          federal: 0,
          states: {
            AL: 4.0, AK: 0, AZ: 5.6, AR: 6.5, CA: 7.25,
            CO: 2.9, CT: 6.35, DE: 0, FL: 6.0, GA: 4.0,
            HI: 4.0, ID: 6.0, IL: 6.25, IN: 7.0, IA: 6.0,
            KS: 6.5, KY: 6.0, LA: 4.45, ME: 5.5, MD: 6.0,
            MA: 6.25, MI: 6.0, MN: 6.875, MS: 7.0, MO: 4.225,
            MT: 0, NE: 5.5, NV: 6.85, NH: 0, NJ: 6.625,
            NM: 5.125, NY: 4.0, NC: 4.75, ND: 5.0, OH: 5.75,
            OK: 4.5, OR: 0, PA: 6.0, RI: 7.0, SC: 6.0,
            SD: 4.5, TN: 7.0, TX: 6.25, UT: 5.95, VT: 6.0,
            VA: 5.3, WA: 6.5, WV: 6.0, WI: 5.0, WY: 4.0,
            DC: 6.0
          },
          digitalGoods: {
            // States that tax digital goods/services
            taxableStates: [
              'AL', 'AZ', 'AR', 'CO', 'CT', 'DC', 'HI', 'ID', 'IN', 'IA',
              'KY', 'LA', 'ME', 'MD', 'MA', 'MS', 'NE', 'NJ', 'NM', 'NY',
              'NC', 'ND', 'OH', 'PA', 'RI', 'SD', 'TN', 'TX', 'UT', 'VT',
              'WA', 'WV', 'WI', 'WY'
            ]
          }
        },
        EU: {
          // VAT rates for EU countries (digital services)
          AT: 20.0, BE: 21.0, BG: 20.0, HR: 25.0, CY: 19.0,
          CZ: 21.0, DK: 25.0, EE: 20.0, FI: 24.0, FR: 20.0,
          DE: 19.0, GR: 24.0, HU: 27.0, IE: 23.0, IT: 22.0,
          LV: 21.0, LT: 21.0, LU: 17.0, MT: 18.0, NL: 21.0,
          PL: 23.0, PT: 23.0, RO: 19.0, SK: 20.0, SI: 22.0,
          ES: 21.0, SE: 25.0
        },
        OTHER: {
          // Other major countries
          GB: 20.0,  // UK VAT
          CA: {      // Canadian GST/HST
            federal: 5.0,
            provinces: {
              AB: 0, BC: 7.0, MB: 7.0, NB: 10.0, NL: 10.0,
              NT: 0, NS: 10.0, NU: 0, ON: 8.0, PE: 10.0,
              QC: 9.975, SK: 6.0, YT: 0
            }
          },
          AU: 10.0,  // Australian GST
          NZ: 15.0,  // New Zealand GST
          JP: 10.0,  // Japanese consumption tax
          IN: 18.0,  // Indian GST (standard rate)
          SG: 7.0,   // Singapore GST
          ZA: 15.0,  // South Africa VAT
          BR: 17.0,  // Brazil average
          MX: 16.0,  // Mexico VAT
          AE: 5.0,   // UAE VAT
          CH: 7.7    // Switzerland VAT
        }
      };

      fs.writeFileSync(this.taxRatesFile, JSON.stringify(defaultRates, null, 2));
    }
  }

  /**
   * Get tax rates data
   * @returns {Object} Tax rates
   */
  getTaxRates() {
    try {
      const data = fs.readFileSync(this.taxRatesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  /**
   * Calculate tax for a transaction
   * @param {Object} transaction - Transaction details
   * @returns {Promise<Object>} Tax calculation result
   */
  async calculateTax(transaction) {
    try {
      const {
        amount,
        country,
        state,
        province,
        postalCode,
        productType = 'digital_service',
        isB2B = false,
        vatNumber = null,
        taxExempt = false
      } = transaction;

      // Check for tax exemption
      if (taxExempt) {
        return this.createTaxResult(amount, 0, 'exempt', { reason: 'Tax exempt customer' });
      }

      const taxRates = this.getTaxRates();
      let taxRate = 0;
      let taxType = 'none';
      let taxDetails = {};

      // US Tax Calculation
      if (country === 'US') {
        taxRate = this.calculateUSTax(state, productType, taxRates.US);
        taxType = 'sales_tax';
        taxDetails = {
          country: 'US',
          state,
          stateRate: taxRate,
          digitalGoods: productType === 'digital_service'
        };
      }
      // EU VAT Calculation
      else if (taxRates.EU[country]) {
        // B2B reverse charge mechanism
        if (isB2B && vatNumber && await this.validateVATNumber(vatNumber)) {
          return this.createTaxResult(amount, 0, 'reverse_charge', {
            country,
            vatNumber,
            message: 'VAT reverse charge applies'
          });
        }
        
        taxRate = taxRates.EU[country];
        taxType = 'vat';
        taxDetails = {
          country,
          vatRate: taxRate,
          isB2B
        };
      }
      // Canada Tax Calculation
      else if (country === 'CA') {
        taxRate = this.calculateCanadaTax(province, taxRates.OTHER.CA);
        taxType = 'gst_hst';
        taxDetails = {
          country: 'CA',
          province,
          federalRate: taxRates.OTHER.CA.federal,
          provincialRate: taxRates.OTHER.CA.provinces[province] || 0,
          totalRate: taxRate
        };
      }
      // Other Countries
      else if (taxRates.OTHER[country]) {
        taxRate = taxRates.OTHER[country];
        taxType = this.getTaxTypeByCountry(country);
        taxDetails = {
          country,
          rate: taxRate
        };
      }

      const taxAmount = this.calculateTaxAmount(amount, taxRate);
      
      // Record tax calculation
      await this.recordTaxCalculation({
        ...transaction,
        taxRate,
        taxAmount,
        taxType,
        taxDetails
      });

      return this.createTaxResult(amount, taxAmount, taxType, taxDetails);
    } catch (error) {
      console.error('Error calculating tax:', error);
      throw new Error('Failed to calculate tax');
    }
  }

  /**
   * Calculate US sales tax
   * @param {string} state - US state code
   * @param {string} productType - Type of product
   * @param {Object} usRates - US tax rates
   * @returns {number} Tax rate
   */
  calculateUSTax(state, productType, usRates) {
    if (!state || !usRates.states[state]) {
      return 0;
    }

    // Check if digital goods are taxable in this state
    if (productType === 'digital_service') {
      if (!usRates.digitalGoods.taxableStates.includes(state)) {
        return 0;
      }
    }

    return usRates.states[state];
  }

  /**
   * Calculate Canadian tax
   * @param {string} province - Canadian province code
   * @param {Object} caRates - Canadian tax rates
   * @returns {number} Combined tax rate
   */
  calculateCanadaTax(province, caRates) {
    const federalRate = caRates.federal;
    const provincialRate = caRates.provinces[province] || 0;
    return federalRate + provincialRate;
  }

  /**
   * Calculate tax amount
   * @param {number} amount - Base amount
   * @param {number} taxRate - Tax rate percentage
   * @returns {number} Tax amount
   */
  calculateTaxAmount(amount, taxRate) {
    return Math.round((amount * taxRate / 100) * 100) / 100;
  }

  /**
   * Create tax calculation result
   * @param {number} amount - Original amount
   * @param {number} taxAmount - Tax amount
   * @param {string} taxType - Type of tax
   * @param {Object} details - Tax details
   * @returns {Object} Tax result
   */
  createTaxResult(amount, taxAmount, taxType, details) {
    return {
      success: true,
      calculation: {
        subtotal: amount,
        taxAmount: taxAmount,
        total: amount + taxAmount,
        taxRate: taxAmount > 0 ? (taxAmount / amount) * 100 : 0,
        taxType: taxType,
        details: details,
        calculatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Validate VAT number (mock implementation)
   * @param {string} vatNumber - VAT number to validate
   * @returns {Promise<boolean>} Validation result
   */
  async validateVATNumber(vatNumber) {
    // In production, this would call VIES API or similar service
    // Basic format validation for now
    const vatPatterns = {
      AT: /^ATU\d{8}$/,
      BE: /^BE0\d{9}$/,
      DE: /^DE\d{9}$/,
      FR: /^FR[A-Z0-9]{2}\d{9}$/,
      GB: /^GB\d{9}$/,
      NL: /^NL\d{9}B\d{2}$/,
      // Add more patterns as needed
    };

    const countryCode = vatNumber.substring(0, 2);
    const pattern = vatPatterns[countryCode];
    
    if (pattern) {
      return pattern.test(vatNumber);
    }
    
    // Default to valid for mock
    return vatNumber.length > 5;
  }

  /**
   * Get tax type by country
   * @param {string} country - Country code
   * @returns {string} Tax type
   */
  getTaxTypeByCountry(country) {
    const taxTypes = {
      GB: 'vat',
      AU: 'gst',
      NZ: 'gst',
      JP: 'consumption_tax',
      IN: 'gst',
      SG: 'gst',
      ZA: 'vat',
      BR: 'icms',
      MX: 'vat',
      AE: 'vat',
      CH: 'vat'
    };
    
    return taxTypes[country] || 'tax';
  }

  /**
   * Record tax calculation for audit
   * @param {Object} calculation - Tax calculation details
   */
  async recordTaxCalculation(calculation) {
    try {
      const records = this.getTaxRecords();
      
      const record = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...calculation
      };
      
      records.push(record);
      
      // Keep only last 10000 records
      if (records.length > 10000) {
        records.splice(0, records.length - 10000);
      }
      
      fs.writeFileSync(this.taxRecordsFile, JSON.stringify(records, null, 2));
    } catch (error) {
      console.error('Error recording tax calculation:', error);
    }
  }

  /**
   * Get tax records
   * @returns {Array} Tax records
   */
  getTaxRecords() {
    try {
      const data = fs.readFileSync(this.taxRecordsFile, 'utf8');
      return JSON.parse(data) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate tax report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Tax report
   */
  async generateTaxReport(options = {}) {
    try {
      const { startDate, endDate, groupBy = 'country' } = options;
      const records = this.getTaxRecords();
      
      // Filter by date range
      let filteredRecords = records;
      if (startDate) {
        filteredRecords = filteredRecords.filter(r => 
          new Date(r.timestamp) >= new Date(startDate)
        );
      }
      if (endDate) {
        filteredRecords = filteredRecords.filter(r => 
          new Date(r.timestamp) <= new Date(endDate)
        );
      }
      
      // Group and calculate totals
      const grouped = {};
      let totalTax = 0;
      let totalAmount = 0;
      
      filteredRecords.forEach(record => {
        const key = groupBy === 'country' ? record.country : 
                   groupBy === 'state' ? record.state :
                   groupBy === 'type' ? record.taxType : 'all';
        
        if (!grouped[key]) {
          grouped[key] = {
            count: 0,
            totalAmount: 0,
            totalTax: 0,
            transactions: []
          };
        }
        
        grouped[key].count++;
        grouped[key].totalAmount += record.amount;
        grouped[key].totalTax += record.taxAmount;
        grouped[key].transactions.push({
          id: record.id,
          timestamp: record.timestamp,
          amount: record.amount,
          taxAmount: record.taxAmount
        });
        
        totalAmount += record.amount;
        totalTax += record.taxAmount;
      });
      
      return {
        period: {
          startDate: startDate || 'all',
          endDate: endDate || 'all'
        },
        summary: {
          totalTransactions: filteredRecords.length,
          totalAmount,
          totalTax,
          averageTaxRate: totalAmount > 0 ? (totalTax / totalAmount) * 100 : 0
        },
        breakdown: grouped,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating tax report:', error);
      throw new Error('Failed to generate tax report');
    }
  }

  /**
   * Update tax rates
   * @param {string} region - Region code
   * @param {Object} rates - New rates
   * @returns {Promise<Object>} Update result
   */
  async updateTaxRates(region, rates) {
    try {
      const taxRates = this.getTaxRates();
      
      if (region === 'US') {
        Object.assign(taxRates.US.states, rates);
      } else if (region === 'EU') {
        Object.assign(taxRates.EU, rates);
      } else if (region === 'CA') {
        Object.assign(taxRates.OTHER.CA.provinces, rates);
      } else {
        Object.assign(taxRates.OTHER, { [region]: rates });
      }
      
      fs.writeFileSync(this.taxRatesFile, JSON.stringify(taxRates, null, 2));
      
      return {
        success: true,
        message: 'Tax rates updated successfully',
        region,
        rates
      };
    } catch (error) {
      console.error('Error updating tax rates:', error);
      throw new Error('Failed to update tax rates');
    }
  }

  /**
   * Get tax compliance info
   * @param {string} country - Country code
   * @returns {Object} Compliance information
   */
  getTaxComplianceInfo(country) {
    const complianceInfo = {
      US: {
        nexusRequired: true,
        thresholds: {
          economic: '$100,000 or 200 transactions in most states',
          physical: 'Physical presence in state'
        },
        filingFrequency: 'Monthly, Quarterly, or Annually',
        registrationRequired: true,
        notes: 'Varies by state - check individual state requirements'
      },
      EU: {
        vatRequired: true,
        thresholds: {
          domestic: '€10,000 for digital services',
          crossBorder: 'No threshold for B2C digital services'
        },
        filingFrequency: 'Quarterly via MOSS/OSS',
        registrationRequired: true,
        notes: 'Use MOSS/OSS for simplified reporting'
      },
      CA: {
        gstRequired: true,
        thresholds: {
          small: 'CAD $30,000 annually'
        },
        filingFrequency: 'Quarterly or Annually',
        registrationRequired: true,
        notes: 'Register for GST/HST number when threshold exceeded'
      }
    };
    
    return complianceInfo[country] || {
      required: false,
      notes: 'Check local tax requirements'
    };
  }

  /**
   * Estimate annual tax liability
   * @param {Object} projections - Revenue projections
   * @returns {Object} Tax liability estimate
   */
  estimateTaxLiability(projections) {
    const { monthlyRevenue, customerDistribution = {} } = projections;
    const annualRevenue = monthlyRevenue * 12;
    const taxRates = this.getTaxRates();
    
    let estimatedTax = 0;
    const breakdown = {};
    
    // Calculate based on customer distribution
    Object.entries(customerDistribution).forEach(([region, percentage]) => {
      const regionRevenue = annualRevenue * (percentage / 100);
      let regionTax = 0;
      
      if (region === 'US') {
        // Average US sales tax rate
        regionTax = regionRevenue * 0.065; // 6.5% average
      } else if (taxRates.EU[region]) {
        regionTax = regionRevenue * (taxRates.EU[region] / 100);
      } else if (taxRates.OTHER[region]) {
        const rate = typeof taxRates.OTHER[region] === 'object' 
          ? 13 // Average for complex regions like Canada
          : taxRates.OTHER[region];
        regionTax = regionRevenue * (rate / 100);
      }
      
      breakdown[region] = {
        revenue: regionRevenue,
        estimatedTax: regionTax
      };
      estimatedTax += regionTax;
    });
    
    return {
      annualRevenue,
      estimatedTax,
      effectiveRate: (estimatedTax / annualRevenue) * 100,
      breakdown,
      disclaimer: 'This is an estimate only. Consult with a tax professional for accurate calculations.'
    };
  }
}

module.exports = new TaxService();
