import express from 'express';
import scrapingIntegrationController from '../controllers/scrapingIntegration.controller.js';
import { auth, adminAuth } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Rate limiting configurations
const scrapingRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 scraping requests per 15 minutes
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Too many scraping requests. Please try again later.',
    code: 'SCRAPING_RATE_LIMIT'
  }
});

const adminScrapingRateLimit = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 admin scraping requests per 5 minutes
  keyGenerator: (req) => req.user?.id,
  message: {
    success: false,
    error: 'Too many admin scraping requests. Please try again later.',
    code: 'ADMIN_SCRAPING_RATE_LIMIT'
  }
});

/**
 * @swagger
 * tags:
 *   name: Scraping
 *   description: Advanced job scraping integration endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ScrapingTaskRequest:
 *       type: object
 *       required:
 *         - source
 *       properties:
 *         source:
 *           type: string
 *           description: Job board source (e.g., 'indeed', 'linkedin', 'careers24')
 *         keywords:
 *           type: string
 *           description: Search keywords
 *         location:
 *           type: string
 *           description: Job location
 *         maxJobs:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *           description: Maximum number of jobs to scrape
 *         priority:
 *           type: string
 *           enum: [low, medium, high]
 *           default: medium
 *         tier:
 *           type: string
 *           enum: [FREE, PROFESSIONAL, EXECUTIVE, ENTERPRISE]
 *     
 *     ScrapingTaskResponse:
 *       type: object
 *       properties:
 *         taskId:
 *           type: string
 *           description: Unique task identifier
 *         status:
 *           type: string
 *           description: Task status
 *         message:
 *           type: string
 *           description: Status message
 *         estimatedCompletion:
 *           type: number
 *           description: Estimated completion timestamp
 *         orchestratorStatus:
 *           type: object
 *           properties:
 *             activeWorkers:
 *               type: integer
 *             queueSize:
 *               type: integer
 *             jobsScrapedToday:
 *               type: integer
 */

/**
 * @swagger
 * /api/scraping/tasks:
 *   post:
 *     summary: Start a new job scraping task
 *     tags: [Scraping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScrapingTaskRequest'
 *     responses:
 *       200:
 *         description: Scraping task started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ScrapingTaskResponse'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/tasks', scrapingRateLimit, auth, scrapingIntegrationController.startScrapingTask);

/**
 * @swagger
 * /api/scraping/tasks/{taskId}/status:
 *   get:
 *     summary: Get scraping task status
 *     tags: [Scraping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task status retrieved successfully
 *       400:
 *         description: Invalid task ID
 *       404:
 *         description: Task not found
 */
router.get('/tasks/:taskId/status', auth, scrapingIntegrationController.getTaskStatus);

/**
 * @swagger
 * /api/scraping/orchestrator/status:
 *   get:
 *     summary: Get scraping orchestrator status
 *     tags: [Scraping]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orchestrator status retrieved successfully
 */
router.get('/orchestrator/status', auth, scrapingIntegrationController.getOrchestratorStatus);

/**
 * @swagger
 * /api/scraping/orchestrator/start:
 *   post:
 *     summary: Start the scraping orchestrator (Admin only)
 *     tags: [Scraping]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orchestrator started successfully
 *       403:
 *         description: Admin privileges required
 */
router.post('/orchestrator/start', adminScrapingRateLimit, adminAuth, scrapingIntegrationController.startOrchestrator);

/**
 * @swagger
 * /api/scraping/orchestrator/stop:
 *   post:
 *     summary: Stop the scraping orchestrator (Admin only)
 *     tags: [Scraping]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orchestrator stopped successfully
 *       403:
 *         description: Admin privileges required
 */
router.post('/orchestrator/stop', adminScrapingRateLimit, adminAuth, scrapingIntegrationController.stopOrchestrator);

/**
 * @swagger
 * /api/scraping/bulk:
 *   post:
 *     summary: Start bulk scraping tasks (Admin only)
 *     tags: [Scraping]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sources
 *             properties:
 *               sources:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of job board sources
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Search keywords
 *               maxJobsPerSource:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 500
 *                 default: 100
 *     responses:
 *       200:
 *         description: Bulk scraping started successfully
 *       403:
 *         description: Admin privileges required
 */
router.post('/bulk', adminScrapingRateLimit, adminAuth, scrapingIntegrationController.bulkScrapeJobs);

/**
 * @swagger
 * /api/scraping/health:
 *   get:
 *     summary: Get scraping service health
 *     tags: [Scraping]
 *     responses:
 *       200:
 *         description: Service health status
 */
router.get('/health', scrapingIntegrationController.getServiceHealth);

/**
 * @swagger
 * /api/scraping/stats:
 *   get:
 *     summary: Get system-wide scraping statistics (Admin only)
 *     tags: [Scraping]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System scraping statistics
 *       403:
 *         description: Admin privileges required
 */
router.get('/stats', adminAuth, scrapingIntegrationController.getSystemStats);

/**
 * @swagger
 * /api/scraping/history:
 *   get:
 *     summary: Get user's scraping history
 *     tags: [Scraping]
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
 *         description: Number of history items to return
 *     responses:
 *       200:
 *         description: User scraping history
 *       401:
 *         description: Authentication required
 */
router.get('/history', auth, scrapingIntegrationController.getUserScrapingHistory);

export default router;
