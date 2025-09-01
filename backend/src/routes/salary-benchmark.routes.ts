import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { body, param, query, validationResult } from 'express-validator';
import { salaryBenchmarkController } from '../controllers/salary-benchmark.controller.js';

const router = Router();

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

// Public routes (no authentication required for basic benchmarks)

/**
 * GET /api/v1/salary-benchmark
 * Get salary benchmark for a role
 */
router.get('/',
  query('jobTitle').isString().isLength({ min: 2, max: 100 }),
  query('province').isString().notEmpty(),
  query('experienceLevel').isString().notEmpty(),
  query('industry').optional().isString(),
  handleValidationErrors,
  salaryBenchmarkController.getBenchmark.bind(salaryBenchmarkController)
);

/**
 * GET /api/v1/salary-benchmark/trends
 * Get salary trends for a role
 */
router.get('/trends',
  query('jobTitle').isString().isLength({ min: 2, max: 100 }),
  query('province').isString().notEmpty(),
  query('experienceLevel').isString().notEmpty(),
  query('months').optional().isInt({ min: 1, max: 36 }),
  handleValidationErrors,
  salaryBenchmarkController.getSalaryTrends.bind(salaryBenchmarkController)
);

/**
 * GET /api/v1/salary-benchmark/top-paying
 * Get top paying roles in a province
 */
router.get('/top-paying',
  query('province').isString().notEmpty(),
  query('experienceLevel').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
  salaryBenchmarkController.getTopPayingRoles.bind(salaryBenchmarkController)
);

/**
 * GET /api/v1/salary-benchmark/province-comparison
 * Compare salary across provinces
 */
router.get('/province-comparison',
  query('jobTitle').isString().isLength({ min: 2, max: 100 }),
  query('experienceLevel').isString().notEmpty(),
  handleValidationErrors,
  salaryBenchmarkController.getProvinceComparison.bind(salaryBenchmarkController)
);

/**
 * GET /api/v1/salary-benchmark/widget/:jobId
 * Get salary widget data for a job listing
 */
router.get('/widget/:jobId',
  param('jobId').isUUID(),
  handleValidationErrors,
  salaryBenchmarkController.getSalaryWidget.bind(salaryBenchmarkController)
);

// Apply authentication to remaining routes
router.use(authenticate);

/**
 * POST /api/v1/salary-benchmark/compare
 * Compare current salary with benchmark
 */
router.post('/compare',
  body('currentSalary').isFloat({ min: 0 }),
  body('jobTitle').isString().isLength({ min: 2, max: 100 }),
  body('province').isString().notEmpty(),
  body('experienceLevel').isString().notEmpty(),
  body('industry').optional().isString(),
  handleValidationErrors,
  salaryBenchmarkController.compareSalary.bind(salaryBenchmarkController)
);

/**
 * POST /api/v1/salary-benchmark/multiple
 * Get multiple salary benchmarks
 */
router.post('/multiple',
  body('roles').isArray({ min: 1, max: 10 }),
  body('roles.*.jobTitle').isString().isLength({ min: 2, max: 100 }),
  body('roles.*.province').isString().notEmpty(),
  body('roles.*.experienceLevel').isString().notEmpty(),
  body('roles.*.industry').optional().isString(),
  handleValidationErrors,
  salaryBenchmarkController.getMultipleBenchmarks.bind(salaryBenchmarkController)
);

// Admin only routes
/**
 * POST /api/v1/salary-benchmark/admin/add
 * Add or update salary benchmark (admin only)
 */
router.post('/admin/add',
  body('jobTitle').isString().isLength({ min: 2, max: 100 }),
  body('industry').isString().isLength({ min: 2, max: 100 }),
  body('experienceLevel').isString().notEmpty(),
  body('province').isString().notEmpty(),
  body('city').optional().isString(),
  body('salaryMin').isFloat({ min: 0 }),
  body('salaryMax').isFloat({ min: 0 }),
  body('salaryMedian').isFloat({ min: 0 }),
  body('sampleSize').optional().isInt({ min: 1 }),
  body('dataSource').optional().isArray(),
  handleValidationErrors,
  salaryBenchmarkController.addOrUpdateBenchmark.bind(salaryBenchmarkController)
);

/**
 * POST /api/v1/salary-benchmark/admin/import
 * Import salary data from external source (admin only)
 */
router.post('/admin/import',
  body('source').isString().notEmpty(),
  body('data').isArray({ min: 1, max: 1000 }),
  body('data.*.jobTitle').isString(),
  body('data.*.industry').isString(),
  body('data.*.experienceLevel').isString(),
  body('data.*.province').isString(),
  body('data.*.salaryMin').isFloat({ min: 0 }),
  body('data.*.salaryMax').isFloat({ min: 0 }),
  body('data.*.salaryMedian').isFloat({ min: 0 }),
  handleValidationErrors,
  salaryBenchmarkController.importSalaryData.bind(salaryBenchmarkController)
);

export default router;
