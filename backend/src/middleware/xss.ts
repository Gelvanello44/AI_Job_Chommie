/**
 * XSS Prevention Middleware
 * Implements comprehensive Cross-Site Scripting protection including input sanitization,
 * output encoding, and Content Security Policy headers
 */

import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { JSDOM } from 'jsdom';
import validator from 'validator';
import { logger } from '../utils/logger';

export interface XSSConfig {
  enableInputSanitization: boolean;
  enableOutputEncoding: boolean;
  enableCSP: boolean;
  sanitizationLevel: 'strict' | 'moderate' | 'permissive';
  allowedTags: string[];
  allowedAttributes: string[];
  exemptPaths: string[];
  maxInputLength: number;
  enableSQLInjectionProtection: boolean;
}

export interface SanitizedRequest extends Request {
  sanitized?: boolean;
  originalBody?: any;
  sanitizationReport?: {
    sanitized: boolean;
    fieldsModified: string[];
    threatsDetected: string[];
  };
}

class XSSProtection {
  private config: XSSConfig;
  private window: any;
  private purify: any;

  constructor(config?: Partial<XSSConfig>) {
    this.config = {
      enableInputSanitization: true,
      enableOutputEncoding: true,
      enableCSP: true,
      sanitizationLevel: 'strict',
      allowedTags: [
        'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'
      ],
      allowedAttributes: ['href', 'title', 'alt', 'class'],
      exemptPaths: [
        '/health',
        '/api-docs',
        '/api/v1/webhooks' // Webhooks need raw data
      ],
      maxInputLength: 10000,
      enableSQLInjectionProtection: true,
      ...config
    };

    // Initialize DOMPurify with JSDOM window
    this.window = new JSDOM('').window;
    this.purify = DOMPurify(this.window);
    this.configurePurify();
  }

  /**
   * Configure DOMPurify based on sanitization level
   */
  private configurePurify(): void {
    const configs = {
      strict: {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
        ALLOWED_ATTR: [],
        FORBID_ATTR: ['style', 'onclick', 'onload', 'onerror'],
        FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input'],
        SAFE_FOR_TEMPLATES: true
      },
      moderate: {
        ALLOWED_TAGS: this.config.allowedTags,
        ALLOWED_ATTR: this.config.allowedAttributes,
        FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover'],
        SAFE_FOR_TEMPLATES: true
      },
      permissive: {
        ALLOWED_TAGS: [...this.config.allowedTags, 'a', 'img', 'div', 'span'],
        ALLOWED_ATTR: [...this.config.allowedAttributes, 'src', 'target'],
        FORBID_ATTR: ['onclick', 'onload', 'onerror'],
        SAFE_FOR_TEMPLATES: true
      }
    };

    this.purify.setConfig(configs[this.config.sanitizationLevel]);
  }

  /**
   * Check if request should be exempt from XSS protection
   */
  private isExempt(req: Request): boolean {
    const requestPath = req.path;
    return this.config.exemptPaths.some(exemptPath => {
      if (exemptPath.endsWith('*')) {
        return requestPath.startsWith(exemptPath.slice(0, -1));
      }
      return requestPath === exemptPath;
    });
  }

  /**
   * Sanitize a single value
   */
  private sanitizeValue(value: any, fieldName: string): {
    sanitized: any;
    modified: boolean;
    threats: string[];
  } {
    const threats: string[] = [];
    let modified = false;

    if (typeof value !== 'string') {
      return { sanitized: value, modified: false, threats: [] };
    }

    // Check for length violations
    if (value.length > this.config.maxInputLength) {
      logger.warn('Input length exceeded', { 
        fieldName, 
        length: value.length, 
        maxLength: this.config.maxInputLength 
      });
      value = value.substring(0, this.config.maxInputLength);
      modified = true;
      threats.push('EXCESSIVE_LENGTH');
    }

    const originalValue = value;

    // Detect and prevent XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /<applet[^>]*>/gi,
      /<meta[^>]*>/gi,
      /<link[^>]*>/gi
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(value)) {
        threats.push('XSS_PATTERN_DETECTED');
        break;
      }
    }

    // SQL Injection detection
    if (this.config.enableSQLInjectionProtection) {
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
        /(;|\||&|\$|`)/g,
        /('|(\\')|('')|(%27)|(%2527))/gi,
        /("|(\\")|(")|(%22)|(%2522))/gi
      ];

      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          threats.push('SQL_INJECTION_PATTERN');
          break;
        }
      }
    }

    // Sanitize HTML content
    if (this.config.enableInputSanitization) {
      const sanitized = this.purify.sanitize(value);
      if (sanitized !== value) {
        modified = true;
        threats.push('HTML_SANITIZED');
      }
      value = sanitized;
    }

    // Escape special characters for additional safety
    value = validator.escape(value);
    if (value !== originalValue && !modified) {
      modified = true;
      threats.push('SPECIAL_CHARS_ESCAPED');
    }

    return {
      sanitized: value,
      modified,
      threats
    };
  }

  /**
   * Recursively sanitize an object
   */
  private sanitizeObject(obj: any, path: string = ''): {
    sanitized: any;
    fieldsModified: string[];
    threatsDetected: string[];
  } {
    const fieldsModified: string[] = [];
    const threatsDetected: string[] = [];

    if (obj === null || obj === undefined) {
      return { sanitized: obj, fieldsModified, threatsDetected };
    }

    if (Array.isArray(obj)) {
      const sanitizedArray = obj.map((item, index) => {
        const result = this.sanitizeObject(item, `${path}[${index}]`);
        fieldsModified.push(...result.fieldsModified);
        threatsDetected.push(...result.threatsDetected);
        return result.sanitized;
      });
      return { sanitized: sanitizedArray, fieldsModified, threatsDetected };
    }

    if (typeof obj === 'object') {
      const sanitizedObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string') {
          const result = this.sanitizeValue(value, fieldPath);
          sanitizedObj[key] = result.sanitized;
          
          if (result.modified) {
            fieldsModified.push(fieldPath);
          }
          threatsDetected.push(...result.threats);
        } else if (typeof value === 'object') {
          const result = this.sanitizeObject(value, fieldPath);
          sanitizedObj[key] = result.sanitized;
          fieldsModified.push(...result.fieldsModified);
          threatsDetected.push(...result.threatsDetected);
        } else {
          sanitizedObj[key] = value;
        }
      }
      return { sanitized: sanitizedObj, fieldsModified, threatsDetected };
    }

    // For primitive types other than string
    return { sanitized: obj, fieldsModified, threatsDetected };
  }

  /**
   * Input sanitization middleware
   */
  sanitizeInput() {
    return (req: SanitizedRequest, res: Response, next: NextFunction) => {
      try {
        // Skip exempt paths
        if (this.isExempt(req)) {
          return next();
        }

        const originalBody = { ...req.body };
        const originalQuery = { ...req.query };

        // Sanitize request body
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyResult = this.sanitizeObject(req.body);
          req.body = bodyResult.sanitized;
          req.originalBody = originalBody;

          // Log sanitization report
          if (bodyResult.fieldsModified.length > 0 || bodyResult.threatsDetected.length > 0) {
            logger.info('Input sanitization performed', {
              userId: req.user?.id,
              path: req.path,
              method: req.method,
              fieldsModified: bodyResult.fieldsModified,
              threatsDetected: bodyResult.threatsDetected
            });

            req.sanitizationReport = {
              sanitized: true,
              fieldsModified: bodyResult.fieldsModified,
              threatsDetected: bodyResult.threatsDetected
            };
          }
        }

        // Sanitize query parameters
        if (req.query && Object.keys(req.query).length > 0) {
          const queryResult = this.sanitizeObject(req.query);
          req.query = queryResult.sanitized;

          if (queryResult.fieldsModified.length > 0 || queryResult.threatsDetected.length > 0) {
            logger.info('Query parameter sanitization performed', {
              userId: req.user?.id,
              path: req.path,
              fieldsModified: queryResult.fieldsModified,
              threatsDetected: queryResult.threatsDetected
            });
          }
        }

        req.sanitized = true;
        next();
      } catch (error) {
        logger.error('Input sanitization error', {
          error: error.message,
          path: req.path,
          method: req.method,
          userId: req.user?.id
        });
        next(error);
      }
    };
  }

  /**
   * Content Security Policy headers
   */
  setCSPHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableCSP) {
        return next();
      }

      // Build CSP directive based on environment
      const isProduction = process.env.NODE_ENV === 'production';
      const apiUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

      const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for development
        `connect-src 'self' ${apiUrl} ${frontendUrl} https://api.yoco.com https://api.paystack.co`,
        "img-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
      ];

      // Stricter CSP for production
      if (isProduction) {
        cspDirectives[1] = "script-src 'self'"; // Remove unsafe-inline in production
        cspDirectives.push("require-trusted-types-for 'script'");
      }

      res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
      
      // Additional security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // HSTS for production
      if (isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }

      next();
    };
  }

  /**
   * Output encoding middleware for JSON responses
   */
  encodeOutput() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableOutputEncoding) {
        return next();
      }

      // Override res.json to sanitize output
      const originalJson = res.json;
      res.json = function(obj: any) {
        if (obj && typeof obj === 'object') {
          try {
            const sanitizedObj = sanitizeOutputObject(obj);
            return originalJson.call(this, sanitizedObj);
          } catch (error) {
            logger.error('Output encoding error', { error: error.message });
            return originalJson.call(this, obj);
          }
        }
        return originalJson.call(this, obj);
      };

      next();
    };
  }

  /**
   * Detect and block malicious patterns
   */
  detectThreats() {
    return (req: SanitizedRequest, res: Response, next: NextFunction) => {
      try {
        if (this.isExempt(req)) {
          return next();
        }

        const threats: string[] = [];
        const requestData = JSON.stringify({ body: req.body, query: req.query });

        // Check for common attack patterns
        const attackPatterns = [
          { pattern: /<script[^>]*>.*?<\/script>/gi, name: 'SCRIPT_INJECTION' },
          { pattern: /javascript:/gi, name: 'JAVASCRIPT_PROTOCOL' },
          { pattern: /vbscript:/gi, name: 'VBSCRIPT_PROTOCOL' },
          { pattern: /data:text\/html/gi, name: 'DATA_URI_HTML' },
          { pattern: /on\w+\s*=/gi, name: 'EVENT_HANDLER' },
          { pattern: /<iframe[^>]*>/gi, name: 'IFRAME_INJECTION' },
          { pattern: /expression\s*\(/gi, name: 'CSS_EXPRESSION' },
          { pattern: /url\s*\(\s*javascript:/gi, name: 'CSS_JAVASCRIPT' },
          { pattern: /&#x?\d+;/gi, name: 'HTML_ENTITY_ENCODING' },
          { pattern: /%3c|%3e|%22|%27/gi, name: 'URL_ENCODED_HTML' }
        ];

        for (const { pattern, name } of attackPatterns) {
          if (pattern.test(requestData)) {
            threats.push(name);
          }
        }

        // Check for SQL injection patterns
        if (this.config.enableSQLInjectionProtection) {
          const sqlPatterns = [
            { pattern: /(\bUNION\b.*\bSELECT\b)/gi, name: 'SQL_UNION_INJECTION' },
            { pattern: /(\bSELECT\b.*\bFROM\b.*\bWHERE\b)/gi, name: 'SQL_SELECT_INJECTION' },
            { pattern: /(\bDROP\b.*\bTABLE\b)/gi, name: 'SQL_DROP_INJECTION' },
            { pattern: /(\bEXEC\b|\bEXECUTE\b)/gi, name: 'SQL_EXEC_INJECTION' },
            { pattern: /(;.*--|\/\*.*\*\/)/gi, name: 'SQL_COMMENT_INJECTION' }
          ];

          for (const { pattern, name } of sqlPatterns) {
            if (pattern.test(requestData)) {
              threats.push(name);
            }
          }
        }

        // Log detected threats
        if (threats.length > 0) {
          logger.warn('Security threats detected', {
            userId: req.user?.id,
            path: req.path,
            method: req.method,
            threats,
            userAgent: req.headers['user-agent'],
            ip: req.ip
          });

          // Add to sanitization report
          if (req.sanitizationReport) {
            req.sanitizationReport.threatsDetected.push(...threats);
          } else {
            req.sanitizationReport = {
              sanitized: false,
              fieldsModified: [],
              threatsDetected: threats
            };
          }

          // Block request if critical threats detected
          const criticalThreats = ['SCRIPT_INJECTION', 'SQL_UNION_INJECTION', 'SQL_DROP_INJECTION'];
          const hasCriticalThreat = threats.some(threat => criticalThreats.includes(threat));

          if (hasCriticalThreat) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'SECURITY_THREAT_DETECTED',
                message: 'Request blocked due to security concerns',
                details: {
                  threats: threats.filter(t => criticalThreats.includes(t))
                }
              }
            });
          }
        }

        next();
      } catch (error) {
        logger.error('Threat detection error', { error: error.message });
        next(error);
      }
    };
  }

  /**
   * File upload security validation
   */
  validateFileUploads() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.files && !req.file) {
          return next();
        }

        const files = req.files || (req.file ? [req.file] : []);
        const fileArray = Array.isArray(files) ? files : Object.values(files).flat();

        for (const file of fileArray) {
          // Check file type
          const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/gif'
          ];

          if (!allowedMimeTypes.includes(file.mimetype)) {
            logger.warn('Suspicious file upload attempt', {
              userId: req.user?.id,
              filename: file.originalname,
              mimetype: file.mimetype,
              size: file.size
            });

            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_FILE_TYPE',
                message: 'File type not allowed',
                details: { allowedTypes: allowedMimeTypes }
              }
            });
          }

          // Check file size (10MB limit)
          if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'FILE_TOO_LARGE',
                message: 'File size exceeds 10MB limit'
              }
            });
          }

          // Check filename for malicious patterns
          const filename = file.originalname || '';
          const suspiciousPatterns = [
            /\.\./g, // Directory traversal
            /[<>:"|?*]/g, // Invalid filename characters
            /\.(exe|bat|cmd|scr|vbs|js|jar)$/gi // Executable extensions
          ];

          for (const pattern of suspiciousPatterns) {
            if (pattern.test(filename)) {
              logger.warn('Suspicious filename detected', {
                userId: req.user?.id,
                filename,
                pattern: pattern.toString()
              });

              return res.status(400).json({
                success: false,
                error: {
                  code: 'SUSPICIOUS_FILENAME',
                  message: 'Filename contains invalid characters'
                }
              });
            }
          }
        }

        next();
      } catch (error) {
        logger.error('File upload validation error', { error: error.message });
        next(error);
      }
    };
  }

  /**
   * Health check for XSS protection system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      purifyConfigured: boolean;
      cspEnabled: boolean;
      sanitizationEnabled: boolean;
    };
    issues: string[];
  }> {
    try {
      const issues: string[] = [];
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      // Check DOMPurify configuration
      const purifyConfigured = !!this.purify && typeof this.purify.sanitize === 'function';
      if (!purifyConfigured) {
        issues.push('DOMPurify not properly configured');
        status = 'unhealthy';
      }

      // Test sanitization functionality
      try {
        const testInput = '<script>alert("xss")</script>Hello';
        const sanitized = this.purify.sanitize(testInput);
        if (sanitized.includes('<script>')) {
          issues.push('Sanitization not working correctly');
          status = 'unhealthy';
        }
      } catch (error) {
        issues.push('Sanitization test failed');
        status = 'degraded';
      }

      return {
        status,
        metrics: {
          purifyConfigured,
          cspEnabled: this.config.enableCSP,
          sanitizationEnabled: this.config.enableInputSanitization
        },
        issues
      };
    } catch (error) {
      logger.error('XSS health check error', { error: error.message });
      return {
        status: 'unhealthy',
        metrics: {
          purifyConfigured: false,
          cspEnabled: false,
          sanitizationEnabled: false
        },
        issues: ['Health check failed']
      };
    }
  }
}

/**
 * Sanitize output object for JSON responses
 */
function sanitizeOutputObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Encode HTML entities in output
    return validator.escape(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeOutputObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive fields that shouldn't be modified
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'hash'];
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeOutputObject(value);
      }
    }
    return sanitized;
  }

  return obj;
}

// Create and export XSS protection instance
export const xssProtection = new XSSProtection({
  sanitizationLevel: 'strict',
  enableInputSanitization: true,
  enableOutputEncoding: true,
  enableCSP: true,
  enableSQLInjectionProtection: true,
  maxInputLength: 10000
});

// Export middleware functions
export const sanitizeInput = xssProtection.sanitizeInput();
export const setCSPHeaders = xssProtection.setCSPHeaders();
export const encodeOutput = xssProtection.encodeOutput();
export const detectThreats = xssProtection.detectThreats();
export const validateFileUploads = xssProtection.validateFileUploads();

// Export combined middleware for different security levels
export const basicXSSProtection = [setCSPHeaders, sanitizeInput, detectThreats];
export const strictXSSProtection = [setCSPHeaders, sanitizeInput, detectThreats, encodeOutput];
export const fileUploadXSSProtection = [sanitizeInput, detectThreats, validateFileUploads];

// Export health check
export const xssHealthCheck = () => xssProtection.healthCheck();
