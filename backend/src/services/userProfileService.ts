import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

// Validation schemas
export const jobSeekerProfileSchema = z.object({
  currentJobTitle: z.string().min(1).max(100).optional(),
  yearsOfExperience: z.number().min(0).max(60).optional(),
  expectedSalaryMin: z.number().min(0).optional(),
  expectedSalaryMax: z.number().min(0).optional(),
  noticePeriod: z.number().min(0).max(365).optional(), // days
  availableFrom: z.string().datetime().optional(),
  willingToRelocate: z.boolean().optional(),
  preferredLocations: z.array(z.string()).max(10).optional(),
  preferredJobTypes: z.array(z.enum([
    'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'REMOTE'
  ])).max(6).optional(),
  preferredIndustries: z.array(z.string()).max(10).optional(),
  beeStatus: z.string().max(50).optional(),
  disability: z.boolean().optional()
});

export const userProfileSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().regex(/^(?:\+27|0)[1-9]\d{8}$/).optional(),
  dateOfBirth: z.string().datetime().optional(),
  nationality: z.string().length(2).default('ZA'),
  idNumber: z.string().regex(/^\d{13}$/).optional(),
  bio: z.string().max(1000).optional(),
  province: z.enum([
    'EASTERN_CAPE', 'FREE_STATE', 'GAUTENG', 'KWAZULU_NATAL',
    'LIMPOPO', 'MPUMALANGA', 'NORTHERN_CAPE', 'NORTH_WEST', 'WESTERN_CAPE'
  ]).optional(),
  city: z.string().max(100).optional(),
  suburb: z.string().max(100).optional(),
  postalCode: z.string().max(10).optional()
});

export const skillSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().max(50).optional(),
  proficiencyLevel: z.number().min(1).max(5).optional(),
  yearsOfExperience: z.number().min(0).max(60).optional(),
  verified: z.boolean().optional()
});

export const experienceSchema = z.object({
  jobTitle: z.string().min(1).max(100),
  company: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isCurrent: z.boolean().default(false),
  description: z.string().max(2000).optional()
});

export const educationSchema = z.object({
  institution: z.string().min(1).max(100),
  degree: z.string().min(1).max(100),
  fieldOfStudy: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isCurrent: z.boolean().default(false),
  grade: z.string().max(20).optional()
});

class UserProfileService {
  /**
   * Get complete user profile
   */
  async getUserProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          jobSeekerProfile: true,
          employerProfile: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                  industry: true,
                  size: true,
                  verified: true
                }
              }
            }
          },
          skills: {
            include: {
              skill: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  isInDemand: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          experiences: {
            orderBy: { startDate: 'desc' }
          },
          educations: {
            orderBy: { startDate: 'desc' }
          },
          files: {
            where: {
              type: { in: ['CV', 'PROFILE_PICTURE'] }
            },
            select: {
              id: true,
              type: true,
              originalName: true,
              url: true,
              createdAt: true
            }
          }
        }
      });

      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      }

      return this.transformUserProfile(user);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get user profile failed', { error, userId });
      throw new AppError(500, 'Failed to retrieve user profile', 'PROFILE_RETRIEVAL_ERROR');
    }
  }

  /**
   * Update basic user information
   */
  async updateUserProfile(userId: string, data: z.infer<typeof userProfileSchema>) {
    try {
      // Validate input
      const validatedData = userProfileSchema.parse(data);

      // Check if phone number is already taken by another user
      if (validatedData.phone) {
        const existingUser = await prisma.user.findFirst({
          where: {
            phone: validatedData.phone,
            id: { not: userId }
          }
        });

        if (existingUser) {
          throw new AppError(409, 'Phone number already in use', 'PHONE_EXISTS');
        }
      }

      // Check if ID number is already taken by another user
      if (validatedData.idNumber) {
        const existingUser = await prisma.user.findFirst({
          where: {
            idNumber: validatedData.idNumber,
            id: { not: userId }
          }
        });

        if (existingUser) {
          throw new AppError(409, 'ID number already in use', 'ID_NUMBER_EXISTS');
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...validatedData,
          dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : undefined
        },
        include: {
          jobSeekerProfile: true,
          employerProfile: true
        }
      });

      logger.info('User profile updated', { userId });
      return this.transformBasicProfile(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid profile data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Update user profile failed', { error, userId });
      throw new AppError(500, 'Failed to update user profile', 'PROFILE_UPDATE_ERROR');
    }
  }

  /**
   * Update or create job seeker profile
   */
  async updateJobSeekerProfile(userId: string, data: z.infer<typeof jobSeekerProfileSchema>) {
    try {
      // Validate input
      const validatedData = jobSeekerProfileSchema.parse(data);

      // Ensure user is a job seeker
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      }

      if (user.role !== 'JOB_SEEKER') {
        throw new AppError(403, 'Only job seekers can update this profile', 'ROLE_MISMATCH');
      }

      // Salary validation
      if (validatedData.expectedSalaryMin && validatedData.expectedSalaryMax) {
        if (validatedData.expectedSalaryMin > validatedData.expectedSalaryMax) {
          throw new AppError(400, 'Minimum salary cannot be greater than maximum salary', 'INVALID_SALARY_RANGE');
        }
      }

      const profile = await prisma.jobSeekerProfile.upsert({
        where: { userId },
        create: {
          ...validatedData,
          userId,
          availableFrom: validatedData.availableFrom ? new Date(validatedData.availableFrom) : undefined
        },
        update: {
          ...validatedData,
          availableFrom: validatedData.availableFrom ? new Date(validatedData.availableFrom) : undefined
        }
      });

      logger.info('Job seeker profile updated', { userId });
      return this.transformJobSeekerProfile(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid job seeker profile data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Update job seeker profile failed', { error, userId });
      throw new AppError(500, 'Failed to update job seeker profile', 'PROFILE_UPDATE_ERROR');
    }
  }

  /**
   * Add or update user skill
   */
  async addOrUpdateSkill(userId: string, skillData: z.infer<typeof skillSchema>) {
    try {
      const validatedData = skillSchema.parse(skillData);

      // Find or create the skill
      let skill = await prisma.skill.findFirst({
        where: { name: { equals: validatedData.name, mode: 'insensitive' } }
      });

      if (!skill) {
        skill = await prisma.skill.create({
          data: {
            name: validatedData.name,
            category: validatedData.category
          }
        });
      }

      // Check if user already has this skill
      const existingUserSkill = await prisma.userSkill.findUnique({
        where: {
          userId_skillId: {
            userId,
            skillId: skill.id
          }
        }
      });

      const userSkill = existingUserSkill
        ? await prisma.userSkill.update({
            where: { id: existingUserSkill.id },
            data: {
              proficiencyLevel: validatedData.proficiencyLevel,
              yearsOfExperience: validatedData.yearsOfExperience,
              verified: validatedData.verified ?? false
            },
            include: { skill: true }
          })
        : await prisma.userSkill.create({
            data: {
              userId,
              skillId: skill.id,
              proficiencyLevel: validatedData.proficiencyLevel,
              yearsOfExperience: validatedData.yearsOfExperience,
              verified: validatedData.verified ?? false
            },
            include: { skill: true }
          });

      logger.info('User skill added/updated', { userId, skillId: skill.id });
      return this.transformUserSkill(userSkill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid skill data', 'VALIDATION_ERROR', error.errors);
      }
      logger.error('Add/update skill failed', { error, userId });
      throw new AppError(500, 'Failed to add/update skill', 'SKILL_UPDATE_ERROR');
    }
  }

  /**
   * Remove user skill
   */
  async removeSkill(userId: string, skillId: string) {
    try {
      const userSkill = await prisma.userSkill.findUnique({
        where: {
          userId_skillId: {
            userId,
            skillId
          }
        }
      });

      if (!userSkill) {
        throw new AppError(404, 'Skill not found for user', 'SKILL_NOT_FOUND');
      }

      await prisma.userSkill.delete({
        where: { id: userSkill.id }
      });

      logger.info('User skill removed', { userId, skillId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Remove skill failed', { error, userId, skillId });
      throw new AppError(500, 'Failed to remove skill', 'SKILL_REMOVE_ERROR');
    }
  }

  /**
   * Add work experience
   */
  async addExperience(userId: string, experienceData: z.infer<typeof experienceSchema>) {
    try {
      const validatedData = experienceSchema.parse(experienceData);

      // Date validation
      const startDate = new Date(validatedData.startDate);
      const endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;

      if (endDate && startDate >= endDate) {
        throw new AppError(400, 'Start date must be before end date', 'INVALID_DATE_RANGE');
      }

      // If marking as current, update other experiences to not be current
      if (validatedData.isCurrent) {
        await prisma.experience.updateMany({
          where: { userId, isCurrent: true },
          data: { isCurrent: false }
        });
      }

      const experience = await prisma.experience.create({
        data: {
          ...validatedData,
          userId,
          startDate,
          endDate
        }
      });

      logger.info('Experience added', { userId, experienceId: experience.id });
      return this.transformExperience(experience);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid experience data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Add experience failed', { error, userId });
      throw new AppError(500, 'Failed to add experience', 'EXPERIENCE_ADD_ERROR');
    }
  }

  /**
   * Update work experience
   */
  async updateExperience(userId: string, experienceId: string, experienceData: z.infer<typeof experienceSchema>) {
    try {
      const validatedData = experienceSchema.parse(experienceData);

      // Check if experience belongs to user
      const existingExperience = await prisma.experience.findFirst({
        where: { id: experienceId, userId }
      });

      if (!existingExperience) {
        throw new AppError(404, 'Experience not found', 'EXPERIENCE_NOT_FOUND');
      }

      // Date validation
      const startDate = new Date(validatedData.startDate);
      const endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;

      if (endDate && startDate >= endDate) {
        throw new AppError(400, 'Start date must be before end date', 'INVALID_DATE_RANGE');
      }

      // If marking as current, update other experiences to not be current
      if (validatedData.isCurrent) {
        await prisma.experience.updateMany({
          where: { 
            userId, 
            isCurrent: true,
            id: { not: experienceId }
          },
          data: { isCurrent: false }
        });
      }

      const experience = await prisma.experience.update({
        where: { id: experienceId },
        data: {
          ...validatedData,
          startDate,
          endDate
        }
      });

      logger.info('Experience updated', { userId, experienceId });
      return this.transformExperience(experience);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid experience data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Update experience failed', { error, userId, experienceId });
      throw new AppError(500, 'Failed to update experience', 'EXPERIENCE_UPDATE_ERROR');
    }
  }

  /**
   * Remove work experience
   */
  async removeExperience(userId: string, experienceId: string) {
    try {
      const experience = await prisma.experience.findFirst({
        where: { id: experienceId, userId }
      });

      if (!experience) {
        throw new AppError(404, 'Experience not found', 'EXPERIENCE_NOT_FOUND');
      }

      await prisma.experience.delete({
        where: { id: experienceId }
      });

      logger.info('Experience removed', { userId, experienceId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Remove experience failed', { error, userId, experienceId });
      throw new AppError(500, 'Failed to remove experience', 'EXPERIENCE_REMOVE_ERROR');
    }
  }

  /**
   * Add education
   */
  async addEducation(userId: string, educationData: z.infer<typeof educationSchema>) {
    try {
      const validatedData = educationSchema.parse(educationData);

      // Date validation
      const startDate = new Date(validatedData.startDate);
      const endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;

      if (endDate && startDate >= endDate) {
        throw new AppError(400, 'Start date must be before end date', 'INVALID_DATE_RANGE');
      }

      // If marking as current, update other educations to not be current
      if (validatedData.isCurrent) {
        await prisma.education.updateMany({
          where: { userId, isCurrent: true },
          data: { isCurrent: false }
        });
      }

      const education = await prisma.education.create({
        data: {
          ...validatedData,
          userId,
          startDate,
          endDate
        }
      });

      logger.info('Education added', { userId, educationId: education.id });
      return this.transformEducation(education);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid education data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Add education failed', { error, userId });
      throw new AppError(500, 'Failed to add education', 'EDUCATION_ADD_ERROR');
    }
  }

  /**
   * Update education
   */
  async updateEducation(userId: string, educationId: string, educationData: z.infer<typeof educationSchema>) {
    try {
      const validatedData = educationSchema.parse(educationData);

      // Check if education belongs to user
      const existingEducation = await prisma.education.findFirst({
        where: { id: educationId, userId }
      });

      if (!existingEducation) {
        throw new AppError(404, 'Education not found', 'EDUCATION_NOT_FOUND');
      }

      // Date validation
      const startDate = new Date(validatedData.startDate);
      const endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;

      if (endDate && startDate >= endDate) {
        throw new AppError(400, 'Start date must be before end date', 'INVALID_DATE_RANGE');
      }

      // If marking as current, update other educations to not be current
      if (validatedData.isCurrent) {
        await prisma.education.updateMany({
          where: { 
            userId, 
            isCurrent: true,
            id: { not: educationId }
          },
          data: { isCurrent: false }
        });
      }

      const education = await prisma.education.update({
        where: { id: educationId },
        data: {
          ...validatedData,
          startDate,
          endDate
        }
      });

      logger.info('Education updated', { userId, educationId });
      return this.transformEducation(education);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid education data', 'VALIDATION_ERROR', error.errors);
      }
      if (error instanceof AppError) throw error;
      logger.error('Update education failed', { error, userId, educationId });
      throw new AppError(500, 'Failed to update education', 'EDUCATION_UPDATE_ERROR');
    }
  }

  /**
   * Remove education
   */
  async removeEducation(userId: string, educationId: string) {
    try {
      const education = await prisma.education.findFirst({
        where: { id: educationId, userId }
      });

      if (!education) {
        throw new AppError(404, 'Education not found', 'EDUCATION_NOT_FOUND');
      }

      await prisma.education.delete({
        where: { id: educationId }
      });

      logger.info('Education removed', { userId, educationId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Remove education failed', { error, userId, educationId });
      throw new AppError(500, 'Failed to remove education', 'EDUCATION_REMOVE_ERROR');
    }
  }

  /**
   * Get profile completion percentage
   */
  async getProfileCompletion(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          jobSeekerProfile: true,
          skills: true,
          experiences: true,
          educations: true,
          files: {
            where: { type: 'CV' }
          }
        }
      });

      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
      }

      const completionChecks = {
        basicInfo: !!(user.firstName && user.lastName && user.phone && user.bio),
        location: !!(user.province && user.city),
        profile: !!(user.jobSeekerProfile?.currentJobTitle && user.jobSeekerProfile?.yearsOfExperience !== null),
        skills: user.skills.length >= 3,
        experience: user.experiences.length >= 1,
        education: user.educations.length >= 1,
        cv: user.files.length >= 1
      };

      const completedCount = Object.values(completionChecks).filter(Boolean).length;
      const totalCount = Object.keys(completionChecks).length;
      const percentage = Math.round((completedCount / totalCount) * 100);

      return {
        percentage,
        completedSections: completedCount,
        totalSections: totalCount,
        sections: completionChecks,
        recommendations: this.getCompletionRecommendations(completionChecks)
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get profile completion failed', { error, userId });
      throw new AppError(500, 'Failed to calculate profile completion', 'COMPLETION_CALC_ERROR');
    }
  }

  /**
   * Search for skills
   */
  async searchSkills(query: string, limit: number = 20) {
    try {
      const skills = await prisma.skill.findMany({
        where: {
          name: {
            contains: query,
            mode: 'insensitive'
          }
        },
        orderBy: [
          { isInDemand: 'desc' },
          { name: 'asc' }
        ],
        take: limit,
        select: {
          id: true,
          name: true,
          category: true,
          isInDemand: true,
          _count: {
            select: { userSkills: true }
          }
        }
      });

      return skills.map(skill => ({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        isInDemand: skill.isInDemand,
        userCount: skill._count.userSkills
      }));
    } catch (error) {
      logger.error('Search skills failed', { error, query });
      throw new AppError(500, 'Failed to search skills', 'SKILL_SEARCH_ERROR');
    }
  }

  /**
   * Transform full user profile for API response
   */
  private transformUserProfile(user: any) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      profilePicture: user.profilePicture,
      dateOfBirth: user.dateOfBirth?.toISOString(),
      nationality: user.nationality,
      idNumber: user.idNumber,
      bio: user.bio,
      location: {
        province: user.province,
        city: user.city,
        suburb: user.suburb,
        postalCode: user.postalCode
      },
      subscription: {
        plan: user.subscriptionPlan,
        expiry: user.subscriptionExpiry?.toISOString(),
        creditsRemaining: user.creditsRemaining,
        monthlyQuota: user.monthlyQuota
      },
      jobSeekerProfile: user.jobSeekerProfile ? this.transformJobSeekerProfile(user.jobSeekerProfile) : null,
      employerProfile: user.employerProfile ? {
        id: user.employerProfile.id,
        company: user.employerProfile.company,
        position: user.employerProfile.position,
        department: user.employerProfile.department,
        isRecruiter: user.employerProfile.isRecruiter,
        canPostJobs: user.employerProfile.canPostJobs
      } : null,
      skills: user.skills.map(this.transformUserSkill),
      experiences: user.experiences.map(this.transformExperience),
      educations: user.educations.map(this.transformEducation),
      files: user.files.map((file: any) => ({
        id: file.id,
        type: file.type,
        originalName: file.originalName,
        url: file.url,
        uploadedAt: file.createdAt.toISOString()
      })),
      timestamps: {
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString()
      }
    };
  }

  private transformBasicProfile(user: any) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      profilePicture: user.profilePicture,
      dateOfBirth: user.dateOfBirth?.toISOString(),
      nationality: user.nationality,
      idNumber: user.idNumber,
      bio: user.bio,
      location: {
        province: user.province,
        city: user.city,
        suburb: user.suburb,
        postalCode: user.postalCode
      },
      updatedAt: user.updatedAt.toISOString()
    };
  }

  private transformJobSeekerProfile(profile: any) {
    return {
      id: profile.id,
      currentJobTitle: profile.currentJobTitle,
      yearsOfExperience: profile.yearsOfExperience,
      expectedSalaryMin: profile.expectedSalaryMin,
      expectedSalaryMax: profile.expectedSalaryMax,
      noticePeriod: profile.noticePeriod,
      availableFrom: profile.availableFrom?.toISOString(),
      willingToRelocate: profile.willingToRelocate,
      preferredLocations: profile.preferredLocations || [],
      preferredJobTypes: profile.preferredJobTypes || [],
      preferredIndustries: profile.preferredIndustries || [],
      beeStatus: profile.beeStatus,
      disability: profile.disability,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString()
    };
  }

  private transformUserSkill(userSkill: any) {
    return {
      id: userSkill.id,
      skill: {
        id: userSkill.skill.id,
        name: userSkill.skill.name,
        category: userSkill.skill.category,
        isInDemand: userSkill.skill.isInDemand
      },
      proficiencyLevel: userSkill.proficiencyLevel,
      yearsOfExperience: userSkill.yearsOfExperience,
      verified: userSkill.verified,
      addedAt: userSkill.createdAt.toISOString()
    };
  }

  private transformExperience(experience: any) {
    return {
      id: experience.id,
      jobTitle: experience.jobTitle,
      company: experience.company,
      location: experience.location,
      startDate: experience.startDate.toISOString(),
      endDate: experience.endDate?.toISOString(),
      isCurrent: experience.isCurrent,
      description: experience.description,
      createdAt: experience.createdAt.toISOString(),
      updatedAt: experience.updatedAt.toISOString()
    };
  }

  private transformEducation(education: any) {
    return {
      id: education.id,
      institution: education.institution,
      degree: education.degree,
      fieldOfStudy: education.fieldOfStudy,
      startDate: education.startDate.toISOString(),
      endDate: education.endDate?.toISOString(),
      isCurrent: education.isCurrent,
      grade: education.grade,
      createdAt: education.createdAt.toISOString(),
      updatedAt: education.updatedAt.toISOString()
    };
  }

  private getCompletionRecommendations(checks: any): string[] {
    const recommendations = [];

    if (!checks.basicInfo) {
      recommendations.push('Complete your basic information (name, phone, bio)');
    }
    if (!checks.location) {
      recommendations.push('Add your location (province and city)');
    }
    if (!checks.profile) {
      recommendations.push('Fill in your job seeker profile (current role, experience)');
    }
    if (!checks.skills) {
      recommendations.push('Add at least 3 skills to showcase your abilities');
    }
    if (!checks.experience) {
      recommendations.push('Add your work experience to build credibility');
    }
    if (!checks.education) {
      recommendations.push('Include your educational background');
    }
    if (!checks.cv) {
      recommendations.push('Upload your CV to apply for jobs');
    }

    return recommendations;
  }
}

export default new UserProfileService();
