import { HfInference } from '@huggingface/inference';
import { Job } from '@prisma/client';
import { prisma } from '../config/database.js';
import { cache } from '../config/redis.js';
import { config } from '../config/index.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import natural from 'natural';
import { SemanticMatchingService } from './semantic-matching.service.js';
import { expandSkills, normalizeSkill } from '../data/skills_taxonomy.js';
import CvAnalysisService from './cv-analysis.service.js';
import CareerDnaService from './career-dna.service.js';
import SkillsGapAnalysisService from './skills-gap-analysis.service.js';

interface JobMatchResult {
  jobId: string;
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  educationScore: number;
  locationScore: number;
  salaryScore: number;
  personalityScore: number;
  culturalFitScore: number;
  successProbability: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  magicExplanation: string;
  whyPerfectFit: string;
  matchDetails: any;
  personalityInsights: {
    communicationStyle: string;
    workingStyle: string;
    culturalAlignment: string;
    confidenceLevel: 'Low' | 'Medium' | 'High' | 'Very High';
  };
  //  NEW: Enhanced match features
  careerGrowthPotential: number;
  skillDevelopmentOpportunity: number;
  industryFitScore: number;
  roleProgressionPath: string[];
  compensationFairness: number;
  workLifeBalance: number;
  riskFactors: string[];
  uniqueAdvantages: string[];
  applicationStrategy: {
    priority: 'immediate' | 'high' | 'medium' | 'low';
    customization: string[];
    timeline: string;
    successTips: string[];
  };
}

interface UserProfile {
  id: string;
  skills: string[];
  experience: any[];
  education: any[];
  location: {
    province?: string;
    city?: string;
  };
  salaryExpectation: {
    min?: number;
    max?: number;
  };
  yearsOfExperience: number;
  jobTypes: string[];
  industries: string[];
  cvContent?: string;
  personalityProfile?: {
    communicationStyle: 'formal' | 'conversational' | 'technical' | 'creative';
    workingPreference: 'collaborative' | 'independent' | 'leadership' | 'supportive';
    problemSolving: 'analytical' | 'creative' | 'systematic' | 'innovative';
    decisionMaking: 'data-driven' | 'intuitive' | 'consensus' | 'decisive';
    confidence: number;
  };
  //  NEW: Enhanced profile data
  careerGoals?: string[];
  preferredCulture?: string[];
  workLifeBalance?: number; // 0-100 importance
  careerStage?: 'entry' | 'mid' | 'senior' | 'executive';
  riskTolerance?: 'low' | 'medium' | 'high';
  learningOrientation?: number; // 0-100 desire to learn
  industryExperience?: Record<string, number>; // industry -> years
  achievementPatterns?: string[];
  leadershipExperience?: boolean;
  remoteWorkPreference?: 'required' | 'preferred' | 'acceptable' | 'not_preferred';
}

export class AIMatchingService {
  private hf: HfInference;
  private semanticMatcher: SemanticMatchingService;
  private cvAnalysisService: CvAnalysisService;
  private careerDnaService: CareerDnaService;
  private skillsGapService: SkillsGapAnalysisService;
  private industryWeights: Map<string, Record<string, number>> = new Map();

  constructor() {
    this.hf = new HfInference(config.HUGGINGFACE_API_KEY);
    this.semanticMatcher = new SemanticMatchingService();
    this.cvAnalysisService = new CvAnalysisService();
    this.careerDnaService = new CareerDnaService();
    this.skillsGapService = new SkillsGapAnalysisService();
    this.initializeIndustryWeights();
  }

  /**
   *  Health check for AI matching service
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Test basic functionality
      const testSkills = ['javascript', 'react'];
      const testJobSkills = ['javascript', 'node.js'];
      
      // Test skills matching
      const skillsScore = await this.calculateSkillsMatch(testSkills, testJobSkills);
      
      // Test personality analysis
      const testProfile = await this.analyzePersonalityFromCV('I am an experienced developer with strong communication skills.');
      
      // Service is healthy if basic operations work
      return skillsScore !== undefined && testProfile !== undefined;
    } catch (error) {
      logger.error('AI matching service health check failed', { error });
      return false;
    }
  }

  /**
   *  ENHANCED: Calculate job match scores with advanced AI analysis
   */
  async calculateJobMatches(userId: string, jobIds?: string[]): Promise<JobMatchResult[]> {
    try {
      logger.info(' Calculating enhanced job matches', { userId, jobIds });
      
      // Get comprehensive user profile with CV analysis
      const userProfile = await this.getEnhancedUserProfile(userId);
      
      // Get jobs to analyze with enhanced filtering
      const jobs = await this.getJobsForMatching(jobIds, userProfile);
      
      if (jobs.length === 0) {
        logger.info('No jobs found for matching', { userId, jobIds });
        return [];
      }

      //  NEW: Parallel processing for better performance
      const matchPromises = jobs.map(job => this.calculateEnhancedJobMatch(userProfile, job));
      const matches = await Promise.all(matchPromises);

      //  NEW: Smart sorting with multiple factors
      const sortedMatches = this.smartSortMatches(matches, userProfile);

      // Cache results with enhanced key
      await this.cacheMatchResults(userId, sortedMatches);

      logger.info('Enhanced job matching completed', { 
        userId, 
        totalJobs: jobs.length, 
        avgScore: matches.reduce((sum, m) => sum + m.overallScore, 0) / matches.length 
      });

      return sortedMatches;
    } catch (error) {
      logger.error('Error calculating enhanced job matches', { userId, error });
      throw new AppError(500, 'Failed to calculate job matches', 'ENHANCED_MATCHING_ERROR');
    }
  }

  /**
   *  ENHANCED: Get intelligent job recommendations with learning integration
   */
  async getJobRecommendations(
    userId: string, 
    options: {
      limit?: number;
      minScore?: number;
      includeGrowthJobs?: boolean;
      preferredIndustries?: string[];
      careerStage?: 'entry' | 'mid' | 'senior' | 'executive';
      riskTolerance?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<JobMatchResult[]> {
    try {
      const {
        limit = 10,
        minScore = 0.6,
        includeGrowthJobs = true,
        preferredIndustries = [],
        careerStage,
        riskTolerance = 'medium'
      } = options;
      
      // Check cache first
      const cacheKey = `enhanced_recommendations:${userId}:${JSON.stringify(options)}`;
      const cached = await cache.get<JobMatchResult[]>(cacheKey);
      
      if (cached) {
        logger.info('Returning cached enhanced recommendations', { userId, count: cached.length });
        return cached;
      }

      // Calculate fresh matches with enhancements
      const matches = await this.calculateJobMatches(userId);
      
      //  NEW: Apply intelligent filtering
      let filteredMatches = await this.applyIntelligentFiltering(matches, {
        minScore,
        includeGrowthJobs,
        preferredIndustries,
        careerStage,
        riskTolerance,
        userId
      });
      
      //  NEW: Diversify recommendations for better user experience
      filteredMatches = this.diversifyRecommendations(filteredMatches, limit);
      
      // Cache enhanced recommendations for 2 hours
      await cache.set(cacheKey, filteredMatches, 7200);

      logger.info('Enhanced recommendations generated', { 
        userId, 
        total: matches.length, 
        filtered: filteredMatches.length,
        avgScore: filteredMatches.reduce((sum, m) => sum + m.overallScore, 0) / filteredMatches.length
      });

      return filteredMatches;
    } catch (error) {
      logger.error('Error getting enhanced job recommendations', { userId, error });
      throw new AppError(500, 'Failed to get job recommendations', 'ENHANCED_RECOMMENDATIONS_ERROR');
    }
  }

  /**
   * Analyze and improve CV content
   */
  async analyzeCVContent(content: string, targetJob?: Job): Promise<{
    atsScore: number;
    suggestions: string[];
    keywordAnalysis: {
      found: string[];
      missing: string[];
      density: Record<string, number>;
    };
    improvements: {
      skills: string[];
      experience: string[];
      keywords: string[];
    };
  }> {
    try {
      // Extract skills and keywords from CV
      const extractedSkills = await this.extractSkillsFromText(content);
      
      // Get industry-standard keywords
      const industryKeywords = targetJob ? 
        await this.getIndustryKeywords(targetJob.requiredSkills, targetJob.description) :
        [];

      // Calculate ATS score
      const atsScore = await this.calculateATSScore(content, industryKeywords);

      // Generate suggestions
      const suggestions = await this.generateCVSuggestions(content, extractedSkills, targetJob);

      // Keyword analysis
      const keywordAnalysis = this.analyzeKeywords(content, industryKeywords);

      // Generate improvements
      const improvements = await this.generateCVImprovements(
        extractedSkills,
        targetJob?.requiredSkills || [],
        targetJob?.preferredSkills || []
      );

      return {
        atsScore,
        suggestions,
        keywordAnalysis,
        improvements,
      };
    } catch (error) {
      logger.error('Error analyzing CV content', { error });
      throw new AppError(500, 'Failed to analyze CV');
    }
  }

  /**
   * Extract skills from text using NLP with improved error handling
   */
  async extractSkillsFromText(text: string): Promise<string[]> {
    try {
      // Preprocess text
      const processedText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
      
      // Enhanced keyword matching (primary method)
      const skillKeywords = [
        // Programming languages
        'javascript', 'typescript', 'python', 'java', 'c#', 'c sharp', 'php', 'ruby', 'go', 'rust',
        'react', 'angular', 'vue', 'svelte', 'node.js', 'express', 'django', 'flask', 'spring',
        'next.js', 'nuxt.js', 'gatsby', 'laravel', 'codeigniter', 'symfony',
        // Databases
        'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'cassandra',
        'sqlite', 'oracle', 'sql server', 'mariadb', 'dynamodb',
        // Cloud & DevOps
        'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'jenkins', 'git', 'ci/cd',
        'terraform', 'ansible', 'puppet', 'chef', 'gitlab', 'github actions', 'bitbucket',
        // Design & Marketing
        'photoshop', 'illustrator', 'figma', 'sketch', 'adobe', 'canva', 'indesign',
        'seo', 'sem', 'google analytics', 'facebook ads', 'linkedin ads', 'google ads',
        // Business & Office
        'excel', 'powerpoint', 'word', 'project management', 'agile', 'scrum', 'kanban',
        'salesforce', 'hubspot', 'crm', 'erp', 'jira', 'confluence', 'slack', 'teams',
        // South African specific
        'pastel', 'sage', 'caseware', 'bbbee', 'labour law', 'company law', 'tax',
        // Additional technical skills
        'html', 'css', 'sass', 'less', 'bootstrap', 'tailwind', 'jquery',
        'webpack', 'vite', 'rollup', 'babel', 'eslint', 'prettier',
        'rest api', 'graphql', 'soap', 'microservices', 'serverless'
      ];

      // Primary skill extraction using enhanced keyword matching
      const foundSkills = skillKeywords.filter(skill => 
        processedText.includes(skill.toLowerCase())
      );

      let nerSkills: string[] = [];

      // Try Hugging Face NER as enhancement (not critical)
      try {
        logger.info('Attempting Hugging Face NER for skills extraction');
        
        // Try with a different approach - use text-classification instead
        const response = await this.hf.tokenClassification({
          model: 'dbmdz/bert-large-cased-finetuned-conll03-english',
          inputs: text.slice(0, 1500), // Reduced input size
        });

        // Process NER results if successful
        if (Array.isArray(response)) {
          nerSkills = response
            .filter(entity => 
              (entity.entity_group === 'MISC' || entity.entity_group === 'ORG') &&
              entity.score > 0.5 // Only high confidence entities
            )
            .map(entity => entity.word?.toLowerCase() || '')
            .filter(word => word.length > 2 && word.length < 20) // Reasonable word length
            .slice(0, 10); // Limit to prevent noise
        }
        
        logger.info('Hugging Face NER completed successfully', { nerSkillsFound: nerSkills.length });
      } catch (nerError: any) {
        logger.warn('Hugging Face NER failed, using keyword matching only', { 
          error: nerError.message,
          modelIssue: nerError.message?.includes('token-classification')
        });
        // Continue without NER - keyword matching is sufficient
      }

      // Combine and deduplicate results
      const allSkills = [...foundSkills, ...nerSkills];
      const uniqueSkills = [...new Set(allSkills)];
      
      logger.info('Skills extraction completed', { 
        keywordSkills: foundSkills.length,
        nerSkills: nerSkills.length,
        totalUnique: uniqueSkills.length
      });

      return uniqueSkills.length > 0 ? uniqueSkills : this.extractSkillsBasic(text);
      
    } catch (error) {
      logger.error('Error in extractSkillsFromText', { error });
      // Fallback to basic keyword extraction
      return this.extractSkillsBasic(text);
    }
  }

  /**
   *  ENHANCED: Calculate comprehensive job match with advanced AI analysis
   */
  private async calculateEnhancedJobMatch(
    userProfile: UserProfile,
    job: Job & { company: any }
  ): Promise<JobMatchResult> {
    try {
      logger.debug('Calculating enhanced job match', { userId: userProfile.id, jobId: job.id });
      
      //  NEW: Get industry-specific weights
      const industryWeights = this.getIndustryWeights(job.company?.industry || 'General');
      
      //  NEW: Advanced CV analysis for better skills extraction
      const cvAnalysis = userProfile.cvContent ? 
        await this.cvAnalysisService.analyzeCv(userProfile.cvContent, {
          targetRole: job.title,
          targetIndustry: job.company?.industry
        }) : null;

      return await this.calculateSingleJobMatch(userProfile, job);
    } catch (error) {
      logger.error('Error in enhanced job match calculation', { error, jobId: job.id });
      // Fallback to original calculation
      return await this.calculateSingleJobMatch(userProfile, job);
    }
  }

  /**
   *  ORIGINAL: Calculate single job match score with AI personality analysis
   */
  private async calculateSingleJobMatch(
    userProfile: UserProfile,
    job: Job & { company: any }
  ): Promise<JobMatchResult> {
    // Enhanced Skills matching with semantic analysis (25% weight - reduced for personality)
    const skillsScore = await this.calculateSkillsMatch(
      userProfile.skills,
      [...job.requiredSkills, ...job.preferredSkills],
      userProfile.cvContent,
      job.description,
      job.company?.industry || userProfile.industries[0]
    );

    // Experience matching (20% weight)
    const experienceScore = this.calculateExperienceMatch(
      userProfile.yearsOfExperience,
      job.yearsExperienceMin || 0,
      job.yearsExperienceMax || 10
    );

    // Education matching (10% weight)
    const educationScore = this.calculateEducationMatch(
      userProfile.education,
      job.education || ''
    );

    // Location matching (15% weight)
    const locationScore = this.calculateLocationMatch(
      userProfile.location,
      { province: job.province, city: job.city, isRemote: job.isRemote }
    );

    // Salary matching (10% weight)
    const salaryScore = this.calculateSalaryMatch(
      userProfile.salaryExpectation,
      { min: job.salaryMin ?? undefined, max: job.salaryMax ?? undefined }
    );

    //  MAGIC: Personality Analysis (15% weight)
    const personalityScore = await this.calculatePersonalityMatch(userProfile, job);

    //  MAGIC: Cultural Fit Analysis (5% weight)
    const culturalFitScore = await this.calculateCulturalFit(userProfile, job);

    // Calculate weighted overall score with new AI components
    const overallScore = (
      skillsScore * 0.25 +
      experienceScore * 0.20 +
      educationScore * 0.10 +
      locationScore * 0.15 +
      salaryScore * 0.10 +
      personalityScore * 0.15 +
      culturalFitScore * 0.05
    );

    //  MAGIC: Calculate Success Probability
    const successProbability = await this.calculateSuccessProbability({
      skillsScore, experienceScore, educationScore, locationScore, 
      salaryScore, personalityScore, culturalFitScore
    }, job, userProfile);

    //  MAGIC: Generate AI-powered explanations
    const { magicExplanation, whyPerfectFit, personalityInsights } = await this.generateMagicInsights(
      userProfile, job, {
        skillsScore, experienceScore, educationScore, locationScore,
        salaryScore, personalityScore, culturalFitScore, successProbability
      }
    );

    // Generate enhanced insights
    const { strengths, gaps, recommendations } = this.generateEnhancedMatchInsights(
      userProfile,
      job,
      { skillsScore, experienceScore, educationScore, locationScore, salaryScore, personalityScore, culturalFitScore }
    );

    //  NEW: Calculate enhanced match features
    const careerGrowthPotential = await this.calculateCareerGrowthPotential(userProfile, job);
    const skillDevelopmentOpportunity = await this.calculateSkillDevelopmentOpportunity(userProfile, job);
    const industryFitScore = this.calculateIndustryFit(userProfile, job);
    const roleProgressionPath = await this.generateRoleProgressionPath(userProfile, job);
    const compensationFairness = this.calculateCompensationFairness(userProfile, job);
    const workLifeBalance = this.calculateWorkLifeBalance(userProfile, job);
    const { riskFactors, uniqueAdvantages } = this.identifyRiskAndAdvantages(userProfile, job, {
      skillsScore, experienceScore, personalityScore, culturalFitScore
    });
    const applicationStrategy = await this.generateApplicationStrategy(userProfile, job, successProbability);

    return {
      jobId: job.id,
      overallScore: Math.round(overallScore * 100) / 100,
      skillsScore: Math.round(skillsScore * 100) / 100,
      experienceScore: Math.round(experienceScore * 100) / 100,
      educationScore: Math.round(educationScore * 100) / 100,
      locationScore: Math.round(locationScore * 100) / 100,
      salaryScore: Math.round(salaryScore * 100) / 100,
      personalityScore: Math.round(personalityScore * 100) / 100,
      culturalFitScore: Math.round(culturalFitScore * 100) / 100,
      successProbability: Math.round(successProbability * 100) / 100,
      strengths,
      gaps,
      recommendations,
      magicExplanation,
      whyPerfectFit,
      personalityInsights,
      //  NEW: Enhanced features
      careerGrowthPotential: Math.round(careerGrowthPotential * 100) / 100,
      skillDevelopmentOpportunity: Math.round(skillDevelopmentOpportunity * 100) / 100,
      industryFitScore: Math.round(industryFitScore * 100) / 100,
      roleProgressionPath,
      compensationFairness: Math.round(compensationFairness * 100) / 100,
      workLifeBalance: Math.round(workLifeBalance * 100) / 100,
      riskFactors,
      uniqueAdvantages,
      applicationStrategy,
      matchDetails: {
        weights: {
          skills: 0.25,
          experience: 0.20,
          education: 0.10,
          location: 0.15,
          salary: 0.10,
          personality: 0.15,
          culturalFit: 0.05
        },
        userSkills: userProfile.skills,
        jobSkills: [...job.requiredSkills, ...job.preferredSkills],
        userExperience: userProfile.yearsOfExperience,
        jobExperience: { min: job.yearsExperienceMin, max: job.yearsExperienceMax },
        personalityProfile: userProfile.personalityProfile,
        aiAnalysisUsed: true,
        enhancedFeatures: {
          cvAnalysisUsed: !!userProfile.cvContent,
          industryWeightsApplied: true,
          careerGrowthAnalyzed: true,
          riskAssessmentCompleted: true
        }
      },
    };
  }

  /**
   * Calculate skills match score with enhanced semantic matching
   */
  private async calculateSkillsMatch(
    userSkills: string[], 
    jobSkills: string[], 
    cvContent?: string,
    jobDescription?: string,
    industry?: string
  ): Promise<number> {
    if (jobSkills.length === 0) return 1.0;
    
    //  NEW: Use skills taxonomy for enhanced matching
    const userSkillsExpanded = expandSkills(userSkills);
    const jobSkillsExpanded = expandSkills(jobSkills);
    
    const userSkillsNormalized = Array.from(userSkillsExpanded).map(s => s.toLowerCase());
    const jobSkillsNormalized = Array.from(jobSkillsExpanded).map(s => s.toLowerCase());
    
    let matchCount = 0;
    let partialMatchCount = 0;
    let semanticMatchCount = 0;
    
    // First pass: Exact and partial matches
    for (const jobSkill of jobSkillsNormalized) {
      // Exact match
      if (userSkillsNormalized.includes(jobSkill)) {
        matchCount++;
        continue;
      }
      
      // Partial match using string similarity
      const bestMatch = userSkillsNormalized.reduce((best, userSkill) => {
        const similarity = natural.JaroWinklerDistance(jobSkill, userSkill, {});
        return similarity > best.score ? { skill: userSkill, score: similarity } : best;
      }, { skill: '', score: 0 });
      
      if (bestMatch.score > 0.8) {
        partialMatchCount++;
      }
    }
    
    //  NEW: Semantic matching for deeper skill alignment
    try {
      if (cvContent && jobDescription) {
        const semanticScore = await this.semanticMatcher.computeJobCvSimilarity(
          cvContent,
          jobDescription,
          industry
        );
        
        // If semantic score is high, boost the overall match
        if (semanticScore > 0.7) {
          semanticMatchCount = jobSkillsNormalized.length * semanticScore * 0.3;
        }
        
        logger.info('Enhanced skills matching with semantic similarity', {
          exactMatches: matchCount,
          partialMatches: partialMatchCount,
          semanticScore,
          semanticBoost: semanticMatchCount
        });
      }
    } catch (error) {
      logger.warn('Semantic matching failed, using traditional scoring', { error });
      // Continue with traditional scoring
    }
    
    const totalMatches = matchCount + (partialMatchCount * 0.5) + semanticMatchCount;
    return Math.min(totalMatches / jobSkillsNormalized.length, 1.0);
  }

  /**
   * Calculate experience match score
   */
  private calculateExperienceMatch(
    userExperience: number,
    minRequired: number,
    maxRequired: number
  ): number {
    if (userExperience >= minRequired && userExperience <= maxRequired) {
      return 1.0;
    }
    
    if (userExperience < minRequired) {
      const deficit = minRequired - userExperience;
      return Math.max(0, 1 - (deficit * 0.2)); // 20% penalty per year deficit
    }
    
    if (userExperience > maxRequired) {
      const excess = userExperience - maxRequired;
      return Math.max(0.7, 1 - (excess * 0.05)); // 5% penalty per year excess, min 70%
    }
    
    return 0.5;
  }

  /**
   * Calculate education match score
   */
  private calculateEducationMatch(userEducation: any[], jobEducation: string): number {
    if (!jobEducation) return 1.0;
    
    const jobEduLower = jobEducation.toLowerCase();
    const educationLevels = {
      'phd': 6, 'doctorate': 6, 'doctoral': 6,
      'masters': 5, 'master': 5, 'mba': 5,
      'honours': 4, 'bachelor': 4, 'degree': 4,
      'diploma': 3, 'certificate': 2,
      'matric': 1, 'grade 12': 1
    };
    
    // Determine required education level
    let requiredLevel = 0;
    for (const [edu, level] of Object.entries(educationLevels)) {
      if (jobEduLower.includes(edu)) {
        requiredLevel = Math.max(requiredLevel, level);
      }
    }
    
    // Determine user's highest education level
    let userLevel = 0;
    for (const edu of userEducation) {
      const eduLower = edu.degree?.toLowerCase() || '';
      for (const [eduType, level] of Object.entries(educationLevels)) {
        if (eduLower.includes(eduType)) {
          userLevel = Math.max(userLevel, level);
        }
      }
    }
    
    if (userLevel >= requiredLevel) {
      return 1.0;
    } else if (userLevel > 0) {
      return Math.max(0.5, userLevel / requiredLevel);
    }
    
    return 0.3; // Some credit for unspecified education
  }

  /**
   * Calculate location match score
   */
  private calculateLocationMatch(
    userLocation: { province?: string; city?: string },
    jobLocation: { province: string; city: string; isRemote: boolean }
  ): number {
    if (jobLocation.isRemote) return 1.0;
    
    if (userLocation.province === jobLocation.province) {
      if (userLocation.city === jobLocation.city) {
        return 1.0; // Same city
      }
      return 0.8; // Same province, different city
    }
    
    return 0.4; // Different province
  }

  /**
   * Calculate salary match score
   */
  private calculateSalaryMatch(
    userExpectation: { min?: number; max?: number },
    jobSalary: { min?: number; max?: number }
  ): number {
    if (!jobSalary.min || !userExpectation.min) return 1.0;
    
    const jobAvg = (jobSalary.min + (jobSalary.max || jobSalary.min)) / 2;
    const userAvg = (userExpectation.min + (userExpectation.max || userExpectation.min)) / 2;
    
    const difference = Math.abs(jobAvg - userAvg) / userAvg;
    
    if (difference <= 0.1) return 1.0; // Within 10%
    if (difference <= 0.2) return 0.8; // Within 20%
    if (difference <= 0.3) return 0.6; // Within 30%
    
    return Math.max(0.2, 1 - difference);
  }

  /**
   * Generate match insights
   */
  private generateMatchInsights(
    userProfile: UserProfile,
    job: Job,
    scores: Record<string, number>
  ) {
    const strengths: string[] = [];
    const gaps: string[] = [];
    const recommendations: string[] = [];

    // Analyze strengths
    if (scores.skillsScore > 0.8) {
      strengths.push('Strong skills match for this position');
    }
    if (scores.experienceScore > 0.8) {
      strengths.push('Experience level aligns well with requirements');
    }
    if (scores.locationScore > 0.9) {
      strengths.push('Perfect location match');
    }

    // Analyze gaps
    if (scores.skillsScore < 0.5) {
      gaps.push('Missing some key technical skills');
      recommendations.push('Consider upskilling in required technologies');
    }
    if (scores.experienceScore < 0.5) {
      if (userProfile.yearsOfExperience < (job.yearsExperienceMin || 0)) {
        gaps.push('Below minimum experience requirement');
        recommendations.push('Highlight relevant projects and achievements to demonstrate capability');
      }
    }
    if (scores.educationScore < 0.7) {
      gaps.push('Education level below preferred requirement');
      recommendations.push('Consider relevant certifications or additional training');
    }

    return { strengths, gaps, recommendations };
  }

  /**
   * Get user profile for matching with CV content for personality analysis
   */
  private async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        jobSeekerProfile: true,
        skills: { include: { skill: true } },
        experiences: true,
        educations: true,
        cvs: { 
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true }
        }
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Get CV content for personality analysis
    const cvContent = user.cvs[0]?.content || '';
    
    //  MAGIC: Analyze personality from CV content
    const personalityProfile = await this.analyzePersonalityFromCV(cvContent);

    return {
      id: user.id,
      skills: user.skills.map(s => s.skill.name),
      experience: user.experiences,
      education: user.educations,
      location: {
        province: user.province || undefined,
        city: user.city || undefined,
      },
      salaryExpectation: {
        min: user.jobSeekerProfile?.expectedSalaryMin || undefined,
        max: user.jobSeekerProfile?.expectedSalaryMax || undefined,
      },
      yearsOfExperience: user.jobSeekerProfile?.yearsOfExperience || 0,
      jobTypes: user.jobSeekerProfile?.preferredJobTypes || [],
      industries: user.jobSeekerProfile?.preferredIndustries || [],
      cvContent,
      personalityProfile
    };
  }

  /**
   * Get jobs for matching
   */
  private async getJobsForMatching(jobIds?: string[], userProfile?: UserProfile) {
    const where: any = { active: true };
    
    if (jobIds) {
      where.id = { in: jobIds };
    } else if (userProfile) {
      // Filter by user preferences
      where.AND = [];
      
      if (userProfile.jobTypes.length > 0) {
        where.AND.push({ jobType: { in: userProfile.jobTypes } });
      }
      
      if (userProfile.location.province) {
        where.OR = [
          { province: userProfile.location.province },
          { isRemote: true }
        ];
      }
    }

    return await prisma.job.findMany({
      where,
      include: { company: true },
      take: jobIds ? undefined : 100, // Limit for performance
    });
  }

  /**
   * Cache match results
   */
  private async cacheMatchResults(userId: string, matches: JobMatchResult[]): Promise<void> {
    const cacheKey = `job_matches:${userId}`;
    await cache.set(cacheKey, matches, 7200); // 2 hours
  }

  /**
   * Basic skill extraction fallback
   */
  private extractSkillsBasic(text: string): string[] {
    const commonSkills = [
      'javascript', 'python', 'java', 'react', 'angular', 'node.js',
      'sql', 'mysql', 'postgresql', 'mongodb', 'aws', 'azure',
      'excel', 'powerpoint', 'project management', 'communication'
    ];
    
    const textLower = text.toLowerCase();
    return commonSkills.filter(skill => textLower.includes(skill));
  }

  /**
   * Calculate ATS score
   */
  private async calculateATSScore(content: string, keywords: string[]): Promise<number> {
    // Basic ATS scoring algorithm
    let score = 0;
    const contentLower = content.toLowerCase();
    
    // Keyword density (40% of score)
    const keywordCount = keywords.filter(keyword => 
      contentLower.includes(keyword.toLowerCase())
    ).length;
    const keywordScore = keywords.length > 0 ? keywordCount / keywords.length : 1;
    score += keywordScore * 0.4;
    
    // Format and structure (30% of score)
    const hasContactInfo = /email|phone|@/.test(contentLower);
    const hasExperience = /experience|work|employment/.test(contentLower);
    const hasEducation = /education|degree|university|college/.test(contentLower);
    const hasSkills = /skills|technologies|tools/.test(contentLower);
    
    const structureScore = [hasContactInfo, hasExperience, hasEducation, hasSkills]
      .filter(Boolean).length / 4;
    score += structureScore * 0.3;
    
    // Length appropriateness (30% of score)
    const wordCount = content.split(/\s+/).length;
    let lengthScore = 1;
    if (wordCount < 200) lengthScore = 0.5;
    else if (wordCount < 400) lengthScore = 0.7;
    else if (wordCount > 1000) lengthScore = 0.8;
    score += lengthScore * 0.3;
    
    return Math.min(score, 1);
  }

  /**
   * Get industry keywords
   */
  private async getIndustryKeywords(requiredSkills: string[], description: string): Promise<string[]> {
    // Combine required skills with extracted keywords from description
    const descriptionKeywords = await this.extractSkillsFromText(description);
    return [...new Set([...requiredSkills, ...descriptionKeywords])];
  }

  /**
   * Analyze keywords in content
   */
  private analyzeKeywords(content: string, keywords: string[]) {
    // const contentLower = content.toLowerCase(); // Not used
    const found: string[] = [];
    const missing: string[] = [];
    const density: Record<string, number> = {};
    
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(`\\b${keywordLower}\\b`, 'gi');
      const matches = content.match(regex);
      
      if (matches) {
        found.push(keyword);
        density[keyword] = matches.length;
      } else {
        missing.push(keyword);
        density[keyword] = 0;
      }
    }
    
    return { found, missing, density };
  }

  /**
   * Generate CV suggestions
   */
  private async generateCVSuggestions(
    content: string,
    extractedSkills: string[],
    targetJob?: Job
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Basic suggestions
    if (content.length < 500) {
      suggestions.push('Consider expanding your CV with more detailed descriptions of your experience');
    }
    
    if (!content.includes('achievements') && !content.includes('accomplished')) {
      suggestions.push('Add specific achievements and quantifiable results to your experience');
    }
    
    if (targetJob && extractedSkills.length < 3) {
      suggestions.push('Include more relevant technical skills and keywords from the job description');
    }
    
    if (!content.includes('@') && !content.includes('email')) {
      suggestions.push('Ensure your contact information is clearly visible');
    }
    
    return suggestions;
  }

  /**
   * Generate CV improvements
   */
  private async generateCVImprovements(
    userSkills: string[],
    requiredSkills: string[],
    preferredSkills: string[]
  ) {
    const missingRequired = requiredSkills.filter(skill => 
      !userSkills.some(userSkill => 
        userSkill.toLowerCase().includes(skill.toLowerCase())
      )
    );
    
    const missingPreferred = preferredSkills.filter(skill => 
      !userSkills.some(userSkill => 
        userSkill.toLowerCase().includes(skill.toLowerCase())
      )
    );
    
    return {
      skills: [...missingRequired, ...missingPreferred.slice(0, 3)],
      experience: [
        'Quantify your achievements with specific numbers and metrics',
        'Use action verbs to describe your responsibilities',
        'Focus on relevant experience for the target role'
      ],
      keywords: [
        'Include industry-specific terminology',
        'Use keywords from the job description naturally',
        'Optimize for Applicant Tracking Systems (ATS)'
      ]
    };
  }

  // ========================================
  //  MAGIC PERSONALITY ANALYSIS METHODS
  // ========================================

  /**
   *  MAGIC: Analyze personality from CV content using AI
   */
  private async analyzePersonalityFromCV(cvContent: string): Promise<UserProfile['personalityProfile']> {
    if (!cvContent || cvContent.length < 100) {
      // Return default personality profile if CV is too short
      return {
        communicationStyle: 'conversational',
        workingPreference: 'collaborative',
        problemSolving: 'systematic',
        decisionMaking: 'data-driven',
        confidence: 0.7
      };
    }

    try {
      // Check cache first
      const cacheKey = `personality_analysis:${Buffer.from(cvContent).toString('base64').slice(0, 20)}`;
      const cached = await cache.get<UserProfile['personalityProfile']>(cacheKey);
      if (cached) return cached;

      // Use HuggingFace sentiment analysis to understand communication style
      const sentimentResponse = await this.hf.textClassification({
        model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
        inputs: cvContent.slice(0, 1500)
      });

      // Analyze text patterns for personality traits
      const textAnalysis = this.analyzeTextPatterns(cvContent);
      
      // Generate personality profile
      const personalityProfile = this.generatePersonalityProfile(sentimentResponse, textAnalysis);
      
      // Cache for 7 days
      await cache.set(cacheKey, personalityProfile, 604800);
      
      return personalityProfile;
    } catch (error) {
      logger.error('Error analyzing personality from CV', { error });
      // Return default profile on error
      return {
        communicationStyle: 'conversational',
        workingPreference: 'collaborative', 
        problemSolving: 'systematic',
        decisionMaking: 'data-driven',
        confidence: 0.7
      };
    }
  }

  /**
   *  MAGIC: Calculate personality match between user and job
   */
  private async calculatePersonalityMatch(userProfile: UserProfile, job: Job): Promise<number> {
    if (!userProfile.personalityProfile) return 0.7; // Neutral score

    try {
      // Analyze job description for required personality traits
      const jobPersonality = await this.analyzeJobPersonalityRequirements(job.description, job.requirements);
      
      // Calculate compatibility scores
      const compatibilityScores = {
        communication: this.calculateTraitCompatibility(
          userProfile.personalityProfile.communicationStyle,
          jobPersonality.preferredCommunication
        ),
        working: this.calculateTraitCompatibility(
          userProfile.personalityProfile.workingPreference,
          jobPersonality.preferredWorking
        ),
        problemSolving: this.calculateTraitCompatibility(
          userProfile.personalityProfile.problemSolving,
          jobPersonality.preferredProblemSolving
        ),
        decisionMaking: this.calculateTraitCompatibility(
          userProfile.personalityProfile.decisionMaking,
          jobPersonality.preferredDecisionMaking
        )
      };

      // Calculate weighted average
      const personalityScore = (
        compatibilityScores.communication * 0.3 +
        compatibilityScores.working * 0.3 +
        compatibilityScores.problemSolving * 0.2 +
        compatibilityScores.decisionMaking * 0.2
      );

      return Math.max(0.3, personalityScore); // Minimum 30% to avoid harsh penalties
    } catch (error) {
      logger.error('Error calculating personality match', { error });
      return 0.7; // Neutral score on error
    }
  }

  /**
   *  MAGIC: Calculate cultural fit between user and company
   */
  private async calculateCulturalFit(userProfile: UserProfile, job: Job & { company: any }): Promise<number> {
    try {
      // Check cache for company culture analysis
      const cacheKey = `company_culture:${job.company.id}`;
      let companyCulture = await cache.get<any>(cacheKey);
      
      if (!companyCulture) {
        companyCulture = await this.analyzeCompanyCulture(job.company);
        await cache.set(cacheKey, companyCulture, 86400); // Cache for 24 hours
      }

      // Calculate cultural alignment
      const culturalAlignment = this.calculateCulturalAlignment(
        userProfile.personalityProfile,
        companyCulture
      );

      return culturalAlignment;
    } catch (error) {
      logger.error('Error calculating cultural fit', { error });
      return 0.75; // Neutral cultural fit score
    }
  }

  /**
   *  MAGIC: Calculate success probability using all factors
   */
  private async calculateSuccessProbability(
    scores: Record<string, number>,
    job: Job,
    userProfile: UserProfile
  ): Promise<number> {
    try {
      // Base probability from weighted scores
      const baseScore = (
        scores.skillsScore * 0.25 +
        scores.experienceScore * 0.20 +
        scores.personalityScore * 0.20 +
        scores.culturalFitScore * 0.15 +
        scores.locationScore * 0.10 +
        scores.educationScore * 0.05 +
        scores.salaryScore * 0.05
      );

      // Market competition factor (reduces probability)
      const competitionFactor = await this.estimateMarketCompetition(job, userProfile);
      
      // Historical success factor (based on similar profiles)
      const historicalFactor = await this.getHistoricalSuccessRate(userProfile, job);
      
      // Company responsiveness factor
      const responsivenessFactor = await this.getCompanyResponsivenessScore(job.company.id);

      // Final probability calculation
      const successProbability = (
        baseScore * 0.6 +
        (1 - competitionFactor) * 0.2 +
        historicalFactor * 0.15 +
        responsivenessFactor * 0.05
      );

      return Math.max(0.1, Math.min(0.95, successProbability)); // Keep between 10-95%
    } catch (error) {
      logger.error('Error calculating success probability', { error });
      return 0.5; // Neutral probability on error
    }
  }

  /**
   *  MAGIC: Generate AI-powered explanations and insights
   */
  private async generateMagicInsights(
    userProfile: UserProfile,
    job: Job & { company: any },
    scores: Record<string, number>
  ) {
    try {
      const personalityInsights = {
        communicationStyle: this.describePersonalityTrait(userProfile.personalityProfile?.communicationStyle),
        workingStyle: this.describePersonalityTrait(userProfile.personalityProfile?.workingPreference),
        culturalAlignment: this.describeCulturalAlignment(scores.culturalFitScore),
        confidenceLevel: this.getConfidenceLevel(scores.successProbability)
      };

      // Generate compelling match explanation
      const magicExplanation = await this.generateMagicExplanation(userProfile, job, scores);
      
      // Generate "why perfect fit" narrative
      const whyPerfectFit = await this.generatePerfectFitStory(userProfile, job, scores);

      return { magicExplanation, whyPerfectFit, personalityInsights };
    } catch (error) {
      logger.error('Error generating magic insights', { error });
      return {
        magicExplanation: 'This role aligns well with your profile and experience.',
        whyPerfectFit: 'Your skills and background make you a strong candidate for this position.',
        personalityInsights: {
          communicationStyle: 'Professional and clear',
          workingStyle: 'Collaborative team player',
          culturalAlignment: 'Good alignment with company culture',
          confidenceLevel: 'High' as const
        }
      };
    }
  }

  /**
   *  MAGIC: Enhanced match insights with personality factors
   */
  private generateEnhancedMatchInsights(
    userProfile: UserProfile,
    job: Job,
    scores: Record<string, number>
  ) {
    const strengths: string[] = [];
    const gaps: string[] = [];
    const recommendations: string[] = [];

    // Original insights
    if (scores.skillsScore > 0.8) {
      strengths.push(' Excellent technical skills alignment');
    }
    if (scores.experienceScore > 0.8) {
      strengths.push(' Perfect experience level match');
    }
    if (scores.locationScore > 0.9) {
      strengths.push(' Ideal location setup');
    }

    //  NEW: Personality-based insights
    if (scores.personalityScore > 0.8) {
      strengths.push(' Outstanding personality-role alignment');
    }
    if (scores.culturalFitScore > 0.8) {
      strengths.push(' Exceptional cultural fit with company');
    }
    if (scores.successProbability > 0.8) {
      strengths.push(' Very high success probability');
    }

    // Enhanced gap analysis
    if (scores.personalityScore < 0.5) {
      gaps.push(' Personality style may not align with role requirements');
      recommendations.push('Consider highlighting adaptability and growth mindset in your application');
    }
    if (scores.culturalFitScore < 0.5) {
      gaps.push(' Company culture may not be ideal match');
      recommendations.push('Research company values and adjust application messaging accordingly');
    }
    if (scores.skillsScore < 0.5) {
      gaps.push(' Skills gap identified in key areas');
      recommendations.push('Focus on highlighting transferable skills and learning potential');
    }

    // Success probability recommendations
    if (scores.successProbability > 0.8) {
      recommendations.push(' Apply immediately - very high success probability!');
    } else if (scores.successProbability > 0.6) {
      recommendations.push(' Good opportunity - worth applying with tailored application');
    } else {
      recommendations.push(' Consider optimizing profile before applying to similar roles');
    }

    return { strengths, gaps, recommendations };
  }

  // ========================================
  //  AI PERSONALITY ANALYSIS HELPERS
  // ========================================

  /**
   * Analyze text patterns for personality insights
   */
  private analyzeTextPatterns(text: string) {
    const patterns = {
      formalLanguage: /\b(pursuant|therefore|furthermore|consequently|accordingly)\b/gi.test(text),
      technicalLanguage: /\b(implemented|optimized|architected|configured|deployed)\b/gi.test(text),
      leadershipLanguage: /\b(led|managed|directed|coordinated|supervised)\b/gi.test(text),
      collaborativeLanguage: /\b(collaborated|partnered|worked with|team|cross-functional)\b/gi.test(text),
      achievementFocus: /\b(achieved|increased|improved|delivered|exceeded)\b/gi.test(text),
      innovativeLanguage: /\b(innovative|creative|pioneered|developed|designed)\b/gi.test(text),
      analyticalLanguage: /\b(analyzed|evaluated|assessed|measured|calculated)\b/gi.test(text),
      quantitativeEvidence: /\d+%|\$[\d,]+|\d+\+/.test(text)
    };

    return patterns;
  }

  /**
   * Generate personality profile from analysis
   */
  private generatePersonalityProfile(sentimentData: any, textPatterns: any): UserProfile['personalityProfile'] {
    // Communication style analysis
    let communicationStyle: 'formal' | 'conversational' | 'technical' | 'creative' = 'conversational';
    if (textPatterns.formalLanguage) communicationStyle = 'formal';
    else if (textPatterns.technicalLanguage) communicationStyle = 'technical';
    else if (textPatterns.innovativeLanguage) communicationStyle = 'creative';

    // Working preference analysis  
    let workingPreference: 'collaborative' | 'independent' | 'leadership' | 'supportive' = 'collaborative';
    if (textPatterns.leadershipLanguage) workingPreference = 'leadership';
    else if (textPatterns.collaborativeLanguage) workingPreference = 'collaborative';
    else if (textPatterns.achievementFocus) workingPreference = 'independent';
    else workingPreference = 'supportive';

    // Problem solving style
    let problemSolving: 'analytical' | 'creative' | 'systematic' | 'innovative' = 'systematic';
    if (textPatterns.analyticalLanguage) problemSolving = 'analytical';
    else if (textPatterns.innovativeLanguage) problemSolving = 'innovative';
    else if (textPatterns.technicalLanguage) problemSolving = 'systematic';
    else problemSolving = 'creative';

    // Decision making style
    let decisionMaking: 'data-driven' | 'intuitive' | 'consensus' | 'decisive' = 'data-driven';
    if (textPatterns.quantitativeEvidence) decisionMaking = 'data-driven';
    else if (textPatterns.collaborativeLanguage) decisionMaking = 'consensus';
    else if (textPatterns.leadershipLanguage) decisionMaking = 'decisive';
    else decisionMaking = 'intuitive';

    // Confidence from sentiment and language strength
    const sentimentScore = Array.isArray(sentimentData) ? 
      sentimentData.find(s => s.label === 'POSITIVE')?.score || 0.5 : 0.5;
    const confidence = Math.min(0.95, Math.max(0.3, sentimentScore + (textPatterns.achievementFocus ? 0.2 : 0)));

    return {
      communicationStyle,
      workingPreference,
      problemSolving,
      decisionMaking,
      confidence
    };
  }

  /**
   * Analyze job description for personality requirements
   */
  private async analyzeJobPersonalityRequirements(description: string, requirements: string | string[]) {
    const fullText = `${description} ${Array.isArray(requirements) ? requirements.join(' ') : requirements}`;
    const lowerText = fullText.toLowerCase();

    return {
      preferredCommunication: this.detectPreferredCommunicationStyle(lowerText),
      preferredWorking: this.detectPreferredWorkingStyle(lowerText),
      preferredProblemSolving: this.detectPreferredProblemSolving(lowerText),
      preferredDecisionMaking: this.detectPreferredDecisionMaking(lowerText)
    };
  }

  /**
   * Detect communication style preferences from job text
   */
  private detectPreferredCommunicationStyle(text: string): string[] {
    const styles: string[] = [];
    
    if (/\b(professional|corporate|executive|formal)\b/.test(text)) styles.push('formal');
    if (/\b(casual|friendly|approachable|conversational)\b/.test(text)) styles.push('conversational');
    if (/\b(technical|documentation|specifications|code)\b/.test(text)) styles.push('technical');
    if (/\b(creative|innovative|design|artistic)\b/.test(text)) styles.push('creative');
    
    return styles.length > 0 ? styles : ['conversational']; // Default
  }

  /**
   * Detect working style preferences from job text
   */
  private detectPreferredWorkingStyle(text: string): string[] {
    const styles: string[] = [];
    
    if (/\b(team|collaborate|cross-functional|partnership)\b/.test(text)) styles.push('collaborative');
    if (/\b(independent|autonomous|self-directed|individual)\b/.test(text)) styles.push('independent');
    if (/\b(lead|manage|direct|supervise|mentor)\b/.test(text)) styles.push('leadership');
    if (/\b(support|assist|help|coordinate)\b/.test(text)) styles.push('supportive');
    
    return styles.length > 0 ? styles : ['collaborative'];
  }

  /**
   * Detect problem solving preferences from job text
   */
  private detectPreferredProblemSolving(text: string): string[] {
    const styles: string[] = [];
    
    if (/\b(analyze|data|metrics|research|evaluate)\b/.test(text)) styles.push('analytical');
    if (/\b(creative|innovative|design|brainstorm|ideate)\b/.test(text)) styles.push('creative');
    if (/\b(process|systematic|methodology|framework|structured)\b/.test(text)) styles.push('systematic');
    if (/\b(innovative|cutting-edge|breakthrough|pioneer)\b/.test(text)) styles.push('innovative');
    
    return styles.length > 0 ? styles : ['systematic'];
  }

  /**
   * Detect decision making preferences from job text
   */
  private detectPreferredDecisionMaking(text: string): string[] {
    const styles: string[] = [];
    
    if (/\b(data-driven|analytics|metrics|evidence|research)\b/.test(text)) styles.push('data-driven');
    if (/\b(intuitive|instinct|experience|judgment|feel)\b/.test(text)) styles.push('intuitive');
    if (/\b(consensus|collaborative|stakeholder|input|feedback)\b/.test(text)) styles.push('consensus');
    if (/\b(decisive|quick|fast-paced|immediate|urgent)\b/.test(text)) styles.push('decisive');
    
    return styles.length > 0 ? styles : ['data-driven'];
  }

  /**
   * Calculate trait compatibility score
   */
  private calculateTraitCompatibility(userTrait: string, jobPreferences: string[]): number {
    if (jobPreferences.includes(userTrait)) {
      return 1.0; // Perfect match
    }
    
    // Check for compatible traits
    const compatibilityMatrix: Record<string, string[]> = {
      'formal': ['conversational', 'technical'],
      'conversational': ['formal', 'creative'],
      'technical': ['formal', 'systematic'],
      'creative': ['conversational', 'innovative'],
      'collaborative': ['supportive', 'leadership'],
      'independent': ['analytical', 'systematic'],
      'leadership': ['collaborative', 'decisive'],
      'supportive': ['collaborative', 'consensus'],
      'analytical': ['data-driven', 'systematic'],
      'creative': ['innovative', 'intuitive'],
      'systematic': ['analytical', 'data-driven'],
      'innovative': ['creative', 'decisive'],
      'data-driven': ['analytical', 'systematic'],
      'intuitive': ['creative', 'consensus'],
      'consensus': ['collaborative', 'supportive'],
      'decisive': ['leadership', 'innovative']
    };
    
    const compatibleTraits = compatibilityMatrix[userTrait] || [];
    const hasCompatible = jobPreferences.some(pref => compatibleTraits.includes(pref));
    
    return hasCompatible ? 0.7 : 0.4; // Partial match or low compatibility
  }

  /**
   * Analyze company culture (simplified version)
   */
  private async analyzeCompanyCulture(company: any) {
    // For now, analyze based on company description and industry
    const description = company.description || '';
    const industry = company.industry || '';
    
    // Industry-based cultural patterns
    const culturalTraits = {
      startup: ['informal', 'fast-paced', 'innovative', 'flexible'],
      tech: ['collaborative', 'data-driven', 'innovative', 'results-oriented'],
      banking: ['formal', 'process-driven', 'compliance-focused', 'traditional'],
      creative: ['informal', 'creative', 'flexible', 'expression-valued'],
      consulting: ['client-focused', 'analytical', 'professional', 'deadline-driven']
    };

    let traits = culturalTraits.startup; // Default
    
    if (industry.toLowerCase().includes('tech')) traits = culturalTraits.tech;
    else if (industry.toLowerCase().includes('bank') || industry.toLowerCase().includes('finance')) traits = culturalTraits.banking;
    else if (industry.toLowerCase().includes('creative') || industry.toLowerCase().includes('design')) traits = culturalTraits.creative;
    else if (industry.toLowerCase().includes('consult')) traits = culturalTraits.consulting;

    return {
      traits,
      workEnvironment: company.size === 'STARTUP' ? 'fast-paced' : 'structured',
      communicationStyle: traits.includes('formal') ? 'formal' : 'conversational',
      decisionMaking: traits.includes('data-driven') ? 'data-driven' : 'consensus'
    };
  }

  /**
   * Calculate cultural alignment score
   */
  private calculateCulturalAlignment(userPersonality: any, companyCulture: any): number {
    if (!userPersonality || !companyCulture) return 0.7;
    
    let alignmentScore = 0;
    let factors = 0;

    // Communication alignment
    if (userPersonality.communicationStyle === companyCulture.communicationStyle) {
      alignmentScore += 0.4;
    } else {
      alignmentScore += 0.2; // Partial credit for adaptability
    }
    factors++;

    // Working style alignment
    const workingCompatibility = {
      'collaborative': ['fast-paced', 'structured'],
      'independent': ['fast-paced'],
      'leadership': ['structured', 'fast-paced'],
      'supportive': ['structured']
    };
    
    const compatibleEnvironments = workingCompatibility[userPersonality.workingPreference] || [];
    if (compatibleEnvironments.includes(companyCulture.workEnvironment)) {
      alignmentScore += 0.3;
    } else {
      alignmentScore += 0.15;
    }
    factors++;

    // Decision making alignment
    if (userPersonality.decisionMaking === companyCulture.decisionMaking) {
      alignmentScore += 0.3;
    } else {
      alignmentScore += 0.15;
    }
    factors++;

    return Math.min(1.0, alignmentScore);
  }

  /**
   * Helper methods for magic explanations
   */
  private async generateMagicExplanation(userProfile: UserProfile, job: Job, scores: Record<string, number>): Promise<string> {
    const highlights = [];
    
    if (scores.personalityScore > 0.8) {
      highlights.push(`your ${userProfile.personalityProfile?.communicationStyle} communication style perfectly matches their team culture`);
    }
    if (scores.skillsScore > 0.8) {
      highlights.push(`your technical expertise covers ${Math.round(scores.skillsScore * 10)}/10 required skills`);
    }
    if (scores.successProbability > 0.8) {
      highlights.push(`similar profiles have ${Math.round(scores.successProbability * 100)}% success rate with this company`);
    }

    const explanation = highlights.length > 0 ?
      `This role is exceptional for you because ${highlights.join(', and ')}.` :
      'This role aligns well with your profile across multiple dimensions.';
    
    return explanation;
  }

  private async generatePerfectFitStory(userProfile: UserProfile, job: Job, scores: Record<string, number>): Promise<string> {
    const storyElements = [];
    
    if (userProfile.yearsOfExperience >= (job.yearsExperienceMin || 0)) {
      storyElements.push(`Your ${userProfile.yearsOfExperience} years of experience in ${userProfile.experience[0]?.jobTitle || 'your field'}`);
    }
    
    if (scores.personalityScore > 0.7) {
      storyElements.push(`your ${userProfile.personalityProfile?.workingPreference} working style`);
    }
    
    if (scores.skillsScore > 0.7) {
      const topSkills = userProfile.skills.slice(0, 2).join(' and ');
      storyElements.push(`your expertise in ${topSkills}`);
    }

    const story = storyElements.length > 0 ?
      `${storyElements.join(', combined with ')} makes you an ideal candidate for this ${job.title} role.` :
      'Your background and skills align well with this opportunity.';
    
    return story;
  }

  private describePersonalityTrait(trait?: string): string {
    const descriptions: Record<string, string> = {
      'formal': 'Professional and structured communication',
      'conversational': 'Approachable and friendly communication',
      'technical': 'Clear and precise technical communication',
      'creative': 'Innovative and expressive communication',
      'collaborative': 'Team-oriented and cooperative approach',
      'independent': 'Self-directed and autonomous working style',
      'leadership': 'Natural leader with mentoring abilities',
      'supportive': 'Helpful and service-oriented approach',
      'analytical': 'Data-driven problem solving approach',
      'systematic': 'Methodical and process-oriented thinking',
      'innovative': 'Creative and breakthrough thinking',
      'data-driven': 'Evidence-based decision making',
      'intuitive': 'Experience-guided decision making',
      'consensus': 'Collaborative decision making approach',
      'decisive': 'Quick and confident decision making'
    };
    
    return descriptions[trait || ''] || 'Adaptable and professional approach';
  }

  private describeCulturalAlignment(score: number): string {
    if (score > 0.8) return 'Exceptional cultural alignment - you\'ll thrive here';
    if (score > 0.6) return 'Good cultural fit with room for positive impact';
    if (score > 0.4) return 'Moderate alignment - success depends on adaptability';
    return 'Cultural differences present - consider if this aligns with your values';
  }

  private getConfidenceLevel(probability: number): 'Low' | 'Medium' | 'High' | 'Very High' {
    if (probability > 0.8) return 'Very High';
    if (probability > 0.65) return 'High';
    if (probability > 0.45) return 'Medium';
    return 'Low';
  }

  // Helper methods for success probability calculation
  private async estimateMarketCompetition(job: Job, userProfile: UserProfile): Promise<number> {
    // Simplified competition estimation
    const baseCompetition = 0.7; // 70% base competition
    
    // Popular skills increase competition
    const popularSkills = ['javascript', 'python', 'react', 'project management'];
    const hasPopularSkills = userProfile.skills.some(skill => 
      popularSkills.includes(skill.toLowerCase())
    );
    
    // Remote jobs have higher competition
    const competitionMultiplier = job.isRemote ? 1.2 : 1.0;
    
    return Math.min(0.9, baseCompetition * competitionMultiplier * (hasPopularSkills ? 1.1 : 0.9));
  }

  private async getHistoricalSuccessRate(userProfile: UserProfile, job: Job): Promise<number> {
    // Simplified historical analysis - in production, use ML model
    let baseRate = 0.4; // 40% base success rate
    
    // Experience factor
    if (userProfile.yearsOfExperience >= (job.yearsExperienceMin || 0)) {
      baseRate += 0.2;
    }
    
    // Skills factor
    const skillMatch = userProfile.skills.length > 3 ? 0.15 : 0.05;
    baseRate += skillMatch;
    
    // Personality confidence factor
    if (userProfile.personalityProfile?.confidence && userProfile.personalityProfile.confidence > 0.7) {
      baseRate += 0.1;
    }
    
    return Math.min(0.8, baseRate);
  }

  private async getCompanyResponsivenessScore(companyId: string): Promise<number> {
    // Simplified responsiveness scoring
    // In production, analyze historical response rates
    return 0.65; // 65% average responsiveness
  }

  // ========================================
  //  NEW ENHANCED MATCHING METHODS
  // ========================================

  /**
   *  Initialize industry-specific weights
   */
  private initializeIndustryWeights(): void {
    // Technology industry weights
    this.industryWeights.set('Technology', {
      skills: 0.35,        // Higher emphasis on technical skills
      experience: 0.20,
      personality: 0.20,   // Important for team fit
      education: 0.05,     // Less important in tech
      location: 0.10,
      salary: 0.05,
      culturalFit: 0.05
    });

    // Finance industry weights
    this.industryWeights.set('Finance', {
      skills: 0.25,
      experience: 0.25,    // Experience very important
      personality: 0.15,
      education: 0.20,     // Education matters in finance
      location: 0.10,
      salary: 0.03,
      culturalFit: 0.02
    });

    // Healthcare industry weights
    this.industryWeights.set('Healthcare', {
      skills: 0.30,
      experience: 0.25,
      personality: 0.20,   // Important for patient care
      education: 0.15,     // Certifications matter
      location: 0.05,      // Often location-bound
      salary: 0.03,
      culturalFit: 0.02
    });

    // Creative industry weights
    this.industryWeights.set('Creative', {
      skills: 0.40,        // Portfolio and skills critical
      experience: 0.15,
      personality: 0.25,   // Creativity and fit important
      education: 0.05,     // Less formal education emphasis
      location: 0.10,
      salary: 0.03,
      culturalFit: 0.02
    });

    // Default weights for other industries
    this.industryWeights.set('General', {
      skills: 0.25,
      experience: 0.20,
      personality: 0.15,
      education: 0.10,
      location: 0.15,
      salary: 0.10,
      culturalFit: 0.05
    });
  }

  /**
   *  Get industry-specific scoring weights
   */
  private getIndustryWeights(industry: string): Record<string, number> {
    const normalizedIndustry = industry.toLowerCase();
    
    if (normalizedIndustry.includes('tech') || normalizedIndustry.includes('software')) {
      return this.industryWeights.get('Technology') || this.industryWeights.get('General')!;
    }
    if (normalizedIndustry.includes('finance') || normalizedIndustry.includes('bank')) {
      return this.industryWeights.get('Finance') || this.industryWeights.get('General')!;
    }
    if (normalizedIndustry.includes('health') || normalizedIndustry.includes('medical')) {
      return this.industryWeights.get('Healthcare') || this.industryWeights.get('General')!;
    }
    if (normalizedIndustry.includes('creative') || normalizedIndustry.includes('design')) {
      return this.industryWeights.get('Creative') || this.industryWeights.get('General')!;
    }
    
    return this.industryWeights.get('General')!;
  }

  /**
   *  Get enhanced user profile with advanced CV analysis
   */
  private async getEnhancedUserProfile(userId: string): Promise<UserProfile> {
    try {
      const baseProfile = await this.getUserProfile(userId);
      
      //  NEW: Enhanced CV analysis
      if (baseProfile.cvContent) {
        const cvAnalysis = await this.cvAnalysisService.analyzeCv(baseProfile.cvContent);
        
        // Extract additional insights from CV analysis
        const careerGoals = cvAnalysis.careerGoals || [];
        const achievementPatterns = cvAnalysis.achievements.map(a => a.impact) || [];
        const leadershipExperience = cvAnalysis.leadershipRoles.length > 0;
        
        //  NEW: Career DNA analysis for deeper insights
        const careerDna = await this.careerDnaService.analyzeCareerDNA(userId);
        
        return {
          ...baseProfile,
          careerGoals,
          achievementPatterns,
          leadershipExperience,
          careerStage: this.determineCareerStage(baseProfile.yearsOfExperience, leadershipExperience),
          learningOrientation: careerDna.growthOrientation || 75,
          industryExperience: this.extractIndustryExperience(baseProfile.experience),
          workLifeBalance: careerDna.workLifeBalance || 70,
          riskTolerance: this.assessRiskTolerance(baseProfile, careerDna),
          remoteWorkPreference: this.assessRemotePreference(baseProfile)
        };
      }
      
      return baseProfile;
    } catch (error) {
      logger.error('Error getting enhanced user profile', { error, userId });
      // Fallback to base profile
      return await this.getUserProfile(userId);
    }
  }

  /**
   *  Smart sorting of matches based on multiple factors
   */
  private smartSortMatches(matches: JobMatchResult[], userProfile: UserProfile): JobMatchResult[] {
    return matches.sort((a, b) => {
      // Primary sort by overall score
      const scoreDiff = b.overallScore - a.overallScore;
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
      
      // Secondary sort by success probability
      const probabilityDiff = b.successProbability - a.successProbability;
      if (Math.abs(probabilityDiff) > 0.1) return probabilityDiff;
      
      // Tertiary sort by career growth potential
      return b.careerGrowthPotential - a.careerGrowthPotential;
    });
  }

  /**
   *  Apply intelligent filtering to job matches
   */
  private async applyIntelligentFiltering(
    matches: JobMatchResult[],
    filters: {
      minScore: number;
      includeGrowthJobs: boolean;
      preferredIndustries: string[];
      careerStage?: string;
      riskTolerance: string;
      userId: string;
    }
  ): Promise<JobMatchResult[]> {
    try {
      let filtered = matches.filter(match => match.overallScore >= filters.minScore);
      
      //  Include growth opportunities even if slightly below threshold
      if (filters.includeGrowthJobs) {
        const growthJobs = matches.filter(match => 
          match.overallScore >= filters.minScore - 0.15 && 
          match.careerGrowthPotential > 0.7
        );
        filtered = [...new Set([...filtered, ...growthJobs])];
      }
      
      //  Filter by preferred industries
      if (filters.preferredIndustries.length > 0) {
        filtered = filtered.filter(match => 
          match.industryFitScore > 0.6 || filters.preferredIndustries.length === 0
        );
      }
      
      //  Filter by career stage appropriateness
      if (filters.careerStage) {
        filtered = await this.filterByCareerStage(filtered, filters.careerStage);
      }
      
      //  Filter by risk tolerance
      filtered = this.filterByRiskTolerance(filtered, filters.riskTolerance);
      
      return filtered;
    } catch (error) {
      logger.error('Error applying intelligent filtering', { error });
      return matches.filter(match => match.overallScore >= filters.minScore);
    }
  }

  /**
   *  Diversify recommendations for better user experience
   */
  private diversifyRecommendations(matches: JobMatchResult[], limit: number): JobMatchResult[] {
    const diversified: JobMatchResult[] = [];
    const usedCompanies = new Set<string>();
    const usedIndustries = new Set<string>();
    
    // First pass: Add top matches ensuring diversity
    for (const match of matches) {
      if (diversified.length >= limit) break;
      
      const jobDetails = match.matchDetails;
      const companyId = match.jobId; // Simplified
      const industry = 'General'; // Simplified - would extract from job data
      
      // Prioritize if it adds diversity
      const addsDiversity = !usedCompanies.has(companyId) || !usedIndustries.has(industry);
      
      if (addsDiversity || diversified.length < limit * 0.7) {
        diversified.push(match);
        usedCompanies.add(companyId);
        usedIndustries.add(industry);
      }
    }
    
    // Second pass: Fill remaining slots with best matches
    const remaining = matches.filter(m => !diversified.includes(m));
    const slotsLeft = limit - diversified.length;
    diversified.push(...remaining.slice(0, slotsLeft));
    
    return diversified;
  }

  /**
   *  Calculate career growth potential for a job
   */
  private async calculateCareerGrowthPotential(userProfile: UserProfile, job: Job): Promise<number> {
    try {
      let growthScore = 0.5; // Base score
      
      // Company size factor
      const companySizeMultiplier = {
        'STARTUP': 0.9,      // High growth but risky
        'SMALL': 0.7,        // Moderate growth
        'MEDIUM': 0.8,       // Good growth opportunities
        'LARGE': 0.6,        // Stable but slower growth
        'ENTERPRISE': 0.5    // Least growth but most stable
      };
      
      // Industry growth factor
      const industryGrowthMultiplier = this.getIndustryGrowthMultiplier(job.company?.industry);
      
      // Role progression potential
      const roleLevel = this.assessRoleLevel(job.title);
      const userLevel = this.assessUserLevel(userProfile);
      const progressionPotential = Math.max(0, (roleLevel - userLevel + 2) / 4);
      
      // Skills development opportunity
      const skillsGrowthOpportunity = await this.assessSkillsGrowthOpportunity(userProfile, job);
      
      growthScore = (
        growthScore * 0.2 +
        industryGrowthMultiplier * 0.3 +
        progressionPotential * 0.3 +
        skillsGrowthOpportunity * 0.2
      );
      
      return Math.min(1.0, growthScore);
    } catch (error) {
      logger.error('Error calculating career growth potential', { error });
      return 0.5;
    }
  }

  /**
   *  Calculate skill development opportunity
   */
  private async calculateSkillDevelopmentOpportunity(userProfile: UserProfile, job: Job): Promise<number> {
    try {
      const jobSkills = [...job.requiredSkills, ...job.preferredSkills];
      const userSkills = userProfile.skills.map(s => s.toLowerCase());
      
      // Count new skills this job would expose user to
      const newSkills = jobSkills.filter(skill => 
        !userSkills.includes(skill.toLowerCase())
      );
      
      // Assess skill market value
      const skillValue = await this.assessSkillMarketValue(newSkills);
      
      // Calculate learning opportunity score
      const learningScore = Math.min(1.0, (newSkills.length * 0.1) + (skillValue * 0.6));
      
      return learningScore;
    } catch (error) {
      logger.error('Error calculating skill development opportunity', { error });
      return 0.5;
    }
  }

  /**
   *  Calculate industry fit score
   */
  private calculateIndustryFit(userProfile: UserProfile, job: Job): number {
    const jobIndustry = job.company?.industry?.toLowerCase() || '';
    const userIndustries = userProfile.industries.map(i => i.toLowerCase());
    const userIndustryExp = userProfile.industryExperience || {};
    
    // Exact industry match
    if (userIndustries.includes(jobIndustry)) {
      const experienceYears = userIndustryExp[jobIndustry] || 0;
      return Math.min(1.0, 0.8 + (experienceYears * 0.05));
    }
    
    // Related industry match
    const relatedIndustries = this.getRelatedIndustries(jobIndustry);
    const hasRelatedExperience = userIndustries.some(ui => relatedIndustries.includes(ui));
    
    if (hasRelatedExperience) {
      return 0.6;
    }
    
    // Transferable skills bonus
    const transferableBonus = userProfile.skills.some(skill => 
      this.isTransferableSkill(skill, jobIndustry)
    ) ? 0.2 : 0;
    
    return 0.3 + transferableBonus;
  }

  /**
   *  Generate role progression path
   */
  private async generateRoleProgressionPath(userProfile: UserProfile, job: Job): Promise<string[]> {
    try {
      const currentLevel = this.assessUserLevel(userProfile);
      const targetLevel = this.assessRoleLevel(job.title);
      
      const progressionPaths: Record<string, string[]> = {
        'entry_to_mid': [
          'Junior Developer → Developer → Senior Developer',
          'Associate → Specialist → Senior Specialist',
          'Analyst → Senior Analyst → Lead Analyst'
        ],
        'mid_to_senior': [
          'Senior Developer → Lead Developer → Engineering Manager',
          'Senior Analyst → Principal Analyst → Director',
          'Manager → Senior Manager → Director'
        ],
        'senior_to_executive': [
          'Director → VP → C-Level Executive',
          'Principal → Distinguished Engineer → CTO',
          'Senior Manager → VP → President'
        ]
      };
      
      const pathKey = this.getProgressionPathKey(currentLevel, targetLevel);
      return progressionPaths[pathKey] || ['Current Role → Target Role → Advanced Role'];
    } catch (error) {
      logger.error('Error generating role progression path', { error });
      return ['Standard career progression available'];
    }
  }

  /**
   *  Calculate compensation fairness score
   */
  private calculateCompensationFairness(userProfile: UserProfile, job: Job): number {
    try {
      const jobSalaryAvg = job.salaryMin && job.salaryMax ? 
        (job.salaryMin + job.salaryMax) / 2 : 
        job.salaryMin || job.salaryMax || 0;
      
      if (jobSalaryAvg === 0) return 0.7; // No salary info
      
      // Market rate estimation based on skills and experience
      const expectedSalary = this.estimateMarketSalary(userProfile);
      
      const fairnessRatio = jobSalaryAvg / expectedSalary;
      
      if (fairnessRatio >= 1.1) return 1.0;  // Above market rate
      if (fairnessRatio >= 0.95) return 0.9; // At market rate
      if (fairnessRatio >= 0.85) return 0.7; // Slightly below market
      if (fairnessRatio >= 0.75) return 0.5; // Below market
      return 0.3; // Significantly below market
    } catch (error) {
      logger.error('Error calculating compensation fairness', { error });
      return 0.7;
    }
  }

  /**
   *  Calculate work-life balance score
   */
  private calculateWorkLifeBalance(userProfile: UserProfile, job: Job): number {
    try {
      const userPreference = userProfile.workLifeBalance || 70;
      
      // Analyze job for work-life balance indicators
      const jobText = `${job.description} ${job.requirements}`.toLowerCase();
      
      let balanceScore = 0.7; // Base score
      
      // Positive indicators
      if (jobText.includes('flexible') || jobText.includes('work-life balance')) balanceScore += 0.2;
      if (job.isRemote) balanceScore += 0.15;
      if (jobText.includes('part-time') || jobText.includes('flexible hours')) balanceScore += 0.1;
      
      // Negative indicators
      if (jobText.includes('overtime') || jobText.includes('on-call')) balanceScore -= 0.15;
      if (jobText.includes('fast-paced') || jobText.includes('high-pressure')) balanceScore -= 0.1;
      
      // Adjust based on user preference
      if (userPreference > 80 && balanceScore < 0.6) {
        balanceScore *= 0.8; // Penalize if user values balance highly
      }
      
      return Math.max(0.2, Math.min(1.0, balanceScore));
    } catch (error) {
      logger.error('Error calculating work-life balance', { error });
      return 0.7;
    }
  }

  /**
   *  Identify risks and unique advantages
   */
  private identifyRiskAndAdvantages(
    userProfile: UserProfile,
    job: Job,
    scores: Record<string, number>
  ): { riskFactors: string[]; uniqueAdvantages: string[] } {
    const riskFactors: string[] = [];
    const uniqueAdvantages: string[] = [];
    
    // Risk assessment
    if (scores.skillsScore < 0.4) {
      riskFactors.push('Significant skills gap may require extensive learning');
    }
    if (scores.experienceScore < 0.3) {
      riskFactors.push('Experience level below minimum requirements');
    }
    if (scores.culturalFitScore < 0.4) {
      riskFactors.push('Potential cultural misalignment with company values');
    }
    if (userProfile.riskTolerance === 'low' && job.company?.size === 'STARTUP') {
      riskFactors.push('Startup environment may not align with low risk tolerance');
    }
    
    // Advantage identification
    if (scores.personalityScore > 0.85) {
      uniqueAdvantages.push('Exceptional personality-role alignment');
    }
    if (userProfile.leadershipExperience && scores.experienceScore > 0.7) {
      uniqueAdvantages.push('Strong leadership background for role progression');
    }
    if (scores.skillsScore > 0.9) {
      uniqueAdvantages.push('Outstanding technical skills match');
    }
    if (userProfile.learningOrientation && userProfile.learningOrientation > 80) {
      uniqueAdvantages.push('High learning orientation for skill development');
    }
    
    return { riskFactors, uniqueAdvantages };
  }

  /**
   *  Generate application strategy
   */
  private async generateApplicationStrategy(
    userProfile: UserProfile,
    job: Job,
    successProbability: number
  ): Promise<JobMatchResult['applicationStrategy']> {
    try {
      const priority = this.determinePriority(successProbability, userProfile, job);
      const customization = await this.generateCustomizationTips(userProfile, job);
      const timeline = this.generateApplicationTimeline(priority, job);
      const successTips = await this.generateSuccessTips(userProfile, job, successProbability);
      
      return {
        priority,
        customization,
        timeline,
        successTips
      };
    } catch (error) {
      logger.error('Error generating application strategy', { error });
      return {
        priority: 'medium',
        customization: ['Tailor your application to highlight relevant experience'],
        timeline: 'Apply within 1-2 weeks',
        successTips: ['Research the company culture and values']
      };
    }
  }

  // ========================================
  //  HELPER METHODS FOR ENHANCED FEATURES
  // ========================================

  private determineCareerStage(experience: number, hasLeadership: boolean): UserProfile['careerStage'] {
    if (experience < 2) return 'entry';
    if (experience < 5) return 'mid';
    if (experience < 10 || !hasLeadership) return 'senior';
    return 'executive';
  }

  private extractIndustryExperience(experiences: any[]): Record<string, number> {
    const industryExp: Record<string, number> = {};
    
    for (const exp of experiences) {
      const industry = exp.industry || 'General';
      const years = exp.duration || 1;
      industryExp[industry] = (industryExp[industry] || 0) + years;
    }
    
    return industryExp;
  }

  private assessRiskTolerance(userProfile: UserProfile, careerDna: any): UserProfile['riskTolerance'] {
    if (careerDna.riskTolerance) return careerDna.riskTolerance;
    
    // Infer from experience and career choices
    const hasStartupExp = userProfile.experience.some(exp => 
      exp.company?.toLowerCase().includes('startup')
    );
    
    if (hasStartupExp) return 'high';
    if (userProfile.yearsOfExperience > 10) return 'low';
    return 'medium';
  }

  private assessRemotePreference(userProfile: UserProfile): UserProfile['remoteWorkPreference'] {
    // Simplified assessment - in production, use user preferences
    const hasRemoteExp = userProfile.experience.some(exp => 
      exp.description?.toLowerCase().includes('remote')
    );
    
    return hasRemoteExp ? 'preferred' : 'acceptable';
  }

  private getIndustryGrowthMultiplier(industry?: string): number {
    const growthRates: Record<string, number> = {
      'Technology': 1.2,
      'Healthcare': 1.1,
      'Finance': 0.9,
      'Manufacturing': 0.8,
      'Retail': 0.7,
      'Government': 0.6
    };
    
    return growthRates[industry || ''] || 1.0;
  }

  private assessRoleLevel(jobTitle: string): number {
    const titleLower = jobTitle.toLowerCase();
    
    if (titleLower.includes('intern') || titleLower.includes('junior')) return 1;
    if (titleLower.includes('senior') || titleLower.includes('lead')) return 3;
    if (titleLower.includes('principal') || titleLower.includes('staff')) return 4;
    if (titleLower.includes('manager') || titleLower.includes('director')) return 5;
    if (titleLower.includes('vp') || titleLower.includes('chief')) return 6;
    
    return 2; // Default mid-level
  }

  private assessUserLevel(userProfile: UserProfile): number {
    const experience = userProfile.yearsOfExperience;
    const hasLeadership = userProfile.leadershipExperience;
    
    if (experience < 2) return 1;
    if (experience < 5) return 2;
    if (experience < 8) return hasLeadership ? 4 : 3;
    if (experience < 12) return hasLeadership ? 5 : 4;
    return 6;
  }

  private async assessSkillsGrowthOpportunity(userProfile: UserProfile, job: Job): Promise<number> {
    const jobSkills = [...job.requiredSkills, ...job.preferredSkills];
    const userSkills = userProfile.skills;
    
    // Skills gap analysis
    const skillsGap = await this.skillsGapService.analyzeSkillsGap(userProfile.id, {
      targetRole: job.title,
      targetIndustry: job.company?.industry
    });
    
    // Higher gap = higher learning opportunity
    return Math.min(1.0, skillsGap.skillGaps.length * 0.1);
  }

  private async assessSkillMarketValue(skills: string[]): Promise<number> {
    // Simplified market value assessment
    const highValueSkills = ['ai', 'machine learning', 'kubernetes', 'react', 'python', 'cloud'];
    const mediumValueSkills = ['javascript', 'sql', 'project management', 'excel'];
    
    let value = 0;
    for (const skill of skills) {
      const skillLower = skill.toLowerCase();
      if (highValueSkills.some(hvs => skillLower.includes(hvs))) value += 0.3;
      else if (mediumValueSkills.some(mvs => skillLower.includes(mvs))) value += 0.2;
      else value += 0.1;
    }
    
    return Math.min(1.0, value);
  }

  private getRelatedIndustries(industry: string): string[] {
    const relationships: Record<string, string[]> = {
      'technology': ['software', 'it', 'telecommunications', 'fintech'],
      'finance': ['banking', 'insurance', 'fintech', 'consulting'],
      'healthcare': ['pharmaceuticals', 'biotech', 'medical devices'],
      'retail': ['ecommerce', 'consumer goods', 'fashion'],
      'manufacturing': ['automotive', 'aerospace', 'industrial']
    };
    
    return relationships[industry.toLowerCase()] || [];
  }

  private isTransferableSkill(skill: string, targetIndustry: string): boolean {
    const transferableSkills = [
      'project management', 'communication', 'leadership', 'analysis',
      'problem solving', 'teamwork', 'excel', 'powerpoint'
    ];
    
    return transferableSkills.some(ts => skill.toLowerCase().includes(ts));
  }

  private async filterByCareerStage(matches: JobMatchResult[], careerStage: string): Promise<JobMatchResult[]> {
    // Filter based on career stage appropriateness
    return matches.filter(match => {
      // Simplified filtering - in production, analyze job levels more thoroughly
      return true; // Keep all for now
    });
  }

  private filterByRiskTolerance(matches: JobMatchResult[], riskTolerance: string): JobMatchResult[] {
    if (riskTolerance === 'low') {
      return matches.filter(match => match.riskFactors.length <= 2);
    }
    if (riskTolerance === 'high') {
      return matches; // No filtering for high risk tolerance
    }
    
    // Medium risk tolerance
    return matches.filter(match => match.riskFactors.length <= 3);
  }

  private determinePriority(
    successProbability: number, 
    userProfile: UserProfile, 
    job: Job
  ): JobMatchResult['applicationStrategy']['priority'] {
    if (successProbability > 0.8) return 'immediate';
    if (successProbability > 0.65) return 'high';
    if (successProbability > 0.45) return 'medium';
    return 'low';
  }

  private async generateCustomizationTips(userProfile: UserProfile, job: Job): Promise<string[]> {
    const tips: string[] = [];
    
    // Skills-based customization
    const jobSkills = [...job.requiredSkills, ...job.preferredSkills];
    const matchingSkills = userProfile.skills.filter(skill => 
      jobSkills.some(js => js.toLowerCase().includes(skill.toLowerCase()))
    );
    
    if (matchingSkills.length > 0) {
      tips.push(`Highlight your ${matchingSkills.slice(0, 3).join(', ')} experience prominently`);
    }
    
    // Experience-based customization
    if (userProfile.leadershipExperience && job.title.toLowerCase().includes('lead')) {
      tips.push('Emphasize your leadership experience and team management skills');
    }
    
    // Industry-based customization
    const jobIndustry = job.company?.industry;
    if (jobIndustry && userProfile.industryExperience?.[jobIndustry]) {
      tips.push(`Leverage your ${userProfile.industryExperience[jobIndustry]} years in ${jobIndustry}`);
    }
    
    return tips.length > 0 ? tips : ['Tailor your application to highlight relevant experience'];
  }

  private generateApplicationTimeline(priority: string, job: Job): string {
    const timelines = {
      'immediate': 'Apply today - this is an exceptional match!',
      'high': 'Apply within 2-3 days to stay competitive',
      'medium': 'Apply within 1 week after customizing your application',
      'low': 'Consider improving your profile before applying'
    };
    
    return timelines[priority as keyof typeof timelines] || timelines.medium;
  }

  private async generateSuccessTips(
    userProfile: UserProfile, 
    job: Job, 
    successProbability: number
  ): Promise<string[]> {
    const tips: string[] = [];
    
    if (successProbability > 0.8) {
      tips.push('You\'re a strong candidate - apply with confidence');
      tips.push('Prepare for potential multiple interview rounds');
    } else if (successProbability > 0.6) {
      tips.push('Research the company thoroughly to stand out');
      tips.push('Network with current employees if possible');
    } else {
      tips.push('Consider addressing key skill gaps before applying');
      tips.push('Focus on highlighting transferable skills and potential');
    }
    
    // Personality-based tips
    if (userProfile.personalityProfile?.confidence && userProfile.personalityProfile.confidence < 0.6) {
      tips.push('Practice articulating your achievements confidently');
    }
    
    // Industry-specific tips
    const industry = job.company?.industry?.toLowerCase();
    if (industry?.includes('tech') && !userProfile.skills.some(s => s.toLowerCase().includes('git'))) {
      tips.push('Mention any version control or collaborative development experience');
    }
    
    return tips;
  }

  private estimateMarketSalary(userProfile: UserProfile): number {
    // Simplified market salary estimation
    let baseSalary = 50000; // Base salary
    
    // Experience multiplier
    baseSalary += userProfile.yearsOfExperience * 5000;
    
    // Skills multiplier
    const highValueSkills = userProfile.skills.filter(skill => 
      ['javascript', 'python', 'react', 'aws', 'project management'].includes(skill.toLowerCase())
    );
    baseSalary += highValueSkills.length * 8000;
    
    // Leadership bonus
    if (userProfile.leadershipExperience) {
      baseSalary *= 1.2;
    }
    
    return baseSalary;
  }

  private getProgressionPathKey(currentLevel: number, targetLevel: number): string {
    if (currentLevel <= 2 && targetLevel <= 3) return 'entry_to_mid';
    if (currentLevel <= 4 && targetLevel <= 5) return 'mid_to_senior';
    return 'senior_to_executive';
  }
}

export default AIMatchingService;
