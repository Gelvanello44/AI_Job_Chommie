import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import rateLimit from 'express-rate-limit';
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';
import { AppError } from './errorHandler';

/**
 * Enhanced validation middleware for request body with sanitization
 */
export function validateBody<T extends ZodSchema>(schema: T, options?: {
  sanitize?: boolean;
  allowUnknown?: boolean;
  strict?: boolean;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Pre-validation sanitization
      if (options?.sanitize) {
        req.body = sanitizeObject(req.body);
      }
      
      // Validate against schema
      const validated = await schema.parseAsync(req.body);
      
      // Handle unknown fields
      if (!options?.allowUnknown) {
        req.body = validated;
      } else {
        req.body = { ...req.body, ...validated };
      }
      
      // Additional security checks in strict mode
      if (options?.strict) {
        performSecurityChecks(req.body);
      }
      
      next();
    } catch (error) {
      handleValidationError(error, res, 'Request body validation failed');
    }
  };
}

/**
 * Validate request params with enhanced error handling
 */
export function validateParams<T extends ZodSchema>(schema: T, options?: {
  sanitize?: boolean;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Pre-validation sanitization
      if (options?.sanitize) {
        req.params = sanitizeObject(req.params);
      }
      
      // Validate against schema
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      handleValidationError(error, res, 'URL parameter validation failed');
    }
  };
}

/**
 * Validate request query with enhanced features
 */
export function validateQuery<T extends ZodSchema>(schema: T, options?: {
  sanitize?: boolean;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Pre-validation sanitization
      if (options?.sanitize) {
        req.query = sanitizeObject(req.query as any);
      }
      
      // Validate against schema
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      handleValidationError(error, res, 'Query parameter validation failed');
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid ID format'),
  
  // Pagination
  pagination: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  
  // Search
  search: z.object({
    q: z.string().min(1).optional(),
    filters: z.record(z.string()).optional(),
  }),
  
  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
  
  // Email
  email: z.string().email('Invalid email address'),
  
  // Phone (South African format)
  phone: z.string().regex(
    /^(\+27|0)[6-8][0-9]{8}$/,
    'Invalid South African phone number'
  ),
  
  // Password
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  
  // South African ID number
  idNumber: z.string().regex(
    /^[0-9]{2}[0-1][0-9][0-3][0-9][0-9]{4}[0-1][0-9][0-9]$/,
    'Invalid South African ID number'
  ),
  
  // Province
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
  
  // Job type
  jobType: z.enum([
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'INTERNSHIP',
    'TEMPORARY',
    'REMOTE',
  ]),
  
  // Experience level
  experienceLevel: z.enum([
    'ENTRY_LEVEL',
    'JUNIOR',
    'MID_LEVEL',
    'SENIOR',
    'EXECUTIVE',
  ]),
  
  // Subscription plan
  subscriptionPlan: z.enum([
    'FREE',
    'BASIC',
    'PROFESSIONAL',
    'ENTERPRISE',
  ]),
  
  // File upload
  file: z.object({
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z.string(),
    size: z.number(),
    buffer: z.instanceof(Buffer).optional(),
    path: z.string().optional(),
  }),
};

// Alias for backward compatibility
export const validateRequest = validateBody;

/**
 * Sanitize string input
 */
export function sanitizeString(str: string): string {
  return str
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '');
}

/**
 * Validate South African ID number with enhanced Luhn algorithm
 */
export function validateSAIdNumber(idNumber: string): boolean {
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
  
  // Check if birth year is reasonable (1900-current year)
  const currentYear = new Date().getFullYear() % 100;
  if (year > currentYear + 10 && year < 50) {
    return false; // Likely invalid future date
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
 * Enhanced input sanitization
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(sanitizeString(obj));
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key names and validate they're safe
      const sanitizedKey = validator.escape(key.trim());
      if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedKey)) {
        continue; // Skip invalid keys
      }
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Handle validation errors consistently
 */
function handleValidationError(error: unknown, res: Response, defaultMessage: string): void {
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.') || 'unknown',
      message: err.message,
      code: 'code' in err ? err.code : undefined,
      received: 'received' in err ? err.received : undefined,
    }));
    
    res.status(400).json({
      success: false,
      error: defaultMessage,
      details: validationErrors,
      timestamp: new Date().toISOString(),
    });
    return;
  }
  
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
    });
    return;
  }
  
  res.status(400).json({
    success: false,
    error: defaultMessage,
    details: error instanceof Error ? error.message : 'Unknown validation error',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Perform security checks on validated data
 */
function performSecurityChecks(data: any): void {
  const dataStr = JSON.stringify(data);
  
  // Check for potential XSS patterns
  const xssPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>/i,
    /<object[^>]*>/i,
    /<embed[^>]*>/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];
  
  for (const pattern of xssPatterns) {
    if (pattern.test(dataStr)) {
      throw new AppError('Potentially dangerous content detected', 400);
    }
  }
  
  // Check for SQL injection patterns
  const sqlPatterns = [
    /('|(\-\-)|(;)|(\||\|)|(\*|\*))/i,
    /(union|select|insert|delete|update|drop|create|alter|exec|execute)/i,
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(dataStr)) {
      throw new AppError('Potentially dangerous SQL content detected', 400);
    }
  }
}

/**
 * Validate file uploads with comprehensive security checks
 */
export const validateFileUpload = (options: {
  allowedTypes: string[];
  maxSize: number;
  maxFiles?: number;
  required?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files;
      const file = req.file;
      
      // Check if file is required
      if (options.required && !file && (!files || Object.keys(files).length === 0)) {
        throw new AppError('File upload is required', 400);
      }
      
      // Validate single file
      if (file) {
        validateSingleFile(file, options.allowedTypes, options.maxSize);
      }
      
      // Validate multiple files
      if (files) {
        const fileArray = Array.isArray(files) ? files : Object.values(files).flat();
        
        if (options.maxFiles && fileArray.length > options.maxFiles) {
          throw new AppError(`Cannot upload more than ${options.maxFiles} files`, 400);
        }
        
        fileArray.forEach((f: any) => {
          validateSingleFile(f, options.allowedTypes, options.maxSize);
        });
      }
      
      next();
    } catch (error) {
      if (error instanceof AppError) {
        handleValidationError(error, res, 'File validation failed');
        return;
      }
      handleValidationError(new AppError('File validation failed', 400), res, 'File validation failed');
    }
  };
};

/**
 * Validate a single file
 */
function validateSingleFile(file: any, allowedTypes: string[], maxSize: number): void {
  if (!file) {
    throw new AppError('No file provided', 400);
  }
  
  // Check file size
  if (file.size > maxSize) {
    throw new AppError(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`, 413);
  }
  
  // Check file type
  if (!allowedTypes.includes(file.mimetype)) {
    throw new AppError(`File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`, 415);
  }
  
  // Check filename for malicious patterns
  const filename = file.originalname || file.filename || '';
  if (/\.\.[\/\\]/.test(filename) || /[<>:"|?*]/.test(filename)) {
    throw new AppError('Invalid filename detected', 400);
  }
  
  // Check for executable file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.js', '.jar', '.app'];
  const fileExt = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (dangerousExtensions.includes(fileExt)) {
    throw new AppError('Executable files are not allowed', 400);
  }
}

/**
 * Validate API key format and structure
 */
export const validateAPIKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    throw new AppError('API key is required', 401);
  }
  
  // Validate API key format
  if (!validator.isAlphanumeric(apiKey.replace(/[-_]/g, '')) || apiKey.length < 32) {
    throw new AppError('Invalid API key format', 401);
  }
  
  // Check for common weak patterns
  if (/^(test|demo|sample|example)/i.test(apiKey)) {
    throw new AppError('Invalid API key', 401);
  }
  
  next();
};

/**
 * Comprehensive input sanitization middleware
 */
export const sanitizeInputs = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query as any);
    }
    
    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    handleValidationError(error, res, 'Input sanitization failed');
  }
};

/**
 * Content Security Policy validation
 */
export const validateCSP = (req: Request, res: Response, next: NextFunction) => {
  const requestStr = JSON.stringify(req.body || {}) + JSON.stringify(req.query || {});
  
  // Check for dangerous patterns
  const dangerousPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>/i,
    /<object[^>]*>/i,
    /<embed[^>]*>/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(requestStr)) {
      handleValidationError(
        new AppError('Potentially dangerous content detected', 400),
        res,
        'Content security validation failed'
      );
      return;
    }
  }
  
  next();
};

/**
 * Validate request size to prevent DoS attacks
 */
export const validateRequestSize = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      handleValidationError(
        new AppError(`Request size exceeds ${maxSize / (1024 * 1024)}MB limit`, 413),
        res,
        'Request size validation failed'
      );
      return;
    }
    
    next();
  };
};

/**
 * Validate Content-Type header
 */
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      handleValidationError(
        new AppError('Content-Type header is required', 400),
        res,
        'Content-Type validation failed'
      );
      return;
    }
    
    const isAllowed = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isAllowed) {
      handleValidationError(
        new AppError(`Content-Type must be one of: ${allowedTypes.join(', ')}`, 415),
        res,
        'Content-Type validation failed'
      );
      return;
    }
    
    next();
  };
};

/**
 * Validate request origin for CSRF protection
 */
export const validateOrigin = (allowedOrigins: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || req.headers.referer;
    
    if (!origin) {
      // Allow requests without origin (e.g., mobile apps, Postman)
      return next();
    }
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      try {
        const originUrl = new URL(origin);
        const allowedUrl = new URL(allowed);
        return originUrl.hostname === allowedUrl.hostname;
      } catch {
        return false;
      }
    });
    
    if (!isAllowed) {
      handleValidationError(
        new AppError('Request origin not allowed', 403),
        res,
        'Origin validation failed'
      );
      return;
    }
    
    next();
  };
};

/**
 * Validate user agent to prevent bot attacks
 */
export const validateUserAgent = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers['user-agent'];
  
  if (!userAgent) {
    handleValidationError(
      new AppError('User-Agent header is required', 400),
      res,
      'User-Agent validation failed'
    );
    return;
  }
  
  // Block known malicious user agents
  const blockedPatterns = [
    /sqlmap/i,
    /nmap/i,
    /nikto/i,
    /masscan/i,
    /zap/i,
    /w3af/i,
  ];
  
  // Allow legitimate crawlers and tools
  const allowedBots = [
    /googlebot/i,
    /bingbot/i,
    /slackbot/i,
    /linkedinbot/i,
    /postman/i,
    /insomnia/i,
  ];
  
  const isBlocked = blockedPatterns.some(pattern => pattern.test(userAgent));
  const isAllowedBot = allowedBots.some(pattern => pattern.test(userAgent));
  
  if (isBlocked && !isAllowedBot) {
    handleValidationError(
      new AppError('User agent not allowed', 403),
      res,
      'User-Agent validation failed'
    );
    return;
  }
  
  next();
};

/**
 * Rate limiting for validation-heavy endpoints
 */
export const validationRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // Limit each IP to 200 validation requests per minute
  message: {
    success: false,
    error: 'Too many validation requests, please try again later',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return (req as any).user?.id || req.ip || 'unknown';
  },
});

/**
 * Composite validation middleware creator
 */
export const createValidationMiddleware = (config: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  sanitize?: boolean;
  allowUnknown?: boolean;
  strict?: boolean;
  fileUpload?: {
    allowedTypes: string[];
    maxSize: number;
    maxFiles?: number;
    required?: boolean;
  };
  contentType?: string[];
  maxRequestSize?: number;
  rateLimit?: boolean;
}) => {
  const middlewares: any[] = [];
  
  // Rate limiting
  if (config.rateLimit) {
    middlewares.push(validationRateLimit);
  }
  
  // Request size validation
  if (config.maxRequestSize) {
    middlewares.push(validateRequestSize(config.maxRequestSize));
  }
  
  // Content type validation
  if (config.contentType) {
    middlewares.push(validateContentType(config.contentType));
  }
  
  // Input sanitization
  if (config.sanitize) {
    middlewares.push(sanitizeInputs);
  }
  
  // CSP validation for strict mode
  if (config.strict) {
    middlewares.push(validateCSP);
  }
  
  // Schema validations
  if (config.params) {
    middlewares.push(validateParams(config.params, { sanitize: config.sanitize }));
  }
  
  if (config.query) {
    middlewares.push(validateQuery(config.query, { sanitize: config.sanitize }));
  }
  
  if (config.body) {
    middlewares.push(validateBody(config.body, {
      sanitize: config.sanitize,
      allowUnknown: config.allowUnknown,
      strict: config.strict,
    }));
  }
  
  // File upload validation
  if (config.fileUpload) {
    middlewares.push(validateFileUpload(config.fileUpload));
  }
  
  return middlewares;
};

/**
 * Password strength validation utility
 */
export function validatePasswordStrength(password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} {
  const feedback: string[] = [];
  let score = 0;
  
  // Length checks
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');
  
  if (password.length >= 12) score += 1;
  else if (password.length >= 8) feedback.push('Consider using 12+ characters for better security');
  
  // Character type checks
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');
  
  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');
  
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
  else feedback.push('Include special characters');
  
  // Pattern checks
  if (!/^(?!.*(.)\1{2,})/.test(password)) {
    score -= 1;
    feedback.push('Avoid repeating characters');
  }
  
  // Common password checks
  const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'login'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    score -= 2;
    feedback.push('Avoid common passwords and patterns');
  }
  
  const isStrong = score >= 5 && feedback.length === 0;
  
  return { score: Math.max(0, score), feedback, isStrong };
}

/**
 * Validate and sanitize HTML content
 */
export function validateHTMLContent(html: string, allowedTags: string[] = []): string {
  // Use DOMPurify with custom configuration
  const cleanHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: ['href', 'title', 'alt'],
    FORBID_SCRIPTS: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'iframe'],
  });
  
  return cleanHtml;
}

/**
 * Rate limiting key generators for different scenarios
 */
export const rateLimitKeyGenerators = {
  byUser: (req: Request) => (req as any).user?.id || req.ip || 'unknown',
  byEmail: (req: Request) => req.body?.email || req.ip || 'unknown',
  byIP: (req: Request) => req.ip || 'unknown',
  byAPIKey: (req: Request) => req.headers['x-api-key'] as string || req.ip || 'unknown',
  bySession: (req: Request) => (req as any).sessionID || req.ip || 'unknown',
};
