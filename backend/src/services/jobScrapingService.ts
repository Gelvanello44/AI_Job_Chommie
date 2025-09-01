import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

interface ScrapedJob {
  title: string;
  description: string;
  company: string;
  location: string;
  salary?: string;
  jobType?: string;
  requirements?: string[];
  benefits?: string[];
  sourceUrl: string;
  externalId: string;
  postedDate?: Date;
}

interface JobBoardConfig {
  name: string;
  baseUrl: string;
  searchEndpoint: string;
  jobDetailEndpoint?: string;
  headers: Record<string, string>;
  selectors: {
    jobList: string;
    title: string;
    company: string;
    location: string;
    salary?: string;
    description: string;
    requirements?: string;
    benefits?: string;
    postedDate?: string;
    jobUrl: string;
  };
}

class JobScrapingService {
  private jobBoards: JobBoardConfig[] = [
    {
      name: 'careers24',
      baseUrl: 'https://www.careers24.com',
      searchEndpoint: '/jobs/search',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      selectors: {
        jobList: '.job-result-item',
        title: '.job-title',
        company: '.company-name',
        location: '.job-location',
        salary: '.salary-info',
        description: '.job-description',
        requirements: '.requirements',
        benefits: '.benefits',
        postedDate: '.posted-date',
        jobUrl: '.job-title a'
      }
    },
    {
      name: 'pnet',
      baseUrl: 'https://www.pnet.co.za',
      searchEndpoint: '/jobs',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      selectors: {
        jobList: '.job-listing',
        title: '.job-title',
        company: '.company',
        location: '.location',
        salary: '.salary',
        description: '.description',
        jobUrl: '.job-title a'
      }
    },
    {
      name: 'indeed_sa',
      baseUrl: 'https://za.indeed.com',
      searchEndpoint: '/jobs',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      selectors: {
        jobList: '.job_seen_beacon',
        title: '[data-jk] h2 a span',
        company: '.companyName',
        location: '.companyLocation',
        salary: '.salary-snippet',
        description: '.summary',
        jobUrl: '[data-jk] h2 a'
      }
    }
  ];

  /**
   * Scrape jobs from all configured job boards
   */
  async scrapeAllJobBoards(keywords: string[] = ['developer', 'engineer', 'analyst', 'manager'], maxJobsPerBoard: number = 50) {
    const allScrapedJobs: ScrapedJob[] = [];
    
    for (const board of this.jobBoards) {
      try {
        logger.info(`Starting scrape for ${board.name}`);
        const jobs = await this.scrapeJobBoard(board, keywords, maxJobsPerBoard);
        allScrapedJobs.push(...jobs);
        logger.info(`Scraped ${jobs.length} jobs from ${board.name}`);
        
        // Add delay between requests to be respectful
        await this.delay(2000);
      } catch (error) {
        logger.error(`Failed to scrape ${board.name}`, { error });
      }
    }

    return allScrapedJobs;
  }

  /**
   * Scrape jobs from a specific job board
   */
  private async scrapeJobBoard(board: JobBoardConfig, keywords: string[], maxJobs: number): Promise<ScrapedJob[]> {
    const scrapedJobs: ScrapedJob[] = [];

    for (const keyword of keywords) {
      try {
        const searchUrl = `${board.baseUrl}${board.searchEndpoint}?q=${encodeURIComponent(keyword)}&l=South+Africa`;
        
        const response = await axios.get(searchUrl, {
          headers: board.headers,
          timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const jobElements = $(board.selectors.jobList).slice(0, Math.ceil(maxJobs / keywords.length));

        for (const element of jobElements) {
          try {
            const job = this.extractJobData($, element, board);
            if (job && this.validateJobData(job)) {
              scrapedJobs.push(job);
            }
          } catch (error) {
            logger.warn(`Failed to extract job data from ${board.name}`, { error });
          }
        }

        // Add delay between keyword searches
        await this.delay(1000);
      } catch (error) {
        logger.error(`Failed to scrape keyword "${keyword}" from ${board.name}`, { error });
      }
    }

    return scrapedJobs;
  }

  /**
   * Extract job data from HTML element
   */
  private extractJobData($: cheerio.CheerioAPI, element: cheerio.Element, board: JobBoardConfig): ScrapedJob | null {
    try {
      const $element = $(element);
      
      const title = $element.find(board.selectors.title).text().trim();
      const company = $element.find(board.selectors.company).text().trim();
      const location = $element.find(board.selectors.location).text().trim();
      const description = $element.find(board.selectors.description).text().trim();
      const jobUrl = $element.find(board.selectors.jobUrl).attr('href');

      if (!title || !company || !jobUrl) {
        return null;
      }

      const fullUrl = jobUrl.startsWith('http') ? jobUrl : `${board.baseUrl}${jobUrl}`;
      const externalId = this.extractJobId(fullUrl, board.name);

      const job: ScrapedJob = {
        title,
        company,
        location: this.normalizeLocation(location),
        description,
        sourceUrl: fullUrl,
        externalId,
        salary: board.selectors.salary ? $element.find(board.selectors.salary).text().trim() : undefined,
        jobType: this.inferJobType(title, description),
        requirements: board.selectors.requirements ? 
          this.extractListItems($element.find(board.selectors.requirements)) : undefined,
        benefits: board.selectors.benefits ? 
          this.extractListItems($element.find(board.selectors.benefits)) : undefined,
        postedDate: board.selectors.postedDate ? 
          this.parseDate($element.find(board.selectors.postedDate).text()) : undefined
      };

      return job;
    } catch (error) {
      logger.warn('Failed to extract job data', { error });
      return null;
    }
  }

  /**
   * Process and save scraped jobs to database
   */
  async processScrapedJobs(scrapedJobs: ScrapedJob[]) {
    let processedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const scrapedJob of scrapedJobs) {
      try {
        // Check if job already exists
        const existingJob = await prisma.job.findFirst({
          where: {
            OR: [
              { externalId: scrapedJob.externalId },
              {
                AND: [
                  { title: scrapedJob.title },
                  { company: { name: scrapedJob.company } }
                ]
              }
            ]
          }
        });

        if (existingJob) {
          duplicateCount++;
          continue;
        }

        // Find or create company
        let company = await prisma.company.findFirst({
          where: { name: { equals: scrapedJob.company, mode: 'insensitive' } }
        });

        if (!company) {
          company = await prisma.company.create({
            data: {
              name: scrapedJob.company,
              verified: false
            }
          });
        }

        // Parse location data
        const locationData = this.parseLocation(scrapedJob.location);
        const salaryData = this.parseSalary(scrapedJob.salary);

        // Create job
        await prisma.job.create({
          data: {
            title: scrapedJob.title,
            description: scrapedJob.description,
            requirements: scrapedJob.requirements,
            benefits: scrapedJob.benefits,
            companyId: company.id,
            location: scrapedJob.location,
            city: locationData.city,
            province: locationData.province,
            jobType: scrapedJob.jobType as any,
            salary: scrapedJob.salary,
            salaryMin: salaryData.min,
            salaryMax: salaryData.max,
            salaryFrequency: salaryData.frequency,
            sourceUrl: scrapedJob.sourceUrl,
            externalId: scrapedJob.externalId,
            status: 'ACTIVE',
            postedAt: scrapedJob.postedDate || new Date(),
            applicationDeadline: this.calculateDeadline(scrapedJob.postedDate)
          }
        });

        processedCount++;
      } catch (error) {
        logger.error('Failed to process scraped job', { error, job: scrapedJob });
        errorCount++;
      }
    }

    logger.info('Job scraping completed', {
      total: scrapedJobs.length,
      processed: processedCount,
      duplicates: duplicateCount,
      errors: errorCount
    });

    return {
      total: scrapedJobs.length,
      processed: processedCount,
      duplicates: duplicateCount,
      errors: errorCount
    };
  }

  /**
   * Run full scraping pipeline
   */
  async runScrapingPipeline(keywords?: string[], maxJobsPerBoard?: number) {
    try {
      logger.info('Starting job scraping pipeline');
      
      const scrapedJobs = await this.scrapeAllJobBoards(keywords, maxJobsPerBoard);
      const results = await this.processScrapedJobs(scrapedJobs);
      
      logger.info('Job scraping pipeline completed', results);
      return results;
    } catch (error) {
      logger.error('Job scraping pipeline failed', { error });
      throw new AppError(500, 'Failed to run job scraping pipeline', 'SCRAPING_PIPELINE_ERROR');
    }
  }

  /**
   * Utility methods
   */
  private extractJobId(url: string, boardName: string): string {
    // Extract job ID from URL based on board pattern
    switch (boardName) {
      case 'careers24':
        return url.match(/\/(\d+)$/)?.[1] || url.slice(-20);
      case 'pnet':
        return url.match(/\/job\/(\d+)/)?.[1] || url.slice(-20);
      case 'indeed_sa':
        return url.match(/jk=([^&]+)/)?.[1] || url.slice(-20);
      default:
        return url.slice(-20);
    }
  }

  private normalizeLocation(location: string): string {
    return location
      .replace(/\s*,\s*/g, ', ')
      .replace(/south africa/i, 'South Africa')
      .trim();
  }

  private inferJobType(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    
    if (text.includes('remote') || text.includes('work from home')) return 'REMOTE';
    if (text.includes('contract') || text.includes('freelance')) return 'CONTRACT';
    if (text.includes('part time') || text.includes('part-time')) return 'PART_TIME';
    if (text.includes('intern') || text.includes('graduate')) return 'INTERNSHIP';
    if (text.includes('temporary') || text.includes('temp')) return 'TEMPORARY';
    
    return 'FULL_TIME';
  }

  private extractListItems($element: cheerio.Cheerio<cheerio.Element>): string[] {
    const items: string[] = [];
    $element.find('li').each((_, el) => {
      const text = cheerio.load(el).text().trim();
      if (text) items.push(text);
    });
    return items.length > 0 ? items : [$element.text().trim()];
  }

  private parseDate(dateString: string): Date | undefined {
    if (!dateString) return undefined;
    
    const cleanDate = dateString.toLowerCase().trim();
    const now = new Date();
    
    if (cleanDate.includes('today')) return now;
    if (cleanDate.includes('yesterday')) return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const daysAgoMatch = cleanDate.match(/(\d+)\s*days?\s*ago/);
    if (daysAgoMatch) {
      return new Date(now.getTime() - parseInt(daysAgoMatch[1]) * 24 * 60 * 60 * 1000);
    }

    try {
      return new Date(dateString);
    } catch {
      return undefined;
    }
  }

  private parseLocation(location: string) {
    const provinces = [
      'EASTERN_CAPE', 'FREE_STATE', 'GAUTENG', 'KWAZULU_NATAL',
      'LIMPOPO', 'MPUMALANGA', 'NORTHERN_CAPE', 'NORTH_WEST', 'WESTERN_CAPE'
    ];

    const normalizedLocation = location.toLowerCase();
    let province = null;
    let city = null;

    // Map common location names to provinces
    const locationMapping: Record<string, { province: string; city: string }> = {
      'johannesburg': { province: 'GAUTENG', city: 'Johannesburg' },
      'cape town': { province: 'WESTERN_CAPE', city: 'Cape Town' },
      'durban': { province: 'KWAZULU_NATAL', city: 'Durban' },
      'pretoria': { province: 'GAUTENG', city: 'Pretoria' },
      'port elizabeth': { province: 'EASTERN_CAPE', city: 'Port Elizabeth' },
      'bloemfontein': { province: 'FREE_STATE', city: 'Bloemfontein' },
      'pietermaritzburg': { province: 'KWAZULU_NATAL', city: 'Pietermaritzburg' }
    };

    for (const [locationKey, locationData] of Object.entries(locationMapping)) {
      if (normalizedLocation.includes(locationKey)) {
        province = locationData.province;
        city = locationData.city;
        break;
      }
    }

    // Check for province names directly
    if (!province) {
      for (const prov of provinces) {
        if (normalizedLocation.includes(prov.toLowerCase().replace('_', ' '))) {
          province = prov;
          break;
        }
      }
    }

    return { province, city };
  }

  private parseSalary(salaryString?: string) {
    if (!salaryString) return { min: null, max: null, frequency: null };

    const cleanSalary = salaryString.replace(/[R\s,]/g, '');
    const numbers = cleanSalary.match(/\d+/g);
    
    if (!numbers || numbers.length === 0) return { min: null, max: null, frequency: null };

    let frequency = 'MONTHLY';
    if (salaryString.toLowerCase().includes('annual') || salaryString.toLowerCase().includes('year')) {
      frequency = 'ANNUALLY';
    } else if (salaryString.toLowerCase().includes('hour')) {
      frequency = 'HOURLY';
    }

    if (numbers.length === 1) {
      const amount = parseInt(numbers[0]);
      return { min: amount, max: amount, frequency };
    } else if (numbers.length >= 2) {
      const min = parseInt(numbers[0]);
      const max = parseInt(numbers[1]);
      return { min: Math.min(min, max), max: Math.max(min, max), frequency };
    }

    return { min: null, max: null, frequency: null };
  }

  private calculateDeadline(postedDate?: Date): Date | null {
    if (!postedDate) return null;
    
    // Default to 30 days from posted date
    const deadline = new Date(postedDate);
    deadline.setDate(deadline.getDate() + 30);
    return deadline;
  }

  private validateJobData(job: ScrapedJob): boolean {
    return !!(
      job.title && 
      job.company && 
      job.description && 
      job.sourceUrl &&
      job.title.length >= 3 &&
      job.company.length >= 2 &&
      job.description.length >= 10
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get scraping statistics
   */
  async getScrapingStats() {
    try {
      const [
        totalJobs,
        jobsBySource,
        recentScrapes,
        jobsByDate
      ] = await Promise.all([
        prisma.job.count({ where: { externalId: { not: null } } }),
        prisma.job.groupBy({
          by: ['sourceUrl'],
          where: { externalId: { not: null } },
          _count: true
        }),
        prisma.job.count({
          where: {
            externalId: { not: null },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        prisma.job.groupBy({
          by: ['createdAt'],
          where: {
            externalId: { not: null },
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          },
          _count: true
        })
      ]);

      const sourceStats = jobsBySource.map(source => ({
        source: this.extractDomainFromUrl(source.sourceUrl || ''),
        count: source._count
      }));

      return {
        totalScrapedJobs: totalJobs,
        recentlyScraped: recentScrapes,
        sourceBreakdown: sourceStats,
        dailyScrapeCounts: jobsByDate.length
      };
    } catch (error) {
      logger.error('Failed to get scraping stats', { error });
      throw new AppError(500, 'Failed to retrieve scraping statistics', 'SCRAPING_STATS_ERROR');
    }
  }

  private extractDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Clean up old scraped jobs
   */
  async cleanupOldJobs(daysOld: number = 60) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const deletedJobs = await prisma.job.deleteMany({
        where: {
          externalId: { not: null },
          createdAt: { lt: cutoffDate },
          status: 'INACTIVE'
        }
      });

      logger.info(`Cleaned up ${deletedJobs.count} old scraped jobs`);
      return deletedJobs.count;
    } catch (error) {
      logger.error('Failed to cleanup old jobs', { error });
      throw new AppError(500, 'Failed to cleanup old jobs', 'CLEANUP_ERROR');
    }
  }

  /**
   * Update job status based on external availability
   */
  async updateJobStatus(jobId: string) {
    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { sourceUrl: true, externalId: true }
      });

      if (!job || !job.sourceUrl) {
        throw new AppError(404, 'Job not found or no source URL', 'JOB_NOT_FOUND');
      }

      // Check if job still exists on source site
      try {
        const response = await axios.get(job.sourceUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const isActive = response.status === 200 && !response.data.includes('Job not found');
        
        await prisma.job.update({
          where: { id: jobId },
          data: { status: isActive ? 'ACTIVE' : 'INACTIVE' }
        });

        return isActive;
      } catch {
        // If we can't reach the source, mark as inactive
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'INACTIVE' }
        });

        return false;
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to update job status', { error, jobId });
      throw new AppError(500, 'Failed to update job status', 'STATUS_UPDATE_ERROR');
    }
  }
}

export default new JobScrapingService();
