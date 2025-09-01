import { Response, NextFunction } from 'express';
import { z } from 'zod';
import companyProfileService, { 
  companySchema, 
  employerProfileSchema,
  companyFilterSchema 
} from '../services/companyProfileService.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../types/auth.js';
import activityService from '../services/activityService.js';

// Additional validation schemas
const companyIdSchema = z.object({
  companyId: z.string().uuid()
});

const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  position: z.string().min(1).max(100),
  permissions: z.array(z.enum([
    'POST_JOBS', 'MANAGE_APPLICATIONS', 'VIEW_ANALYTICS', 'MANAGE_COMPANY', 'MANAGE_TEAM'
  ])).min(1).max(5)
});

const removeTeamMemberSchema = z.object({
  memberUserId: z.string().uuid()
});

export class CompanyProfileController {
  /**
   * Create a new company
   */
  async createCompany(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const companyData = req.body;

      const company = await companyProfileService.createCompany(userId, companyData);

      // Log company creation activity
      await activityService.logUserActivity(userId, 'company_created', {
        companyId: company.id,
        companyName: company.name
      }).catch(err => logger.warn('Failed to log company creation activity', { error: err }));

      res.status(201).json({
        success: true,
        message: 'Company created successfully',
        data: company
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update company profile
   */
  async updateCompany(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { companyId } = companyIdSchema.parse(req.params);
      const companyData = req.body;

      const company = await companyProfileService.updateCompany(userId, companyId, companyData);

      // Log company update activity
      await activityService.logUserActivity(userId, 'company_updated', {
        companyId,
        updatedFields: Object.keys(companyData)
      }).catch(err => logger.warn('Failed to log company update activity', { error: err }));

      res.json({
        success: true,
        message: 'Company updated successfully',
        data: company
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid company ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get company profile details
   */
  async getCompanyProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { companyId } = companyIdSchema.parse(req.params);
      const userId = req.user?.id; // Optional for public access

      const company = await companyProfileService.getCompanyProfile(companyId, userId);

      // Log company profile view activity (if user is logged in)
      if (userId) {
        await activityService.logUserActivity(userId, 'company_profile_viewed', {
          companyId,
          companyName: company.name
        }).catch(err => logger.warn('Failed to log company profile view activity', { error: err }));
      }

      res.json({
        success: true,
        data: company
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid company ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Search companies with filters
   */
  async searchCompanies(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filters = {
        industry: req.query.industry as string,
        size: req.query.size ? 
          (Array.isArray(req.query.size) ? req.query.size.map(s => String(s)) : [String(req.query.size)]) as any : undefined,
        province: req.query.province ? 
          (Array.isArray(req.query.province) ? req.query.province.map(p => String(p)) : [String(req.query.province)]) as any : undefined,
        city: req.query.city as string,
        verified: req.query.verified ? req.query.verified === 'true' : undefined,
        hasJobs: req.query.hasJobs ? req.query.hasJobs === 'true' : undefined,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        sortBy: (req.query.sortBy as any) || 'name',
        sortOrder: (req.query.sortOrder as any) || 'asc'
      };

      const result = await companyProfileService.searchCompanies(filters);

      res.json({
        success: true,
        data: result.companies,
        pagination: result.pagination,
        filters: result.filters
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update employer profile
   */
  async updateEmployerProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const profileData = req.body;

      const profile = await companyProfileService.updateEmployerProfile(userId, profileData);

      // Log employer profile update activity
      await activityService.logUserActivity(userId, 'employer_profile_updated', {
        updatedFields: Object.keys(profileData)
      }).catch(err => logger.warn('Failed to log employer profile update activity', { error: err }));

      res.json({
        success: true,
        message: 'Employer profile updated successfully',
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Invite team member to company
   */
  async inviteTeamMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { companyId } = companyIdSchema.parse(req.params);
      const { email, position, permissions } = inviteTeamMemberSchema.parse(req.body);

      const teamMember = await companyProfileService.inviteTeamMember(
        userId, 
        companyId, 
        email, 
        position, 
        permissions
      );

      // Log team member invitation activity
      await activityService.logUserActivity(userId, 'team_member_invited', {
        companyId,
        invitedEmail: email,
        position,
        permissions
      }).catch(err => logger.warn('Failed to log team invitation activity', { error: err }));

      res.status(201).json({
        success: true,
        message: 'Team member invited successfully',
        data: teamMember
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid request data', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Remove team member from company
   */
  async removeTeamMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { companyId } = companyIdSchema.parse(req.params);
      const { memberUserId } = removeTeamMemberSchema.parse(req.body);

      await companyProfileService.removeTeamMember(userId, companyId, memberUserId);

      // Log team member removal activity
      await activityService.logUserActivity(userId, 'team_member_removed', {
        companyId,
        removedUserId: memberUserId
      }).catch(err => logger.warn('Failed to log team removal activity', { error: err }));

      res.json({
        success: true,
        message: 'Team member removed successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid request data', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get company statistics and analytics
   */
  async getCompanyStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { companyId } = companyIdSchema.parse(req.params);

      const stats = await companyProfileService.getCompanyStats(userId, companyId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid company ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }

  /**
   * Get current user's company
   */
  async getMyCompany(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Find the user's employer profile to get their company
      const user = await companyProfileService.getCompanyProfile('', userId);

      if (!user) {
        throw new AppError(404, 'No company associated with your account', 'NO_COMPANY');
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get featured/verified companies
   */
  async getFeaturedCompanies(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filters = {
        verified: true,
        hasJobs: true,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 12,
        sortBy: 'job_count' as const,
        sortOrder: 'desc' as const
      };

      const result = await companyProfileService.searchCompanies(filters);

      res.json({
        success: true,
        data: result.companies,
        pagination: result.pagination,
        meta: {
          type: 'featured',
          criteria: 'verified companies with active jobs'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get companies by industry
   */
  async getCompaniesByIndustry(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { industry } = req.params;

      if (!industry) {
        throw new AppError(400, 'Industry parameter is required', 'MISSING_INDUSTRY');
      }

      const filters = {
        industry,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        sortBy: (req.query.sortBy as any) || 'name',
        sortOrder: (req.query.sortOrder as any) || 'asc'
      };

      const result = await companyProfileService.searchCompanies(filters);

      res.json({
        success: true,
        data: result.companies,
        pagination: result.pagination,
        meta: {
          industry,
          count: result.companies.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload company logo
   */
  async uploadCompanyLogo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { companyId } = companyIdSchema.parse(req.params);
      const file = req.file;

      if (!file) {
        throw new AppError(400, 'No file uploaded', 'NO_FILE');
      }

      // Here you would typically upload to cloud storage (AWS S3, Cloudinary, etc.)
      // For now, we'll simulate this with a placeholder URL
      const logoUrl = `/uploads/companies/${companyId}_${Date.now()}_${file.originalname}`;

      // Log company logo upload activity
      await activityService.logUserActivity(userId, 'company_logo_uploaded', {
        companyId,
        fileName: file.originalname,
        fileSize: file.size
      }).catch(err => logger.warn('Failed to log company logo upload activity', { error: err }));

      res.json({
        success: true,
        message: 'Company logo uploaded successfully',
        data: {
          logo: logoUrl
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(400, 'Invalid company ID', 'VALIDATION_ERROR', error.errors));
      }
      next(error);
    }
  }
}

export default new CompanyProfileController();
