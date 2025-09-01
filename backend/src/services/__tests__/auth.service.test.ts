import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthService } from '../auth.service';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis.config';
import { emailService } from '../email.service';
import { AppError } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

jest.mock('../../config/redis.config', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn()
  }
}));

jest.mock('../email.service', () => ({
  emailService: {
    sendWelcomeEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendEmailVerification: jest.fn()
  }
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
    
    // Set up default environment variables
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    const mockUserData = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'JOB_SEEKER' as const
    };

    it('should register a new user successfully', async () => {
      const hashedPassword = 'hashed-password';
      const mockUser = {
        id: 'user-123',
        ...mockUserData,
        password: hashedPassword,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      const result = await authService.register(mockUserData);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockUserData.email }
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(mockUserData.password, 12);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(mockUser);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw error if user already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-user' });

      await expect(authService.register(mockUserData)).rejects.toThrow(AppError);
      await expect(authService.register(mockUserData)).rejects.toThrow('User already exists');
    });

    it('should validate password strength', async () => {
      const weakPassword = {
        ...mockUserData,
        password: '123'
      };

      await expect(authService.register(weakPassword)).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should validate email format', async () => {
      const invalidEmail = {
        ...mockUserData,
        email: 'invalid-email'
      };

      await expect(authService.register(invalidEmail)).rejects.toThrow('Invalid email format');
    });
  });

  describe('login', () => {
    const mockCredentials = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    const mockUser = {
      id: 'user-123',
      email: mockCredentials.email,
      password: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe',
      role: 'JOB_SEEKER',
      emailVerified: true,
      twoFactorEnabled: false,
      lastLoginAt: null
    };

    it('should login user successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-token');
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date()
      });

      const result = await authService.login(mockCredentials.email, mockCredentials.password);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockCredentials.email }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(mockCredentials.password, mockUser.password);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw error for invalid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.login(mockCredentials.email, mockCredentials.password))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error for incorrect password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(mockCredentials.email, mockCredentials.password))
        .rejects.toThrow('Invalid credentials');
    });

    it('should handle two-factor authentication', async () => {
      const userWith2FA = { ...mockUser, twoFactorEnabled: true };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(userWith2FA);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(mockCredentials.email, mockCredentials.password);

      expect(result).toHaveProperty('requiresTwoFactor', true);
      expect(result).not.toHaveProperty('accessToken');
    });

    it('should warn about unverified email', async () => {
      const unverifiedUser = { ...mockUser, emailVerified: false };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(unverifiedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      const result = await authService.login(mockCredentials.email, mockCredentials.password);

      expect(result).toHaveProperty('warning', 'Please verify your email address');
    });
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'valid-refresh-token';
    const mockDecodedToken = {
      userId: 'user-123',
      type: 'refresh',
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600
    };

    it('should refresh tokens successfully', async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-123',
        token: mockRefreshToken,
        userId: mockDecodedToken.userId,
        expiresAt: new Date(Date.now() + 3600000)
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockDecodedToken.userId,
        email: 'test@example.com',
        role: 'JOB_SEEKER'
      });
      (jwt.sign as jest.Mock).mockReturnValue('new-token');

      const result = await authService.refreshToken(mockRefreshToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockRefreshToken, process.env.JWT_REFRESH_SECRET);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw error for invalid refresh token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken(mockRefreshToken))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for expired refresh token', async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-123',
        token: mockRefreshToken,
        userId: mockDecodedToken.userId,
        expiresAt: new Date(Date.now() - 3600000) // Expired
      });

      await expect(authService.refreshToken(mockRefreshToken))
        .rejects.toThrow('Refresh token expired');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const userId = 'user-123';
      const refreshToken = 'refresh-token';

      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (redis.del as jest.Mock).mockResolvedValue(1);

      await authService.logout(userId, refreshToken);

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { token: refreshToken }
      });
      expect(redis.del).toHaveBeenCalledWith(`user:${userId}:session`);
    });

    it('should handle logout without refresh token', async () => {
      const userId = 'user-123';

      (redis.del as jest.Mock).mockResolvedValue(1);

      await authService.logout(userId);

      expect(prisma.refreshToken.delete).not.toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith(`user:${userId}:session`);
    });
  });

  describe('forgotPassword', () => {
    const mockEmail = 'test@example.com';
    const mockUser = {
      id: 'user-123',
      email: mockEmail,
      firstName: 'John',
      lastName: 'Doe'
    };

    it('should send password reset email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue('reset-token');
      (redis.setex as jest.Mock).mockResolvedValue('OK');

      await authService.forgotPassword(mockEmail);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockEmail }
      });
      expect(redis.setex).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should not reveal if user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.forgotPassword(mockEmail)).resolves.not.toThrow();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should rate limit password reset requests', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (redis.exists as jest.Mock).mockResolvedValue(1);

      await expect(authService.forgotPassword(mockEmail))
        .rejects.toThrow('Password reset already requested');
    });
  });

  describe('resetPassword', () => {
    const mockToken = 'reset-token';
    const newPassword = 'NewPassword123!';
    const mockUserId = 'user-123';

    it('should reset password successfully', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ userId: mockUserId });
      (redis.get as jest.Mock).mockResolvedValue(mockUserId);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: mockUserId,
        email: 'test@example.com'
      });

      await authService.resetPassword(mockToken, newPassword);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, process.env.JWT_ACCESS_SECRET);
      expect(redis.get).toHaveBeenCalledWith(`password-reset:${mockUserId}`);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith(`password-reset:${mockUserId}`);
    });

    it('should throw error for invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.resetPassword(mockToken, newPassword))
        .rejects.toThrow('Invalid or expired reset token');
    });

    it('should validate new password strength', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ userId: mockUserId });
      (redis.get as jest.Mock).mockResolvedValue(mockUserId);

      await expect(authService.resetPassword(mockToken, '123'))
        .rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('verifyEmail', () => {
    const mockToken = 'verification-token';
    const mockUserId = 'user-123';

    it('should verify email successfully', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ userId: mockUserId });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: mockUserId,
        email: 'test@example.com',
        emailVerified: true
      });

      const result = await authService.verifyEmail(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, process.env.JWT_ACCESS_SECRET);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { emailVerified: true }
      });
      expect(result).toHaveProperty('emailVerified', true);
    });

    it('should throw error for invalid verification token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.verifyEmail(mockToken))
        .rejects.toThrow('Invalid verification token');
    });
  });

  describe('changePassword', () => {
    const mockUserId = 'user-123';
    const currentPassword = 'CurrentPassword123!';
    const newPassword = 'NewPassword123!';

    it('should change password successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockUserId,
        password: 'current-hashed-password'
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: mockUserId,
        email: 'test@example.com'
      });

      await authService.changePassword(mockUserId, currentPassword, newPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, 'current-hashed-password');
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
    });

    it('should throw error for incorrect current password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockUserId,
        password: 'current-hashed-password'
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.changePassword(mockUserId, currentPassword, newPassword))
        .rejects.toThrow('Current password is incorrect');
    });

    it('should prevent using same password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockUserId,
        password: 'current-hashed-password'
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(authService.changePassword(mockUserId, currentPassword, currentPassword))
        .rejects.toThrow('New password must be different from current password');
    });
  });

  describe('validateToken', () => {
    const mockToken = 'valid-token';
    const mockDecodedToken = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'JOB_SEEKER',
      type: 'access'
    };

    it('should validate token successfully', async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);

      const result = await authService.validateToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, process.env.JWT_ACCESS_SECRET);
      expect(result).toEqual(mockDecodedToken);
    });

    it('should throw error for invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.validateToken(mockToken))
        .rejects.toThrow('Invalid token');
    });

    it('should throw error for refresh token', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({
        ...mockDecodedToken,
        type: 'refresh'
      });

      await expect(authService.validateToken(mockToken))
        .rejects.toThrow('Invalid token type');
    });
  });

  describe('getUserById', () => {
    const mockUserId = 'user-123';

    it('should get user by ID', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'JOB_SEEKER'
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.getUserById(mockUserId);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        select: expect.objectContaining({
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true
        })
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await authService.getUserById(mockUserId);

      expect(result).toBeNull();
    });
  });
});
