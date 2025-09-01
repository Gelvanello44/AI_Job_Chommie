/**
 * Webhook Routes
 * Handles webhooks from payment providers
 */

import { Router, Request, Response } from 'express';
import { paymentService } from '../services/payment';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

/**
 * Yoco Webhook Handler
 * POST /api/v1/webhooks/yoco
 */
router.post('/yoco', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-yoco-signature'] as string;
    
    if (!signature) {
      logger.warn('Yoco webhook received without signature');
      return res.status(401).json({ error: 'No signature provided' });
    }
    
    // Verify webhook signature
    const isValid = paymentService.verifyWebhookSignature('yoco', req.body, signature);
    
    if (!isValid) {
      logger.warn('Invalid Yoco webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Process webhook
    await paymentService.handleWebhook('yoco', req.body);
    
    // Yoco expects a 200 response
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error processing Yoco webhook:', error);
    // Return 200 to prevent retries for processing errors
    res.status(200).json({ error: 'Processing error' });
  }
});

/**
 * Paystack Webhook Handler
 * POST /api/v1/webhooks/paystack
 */
router.post('/paystack', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    
    if (!signature) {
      logger.warn('Paystack webhook received without signature');
      return res.status(401).json({ error: 'No signature provided' });
    }
    
    // Verify webhook signature
    const isValid = paymentService.verifyWebhookSignature('paystack', req.body, signature);
    
    if (!isValid) {
      logger.warn('Invalid Paystack webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Process webhook
    await paymentService.handleWebhook('paystack', req.body);
    
    // Paystack expects a 200 response
    res.status(200).send();
  } catch (error) {
    logger.error('Error processing Paystack webhook:', error);
    // Return 200 to prevent retries for processing errors
    res.status(200).json({ error: 'Processing error' });
  }
});

/**
 * Generic webhook handler for testing
 * POST /api/v1/webhooks/test
 */
router.post('/test', (req: Request, res: Response) => {
  logger.info('Test webhook received', {
    headers: req.headers,
    body: req.body
  });
  
  res.status(200).json({
    message: 'Test webhook received',
    timestamp: new Date().toISOString()
  });
});

/**
 * Webhook status endpoint
 * GET /api/v1/webhooks/status
 */
router.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'active',
    endpoints: {
      yoco: '/api/v1/webhooks/yoco',
      paystack: '/api/v1/webhooks/paystack',
      test: '/api/v1/webhooks/test'
    }
  });
});

export default router;
