import { Job } from 'bull';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import logger from '../../config/logger.js';
import { queues } from '../queues/queue.config.js';
import { config } from '../../config/index.js';
import handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// Create email transporter
const transporter = nodemailer.createTransporter({
  host: config.SMTP_HOST || 'smtp.gmail.com',
  port: config.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASSWORD,
  },
});

interface EmailJobData {
  to: string | string[];
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
  userId?: string;
  type?: string;
  attachments?: Array<{
    filename: string;
    content?: string;
    path?: string;
  }>;
}

/**
 * Process email notification job
 */
export const processEmailJob = async (job: Job<EmailJobData>) => {
  const { to, subject, template, data, html, text, userId, type, attachments } = job.data;

  try {
    logger.info('Processing email notification', { to, subject, type });

    // Get email content
    let emailHtml = html;
    let emailText = text;

    if (template) {
      const { html: templateHtml, text: templateText } = await renderTemplate(template, data || {});
      emailHtml = templateHtml;
      emailText = templateText;
    }

    // Send email
    const result = await transporter.sendMail({
      from: `"AI Job Chommie" <${config.SMTP_FROM || config.SMTP_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html: emailHtml,
      text: emailText,
      attachments,
    });

    // Log email sent
    if (userId) {
      await prisma.notificationLog.create({
        data: {
          userId,
          type: type || 'EMAIL',
          channel: 'EMAIL',
          subject,
          status: 'SENT',
          metadata: {
            messageId: result.messageId,
            to,
          },
        },
      });
    }

    logger.info('Email sent successfully', { messageId: result.messageId, to });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Failed to send email', { to, subject, error });

    // Log failure
    if (userId) {
      await prisma.notificationLog.create({
        data: {
          userId,
          type: type || 'EMAIL',
          channel: 'EMAIL',
          subject,
          status: 'FAILED',
          error: error.message,
          metadata: { to },
        },
      });
    }

    throw error;
  }
};

/**
 * Render email template
 */
async function renderTemplate(templateName: string, data: Record<string, any>) {
  try {
    const templateDir = path.join(process.cwd(), 'src', 'templates', 'emails');
    
    // Load HTML template
    const htmlPath = path.join(templateDir, `${templateName}.html`);
    const htmlTemplate = await fs.readFile(htmlPath, 'utf-8');
    const htmlCompiled = handlebars.compile(htmlTemplate);
    const html = htmlCompiled(data);

    // Load text template (optional)
    let text = '';
    try {
      const textPath = path.join(templateDir, `${templateName}.txt`);
      const textTemplate = await fs.readFile(textPath, 'utf-8');
      const textCompiled = handlebars.compile(textTemplate);
      text = textCompiled(data);
    } catch (error) {
      // Text template is optional
      text = html.replace(/<[^>]*>?/gm, ''); // Strip HTML tags as fallback
    }

    return { html, text };
  } catch (error) {
    logger.error('Failed to render template', { templateName, error });
    throw error;
  }
}

// Register Handlebars helpers
handlebars.registerHelper('formatDate', (date: Date) => {
  return new Date(date).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

handlebars.registerHelper('formatCurrency', (amount: number, currency = 'ZAR') => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
  }).format(amount);
});

// Process different email types
queues.emailQueue.process('welcome', async (job: Job) => {
  const { userId, email, name } = job.data;
  
  return processEmailJob({
    ...job,
    data: {
      to: email,
      subject: 'Welcome to AI Job Chommie!',
      template: 'welcome',
      data: { name, email },
      userId,
      type: 'WELCOME',
    },
  });
});

queues.emailQueue.process('application-confirmation', async (job: Job) => {
  const { userId, email, jobTitle, companyName, applicationId } = job.data;
  
  return processEmailJob({
    ...job,
    data: {
      to: email,
      subject: `Application Submitted: ${jobTitle} at ${companyName}`,
      template: 'application-confirmation',
      data: { jobTitle, companyName, applicationId },
      userId,
      type: 'APPLICATION_CONFIRMATION',
    },
  });
});

queues.emailQueue.process('application-status', async (job: Job) => {
  const { userId, email, jobTitle, companyName, status } = job.data;
  
  return processEmailJob({
    ...job,
    data: {
      to: email,
      subject: `Application Update: ${jobTitle} at ${companyName}`,
      template: 'application-status',
      data: { jobTitle, companyName, status },
      userId,
      type: 'APPLICATION_STATUS',
    },
  });
});

queues.emailQueue.process('interview-scheduled', async (job: Job) => {
  const { userId, email, jobTitle, companyName, interviewDate, interviewType, location } = job.data;
  
  return processEmailJob({
    ...job,
    data: {
      to: email,
      subject: `Interview Scheduled: ${jobTitle} at ${companyName}`,
      template: 'interview-scheduled',
      data: { jobTitle, companyName, interviewDate, interviewType, location },
      userId,
      type: 'INTERVIEW_SCHEDULED',
    },
  });
});

queues.emailQueue.process('job-alert', async (job: Job) => {
  const { userId, email, jobs } = job.data;
  
  return processEmailJob({
    ...job,
    data: {
      to: email,
      subject: `New Job Matches: ${jobs.length} opportunities found`,
      template: 'job-alert',
      data: { jobs },
      userId,
      type: 'JOB_ALERT',
    },
  });
});

queues.emailQueue.process('quota-warning', async (job: Job) => {
  const { userId, email, quotaType, used, limit } = job.data;
  
  return processEmailJob({
    ...job,
    data: {
      to: email,
      subject: 'Quota Warning: Approaching Limit',
      template: 'quota-warning',
      data: { quotaType, used, limit, percentage: Math.round((used / limit) * 100) },
      userId,
      type: 'QUOTA_WARNING',
    },
  });
});

queues.emailQueue.process('subscription-renewal', async (job: Job) => {
  const { userId, email, plan, renewalDate, amount } = job.data;
  
  return processEmailJob({
    ...job,
    data: {
      to: email,
      subject: 'Subscription Renewal Reminder',
      template: 'subscription-renewal',
      data: { plan, renewalDate, amount },
      userId,
      type: 'SUBSCRIPTION_RENEWAL',
    },
  });
});

queues.emailQueue.process('weekly-summary', async (job: Job) => {
  const { userId, email, stats } = job.data;
  
  return processEmailJob({
    ...job,
    data: {
      to: email,
      subject: 'Your Weekly Job Search Summary',
      template: 'weekly-summary',
      data: { stats },
      userId,
      type: 'WEEKLY_SUMMARY',
    },
  });
});

queues.emailQueue.process('application-summary', async (job: Job) => {
  const { userId, results } = job.data;
  
  // Get user email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, profile: { select: { firstName: true } } },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return processEmailJob({
    ...job,
    data: {
      to: user.email,
      subject: 'Automated Job Application Summary',
      template: 'application-summary',
      data: { 
        name: user.profile?.firstName || 'Job Seeker',
        ...results 
      },
      userId,
      type: 'APPLICATION_SUMMARY',
    },
  });
});

// Generic email processor
queues.emailQueue.process('send-email', processEmailJob);

// Schedule daily email digest for active users
export const scheduleDailyDigest = async () => {
  const users = await prisma.user.findMany({
    where: {
      preferences: {
        emailNotifications: true,
        dailyDigest: true,
      },
      status: 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      profile: {
        select: { firstName: true },
      },
    },
  });

  for (const user of users) {
    await queues.emailQueue.add(
      'daily-digest',
      { userId: user.id, email: user.email, name: user.profile?.firstName },
      {
        repeat: {
          cron: '0 8 * * *', // Daily at 8 AM
        },
      }
    );
  }

  logger.info(`Scheduled daily digest for ${users.length} users`);
};

export default processEmailJob;
