import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import logger from '../config/logger.js';
import { config } from '../config/index.js';

/**
 * Custom error class
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found error handler
 */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  const error = new AppError(404, `Route ${req.originalUrl} not found`);
  next(error);
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  // Handle specific error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || code;
    details = err.details;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400;
    
    switch (err.code) {
      case 'P2002':
        message = 'A record with this value already exists';
        code = 'DUPLICATE_ENTRY';
        details = {
          field: err.meta?.target,
        };
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        code = 'NOT_FOUND';
        break;
      case 'P2003':
        message = 'Invalid reference';
        code = 'INVALID_REFERENCE';
        break;
      case 'P2014':
        message = 'Invalid ID provided';
        code = 'INVALID_ID';
        break;
      default:
        message = 'Database operation failed';
        code = 'DATABASE_ERROR';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data type';
    code = 'CAST_ERROR';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (err.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    code = 'SERVICE_UNAVAILABLE';
  }

  // Send error response
  const response: any = {
    success: false,
    error: message,
    code,
  };

  // Include error details in development
  if (config.NODE_ENV === 'development') {
    response.details = details || err.message;
    response.stack = err.stack;
  } else if (details) {
    response.details = details;
  }

  res.status(statusCode).json(response);
}

/**
 * Async error wrapper
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Database connection error handler
 */
export function handleDatabaseError(error: any): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return new AppError(409, 'Duplicate entry', 'DUPLICATE_ENTRY', {
          field: error.meta?.target,
        });
      case 'P2025':
        return new AppError(404, 'Record not found', 'NOT_FOUND');
      default:
        return new AppError(400, 'Database operation failed', 'DATABASE_ERROR');
    }
  }
  
  return new AppError(500, 'Database error occurred', 'DATABASE_ERROR');
}

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  
  // Gracefully shutdown
  process.exit(1);
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection', {
    reason,
    promise,
  });
  
  // Gracefully shutdown
  process.exit(1);
});
