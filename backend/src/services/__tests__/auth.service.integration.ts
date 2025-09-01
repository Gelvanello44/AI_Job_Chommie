import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { authService } from '../auth.service.js';
import { prisma } from '../../config/database.js';
import { cleanupTestData, createTestUser } from '../../tests/helpers/testHelpers.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

describe('AuthService Integration Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@test.com',
        password: 'SecurePassword123!',
        firstName: 'New',
        lastName: 'User',
        role: UserRole.JOB_SEEKER,
      };

      const result = await authService.register(userData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(userData.email);
      expect(result.user.firstName).toBe(userData.firstName);
      expect(result.user.lastName).toBe(userData.lastName);

      // Verify user was created in database
      const dbUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(dbUser).toBeTruthy();
      expect(dbUser?.email).toBe(userData.email);
      
      // Verify password was hashed
      const isPasswordValid = await bcrypt.compare(userData.password, dbUser!.password);
      expect(isPasswordValid).toBe(true);
    });

    it('should not register a user with duplicate email', async () => {
      // Create first user
      await createTestUser({ email: 'duplicate@test.com' });

      // Try to register with same email
      const userData = {
        email: 'duplicate@test.com',
        password: 'Password123!',
        firstName: 'Duplicate',
        lastName: 'User',
        role: UserRole.JOB_SEEKER,
      };

      await expect(authService.register(userData)).rejects.toThrow();
    });

    it('should create user profile for job seeker', async () => {
      const userData = {
        email: 'jobseeker@test.com',
        password: 'Password123!',
        firstName: 'Job',
        lastName: 'Seeker',
        role: UserRole.JOB_SEEKER,
      };

      const result = await authService.register(userData);

      // Check if profile was created
      const profile = await prisma.userProfile.findUnique({
        where: { userId: result.user.id },
      });

      expect(profile).toBeTruthy();
      expect(profile?.userId).toBe(result.user.id);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const password = 'TestPassword123!';
      const user = await createTestUser({
        email: 'login@test.com',
        password,
        isEmailVerified: true,
      });

      const result = await authService.login('login@test.com', password);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe(user.id);
      expect(result.user.email).toBe(user.email);

      // Verify refresh token was stored
      const refreshToken = await prisma.refreshToken.findFirst({
        where: { userId: user.id },
      });
      expect(refreshToken).toBeTruthy();
    });

    it('should not login with invalid password', async () => {
      await createTestUser({
        email: 'invalid@test.com',
        password: 'CorrectPassword123!',
      });

      await expect(
        authService.login('invalid@test.com', 'WrongPassword123!')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should not login with non-existent email', async () => {
      await expect(
        authService.login('nonexistent@test.com', 'Password123!')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should not login if user is inactive', async () => {
      const password = 'TestPassword123!';
      await createTestUser({
        email: 'inactive@test.com',
        password,
        isActive: false,
      });

      await expect(
        authService.login('inactive@test.com', password)
      ).rejects.toThrow();
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const user = await createTestUser({ email: 'refresh@test.com' });
      
      // Create a refresh token
      const refreshTokenValue = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
        { expiresIn: '7d' }
      );

      await prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const result = await authService.refreshTokens(refreshTokenValue);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      
      // Verify old token was invalidated
      const oldToken = await prisma.refreshToken.findUnique({
        where: { token: refreshTokenValue },
      });
      expect(oldToken).toBeFalsy();

      // Verify new token was created
      const newToken = await prisma.refreshToken.findFirst({
        where: { userId: user.id },
      });
      expect(newToken).toBeTruthy();
      expect(newToken?.token).not.toBe(refreshTokenValue);
    });

    it('should not refresh with invalid token', async () => {
      await expect(
        authService.refreshTokens('invalid-token')
      ).rejects.toThrow();
    });

    it('should not refresh with expired token', async () => {
      const user = await createTestUser({ email: 'expired@test.com' });
      
      const refreshTokenValue = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
        { expiresIn: '1ms' } // Very short expiry
      );

      await prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          userId: user.id,
          expiresAt: new Date(Date.now() - 1000), // Already expired
        },
      });

      await expect(
        authService.refreshTokens(refreshTokenValue)
      ).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('should logout user and invalidate refresh token', async () => {
      const user = await createTestUser({ email: 'logout@test.com' });
      
      // Create a refresh token
      const refreshTokenValue = 'test-refresh-token';
      await prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await authService.logout(refreshTokenValue);

      // Verify token was deleted
      const token = await prisma.refreshToken.findUnique({
        where: { token: refreshTokenValue },
      });
      expect(token).toBeFalsy();
    });

    it('should not throw error when logging out with invalid token', async () => {
      await expect(
        authService.logout('non-existent-token')
      ).resolves.not.toThrow();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const user = await createTestUser({
        email: 'verify@test.com',
        isEmailVerified: false,
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1d' }
      );

      await authService.verifyEmail(token);

      // Check if user email is verified
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser?.isEmailVerified).toBe(true);
    });

    it('should not verify with invalid token', async () => {
      await expect(
        authService.verifyEmail('invalid-token')
      ).rejects.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const user = await createTestUser({
        email: 'reset@test.com',
        password: 'OldPassword123!',
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1h' }
      );

      const newPassword = 'NewPassword123!';
      await authService.resetPassword(token, newPassword);

      // Try to login with new password
      const loginResult = await authService.login('reset@test.com', newPassword);
      expect(loginResult.user.id).toBe(user.id);

      // Verify old password doesn't work
      await expect(
        authService.login('reset@test.com', 'OldPassword123!')
      ).rejects.toThrow();
    });

    it('should not reset password with invalid token', async () => {
      await expect(
        authService.resetPassword('invalid-token', 'NewPassword123!')
      ).rejects.toThrow();
    });
  });

  describe('validateAccessToken', () => {
    it('should validate a valid access token', async () => {
      const user = await createTestUser({ email: 'validate@test.com' });
      
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1h' }
      );

      const payload = await authService.validateAccessToken(token);
      
      expect(payload).toBeTruthy();
      expect(payload.userId).toBe(user.id);
      expect(payload.role).toBe(user.role);
    });

    it('should not validate an invalid token', async () => {
      await expect(
        authService.validateAccessToken('invalid-token')
      ).rejects.toThrow();
    });

    it('should not validate an expired token', async () => {
      const user = await createTestUser({ email: 'expired@test.com' });
      
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1ms' } // Very short expiry
      );

      // Wait a bit to ensure token expires
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(
        authService.validateAccessToken(token)
      ).rejects.toThrow();
    });
  });
});
