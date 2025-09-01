import { Request, Response } from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import prisma from '../config/database';

export class TwoFactorAuthController {
  // Generate 2FA secret
  async generateSecret(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `AI Job Chommie (${req.user.email})`,
        issuer: 'AI Job Chommie',
        length: 32
      });

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );

      // Store temporarily (not enabled yet)
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorTempSecret: secret.base32,
          twoFactorBackupCodes: backupCodes
        }
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      res.json({
        secret: secret.base32,
        qrCode: qrCodeUrl,
        backupCodes,
        email: req.user.email
      });
    } catch (error) {
      console.error('2FA generation error:', error);
      res.status(500).json({ error: 'Failed to generate 2FA secret' });
    }
  }

  // Verify and enable 2FA
  async verifyAndEnable(req: Request, res: Response) {
    try {
      const { token, secret } = req.body;
      const userId = req.user.id;

      // Verify token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (!verified) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      // Enable 2FA
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: secret,
          twoFactorTempSecret: null
        }
      });

      res.json({ success: true, message: '2FA enabled successfully' });
    } catch (error) {
      console.error('2FA verification error:', error);
      res.status(500).json({ error: 'Failed to verify 2FA' });
    }
  }

  // Verify 2FA token during login
  async verifyToken(req: Request, res: Response) {
    try {
      const { token, userId } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ error: '2FA not enabled' });
      }

      // Check token
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 2
      });

      // Check backup codes if token fails
      if (!verified && user.twoFactorBackupCodes) {
        const backupCodeIndex = user.twoFactorBackupCodes.indexOf(token);
        if (backupCodeIndex !== -1) {
          // Remove used backup code
          const updatedCodes = [...user.twoFactorBackupCodes];
          updatedCodes.splice(backupCodeIndex, 1);
          
          await prisma.user.update({
            where: { id: userId },
            data: { twoFactorBackupCodes: updatedCodes }
          });
          
          return res.json({ 
            success: true, 
            backupCodeUsed: true,
            remainingBackupCodes: updatedCodes.length 
          });
        }
      }

      if (!verified) {
        return res.status(400).json({ error: 'Invalid 2FA token' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('2FA token verification error:', error);
      res.status(500).json({ error: 'Failed to verify 2FA token' });
    }
  }

  // Disable 2FA
  async disable(req: Request, res: Response) {
    try {
      const userId = req.user.id;

      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: []
        }
      });

      res.json({ success: true, message: '2FA disabled successfully' });
    } catch (error) {
      console.error('2FA disable error:', error);
      res.status(500).json({ error: 'Failed to disable 2FA' });
    }
  }

  // Get 2FA status
  async getStatus(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true }
      });

      res.json({ enabled: user?.twoFactorEnabled || false });
    } catch (error) {
      console.error('2FA status error:', error);
      res.status(500).json({ error: 'Failed to get 2FA status' });
    }
  }
}
