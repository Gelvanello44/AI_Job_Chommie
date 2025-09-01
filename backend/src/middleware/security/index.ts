export * from './rateLimiter';
export * from './cors';
export * from './headers';
export * from './inputSanitization';

import { Application } from 'express';
import { corsMiddleware, corsSecurityHeaders } from './cors';
import { securityHeaders, customSecurityHeaders, removeSensitiveHeaders } from './headers';
import { sanitizeInput, preventSQLInjection, xssProtection } from './inputSanitization';
import { apiLimiter } from './rateLimiter';

export const applySecurityMiddleware = (app: Application) => {
  // Apply CORS
  app.use(corsMiddleware);
  app.use(corsSecurityHeaders);
  
  // Apply security headers
  app.use(securityHeaders);
  app.use(customSecurityHeaders);
  app.use(removeSensitiveHeaders);
  
  // Apply input sanitization
  app.use(sanitizeInput);
  app.use(preventSQLInjection);
  app.use(xssProtection);
  
  // Apply rate limiting
  app.use('/api/', apiLimiter);
  
  console.log(' Security middleware applied');
};
