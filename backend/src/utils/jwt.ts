import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { User } from '@prisma/client';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET as string, {
    expiresIn: config.JWT_ACCESS_EXPIRY as string,
    issuer: 'ai-job-chommie',
    audience: 'ai-job-chommie-users',
  } as jwt.SignOptions);
}

/**
 * Generate JWT refresh token and store in database
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date();
  
  // Parse refresh expiry (e.g., "7d" -> 7 days)
  const expiryMatch = config.JWT_REFRESH_EXPIRY.match(/(\d+)([dhm])/);
  if (expiryMatch) {
    const [, value, unit] = expiryMatch;
    const numValue = parseInt(value);
    
    switch (unit) {
      case 'd':
        expiresAt.setDate(expiresAt.getDate() + numValue);
        break;
      case 'h':
        expiresAt.setHours(expiresAt.getHours() + numValue);
        break;
      case 'm':
        expiresAt.setMinutes(expiresAt.getMinutes() + numValue);
        break;
    }
  }
  
  // Store refresh token in database
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });
  
  return token;
}

/**
 * Generate both access and refresh tokens
 */
export async function generateTokenPair(user: Pick<User, 'id' | 'email' | 'role'>): Promise<TokenPair> {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  
  const accessToken = generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(user.id);
  
  return { accessToken, refreshToken };
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET, {
      issuer: 'ai-job-chommie',
      audience: 'ai-job-chommie-users',
    }) as JWTPayload;
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw error;
  }
}

/**
 * Verify refresh token and return user
 */
export async function verifyRefreshToken(token: string): Promise<User | null> {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });
  
  if (!refreshToken) {
    return null;
  }
  
  // Check if token is expired
  if (refreshToken.expiresAt < new Date()) {
    // Delete expired token
    await prisma.refreshToken.delete({
      where: { id: refreshToken.id },
    });
    return null;
  }
  
  return refreshToken.user;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
  const user = await verifyRefreshToken(refreshToken);
  
  if (!user) {
    return null;
  }
  
  // Delete old refresh token
  await prisma.refreshToken.delete({
    where: { token: refreshToken },
  });
  
  // Generate new token pair
  return generateTokenPair(user);
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.delete({
    where: { token },
  }).catch(() => {
    // Ignore if token doesn't exist
  });
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}

/**
 * Clean up expired refresh tokens (to be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  
  return result.count;
}
