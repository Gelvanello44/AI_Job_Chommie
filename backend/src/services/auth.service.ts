import { User, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { hashPassword, comparePassword, generateOTP } from '../utils/password.js';
import { generateTokenPair, revokeAllUserTokens } from '../utils/jwt.js';
import { AppError } from '../middleware/errorHandler.js';
import { cache } from '../config/redis.js';
import { NotificationService } from './notification.service.js';
import { v4 as uuidv4 } from 'uuid';

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
}

interface LoginResult {
  user: Omit<User, 'password'>;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export class AuthService {
  private notificationService = new NotificationService();

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<LoginResult> {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { phone: data.phone || undefined },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === data.email) {
        throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
      }
      if (existingUser.phone === data.phone) {
        throw new AppError(409, 'Phone number already registered', 'PHONE_EXISTS');
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
      },
    });

    // Create profile based on role
    if (data.role === 'JOB_SEEKER') {
      await prisma.jobSeekerProfile.create({
        data: {
          userId: user.id,
        },
      });
    } else if (data.role === 'EMPLOYER') {
      await prisma.employerProfile.create({
        data: {
          userId: user.id,
        },
      });
    }

    // Generate tokens
    const tokens = await generateTokenPair(user);

    // Send welcome email and verification
    await this.sendEmailVerification(user.id);
    await this.notificationService.sendWelcomeEmail(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Login user
   */
  async login(email: string, password: string, _rememberMe: boolean = false): Promise<LoginResult> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        jobSeekerProfile: true,
        employerProfile: true,
      },
    });

    if (!user || !user.password) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled && user.phone) {
      // Store user ID temporarily for 2FA verification
      const tempToken = uuidv4();
      await cache.set(`2fa:${tempToken}`, user.id, 300); // 5 minutes

      // Send 2FA code
      await this.sendPhoneVerification(user.id);

      throw new AppError(202, 'Two-factor authentication required', '2FA_REQUIRED', {
        tempToken,
        requiresCode: true,
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await generateTokenPair(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists
      return;
    }

    // Generate reset token
    const resetToken = uuidv4();

    // Store reset token in cache
    await cache.set(`password_reset:${resetToken}`, user.id, 3600);

    // Send reset email
    await this.notificationService.sendPasswordResetEmail(user, resetToken);
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<User> {
    // Get user ID from cache
    const userId = await cache.get<string>(`password_reset:${token}`);
    if (!userId) {
      throw new AppError(400, 'Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    const user = await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Clear reset token
    await cache.del(`password_reset:${token}`);

    // Revoke all existing tokens
    await revokeAllUserTokens(userId);

    return user;
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (user.emailVerified) {
      throw new AppError(400, 'Email already verified');
    }

    // Generate verification token
    const verificationToken = uuidv4();

    // Store token in cache (24 hours)
    await cache.set(`email_verification:${verificationToken}`, userId, 86400);

    // Send verification email
    await this.notificationService.sendEmailVerification(user, verificationToken);
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<User> {
    // Get user ID from cache
    const userId = await cache.get<string>(`email_verification:${token}`);
    if (!userId) {
      throw new AppError(400, 'Invalid or expired verification token');
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    // Clear verification token
    await cache.del(`email_verification:${token}`);

    return user;
  }

  /**
   * Send phone verification
   */
  async sendPhoneVerification(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.phone) {
      throw new AppError(400, 'Phone number not found');
    }

    if (user.phoneVerified) {
      throw new AppError(400, 'Phone number already verified');
    }

    // Generate verification code
    const verificationCode = generateOTP(6);

    // Store code in cache (10 minutes)
    await cache.set(`phone_verification:${userId}`, verificationCode, 600);

    // Send SMS
    await this.notificationService.sendPhoneVerification(user.phone, verificationCode);
  }

  /**
   * Verify phone
   */
  async verifyPhone(userId: string, code: string): Promise<User> {
    // Get verification code from cache
    const storedCode = await cache.get<string>(`phone_verification:${userId}`);
    if (!storedCode || storedCode !== code) {
      throw new AppError(400, 'Invalid or expired verification code');
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true },
    });

    // Clear verification code
    await cache.del(`phone_verification:${userId}`);

    return user;
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<Omit<User, 'password'> & { profile?: any }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        jobSeekerProfile: true,
        employerProfile: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const { password, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      profile: user.role === 'JOB_SEEKER' ? user.jobSeekerProfile : user.employerProfile,
    };
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new AppError(404, 'User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new AppError(400, 'Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // Revoke all existing tokens except current session
    await revokeAllUserTokens(userId);
  }

  /**
   * Enable 2FA
   */
  async enable2FA(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (!user.phone || !user.phoneVerified) {
      throw new AppError(400, 'Verified phone number required for 2FA');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
  }

  /**
   * Disable 2FA
   */
  async disable2FA(userId: string, password: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new AppError(404, 'User not found');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(400, 'Invalid password');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false },
    });
  }

  /**
   * Delete account
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new AppError(404, 'User not found');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(400, 'Invalid password');
    }

    // Delete user (cascade delete will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Revoke all tokens
    await revokeAllUserTokens(userId);

    // Clear all cache entries for this user
    await cache.clearPattern(`*${userId}*`);
  }
}
