import { RateLimitRequestHandler } from 'express-rate-limit';

/**
 * Security configuration for the application
 */
export const securityConfig = {
  // Rate limiting configurations
  rateLimit: {
    // Global rate limit
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      skipSuccessfulRequests: false,
      keyGenerator: (req: any) => {
        // Use X-Forwarded-For if behind proxy, otherwise use IP
        return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
      },
    },
    
    // Authentication endpoints (stricter)
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 requests per window
      message: 'Too many authentication attempts, please try again later.',
      skipFailedRequests: false,
    },
    
    // Registration endpoint
    registration: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 registrations per hour per IP
      message: 'Registration limit exceeded, please try again later.',
    },
    
    // Password reset
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 reset requests per hour
      message: 'Too many password reset requests, please try again later.',
    },
    
    // API endpoints (general)
    api: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60, // 60 requests per minute
      message: 'API rate limit exceeded, please slow down your requests.',
    },
    
    // File upload endpoints
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 uploads per hour
      message: 'Upload limit exceeded, please try again later.',
    },
    
    // Search endpoints
    search: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // 30 searches per minute
      message: 'Search rate limit exceeded, please try again later.',
    },
    
    // AI/ML endpoints (expensive operations)
    ai: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // 20 AI requests per hour
      message: 'AI service rate limit exceeded, please try again later.',
    },
  },
  
  // Helmet configuration
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        connectSrc: ["'self'", 'https://api.huggingface.co', 'wss:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        workerSrc: ["'self'", 'blob:'],
        childSrc: ["'self'", 'blob:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    
    // Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    
    // Other security headers
    frameguard: { action: 'deny' },
    xssFilter: true,
    noSniff: true,
    ieNoOpen: true,
    dnsPrefetchControl: { allow: false },
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    
    // Hide X-Powered-By header
    hidePoweredBy: true,
    
    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Set to false for compatibility
    
    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: { policy: 'same-origin' },
  },
  
  // CORS configuration
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://ai-job-chommie.com',
      ];
      
      // Allow requests with no origin (mobile apps, postman, etc)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-API-Key',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Total-Count',
    ],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 204,
  },
  
  // Input validation rules
  validation: {
    maxFieldSize: 1024 * 1024, // 1MB for text fields
    maxFileSize: 10 * 1024 * 1024, // 10MB for file uploads
    allowedFileTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
    maxStringLength: 10000,
    maxArrayLength: 100,
    maxObjectDepth: 5,
  },
  
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'your-session-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict',
    },
  },
  
  // Password policy
  passwordPolicy: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    preventCommon: true, // Check against common passwords
    preventUserInfo: true, // Prevent using user info in password
  },
  
  // API Key configuration
  apiKey: {
    headerName: 'X-API-Key',
    queryParam: 'apikey',
    maxKeys: 5, // Max API keys per user
    keyLength: 32,
    expirationDays: 90,
  },
  
  // Security monitoring
  monitoring: {
    logSuspiciousActivity: true,
    alertThreshold: 10, // Alert after 10 suspicious activities
    blockAfterFailures: 5, // Block IP after 5 failed attempts
    blockDuration: 60 * 60 * 1000, // 1 hour block
    trackingWindow: 15 * 60 * 1000, // 15 minutes tracking window
  },
};
