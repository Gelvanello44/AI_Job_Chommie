const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class InvoiceService {
  constructor() {
    this.invoicesDir = path.join(__dirname, '../../invoices');
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.invoicesDir)) {
      fs.mkdirSync(this.invoicesDir, { recursive: true });
    }
  }

  /**
   * Generate a new invoice
   * @param {Object} invoiceData - Invoice data
   * @returns {Promise<Object>} Generated invoice details
   */
  async generateInvoice(invoiceData) {
    try {
      const invoice = {
        id: uuidv4(),
        invoiceNumber: this.generateInvoiceNumber(),
        userId: invoiceData.userId,
        customerId: invoiceData.customerId,
        date: new Date().toISOString(),
        dueDate: this.calculateDueDate(invoiceData.paymentTerms || 30),
        items: invoiceData.items || [],
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        status: 'pending',
        currency: invoiceData.currency || 'USD',
        paymentMethod: invoiceData.paymentMethod,
        billingAddress: invoiceData.billingAddress,
        notes: invoiceData.notes || '',
        metadata: invoiceData.metadata || {}
      };

      // Calculate totals
      invoice.subtotal = this.calculateSubtotal(invoice.items);
      invoice.tax = this.calculateTax(invoice.subtotal, invoiceData.taxRate || 0);
      invoice.discount = this.calculateDiscount(invoice.subtotal, invoiceData.discount);
      invoice.total = invoice.subtotal + invoice.tax - invoice.discount;

      // Generate PDF
      const pdfPath = await this.generatePDF(invoice);
      invoice.pdfPath = pdfPath;

      // Store invoice in database (mock implementation)
      await this.storeInvoice(invoice);

      return {
        success: true,
        invoice,
        downloadUrl: `/api/invoices/${invoice.id}/download`
      };
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw new Error('Failed to generate invoice');
    }
  }

  /**
   * Generate invoice number
   * @returns {string} Invoice number
   */
  generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}-${random}`;
  }

  /**
   * Calculate due date
   * @param {number} paymentTerms - Payment terms in days
   * @returns {string} Due date
   */
  calculateDueDate(paymentTerms) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTerms);
    return dueDate.toISOString();
  }

  /**
   * Calculate subtotal
   * @param {Array} items - Invoice items
   * @returns {number} Subtotal
   */
  calculateSubtotal(items) {
    return items.reduce((total, item) => {
      return total + (item.quantity * item.unitPrice);
    }, 0);
  }

  /**
   * Calculate tax
   * @param {number} subtotal - Subtotal amount
   * @param {number} taxRate - Tax rate percentage
   * @returns {number} Tax amount
   */
  calculateTax(subtotal, taxRate) {
    return subtotal * (taxRate / 100);
  }

  /**
   * Calculate discount
   * @param {number} subtotal - Subtotal amount
   * @param {Object} discount - Discount object
   * @returns {number} Discount amount
   */
  calculateDiscount(subtotal, discount) {
    if (!discount) return 0;
    
    if (discount.type === 'percentage') {
      return subtotal * (discount.value / 100);
    } else if (discount.type === 'fixed') {
      return Math.min(discount.value, subtotal);
    }
    
    return 0;
  }

  /**
   * Generate PDF invoice
   * @param {Object} invoice - Invoice data
   * @returns {Promise<string>} PDF file path
   */
  async generatePDF(invoice) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const filename = `${invoice.invoiceNumber}.pdf`;
        const filepath = path.join(this.invoicesDir, filename);
        
        // Pipe to file
        doc.pipe(fs.createWriteStream(filepath));

        // Header
        doc.fontSize(20)
           .text('INVOICE', 50, 50)
           .fontSize(10)
           .text(`Invoice Number: ${invoice.invoiceNumber}`, 50, 80)
           .text(`Date: ${new Date(invoice.date).toLocaleDateString()}`, 50, 95)
           .text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 50, 110);

        // Company Info (placeholder)
        doc.fontSize(12)
           .text('EV Charging Solutions', 400, 50, { align: 'right' })
           .fontSize(10)
           .text('123 Electric Avenue', 400, 70, { align: 'right' })
           .text('Tech City, TC 12345', 400, 85, { align: 'right' })
           .text('contact@evcharging.com', 400, 100, { align: 'right' });

        // Billing Address
        if (invoice.billingAddress) {
          doc.fontSize(12)
             .text('Bill To:', 50, 150)
             .fontSize(10)
             .text(invoice.billingAddress.name || '', 50, 170)
             .text(invoice.billingAddress.company || '', 50, 185)
             .text(invoice.billingAddress.address || '', 50, 200)
             .text(`${invoice.billingAddress.city || ''}, ${invoice.billingAddress.state || ''} ${invoice.billingAddress.zip || ''}`, 50, 215)
             .text(invoice.billingAddress.country || '', 50, 230);
        }

        // Items Table Header
        const tableTop = 280;
        doc.fontSize(10)
           .text('Description', 50, tableTop)
           .text('Quantity', 280, tableTop)
           .text('Unit Price', 350, tableTop)
           .text('Amount', 450, tableTop);

        // Draw line
        doc.moveTo(50, tableTop + 15)
           .lineTo(550, tableTop + 15)
           .stroke();

        // Items
        let position = tableTop + 30;
        invoice.items.forEach(item => {
          doc.fontSize(9)
             .text(item.description || item.name, 50, position)
             .text(item.quantity.toString(), 280, position)
             .text(`$${item.unitPrice.toFixed(2)}`, 350, position)
             .text(`$${(item.quantity * item.unitPrice).toFixed(2)}`, 450, position);
          position += 20;
        });

        // Totals
        const totalsTop = position + 30;
        doc.fontSize(10)
           .text('Subtotal:', 350, totalsTop)
           .text(`$${invoice.subtotal.toFixed(2)}`, 450, totalsTop);

        if (invoice.tax > 0) {
          doc.text('Tax:', 350, totalsTop + 20)
             .text(`$${invoice.tax.toFixed(2)}`, 450, totalsTop + 20);
        }

        if (invoice.discount > 0) {
          doc.text('Discount:', 350, totalsTop + 40)
             .text(`-$${invoice.discount.toFixed(2)}`, 450, totalsTop + 40);
        }

        // Total
        doc.fontSize(12)
           .text('Total:', 350, totalsTop + 70, { width: 100, align: 'left' })
           .text(`$${invoice.total.toFixed(2)}`, 450, totalsTop + 70);

        // Notes
        if (invoice.notes) {
          doc.fontSize(10)
             .text('Notes:', 50, totalsTop + 110)
             .fontSize(9)
             .text(invoice.notes, 50, totalsTop + 130, { width: 500 });
        }

        // Footer
        doc.fontSize(8)
           .text('Thank you for your business!', 50, 700, { align: 'center', width: 500 });

        // Finalize PDF
        doc.end();

        doc.on('end', () => {
          resolve(filepath);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Store invoice in database
   * @param {Object} invoice - Invoice data
   * @returns {Promise<void>}
   */
  async storeInvoice(invoice) {
    // This would typically store in a database
    // For now, we'll store in a JSON file as a mock
    const invoicesFile = path.join(this.invoicesDir, 'invoices.json');
    
    let invoices = [];
    if (fs.existsSync(invoicesFile)) {
      const data = fs.readFileSync(invoicesFile, 'utf8');
      invoices = JSON.parse(data);
    }
    
    invoices.push(invoice);
    fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));
  }

  /**
   * Get invoice by ID
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice data
   */
  async getInvoice(invoiceId) {
    const invoicesFile = path.join(this.invoicesDir, 'invoices.json');
    
    if (!fs.existsSync(invoicesFile)) {
      throw new Error('Invoice not found');
    }
    
    const data = fs.readFileSync(invoicesFile, 'utf8');
    const invoices = JSON.parse(data);
    const invoice = invoices.find(inv => inv.id === invoiceId);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    return invoice;
  }

  /**
   * Get user invoices
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} List of invoices
   */
  async getUserInvoices(userId, filters = {}) {
    const invoicesFile = path.join(this.invoicesDir, 'invoices.json');
    
    if (!fs.existsSync(invoicesFile)) {
      return [];
    }
    
    const data = fs.readFileSync(invoicesFile, 'utf8');
    let invoices = JSON.parse(data);
    
    // Filter by user
    invoices = invoices.filter(inv => inv.userId === userId);
    
    // Apply additional filters
    if (filters.status) {
      invoices = invoices.filter(inv => inv.status === filters.status);
    }
    
    if (filters.startDate) {
      invoices = invoices.filter(inv => new Date(inv.date) >= new Date(filters.startDate));
    }
    
    if (filters.endDate) {
      invoices = invoices.filter(inv => new Date(inv.date) <= new Date(filters.endDate));
    }
    
    // Sort by date (newest first)
    invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return invoices;
  }

  /**
   * Update invoice status
   * @param {string} invoiceId - Invoice ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated invoice
   */
  async updateInvoiceStatus(invoiceId, status) {
    const validStatuses = ['pending', 'paid', 'overdue', 'cancelled', 'refunded'];
    
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid invoice status');
    }
    
    const invoicesFile = path.join(this.invoicesDir, 'invoices.json');
    
    if (!fs.existsSync(invoicesFile)) {
      throw new Error('Invoice not found');
    }
    
    const data = fs.readFileSync(invoicesFile, 'utf8');
    const invoices = JSON.parse(data);
    const invoiceIndex = invoices.findIndex(inv => inv.id === invoiceId);
    
    if (invoiceIndex === -1) {
      throw new Error('Invoice not found');
    }
    
    invoices[invoiceIndex].status = status;
    invoices[invoiceIndex].updatedAt = new Date().toISOString();
    
    if (status === 'paid') {
      invoices[invoiceIndex].paidAt = new Date().toISOString();
    }
    
    fs.writeFileSync(invoicesFile, JSON.stringify(invoices, null, 2));
    
    return invoices[invoiceIndex];
  }

  /**
   * Send invoice email
   * @param {string} invoiceId - Invoice ID
   * @param {string} recipientEmail - Recipient email
   * @returns {Promise<boolean>} Success status
   */
  async sendInvoiceEmail(invoiceId, recipientEmail) {
    try {
      const invoice = await this.getInvoice(invoiceId);
      
      // This would integrate with an email service (SendGrid, AWS SES, etc.)
      // For now, we'll just log the action
      console.log(`Sending invoice ${invoice.invoiceNumber} to ${recipientEmail}`);
      
      // Mock email sending
      return true;
    } catch (error) {
      console.error('Error sending invoice email:', error);
      return false;
    }
  }

  /**
   * Generate invoice analytics
   * @param {string} userId - User ID
   * @param {Object} period - Time period
   * @returns {Promise<Object>} Analytics data
   */
  async getInvoiceAnalytics(userId, period = {}) {
    const invoices = await this.getUserInvoices(userId, period);
    
    const analytics = {
      totalInvoices: invoices.length,
      totalRevenue: 0,
      paidInvoices: 0,
      pendingInvoices: 0,
      overdueInvoices: 0,
      averageInvoiceValue: 0,
      monthlyRevenue: {},
      topItems: []
    };
    
    // Calculate metrics
    invoices.forEach(invoice => {
      analytics.totalRevenue += invoice.total;
      
      if (invoice.status === 'paid') {
        analytics.paidInvoices++;
      } else if (invoice.status === 'pending') {
        analytics.pendingInvoices++;
      } else if (invoice.status === 'overdue') {
        analytics.overdueInvoices++;
      }
      
      // Monthly revenue
      const month = new Date(invoice.date).toISOString().substring(0, 7);
      if (!analytics.monthlyRevenue[month]) {
        analytics.monthlyRevenue[month] = 0;
      }
      analytics.monthlyRevenue[month] += invoice.total;
    });
    
    // Calculate average
    if (analytics.totalInvoices > 0) {
      analytics.averageInvoiceValue = analytics.totalRevenue / analytics.totalInvoices;
    }
    
    return analytics;
  }
}

module.exports = new InvoiceService();
