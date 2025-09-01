/**
 * Hugging Face API Integration Service
 * Enterprise-grade integration for AI-powered job matching capabilities
 * 
 * @module HuggingFaceService
 * @version 1.0.0
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';

/**
 * Hugging Face API Configuration
 */
const HF_CONFIG = {
  apiToken: process.env.HUGGINGFACE_API_TOKEN,
  baseUrl: 'https://api-inference.huggingface.co/models',
  timeout: 30000,
  retryAttempts: 3,
  cacheExpiry: 3600 // 1 hour
};

/**
 * Model endpoints configuration
 */
const MODELS = {
  NER: {
    id: 'dslim/bert-base-NER',
    endpoint: `${HF_CONFIG.baseUrl}/dslim/bert-base-NER`,
    description: 'Named Entity Recognition for resume/CV parsing'
  },
  SKILL_CLASSIFICATION: {
    id: 'facebook/bart-large-mnli',
    endpoint: `${HF_CONFIG.baseUrl}/facebook/bart-large-mnli`,
    description: 'Zero-shot skill classification'
  },
  EMBEDDINGS: {
    id: 'sentence-transformers/all-MiniLM-L6-v2',
    endpoint: `${HF_CONFIG.baseUrl}/sentence-transformers/all-MiniLM-L6-v2`,
    description: 'Sentence embeddings for semantic similarity'
  },
  QA: {
    id: 'deepset/roberta-base-squad2',
    endpoint: `${HF_CONFIG.baseUrl}/deepset/roberta-base-squad2`,
    description: 'Question answering for candidate queries'
  },
  TEXT_GENERATION: {
    id: 'tiiuae/falcon-7b-instruct',
    endpoint: `${HF_CONFIG.baseUrl}/tiiuae/falcon-7b-instruct`,
    description: 'Advanced text generation for personalized content'
  },
  SENTIMENT: {
    id: 'distilbert-base-uncased-finetuned-sst-2-english',
    endpoint: `${HF_CONFIG.baseUrl}/distilbert-base-uncased-finetuned-sst-2-english`,
    description: 'Sentiment analysis for feedback and reviews'
  }
};

/**
 * HuggingFaceService class
 * Provides centralized access to all Hugging Face AI capabilities
 */
class HuggingFaceService {
  constructor() {
    this.axios = axios.create({
      timeout: HF_CONFIG.timeout,
      headers: {
        'Authorization': `Bearer ${HF_CONFIG.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Execute API request with retry logic and caching
   * @private
   */
  async executeRequest(endpoint, payload, cacheKey = null) {
    // Check cache first
    if (cacheKey) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    let lastError;
    for (let attempt = 1; attempt <= HF_CONFIG.retryAttempts; attempt++) {
      try {
        const response = await this.axios.post(endpoint, payload);
        
        // Cache successful response
        if (cacheKey && response.data) {
          await cache.set(cacheKey, response.data, HF_CONFIG.cacheExpiry);
        }
        
        return response.data;
      } catch (error) {
        lastError = error;
        logger.warn(`HF API attempt ${attempt} failed: ${error.message}`);
        
        // Wait before retry (exponential backoff)
        if (attempt < HF_CONFIG.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    logger.error('HF API request failed after all retries', lastError);
    throw new Error(`Hugging Face API request failed: ${lastError.message}`);
  }

  /**
   * Extract named entities from resume/CV text
   * @param {string} text - Resume content
   * @returns {Promise<Array>} Extracted entities
   */
  async extractEntities(text) {
    try {
      const cacheKey = `ner:${Buffer.from(text).toString('base64').substring(0, 50)}`;
      const result = await this.executeRequest(
        MODELS.NER.endpoint,
        { inputs: text },
        cacheKey
      );
      
      logger.info('Successfully extracted entities from text');
      return this.processNERResults(result);
    } catch (error) {
      logger.error('Entity extraction failed', error);
      throw error;
    }
  }

  /**
   * Classify skills using zero-shot classification
   * @param {string} text - Text containing skills
   * @param {Array<string>} candidateLabels - Possible skill categories
   * @returns {Promise<Object>} Classification results
   */
  async classifySkills(text, candidateLabels) {
    try {
      const payload = {
        inputs: text,
        parameters: {
          candidate_labels: candidateLabels,
          multi_label: true
        }
      };
      
      const result = await this.executeRequest(
        MODELS.SKILL_CLASSIFICATION.endpoint,
        payload
      );
      
      logger.info('Successfully classified skills');
      return result;
    } catch (error) {
      logger.error('Skill classification failed', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for semantic similarity matching
   * @param {string|Array<string>} texts - Text(s) to embed
   * @returns {Promise<Array>} Embedding vectors
   */
  async generateEmbeddings(texts) {
    try {
      const inputs = Array.isArray(texts) ? texts : [texts];
      const result = await this.executeRequest(
        MODELS.EMBEDDINGS.endpoint,
        { inputs }
      );
      
      logger.info(`Generated embeddings for ${inputs.length} text(s)`);
      return result;
    } catch (error) {
      logger.error('Embedding generation failed', error);
      throw error;
    }
  }

  /**
   * Answer questions about job descriptions or requirements
   * @param {string} question - User question
   * @param {string} context - Context to search for answer
   * @returns {Promise<Object>} Answer with confidence score
   */
  async answerQuestion(question, context) {
    try {
      const payload = {
        inputs: {
          question,
          context
        }
      };
      
      const result = await this.executeRequest(
        MODELS.QA.endpoint,
        payload
      );
      
      logger.info('Successfully answered question');
      return result;
    } catch (error) {
      logger.error('Question answering failed', error);
      throw error;
    }
  }

  /**
   * Generate personalized text content
   * @param {string} prompt - Generation prompt
   * @param {Object} options - Generation parameters
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, options = {}) {
    try {
      const payload = {
        inputs: prompt,
        parameters: {
          max_new_tokens: options.maxTokens || 250,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.95,
          do_sample: true,
          ...options
        }
      };
      
      const result = await this.executeRequest(
        MODELS.TEXT_GENERATION.endpoint,
        payload
      );
      
      logger.info('Successfully generated text');
      return result[0]?.generated_text || result;
    } catch (error) {
      logger.error('Text generation failed', error);
      throw error;
    }
  }

  /**
   * Analyze sentiment of text
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} Sentiment analysis results
   */
  async analyzeSentiment(text) {
    try {
      const cacheKey = `sentiment:${Buffer.from(text).toString('base64').substring(0, 50)}`;
      const result = await this.executeRequest(
        MODELS.SENTIMENT.endpoint,
        { inputs: text },
        cacheKey
      );
      
      logger.info('Successfully analyzed sentiment');
      return result;
    } catch (error) {
      logger.error('Sentiment analysis failed', error);
      throw error;
    }
  }

  /**
   * Process NER results into structured format
   * @private
   */
  processNERResults(results) {
    const entities = {
      persons: [],
      organizations: [],
      locations: [],
      misc: []
    };
    
    results.forEach(entity => {
      switch (entity.entity_group) {
        case 'PER':
          entities.persons.push(entity.word);
          break;
        case 'ORG':
          entities.organizations.push(entity.word);
          break;
        case 'LOC':
          entities.locations.push(entity.word);
          break;
        case 'MISC':
          entities.misc.push(entity.word);
          break;
      }
    });
    
    return entities;
  }

  /**
   * Calculate semantic similarity between texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {Promise<number>} Similarity score (0-1)
   */
  async calculateSimilarity(text1, text2) {
    try {
      const embeddings = await this.generateEmbeddings([text1, text2]);
      
      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(embeddings[0], embeddings[1]);
      
      logger.info(`Calculated similarity: ${similarity}`);
      return similarity;
    } catch (error) {
      logger.error('Similarity calculation failed', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @private
   */
  cosineSimilarity(vec1, vec2) {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (mag1 * mag2);
  }

  /**
   * Batch process multiple AI operations
   * @param {Array<Object>} operations - Array of operations to perform
   * @returns {Promise<Array>} Results of all operations
   */
  async batchProcess(operations) {
    const results = await Promise.allSettled(
      operations.map(op => this.processOperation(op))
    );
    
    return results.map((result, index) => ({
      operation: operations[index],
      status: result.status,
      value: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  /**
   * Process a single operation
   * @private
   */
  async processOperation(operation) {
    switch (operation.type) {
      case 'ner':
        return this.extractEntities(operation.data);
      case 'classify':
        return this.classifySkills(operation.data, operation.labels);
      case 'embed':
        return this.generateEmbeddings(operation.data);
      case 'qa':
        return this.answerQuestion(operation.question, operation.context);
      case 'generate':
        return this.generateText(operation.prompt, operation.options);
      case 'sentiment':
        return this.analyzeSentiment(operation.data);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Health check for Hugging Face API connectivity
   * @returns {Promise<Object>} Service health status
   */
  async healthCheck() {
    try {
      // Test with a simple sentiment analysis
      await this.analyzeSentiment('test');
      return {
        status: 'healthy',
        service: 'HuggingFace',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'HuggingFace',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export default new HuggingFaceService();

// Export class for testing
export { HuggingFaceService };
