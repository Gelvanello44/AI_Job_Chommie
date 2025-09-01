import express from 'express';
import jobSearchController from '../controllers/jobSearchController.js';
import { auth, optionalAuth } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Rate limiting configurations
const searchRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 searches per 15 minutes
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Too many search requests. Please try again later.',
    code: 'SEARCH_RATE_LIMIT'
  }
});

const jobActionRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 job actions per 15 minutes
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Too many job actions. Please try again later.',
    code: 'JOB_ACTION_RATE_LIMIT'
  }
});

//  AI Magic rate limiting - more restrictive for AI features
const aiMagicRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 AI requests per 15 minutes
  keyGenerator: (req) => req.user?.id,
  message: {
    success: false,
    error: 'Too many AI requests. Please try again later.',
    code: 'AI_MAGIC_RATE_LIMIT'
  }
});

/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Job search and management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     JobSearchFilters:
 *       type: object
 *       properties:
 *         query:
 *           type: string
 *           description: Search query text
 *         location:
 *           type: string
 *           description: Location search term
 *         province:
 *           type: string
 *           enum: [EASTERN_CAPE, FREE_STATE, GAUTENG, KWAZULU_NATAL, LIMPOPO, MPUMALANGA, NORTHERN_CAPE, NORTH_WEST, WESTERN_CAPE]
 *         city:
 *           type: string
 *           description: Specific city
 *         isRemote:
 *           type: boolean
 *           description: Filter for remote jobs
 *         jobTypes:
 *           type: array
 *           items:
 *             type: string
 *             enum: [FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, TEMPORARY, REMOTE]
 *         experienceLevel:
 *           type: string
 *           enum: [ENTRY_LEVEL, JUNIOR, MID_LEVEL, SENIOR, EXECUTIVE]
 *         salaryMin:
 *           type: number
 *           minimum: 0
 *         salaryMax:
 *           type: number
 *           minimum: 0
 *         requiredSkills:
 *           type: array
 *           items:
 *             type: string
 *         preferredSkills:
 *           type: array
 *           items:
 *             type: string
 *         companyId:
 *           type: string
 *           format: uuid
 *         companySize:
 *           type: string
 *         industry:
 *           type: string
 *         featured:
 *           type: boolean
 *         urgent:
 *           type: boolean
 *         postedWithin:
 *           type: string
 *           enum: [24h, 7d, 30d, 90d]
 *         page:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         sortBy:
 *           type: string
 *           enum: [relevance, date, salary_asc, salary_desc, company, title]
 *           default: relevance
 *     
 *     JobSearchResult:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         requirements:
 *           type: string
 *         responsibilities:
 *           type: string
 *         company:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *             logo:
 *               type: string
 *               nullable: true
 *             industry:
 *               type: string
 *             size:
 *               type: string
 *               nullable: true
 *             verified:
 *               type: boolean
 *         jobType:
 *           type: string
 *         experienceLevel:
 *           type: string
 *         location:
 *           type: object
 *           properties:
 *             province:
 *               type: string
 *             city:
 *               type: string
 *             suburb:
 *               type: string
 *               nullable: true
 *             isRemote:
 *               type: boolean
 *         salary:
 *           type: object
 *           nullable: true
 *           properties:
 *             min:
 *               type: number
 *               nullable: true
 *             max:
 *               type: number
 *               nullable: true
 *             currency:
 *               type: string
 *             period:
 *               type: string
 *               nullable: true
 *             showSalary:
 *               type: boolean
 *         skills:
 *           type: object
 *           properties:
 *             required:
 *               type: array
 *               items:
 *                 type: string
 *             preferred:
 *               type: array
 *               items:
 *                 type: string
 *         applicationInfo:
 *           type: object
 *           properties:
 *             deadline:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             email:
 *               type: string
 *               nullable: true
 *             url:
 *               type: string
 *               nullable: true
 *         status:
 *           type: object
 *           properties:
 *             active:
 *               type: boolean
 *             featured:
 *               type: boolean
 *             urgent:
 *               type: boolean
 *         metrics:
 *           type: object
 *           properties:
 *             views:
 *               type: integer
 *             applications:
 *               type: integer
 *         dates:
 *           type: object
 *           properties:
 *             createdAt:
 *               type: string
 *               format: date-time
 *             publishedAt:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             expiresAt:
 *               type: string
 *               format: date-time
 *               nullable: true
 *         matchScore:
 *           type: number
 *           nullable: true
 *           description: AI matching score (0-100) if user is authenticated
 */

/**
 * @swagger
 * /api/jobs/ai-matches:
 *   get:
 *     summary:  MAGIC - Get AI-enhanced job matches with personality analysis
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 10
 *         description: Number of AI matches to return
 *       - in: query
 *         name: minScore
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           default: 0.6
 *         description: Minimum match score (0-1)
 *       - in: query
 *         name: jobIds
 *         schema:
 *           type: string
 *         description: Comma-separated list of specific job IDs to analyze
 *     responses:
 *       200:
 *         description: AI-enhanced job matches with personality insights
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       job:
 *                         $ref: '#/components/schemas/JobSearchResult'
 *                       aiAnalysis:
 *                         type: object
 *                         properties:
 *                           overallScore:
 *                             type: number
 *                           successProbability:
 *                             type: number
 *                           magicExplanation:
 *                             type: string
 *                           whyPerfectFit:
 *                             type: string
 *                           personalityInsights:
 *                             type: object
 *                           scores:
 *                             type: object
 *                             properties:
 *                               skills:
 *                                 type: number
 *                               experience:
 *                                 type: number
 *                               personality:
 *                                 type: number
 *                               culturalFit:
 *                                 type: number
 *                               location:
 *                                 type: number
 *                           strengths:
 *                             type: array
 *                             items:
 *                               type: string
 *                           recommendations:
 *                             type: array
 *                             items:
 *                               type: string
 *                 meta:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                     totalAnalyzed:
 *                       type: integer
 *                     userId:
 *                       type: string
 *                     aiEnhanced:
 *                       type: boolean
 *                     magicVersion:
 *                       type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Authentication required
 *       429:
 *         description: AI rate limit exceeded
 */
router.get('/ai-matches', aiMagicRateLimit, auth, jobSearchController.getAIEnhancedMatches);

/**
 * @swagger
 * /api/jobs/{jobId}/personality-analysis:
 *   get:
 *     summary:  MAGIC - Get detailed personality-job analysis for specific job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID for personality analysis
 *     responses:
 *       200:
 *         description: Detailed personality analysis for the job
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobInfo:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         company:
 *                           type: object
 *                     personalityAnalysis:
 *                       type: object
 *                       properties:
 *                         overallCompatibility:
 *                           type: number
 *                         successProbability:
 *                           type: object
 *                           properties:
 *                             percentage:
 *                               type: number
 *                             confidence:
 *                               type: string
 *                             reasoning:
 *                               type: string
 *                         personalityFit:
 *                           type: object
 *                           properties:
 *                             score:
 *                               type: number
 *                             insights:
 *                               type: object
 *                             explanation:
 *                               type: string
 *                         culturalFit:
 *                           type: object
 *                           properties:
 *                             score:
 *                               type: number
 *                             alignment:
 *                               type: string
 *                         detailedScores:
 *                           type: object
 *                         actionable:
 *                           type: object
 *                           properties:
 *                             strengths:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             recommendations:
 *                               type: array
 *                               items:
 *                                 type: string
 *                             nextSteps:
 *                               type: array
 *                               items:
 *                                 type: string
 *                 meta:
 *                   type: object
 *                   properties:
 *                     analysisType:
 *                       type: string
 *                     aiVersion:
 *                       type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid job ID format
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Job not found or no match data available
 *       429:
 *         description: AI rate limit exceeded
 */
router.get('/:jobId/personality-analysis', aiMagicRateLimit, auth, jobSearchController.getJobPersonalityAnalysis);

/**
 * @swagger
 * /api/jobs/search:
 *   get:
 *     summary: Search for jobs with advanced filtering
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query text
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Location search term
 *       - in: query
 *         name: province
 *         schema:
 *           type: string
 *           enum: [EASTERN_CAPE, FREE_STATE, GAUTENG, KWAZULU_NATAL, LIMPOPO, MPUMALANGA, NORTHERN_CAPE, NORTH_WEST, WESTERN_CAPE]
 *         description: South African province
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Specific city
 *       - in: query
 *         name: isRemote
 *         schema:
 *           type: boolean
 *         description: Filter for remote jobs
 *       - in: query
 *         name: jobTypes
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, TEMPORARY, REMOTE]
 *         style: form
 *         explode: true
 *         description: Job types to filter by
 *       - in: query
 *         name: experienceLevel
 *         schema:
 *           type: string
 *           enum: [ENTRY_LEVEL, JUNIOR, MID_LEVEL, SENIOR, EXECUTIVE]
 *         description: Required experience level
 *       - in: query
 *         name: salaryMin
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Minimum salary
 *       - in: query
 *         name: salaryMax
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Maximum salary
 *       - in: query
 *         name: requiredSkills
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: form
 *         explode: true
 *         description: Required skills
 *       - in: query
 *         name: industry
 *         schema:
 *           type: string
 *         description: Industry filter
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Show only featured jobs
 *       - in: query
 *         name: postedWithin
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, 90d]
 *         description: Time filter for recently posted jobs
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of jobs per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [relevance, date, salary_asc, salary_desc, company, title]
 *           default: relevance
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/JobSearchResult'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalResults:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrevious:
 *                       type: boolean
 *                     searchTime:
 *                       type: number
 *                     filters:
 *                       type: object
 *       400:
 *         description: Invalid search filters
 */
router.get('/search', searchRateLimit, optionalAuth, jobSearchController.searchJobs);

/**
 * @swagger
 * /api/jobs/recommendations:
 *   get:
 *     summary: Get personalized job recommendations
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of recommendations to return
 *     responses:
 *       200:
 *         description: Personalized job recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/JobSearchResult'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                     userId:
 *                       type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Authentication required
 *       404:
 *         description: User profile not found
 */
router.get('/recommendations', searchRateLimit, auth, jobSearchController.getRecommendations);

/**
 * @swagger
 * /api/jobs/trending:
 *   get:
 *     summary: Get trending/popular jobs
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of trending jobs to return
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *           default: 7d
 *         description: Timeframe for trending calculation
 *     responses:
 *       200:
 *         description: Trending jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/JobSearchResult'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                     timeframe:
 *                       type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 */
router.get('/trending', searchRateLimit, optionalAuth, jobSearchController.getTrendingJobs);

/**
 * @swagger
 * /api/jobs/stats:
 *   get:
 *     summary: Get job search statistics
 *     tags: [Jobs]
 *     responses:
 *       200:
 *         description: Job search statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobs:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                         featured:
 *                           type: integer
 *                         recentlyPosted:
 *                           type: integer
 *                     companies:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                     locations:
 *                       type: object
 *                     industries:
 *                       type: object
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 */
router.get('/stats', searchRateLimit, jobSearchController.getSearchStats);

/**
 * @swagger
 * /api/jobs/{jobId}:
 *   get:
 *     summary: Get job details by ID
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/JobSearchResult'
 *                     - type: object
 *                       properties:
 *                         company:
 *                           type: object
 *                           properties:
 *                             website:
 *                               type: string
 *                               nullable: true
 *                             description:
 *                               type: string
 *                               nullable: true
 *                             founded:
 *                               type: integer
 *                               nullable: true
 *                         userInteraction:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             matchScore:
 *                               type: object
 *                               nullable: true
 *                             isSaved:
 *                               type: boolean
 *                             savedDetails:
 *                               type: object
 *                               nullable: true
 *                             hasApplied:
 *                               type: boolean
 *                             applicationDetails:
 *                               type: object
 *                               nullable: true
 *       404:
 *         description: Job not found
 *       410:
 *         description: Job is no longer active
 */
router.get('/:jobId', searchRateLimit, optionalAuth, jobSearchController.getJobById);

/**
 * @swagger
 * /api/jobs/{jobId}/similar:
 *   get:
 *     summary: Get similar jobs
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reference job ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         description: Number of similar jobs to return
 *     responses:
 *       200:
 *         description: Similar jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/JobSearchResult'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                     referenceJobId:
 *                       type: string
 *       404:
 *         description: Reference job not found
 */
router.get('/:jobId/similar', searchRateLimit, optionalAuth, jobSearchController.getSimilarJobs);

/**
 * @swagger
 * /api/jobs/saved:
 *   get:
 *     summary: Get user's saved jobs
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of saved jobs per page
 *     responses:
 *       200:
 *         description: User's saved jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       savedJobId:
 *                         type: string
 *                       notes:
 *                         type: string
 *                         nullable: true
 *                       savedAt:
 *                         type: string
 *                         format: date-time
 *                       job:
 *                         $ref: '#/components/schemas/JobSearchResult'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *       401:
 *         description: Authentication required
 *   post:
 *     summary: Save a job for later
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *             properties:
 *               jobId:
 *                 type: string
 *                 format: uuid
 *               notes:
 *                 type: string
 *                 description: Optional notes about the saved job
 *     responses:
 *       201:
 *         description: Job saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     jobId:
 *                       type: string
 *                     notes:
 *                       type: string
 *                       nullable: true
 *                     savedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Job not found
 *       410:
 *         description: Cannot save inactive job
 */
router.get('/saved', jobActionRateLimit, auth, jobSearchController.getSavedJobs);
router.post('/saved', jobActionRateLimit, auth, jobSearchController.saveJob);

/**
 * @swagger
 * /api/jobs/saved/{jobId}:
 *   delete:
 *     summary: Remove job from saved jobs
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID to remove from saved jobs
 *     responses:
 *       200:
 *         description: Job removed from saved jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Saved job not found
 */
router.delete('/saved/:jobId', jobActionRateLimit, auth, jobSearchController.unsaveJob);

export default router;
