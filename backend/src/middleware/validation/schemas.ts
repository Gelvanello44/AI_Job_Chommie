/**
 * Comprehensive Validation Schemas
 * Centralized validation schemas for all API endpoints
 */

import { z } from 'zod';

// =============================================
// COMMON VALIDATION SCHEMAS
// =============================================

export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid ID format'),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  
  // Search
  search: z.object({
    q: z.string().min(1, 'Search query cannot be empty').max(255, 'Search query too long').optional(),
    filters: z.record(z.string()).optional(),
  }),
  
  // Date range
  dateRange: z.object({
    startDate: z.string().datetime('Invalid start date format').optional(),
    endDate: z.string().datetime('Invalid end date format').optional(),
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, 'Start date must be before end date'),
  
  // Email with additional validation
  email: z.string()
    .email('Invalid email address')
    .max(254, 'Email address too long')
    .toLowerCase(),
  
  // South African phone number
  phone: z.string()
    .regex(/^(\+27|0)[6-8][0-9]{8}$/, 'Invalid South African phone number')
    .transform(phone => phone.replace(/^0/, '+27')),
  
  // Strong password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  
  // South African ID number with checksum validation
  idNumber: z.string()
    .regex(/^[0-9]{13}$/, 'Invalid South African ID number format')
    .refine(validateSAIdNumber, 'Invalid South African ID number'),
  
  // Province validation
  province: z.enum([
    'EASTERN_CAPE',
    'FREE_STATE', 
    'GAUTENG',
    'KWAZULU_NATAL',
    'LIMPOPO',
    'MPUMALANGA',
    'NORTHERN_CAPE',
    'NORTH_WEST',
    'WESTERN_CAPE',
  ]),
  
  // Job type validation
  jobType: z.enum([
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'INTERNSHIP',
    'TEMPORARY',
    'REMOTE',
  ]),
  
  // Experience level validation
  experienceLevel: z.enum([
    'ENTRY_LEVEL',
    'JUNIOR',
    'MID_LEVEL',
    'SENIOR',
    'EXECUTIVE',
  ]),
  
  // Subscription plan validation
  subscriptionPlan: z.enum([
    'FREE',
    'BASIC',
    'PROFESSIONAL',
    'ENTERPRISE',
  ]),
  
  // Language codes (South African languages)
  languageCode: z.enum([
    'en',    // English
    'af',    // Afrikaans
    'zu',    // Zulu
    'xh',    // Xhosa
    'st',    // Sesotho
    'nso',   // Northern Sotho
    'tn',    // Setswana
    've',    // Venda
    'ss',    // Siswati
    'ts',    // Xitsonga
    'nr',    // Ndebele
  ]),
  
  // URL validation
  url: z.string().url('Invalid URL format'),
  
  // Name validation (South African names)
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s\-'\.àáâäãåèéêëìíîïòóôöõùúûüÿýñçčšžÀÁÂÄÃÅÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜŸÝÑßÇŒÆČŠŽ∂ð]+$/, 'Invalid characters in name'),
  
  // Salary range
  salary: z.object({
    min: z.number().min(0, 'Minimum salary cannot be negative').optional(),
    max: z.number().min(0, 'Maximum salary cannot be negative').optional(),
    currency: z.enum(['ZAR', 'USD', 'EUR', 'GBP']).default('ZAR'),
  }).refine(data => {
    if (data.min && data.max) {
      return data.min <= data.max;
    }
    return true;
  }, 'Minimum salary must be less than or equal to maximum salary'),
};

// =============================================
// USER VALIDATION SCHEMAS
// =============================================

export const userSchemas = {
  register: z.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    firstName: commonSchemas.name,
    lastName: commonSchemas.name,
    phone: commonSchemas.phone.optional(),
    province: commonSchemas.province.optional(),
    idNumber: commonSchemas.idNumber.optional(),
    termsAccepted: z.boolean().refine(val => val === true, 'Terms must be accepted'),
    marketingConsent: z.boolean().default(false),
    preferredLanguage: commonSchemas.languageCode.default('en'),
  }),
  
  login: z.object({
    email: commonSchemas.email,
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().default(false),
  }),
  
  updateProfile: z.object({
    firstName: commonSchemas.name.optional(),
    lastName: commonSchemas.name.optional(),
    phone: commonSchemas.phone.optional(),
    province: commonSchemas.province.optional(),
    city: z.string().min(2, 'City must be at least 2 characters').max(100, 'City cannot exceed 100 characters').optional(),
    bio: z.string().max(500, 'Bio cannot exceed 500 characters').optional(),
    website: commonSchemas.url.optional(),
    linkedinUrl: commonSchemas.url.optional(),
    githubUrl: commonSchemas.url.optional(),
    preferredLanguage: commonSchemas.languageCode.optional(),
    profilePicture: z.string().url('Invalid profile picture URL').optional(),
    skills: z.array(z.string().min(1).max(50)).max(50, 'Cannot have more than 50 skills').optional(),
    experience: z.object({
      years: z.number().min(0, 'Experience years cannot be negative').max(70, 'Experience years cannot exceed 70'),
      level: commonSchemas.experienceLevel,
    }).optional(),
  }),
  
  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: commonSchemas.password,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  }),
  
  forgotPassword: z.object({
    email: commonSchemas.email,
  }),
  
  resetPassword: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: commonSchemas.password,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  }).refine(data => data.password === data.confirmPassword, {
    message: 'Password and confirmation do not match',
    path: ['confirmPassword'],
  }),
  
  verifyEmail: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),
  
  verifyPhone: z.object({
    code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
  }),
};

// =============================================
// JOB VALIDATION SCHEMAS
// =============================================

export const jobSchemas = {
  search: z.object({
    q: z.string().min(1, 'Search query is required').max(255, 'Search query too long').optional(),
    location: z.string().max(100, 'Location too long').optional(),
    province: commonSchemas.province.optional(),
    jobType: z.array(commonSchemas.jobType).optional(),
    experienceLevel: z.array(commonSchemas.experienceLevel).optional(),
    salary: commonSchemas.salary.optional(),
    skills: z.array(z.string().min(1).max(50)).max(20, 'Cannot search for more than 20 skills').optional(),
    remote: z.boolean().optional(),
    datePosted: z.enum(['today', 'week', 'month', 'anytime']).default('anytime'),
    companySize: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
    industry: z.string().max(100, 'Industry name too long').optional(),
    ...commonSchemas.pagination.shape,
  }),
  
  create: z.object({
    title: z.string().min(3, 'Job title must be at least 3 characters').max(200, 'Job title too long'),
    description: z.string().min(50, 'Job description must be at least 50 characters').max(10000, 'Job description too long'),
    requirements: z.array(z.string().min(1).max(200)).min(1, 'At least one requirement is needed').max(20, 'Cannot have more than 20 requirements'),
    responsibilities: z.array(z.string().min(1).max(200)).min(1, 'At least one responsibility is needed').max(20, 'Cannot have more than 20 responsibilities'),
    skills: z.array(z.string().min(1).max(50)).min(1, 'At least one skill is required').max(30, 'Cannot have more than 30 skills'),
    location: z.string().min(2, 'Location must be at least 2 characters').max(100, 'Location too long'),
    province: commonSchemas.province,
    jobType: commonSchemas.jobType,
    experienceLevel: commonSchemas.experienceLevel,
    salary: commonSchemas.salary.optional(),
    remote: z.boolean().default(false),
    benefits: z.array(z.string().min(1).max(200)).max(15, 'Cannot have more than 15 benefits').optional(),
    applicationDeadline: z.string().datetime('Invalid deadline format').optional(),
    companyId: commonSchemas.uuid,
  }),
  
  update: z.object({
    title: z.string().min(3, 'Job title must be at least 3 characters').max(200, 'Job title too long').optional(),
    description: z.string().min(50, 'Job description must be at least 50 characters').max(10000, 'Job description too long').optional(),
    requirements: z.array(z.string().min(1).max(200)).max(20, 'Cannot have more than 20 requirements').optional(),
    responsibilities: z.array(z.string().min(1).max(200)).max(20, 'Cannot have more than 20 responsibilities').optional(),
    skills: z.array(z.string().min(1).max(50)).max(30, 'Cannot have more than 30 skills').optional(),
    location: z.string().min(2, 'Location must be at least 2 characters').max(100, 'Location too long').optional(),
    province: commonSchemas.province.optional(),
    jobType: commonSchemas.jobType.optional(),
    experienceLevel: commonSchemas.experienceLevel.optional(),
    salary: commonSchemas.salary.optional(),
    remote: z.boolean().optional(),
    benefits: z.array(z.string().min(1).max(200)).max(15, 'Cannot have more than 15 benefits').optional(),
    applicationDeadline: z.string().datetime('Invalid deadline format').optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']).optional(),
  }),
  
  apply: z.object({
    coverLetter: z.string().max(5000, 'Cover letter too long').optional(),
    cvId: commonSchemas.uuid.optional(),
    resumeId: commonSchemas.uuid.optional(),
    additionalInfo: z.string().max(1000, 'Additional info too long').optional(),
    expectedSalary: z.number().min(0, 'Expected salary cannot be negative').optional(),
    availableStartDate: z.string().datetime('Invalid start date format').optional(),
  }),
};

// =============================================
// COMPANY VALIDATION SCHEMAS
// =============================================

export const companySchemas = {
  create: z.object({
    name: z.string().min(2, 'Company name must be at least 2 characters').max(200, 'Company name too long'),
    description: z.string().min(10, 'Company description must be at least 10 characters').max(5000, 'Company description too long'),
    website: commonSchemas.url.optional(),
    industry: z.string().min(2, 'Industry must be at least 2 characters').max(100, 'Industry name too long'),
    size: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']),
    location: z.string().min(2, 'Location must be at least 2 characters').max(200, 'Location too long'),
    province: commonSchemas.province,
    logo: commonSchemas.url.optional(),
    founded: z.number().min(1800, 'Invalid founding year').max(new Date().getFullYear(), 'Founding year cannot be in the future').optional(),
    email: commonSchemas.email,
    phone: commonSchemas.phone.optional(),
  }),
  
  update: z.object({
    name: z.string().min(2, 'Company name must be at least 2 characters').max(200, 'Company name too long').optional(),
    description: z.string().min(10, 'Company description must be at least 10 characters').max(5000, 'Company description too long').optional(),
    website: commonSchemas.url.optional(),
    industry: z.string().min(2, 'Industry must be at least 2 characters').max(100, 'Industry name too long').optional(),
    size: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional(),
    location: z.string().min(2, 'Location must be at least 2 characters').max(200, 'Location too long').optional(),
    province: commonSchemas.province.optional(),
    logo: commonSchemas.url.optional(),
    founded: z.number().min(1800, 'Invalid founding year').max(new Date().getFullYear(), 'Founding year cannot be in the future').optional(),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional(),
  }),
};

// =============================================
// APPLICATION VALIDATION SCHEMAS
// =============================================

export const applicationSchemas = {
  create: z.object({
    jobId: commonSchemas.uuid,
    coverLetter: z.string().max(5000, 'Cover letter too long').optional(),
    resumeId: commonSchemas.uuid.optional(),
    expectedSalary: z.number().min(0, 'Expected salary cannot be negative').optional(),
    availableStartDate: z.string().datetime('Invalid start date format').optional(),
    additionalNotes: z.string().max(1000, 'Additional notes too long').optional(),
  }),
  
  updateStatus: z.object({
    status: z.enum(['APPLIED', 'REVIEWING', 'INTERVIEWING', 'OFFERED', 'REJECTED', 'WITHDRAWN', 'HIRED']),
    notes: z.string().max(1000, 'Notes too long').optional(),
    interviewDate: z.string().datetime('Invalid interview date format').optional(),
  }),
  
  bulkUpdate: z.object({
    applicationIds: z.array(commonSchemas.uuid).min(1, 'At least one application ID is required').max(100, 'Cannot update more than 100 applications at once'),
    status: z.enum(['APPLIED', 'REVIEWING', 'INTERVIEWING', 'OFFERED', 'REJECTED', 'WITHDRAWN', 'HIRED']),
    notes: z.string().max(1000, 'Notes too long').optional(),
  }),
};

// =============================================
// PAYMENT VALIDATION SCHEMAS
// =============================================

export const paymentSchemas = {
  initialize: z.object({
    amount: z.number().min(1, 'Amount must be at least 1 cent').max(1000000, 'Amount too large'),
    currency: z.enum(['ZAR', 'USD', 'EUR', 'GBP']).default('ZAR'),
    provider: z.enum(['paystack', 'yoco']).optional(),
    planId: z.string().min(1, 'Plan ID is required').optional(),
    callbackUrl: commonSchemas.url.optional(),
    metadata: z.record(z.any()).optional(),
  }),
  
  verify: z.object({
    reference: z.string().min(1, 'Payment reference is required'),
    provider: z.enum(['paystack', 'yoco']).optional(),
  }),
  
  subscription: z.object({
    planId: z.string().min(1, 'Plan ID is required'),
    provider: z.enum(['paystack', 'yoco']).default('paystack'),
    paymentMethodId: z.string().min(1, 'Payment method ID is required').optional(),
    billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  }),
  
  webhook: z.object({
    event: z.string().min(1, 'Event type is required'),
    data: z.record(z.any()),
    signature: z.string().min(1, 'Webhook signature is required'),
  }),
};

// =============================================
// FILE VALIDATION SCHEMAS
// =============================================

export const fileSchemas = {
  upload: z.object({
    type: z.enum(['cv', 'resume', 'cover-letter', 'portfolio', 'certificate', 'transcript']),
    title: z.string().min(1, 'File title is required').max(200, 'File title too long').optional(),
    description: z.string().max(1000, 'File description too long').optional(),
  }),
  
  update: z.object({
    title: z.string().min(1, 'File title is required').max(200, 'File title too long').optional(),
    description: z.string().max(1000, 'File description too long').optional(),
    visibility: z.enum(['private', 'public', 'shared']).optional(),
  }),
  
  share: z.object({
    emails: z.array(commonSchemas.email).min(1, 'At least one email is required').max(10, 'Cannot share with more than 10 people'),
    message: z.string().max(500, 'Share message too long').optional(),
    expiresAt: z.string().datetime('Invalid expiry date format').optional(),
  }),
};

// =============================================
// SUBSCRIPTION & QUOTA VALIDATION SCHEMAS
// =============================================

export const subscriptionSchemas = {
  upgrade: z.object({
    planId: z.string().min(1, 'Plan ID is required'),
    billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
    paymentMethodId: z.string().min(1, 'Payment method is required').optional(),
    couponCode: z.string().max(50, 'Coupon code too long').optional(),
  }),
  
  cancel: z.object({
    reason: z.string().max(500, 'Cancellation reason too long').optional(),
    feedback: z.string().max(1000, 'Feedback too long').optional(),
    immediateCancel: z.boolean().default(false),
  }),
  
  quotaUsage: z.object({
    feature: z.enum(['job_applications', 'cv_uploads', 'job_alerts', 'ai_matching', 'priority_support']),
    amount: z.number().min(1, 'Usage amount must be at least 1').optional(),
  }),
};

// =============================================
// AI/ML VALIDATION SCHEMAS
// =============================================

export const aiSchemas = {
  jobMatching: z.object({
    jobId: commonSchemas.uuid,
    userSkills: z.array(z.string().min(1).max(50)).max(50, 'Cannot have more than 50 skills'),
    experience: z.number().min(0, 'Experience cannot be negative').max(70, 'Experience cannot exceed 70 years'),
    preferences: z.object({
      location: z.string().max(100, 'Location preference too long').optional(),
      remote: z.boolean().optional(),
      salaryRange: commonSchemas.salary.optional(),
      jobTypes: z.array(commonSchemas.jobType).optional(),
    }).optional(),
  }),
  
  skillsAssessment: z.object({
    skills: z.array(z.string().min(1).max(50)).min(1, 'At least one skill is required').max(20, 'Cannot assess more than 20 skills'),
    experience: z.number().min(0, 'Experience cannot be negative').max(70, 'Experience cannot exceed 70 years'),
    industry: z.string().max(100, 'Industry name too long').optional(),
  }),
  
  coverLetterGeneration: z.object({
    jobId: commonSchemas.uuid,
    tone: z.enum(['professional', 'friendly', 'confident', 'creative']).default('professional'),
    length: z.enum(['short', 'medium', 'long']).default('medium'),
    highlights: z.array(z.string().min(1).max(200)).max(10, 'Cannot have more than 10 highlights').optional(),
  }),
  
  resumeOptimization: z.object({
    resumeId: commonSchemas.uuid,
    targetJobId: commonSchemas.uuid.optional(),
    targetKeywords: z.array(z.string().min(1).max(50)).max(20, 'Cannot have more than 20 keywords').optional(),
    optimizationLevel: z.enum(['basic', 'advanced', 'expert']).default('basic'),
  }),
};

// =============================================
// NOTIFICATION VALIDATION SCHEMAS
// =============================================

export const notificationSchemas = {
  settings: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    push: z.boolean().default(true),
    jobAlerts: z.boolean().default(true),
    applicationUpdates: z.boolean().default(true),
    marketingEmails: z.boolean().default(false),
    weeklyDigest: z.boolean().default(true),
  }),
  
  jobAlert: z.object({
    name: z.string().min(1, 'Alert name is required').max(100, 'Alert name too long'),
    searchCriteria: jobSchemas.search.omit({ page: true, limit: true }),
    frequency: z.enum(['immediate', 'daily', 'weekly']).default('daily'),
    isActive: z.boolean().default(true),
  }),
  
  send: z.object({
    userIds: z.array(commonSchemas.uuid).min(1, 'At least one user ID is required').max(1000, 'Cannot send to more than 1000 users'),
    title: z.string().min(1, 'Notification title is required').max(100, 'Title too long'),
    message: z.string().min(1, 'Notification message is required').max(500, 'Message too long'),
    type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
    actionUrl: commonSchemas.url.optional(),
  }),
};

// =============================================
// ANALYTICS VALIDATION SCHEMAS
// =============================================

export const analyticsSchemas = {
  event: z.object({
    event: z.string().min(1, 'Event name is required').max(100, 'Event name too long'),
    properties: z.record(z.any()).optional(),
    userId: commonSchemas.uuid.optional(),
    sessionId: z.string().max(100, 'Session ID too long').optional(),
  }),
  
  query: z.object({
    metric: z.string().min(1, 'Metric name is required'),
    ...commonSchemas.dateRange.shape,
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
    filters: z.record(z.any()).optional(),
  }),
};

// =============================================
// ADMIN VALIDATION SCHEMAS
// =============================================

export const adminSchemas = {
  userManagement: z.object({
    action: z.enum(['suspend', 'activate', 'delete', 'verify']),
    userIds: z.array(commonSchemas.uuid).min(1, 'At least one user ID is required').max(100, 'Cannot perform bulk action on more than 100 users'),
    reason: z.string().max(500, 'Reason too long').optional(),
  }),
  
  systemConfig: z.object({
    key: z.string().min(1, 'Config key is required').max(100, 'Config key too long'),
    value: z.any(),
    description: z.string().max(500, 'Description too long').optional(),
  }),
  
  featureFlag: z.object({
    name: z.string().min(1, 'Feature flag name is required').max(100, 'Feature flag name too long'),
    enabled: z.boolean(),
    rolloutPercentage: z.number().min(0, 'Rollout percentage cannot be negative').max(100, 'Rollout percentage cannot exceed 100').optional(),
    userSegments: z.array(z.string()).optional(),
  }),
};

// =============================================
// INTEGRATION VALIDATION SCHEMAS
// =============================================

export const integrationSchemas = {
  linkedin: z.object({
    accessToken: z.string().min(1, 'LinkedIn access token is required'),
    permissions: z.array(z.string()).optional(),
  }),
  
  google: z.object({
    accessToken: z.string().min(1, 'Google access token is required'),
    refreshToken: z.string().min(1, 'Google refresh token is required').optional(),
    scope: z.array(z.string()).optional(),
  }),
  
  webhook: z.object({
    url: commonSchemas.url,
    events: z.array(z.string().min(1)).min(1, 'At least one event type is required'),
    secret: z.string().min(32, 'Webhook secret must be at least 32 characters').max(256, 'Webhook secret too long'),
    isActive: z.boolean().default(true),
  }),
};

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Validate South African ID number with Luhn algorithm
 */
function validateSAIdNumber(idNumber: string): boolean {
  if (!/^[0-9]{13}$/.test(idNumber)) {
    return false;
  }
  
  // Check date validity
  const year = parseInt(idNumber.substring(0, 2));
  const month = parseInt(idNumber.substring(2, 4));
  const day = parseInt(idNumber.substring(4, 6));
  
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  
  // Luhn check
  let sum = 0;
  let alternate = false;
  
  for (let i = idNumber.length - 1; i >= 0; i--) {
    let n = parseInt(idNumber.charAt(i));
    if (alternate) {
      n *= 2;
      if (n > 9) {
        n = (n % 10) + 1;
      }
    }
    sum += n;
    alternate = !alternate;
  }
  
  return sum % 10 === 0;
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(str: string): string {
  return str
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Validate file upload
 */
export function validateFileUpload(file: any, allowedTypes: string[], maxSize: number): boolean {
  if (!file) return false;
  
  // Check file size
  if (file.size > maxSize) {
    throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
  }
  
  // Check file type
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error(`File type ${file.mimetype} not allowed`);
  }
  
  return true;
}

/**
 * Password strength validation
 */
export function validatePasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');
  
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');
  
  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');
  
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
  else feedback.push('Include special characters');
  
  if (password.length >= 12) score += 1;
  if (/^(?!.*(.)\1{2,})/.test(password)) score += 1; // No repeated characters
  
  return { score, feedback };
}

/**
 * Rate limiting key generators
 */
export const rateLimitKeyGenerators = {
  byUser: (req: any) => req.user?.id || req.ip || 'unknown',
  byEmail: (req: any) => req.body?.email || req.ip || 'unknown',
  byIP: (req: any) => req.ip || 'unknown',
  byAPIKey: (req: any) => req.headers['x-api-key'] || req.ip || 'unknown',
};

/**
 * Custom validation middleware for express-validator compatibility
 */
export const validateRequest = (req: any, res: any, next: any) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((err: any) => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  
  next();
};

// =============================================
// EXPORT ALL SCHEMAS
// =============================================

export const validationSchemas = {
  common: commonSchemas,
  user: userSchemas,
  job: jobSchemas,
  company: companySchemas,
  application: applicationSchemas,
  payment: paymentSchemas,
  file: fileSchemas,
  subscription: subscriptionSchemas,
  ai: aiSchemas,
  notification: notificationSchemas,
  analytics: analyticsSchemas,
  admin: adminSchemas,
  integration: integrationSchemas,
};

export default validationSchemas;
