import { PrismaClient, ApplicationStatus } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import logger from '../config/logger.js';

interface ApplicationData {
  jobId: string;
  cvId?: string;
  coverLetter?: string;
}

interface ApplicationNote {
  text: string;
}

interface ApplicationUpdate {
  status?: ApplicationStatus;
  notes?: string;
  interviewDate?: Date;
  followUpDate?: Date;
}

export class ApplicationTrackingService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createApplication(userId: string, data: ApplicationData) {
    try {
      // Verify job exists
      const job = await this.prisma.job.findUnique({
        where: { id: data.jobId },
        include: { company: true }
      });

      if (!job) {
        throw new AppError('Job not found', 404);
      }

      // Check if application already exists
      const existingApplication = await this.prisma.application.findFirst({
        where: {
          jobId: data.jobId,
          userId
        }
      });

      if (existingApplication) {
        throw new AppError('Application already exists for this job', 409);
      }

      // Create application
      const application = await this.prisma.application.create({
        data: {
          userId,
          jobId: data.jobId,
          cvId: data.cvId,
          coverLetter: data.coverLetter,
          status: ApplicationStatus.PENDING
        },
        include: {
          job: {
            include: { company: true }
          },
          cv: true
        }
      });

      // Log activity
      await this.prisma.userActivity.create({
        data: {
          userId,
          action: 'job_apply',
          entityType: 'application',
          entityId: application.id,
          metadata: {
            jobTitle: job.title,
            companyName: job.company.name
          }
        }
      });

      return application;

    } catch (error) {
      logger.error('Error creating application', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to create application', 500);
    }
  }

  async getUserApplications(userId: string, status?: ApplicationStatus) {
    try {
      const whereClause: any = { userId };
      if (status) {
        whereClause.status = status;
      }

      const applications = await this.prisma.application.findMany({
        where: whereClause,
        include: {
          job: {
            include: { company: true }
          },
          cv: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return {
        applications: applications.map(app => ({
          id: app.id,
          jobId: app.jobId,
          jobTitle: app.job.title,
          companyName: app.job.company.name,
          status: app.status,
          appliedAt: app.createdAt,
          viewedAt: app.viewedAt,
          interviewDate: app.interviewDate,
          cvName: app.cv?.name,
          hasNotes: !!app.internalNotes
        }))
      };
    } catch (error) {
      logger.error('Error fetching user applications', { error: error instanceof Error ? error.message : String(error), userId });
      throw new AppError('Failed to fetch applications', 500);
    }
  }

  async getApplicationsByStatus(userId: string) {
    try {
      const applications = await this.prisma.application.findMany({
        where: { userId },
        include: {
          job: {
            include: { company: true }
          }
        }
      });

      // Group by status for Kanban view
      const grouped: Record<string, any[]> = {
        pending: [],
        applied: [],
        interview: [],
        offer: [],
        hired: [],
        rejected: []
      };

      applications.forEach(app => {
        const statusKey = app.status.toLowerCase() as keyof typeof grouped;
        if (grouped[statusKey]) {
          grouped[statusKey].push({
            id: app.id,
            jobTitle: app.job.title,
            companyName: app.job.company.name,
            appliedAt: app.createdAt,
            interviewDate: app.interviewDate,
            notes: app.internalNotes
          });
        }
      });

      return { kanban: grouped };
    } catch (error) {
      logger.error('Error fetching applications by status', { error: error instanceof Error ? error.message : String(error), userId });
      throw new AppError('Failed to fetch applications by status', 500);
    }
  }

  async getApplicationDetails(userId: string, applicationId: string) {
    try {
      const application = await this.prisma.application.findFirst({
        where: {
          id: applicationId,
          userId
        },
        include: {
          job: {
            include: { company: true }
          },
          cv: true,
          interviewSchedules: {
            orderBy: { scheduledFor: 'asc' }
          }
        }
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      return application;
    } catch (error) {
      logger.error('Error fetching application details', { error: error instanceof Error ? error.message : String(error), userId, applicationId });
      throw error instanceof AppError ? error : new AppError('Failed to fetch application details', 500);
    }
  }

  async updateApplicationStatus(userId: string, applicationId: string, data: ApplicationUpdate) {
    try {
      const application = await this.prisma.application.findFirst({
        where: {
          id: applicationId,
          userId
        }
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      const updateData: any = { updatedAt: new Date() };

      if (data.status) {
        updateData.status = data.status;
        
        // Set additional fields based on status
        if (data.status === ApplicationStatus.INTERVIEW) {
          updateData.reviewedAt = new Date();
          if (data.interviewDate) {
            updateData.interviewDate = data.interviewDate;
          }
        }
      }

      if (data.notes) {
        updateData.internalNotes = data.notes;
      }

      const updated = await this.prisma.application.update({
        where: { id: applicationId },
        data: updateData,
        include: {
          job: {
            include: { company: true }
          }
        }
      });

      // Log status change
      if (data.status) {
        await this.prisma.userActivity.create({
          data: {
            userId,
            action: 'application_status_change',
            entityType: 'application',
            entityId: applicationId,
            metadata: {
              oldStatus: application.status,
              newStatus: data.status,
              jobTitle: updated.job.title
            }
          }
        });
      }

      return updated;
    } catch (error) {
      logger.error('Error updating application status', { error: error instanceof Error ? error.message : String(error), userId, applicationId });
      throw error instanceof AppError ? error : new AppError('Failed to update application status', 500);
    }
  }

  async addApplicationNote(userId: string, applicationId: string, note: ApplicationNote) {
    try {
      const application = await this.prisma.application.findFirst({
        where: {
          id: applicationId,
          userId
        }
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      const existingNotes = application.internalNotes || '';
      const timestamp = new Date().toISOString();
      const newNote = `[${timestamp}] ${note.text}`;
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${newNote}` 
        : newNote;

      await this.prisma.application.update({
        where: { id: applicationId },
        data: { 
          internalNotes: updatedNotes,
          updatedAt: new Date()
        }
      });

      return { success: true, notes: updatedNotes };
    } catch (error) {
      logger.error('Error adding application note', { error: error instanceof Error ? error.message : String(error), userId, applicationId });
      throw error instanceof AppError ? error : new AppError('Failed to add application note', 500);
    }
  }

  async getApplicationTimeline(userId: string, applicationId: string) {
    try {
      const application = await this.prisma.application.findFirst({
        where: {
          id: applicationId,
          userId
        }
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      // Get related activities
      const activities = await this.prisma.userActivity.findMany({
        where: {
          userId,
          OR: [
            { entityId: applicationId },
            { 
              action: { in: ['job_view', 'job_save'] },
              entityId: application.jobId 
            }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      const timeline = [
        {
          date: application.createdAt,
          event: 'Application Submitted',
          type: 'application',
          description: 'You applied for this position'
        }
      ];

      if (application.viewedAt) {
        timeline.push({
          date: application.viewedAt,
          event: 'Application Viewed',
          type: 'employer_action',
          description: 'Employer viewed your application'
        });
      }

      if (application.reviewedAt) {
        timeline.push({
          date: application.reviewedAt,
          event: 'Application Reviewed',
          type: 'employer_action',
          description: 'Employer reviewed your application'
        });
      }

      if (application.interviewDate) {
        timeline.push({
          date: application.interviewDate,
          event: 'Interview Scheduled',
          type: 'interview',
          description: 'Interview scheduled'
        });
      }

      // Add activities to timeline
      activities.forEach(activity => {
        if (activity.action === 'application_status_change') {
          timeline.push({
            date: activity.createdAt,
            event: `Status Changed`,
            type: 'status_change',
            description: `Status changed from ${(activity.metadata as any)?.oldStatus || 'unknown'} to ${(activity.metadata as any)?.newStatus || 'unknown'}`
          });
        }
      });

      // Sort timeline by date
      timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return { timeline };
    } catch (error) {
      logger.error('Error fetching application timeline', { error: error instanceof Error ? error.message : String(error), userId, applicationId });
      throw error instanceof AppError ? error : new AppError('Failed to fetch application timeline', 500);
    }
  }

  async getApplicationStatistics(userId: string) {
    try {
      const applications = await this.prisma.application.findMany({
        where: { userId },
        select: {
          status: true,
          createdAt: true,
          viewedAt: true,
          interviewDate: true
        }
      });

      const total = applications.length;
      const statusCounts = {
        pending: 0,
        applied: 0,
        interview: 0,
        offer: 0,
        hired: 0,
        rejected: 0
      };

      applications.forEach(app => {
        const status = app.status.toLowerCase() as keyof typeof statusCounts;
        if (statusCounts[status] !== undefined) {
          statusCounts[status]++;
        }
      });

      const responseRate = total > 0 
        ? ((applications.filter(app => app.viewedAt).length / total) * 100).toFixed(1)
        : '0';

      const interviewRate = total > 0 
        ? ((statusCounts.interview / total) * 100).toFixed(1)
        : '0';

      return {
        total,
        statusCounts,
        rates: {
          response: parseFloat(responseRate),
          interview: parseFloat(interviewRate)
        }
      };
    } catch (error) {
      logger.error('Error fetching application statistics', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to fetch application statistics', 500);
    }
  }

  async deleteApplication(userId: string, applicationId: string) {
    try {
      const application = await this.prisma.application.findFirst({
        where: {
          id: applicationId,
          userId
        }
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      await this.prisma.application.delete({
        where: { id: applicationId }
      });

      return { success: true };
    } catch (error) {
      logger.error('Error deleting application', { error: error instanceof Error ? error.message : String(error), userId, applicationId });
      throw error instanceof AppError ? error : new AppError('Failed to delete application', 500);
    }
  }
}

export default new ApplicationTrackingService();
