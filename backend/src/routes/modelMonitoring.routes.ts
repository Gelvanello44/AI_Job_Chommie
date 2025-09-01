import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';
import { modelMonitoringController } from '../controllers/modelMonitoring.controller.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
};

/**
 * GET /api/v1/monitoring/metrics
 * Get overall model performance metrics
 */
router.get('/metrics',
  query('period').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid period'),
  query('modelType').optional().isString(),
  handleValidationErrors,
  modelMonitoringController.getPerformanceMetrics.bind(modelMonitoringController)
);

/**
 * GET /api/v1/monitoring/accuracy
 * Get model accuracy metrics
 */
router.get('/accuracy',
  query('modelType').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  handleValidationErrors,
  modelMonitoringController.getAccuracyMetrics.bind(modelMonitoringController)
);

/**
 * GET /api/v1/monitoring/predictions
 * Get prediction analytics
 */
router.get('/predictions',
  query('userId').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  handleValidationErrors,
  modelMonitoringController.getPredictionAnalytics.bind(modelMonitoringController)
);

/**
 * GET /api/v1/monitoring/drift
 * Get model drift detection results
 */
router.get('/drift',
  query('modelType').optional().isString(),
  query('sensitivity').optional().isIn(['low', 'medium', 'high']),
  handleValidationErrors,
  modelMonitoringController.getDriftAnalysis.bind(modelMonitoringController)
);

/**
 * GET /api/v1/monitoring/alerts
 * Get performance alerts
 */
router.get('/alerts',
  query('severity').optional().isIn(['low', 'medium', 'high', 'all']),
  query('resolved').optional().isBoolean(),
  handleValidationErrors,
  modelMonitoringController.getPerformanceAlerts.bind(modelMonitoringController)
);

/**
 * GET /api/v1/monitoring/compare
 * Compare multiple models
 */
router.get('/compare',
  query('models').isArray({ min: 2, max: 10 }).withMessage('2-10 models required'),
  query('metric').optional().isIn(['accuracy', 'precision', 'recall', 'f1Score', 'latency']),
  handleValidationErrors,
  modelMonitoringController.getModelComparison.bind(modelMonitoringController)
);

/**
 * GET /api/v1/monitoring/features
 * Get feature importance analysis
 */
router.get('/features',
  query('modelType').optional().isString(),
  query('topN').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
  modelMonitoringController.getFeatureImportance.bind(modelMonitoringController)
);

/**
 * GET /api/v1/monitoring/training
 * Get training metrics history
 */
router.get('/training',
  query('modelType').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors,
  modelMonitoringController.getTrainingHistory.bind(modelMonitoringController)
);

/**
 * GET /api/v1/monitoring/dashboard
 * Get dashboard data for monitoring UI
 */
router.get('/dashboard',
  handleValidationErrors,
  modelMonitoringController.getDashboardData.bind(modelMonitoringController)
);

/**
 * POST /api/v1/monitoring/log
 * Log a model prediction for monitoring
 */
router.post('/log',
  body('modelType').isString().withMessage('Model type is required'),
  body('prediction').notEmpty().withMessage('Prediction is required'),
  body('confidence').isFloat({ min: 0, max: 1 }).withMessage('Confidence must be between 0 and 1'),
  body('features').isObject().withMessage('Features object is required'),
  body('userId').optional().isUUID(),
  body('actual').optional(),
  handleValidationErrors,
  modelMonitoringController.logPrediction.bind(modelMonitoringController)
);

export default router;
