/**
 * Payment Provider Interface
 * Allows multiple payment providers to co-exist (Paystack, Yoco, etc.)
 */

export interface PaymentCustomer {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface PaymentPlan {
  name: string;
  amount: number; // in cents
  interval: 'monthly' | 'yearly';
  currency: string;
  description?: string;
}

export interface PaymentTransaction {
  reference: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  provider: 'paystack' | 'yoco';
  metadata?: Record<string, any>;
}

export interface PaymentSubscription {
  id: string;
  customerEmail: string;
  planCode: string;
  status: 'active' | 'cancelled' | 'paused';
  nextPaymentDate?: Date;
  provider: 'paystack' | 'yoco';
}

export interface PaymentProvider {
  name: 'paystack' | 'yoco';
  
  // Initialize payment
  initializePayment(params: {
    email: string;
    amount: number;
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>;
  
  // Verify payment
  verifyPayment(reference: string): Promise<PaymentTransaction>;
  
  // Create subscription
  createSubscription(params: {
    customer: PaymentCustomer;
    plan: string;
    authorization?: string;
  }): Promise<PaymentSubscription>;
  
  // Cancel subscription
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  
  // Get subscription
  getSubscription(subscriptionId: string): Promise<PaymentSubscription>;
  
  // Webhook verification
  verifyWebhookSignature(body: any, signature: string): boolean;
  
  // Handle webhook
  handleWebhook(event: any): Promise<void>;
}
