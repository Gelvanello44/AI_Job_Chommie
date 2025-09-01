import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import companyProfileController from '../controllers/companyProfileController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { 
  companySchema, 
  employerProfileSchema 
} from '../services/companyProfileService.js';

const router = Router();

// Configure multer for company logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/companies/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

// Rate limiting for different types of operations
const companyManagementLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 operations per window
  message: 'Too many company management requests. Please try again later.',
  keyGenerator: (req) => `company_mgmt:${req.user?.id}`
});

const searchLimiter = rateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: 'Too many search requests. Please try again later.',
  keyGenerator: (req) => `company_search:${req.user?.id || req.ip}`
});

const teamManagementLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 team operations per hour
  message: 'Too many team management requests. Please try again later.',
  keyGenerator: (req) => `team_mgmt:${req.user?.id}`
});

const fileUploadLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 file uploads per hour
  message: 'Too many file uploads. Please try again later.',
  keyGenerator: (req) => `company_upload:${req.user?.id}`
});

// Public routes (no authentication required)
router.get('/search', searchLimiter, optionalAuth, companyProfileController.searchCompanies);
router.get('/featured', searchLimiter, optionalAuth, companyProfileController.getFeaturedCompanies);
router.get('/industry/:industry', searchLimiter, optionalAuth, companyProfileController.getCompaniesByIndustry);
router.get('/:companyId', optionalAuth, companyProfileController.getCompanyProfile);

// Protected routes (authentication required)
router.use(authenticate);

// Company management routes
router.post('/', companyManagementLimiter, validateRequest(companySchema), companyProfileController.createCompany);
router.put('/:companyId', companyManagementLimiter, validateRequest(companySchema), companyProfileController.updateCompany);
router.get('/my/company', companyProfileController.getMyCompany);
router.get('/:companyId/stats', companyProfileController.getCompanyStats);

// Employer profile routes
router.put('/profile/employer', companyManagementLimiter, validateRequest(employerProfileSchema), companyProfileController.updateEmployerProfile);

// Team management routes
router.post('/:companyId/team/invite', teamManagementLimiter, companyProfileController.inviteTeamMember);
router.delete('/:companyId/team/remove', teamManagementLimiter, companyProfileController.removeTeamMember);

// File upload routes
router.post('/:companyId/logo', fileUploadLimiter, upload.single('logo'), companyProfileController.uploadCompanyLogo);

export default router;
