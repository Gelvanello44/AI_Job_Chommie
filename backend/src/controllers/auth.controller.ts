import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { validatePasswordStrength } from '../utils/password.js';
import { generateTokenPair, refreshAccessToken, revokeRefreshToken } from '../utils/jwt.js';
import { auditLogger } from '../config/logger.js';
import { commonSchemas } from '../middleware/validation.js';

// Validation schemas
const registerSchema = z.object({
  email: commonSchemas.email,
  password: commonSchemas.password,
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: commonSchemas.phone.optional(),
  role: z.enum(['JOB_SEEKER', 'EMPLOYER']).default('JOB_SEEKER'),
  acceptTerms: z.boolean().refine(val => val === true, 'Must accept terms and conditions'),
});

const loginSchema = z.object({
  email: commonSchemas.email,
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

const forgotPasswordSchema = z.object({
  email: commonSchemas.email,
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: commonSchemas.password,
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const verifyPhoneSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Invalid verification code'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export class AuthController {
  private authService = new AuthService();

  /**
   * Register new user
   */
  register = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = registerSchema.parse(req.body);
    
    // Check password strength
    const passwordValidation = validatePasswordStrength(validatedData.password);
    if (!passwordValidation.isValid) {
      throw new AppError(400, 'Password does not meet requirements', 'WEAK_PASSWORD', {
        requirements: passwordValidation.errors,
      });
    }

    const result = await this.authService.register({
      email: validatedData.email,
      password: validatedData.password,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      phone: validatedData.phone,
      role: validatedData.role
    });
    
    auditLogger.log('USER_REGISTER', result.user.id, {
      email: result.user.email,
      role: result.user.role,
    });

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        tokens: result.tokens,
      },
      message: 'User registered successfully. Please verify your email.',
    });
  });

  /**
   * Login user
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, rememberMe } = loginSchema.parse(req.body);

    const result = await this.authService.login(email, password, rememberMe);
    
    auditLogger.log('USER_LOGIN', result.user.id, {
      email: result.user.email,
      ip: req.ip,
    });

    res.json({
      success: true,
      data: {
        user: result.user,
        tokens: result.tokens,
      },
      message: 'Login successful',
    });
  });

  /**
   * Logout user
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.body.refreshToken;
    
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    if (req.user) {
      auditLogger.log('USER_LOGOUT', req.user.id);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });

  /**
   * Refresh access token
   */
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = refreshTokenSchema.parse(req.body);

    const tokens = await refreshAccessToken(refreshToken);
    
    if (!tokens) {
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    res.json({
      success: true,
      data: { tokens },
      message: 'Token refreshed successfully',
    });
  });

  /**
   * Request password reset
   */
  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = forgotPasswordSchema.parse(req.body);

    await this.authService.requestPasswordReset(email);

    res.json({
      success: true,
      message: 'Password reset instructions sent to your email',
    });
  });

  /**
   * Reset password
   */
  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const user = await this.authService.resetPassword(token, password);
    
    auditLogger.log('PASSWORD_RESET', user.id);

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  });

  /**
   * Verify email address
   */
  verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token } = verifyEmailSchema.parse(req.body);

    const user = await this.authService.verifyEmail(token);
    
    auditLogger.log('EMAIL_VERIFIED', user.id);

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  });

  /**
   * Send email verification
   */
  sendEmailVerification = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    await this.authService.sendEmailVerification(req.user.id);

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  });

  /**
   * Send phone verification
   */
  sendPhoneVerification = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    await this.authService.sendPhoneVerification(req.user.id);

    res.json({
      success: true,
      message: 'Verification code sent to your phone',
    });
  });

  /**
   * Verify phone number
   */
  verifyPhone = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { code } = verifyPhoneSchema.parse(req.body);

    await this.authService.verifyPhone(req.user.id, code);
    
    auditLogger.log('PHONE_VERIFIED', req.user.id);

    res.json({
      success: true,
      message: 'Phone number verified successfully',
    });
  });

  /**
   * Get current user profile
   */
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const user = await this.authService.getProfile(req.user.id);

    res.json({
      success: true,
      data: { user },
    });
  });

  /**
   * Change password
   */
  changePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: commonSchemas.password,
    });

    const { currentPassword, newPassword } = schema.parse(req.body);

    await this.authService.changePassword(req.user.id, currentPassword, newPassword);
    
    auditLogger.log('PASSWORD_CHANGED', req.user.id);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  });

  /**
   * Enable 2FA
   */
  enable2FA = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    await this.authService.enable2FA(req.user.id);
    
    auditLogger.log('2FA_ENABLED', req.user.id);

    res.json({
      success: true,
      message: '2FA enabled successfully',
    });
  });

  /**
   * Disable 2FA
   */
  disable2FA = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const schema = z.object({
      password: z.string().min(1),
    });

    const { password } = schema.parse(req.body);

    await this.authService.disable2FA(req.user.id, password);
    
    auditLogger.log('2FA_DISABLED', req.user.id);

    res.json({
      success: true,
      message: '2FA disabled successfully',
    });
  });

  /**
   * Google OAuth callback
   */
  googleCallback = asyncHandler(async (req: Request, res: Response) => {
    // This will be handled by Passport.js middleware
    const user = req.user as any;
    
    const tokens = await generateTokenPair(user);
    
    auditLogger.log('OAUTH_LOGIN', user.id, {
      provider: 'google',
      email: user.email,
    });

    // Redirect to frontend with tokens
    const frontendUrl = process.env.FRONTEND_URL;
    res.redirect(`${frontendUrl}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
  });

  /**
   * LinkedIn OAuth callback
   */
  linkedinCallback = asyncHandler(async (req: Request, res: Response) => {
    // This will be handled by Passport.js middleware
    const user = req.user as any;
    
    const tokens = await generateTokenPair(user);
    
    auditLogger.log('OAUTH_LOGIN', user.id, {
      provider: 'linkedin',
      email: user.email,
    });

    // Redirect to frontend with tokens
    const frontendUrl = process.env.FRONTEND_URL;
    res.redirect(`${frontendUrl}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
  });

  /**
   * Delete account
   */
  deleteAccount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const schema = z.object({
      password: z.string().min(1),
      confirmDelete: z.boolean().refine(val => val === true, 'Must confirm account deletion'),
    });

    const { password } = schema.parse(req.body);

    await this.authService.deleteAccount(req.user.id, password);
    
    auditLogger.log('ACCOUNT_DELETED', req.user.id);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  });
}
