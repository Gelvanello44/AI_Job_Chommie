import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { Province, ExperienceLevel } from '@prisma/client';
import { redis } from '../config/redis.js';

/**
 * Salary Benchmarking Service
 * Provides salary benchmarking data for roles, provinces, and experience levels in South Africa
 */
export class SalaryBenchmarkService {
  private readonly CACHE_TTL = 3600; // 1 hour cache
  private readonly CACHE_PREFIX = 'salary_benchmark:';

  /**
   * Get salary benchmark for a specific role
   */
  async getSalaryBenchmark(
    jobTitle: string,
    province: Province,
    experienceLevel: ExperienceLevel,
    industry?: string
  ): Promise<any> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${jobTitle}:${province}:${experienceLevel}:${industry || 'all'}`;
      
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Try to find exact match
      let benchmark = await prisma.salaryBenchmark.findFirst({
        where: {
          jobTitle: {
            contains: jobTitle,
            mode: 'insensitive'
          },
          province,
          experienceLevel,
          ...(industry && { industry })
        },
        orderBy: {
          lastUpdated: 'desc'
        }
      });

      // If no exact match, try broader search
      if (!benchmark) {
        benchmark = await prisma.salaryBenchmark.findFirst({
          where: {
            jobTitle: {
              contains: jobTitle,
              mode: 'insensitive'
            },
            experienceLevel
          },
          orderBy: {
            lastUpdated: 'desc'
          }
        });
      }

      // If still no match, get industry average
      if (!benchmark && industry) {
        const industryBenchmarks = await prisma.salaryBenchmark.findMany({
          where: {
            industry,
            experienceLevel,
            province
          }
        });

        if (industryBenchmarks.length > 0) {
          benchmark = this.calculateIndustryAverage(industryBenchmarks);
        }
      }

      if (!benchmark) {
        // Return estimated benchmark based on available data
        benchmark = await this.estimateSalaryBenchmark(jobTitle, province, experienceLevel);
      }

      // Add percentile data
      const enrichedBenchmark = await this.enrichBenchmarkWithPercentiles(benchmark);

      // Cache the result
      if (redis) {
        await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedBenchmark));
      }

      return enrichedBenchmark;
    } catch (error) {
      logger.error('Error getting salary benchmark', { error, jobTitle, province, experienceLevel });
      throw error;
    }
  }

  /**
   * Get salary benchmarks for multiple roles
   */
  async getMultipleBenchmarks(
    roles: Array<{
      jobTitle: string;
      province: Province;
      experienceLevel: ExperienceLevel;
      industry?: string;
    }>
  ): Promise<any[]> {
    try {
      const benchmarks = await Promise.all(
        roles.map(role => 
          this.getSalaryBenchmark(
            role.jobTitle,
            role.province,
            role.experienceLevel,
            role.industry
          )
        )
      );

      return benchmarks;
    } catch (error) {
      logger.error('Error getting multiple benchmarks', { error });
      throw error;
    }
  }

  /**
   * Compare salary with benchmark
   */
  async compareSalary(
    currentSalary: number,
    jobTitle: string,
    province: Province,
    experienceLevel: ExperienceLevel,
    industry?: string
  ): Promise<any> {
    try {
      const benchmark = await this.getSalaryBenchmark(
        jobTitle,
        province,
        experienceLevel,
        industry
      );

      if (!benchmark) {
        throw new AppError(404, 'No benchmark data available for this role');
      }

      const percentile = this.calculatePercentile(currentSalary, benchmark);
      const difference = currentSalary - benchmark.salaryMedian;
      const percentageDifference = ((difference / benchmark.salaryMedian) * 100).toFixed(1);

      return {
        benchmark,
        currentSalary,
        percentile,
        difference,
        percentageDifference,
        marketPosition: this.getMarketPosition(percentile),
        recommendation: this.getSalaryRecommendation(percentile, currentSalary, benchmark)
      };
    } catch (error) {
      logger.error('Error comparing salary', { error });
      throw error;
    }
  }

  /**
   * Get salary trends for a role
   */
  async getSalaryTrends(
    jobTitle: string,
    province: Province,
    experienceLevel: ExperienceLevel,
    months: number = 12
  ): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const benchmarks = await prisma.salaryBenchmark.findMany({
        where: {
          jobTitle: {
            contains: jobTitle,
            mode: 'insensitive'
          },
          province,
          experienceLevel,
          lastUpdated: {
            gte: startDate
          }
        },
        orderBy: {
          lastUpdated: 'asc'
        }
      });

      if (benchmarks.length === 0) {
        return {
          trends: [],
          growth: 0,
          projection: null
        };
      }

      // Calculate growth rate
      const firstBenchmark = benchmarks[0];
      const lastBenchmark = benchmarks[benchmarks.length - 1];
      const growth = ((lastBenchmark.salaryMedian - firstBenchmark.salaryMedian) / firstBenchmark.salaryMedian) * 100;

      // Project future salary
      const monthlyGrowth = growth / benchmarks.length;
      const projection = lastBenchmark.salaryMedian * (1 + (monthlyGrowth * 6) / 100);

      return {
        trends: benchmarks.map(b => ({
          date: b.lastUpdated,
          median: b.salaryMedian,
          min: b.salaryMin,
          max: b.salaryMax
        })),
        growth: growth.toFixed(1),
        monthlyGrowth: monthlyGrowth.toFixed(2),
        projection: Math.round(projection)
      };
    } catch (error) {
      logger.error('Error getting salary trends', { error });
      throw error;
    }
  }

  /**
   * Get top paying roles in a province
   */
  async getTopPayingRoles(
    province: Province,
    experienceLevel?: ExperienceLevel,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const where: any = { province };
      if (experienceLevel) {
        where.experienceLevel = experienceLevel;
      }

      const topRoles = await prisma.salaryBenchmark.findMany({
        where,
        orderBy: {
          salaryMedian: 'desc'
        },
        take: limit,
        distinct: ['jobTitle']
      });

      return topRoles.map(role => ({
        jobTitle: role.jobTitle,
        industry: role.industry,
        salaryRange: {
          min: role.salaryMin,
          max: role.salaryMax,
          median: role.salaryMedian
        },
        experienceLevel: role.experienceLevel,
        lastUpdated: role.lastUpdated
      }));
    } catch (error) {
      logger.error('Error getting top paying roles', { error });
      throw error;
    }
  }

  /**
   * Get salary by province comparison
   */
  async getProvinceComparison(
    jobTitle: string,
    experienceLevel: ExperienceLevel
  ): Promise<any> {
    try {
      const provinces = Object.values(Province);
      const comparisons = await Promise.all(
        provinces.map(async (province) => {
          const benchmark = await prisma.salaryBenchmark.findFirst({
            where: {
              jobTitle: {
                contains: jobTitle,
                mode: 'insensitive'
              },
              province,
              experienceLevel
            },
            orderBy: {
              lastUpdated: 'desc'
            }
          });

          return {
            province,
            salary: benchmark ? {
              min: benchmark.salaryMin,
              max: benchmark.salaryMax,
              median: benchmark.salaryMedian
            } : null
          };
        })
      );

      // Sort by median salary
      const sorted = comparisons
        .filter(c => c.salary !== null)
        .sort((a, b) => (b.salary?.median || 0) - (a.salary?.median || 0));

      return {
        jobTitle,
        experienceLevel,
        provinces: sorted,
        highestPaying: sorted[0]?.province,
        lowestPaying: sorted[sorted.length - 1]?.province,
        variance: this.calculateVariance(sorted)
      };
    } catch (error) {
      logger.error('Error comparing provinces', { error });
      throw error;
    }
  }

  /**
   * Add or update salary benchmark data
   */
  async addOrUpdateBenchmark(data: {
    jobTitle: string;
    industry: string;
    experienceLevel: ExperienceLevel;
    province: Province;
    city?: string;
    salaryMin: number;
    salaryMax: number;
    salaryMedian: number;
    sampleSize?: number;
    dataSource?: string[];
  }): Promise<any> {
    try {
      // Check if benchmark exists
      const existing = await prisma.salaryBenchmark.findFirst({
        where: {
          jobTitle: data.jobTitle,
          industry: data.industry,
          experienceLevel: data.experienceLevel,
          province: data.province
        }
      });

      if (existing) {
        // Update existing benchmark
        const updated = await prisma.salaryBenchmark.update({
          where: { id: existing.id },
          data: {
            salaryMin: data.salaryMin,
            salaryMax: data.salaryMax,
            salaryMedian: data.salaryMedian,
            sampleSize: data.sampleSize || existing.sampleSize,
            dataSource: data.dataSource || existing.dataSource,
            lastUpdated: new Date(),
            confidence: this.calculateConfidence(data.sampleSize || existing.sampleSize)
          }
        });

        logger.info('Salary benchmark updated', { benchmarkId: updated.id });
        return updated;
      } else {
        // Create new benchmark
        const created = await prisma.salaryBenchmark.create({
          data: {
            ...data,
            sampleSize: data.sampleSize || 1,
            confidence: this.calculateConfidence(data.sampleSize || 1),
            dataSource: data.dataSource || ['manual'],
            lastUpdated: new Date()
          }
        });

        logger.info('Salary benchmark created', { benchmarkId: created.id });
        return created;
      }
    } catch (error) {
      logger.error('Error adding/updating benchmark', { error });
      throw error;
    }
  }

  /**
   * Import salary data from external sources
   */
  async importSalaryData(
    source: string,
    data: Array<{
      jobTitle: string;
      industry: string;
      experienceLevel: string;
      province: string;
      salaryMin: number;
      salaryMax: number;
      salaryMedian: number;
    }>
  ): Promise<any> {
    try {
      const results = {
        imported: 0,
        updated: 0,
        failed: 0,
        errors: [] as any[]
      };

      for (const item of data) {
        try {
          // Validate and map experience level
          const experienceLevel = this.mapExperienceLevel(item.experienceLevel);
          const province = this.mapProvince(item.province);

          if (!experienceLevel || !province) {
            results.failed++;
            results.errors.push({
              item,
              error: 'Invalid experience level or province'
            });
            continue;
          }

          await this.addOrUpdateBenchmark({
            jobTitle: item.jobTitle,
            industry: item.industry,
            experienceLevel,
            province,
            salaryMin: item.salaryMin,
            salaryMax: item.salaryMax,
            salaryMedian: item.salaryMedian,
            dataSource: [source]
          });

          results.imported++;
        } catch (error) {
          results.failed++;
          results.errors.push({ item, error });
        }
      }

      logger.info('Salary data import completed', { source, results });
      return results;
    } catch (error) {
      logger.error('Error importing salary data', { error });
      throw error;
    }
  }

  // Private helper methods

  private calculateIndustryAverage(benchmarks: any[]): any {
    const avgMin = benchmarks.reduce((sum, b) => sum + b.salaryMin, 0) / benchmarks.length;
    const avgMax = benchmarks.reduce((sum, b) => sum + b.salaryMax, 0) / benchmarks.length;
    const avgMedian = benchmarks.reduce((sum, b) => sum + b.salaryMedian, 0) / benchmarks.length;

    return {
      salaryMin: Math.round(avgMin),
      salaryMax: Math.round(avgMax),
      salaryMedian: Math.round(avgMedian),
      sampleSize: benchmarks.reduce((sum, b) => sum + b.sampleSize, 0),
      confidence: 75,
      dataSource: ['industry_average'],
      lastUpdated: new Date()
    };
  }

  private async estimateSalaryBenchmark(
    jobTitle: string,
    province: Province,
    experienceLevel: ExperienceLevel
  ): Promise<any> {
    // Base salaries for different experience levels (in ZAR annually)
    const baseSalaries = {
      ENTRY_LEVEL: { min: 180000, max: 300000, median: 240000 },
      JUNIOR: { min: 300000, max: 500000, median: 400000 },
      MID_LEVEL: { min: 500000, max: 800000, median: 650000 },
      SENIOR: { min: 800000, max: 1500000, median: 1100000 },
      EXECUTIVE: { min: 1500000, max: 3000000, median: 2000000 }
    };

    // Province multipliers (Gauteng as baseline 1.0)
    const provinceMultipliers: Record<Province, number> = {
      GAUTENG: 1.0,
      WESTERN_CAPE: 0.95,
      KWAZULU_NATAL: 0.85,
      EASTERN_CAPE: 0.75,
      FREE_STATE: 0.75,
      MPUMALANGA: 0.80,
      LIMPOPO: 0.70,
      NORTH_WEST: 0.75,
      NORTHERN_CAPE: 0.75
    };

    const base = baseSalaries[experienceLevel];
    const multiplier = provinceMultipliers[province];

    return {
      jobTitle,
      province,
      experienceLevel,
      salaryMin: Math.round(base.min * multiplier),
      salaryMax: Math.round(base.max * multiplier),
      salaryMedian: Math.round(base.median * multiplier),
      sampleSize: 0,
      confidence: 30,
      dataSource: ['estimated'],
      lastUpdated: new Date(),
      isEstimated: true
    };
  }

  private async enrichBenchmarkWithPercentiles(benchmark: any): Promise<any> {
    if (!benchmark) return null;

    const percentiles = {
      p10: benchmark.salaryMin + (benchmark.salaryMedian - benchmark.salaryMin) * 0.2,
      p25: benchmark.salaryMin + (benchmark.salaryMedian - benchmark.salaryMin) * 0.5,
      p50: benchmark.salaryMedian,
      p75: benchmark.salaryMedian + (benchmark.salaryMax - benchmark.salaryMedian) * 0.5,
      p90: benchmark.salaryMedian + (benchmark.salaryMax - benchmark.salaryMedian) * 0.8
    };

    return {
      ...benchmark,
      percentiles,
      range: benchmark.salaryMax - benchmark.salaryMin,
      currency: benchmark.salaryCurrency || 'ZAR',
      period: benchmark.salaryPeriod || 'annually'
    };
  }

  private calculatePercentile(salary: number, benchmark: any): number {
    if (salary <= benchmark.salaryMin) return 0;
    if (salary >= benchmark.salaryMax) return 100;

    if (salary <= benchmark.salaryMedian) {
      const range = benchmark.salaryMedian - benchmark.salaryMin;
      const position = salary - benchmark.salaryMin;
      return Math.round((position / range) * 50);
    } else {
      const range = benchmark.salaryMax - benchmark.salaryMedian;
      const position = salary - benchmark.salaryMedian;
      return Math.round(50 + (position / range) * 50);
    }
  }

  private getMarketPosition(percentile: number): string {
    if (percentile < 25) return 'Below Market';
    if (percentile < 50) return 'Lower Market';
    if (percentile < 75) return 'Market Average';
    if (percentile < 90) return 'Above Market';
    return 'Top of Market';
  }

  private getSalaryRecommendation(
    percentile: number,
    currentSalary: number,
    benchmark: any
  ): string {
    if (percentile < 25) {
      return `Your salary is below market rate. Consider negotiating for at least R${benchmark.percentiles.p25.toLocaleString()} to reach the 25th percentile.`;
    } else if (percentile < 50) {
      return `Your salary is in the lower market range. The median salary for this role is R${benchmark.salaryMedian.toLocaleString()}.`;
    } else if (percentile < 75) {
      return `Your salary is at market average. You're well-positioned but could aim for R${benchmark.percentiles.p75.toLocaleString()} with additional skills or experience.`;
    } else if (percentile < 90) {
      return `Your salary is above market average. You're in a strong position earning more than 75% of professionals in similar roles.`;
    } else {
      return `Your salary is at the top of the market. You're earning more than 90% of professionals in similar roles.`;
    }
  }

  private calculateVariance(provinces: any[]): number {
    const salaries = provinces.map(p => p.salary?.median || 0).filter(s => s > 0);
    if (salaries.length === 0) return 0;

    const mean = salaries.reduce((sum, s) => sum + s, 0) / salaries.length;
    const variance = salaries.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / salaries.length;
    
    return Math.round(Math.sqrt(variance));
  }

  private calculateConfidence(sampleSize: number): number {
    if (sampleSize >= 100) return 95;
    if (sampleSize >= 50) return 85;
    if (sampleSize >= 20) return 75;
    if (sampleSize >= 10) return 65;
    if (sampleSize >= 5) return 50;
    return 30;
  }

  private mapExperienceLevel(level: string): ExperienceLevel | null {
    const mapping: Record<string, ExperienceLevel> = {
      'entry': ExperienceLevel.ENTRY_LEVEL,
      'entry_level': ExperienceLevel.ENTRY_LEVEL,
      'junior': ExperienceLevel.JUNIOR,
      'mid': ExperienceLevel.MID_LEVEL,
      'mid_level': ExperienceLevel.MID_LEVEL,
      'senior': ExperienceLevel.SENIOR,
      'executive': ExperienceLevel.EXECUTIVE,
      'leadership': ExperienceLevel.EXECUTIVE
    };

    return mapping[level.toLowerCase()] || null;
  }

  private mapProvince(province: string): Province | null {
    const mapping: Record<string, Province> = {
      'gauteng': Province.GAUTENG,
      'gp': Province.GAUTENG,
      'western_cape': Province.WESTERN_CAPE,
      'wc': Province.WESTERN_CAPE,
      'kwazulu_natal': Province.KWAZULU_NATAL,
      'kzn': Province.KWAZULU_NATAL,
      'eastern_cape': Province.EASTERN_CAPE,
      'ec': Province.EASTERN_CAPE,
      'free_state': Province.FREE_STATE,
      'fs': Province.FREE_STATE,
      'mpumalanga': Province.MPUMALANGA,
      'mp': Province.MPUMALANGA,
      'limpopo': Province.LIMPOPO,
      'lp': Province.LIMPOPO,
      'north_west': Province.NORTH_WEST,
      'nw': Province.NORTH_WEST,
      'northern_cape': Province.NORTHERN_CAPE,
      'nc': Province.NORTHERN_CAPE
    };

    return mapping[province.toLowerCase().replace(/\s+/g, '_')] || null;
  }
}

export const salaryBenchmarkService = new SalaryBenchmarkService();
