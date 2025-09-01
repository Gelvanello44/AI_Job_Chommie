export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Create a 400 Bad Request error
   */
  static badRequest(message: string = 'Bad Request'): AppError {
    return new AppError(message, 400);
  }

  /**
   * Create a 401 Unauthorized error
   */
  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(message, 401);
  }

  /**
   * Create a 403 Forbidden error
   */
  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(message, 403);
  }

  /**
   * Create a 404 Not Found error
   */
  static notFound(message: string = 'Not Found'): AppError {
    return new AppError(message, 404);
  }

  /**
   * Create a 409 Conflict error
   */
  static conflict(message: string = 'Conflict'): AppError {
    return new AppError(message, 409);
  }

  /**
   * Create a 422 Unprocessable Entity error
   */
  static unprocessableEntity(message: string = 'Unprocessable Entity'): AppError {
    return new AppError(message, 422);
  }

  /**
   * Create a 429 Too Many Requests error
   */
  static tooManyRequests(message: string = 'Too Many Requests'): AppError {
    return new AppError(message, 429);
  }

  /**
   * Create a 500 Internal Server Error
   */
  static internal(message: string = 'Internal Server Error'): AppError {
    return new AppError(message, 500);
  }

  /**
   * Create a 503 Service Unavailable error
   */
  static serviceUnavailable(message: string = 'Service Unavailable'): AppError {
    return new AppError(message, 503);
  }
}

export default AppError;
