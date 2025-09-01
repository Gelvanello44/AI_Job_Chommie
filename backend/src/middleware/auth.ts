import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../utils/jwt.js';
import { prisma } from '../config/database.js';
import { UserRole } from '@prisma/client';
import { config } from '../config/index.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & { 
        id: string; 
        isAdmin?: boolean;
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        role?: UserRole;
      };
    }
  }
}

/**
 * Authenticate JWT token
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }
    
    // Verify token
    const payload = verifyAccessToken(token);
    
    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { 
        id: true, 
        email: true, 
        role: true, 
        firstName: true, 
        lastName: true, 
        phone: true 
      },
    });
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
      });
      return;
    }
    
    // Attach user to request
    req.user = {
      ...payload,
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    };
    
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Access token expired') {
        res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
        });
        return;
      }
      
      res.status(401).json({
        success: false,
        error: error.message || 'Invalid token',
      });
      return;
    }
    
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    if (token) {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, role: true },
      });
      
      if (user) {
        req.user = {
          ...payload,
          id: user.id,
        };
      }
    }
  } catch (error) {
    // Ignore errors for optional auth
  }
  
  next();
}

/**
 * Authorize specific roles
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }
    
    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }
    
    next();
  };
}

/**
 * Verify API key for admin endpoints
 */
export function verifyApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey || apiKey !== config.ADMIN_API_KEY) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }
  
  next();
}

/**
 * Check if user owns the resource
 */
export function ownsResource(resourceUserIdField: string = 'userId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }
    
    // Admin can access any resource
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }
    
    // Check ownership
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (resourceUserId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }
    
    next();
  };
}

// Export auth as alias for authenticate for backward compatibility
export const auth = authenticate;

/**
 * Admin authentication middleware
 */
export async function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // First authenticate the user
    await authenticate(req, res, () => {});
    
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }
    
    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });
    
    if (!user || user.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        error: 'Admin privileges required',
        code: 'ADMIN_REQUIRED'
      });
      return;
    }
    
    // Add admin flag to user object
    req.user.isAdmin = true;
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Verify email is confirmed
 */
export async function requireEmailVerified(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { emailVerified: true },
  });
  
  if (!user?.emailVerified) {
    res.status(403).json({
      success: false,
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
    });
    return;
  }
  
  next();
}

/**
 * Check subscription limits
 */
export async function checkSubscriptionLimit(_resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { 
        subscriptionPlan: true,
        creditsRemaining: true,
      },
    });
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }
    
    // Check subscription features (implement based on resource type)
    // This is a placeholder - implement actual limit checking
    
    next();
  };
}
