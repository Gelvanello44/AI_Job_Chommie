import { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { salaryBenchmarkService } from '../services/salary-benchmark.service.js';
import logger from '../config/logger.js';
import { z } from 'zod';
import { Province, ExperienceLevel } from '@prisma/client';

// Validation schemas
const getBenchmarkSchema = z.object({
  jobTitle: z.string().min(2).max(100),
  province: z.nativeEnum(Province),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  industry: z.string().optional()
});

const compareSalarySchema = z.object({
  currentSalary: z.number().positive(),
  jobTitle: z.string().min(2).max(100),
  province: z.nativeEnum(Province),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  industry: z.string().optional()
});

const getTrendsSchema = z.object({
  jobTitle: z.string().min(2).max(100),
  province: z.nativeEnum(Province),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  months: z.number().min(1).max(36).optional()
});

const addBenchmarkSchema = z.object({
  jobTitle: z.string().min(2).max(100),
  industry: z.string().min(2).max(100),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  province: z.nativeEnum(Province),
  city: z.string().optional(),
  salaryMin: z.number().positive(),
  salaryMax: z.number().positive(),
  salaryMedian: z.number().positive(),
  sampleSize: z.number().positive().optional(),
  dataSource: z.array(z.string()).optional()
});

/**
 * Salary Benchmark Controller
 * Handles salary benchmarking endpoints
 */
export class SalaryBenchmarkController {
  /**
   * Get salary benchmark for a role
   */
  async getBenchmark(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = getBenchmarkSchema.parse(req.query);

      const benchmark = await salaryBenchmarkService.getSalaryBenchmark(
        validatedData.jobTitle,
        validatedData.province,
        validatedData.experienceLevel,
        validatedData.industry
      );

      res.json({
        success: true,
        data: benchmark
      });

    } catch (error) {
      logger.error('Error getting salary benchmark', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid benchmark parameters', error.errors);
      }
      throw new AppError(500, 'Failed to retrieve salary benchmark');
    }
  }

  /**
   * Get multiple salary benchmarks
   */
  async getMultipleBenchmarks(req: Request, res: Response): Promise<void> {
    try {
      const { roles } = req.body;

      if (!Array.isArray(roles) || roles.length === 0) {
        throw new AppError(400, 'Roles array is required');
      }

      if (roles.length > 10) {
        throw new AppError(400, 'Maximum 10 roles allowed per request');
      }

      // Validate each role
      const validatedRoles = roles.map(role => ({
        jobTitle: z.string().min(2).max(100).parse(role.jobTitle),
        province: z.nativeEnum(Province).parse(role.province),
        experienceLevel: z.nativeEnum(ExperienceLevel).parse(role.experienceLevel),
        industry: role.industry ? z.string().parse(role.industry) : undefined
      }));

      const benchmarks = await salaryBenchmarkService.getMultipleBenchmarks(validatedRoles);

      res.json({
        success: true,
        data: benchmarks
      });

    } catch (error) {
      logger.error('Error getting multiple benchmarks', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid role data', error.errors);
      }
      throw error;
    }
  }

  /**
   * Compare current salary with benchmark
   */
  async compareSalary(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = compareSalarySchema.parse(req.body);

      const comparison = await salaryBenchmarkService.compareSalary(
        validatedData.currentSalary,
        validatedData.jobTitle,
        validatedData.province,
        validatedData.experienceLevel,
        validatedData.industry
      );

      res.json({
        success: true,
        data: comparison
      });

    } catch (error) {
      logger.error('Error comparing salary', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid comparison data', error.errors);
      }
      throw error;
    }
  }

  /**
   * Get salary trends for a role
   */
  async getSalaryTrends(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = getTrendsSchema.parse(req.query);

      const trends = await salaryBenchmarkService.getSalaryTrends(
        validatedData.jobTitle,
        validatedData.province,
        validatedData.experienceLevel,
        validatedData.months
      );

      res.json({
        success: true,
        data: trends
      });

    } catch (error) {
      logger.error('Error getting salary trends', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid trend parameters', error.errors);
      }
      throw new AppError(500, 'Failed to retrieve salary trends');
    }
  }

  /**
   * Get top paying roles in a province
   */
  async getTopPayingRoles(req: Request, res: Response): Promise<void> {
    try {
      const { province, experienceLevel, limit } = req.query;

      if (!province || !Object.values(Province).includes(province as Province)) {
        throw new AppError(400, 'Valid province is required');
      }

      const experienceLevelEnum = experienceLevel ? 
        z.nativeEnum(ExperienceLevel).parse(experienceLevel) : 
        undefined;

      const limitNum = limit ? parseInt(limit as string) : 10;
      if (limitNum < 1 || limitNum > 50) {
        throw new AppError(400, 'Limit must be between 1 and 50');
      }

      const topRoles = await salaryBenchmarkService.getTopPayingRoles(
        province as Province,
        experienceLevelEnum,
        limitNum
      );

      res.json({
        success: true,
        data: topRoles
      });

    } catch (error) {
      logger.error('Error getting top paying roles', { error });
      throw error;
    }
  }

  /**
   * Compare salary across provinces
   */
  async getProvinceComparison(req: Request, res: Response): Promise<void> {
    try {
      const { jobTitle, experienceLevel } = req.query;

      if (!jobTitle || typeof jobTitle !== 'string') {
        throw new AppError(400, 'Job title is required');
      }

      if (!experienceLevel || !Object.values(ExperienceLevel).includes(experienceLevel as ExperienceLevel)) {
        throw new AppError(400, 'Valid experience level is required');
      }

      const comparison = await salaryBenchmarkService.getProvinceComparison(
        jobTitle,
        experienceLevel as ExperienceLevel
      );

      res.json({
        success: true,
        data: comparison
      });

    } catch (error) {
      logger.error('Error comparing provinces', { error });
      throw new AppError(500, 'Failed to compare provinces');
    }
  }

  /**
   * Add or update salary benchmark (admin only)
   */
  async addOrUpdateBenchmark(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (req.user?.role !== 'ADMIN') {
        throw new AppError(403, 'Admin access required');
      }

      const validatedData = addBenchmarkSchema.parse(req.body);

      // Validate salary ranges
      if (validatedData.salaryMin > validatedData.salaryMedian) {
        throw new AppError(400, 'Minimum salary cannot be greater than median');
      }
      if (validatedData.salaryMedian > validatedData.salaryMax) {
        throw new AppError(400, 'Median salary cannot be greater than maximum');
      }

      const benchmark = await salaryBenchmarkService.addOrUpdateBenchmark(validatedData);

      res.json({
        success: true,
        message: 'Salary benchmark added/updated successfully',
        data: benchmark
      });

    } catch (error) {
      logger.error('Error adding/updating benchmark', { error });
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid benchmark data', error.errors);
      }
      throw error;
    }
  }

  /**
   * Import salary data from CSV or JSON (admin only)
   */
  async importSalaryData(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (req.user?.role !== 'ADMIN') {
        throw new AppError(403, 'Admin access required');
      }

      const { source, data } = req.body;

      if (!source || !data || !Array.isArray(data)) {
        throw new AppError(400, 'Source and data array are required');
      }

      if (data.length > 1000) {
        throw new AppError(400, 'Maximum 1000 records allowed per import');
      }

      const results = await salaryBenchmarkService.importSalaryData(source, data);

      res.json({
        success: true,
        message: 'Salary data import completed',
        data: results
      });

    } catch (error) {
      logger.error('Error importing salary data', { error });
      throw error;
    }
  }

  /**
   * Get salary widget data for job listing
   */
  async getSalaryWidget(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      // Get job details to extract role info
      const { prisma } = await import('../config/database.js');
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: {
          title: true,
          province: true,
          experienceLevel: true,
          industry: true,
          salaryMin: true,
          salaryMax: true
        }
      });

      if (!job) {
        throw new AppError(404, 'Job not found');
      }

      // Get benchmark for this job
      const benchmark = await salaryBenchmarkService.getSalaryBenchmark(
        job.title,
        job.province,
        job.experienceLevel,
        job.industry
      );

      // Create widget data
      const widgetData = {
        jobSalary: {
          min: job.salaryMin,
          max: job.salaryMax,
          currency: 'ZAR'
        },
        marketBenchmark: benchmark ? {
          min: benchmark.salaryMin,
          max: benchmark.salaryMax,
          median: benchmark.salaryMedian,
          percentiles: benchmark.percentiles,
          confidence: benchmark.confidence,
          isEstimated: benchmark.isEstimated || false
        } : null,
        comparison: job.salaryMin && benchmark ? {
          position: salaryBenchmarkService['getMarketPosition'](
            salaryBenchmarkService['calculatePercentile'](
              (job.salaryMin + (job.salaryMax || job.salaryMin)) / 2,
              benchmark
            )
          ),
          isCompetitive: ((job.salaryMin + (job.salaryMax || job.salaryMin)) / 2) >= benchmark.salaryMedian
        } : null
      };

      res.json({
        success: true,
        data: widgetData
      });

    } catch (error) {
      logger.error('Error getting salary widget', { error });
      throw new AppError(500, 'Failed to get salary widget data');
    }
  }
}

export const salaryBenchmarkController = new SalaryBenchmarkController();
