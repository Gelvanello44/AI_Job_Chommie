import winston from 'winston';
import path from 'path';
import { config } from './index.js';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

/**
 * Custom log format for console
 */
const consoleFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  return log;
});

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'ai-job-chommie' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.NODE_ENV === 'development' 
        ? combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat)
        : json(),
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(config.LOG_FILE_PATH.replace('app.log', 'error.log')),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: config.LOG_FILE_PATH,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(config.LOG_FILE_PATH.replace('app.log', 'exceptions.log')),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(config.LOG_FILE_PATH.replace('app.log', 'rejections.log')),
    }),
  ],
});

/**
 * Stream for Morgan HTTP logger
 */
export const httpLogStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

/**
 * Request logger middleware
 */
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
    });
  });
  
  next();
};

/**
 * Error logger middleware
 */
export const errorLogger = (err: any, req: any, _res: any, next: any) => {
  logger.error('Application Error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id,
  });
  
  next(err);
};

/**
 * Audit logger for sensitive operations
 */
export const auditLogger = {
  log: (action: string, userId: string, metadata?: any) => {
    logger.info('Audit Log', {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },
};

/**
 * Performance logger
 */
export const performanceLogger = {
  start: (operation: string) => {
    const startTime = process.hrtime.bigint();
    
    return {
      end: (metadata?: any) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        logger.info('Performance Log', {
          operation,
          duration: `${duration}ms`,
          ...metadata,
        });
      },
    };
  },
};

export default logger;
