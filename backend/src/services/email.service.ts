import nodemailer from 'nodemailer';
import logger from '../config/logger.js';
import { config } from '../config/index.js';

/**
 * Email Service
 * Handles sending emails for various purposes
 */
class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(config.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASSWORD
      }
    });
  }

  /**
   * Send an email
   */
  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string
  ): Promise<void> {
    try {
      const mailOptions = {
        from: config.EMAIL_FROM || 'noreply@aijobchommie.co.za',
        to,
        subject,
        text,
        html: html || text
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { messageId: info.messageId, to, subject });
    } catch (error) {
      logger.error('Failed to send email', { error, to, subject });
      throw error;
    }
  }

  /**
   * Send a templated email
   */
  async sendTemplatedEmail(
    to: string,
    subject: string,
    template: string,
    data: any
  ): Promise<void> {
    try {
      // Simple template replacement
      let html = template;
      Object.keys(data).forEach(key => {
        const value = data[key];
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });

      await this.sendEmail(to, subject, subject, html);
    } catch (error) {
      logger.error('Failed to send templated email', { error, to, subject });
      throw error;
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(
    recipients: Array<{ email: string; data?: any }>,
    subject: string,
    template: string
  ): Promise<{ sent: number; failed: number }> {
    const results = { sent: 0, failed: 0 };

    for (const recipient of recipients) {
      try {
        await this.sendTemplatedEmail(
          recipient.email,
          subject,
          template,
          recipient.data || {}
        );
        results.sent++;
      } catch (error) {
        logger.error('Failed to send bulk email', { error, email: recipient.email });
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Send interview scheduled email
   */
  async sendInterviewScheduledEmail(userId: string, interview: any): Promise<void> {
    try {
      // In a real implementation, fetch user email from database
      const userEmail = 'user@example.com';
      const subject = 'Interview Scheduled - ' + interview.job?.company?.name;
      const text = `Your interview has been scheduled for ${interview.interviewDate}`;
      await this.sendEmail(userEmail, subject, text);
    } catch (error) {
      logger.error('Failed to send interview scheduled email', { error });
    }
  }

  /**
   * Send interview cancelled email
   */
  async sendInterviewCancelledEmail(userId: string, interview: any): Promise<void> {
    try {
      // In a real implementation, fetch user email from database
      const userEmail = 'user@example.com';
      const subject = 'Interview Cancelled - ' + interview.job?.company?.name;
      const text = `Your interview scheduled for ${interview.interviewDate} has been cancelled.`;
      await this.sendEmail(userEmail, subject, text);
    } catch (error) {
      logger.error('Failed to send interview cancelled email', { error });
    }
  }
}

export const emailService = new EmailService();
