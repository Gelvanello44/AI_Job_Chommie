import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { validationResult } from 'express-validator';
import { securityConfig } from '../config/security.config.js';
import { logger } from '../utils/logger.js';
import validator from 'validator';

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Deep sanitize an object recursively
 */
export function deepSanitize(obj: any, depth: number = 0): any {
  // Prevent deep recursion
  if (depth > securityConfig.validation.maxObjectDepth) {
    throw new Error('Object depth exceeds maximum allowed depth');
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length > securityConfig.validation.maxArrayLength) {
      throw new Error('Array length exceeds maximum allowed length');
    }
    return obj.map(item => deepSanitize(item, depth + 1));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const sanitizedKey = sanitizeString(key);
      
      // Skip dangerous keys
      if (isDangerousKey(sanitizedKey)) {
        logger.warn('Dangerous key detected and removed', { key: sanitizedKey });
        continue;
      }

      // Recursively sanitize value
      sanitized[sanitizedKey] = deepSanitize(value, depth + 1);
    }
    return sanitized;
  }

  // Handle strings
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  // Return other types as-is
  return obj;
}

/**
 * Sanitize a string value
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  // Check string length
  if (str.length > securityConfig.validation.maxStringLength) {
    throw new Error('String length exceeds maximum allowed length');
  }

  // Remove null bytes
  str = str.replace(/\0/g, '');

  // Escape HTML entities
  str = validator.escape(str);

  // Remove dangerous patterns
  str = removeDangerousPatterns(str);

  // Trim whitespace
  str = str.trim();

  return str;
}

/**
 * Remove dangerous patterns from strings
 */
function removeDangerousPatterns(str: string): string {
  // Remove script tags
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove on* event handlers
  str = str.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: protocol
  str = str.replace(/javascript:/gi, '');
  
  // Remove data: protocol (except images)
  str = str.replace(/data:(?!image\/)/gi, '');
  
  // Remove vbscript: protocol
  str = str.replace(/vbscript:/gi, '');
  
  // Remove SQL injection patterns
  str = str.replace(/(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|SELECT|UNION|UPDATE)\b)/gi, '');
  
  // Remove NoSQL injection patterns
  str = str.replace(/(\$\w+:|\.prototype\.|__proto__|constructor\[)/gi, '');

  return str;
}

/**
 * Check if a key is potentially dangerous
 */
function isDangerousKey(key: string): boolean {
  const dangerousKeys = [
    '__proto__',
    'constructor',
    'prototype',
    '$where',
    '$regex',
    '$ne',
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$in',
    '$nin',
    '$or',
    '$and',
    '$not',
    '$nor',
  ];

  return dangerousKeys.some(dangerous => 
    key.toLowerCase().includes(dangerous.toLowerCase())
  );
}

/**
 * Middleware to sanitize all request inputs
 */
export function sanitizeInputs(req: Request, res: Response, next: NextFunction) {
  try {
    // Sanitize body
    if (req.body) {
      req.body = deepSanitize(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = deepSanitize(req.query);
    }

    // Sanitize params
    if (req.params) {
      req.params = deepSanitize(req.params);
    }

    next();
  } catch (error: any) {
    logger.warn('Input sanitization failed', { 
      error: error.message,
      path: req.path,
      method: req.method,
    });
    
    return res.status(400).json({
      success: false,
      error: 'Invalid input data: ' + error.message,
    });
  }
}

/**
 * Validate file uploads
 */
export function validateFileUpload(req: Request, res: Response, next: NextFunction) {
  if (!req.file && !req.files) {
    return next();
  }

  const files = req.file ? [req.file] : Object.values(req.files || {}).flat();

  for (const file of files) {
    // Check file size
    if (file.size > securityConfig.validation.maxFileSize) {
      return res.status(400).json({
        success: false,
        error: `File ${file.originalname} exceeds maximum size of ${securityConfig.validation.maxFileSize / (1024 * 1024)}MB`,
      });
    }

    // Check file type
    if (!securityConfig.validation.allowedFileTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: `File type ${file.mimetype} is not allowed`,
      });
    }

    // Sanitize filename
    file.originalname = sanitizeFilename(file.originalname);
  }

  next();
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  filename = filename.replace(/^.*[\\\/]/, '');
  
  // Remove special characters except dots, dashes, and underscores
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Limit length
  if (filename.length > 255) {
    const ext = filename.split('.').pop();
    filename = filename.substring(0, 250) + '.' + ext;
  }

  return filename;
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
  email = email.toLowerCase().trim();
  
  if (!validator.isEmail(email)) {
    throw new Error('Invalid email format');
  }
  
  return validator.normalizeEmail(email) || email;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeURL(url: string): string {
  if (!validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
  })) {
    throw new Error('Invalid URL format');
  }
  
  return url;
}

/**
 * Validate and sanitize phone number
 */
export function sanitizePhone(phone: string): string {
  // Remove all non-digit characters
  phone = phone.replace(/\D/g, '');
  
  if (!validator.isMobilePhone(phone, 'any')) {
    throw new Error('Invalid phone number');
  }
  
  return phone;
}

/**
 * Password validation
 */
export function validatePassword(password: string): boolean {
  const policy = securityConfig.passwordPolicy;
  
  if (password.length < policy.minLength || password.length > policy.maxLength) {
    throw new Error(`Password must be between ${policy.minLength} and ${policy.maxLength} characters`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter');
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    throw new Error('Password must contain at least one number');
  }

  if (policy.requireSpecialChars && !new RegExp(`[${policy.specialChars}]`).test(password)) {
    throw new Error('Password must contain at least one special character');
  }

  return true;
}

/**
 * Check for common passwords
 */
export function checkCommonPasswords(password: string): boolean {
  const commonPasswords = [
    'password', '123456', '12345678', 'qwerty', 'abc123',
    'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
    'baseball', '111111', 'iloveyou', 'master', 'sunshine',
    'ashley', 'bailey', 'passw0rd', 'shadow', '123123',
    'password1', 'password123', 'admin', 'welcome', 'Password1',
  ];

  return !commonPasswords.some(common => 
    password.toLowerCase().includes(common.toLowerCase())
  );
}

/**
 * SQL injection prevention
 */
export function preventSQLInjection(value: string): string {
  // Escape single quotes
  value = value.replace(/'/g, "''");
  
  // Remove SQL keywords
  const sqlKeywords = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE',
    'ALTER', 'UNION', 'FROM', 'WHERE', 'JOIN', 'EXEC', 'SCRIPT',
  ];
  
  sqlKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    value = value.replace(regex, '');
  });

  return value;
}

/**
 * NoSQL injection prevention
 */
export function preventNoSQLInjection(obj: any): any {
  if (typeof obj === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => preventNoSQLInjection(item));
  }

  if (typeof obj === 'object' && obj !== null) {
    const clean: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip keys that start with $
      if (key.startsWith('$')) {
        logger.warn('NoSQL injection attempt detected', { key });
        continue;
      }
      clean[key] = preventNoSQLInjection(value);
    }
    return clean;
  }

  return obj;
}

/**
 * CSRF token validation
 */
export function validateCSRFToken(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = (req.session as any)?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
    });
  }

  next();
}

/**
 * Content type validation
 */
export function validateContentType(expectedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !expectedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({
        success: false,
        error: 'Unsupported content type',
      });
    }

    next();
  };
}

/**
 * Express validator error handler
 */
export function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation errors', { 
      errors: errors.array(),
      path: req.path,
      method: req.method,
    });
    
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }

  next();
}
