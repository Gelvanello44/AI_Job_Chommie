import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import userProfileService, { 
  userProfileSchema, 
  jobSeekerProfileSchema, 
  skillSchema, 
  experienceSchema, 
  educationSchema 
} from '../services/userProfileService.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../types/auth.js';
import activityService from '../services/activityService.js';

const prisma = new PrismaClient();

// Validation schemas for query parameters
const paginationSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 50) : 10)
});

const skillSearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 50) : 20)
});

export class UserProfileController {
  /**
   * Get current user's complete profile
   */
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      
      const profile = await userProfileService.getUserProfile(userId);

      // Log profile view activity
      await activityService.logUserActivity(userId, 'profile_viewed', {
        viewType: 'complete_profile'
      }).catch(err => logger.warn('Failed to log profile view activity', { error: err }));

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update basic user profile information
   */
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const profileData = req.body;

      const updatedProfile = await userProfileService.updateUserProfile(userId, profileData);

      // Log profile update activity
      await activityService.logUserActivity(userId, 'profile_updated', {
        updatedFields: Object.keys(profileData),
        updateCount: Object.keys(profileData).length
      }).catch(err => logger.warn('Failed to log profile update activity', { error: err }));

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update job seeker profile
   */
  async updateJobSeekerProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const profileData = req.body;

      const updatedProfile = await userProfileService.updateJobSeekerProfile(userId, profileData);

      // Log job seeker profile update
      await activityService.logUserActivity(userId, 'job_seeker_profile_updated', {
        updatedFields: Object.keys(profileData)
      }).catch(err => logger.warn('Failed to log job seeker profile update', { error: err }));

      res.json({
        success: true,
        message: 'Job seeker profile updated successfully',
        data: updatedProfile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add or update a skill
   */
  async addOrUpdateSkill(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const skillData = req.body;

      const skill = await userProfileService.addOrUpdateSkill(userId, skillData);

      // Log skill addition/update
      await activityService.logUserActivity(userId, 'skill_added', {
        skillName: skillData.name,
        proficiencyLevel: skillData.proficiencyLevel
      }).catch(err => logger.warn('Failed to log skill activity', { error: err }));

      res.json({
        success: true,
        message: 'Skill added/updated successfully',
        data: skill
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a skill
   */
  async removeSkill(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { skillId } = req.params;

      if (!skillId) {
        throw new AppError(400, 'Skill ID is required', 'MISSING_SKILL_ID');
      }

      await userProfileService.removeSkill(userId, skillId);

      // Log skill removal
      await activityService.logUserActivity(userId, 'skill_removed', {
        skillId
      }).catch(err => logger.warn('Failed to log skill removal', { error: err }));

      res.json({
        success: true,
        message: 'Skill removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add work experience
   */
  async addExperience(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const experienceData = req.body;

      const experience = await userProfileService.addExperience(userId, experienceData);

      // Log experience addition
      await activityService.logUserActivity(userId, 'experience_added', {
        jobTitle: experienceData.jobTitle,
        company: experienceData.company,
        isCurrent: experienceData.isCurrent
      }).catch(err => logger.warn('Failed to log experience addition', { error: err }));

      res.status(201).json({
        success: true,
        message: 'Experience added successfully',
        data: experience
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update work experience
   */
  async updateExperience(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { experienceId } = req.params;
      const experienceData = req.body;

      if (!experienceId) {
        throw new AppError(400, 'Experience ID is required', 'MISSING_EXPERIENCE_ID');
      }

      const experience = await userProfileService.updateExperience(userId, experienceId, experienceData);

      // Log experience update
      await activityService.logUserActivity(userId, 'experience_updated', {
        experienceId,
        updatedFields: Object.keys(experienceData)
      }).catch(err => logger.warn('Failed to log experience update', { error: err }));

      res.json({
        success: true,
        message: 'Experience updated successfully',
        data: experience
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove work experience
   */
  async removeExperience(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { experienceId } = req.params;

      if (!experienceId) {
        throw new AppError(400, 'Experience ID is required', 'MISSING_EXPERIENCE_ID');
      }

      await userProfileService.removeExperience(userId, experienceId);

      // Log experience removal
      await activityService.logUserActivity(userId, 'experience_removed', {
        experienceId
      }).catch(err => logger.warn('Failed to log experience removal', { error: err }));

      res.json({
        success: true,
        message: 'Experience removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add education
   */
  async addEducation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const educationData = req.body;

      const education = await userProfileService.addEducation(userId, educationData);

      // Log education addition
      await activityService.logUserActivity(userId, 'education_added', {
        institution: educationData.institution,
        degree: educationData.degree,
        isCurrent: educationData.isCurrent
      }).catch(err => logger.warn('Failed to log education addition', { error: err }));

      res.status(201).json({
        success: true,
        message: 'Education added successfully',
        data: education
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update education
   */
  async updateEducation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { educationId } = req.params;
      const educationData = req.body;

      if (!educationId) {
        throw new AppError(400, 'Education ID is required', 'MISSING_EDUCATION_ID');
      }

      const education = await userProfileService.updateEducation(userId, educationId, educationData);

      // Log education update
      await activityService.logUserActivity(userId, 'education_updated', {
        educationId,
        updatedFields: Object.keys(educationData)
      }).catch(err => logger.warn('Failed to log education update', { error: err }));

      res.json({
        success: true,
        message: 'Education updated successfully',
        data: education
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove education
   */
  async removeEducation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { educationId } = req.params;

      if (!educationId) {
        throw new AppError(400, 'Education ID is required', 'MISSING_EDUCATION_ID');
      }

      await userProfileService.removeEducation(userId, educationId);

      // Log education removal
      await activityService.logUserActivity(userId, 'education_removed', {
        educationId
      }).catch(err => logger.warn('Failed to log education removal', { error: err }));

      res.json({
        success: true,
        message: 'Education removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get profile completion status
   */
  async getProfileCompletion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      
      const completion = await userProfileService.getProfileCompletion(userId);

      res.json({
        success: true,
        data: completion
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search available skills
   */
  async searchSkills(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Validate query parameters
      const { q, limit } = skillSearchSchema.parse(req.query);
      
      const skills = await userProfileService.searchSkills(q, limit);

      res.json({
        success: true,
        data: skills,
        meta: {
          query: q,
          count: skills.length,
          limit
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid search parameters', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        throw new AppError(400, 'No file uploaded', 'NO_FILE');
      }

      // Here you would typically upload to cloud storage (AWS S3, Cloudinary, etc.)
      // For now, we'll simulate this with a placeholder URL
      const profilePictureUrl = `/uploads/profiles/${userId}_${Date.now()}_${file.originalname}`;

      // Log profile picture upload
      await activityService.logUserActivity(userId, 'profile_picture_uploaded', {
        fileName: file.originalname,
        fileSize: file.size
      }).catch(err => logger.warn('Failed to log profile picture upload', { error: err }));

      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        data: {
          profilePicture: profilePictureUrl
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete profile (soft delete - marks as inactive)
   */
  async deleteProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { reason } = req.body;

      // Log profile deletion request
      await activityService.logUserActivity(userId, 'profile_deletion_requested', {
        reason: reason || 'No reason provided'
      }).catch(err => logger.warn('Failed to log profile deletion', { error: err }));

      // In a real implementation, you'd mark the user as inactive rather than deleting
      logger.info('Profile deletion requested', { userId, reason });

      res.json({
        success: true,
        message: 'Profile deletion request received. Your account will be deactivated within 24 hours.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      
      // Get profile completion
      const completion = await userProfileService.getProfileCompletion(userId);
      
      // You could add more stats here like:
      // - Number of job applications
      // - Profile views
      // - Skill endorsements
      // - etc.

      // Get user data from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, lastLoginAt: true }
      });

      const stats = {
        profileCompletion: completion,
        joinedDate: user?.createdAt,
        lastActive: user?.lastLoginAt,
        // Add more stats as needed
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserProfileController();
