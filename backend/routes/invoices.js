const express = require('express');
const router = express.Router();
const invoiceService = require('../services/invoiceService');
const authMiddleware = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const { body, query, param, validationResult } = require('express-validator');

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * @route   POST /api/invoices
 * @desc    Generate a new invoice
 * @access  Private
 */
router.post(
  '/',
  authMiddleware,
  rateLimiter({ maxRequests: 10, windowMs: 60000 }), // 10 requests per minute
  [
    body('customerId').notEmpty().withMessage('Customer ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.description').notEmpty().withMessage('Item description is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Item unit price must be non-negative'),
    body('billingAddress').isObject().withMessage('Billing address is required'),
    body('billingAddress.name').notEmpty().withMessage('Billing name is required'),
    body('billingAddress.address').notEmpty().withMessage('Billing address is required'),
    body('billingAddress.city').notEmpty().withMessage('Billing city is required'),
    body('billingAddress.zip').notEmpty().withMessage('Billing ZIP code is required'),
    body('billingAddress.country').notEmpty().withMessage('Billing country is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const invoiceData = {
        ...req.body,
        userId: req.user.id,
      };

      const result = await invoiceService.generateInvoice(invoiceData);
      
      res.status(201).json({
        success: true,
        message: 'Invoice generated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error generating invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate invoice',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/invoices
 * @desc    Get user's invoices with optional filters
 * @access  Private
 */
router.get(
  '/',
  authMiddleware,
  rateLimiter({ maxRequests: 30, windowMs: 60000 }), // 30 requests per minute
  [
    query('status').optional().isIn(['pending', 'paid', 'overdue', 'cancelled', 'refunded']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const invoices = await invoiceService.getUserInvoices(req.user.id, filters);
      
      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedInvoices = invoices.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          invoices: paginatedInvoices,
          pagination: {
            total: invoices.length,
            page,
            limit,
            totalPages: Math.ceil(invoices.length / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoices',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/invoices/analytics
 * @desc    Get invoice analytics
 * @access  Private
 */
router.get(
  '/analytics',
  authMiddleware,
  rateLimiter({ maxRequests: 20, windowMs: 60000 }), // 20 requests per minute
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const period = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const analytics = await invoiceService.getInvoiceAnalytics(req.user.id, period);
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching invoice analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoice analytics',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/invoices/:id
 * @desc    Get a specific invoice
 * @access  Private
 */
router.get(
  '/:id',
  authMiddleware,
  rateLimiter({ maxRequests: 30, windowMs: 60000 }), // 30 requests per minute
  [
    param('id').notEmpty().withMessage('Invoice ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const invoice = await invoiceService.getInvoice(req.params.id);
      
      // Verify the invoice belongs to the user
      if (invoice.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: invoice
      });
    } catch (error) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }
      
      console.error('Error fetching invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoice',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/invoices/:id/download
 * @desc    Download invoice PDF
 * @access  Private
 */
router.get(
  '/:id/download',
  authMiddleware,
  rateLimiter({ maxRequests: 10, windowMs: 60000 }), // 10 requests per minute
  [
    param('id').notEmpty().withMessage('Invoice ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const invoice = await invoiceService.getInvoice(req.params.id);
      
      // Verify the invoice belongs to the user
      if (invoice.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Send PDF file
      const fs = require('fs');
      const path = require('path');
      
      if (!invoice.pdfPath || !fs.existsSync(invoice.pdfPath)) {
        return res.status(404).json({
          success: false,
          message: 'Invoice PDF not found'
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      
      const fileStream = fs.createReadStream(invoice.pdfPath);
      fileStream.pipe(res);
    } catch (error) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }
      
      console.error('Error downloading invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download invoice',
        error: error.message
      });
    }
  }
);

/**
 * @route   PUT /api/invoices/:id/status
 * @desc    Update invoice status
 * @access  Private
 */
router.put(
  '/:id/status',
  authMiddleware,
  rateLimiter({ maxRequests: 10, windowMs: 60000 }), // 10 requests per minute
  [
    param('id').notEmpty().withMessage('Invoice ID is required'),
    body('status').isIn(['pending', 'paid', 'overdue', 'cancelled', 'refunded']).withMessage('Invalid status')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const invoice = await invoiceService.getInvoice(req.params.id);
      
      // Verify the invoice belongs to the user or user is admin
      if (invoice.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const updatedInvoice = await invoiceService.updateInvoiceStatus(req.params.id, req.body.status);
      
      res.json({
        success: true,
        message: 'Invoice status updated successfully',
        data: updatedInvoice
      });
    } catch (error) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }
      
      console.error('Error updating invoice status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update invoice status',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/invoices/:id/send
 * @desc    Send invoice via email
 * @access  Private
 */
router.post(
  '/:id/send',
  authMiddleware,
  rateLimiter({ maxRequests: 5, windowMs: 60000 }), // 5 requests per minute
  [
    param('id').notEmpty().withMessage('Invoice ID is required'),
    body('email').isEmail().withMessage('Valid email is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const invoice = await invoiceService.getInvoice(req.params.id);
      
      // Verify the invoice belongs to the user
      if (invoice.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const sent = await invoiceService.sendInvoiceEmail(req.params.id, req.body.email);
      
      if (sent) {
        res.json({
          success: true,
          message: 'Invoice sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send invoice'
        });
      }
    } catch (error) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }
      
      console.error('Error sending invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send invoice',
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/invoices/:id
 * @desc    Delete an invoice (soft delete)
 * @access  Private
 */
router.delete(
  '/:id',
  authMiddleware,
  rateLimiter({ maxRequests: 5, windowMs: 60000 }), // 5 requests per minute
  [
    param('id').notEmpty().withMessage('Invoice ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const invoice = await invoiceService.getInvoice(req.params.id);
      
      // Verify the invoice belongs to the user or user is admin
      if (invoice.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Only allow deletion of draft or cancelled invoices
      if (!['cancelled', 'refunded'].includes(invoice.status) && !req.user.isAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Can only delete cancelled or refunded invoices'
        });
      }

      // Update status to deleted (soft delete)
      await invoiceService.updateInvoiceStatus(req.params.id, 'cancelled');
      
      res.json({
        success: true,
        message: 'Invoice deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }
      
      console.error('Error deleting invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete invoice',
        error: error.message
      });
    }
  }
);

module.exports = router;
