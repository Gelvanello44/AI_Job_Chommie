import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { emailService } from './email.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { format, addDays } from 'date-fns';

/**
 * Reference Management Service
 * Handles professional references, request workflows, and visibility controls
 */
export class ReferenceService {
  /**
   * Create a new reference request
   */
  async createReferenceRequest(
    userId: string,
    data: {
      referenceName: string;
      referenceEmail: string;
      referencePhone?: string;
      company: string;
      position: string;
      relationship: string;
      requestMessage: string;
      jobTitle?: string;
      urgency?: string;
      canContactDirectly?: boolean;
    }
  ): Promise<any> {
    try {
      // Check if reference already exists for this user
      const existingReference = await prisma.referenceRequest.findFirst({
        where: {
          userId,
          referenceEmail: data.referenceEmail,
          status: { not: 'declined' }
        }
      });

      if (existingReference) {
        throw new AppError(400, 'A reference request already exists for this person');
      }

      // Create the reference request
      const referenceRequest = await prisma.referenceRequest.create({
        data: {
          userId,
          referenceName: data.referenceName,
          referenceEmail: data.referenceEmail,
          referencePhone: data.referencePhone,
          company: data.company,
          position: data.position,
          relationship: data.relationship,
          requestMessage: data.requestMessage,
          jobTitle: data.jobTitle,
          urgency: data.urgency || 'normal',
          canContactDirectly: data.canContactDirectly || false
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      logger.info('Reference request created', { 
        userId, 
        referenceId: referenceRequest.id,
        referenceEmail: data.referenceEmail 
      });

      return referenceRequest;
    } catch (error) {
      logger.error('Error creating reference request', { error, userId });
      throw error;
    }
  }

  /**
   * Send reference request email
   */
  async sendReferenceRequest(referenceRequestId: string): Promise<void> {
    try {
      const referenceRequest = await prisma.referenceRequest.findUnique({
        where: { id: referenceRequestId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          }
        }
      });

      if (!referenceRequest) {
        throw new AppError(404, 'Reference request not found');
      }

      if (referenceRequest.status !== 'pending') {
        throw new AppError(400, 'Reference request has already been sent');
      }

      // Create a unique response link
      const responseToken = Buffer.from(
        `${referenceRequestId}:${Date.now()}`
      ).toString('base64');

      const responseLink = `${process.env.FRONTEND_URL}/reference/respond/${responseToken}`;

      // Prepare email content
      const emailContent = `
        <h2>Reference Request from ${referenceRequest.user.firstName} ${referenceRequest.user.lastName}</h2>
        
        <p>Dear ${referenceRequest.referenceName},</p>
        
        <p>${referenceRequest.user.firstName} ${referenceRequest.user.lastName} has requested you to provide a professional reference.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Applicant:</strong> ${referenceRequest.user.firstName} ${referenceRequest.user.lastName}</p>
          <p><strong>Your Relationship:</strong> ${referenceRequest.relationship}</p>
          <p><strong>Your Role:</strong> ${referenceRequest.position} at ${referenceRequest.company}</p>
          ${referenceRequest.jobTitle ? `<p><strong>Applied Position:</strong> ${referenceRequest.jobTitle}</p>` : ''}
          <p><strong>Urgency:</strong> ${referenceRequest.urgency === 'urgent' ? 'Urgent - Response needed within 48 hours' : 'Normal - Response needed within 7 days'}</p>
        </div>
        
        <p><strong>Message from ${referenceRequest.user.firstName}:</strong></p>
        <p style="font-style: italic; background-color: #f9f9f9; padding: 10px; border-left: 3px solid #007bff;">
          ${referenceRequest.requestMessage}
        </p>
        
        <div style="margin: 30px 0;">
          <a href="${responseLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Provide Reference
          </a>
        </div>
        
        <p>If you're unable to provide a reference at this time, please click the link above to decline the request.</p>
        
        <p>Thank you for your time and consideration.</p>
        
        <hr style="margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          This reference request was sent through AI Job Chommie. 
          ${referenceRequest.canContactDirectly ? 
            `You may also contact ${referenceRequest.user.firstName} directly at ${referenceRequest.user.email}${referenceRequest.user.phone ? ` or ${referenceRequest.user.phone}` : ''}.` : 
            'Please use the provided link to submit your reference.'}
        </p>
      `;

      // Send the email
      await emailService.sendEmail({
        to: referenceRequest.referenceEmail,
        subject: `Reference Request from ${referenceRequest.user.firstName} ${referenceRequest.user.lastName}`,
        html: emailContent
      });

      // Update the status
      await prisma.referenceRequest.update({
        where: { id: referenceRequestId },
        data: {
          status: 'sent',
          requestSentAt: new Date()
        }
      });

      logger.info('Reference request sent', { 
        referenceRequestId,
        referenceEmail: referenceRequest.referenceEmail 
      });
    } catch (error) {
      logger.error('Error sending reference request', { error, referenceRequestId });
      throw error;
    }
  }

  /**
   * Get all reference requests for a user
   */
  async getUserReferences(
    userId: string,
    filters?: {
      status?: string;
      isVisible?: boolean;
    }
  ): Promise<any[]> {
    try {
      const where: any = { userId };

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.isVisible !== undefined) {
        where.isVisible = filters.isVisible;
      }

      const references = await prisma.referenceRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return references;
    } catch (error) {
      logger.error('Error getting user references', { error, userId });
      throw error;
    }
  }

  /**
   * Get a single reference request
   */
  async getReferenceRequest(
    referenceRequestId: string,
    userId?: string
  ): Promise<any> {
    try {
      const where: any = { id: referenceRequestId };
      
      if (userId) {
        where.userId = userId;
      }

      const referenceRequest = await prisma.referenceRequest.findUnique({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      if (!referenceRequest) {
        throw new AppError(404, 'Reference request not found');
      }

      return referenceRequest;
    } catch (error) {
      logger.error('Error getting reference request', { error, referenceRequestId });
      throw error;
    }
  }

  /**
   * Update reference request
   */
  async updateReferenceRequest(
    referenceRequestId: string,
    userId: string,
    updates: {
      requestMessage?: string;
      urgency?: string;
      isVisible?: boolean;
      canContactDirectly?: boolean;
    }
  ): Promise<any> {
    try {
      // Verify ownership
      const existingRequest = await prisma.referenceRequest.findFirst({
        where: {
          id: referenceRequestId,
          userId
        }
      });

      if (!existingRequest) {
        throw new AppError(404, 'Reference request not found');
      }

      if (existingRequest.status === 'responded') {
        throw new AppError(400, 'Cannot update a reference that has already been responded to');
      }

      const updatedRequest = await prisma.referenceRequest.update({
        where: { id: referenceRequestId },
        data: updates
      });

      logger.info('Reference request updated', { 
        referenceRequestId,
        userId,
        updates 
      });

      return updatedRequest;
    } catch (error) {
      logger.error('Error updating reference request', { error, referenceRequestId });
      throw error;
    }
  }

  /**
   * Submit reference response
   */
  async submitReferenceResponse(
    token: string,
    response: string
  ): Promise<void> {
    try {
      // Decode token to get reference request ID
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [referenceRequestId] = decoded.split(':');

      const referenceRequest = await prisma.referenceRequest.findUnique({
        where: { id: referenceRequestId }
      });

      if (!referenceRequest) {
        throw new AppError(404, 'Invalid reference request');
      }

      if (referenceRequest.status === 'responded') {
        throw new AppError(400, 'Reference has already been submitted');
      }

      // Update the reference request
      await prisma.referenceRequest.update({
        where: { id: referenceRequestId },
        data: {
          status: 'responded',
          response,
          responseReceivedAt: new Date()
        }
      });

      // Notify the user
      const user = await prisma.user.findUnique({
        where: { id: referenceRequest.userId }
      });

      if (user) {
        await emailService.sendEmail({
          to: user.email,
          subject: `Reference Received from ${referenceRequest.referenceName}`,
          html: `
            <h2>Great news! Your reference has been received</h2>
            <p>${referenceRequest.referenceName} from ${referenceRequest.company} has submitted their reference for you.</p>
            <p>You can view the reference in your dashboard.</p>
          `
        });
      }

      logger.info('Reference response submitted', { 
        referenceRequestId,
        referenceName: referenceRequest.referenceName 
      });
    } catch (error) {
      logger.error('Error submitting reference response', { error, token });
      throw error;
    }
  }

  /**
   * Decline reference request
   */
  async declineReferenceRequest(
    token: string,
    reason?: string
  ): Promise<void> {
    try {
      // Decode token to get reference request ID
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [referenceRequestId] = decoded.split(':');

      const referenceRequest = await prisma.referenceRequest.findUnique({
        where: { id: referenceRequestId }
      });

      if (!referenceRequest) {
        throw new AppError(404, 'Invalid reference request');
      }

      if (referenceRequest.status !== 'sent') {
        throw new AppError(400, 'Cannot decline this reference request');
      }

      // Update the reference request
      await prisma.referenceRequest.update({
        where: { id: referenceRequestId },
        data: {
          status: 'declined',
          response: reason || 'Reference declined',
          responseReceivedAt: new Date()
        }
      });

      // Notify the user
      const user = await prisma.user.findUnique({
        where: { id: referenceRequest.userId }
      });

      if (user) {
        await emailService.sendEmail({
          to: user.email,
          subject: `Reference Request Declined by ${referenceRequest.referenceName}`,
          html: `
            <h2>Reference Request Update</h2>
            <p>${referenceRequest.referenceName} from ${referenceRequest.company} has declined to provide a reference at this time.</p>
            ${reason ? `<p>Reason: ${reason}</p>` : ''}
            <p>You may want to reach out to another reference.</p>
          `
        });
      }

      logger.info('Reference request declined', { 
        referenceRequestId,
        referenceName: referenceRequest.referenceName 
      });
    } catch (error) {
      logger.error('Error declining reference request', { error, token });
      throw error;
    }
  }

  /**
   * Send reminder for pending reference
   */
  async sendReferenceReminder(
    referenceRequestId: string,
    userId: string
  ): Promise<void> {
    try {
      const referenceRequest = await prisma.referenceRequest.findFirst({
        where: {
          id: referenceRequestId,
          userId,
          status: 'sent'
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (!referenceRequest) {
        throw new AppError(404, 'Reference request not found or already completed');
      }

      // Check if a reminder was sent recently (within 48 hours)
      if (referenceRequest.lastReminderSent) {
        const hoursSinceLastReminder = 
          (Date.now() - referenceRequest.lastReminderSent.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastReminder < 48) {
          throw new AppError(400, 'A reminder was sent recently. Please wait 48 hours before sending another.');
        }
      }

      // Create reminder token
      const responseToken = Buffer.from(
        `${referenceRequestId}:${Date.now()}`
      ).toString('base64');

      const responseLink = `${process.env.FRONTEND_URL}/reference/respond/${responseToken}`;

      // Send reminder email
      await emailService.sendEmail({
        to: referenceRequest.referenceEmail,
        subject: `Reminder: Reference Request from ${referenceRequest.user.firstName} ${referenceRequest.user.lastName}`,
        html: `
          <h2>Reminder: Reference Request</h2>
          
          <p>Dear ${referenceRequest.referenceName},</p>
          
          <p>This is a friendly reminder that ${referenceRequest.user.firstName} ${referenceRequest.user.lastName} is waiting for your professional reference.</p>
          
          <p>The request was originally sent on ${format(referenceRequest.requestSentAt || new Date(), 'MMMM d, yyyy')}.</p>
          
          <div style="margin: 30px 0;">
            <a href="${responseLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Provide Reference Now
            </a>
          </div>
          
          <p>If you're unable to provide a reference, please click the link above to decline the request.</p>
          
          <p>Thank you for your time.</p>
        `
      });

      // Update last reminder sent
      await prisma.referenceRequest.update({
        where: { id: referenceRequestId },
        data: {
          lastReminderSent: new Date()
        }
      });

      logger.info('Reference reminder sent', { 
        referenceRequestId,
        referenceEmail: referenceRequest.referenceEmail 
      });
    } catch (error) {
      logger.error('Error sending reference reminder', { error, referenceRequestId });
      throw error;
    }
  }

  /**
   * Delete reference request
   */
  async deleteReferenceRequest(
    referenceRequestId: string,
    userId: string
  ): Promise<void> {
    try {
      const referenceRequest = await prisma.referenceRequest.findFirst({
        where: {
          id: referenceRequestId,
          userId
        }
      });

      if (!referenceRequest) {
        throw new AppError(404, 'Reference request not found');
      }

      await prisma.referenceRequest.delete({
        where: { id: referenceRequestId }
      });

      logger.info('Reference request deleted', { 
        referenceRequestId,
        userId 
      });
    } catch (error) {
      logger.error('Error deleting reference request', { error, referenceRequestId });
      throw error;
    }
  }

  /**
   * Update reference visibility
   */
  async updateReferenceVisibility(
    referenceRequestId: string,
    userId: string,
    isVisible: boolean
  ): Promise<void> {
    try {
      const referenceRequest = await prisma.referenceRequest.findFirst({
        where: {
          id: referenceRequestId,
          userId
        }
      });

      if (!referenceRequest) {
        throw new AppError(404, 'Reference request not found');
      }

      await prisma.referenceRequest.update({
        where: { id: referenceRequestId },
        data: { isVisible }
      });

      logger.info('Reference visibility updated', { 
        referenceRequestId,
        userId,
        isVisible 
      });
    } catch (error) {
      logger.error('Error updating reference visibility', { error, referenceRequestId });
      throw error;
    }
  }

  /**
   * Get reference statistics for a user
   */
  async getReferenceStatistics(userId: string): Promise<any> {
    try {
      const [total, pending, sent, responded, declined] = await Promise.all([
        prisma.referenceRequest.count({ where: { userId } }),
        prisma.referenceRequest.count({ where: { userId, status: 'pending' } }),
        prisma.referenceRequest.count({ where: { userId, status: 'sent' } }),
        prisma.referenceRequest.count({ where: { userId, status: 'responded' } }),
        prisma.referenceRequest.count({ where: { userId, status: 'declined' } })
      ]);

      return {
        total,
        pending,
        sent,
        responded,
        declined,
        responseRate: total > 0 ? ((responded / total) * 100).toFixed(1) : 0
      };
    } catch (error) {
      logger.error('Error getting reference statistics', { error, userId });
      throw error;
    }
  }
}

export const referenceService = new ReferenceService();
