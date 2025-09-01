import axios from 'axios';
import { config } from '../config/index.js';
import logger from '../config/logger.js';
import { cache } from '../config/redis.js';

export interface SemanticSimilarityResult {
  job_index: number;
  candidate_index: number;
  similarity_score: number; // 0..1
  confidence: number;       // 0..1
  match_level: string;      // poor..excellent
  processing_time_ms?: number;
  industry?: string | null;
  model_used?: string | null;
}

export class SemanticMatchingService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.INFERENCE_SERVICE_URL.replace(/\/$/, '');
  }

  /**
   * Compute semantic job<->CV similarity using the local inference API
   */
  async computeJobCvSimilarity(
    jobText: string,
    cvText: string,
    opts?: { industry?: string; detailed?: boolean }
  ): Promise<SemanticSimilarityResult | null> {
    const payload: any = {
      job_descriptions: jobText,
      candidate_texts: cvText,
      return_detailed_scores: opts?.detailed ?? true,
    };

    // Include industry if provided (endpoint supports industry-aware variant if enabled)
    if (opts?.industry) {
      payload.industry = opts.industry;
    }

    const cacheKey = `sem_sim:${Buffer.from(jobText + '||' + cvText).toString('base64').slice(0, 64)}:${opts?.industry || ''}`;

    try {
      const cached = await cache.get<SemanticSimilarityResult>(cacheKey);
      if (cached) return cached;
    } catch (_) {
      // Non-fatal if cache unavailable
    }

    try {
      // Try industry-aware endpoint first if industry provided, fallback to generic
      const url = `${this.baseUrl}/api/v1/${opts?.industry ? 'advanced-job-similarity' : 'job-similarity'}`;
      const { data } = await axios.post(url, payload, { timeout: 12_000 });

      if (data?.success && data?.data?.similarity_analysis?.length) {
        const result: SemanticSimilarityResult = data.data.similarity_analysis[0];
        try {
          await cache.set(cacheKey, result, 3600);
        } catch (_) {}
        return result;
      }

      // Fallback to generic endpoint if advanced not available
      if (opts?.industry) {
        const fallbackUrl = `${this.baseUrl}/api/v1/job-similarity`;
        const { data: fb } = await axios.post(fallbackUrl, payload, { timeout: 12_000 });
        if (fb?.success && fb?.data?.similarity_analysis?.length) {
          const result: SemanticSimilarityResult = fb.data.similarity_analysis[0];
          try { await cache.set(cacheKey, result, 3600); } catch (_) {}
          return result;
        }
      }

      return null;
    } catch (error: any) {
      logger.warn('SemanticMatchingService: inference call failed', { message: error?.message });
      return null;
    }
  }

  /**
   * Optional: call the advanced analysis pipeline for personality alignment etc.
   */
  async advancedAnalysis(jobText: string, cvText: string): Promise<any | null> {
    try {
      const { data } = await axios.post(
        `${this.baseUrl}/api/v1/advanced-analysis`,
        { job_description: jobText, candidate_cv: cvText, analysis_depth: 'standard' },
        { timeout: 15000 }
      );
      return data?.success ? data?.data : null;
    } catch (error: any) {
      logger.warn('SemanticMatchingService: advanced-analysis failed', { message: error?.message });
      return null;
    }
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Check if inference service URL is configured
      if (!this.baseUrl || this.baseUrl === 'undefined') {
        logger.warn('SemanticMatchingService: Inference service URL not configured');
        return false;
      }

      // Try to reach the health endpoint if available
      try {
        const healthUrl = `${this.baseUrl}/health`;
        const { data } = await axios.get(healthUrl, { timeout: 5000 });
        
        if (data?.status === 'healthy' || data?.status === 'ok') {
          logger.info('SemanticMatchingService: Health check passed');
          return true;
        }
      } catch (error) {
        // Health endpoint might not exist, try a simple similarity check
        const testResult = await this.computeJobCvSimilarity(
          'Test job description for health check',
          'Test CV content for health check',
          { detailed: false }
        );
        
        if (testResult !== null) {
          logger.info('SemanticMatchingService: Health check passed via test similarity');
          return true;
        }
      }

      logger.warn('SemanticMatchingService: Health check failed');
      return false;
    } catch (error) {
      logger.error('SemanticMatchingService: Error during health check', { error });
      return false;
    }
  }
}

