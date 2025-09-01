import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { ReminderType, ReminderStatus } from '@prisma/client';
import { emailService } from './email.service.js';
import { addDays, addHours, isAfter, isBefore, startOfDay } from 'date-fns';
import cron from 'node-cron';

/**
 * Reminder Service
 * Handles creation, scheduling, and sending of various reminder types
 */
export class ReminderService {
  /**
   * Create a follow-up reminder for an application
   */
  async createApplicationReminder(
    userId: string,
    applicationId: string,
    scheduledFor: Date,
    title: string,
    description?: string
  ): Promise<any> {
    try {
      logger.info('Creating application reminder', { userId, applicationId, scheduledFor });

      const reminder = await prisma.reminder.create({
        data: {
          userId,
          applicationId,
          type: 'APPLICATION_FOLLOWUP',
          title,
          description,
          scheduledFor,
          status: 'PENDING',
          createdAt: new Date()
        },
        include: {
          application: {
            include: {
              job: {
                include: {
                  company: true
                }
              }
            }
          }
        }
      });

      // Schedule immediate processing if reminder is for today
      if (this.shouldProcessToday(scheduledFor)) {
        await this.scheduleReminderProcessing(reminder.id);
      }

      return reminder;
    } catch (error) {
      logger.error('Error creating application reminder', { error, userId, applicationId });
      throw error;
    }
  }

  /**
   * Create an interview reminder
   */
  async createInterviewReminder(
    userId: string,
    interviewId: string,
    scheduledFor: Date,
    title: string,
    description?: string
  ): Promise<any> {
    try {
      logger.info('Creating interview reminder', { userId, interviewId });

      const reminder = await prisma.reminder.create({
        data: {
          userId,
          interviewId,
          type: 'INTERVIEW',
          title,
          description,
          scheduledFor,
          status: 'PENDING'
        }
      });

      if (this.shouldProcessToday(scheduledFor)) {
        await this.scheduleReminderProcessing(reminder.id);
      }

      return reminder;
    } catch (error) {
      logger.error('Error creating interview reminder', { error });
      throw error;
    }
  }

  /**
   * Create a custom reminder
   */
  async createCustomReminder(
    userId: string,
    data: {
      title: string;
      description?: string;
      scheduledFor: Date;
      recurring?: boolean;
      recurrencePattern?: string;
      recurrenceEndDate?: Date;
      metadata?: any;
    }
  ): Promise<any> {
    try {
      logger.info('Creating custom reminder', { userId, title: data.title });

      const reminder = await prisma.reminder.create({
        data: {
          userId,
          type: 'CUSTOM',
          title: data.title,
          description: data.description,
          scheduledFor: data.scheduledFor,
          recurring: data.recurring || false,
          recurrencePattern: data.recurrencePattern,
          recurrenceEndDate: data.recurrenceEndDate,
          metadata: data.metadata,
          status: 'PENDING'
        }
      });

      if (this.shouldProcessToday(data.scheduledFor)) {
        await this.scheduleReminderProcessing(reminder.id);
      }

      return reminder;
    } catch (error) {
      logger.error('Error creating custom reminder', { error });
      throw error;
    }
  }

  /**
   * Get user's reminders
   */
  async getUserReminders(
    userId: string,
    filters?: {
      type?: ReminderType;
      status?: ReminderStatus;
      upcoming?: boolean;
      limit?: number;
    }
  ): Promise<any[]> {
    try {
      const where: any = { userId };

      if (filters?.type) {
        where.type = filters.type;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.upcoming) {
        where.scheduledFor = {
          gte: new Date()
        };
      }

      const reminders = await prisma.reminder.findMany({
        where,
        orderBy: {
          scheduledFor: 'asc'
        },
        take: filters?.limit || 50,
        include: {
          application: {
            include: {
              job: {
                include: {
                  company: true
                }
              }
            }
          }
        }
      });

      return reminders;
    } catch (error) {
      logger.error('Error fetching reminders', { error, userId });
      throw error;
    }
  }

  /**
   * Update reminder
   */
  async updateReminder(
    reminderId: string,
    userId: string,
    updates: {
      title?: string;
      description?: string;
      scheduledFor?: Date;
      status?: ReminderStatus;
    }
  ): Promise<any> {
    try {
      logger.info('Updating reminder', { reminderId, userId });

      const reminder = await prisma.reminder.update({
        where: {
          id: reminderId,
          userId // Ensure user owns the reminder
        },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      // Reschedule if date changed
      if (updates.scheduledFor && this.shouldProcessToday(updates.scheduledFor)) {
        await this.scheduleReminderProcessing(reminder.id);
      }

      return reminder;
    } catch (error) {
      logger.error('Error updating reminder', { error });
      throw error;
    }
  }

  /**
   * Delete reminder
   */
  async deleteReminder(reminderId: string, userId: string): Promise<void> {
    try {
      logger.info('Deleting reminder', { reminderId, userId });

      await prisma.reminder.delete({
        where: {
          id: reminderId,
          userId
        }
      });

      // Remove from processing queue if exists
      await redis.del(`reminder:processing:${reminderId}`);
    } catch (error) {
      logger.error('Error deleting reminder', { error });
      throw error;
    }
  }

  /**
   * Process pending reminders
   */
  async processPendingReminders(): Promise<void> {
    try {
      logger.info('Processing pending reminders');

      const reminders = await prisma.reminder.findMany({
        where: {
          status: 'PENDING',
          scheduledFor: {
            lte: new Date()
          }
        },
        include: {
          user: true,
          application: {
            include: {
              job: {
                include: {
                  company: true
                }
              }
            }
          }
        }
      });

      logger.info(`Found ${reminders.length} reminders to process`);

      for (const reminder of reminders) {
        await this.processReminder(reminder);
      }
    } catch (error) {
      logger.error('Error processing reminders', { error });
    }
  }

  /**
   * Process a single reminder
   */
  private async processReminder(reminder: any): Promise<void> {
    try {
      logger.info('Processing reminder', { reminderId: reminder.id, type: reminder.type });

      // Send notification based on reminder type
      switch (reminder.type) {
        case 'APPLICATION_FOLLOWUP':
          await this.sendApplicationFollowUpReminder(reminder);
          break;
        case 'INTERVIEW':
          await this.sendInterviewReminder(reminder);
          break;
        case 'MILESTONE':
          await this.sendMilestoneReminder(reminder);
          break;
        case 'REFERENCE_REQUEST':
          await this.sendReferenceRequestReminder(reminder);
          break;
        case 'CUSTOM':
          await this.sendCustomReminder(reminder);
          break;
        default:
          logger.warn('Unknown reminder type', { type: reminder.type });
      }

      // Mark as sent
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: 'SENT',
          sentAt: new Date()
        }
      });

      // Handle recurring reminders
      if (reminder.recurring && reminder.recurrencePattern) {
        await this.createNextRecurringReminder(reminder);
      }
    } catch (error) {
      logger.error('Error processing reminder', { error, reminderId: reminder.id });
      
      // Mark as failed
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: 'FAILED',
          error: error.message
        }
      });
    }
  }

  /**
   * Send application follow-up reminder
   */
  private async sendApplicationFollowUpReminder(reminder: any): Promise<void> {
    const { user, application } = reminder;

    if (!application) {
      logger.warn('Application not found for reminder', { reminderId: reminder.id });
      return;
    }

    const emailContent = {
      subject: `Follow-up Reminder: ${application.job.title} at ${application.job.company.name}`,
      html: `
        <h2>Application Follow-up Reminder</h2>
        <p>Hi ${user.firstName},</p>
        <p>This is a reminder to follow up on your application for:</p>
        <ul>
          <li><strong>Position:</strong> ${application.job.title}</li>
          <li><strong>Company:</strong> ${application.job.company.name}</li>
          <li><strong>Applied:</strong> ${new Date(application.createdAt).toLocaleDateString()}</li>
        </ul>
        <p>${reminder.description || 'Consider reaching out to the hiring manager or HR department for an update on your application status.'}</p>
        <p>Best regards,<br>AI Job Chommie Team</p>
      `
    };

    await emailService.sendEmail(user.email, emailContent.subject, '', emailContent.html);

    // Also create in-app notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'REMINDER',
        title: reminder.title,
        message: reminder.description || 'Time to follow up on your application',
        metadata: {
          reminderId: reminder.id,
          applicationId: application.id,
          jobId: application.jobId
        }
      }
    });
  }

  /**
   * Send interview reminder
   */
  private async sendInterviewReminder(reminder: any): Promise<void> {
    const { user } = reminder;

    const interviewSchedule = await prisma.interviewSchedule.findUnique({
      where: { id: reminder.interviewId },
      include: {
        application: {
          include: {
            job: {
              include: {
                company: true
              }
            }
          }
        }
      }
    });

    if (!interviewSchedule) {
      logger.warn('Interview schedule not found', { reminderId: reminder.id });
      return;
    }

    const emailContent = {
      subject: `Interview Reminder: ${interviewSchedule.title}`,
      html: `
        <h2>Upcoming Interview Reminder</h2>
        <p>Hi ${user.firstName},</p>
        <p>This is a reminder about your upcoming interview:</p>
        <ul>
          <li><strong>Interview:</strong> ${interviewSchedule.title}</li>
          <li><strong>Date/Time:</strong> ${new Date(interviewSchedule.scheduledFor).toLocaleString()}</li>
          <li><strong>Duration:</strong> ${interviewSchedule.duration} minutes</li>
          <li><strong>Location:</strong> ${interviewSchedule.location || 'Online'}</li>
          ${interviewSchedule.meetingUrl ? `<li><strong>Meeting Link:</strong> <a href="${interviewSchedule.meetingUrl}">${interviewSchedule.meetingUrl}</a></li>` : ''}
        </ul>
        <p>${reminder.description || 'Good luck with your interview!'}</p>
        <p>Best regards,<br>AI Job Chommie Team</p>
      `
    };

    await emailService.sendEmail(user.email, emailContent.subject, '', emailContent.html);
  }

  /**
   * Send milestone reminder
   */
  private async sendMilestoneReminder(reminder: any): Promise<void> {
    const { user } = reminder;

    const emailContent = {
      subject: `Career Milestone Reminder: ${reminder.title}`,
      html: `
        <h2>Career Milestone Check-in</h2>
        <p>Hi ${user.firstName},</p>
        <p>It's time to check in on your career milestone:</p>
        <h3>${reminder.title}</h3>
        <p>${reminder.description || 'Review your progress and update your milestone status.'}</p>
        <p>Log in to your dashboard to track your progress.</p>
        <p>Best regards,<br>AI Job Chommie Team</p>
      `
    };

    await emailService.sendEmail(user.email, emailContent.subject, '', emailContent.html);
  }

  /**
   * Send reference request reminder
   */
  private async sendReferenceRequestReminder(reminder: any): Promise<void> {
    const { user } = reminder;

    const emailContent = {
      subject: `Reference Request Reminder`,
      html: `
        <h2>Reference Request Follow-up</h2>
        <p>Hi ${user.firstName},</p>
        <p>This is a reminder to follow up on your reference request.</p>
        <p>${reminder.description || 'Consider reaching out to your reference to ensure they received your request.'}</p>
        <p>Best regards,<br>AI Job Chommie Team</p>
      `
    };

    await emailService.sendEmail(user.email, emailContent.subject, '', emailContent.html);
  }

  /**
   * Send custom reminder
   */
  private async sendCustomReminder(reminder: any): Promise<void> {
    const { user } = reminder;

    const emailContent = {
      subject: `Reminder: ${reminder.title}`,
      html: `
        <h2>Personal Reminder</h2>
        <p>Hi ${user.firstName},</p>
        <p>You set a reminder for:</p>
        <h3>${reminder.title}</h3>
        <p>${reminder.description || ''}</p>
        <p>Best regards,<br>AI Job Chommie Team</p>
      `
    };

    await emailService.sendEmail(user.email, emailContent.subject, '', emailContent.html);

    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'REMINDER',
        title: reminder.title,
        message: reminder.description || 'Your scheduled reminder',
        metadata: {
          reminderId: reminder.id
        }
      }
    });
  }

  /**
   * Create next recurring reminder
   */
  private async createNextRecurringReminder(reminder: any): Promise<void> {
    let nextDate: Date;

    switch (reminder.recurrencePattern) {
      case 'daily':
        nextDate = addDays(reminder.scheduledFor, 1);
        break;
      case 'weekly':
        nextDate = addDays(reminder.scheduledFor, 7);
        break;
      case 'monthly':
        nextDate = addDays(reminder.scheduledFor, 30);
        break;
      default:
        logger.warn('Unknown recurrence pattern', { pattern: reminder.recurrencePattern });
        return;
    }

    // Check if within recurrence end date
    if (reminder.recurrenceEndDate && isAfter(nextDate, reminder.recurrenceEndDate)) {
      logger.info('Recurring reminder ended', { reminderId: reminder.id });
      return;
    }

    await prisma.reminder.create({
      data: {
        userId: reminder.userId,
        type: reminder.type,
        title: reminder.title,
        description: reminder.description,
        scheduledFor: nextDate,
        recurring: true,
        recurrencePattern: reminder.recurrencePattern,
        recurrenceEndDate: reminder.recurrenceEndDate,
        applicationId: reminder.applicationId,
        interviewId: reminder.interviewId,
        metadata: reminder.metadata,
        status: 'PENDING'
      }
    });
  }

  /**
   * Schedule reminder for processing
   */
  private async scheduleReminderProcessing(reminderId: string): Promise<void> {
    const key = `reminder:processing:${reminderId}`;
    const ttl = 3600; // 1 hour TTL

    await redis.setex(key, ttl, JSON.stringify({
      reminderId,
      scheduledAt: new Date()
    }));
  }

  /**
   * Check if reminder should be processed today
   */
  private shouldProcessToday(scheduledFor: Date): boolean {
    const today = startOfDay(new Date());
    const reminderDate = startOfDay(scheduledFor);
    return !isAfter(reminderDate, today);
  }

  /**
   * Get smart reminder suggestions for an application
   */
  async getSmartReminderSuggestions(applicationId: string): Promise<any[]> {
    try {
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: {
            include: {
              company: true
            }
          }
        }
      });

      if (!application) {
        return [];
      }

      const suggestions = [];
      const applicationDate = new Date(application.createdAt);

      // Follow-up after 1 week
      suggestions.push({
        type: 'APPLICATION_FOLLOWUP',
        title: `Follow up on ${application.job.title} application`,
        description: `It's been a week since you applied. Consider sending a follow-up email to express continued interest.`,
        suggestedDate: addDays(applicationDate, 7)
      });

      // Follow-up after 2 weeks
      suggestions.push({
        type: 'APPLICATION_FOLLOWUP',
        title: `Second follow-up for ${application.job.title}`,
        description: `Two weeks have passed. If you haven't heard back, a polite follow-up might help.`,
        suggestedDate: addDays(applicationDate, 14)
      });

      // Status check after 1 month
      suggestions.push({
        type: 'APPLICATION_FOLLOWUP',
        title: `Check status of ${application.job.title} application`,
        description: `It's been a month. Consider reaching out for a final status update.`,
        suggestedDate: addDays(applicationDate, 30)
      });

      return suggestions;
    } catch (error) {
      logger.error('Error getting reminder suggestions', { error });
      return [];
    }
  }

  /**
   * Initialize reminder cron jobs
   */
  initializeCronJobs(): void {
    // Process reminders every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.processPendingReminders();
    });

    logger.info('Reminder cron jobs initialized');
  }
}

export const reminderService = new ReminderService();
