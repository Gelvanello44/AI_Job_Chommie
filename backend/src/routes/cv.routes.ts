import { Router } from 'express';
import cvController from '../controllers/cv.controller.js';
import { authenticate } from '../middleware/auth.js';
import { csrfProtectUserData, sensitiveOperationCSRF } from '../middleware/csrf';
import { basicXSSProtection, fileUploadXSSProtection } from '../middleware/xss';

const router = Router();

// Apply authentication middleware to all CV routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     CvTemplate:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *     CvDocument:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         atsScore:
 *           type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/cv/templates:
 *   get:
 *     summary: Get available CV templates for user's plan
 *     tags: [CV Builder]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CV templates retrieved successfully
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
 *                     templates:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CvTemplate'
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/templates', cvController.getTemplates);

/**
 * @swagger
 * /api/v1/cv/documents:
 *   get:
 *     summary: Get user's CV documents
 *     tags: [CV Builder]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CV documents retrieved successfully
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
 *                     cvs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CvDocument'
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Create a new CV document
 *     tags: [CV Builder]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *               - personalInfo
 *             properties:
 *               templateId:
 *                 type: string
 *               personalInfo:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   phone:
 *                     type: string
 *                   location:
 *                     type: string
 *                   headline:
 *                     type: string
 *                   summary:
 *                     type: string
 *               experience:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     company:
 *                       type: string
 *                     role:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                     endDate:
 *                       type: string
 *                     description:
 *                       type: string
 *                     achievements:
 *                       type: array
 *                       items:
 *                         type: string
 *               education:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     institution:
 *                       type: string
 *                     degree:
 *                       type: string
 *                     fieldOfStudy:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                     endDate:
 *                       type: string
 *                     grade:
 *                       type: string
 *               skills:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     category:
 *                       type: string
 *                     proficiency:
 *                       type: number
 *                       minimum: 1
 *                       maximum: 5
 *     responses:
 *       201:
 *         description: CV document created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Template requires higher subscription plan
 *       500:
 *         description: Internal server error
 */
router.get('/documents', cvController.getUserDocuments);
router.post('/documents', ...basicXSSProtection, cvController.createDocument);

/**
 * @swagger
 * /api/v1/cv/documents/{id}:
 *   get:
 *     summary: Get specific CV document
 *     tags: [CV Builder]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: CV document ID
 *     responses:
 *       200:
 *         description: CV document retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: CV document not found
 *       500:
 *         description: Internal server error
 *   put:
 *     summary: Update CV document
 *     tags: [CV Builder]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: CV document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               personalInfo:
 *                 type: object
 *               experience:
 *                 type: array
 *               education:
 *                 type: array
 *               skills:
 *                 type: array
 *     responses:
 *       200:
 *         description: CV document updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: CV document not found
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete CV document
 *     tags: [CV Builder]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: CV document ID
 *     responses:
 *       200:
 *         description: CV document deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: CV document not found
 *       500:
 *         description: Internal server error
 */
router.get('/documents/:id', cvController.getDocument);
router.put('/documents/:id', ...basicXSSProtection, cvController.updateDocument);
router.delete('/documents/:id', ...sensitiveOperationCSRF(), cvController.deleteDocument);

/**
 * @swagger
 * /api/v1/cv/documents/{id}/export:
 *   post:
 *     summary: Export CV to PDF
 *     tags: [CV Builder]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: CV document ID
 *     responses:
 *       200:
 *         description: CV exported successfully
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
 *                     downloadUrl:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: CV document not found
 *       500:
 *         description: Internal server error
 */
router.post('/documents/:id/export', cvController.exportToPdf);

/**
 * @swagger
 * /api/v1/cv/documents/{id}/download:
 *   get:
 *     summary: Download CV PDF file
 *     tags: [CV Builder]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: CV document ID
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: CV document not found
 *       500:
 *         description: Internal server error
 */
router.get('/documents/:id/download', cvController.downloadPdf);

export default router;
