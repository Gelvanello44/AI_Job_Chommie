// Frontend-safe config (never put secrets here)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1'
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'AI Job Chommie'
export const ENV = import.meta.env.VITE_ENV || 'development'

// Payments
export const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ''
export const YOCO_PUBLIC_KEY = import.meta.env.VITE_YOCO_PUBLIC_KEY || ''
export const DEFAULT_PAYMENT_PROVIDER = import.meta.env.VITE_DEFAULT_PAYMENT_PROVIDER || 'paystack'
export const DEFAULT_CURRENCY = 'ZAR'

// Plan pricing in ZAR (user can adjust via env later)
export const PLAN_PRICES_ZAR = {
  free: 0,
  pro: Number(import.meta.env.VITE_PRICE_PRO_ZAR || 8),
  executive: Number(import.meta.env.VITE_PRICE_EXEC_ZAR || 17),
}

// Public business credentials (as requested to display on site)
export const BUSINESS_INFO = {
  registeredName: 'AIJOBCHOMMIE',
  taxpayerRegistrationNumber: '2025/599261/07',
  taxpayerReferenceNumber: '9481880228',
}

// Bank transfer details (public display per request)
export const BUSINESS_BANK = {
  bankName: 'Capitec Business',
  accountType: 'Current',
  accountNumber: '1054043167',
  branchCode: '450105',
  accountHolder: 'AIJOBCHOMMIE',
}

