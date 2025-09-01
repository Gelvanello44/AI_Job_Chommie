import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import userProfileController from '../controllers/userProfileController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { csrfProtectUserData, sensitiveOperationCSRF } from '../middleware/csrf';
import { basicXSSProtection, fileUploadXSSProtection } from '../middleware/xss';
import { 
  userProfileSchema, 
  jobSeekerProfileSchema, 
  skillSchema, 
  experienceSchema, 
  educationSchema 
} from '../services/userProfileService.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
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

// Apply authentication to all routes
router.use(authenticate);

// Rate limiting for different types of operations
const profileUpdateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 updates per window
  message: 'Too many profile updates. Please try again later.',
  keyGenerator: (req) => `profile_update:${req.user?.id}`
});

const skillOperationLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 skill operations per window
  message: 'Too many skill operations. Please try again later.',
  keyGenerator: (req) => `skill_ops:${req.user?.id}`
});

const fileUploadLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 file uploads per hour
  message: 'Too many file uploads. Please try again later.',
  keyGenerator: (req) => `file_upload:${req.user?.id}`
});

const searchLimiter = rateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: 'Too many search requests. Please try again later.',
  keyGenerator: (req) => `search:${req.user?.id}`
});

// Profile management routes
router.get('/', userProfileController.getProfile);
router.put('/', profileUpdateLimiter, ...basicXSSProtection, validateRequest(userProfileSchema), userProfileController.updateProfile);
router.get('/completion', userProfileController.getProfileCompletion);
router.get('/stats', userProfileController.getUserStats);
router.delete('/', profileUpdateLimiter, ...sensitiveOperationCSRF(), userProfileController.deleteProfile);

// Job seeker profile routes
router.put('/job-seeker', profileUpdateLimiter, ...basicXSSProtection, validateRequest(jobSeekerProfileSchema), userProfileController.updateJobSeekerProfile);

// Skills management routes
router.post('/skills', skillOperationLimiter, ...basicXSSProtection, validateRequest(skillSchema), userProfileController.addOrUpdateSkill);
router.delete('/skills/:skillId', skillOperationLimiter, ...csrfProtectUserData, userProfileController.removeSkill);
router.get('/skills/search', searchLimiter, userProfileController.searchSkills);

// Experience management routes
router.post('/experience', profileUpdateLimiter, ...basicXSSProtection, validateRequest(experienceSchema), userProfileController.addExperience);
router.put('/experience/:experienceId', profileUpdateLimiter, ...basicXSSProtection, validateRequest(experienceSchema), userProfileController.updateExperience);
router.delete('/experience/:experienceId', profileUpdateLimiter, ...csrfProtectUserData, userProfileController.removeExperience);

// Education management routes
router.post('/education', profileUpdateLimiter, ...basicXSSProtection, validateRequest(educationSchema), userProfileController.addEducation);
router.put('/education/:educationId', profileUpdateLimiter, ...basicXSSProtection, validateRequest(educationSchema), userProfileController.updateEducation);
router.delete('/education/:educationId', profileUpdateLimiter, ...csrfProtectUserData, userProfileController.removeEducation);

// File upload routes
router.post('/picture', fileUploadLimiter, ...fileUploadXSSProtection, upload.single('profilePicture'), userProfileController.uploadProfilePicture);

export default router;
