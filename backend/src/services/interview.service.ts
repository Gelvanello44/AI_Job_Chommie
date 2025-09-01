import { PrismaClient, SubscriptionPlan, InterviewStatus } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { canAccessFeature } from '../utils/subscriptionQuotas.js';
import logger from '../config/logger.js';

interface InterviewScheduleData {
  applicationId: string;
  interviewType: 'phone' | 'video' | 'in_person';
  scheduledFor: Date;
  duration: number; // minutes
  location?: string;
  meetingLink?: string;
  notes?: string;
  interviewerName?: string;
  interviewerEmail?: string;
  timezone: string;
}


interface AvailabilitySlot {
  start: Date;
  end: Date;
  timezone: string;
}

interface InterviewPreparationData {
  applicationId: string;
  companyResearch: string[];
  interviewQuestions: string[];
  preparationTasks: string[];
  documents: string[];
  tips: string[];
}

export class InterviewService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async scheduleInterview(userId: string, data: InterviewScheduleData) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'interviewScheduling', SubscriptionPlan.PROFESSIONAL)) {
        throw new AppError('Interview scheduling requires Professional plan or higher', 403);
      }

      // Verify application ownership
      const application = await this.prisma.application.findFirst({
        where: { 
          id: data.applicationId,
          userId 
        },
        include: {
          job: {
            include: { company: true }
          }
        }
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      // Create interview schedule
      const interview = await this.prisma.interviewSchedule.create({
        data: {
          applicationId: data.applicationId,
          userId,
          title: `Interview for ${application.job.title}`,
          scheduledFor: data.scheduledFor,
          duration: data.duration,
          location: data.location,
          timezone: data.timezone,
          status: InterviewStatus.SCHEDULED,
          description: `${data.interviewType} interview with ${data.interviewerName || 'hiring team'}`
        }
      });

      // Generate preparation materials
      const preparation = await this.generateInterviewPreparation(data.applicationId);

      // Send calendar invite (if calendar integration is set up)
      await this.sendCalendarInvite(userId, interview, application);

      // Schedule reminder notifications
      await this.scheduleReminders(interview);

      return {
        interview,
        preparation,
        message: 'Interview scheduled successfully'
      };

    } catch (error) {
      logger.error('Error scheduling interview', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to schedule interview', 500);
    }
  }

  async getUserInterviews(userId: string) {
    try {
      const interviews = await this.prisma.interviewSchedule.findMany({
        where: { userId },
        include: {
          application: {
            include: {
              job: {
                include: { company: true }
              }
            }
          }
        },
        orderBy: { scheduledFor: 'asc' }
      });

      return {
        interviews: interviews.map(interview => ({
          id: interview.id,
          jobTitle: interview.application.job.title,
          companyName: interview.application.job.company.name,
          title: interview.title,
          scheduledFor: interview.scheduledFor,
          duration: interview.duration,
          status: interview.status,
          location: interview.location,
          description: interview.description
        }))
      };
    } catch (error) {
      logger.error('Error fetching user interviews', { error: error instanceof Error ? error.message : String(error), userId });
      throw new AppError('Failed to fetch interviews', 500);
    }
  }

  async updateInterviewStatus(userId: string, interviewId: string, status: InterviewStatus, notes?: string) {
    try {
      const interview = await this.prisma.interviewSchedule.findFirst({
        where: { 
          id: interviewId,
          userId 
        }
      });

      if (!interview) {
        throw new AppError('Interview not found', 404);
      }

      const updated = await this.prisma.interviewSchedule.update({
        where: { id: interviewId },
        data: { 
          status,
          description: notes ? `${interview.description || ''} - ${notes}` : interview.description,
          updatedAt: new Date()
        }
      });

      // Update application status if interview is completed
      if (status === InterviewStatus.COMPLETED) {
        await this.prisma.application.update({
          where: { id: interview.applicationId },
          data: { 
            status: 'INTERVIEW',
            interviewDate: interview.scheduledFor
          }
        });
      }

      return updated;
    } catch (error) {
      logger.error('Error updating interview status', { error: error instanceof Error ? error.message : String(error), userId, interviewId });
      throw error instanceof AppError ? error : new AppError('Failed to update interview status', 500);
    }
  }

  async rescheduleInterview(userId: string, interviewId: string, newDateTime: Date, notes?: string) {
    try {
      const interview = await this.prisma.interviewSchedule.findFirst({
        where: { 
          id: interviewId,
          userId 
        },
        include: {
          application: {
            include: {
              job: { include: { company: true } }
            }
          }
        }
      });

      if (!interview) {
        throw new AppError('Interview not found', 404);
      }

      const updated = await this.prisma.interviewSchedule.update({
        where: { id: interviewId },
        data: {
          scheduledFor: newDateTime,
          status: InterviewStatus.RESCHEDULED,
          description: notes ? `${interview.description || ''}\n\nRescheduled: ${notes}` : interview.description,
          updatedAt: new Date()
        }
      });

      // Send updated calendar invite
      await this.sendCalendarInvite(userId, updated, interview.application);

      // Cancel old reminders and schedule new ones
      await this.scheduleReminders(updated);

      return updated;
    } catch (error) {
      logger.error('Error rescheduling interview', { error: error instanceof Error ? error.message : String(error), userId, interviewId });
      throw error instanceof AppError ? error : new AppError('Failed to reschedule interview', 500);
    }
  }

  async generateInterviewPreparation(applicationId: string): Promise<InterviewPreparationData> {
    try {
      const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          user: {
            select: {
              experiences: true,
              skills: { include: { skill: true } }
            }
          },
          job: {
            include: { company: true }
          }
        }
      });

      if (!application) {
        throw new AppError('Application not found', 404);
      }

      const company = application.job.company;
      const job = application.job;

      // Generate company research points
      const companyResearch = [
        `${company.name} is in the ${company.industry} industry`,
        `Company size: ${company.size || 'Not specified'}`,
        `Founded: ${company.founded || 'Not specified'}`,
        `Location: ${company.city}, ${company.province}`,
        `Website: ${company.website || 'Not available'}`
      ];

      // Generate common interview questions
      const interviewQuestions = this.generateInterviewQuestions(job.title, company.industry);

      // Generate preparation tasks
      const preparationTasks = [
        'Review your CV and be ready to discuss each experience',
        'Research recent company news and developments',
        'Prepare specific examples of your achievements using the STAR method',
        'Prepare thoughtful questions to ask the interviewer',
        'Practice your elevator pitch',
        'Review the job description and match your skills to requirements',
        'Test your technology (for video interviews)'
      ];

      // Documents to prepare
      const documents = [
        'Updated CV/Resume',
        'Copy of the job description',
        'List of references',
        'Portfolio/work samples (if applicable)',
        'Certificates and qualifications',
        'Questions to ask the interviewer'
      ];

      // Generate interview tips
      const tips = [
        'Arrive 5-10 minutes early (or join the video call early)',
        'Dress professionally and appropriately for the company culture',
        'Maintain good eye contact and confident body language',
        'Listen actively and ask clarifying questions if needed',
        'Be specific with examples and quantify your achievements',
        'Show enthusiasm for the role and company',
        'Follow up with a thank-you email within 24 hours'
      ];

      const preparation: InterviewPreparationData = {
        applicationId,
        companyResearch,
        interviewQuestions,
        preparationTasks,
        documents,
        tips
      };

      return preparation;

    } catch (error) {
      logger.error('Error generating interview preparation', { error: error instanceof Error ? error.message : String(error), applicationId });
      throw error instanceof AppError ? error : new AppError('Failed to generate interview preparation', 500);
    }
  }

  async setUserAvailability(userId: string, availability: AvailabilitySlot[]) {
    try {
      // In a full implementation, this would store user availability preferences
      // For now, we'll just validate the data structure
      
      const validatedAvailability = availability.map(slot => {
        if (!slot.start || !slot.end || !slot.timezone) {
          throw new AppError('Invalid availability slot format', 400);
        }
        
        if (slot.start >= slot.end) {
          throw new AppError('Availability slot end time must be after start time', 400);
        }

        return {
          start: new Date(slot.start),
          end: new Date(slot.end),
          timezone: slot.timezone
        };
      });

      // Store in user activity log for now
      await this.prisma.userActivity.create({
        data: {
          userId,
          action: 'set_availability',
          entityType: 'availability',
          metadata: { slots: validatedAvailability }
        }
      });

      return {
        success: true,
        message: 'Availability updated successfully',
        slots: validatedAvailability.length
      };

    } catch (error) {
      logger.error('Error setting user availability', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to set availability', 500);
    }
  }

  async getUpcomingInterviews(userId: string, days: number = 7) {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const interviews = await this.prisma.interviewSchedule.findMany({
        where: {
          userId,
          scheduledFor: {
            gte: startDate,
            lte: endDate
          },
          status: {
            in: [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED]
          }
        },
        include: {
          application: {
            include: {
              job: {
                include: { company: true }
              }
            }
          }
        },
        orderBy: { scheduledFor: 'asc' }
      });

      return {
        interviews: interviews.map(interview => ({
          id: interview.id,
          jobTitle: interview.application.job.title,
          companyName: interview.application.job.company.name,
          scheduledFor: interview.scheduledFor,
          title: interview.title,
          duration: interview.duration,
          daysUntil: Math.ceil((interview.scheduledFor.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }))
      };
    } catch (error) {
      logger.error('Error fetching upcoming interviews', { error: error instanceof Error ? error.message : String(error), userId });
      throw new AppError('Failed to fetch upcoming interviews', 500);
    }
  }

  private generateInterviewQuestions(jobTitle: string, industry: string): string[] {
    const commonQuestions = [
      'Tell me about yourself',
      'Why are you interested in this position?',
      'What are your greatest strengths?',
      'What is your biggest weakness?',
      'Where do you see yourself in 5 years?',
      'Why are you leaving your current job?',
      'Describe a challenging situation you faced at work and how you handled it',
      'What motivates you?',
      'Do you have any questions for us?'
    ];

    const industryQuestions: { [key: string]: string[] } = {
      'Technology': [
        'Describe a technical problem you solved recently',
        'How do you stay updated with new technologies?',
        'Explain a complex technical concept to a non-technical person'
      ],
      'Finance': [
        'How do you handle working under pressure with tight deadlines?',
        'Describe your experience with financial analysis',
        'How do you ensure accuracy in your work?'
      ],
      'Healthcare': [
        'How do you handle difficult patients or situations?',
        'Describe your experience working in a team environment',
        'How do you stay current with medical/healthcare developments?'
      ]
    };

    const roleQuestions: { [key: string]: string[] } = {
      'Manager': [
        'Describe your leadership style',
        'How do you handle conflict within your team?',
        'Tell me about a time you had to make a difficult decision'
      ],
      'Sales': [
        'Describe your sales process',
        'How do you handle rejection?',
        'Tell me about your biggest sales success'
      ]
    };

    let questions = [...commonQuestions];

    // Add industry-specific questions
    if (industryQuestions[industry]) {
      questions = questions.concat(industryQuestions[industry]);
    }

    // Add role-specific questions
    Object.keys(roleQuestions).forEach(role => {
      if (jobTitle.toLowerCase().includes(role.toLowerCase())) {
        questions = questions.concat(roleQuestions[role]);
      }
    });

    return questions;
  }

  private async sendCalendarInvite(userId: string, interview: any, application: any) {
    try {
      // In production, integrate with Google Calendar, Outlook, etc.
      // This is a placeholder for calendar integration
      logger.info('Sending calendar invite', {
        userId,
        interviewId: interview.id,
        scheduledFor: interview.scheduledFor
      });

      // Create calendar event data structure
      const calendarEvent = {
        title: `Interview: ${application.job.title} at ${application.job.company.name}`,
        start: interview.scheduledFor,
        end: new Date(interview.scheduledFor.getTime() + interview.duration * 60000),
        description: `Interview for ${application.job.title} position\n\nCompany: ${application.job.company.name}\nLocation: ${interview.location || 'N/A'}`,
        attendees: [
          { email: application.user?.email }
        ].filter(attendee => attendee.email)
      };

      // In production, this would create the actual calendar event
      return calendarEvent;

    } catch (error) {
      logger.error('Error sending calendar invite', { error: error instanceof Error ? error.message : String(error), userId });
      // Don't throw error as this is a non-critical feature
      return null;
    }
  }

  private async scheduleReminders(interview: any) {
    try {
      // Schedule reminder notifications
      const reminderTimes = [
        { hours: 24, message: '24 hour reminder' },
        { hours: 2, message: '2 hour reminder' },
        { hours: 0.25, message: '15 minute reminder' }
      ];

      for (const reminder of reminderTimes) {
        const reminderTime = new Date(interview.scheduledFor.getTime() - reminder.hours * 60 * 60 * 1000);
        
        if (reminderTime > new Date()) {
          // In production, schedule actual notifications/emails
          logger.info('Scheduling reminder', {
            interviewId: interview.id,
            reminderTime,
            message: reminder.message
          });
        }
      }

    } catch (error) {
      logger.error('Error scheduling reminders', { error: error instanceof Error ? error.message : String(error), interviewId: interview.id });
      // Don't throw error as this is a non-critical feature
    }
  }
}

export default new InterviewService();
