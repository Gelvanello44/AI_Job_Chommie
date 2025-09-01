import nodemailer from 'nodemailer';
import twilio from 'twilio';
import * as OneSignal from 'onesignal-node';
import { User } from '@prisma/client';
import { config, emailConfig, twilioConfig, oneSignalConfig } from '../config/index.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

export class NotificationService {
  private emailTransporter: nodemailer.Transporter | undefined;
  private twilioClient: twilio.Twilio | undefined;
  private oneSignalClient: any;

  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport(emailConfig);

    // Initialize Twilio client
    if (config.ENABLE_SMS_NOTIFICATIONS) {
      this.twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    }

    // Initialize OneSignal client
    if (config.ENABLE_PUSH_NOTIFICATIONS) {
      this.oneSignalClient = new OneSignal.Client(
        oneSignalConfig.appId,
        oneSignalConfig.apiKey
      );
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(user: User): Promise<void> {
    if (!config.ENABLE_EMAIL_NOTIFICATIONS) return;

    try {
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: user.email,
        subject: 'Welcome to AI Job Chommie! ',
        html: this.getWelcomeEmailTemplate(user),
      };

      await this.emailTransporter!.sendMail(mailOptions);

      // Log notification
      await this.logNotification({
        userId: user.id,
        type: 'EMAIL',
        subject: mailOptions.subject,
        content: 'Welcome email sent',
        status: 'SENT',
      });

      logger.info('Welcome email sent', { userId: user.id, email: user.email });
    } catch (error) {
      logger.error('Failed to send welcome email', { userId: user.id, error });
      await this.logNotification({
        userId: user.id,
        type: 'EMAIL',
        subject: 'Welcome to AI Job Chommie',
        content: 'Welcome email',
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(user: User, token: string): Promise<void> {
    if (!config.ENABLE_EMAIL_NOTIFICATIONS) return;

    try {
      const verificationLink = `${config.FRONTEND_URL}/verify-email?token=${token}`;
      
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: user.email,
        subject: 'Verify your email address',
        html: this.getEmailVerificationTemplate(user, verificationLink),
      };

      await this.emailTransporter!.sendMail(mailOptions);

      await this.logNotification({
        userId: user.id,
        type: 'EMAIL',
        subject: mailOptions.subject,
        content: `Email verification sent to ${user.email}`,
        status: 'SENT',
      });

      logger.info('Email verification sent', { userId: user.id, email: user.email });
    } catch (error) {
      logger.error('Failed to send email verification', { userId: user.id, error });
      throw new AppError(500, 'Failed to send verification email');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user: User, token: string): Promise<void> {
    if (!config.ENABLE_EMAIL_NOTIFICATIONS) return;

    try {
      const resetLink = `${config.FRONTEND_URL}/reset-password?token=${token}`;
      
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: user.email,
        subject: 'Reset your password',
        html: this.getPasswordResetTemplate(user, resetLink),
      };

      await this.emailTransporter!.sendMail(mailOptions);

      await this.logNotification({
        userId: user.id,
        type: 'EMAIL',
        subject: mailOptions.subject,
        content: 'Password reset email sent',
        status: 'SENT',
      });

      logger.info('Password reset email sent', { userId: user.id, email: user.email });
    } catch (error) {
      logger.error('Failed to send password reset email', { userId: user.id, error });
      throw new AppError(500, 'Failed to send password reset email');
    }
  }

  /**
   * Send phone verification SMS
   */
  async sendPhoneVerification(phone: string, code: string): Promise<void> {
    if (!config.ENABLE_SMS_NOTIFICATIONS || !this.twilioClient) return;

    try {
      const message = `Your AI Job Chommie verification code is: ${code}. Valid for 10 minutes.`;

      await this.twilioClient.messages.create({
        body: message,
        from: twilioConfig.phoneNumber,
        to: phone,
      });

      logger.info('Phone verification SMS sent', { phone: phone.slice(-4) });
    } catch (error) {
      logger.error('Failed to send phone verification SMS', { phone: phone.slice(-4), error });
      throw new AppError(500, 'Failed to send verification code');
    }
  }

  /**
   * Send job alert notification
   */
  async sendJobAlert(userId: string, jobs: any[]): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        firstName: true, 
        phone: true,
        jobAlerts: {
          where: { active: true },
          take: 1
        }
      },
    });

    if (!user || user.jobAlerts.length === 0) return;

    const jobAlert = user.jobAlerts[0];

    // Send email notification
    if (jobAlert.emailEnabled && config.ENABLE_EMAIL_NOTIFICATIONS) {
      try {
        const mailOptions = {
          from: config.EMAIL_FROM,
          to: user.email,
          subject: `${jobs.length} new job${jobs.length > 1 ? 's' : ''} matching your criteria`,
          html: this.getJobAlertEmailTemplate(user, jobs),
        };

        await this.emailTransporter!.sendMail(mailOptions);

        await this.logNotification({
          userId: user.id,
          type: 'EMAIL',
          subject: mailOptions.subject,
          content: `Job alert with ${jobs.length} jobs`,
          status: 'SENT',
        });
      } catch (error) {
        logger.error('Failed to send job alert email', { userId, error });
      }
    }

    // Send SMS notification
    if (jobAlert.smsEnabled && user.phone && config.ENABLE_SMS_NOTIFICATIONS) {
      try {
        const message = `AI Job Chommie: ${jobs.length} new job${jobs.length > 1 ? 's' : ''} matching your criteria. Check your dashboard: ${config.FRONTEND_URL}/dashboard`;

        await this.twilioClient!.messages.create({
          body: message,
          from: twilioConfig.phoneNumber,
          to: user.phone,
        });

        await this.logNotification({
          userId: user.id,
          type: 'SMS',
          subject: 'Job Alert',
          content: message,
          status: 'SENT',
        });
      } catch (error) {
        logger.error('Failed to send job alert SMS', { userId, error });
      }
    }

    // Send push notification
    if (jobAlert.pushEnabled && config.ENABLE_PUSH_NOTIFICATIONS) {
      await this.sendPushNotification(userId, {
        title: 'New Jobs Available!',
        message: `${jobs.length} new job${jobs.length > 1 ? 's' : ''} matching your criteria`,
        data: { type: 'job_alert', jobCount: jobs.length },
      });
    }
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(
    userId: string,
    transactionDetails: {
      reference: string;
      amount: number;
      currency: string;
      plan: string;
      provider: string;
      date: Date;
    }
  ): Promise<void> {
    if (!config.ENABLE_EMAIL_NOTIFICATIONS) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      logger.error('User not found for payment confirmation', { userId });
      return;
    }

    try {
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: user.email,
        subject: `Payment Confirmation - AI Job Chommie ${transactionDetails.plan} Plan`,
        html: this.getPaymentConfirmationTemplate(user, transactionDetails),
      };

      await this.emailTransporter!.sendMail(mailOptions);

      await this.logNotification({
        userId: user.id,
        type: 'EMAIL',
        subject: mailOptions.subject,
        content: `Payment confirmation sent for ${transactionDetails.reference}`,
        status: 'SENT',
      });

      logger.info('Payment confirmation email sent', { 
        userId: user.id, 
        email: user.email,
        reference: transactionDetails.reference 
      });
    } catch (error) {
      logger.error('Failed to send payment confirmation email', { userId, error });
      await this.logNotification({
        userId: user.id,
        type: 'EMAIL',
        subject: `Payment Confirmation - ${transactionDetails.plan}`,
        content: `Payment confirmation for ${transactionDetails.reference}`,
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send subscription activation email
   */
  async sendSubscriptionActivation(
    userId: string,
    subscriptionDetails: {
      plan: string;
      nextBillingDate: Date;
      amount: number;
      currency: string;
    }
  ): Promise<void> {
    if (!config.ENABLE_EMAIL_NOTIFICATIONS) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      logger.error('User not found for subscription activation', { userId });
      return;
    }

    try {
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: user.email,
        subject: `Welcome to ${subscriptionDetails.plan} - Your Subscription is Active! `,
        html: this.getSubscriptionActivationTemplate(user, subscriptionDetails),
      };

      await this.emailTransporter!.sendMail(mailOptions);

      await this.logNotification({
        userId: user.id,
        type: 'EMAIL',
        subject: mailOptions.subject,
        content: `Subscription activation email sent for ${subscriptionDetails.plan}`,
        status: 'SENT',
      });

      logger.info('Subscription activation email sent', { 
        userId: user.id, 
        email: user.email,
        plan: subscriptionDetails.plan 
      });
    } catch (error) {
      logger.error('Failed to send subscription activation email', { userId, error });
      await this.logNotification({
        userId: user.id,
        type: 'EMAIL',
        subject: `Welcome to ${subscriptionDetails.plan}`,
        content: `Subscription activation for ${subscriptionDetails.plan}`,
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailure(
    userId: string,
    failureDetails: {
      reference: string;
      amount: number;
      currency: string;
      reason: string;
      retryUrl?: string;
    }
  ): Promise<void> {
    if (!config.ENABLE_EMAIL_NOTIFICATIONS) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      logger.error('User not found for payment failure notification', { userId });
      return;
    }

    try {
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: user.email,
        subject: 'Payment Issue - AI Job Chommie',
        html: this.getPaymentFailureTemplate(user, failureDetails),
      };

      await this.emailTransporter!.sendMail(mailOptions);

      await this.logNotification({
        userId: user.id,
        type: 'EMAIL',
        subject: mailOptions.subject,
        content: `Payment failure notification sent for ${failureDetails.reference}`,
        status: 'SENT',
      });

      logger.info('Payment failure email sent', { 
        userId: user.id, 
        email: user.email,
        reference: failureDetails.reference 
      });
    } catch (error) {
      logger.error('Failed to send payment failure email', { userId, error });
    }
  }

  /**
   * Send application status update
   */
  async sendApplicationStatusUpdate(
    userId: string,
    jobTitle: string,
    companyName: string,
    status: string,
    message: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, phone: true },
    });

    if (!user) return;

    const statusMessages = {
      REVIEWED: 'Your application has been reviewed',
      SHORTLISTED: 'Congratulations! You\'ve been shortlisted',
      INTERVIEW_SCHEDULED: 'Interview scheduled for your application',
      REJECTED: 'Application update',
      ACCEPTED: 'Congratulations! Your application has been accepted',
    };

    const statusMessage = statusMessages[status as keyof typeof statusMessages] || 'Application status updated';

    // Send email notification
    if (config.ENABLE_EMAIL_NOTIFICATIONS) {
      try {
        const mailOptions = {
          from: config.EMAIL_FROM,
          to: user.email,
          subject: `Application Update: ${jobTitle}`,
          html: this.getApplicationStatusTemplate(user, jobTitle, companyName, status, message),
        };

        await this.emailTransporter!.sendMail(mailOptions);

        await this.logNotification({
          userId: user.id,
          type: 'EMAIL',
          subject: mailOptions.subject,
          content: `Application status update: ${status}`,
          status: 'SENT',
        });
      } catch (error) {
        logger.error('Failed to send application status email', { userId, error });
      }
    }

    // Send push notification
    if (config.ENABLE_PUSH_NOTIFICATIONS) {
      await this.sendPushNotification(userId, {
        title: statusMessage,
        message: `${jobTitle} at ${companyName}`,
        data: { type: 'application_update', status },
      });
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(userId: string, notification: {
    title: string;
    message: string;
    data?: any;
  }): Promise<void> {
    if (!config.ENABLE_PUSH_NOTIFICATIONS || !this.oneSignalClient) return;

    try {
      const pushNotification = {
        contents: { en: notification.message },
        headings: { en: notification.title },
        filters: [
          { field: 'tag', key: 'userId', relation: '=', value: userId }
        ],
        data: notification.data || {},
      };

      await this.oneSignalClient.createNotification(pushNotification);

      await this.logNotification({
        userId: userId,
        type: 'PUSH',
        subject: notification.title,
        content: notification.message,
        status: 'SENT',
        metadata: notification.data,
      });

      logger.info('Push notification sent', { userId, title: notification.title });
    } catch (error) {
      logger.error('Failed to send push notification', { userId, error });
    }
  }

  /**
   * Log notification to database
   */
  private async logNotification(data: {
    userId: string;
    type: 'EMAIL' | 'SMS' | 'PUSH';
    subject: string;
    content: string;
    status: 'PENDING' | 'SENT' | 'FAILED';
    failureReason?: string;
    metadata?: any;
    scheduledFor?: Date;
  }): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          ...data,
          sentAt: data.status === 'SENT' ? new Date() : null,
        },
      });
    } catch (error) {
      logger.error('Failed to log notification', { error });
    }
  }

  // Email Templates

  private getWelcomeEmailTemplate(user: User): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to AI Job Chommie</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #22d3ee; margin: 0;">Welcome to AI Job Chommie!</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${user.firstName}! </h2>
          <p>Welcome to South Africa's most intelligent job search platform! We're thrilled to have you join our community.</p>
          
          <h3 style="color: #22d3ee;">What's next?</h3>
          <ul style="padding-left: 20px;">
            <li><strong>Complete your profile:</strong> Add your skills, experience, and preferences</li>
            <li><strong>Upload your CV:</strong> Our AI will analyze and optimize it for you</li>
            <li><strong>Set up job alerts:</strong> Get notified about relevant opportunities</li>
            <li><strong>Start applying:</strong> Use our one-click application feature</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.FRONTEND_URL}/dashboard" style="background: #22d3ee; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #666;">
          <p>Need help? Reply to this email or visit our <a href="${config.FRONTEND_URL}/support">support center</a>.</p>
          <p style="margin-bottom: 0;">Happy job hunting!<br>The AI Job Chommie Team</p>
        </div>
      </body>
      </html>
    `;
  }

  private getEmailVerificationTemplate(user: User, verificationLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #22d3ee; margin: 0;">Verify Your Email</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${user.firstName}!</h2>
          <p>Thank you for signing up with AI Job Chommie. To complete your registration, please verify your email address.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background: #22d3ee; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404;"><strong>Note:</strong> This link will expire in 24 hours for security reasons.</p>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #666;">
          <p>If you didn't create an account with AI Job Chommie, please ignore this email.</p>
          <p style="margin-bottom: 0;">Best regards,<br>The AI Job Chommie Team</p>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetTemplate(user: User, resetLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #22d3ee; margin: 0;">Password Reset</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${user.firstName}!</h2>
          <p>You requested to reset your password for your AI Job Chommie account. Click the button below to set a new password.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #22d3ee; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <div style="background: #f8d7da; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <p style="margin: 0; color: #721c24;"><strong>Security Note:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #666;">
          <p style="margin-bottom: 0;">Stay secure,<br>The AI Job Chommie Team</p>
        </div>
      </body>
      </html>
    `;
  }

  private getJobAlertEmailTemplate(user: any, jobs: any[]): string {
    const jobsHtml = jobs.slice(0, 5).map(job => `
      <div style="border: 1px solid #e9ecef; padding: 15px; margin-bottom: 15px; border-radius: 6px;">
        <h3 style="margin: 0 0 10px 0; color: #22d3ee;">
          <a href="${config.FRONTEND_URL}/jobs/${job.id}" style="color: #22d3ee; text-decoration: none;">
            ${job.title}
          </a>
        </h3>
        <p style="margin: 0 0 8px 0; color: #666; font-weight: bold;">${job.company?.name}</p>
        <p style="margin: 0 0 8px 0; color: #666;">${job.city}, ${job.province}</p>
        ${job.salaryMin ? `<p style="margin: 0; color: #28a745; font-weight: bold;">R${job.salaryMin.toLocaleString()}${job.salaryMax ? ` - R${job.salaryMax.toLocaleString()}` : '+'}</p>` : ''}
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Jobs Available</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #22d3ee; margin: 0;">New Jobs Available! </h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${user.firstName}!</h2>
          <p>We found <strong>${jobs.length} new job${jobs.length > 1 ? 's' : ''}</strong> matching your criteria.</p>
        </div>
        
        <div style="margin: 20px 0;">
          ${jobsHtml}
          ${jobs.length > 5 ? `<p style="text-align: center; color: #666;">... and ${jobs.length - 5} more jobs</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.FRONTEND_URL}/jobs" style="background: #22d3ee; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View All Jobs
          </a>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #666;">
          <p>You're receiving this because you have active job alerts. <a href="${config.FRONTEND_URL}/preferences">Manage your preferences</a></p>
          <p style="margin-bottom: 0;">Happy job hunting!<br>The AI Job Chommie Team</p>
        </div>
      </body>
      </html>
    `;
  }

  private getApplicationStatusTemplate(
    user: any, 
    jobTitle: string, 
    companyName: string, 
    status: string, 
    message: string
  ): string {
    const statusColors = {
      REVIEWED: '#17a2b8',
      SHORTLISTED: '#28a745',
      INTERVIEW_SCHEDULED: '#ffc107',
      REJECTED: '#dc3545',
      ACCEPTED: '#28a745',
    };

    const color = statusColors[status as keyof typeof statusColors] || '#6c757d';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: ${color}; margin: 0;">Application Update</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${user.firstName}!</h2>
          <p style="font-size: 18px; color: ${color}; font-weight: bold;">${message}</p>
          
          <div style="background: white; padding: 15px; border-radius: 6px; margin-top: 15px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${jobTitle}</h3>
            <p style="margin: 0; color: #666; font-weight: bold;">${companyName}</p>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.FRONTEND_URL}/applications" style="background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Application
          </a>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #666;">
          <p style="margin-bottom: 0;">Best of luck!<br>The AI Job Chommie Team</p>
        </div>
      </body>
      </html>
    `;
  }

  private getPaymentConfirmationTemplate(
    user: any,
    transactionDetails: {
      reference: string;
      amount: number;
      currency: string;
      plan: string;
      provider: string;
      date: Date;
    }
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #28a745; margin: 0;">Payment Confirmed! </h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${user.firstName}!</h2>
          <p>We've successfully received your payment. Your subscription is now active!</p>
        </div>
        
        <div style="background: white; border: 1px solid #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #22d3ee; margin-top: 0;">Payment Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Plan:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${transactionDetails.plan}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Amount:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${transactionDetails.currency} ${(transactionDetails.amount / 100).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Reference:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${transactionDetails.reference}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Payment Method:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${transactionDetails.provider.charAt(0).toUpperCase() + transactionDetails.provider.slice(1)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Date:</td>
              <td style="padding: 8px 0;">${transactionDetails.date.toLocaleDateString()}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.FRONTEND_URL}/dashboard" style="background: #22d3ee; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #666;">
          <p>Need help? Reply to this email or visit our <a href="${config.FRONTEND_URL}/support">support center</a>.</p>
          <p style="margin-bottom: 0;">Thank you for choosing AI Job Chommie!<br>The AI Job Chommie Team</p>
        </div>
      </body>
      </html>
    `;
  }

  private getSubscriptionActivationTemplate(
    user: any,
    subscriptionDetails: {
      plan: string;
      nextBillingDate: Date;
      amount: number;
      currency: string;
    }
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Activated</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #28a745; margin: 0;">Welcome to ${subscriptionDetails.plan}! </h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${user.firstName}!</h2>
          <p>Congratulations! Your ${subscriptionDetails.plan} subscription is now active. You now have access to all premium features.</p>
        </div>
        
        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #155724; margin-top: 0;">Subscription Details</h3>
          <p style="margin: 5px 0;"><strong>Plan:</strong> ${subscriptionDetails.plan}</p>
          <p style="margin: 5px 0;"><strong>Next Billing:</strong> ${subscriptionDetails.nextBillingDate.toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Amount:</strong> ${subscriptionDetails.currency} ${(subscriptionDetails.amount / 100).toLocaleString()}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.FRONTEND_URL}/dashboard" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Start Using Premium Features
          </a>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #666;">
          <p>Your subscription will auto-renew unless cancelled. <a href="${config.FRONTEND_URL}/subscription">Manage subscription</a></p>
          <p style="margin-bottom: 0;">Welcome to the premium experience!<br>The AI Job Chommie Team</p>
        </div>
      </body>
      </html>
    `;
  }

  private getPaymentFailureTemplate(
    user: any,
    failureDetails: {
      reference: string;
      amount: number;
      currency: string;
      reason: string;
      retryUrl?: string;
    }
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Issue</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #dc3545; margin: 0;">Payment Issue </h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${user.firstName}!</h2>
          <p>We encountered an issue processing your payment. Don't worry - this happens sometimes and is usually easy to resolve.</p>
        </div>
        
        <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #721c24; margin-top: 0;">Payment Details</h3>
          <p style="margin: 5px 0;"><strong>Reference:</strong> ${failureDetails.reference}</p>
          <p style="margin: 5px 0;"><strong>Amount:</strong> ${failureDetails.currency} ${(failureDetails.amount / 100).toLocaleString()}</p>
          <p style="margin: 5px 0;"><strong>Issue:</strong> ${failureDetails.reason}</p>
        </div>
        
        ${failureDetails.retryUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${failureDetails.retryUrl}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Try Payment Again
            </a>
          </div>
        ` : ''}
        
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;"><strong>Common Solutions:</strong></p>
          <ul style="color: #856404; margin: 10px 0;">
            <li>Check your card details are correct</li>
            <li>Ensure sufficient funds are available</li>
            <li>Try a different payment method</li>
            <li>Contact your bank if the issue persists</li>
          </ul>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #666;">
          <p>Need help? <a href="${config.FRONTEND_URL}/support">Contact our support team</a> - we're here to help!</p>
          <p style="margin-bottom: 0;">Best regards,<br>The AI Job Chommie Team</p>
        </div>
      </body>
      </html>
    `;
  }
}
