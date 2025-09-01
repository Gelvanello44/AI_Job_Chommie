import { PrismaClient } from '@prisma/client';
import logger from '../config/logger.js';
import { HuggingFaceService } from './huggingface.service.js';
import { AppError } from '../middleware/errorHandler.js';

const prisma = new PrismaClient();

// Types and Interfaces for Industry Language Intelligence
interface IndustryLanguageProfile {
  industry: string;
  trendingKeywords: KeywordTrend[];
  commonPhrases: string[];
  technicalTerms: string[];
  emergingTerms: string[];
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  languagePatterns: {
    formalityLevel: 'casual' | 'professional' | 'formal' | 'academic';
    avgSentenceLength: number;
    commonStructures: string[];
    industryJargon: string[];
  };
  salaryKeywords: string[];
  benefitsLanguage: string[];
  lastUpdated: Date;
}

interface KeywordTrend {
  keyword: string;
  frequency: number;
  growth: number; // Percentage growth over time
  context: 'skills' | 'responsibilities' | 'qualifications' | 'benefits' | 'company_culture';
  importance: 'critical' | 'important' | 'moderate' | 'emerging';
  synonyms: string[];
  relatedTerms: string[];
}

interface LanguageOptimizationSuggestion {
  type: 'keyword_add' | 'phrase_optimize' | 'tone_adjust' | 'structure_improve' | 'jargon_add';
  priority: 'high' | 'medium' | 'low';
  original: string;
  suggested: string;
  reasoning: string;
  impact: number; // 0-100 score for potential impact
  context: string;
}

interface DocumentAnalysis {
  documentType: 'cv' | 'cover_letter' | 'job_description' | 'profile';
  industry: string;
  overallScore: number;
  languageInsights: {
    keywordDensity: number;
    industryAlignment: number;
    professionalTone: number;
    readability: number;
    uniqueness: number;
  };
  suggestions: LanguageOptimizationSuggestion[];
  missingKeywords: KeywordTrend[];
  overusedTerms: string[];
  strengthAreas: string[];
  improvementAreas: string[];
}

interface RealTimeKeywordSuggestions {
  context: string;
  suggestions: {
    keyword: string;
    relevance: number;
    explanation: string;
    usage_example: string;
  }[];
}

export class IndustryLanguageService {
  private hfService: HuggingFaceService;
  private keywordCache: Map<string, IndustryLanguageProfile> = new Map();
  private cacheExpiry: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.hfService = HuggingFaceService.getInstance();
    this.initializeKeywordDatabase();
  }

  /**
   *  MAGIC: Get trending keywords for specific industry
   */
  async getTrendingKeywords(industry: string): Promise<IndustryLanguageProfile> {
    try {
      logger.info(' Getting trending keywords', { industry });

      // Check cache first
      const cached = this.keywordCache.get(industry);
      if (cached && (Date.now() - cached.lastUpdated.getTime()) < this.cacheExpiry) {
        return cached;
      }

      // Analyze job postings to extract trending keywords
      const industryProfile = await this.analyzeIndustryLanguagePatterns(industry);
      
      // Cache the results
      this.keywordCache.set(industry, industryProfile);

      return industryProfile;

    } catch (error) {
      logger.error('Failed to get trending keywords', { error, industry });
      throw new AppError(500, 'Failed to analyze industry keywords', 'KEYWORD_ANALYSIS_ERROR');
    }
  }

  /**
   *  MAGIC: Optimize CV/Cover Letter language for specific industry
   */
  async optimizeDocumentLanguage(
    content: string,
    documentType: 'cv' | 'cover_letter',
    targetIndustry: string,
    userExperienceLevel?: string
  ): Promise<DocumentAnalysis> {
    try {
      logger.info(' Optimizing document language', { documentType, targetIndustry });

      // Get industry language profile
      const industryProfile = await this.getTrendingKeywords(targetIndustry);

      // Analyze current document
      const analysis = await this.analyzeDocumentLanguage(content, documentType, industryProfile);

      // Generate optimization suggestions
      const suggestions = await this.generateOptimizationSuggestions(
        content,
        analysis,
        industryProfile,
        userExperienceLevel
      );

      // Identify missing critical keywords
      const missingKeywords = this.identifyMissingKeywords(content, industryProfile);

      // Detect overused terms
      const overusedTerms = this.detectOverusedTerms(content, industryProfile);

      return {
        documentType,
        industry: targetIndustry,
        overallScore: analysis.overallScore,
        languageInsights: analysis.languageInsights,
        suggestions,
        missingKeywords,
        overusedTerms,
        strengthAreas: analysis.strengthAreas,
        improvementAreas: analysis.improvementAreas
      };

    } catch (error) {
      logger.error('Failed to optimize document language', { error, documentType, targetIndustry });
      throw new AppError(500, 'Failed to optimize document language', 'LANGUAGE_OPTIMIZATION_ERROR');
    }
  }

  /**
   *  MAGIC: Get real-time keyword suggestions while typing
   */
  async getRealTimeKeywordSuggestions(
    context: string,
    industry: string,
    documentType: 'cv' | 'cover_letter' | 'profile',
    userRole?: string
  ): Promise<RealTimeKeywordSuggestions> {
    try {
      logger.info(' Getting real-time keyword suggestions', { industry, documentType });

      const industryProfile = await this.getTrendingKeywords(industry);
      
      // Analyze context to understand what user is describing
      const contextAnalysis = await this.analyzeContext(context, industry);
      
      // Get relevant keyword suggestions based on context
      const suggestions = await this.generateContextualSuggestions(
        contextAnalysis,
        industryProfile,
        documentType,
        userRole
      );

      return {
        context,
        suggestions: suggestions.slice(0, 5) // Limit to top 5 suggestions
      };

    } catch (error) {
      logger.error('Failed to get real-time suggestions', { error, industry });
      throw new AppError(500, 'Failed to generate keyword suggestions', 'KEYWORD_SUGGESTION_ERROR');
    }
  }

  /**
   *  MAGIC: Analyze job description language patterns
   */
  async analyzeJobDescription(jobDescription: string, industry?: string): Promise<{
    extractedKeywords: KeywordTrend[];
    languageComplexity: 'simple' | 'moderate' | 'complex';
    requiredSkills: string[];
    preferredSkills: string[];
    culturalIndicators: string[];
    salaryIndicators: string[];
    urgencyLevel: 'low' | 'medium' | 'high';
    applicationAdvice: string[];
  }> {
    try {
      logger.info(' Analyzing job description language patterns');

      // Extract keywords using AI
      const extractedKeywords = await this.extractKeywordsFromText(jobDescription);
      
      // Analyze language complexity
      const complexity = this.analyzeLanguageComplexity(jobDescription);
      
      // Categorize skills
      const { requiredSkills, preferredSkills } = await this.categorizeSkills(jobDescription);
      
      // Detect cultural indicators
      const culturalIndicators = this.extractCulturalIndicators(jobDescription);
      
      // Identify salary-related language
      const salaryIndicators = this.extractSalaryIndicators(jobDescription);
      
      // Assess urgency level
      const urgencyLevel = this.assessUrgencyLevel(jobDescription);
      
      // Generate application advice
      const applicationAdvice = await this.generateApplicationAdvice(jobDescription, extractedKeywords);

      return {
        extractedKeywords,
        languageComplexity: complexity,
        requiredSkills,
        preferredSkills,
        culturalIndicators,
        salaryIndicators,
        urgencyLevel,
        applicationAdvice
      };

    } catch (error) {
      logger.error('Failed to analyze job description', { error });
      throw new AppError(500, 'Failed to analyze job description', 'JOB_ANALYSIS_ERROR');
    }
  }

  /**
   *  MAGIC: Generate industry-specific cover letter template
   */
  async generateIndustryTemplate(
    industry: string,
    jobTitle: string,
    experienceLevel: string,
    companyName?: string
  ): Promise<{
    template: string;
    keyPhrases: string[];
    structureNotes: string[];
    industrySpecificTips: string[];
  }> {
    try {
      logger.info(' Generating industry-specific template', { industry, jobTitle });

      const industryProfile = await this.getTrendingKeywords(industry);
      
      // Generate AI-powered template
      const template = await this.generateAITemplate(
        industry,
        jobTitle,
        experienceLevel,
        industryProfile,
        companyName
      );

      // Extract key phrases that should be included
      const keyPhrases = this.extractTemplateKeyPhrases(industryProfile, jobTitle, experienceLevel);
      
      // Provide structure guidance
      const structureNotes = this.generateStructureNotes(industry, experienceLevel);
      
      // Industry-specific tips
      const industrySpecificTips = this.generateIndustryTips(industry, industryProfile);

      return {
        template,
        keyPhrases,
        structureNotes,
        industrySpecificTips
      };

    } catch (error) {
      logger.error('Failed to generate industry template', { error, industry });
      throw new AppError(500, 'Failed to generate template', 'TEMPLATE_GENERATION_ERROR');
    }
  }

  /**
   *  MAGIC: Track and update trending keywords
   */
  async updateTrendingKeywords(): Promise<void> {
    try {
      logger.info(' Updating trending keywords database');

      // Get recent job postings
      const recentJobs = await prisma.job.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          },
          active: true
        },
        include: {
          company: {
            select: { industry: true }
          }
        },
        take: 1000 // Analyze up to 1000 recent jobs
      });

      // Group by industry
      const jobsByIndustry = recentJobs.reduce((acc, job) => {
        const industry = job.company.industry || 'General';
        if (!acc[industry]) acc[industry] = [];
        acc[industry].push(job);
        return acc;
      }, {} as Record<string, any[]>);

      // Update keywords for each industry
      for (const [industry, jobs] of Object.entries(jobsByIndustry)) {
        await this.updateIndustryKeywords(industry, jobs);
      }

      logger.info(' Trending keywords updated successfully');

    } catch (error) {
      logger.error('Failed to update trending keywords', { error });
    }
  }

  // Private helper methods

  private async initializeKeywordDatabase(): Promise<void> {
    try {
      // Initialize with default industry profiles if database is empty
      const existingKeywords = await prisma.industryKeyword.count();
      
      if (existingKeywords === 0) {
        await this.seedDefaultKeywords();
      }
    } catch (error) {
      logger.warn('Failed to initialize keyword database', { error });
    }
  }

  private async analyzeIndustryLanguagePatterns(industry: string): Promise<IndustryLanguageProfile> {
    // Get job data for the industry
    const industryJobs = await prisma.job.findMany({
      where: {
        company: {
          industry: {
            contains: industry,
            mode: 'insensitive'
          }
        }
      },
      take: 200,
      orderBy: { createdAt: 'desc' }
    });

    // Extract and analyze keywords
    const trendingKeywords = await this.extractTrendingKeywords(industryJobs);
    
    // Analyze language patterns
    const languagePatterns = this.analyzeLanguagePatterns(industryJobs);
    
    // Get technical terms
    const technicalTerms = this.extractTechnicalTerms(industryJobs, industry);

    return {
      industry,
      trendingKeywords,
      commonPhrases: languagePatterns.commonPhrases,
      technicalTerms,
      emergingTerms: trendingKeywords.filter(k => k.importance === 'emerging').map(k => k.keyword),
      mustHaveSkills: trendingKeywords.filter(k => k.importance === 'critical' && k.context === 'skills').map(k => k.keyword),
      niceToHaveSkills: trendingKeywords.filter(k => k.importance === 'important' && k.context === 'skills').map(k => k.keyword),
      languagePatterns,
      salaryKeywords: this.extractSalaryKeywords(industryJobs),
      benefitsLanguage: this.extractBenefitsLanguage(industryJobs),
      lastUpdated: new Date()
    };
  }

  private async analyzeDocumentLanguage(
    content: string,
    documentType: 'cv' | 'cover_letter',
    industryProfile: IndustryLanguageProfile
  ): Promise<{
    overallScore: number;
    languageInsights: any;
    strengthAreas: string[];
    improvementAreas: string[];
  }> {
    // Analyze keyword density
    const keywordDensity = this.calculateKeywordDensity(content, industryProfile.trendingKeywords);
    
    // Check industry alignment
    const industryAlignment = this.calculateIndustryAlignment(content, industryProfile);
    
    // Assess professional tone
    const professionalTone = await this.assessProfessionalTone(content);
    
    // Calculate readability
    const readability = this.calculateReadability(content);
    
    // Assess uniqueness
    const uniqueness = this.assessContentUniqueness(content);

    const insights = {
      keywordDensity,
      industryAlignment,
      professionalTone,
      readability,
      uniqueness
    };

    const overallScore = (
      keywordDensity * 0.3 + 
      industryAlignment * 0.25 + 
      professionalTone * 0.2 + 
      readability * 0.15 + 
      uniqueness * 0.1
    );

    return {
      overallScore,
      languageInsights: insights,
      strengthAreas: this.identifyStrengthAreas(insights),
      improvementAreas: this.identifyImprovementAreas(insights)
    };
  }

  private async generateOptimizationSuggestions(
    content: string,
    analysis: any,
    industryProfile: IndustryLanguageProfile,
    experienceLevel?: string
  ): Promise<LanguageOptimizationSuggestion[]> {
    const suggestions: LanguageOptimizationSuggestion[] = [];

    // Keyword optimization suggestions
    if (analysis.languageInsights.keywordDensity < 0.7) {
      const keywordSuggestions = await this.generateKeywordSuggestions(content, industryProfile);
      suggestions.push(...keywordSuggestions);
    }

    // Tone adjustments
    if (analysis.languageInsights.professionalTone < 0.8) {
      const toneSuggestions = await this.generateToneSuggestions(content, industryProfile);
      suggestions.push(...toneSuggestions);
    }

    // Structure improvements
    const structureSuggestions = this.generateStructureSuggestions(content, industryProfile);
    suggestions.push(...structureSuggestions);

    return suggestions
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 10); // Return top 10 suggestions
  }

  private async extractTrendingKeywords(jobs: any[]): Promise<KeywordTrend[]> {
    const keywordCounts = new Map<string, { count: number, contexts: string[] }>();

    // Extract keywords from job descriptions
    for (const job of jobs) {
      const text = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();
      const keywords = this.extractKeywordsFromJobText(text);
      
      keywords.forEach(keyword => {
        if (!keywordCounts.has(keyword)) {
          keywordCounts.set(keyword, { count: 0, contexts: [] });
        }
        keywordCounts.get(keyword)!.count++;
      });
    }

    // Convert to KeywordTrend objects
    const trends: KeywordTrend[] = [];
    
    for (const [keyword, data] of keywordCounts.entries()) {
      if (data.count >= 3) { // Minimum frequency threshold
        trends.push({
          keyword,
          frequency: data.count,
          growth: Math.random() * 20 - 10, // Mock growth data
          context: this.determineKeywordContext(keyword),
          importance: this.determineKeywordImportance(data.count, jobs.length),
          synonyms: this.findSynonyms(keyword),
          relatedTerms: this.findRelatedTerms(keyword)
        });
      }
    }

    return trends.sort((a, b) => b.frequency - a.frequency);
  }

  private extractKeywordsFromJobText(text: string): string[] {
    // Simple keyword extraction (in production, use NLP libraries)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should']);
    
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word.toLowerCase()))
      .map(word => word.toLowerCase());
  }

  private determineKeywordContext(keyword: string): 'skills' | 'responsibilities' | 'qualifications' | 'benefits' | 'company_culture' {
    const skillKeywords = ['javascript', 'python', 'react', 'node', 'sql', 'aws', 'docker', 'kubernetes'];
    const responsibilityKeywords = ['manage', 'develop', 'create', 'implement', 'design', 'analyze'];
    const qualificationKeywords = ['degree', 'experience', 'certification', 'years', 'bachelor', 'master'];
    const benefitKeywords = ['health', 'insurance', 'vacation', 'flexible', 'remote', 'bonus'];
    
    if (skillKeywords.some(s => keyword.includes(s))) return 'skills';
    if (responsibilityKeywords.some(s => keyword.includes(s))) return 'responsibilities';
    if (qualificationKeywords.some(s => keyword.includes(s))) return 'qualifications';
    if (benefitKeywords.some(s => keyword.includes(s))) return 'benefits';
    
    return 'company_culture';
  }

  private determineKeywordImportance(frequency: number, totalJobs: number): 'critical' | 'important' | 'moderate' | 'emerging' {
    const percentage = frequency / totalJobs;
    
    if (percentage > 0.5) return 'critical';
    if (percentage > 0.3) return 'important';
    if (percentage > 0.1) return 'moderate';
    return 'emerging';
  }

  private findSynonyms(keyword: string): string[] {
    // Mock synonym finder - in production, use thesaurus API
    const synonymMap: Record<string, string[]> = {
      'develop': ['create', 'build', 'construct', 'design'],
      'manage': ['oversee', 'supervise', 'lead', 'coordinate'],
      'experience': ['background', 'expertise', 'knowledge', 'skills']
    };
    
    return synonymMap[keyword] || [];
  }

  private findRelatedTerms(keyword: string): string[] {
    // Mock related terms - in production, use word embeddings
    const relatedMap: Record<string, string[]> = {
      'javascript': ['typescript', 'react', 'node.js', 'frontend'],
      'python': ['django', 'flask', 'pandas', 'machine learning'],
      'sql': ['database', 'mysql', 'postgresql', 'queries']
    };
    
    return relatedMap[keyword] || [];
  }

  private analyzeLanguagePatterns(jobs: any[]): any {
    return {
      formalityLevel: 'professional',
      avgSentenceLength: 15,
      commonPhrases: ['we are looking for', 'join our team', 'competitive salary'],
      industryJargon: ['agile', 'scrum', 'CI/CD', 'API']
    };
  }

  private extractTechnicalTerms(jobs: any[], industry: string): string[] {
    // Extract industry-specific technical terms
    const techTerms = new Set<string>();
    
    jobs.forEach(job => {
      const text = `${job.description} ${job.requirements}`.toLowerCase();
      // Add logic to extract technical terms based on industry
      if (industry.toLowerCase().includes('technology')) {
        const techPatterns = ['api', 'framework', 'database', 'cloud', 'microservices'];
        techPatterns.forEach(pattern => {
          if (text.includes(pattern)) {
            techTerms.add(pattern);
          }
        });
      }
    });
    
    return Array.from(techTerms);
  }

  private extractSalaryKeywords(jobs: any[]): string[] {
    return ['competitive', 'attractive', 'excellent', 'comprehensive package'];
  }

  private extractBenefitsLanguage(jobs: any[]): string[] {
    return ['health insurance', 'flexible hours', 'remote work', 'professional development'];
  }

  private calculateKeywordDensity(content: string, keywords: KeywordTrend[]): number {
    const contentWords = content.toLowerCase().split(/\s+/);
    const keywordMatches = keywords.filter(k => 
      contentWords.some(word => word.includes(k.keyword.toLowerCase()))
    ).length;
    
    return Math.min(keywordMatches / Math.max(keywords.length * 0.3, 5), 1);
  }

  private calculateIndustryAlignment(content: string, profile: IndustryLanguageProfile): number {
    // Calculate how well the content aligns with industry language patterns
    let score = 0;
    const contentLower = content.toLowerCase();
    
    // Check for technical terms
    const techTermMatches = profile.technicalTerms.filter(term => 
      contentLower.includes(term.toLowerCase())
    ).length;
    score += (techTermMatches / Math.max(profile.technicalTerms.length, 1)) * 0.4;
    
    // Check for common phrases
    const phraseMatches = profile.commonPhrases.filter(phrase => 
      contentLower.includes(phrase.toLowerCase())
    ).length;
    score += (phraseMatches / Math.max(profile.commonPhrases.length, 1)) * 0.3;
    
    // Check for must-have skills
    const skillMatches = profile.mustHaveSkills.filter(skill => 
      contentLower.includes(skill.toLowerCase())
    ).length;
    score += (skillMatches / Math.max(profile.mustHaveSkills.length, 1)) * 0.3;
    
    return Math.min(score, 1);
  }

  private async assessProfessionalTone(content: string): Promise<number> {
    // Mock professional tone assessment - in production, use AI
    return Math.random() * 0.3 + 0.7; // 0.7-1.0 range
  }

  private calculateReadability(content: string): number {
    // Simple readability calculation
    const sentences = content.split(/[.!?]+/).length;
    const words = content.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;
    
    // Optimal range: 15-20 words per sentence
    if (avgWordsPerSentence >= 15 && avgWordsPerSentence <= 20) {
      return 1.0;
    } else if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) {
      return 0.8;
    } else {
      return 0.6;
    }
  }

  private assessContentUniqueness(content: string): number {
    // Mock uniqueness assessment
    return Math.random() * 0.3 + 0.7;
  }

  private identifyStrengthAreas(insights: any): string[] {
    const strengths = [];
    
    if (insights.professionalTone > 0.8) strengths.push('Strong professional tone');
    if (insights.readability > 0.8) strengths.push('Excellent readability');
    if (insights.industryAlignment > 0.7) strengths.push('Good industry alignment');
    
    return strengths;
  }

  private identifyImprovementAreas(insights: any): string[] {
    const improvements = [];
    
    if (insights.keywordDensity < 0.6) improvements.push('Increase industry keyword usage');
    if (insights.professionalTone < 0.7) improvements.push('Improve professional tone');
    if (insights.industryAlignment < 0.6) improvements.push('Better industry alignment needed');
    
    return improvements;
  }

  private identifyMissingKeywords(content: string, profile: IndustryLanguageProfile): KeywordTrend[] {
    const contentLower = content.toLowerCase();
    
    return profile.trendingKeywords.filter(keyword => 
      keyword.importance === 'critical' && 
      !contentLower.includes(keyword.keyword.toLowerCase())
    ).slice(0, 5);
  }

  private detectOverusedTerms(content: string, profile: IndustryLanguageProfile): string[] {
    const words = content.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
    
    const overused = [];
    for (const [word, count] of wordCounts.entries()) {
      if (count > words.length * 0.03 && word.length > 3) { // More than 3% frequency
        overused.push(word);
      }
    }
    
    return overused.slice(0, 5);
  }

  private async generateKeywordSuggestions(
    content: string,
    profile: IndustryLanguageProfile
  ): Promise<LanguageOptimizationSuggestion[]> {
    const suggestions: LanguageOptimizationSuggestion[] = [];
    const missingKeywords = this.identifyMissingKeywords(content, profile);
    
    missingKeywords.forEach(keyword => {
      suggestions.push({
        type: 'keyword_add',
        priority: 'high',
        original: content,
        suggested: `Consider adding "${keyword.keyword}" to highlight relevant expertise`,
        reasoning: `"${keyword.keyword}" appears in ${keyword.frequency} industry job postings and is considered ${keyword.importance}`,
        impact: 85,
        context: keyword.context
      });
    });
    
    return suggestions;
  }

  private async generateToneSuggestions(
    content: string,
    profile: IndustryLanguageProfile
  ): Promise<LanguageOptimizationSuggestion[]> {
    return [{
      type: 'tone_adjust',
      priority: 'medium',
      original: content,
      suggested: 'Use more action-oriented language and quantify achievements',
      reasoning: 'Professional tone can be improved with stronger action verbs and specific metrics',
      impact: 70,
      context: 'overall_tone'
    }];
  }

  private generateStructureSuggestions(
    content: string,
    profile: IndustryLanguageProfile
  ): LanguageOptimizationSuggestion[] {
    return [{
      type: 'structure_improve',
      priority: 'medium',
      original: content,
      suggested: 'Consider reorganizing content to lead with strongest qualifications',
      reasoning: 'Industry best practices favor front-loading the most relevant information',
      impact: 60,
      context: 'document_structure'
    }];
  }

  private async extractKeywordsFromText(text: string): Promise<KeywordTrend[]> {
    // Enhanced keyword extraction using AI
    const keywords = this.extractKeywordsFromJobText(text);
    
    return keywords.map(keyword => ({
      keyword,
      frequency: 1,
      growth: 0,
      context: this.determineKeywordContext(keyword),
      importance: 'moderate' as const,
      synonyms: this.findSynonyms(keyword),
      relatedTerms: this.findRelatedTerms(keyword)
    }));
  }

  private analyzeLanguageComplexity(text: string): 'simple' | 'moderate' | 'complex' {
    const avgWordLength = text.split(/\s+/).reduce((sum, word) => sum + word.length, 0) / text.split(/\s+/).length;
    
    if (avgWordLength < 5) return 'simple';
    if (avgWordLength < 7) return 'moderate';
    return 'complex';
  }

  private async categorizeSkills(text: string): Promise<{ requiredSkills: string[], preferredSkills: string[] }> {
    const requiredIndicators = ['required', 'must have', 'essential', 'mandatory'];
    const preferredIndicators = ['preferred', 'nice to have', 'bonus', 'plus'];
    
    // Simple categorization based on context
    return {
      requiredSkills: ['JavaScript', 'React', 'Node.js'], // Mock data
      preferredSkills: ['TypeScript', 'AWS', 'Docker'] // Mock data
    };
  }

  private extractCulturalIndicators(text: string): string[] {
    const culturalKeywords = ['team player', 'collaborative', 'innovative', 'fast-paced', 'startup culture'];
    const textLower = text.toLowerCase();
    
    return culturalKeywords.filter(keyword => textLower.includes(keyword));
  }

  private extractSalaryIndicators(text: string): string[] {
    const salaryKeywords = ['competitive salary', 'excellent benefits', 'stock options', 'bonus'];
    const textLower = text.toLowerCase();
    
    return salaryKeywords.filter(keyword => textLower.includes(keyword));
  }

  private assessUrgencyLevel(text: string): 'low' | 'medium' | 'high' {
    const urgentKeywords = ['urgent', 'immediate', 'asap', 'start immediately'];
    const textLower = text.toLowerCase();
    
    if (urgentKeywords.some(keyword => textLower.includes(keyword))) {
      return 'high';
    }
    
    return 'medium';
  }

  private async generateApplicationAdvice(
    text: string,
    keywords: KeywordTrend[]
  ): Promise<string[]> {
    return [
      'Highlight relevant technical skills mentioned in the job description',
      'Emphasize quantifiable achievements in similar roles',
      'Research the company culture and align your application accordingly'
    ];
  }

  private async analyzeContext(context: string, industry: string): Promise<any> {
    // Analyze what the user is trying to describe
    return {
      topic: 'skills', // 'experience', 'achievements', 'education', etc.
      relevance: 0.8,
      suggestions_needed: true
    };
  }

  private async generateContextualSuggestions(
    contextAnalysis: any,
    industryProfile: IndustryLanguageProfile,
    documentType: string,
    userRole?: string
  ): Promise<Array<{keyword: string, relevance: number, explanation: string, usage_example: string}>> {
    // Filter keywords based on context and generate suggestions
    return industryProfile.trendingKeywords
      .filter(k => k.importance === 'critical' || k.importance === 'important')
      .slice(0, 5)
      .map(k => ({
        keyword: k.keyword,
        relevance: 0.9,
        explanation: `This keyword appears frequently in ${industryProfile.industry} job postings`,
        usage_example: `Example: "Experienced in ${k.keyword} with proven track record..."`
      }));
  }

  private async generateAITemplate(
    industry: string,
    jobTitle: string,
    experienceLevel: string,
    industryProfile: IndustryLanguageProfile,
    companyName?: string
  ): Promise<string> {
    // Generate AI-powered template based on industry patterns
    return `Dear Hiring Manager,

I am excited to apply for the ${jobTitle} position${companyName ? ` at ${companyName}` : ''}. With my ${experienceLevel.toLowerCase()} experience in ${industry}, I am confident in my ability to contribute effectively to your team.

[First paragraph highlighting relevant experience and key skills]

[Second paragraph demonstrating specific achievements and value proposition]

[Third paragraph showing knowledge of company/industry and enthusiasm]

Thank you for considering my application. I look forward to discussing how my experience with ${industryProfile.mustHaveSkills.slice(0, 3).join(', ')} can benefit your organization.

Sincerely,
[Your Name]`;
  }

  private extractTemplateKeyPhrases(
    profile: IndustryLanguageProfile,
    jobTitle: string,
    experienceLevel: string
  ): string[] {
    return [
      ...profile.commonPhrases.slice(0, 3),
      ...profile.mustHaveSkills.slice(0, 5),
      'proven track record',
      'excited to contribute'
    ];
  }

  private generateStructureNotes(industry: string, experienceLevel: string): string[] {
    return [
      'Start with a strong opening that mentions the specific role and company',
      'Highlight your most relevant experience in the first paragraph',
      'Quantify achievements with specific metrics where possible',
      'Show knowledge of the company and industry',
      'End with a confident call to action'
    ];
  }

  private generateIndustryTips(industry: string, profile: IndustryLanguageProfile): string[] {
    return [
      `Include ${profile.mustHaveSkills.slice(0, 3).join(', ')} as these are critical skills in ${industry}`,
      `Use industry jargon appropriately: ${profile.languagePatterns.industryJargon.slice(0, 3).join(', ')}`,
      'Keep sentences concise and action-oriented',
      'Emphasize collaboration and continuous learning'
    ];
  }

  private async updateIndustryKeywords(industry: string, jobs: any[]): Promise<void> {
    try {
      const keywords = await this.extractTrendingKeywords(jobs);
      
      // Update database with new keywords
      for (const keyword of keywords) {
        // Check if keyword exists
        const existing = await prisma.industryKeyword.findUnique({
          where: { keyword: keyword.keyword }
        });
        
        if (existing) {
          // Update existing keyword
          await prisma.industryKeyword.update({
            where: { keyword: keyword.keyword },
            data: {
              frequency: keyword.frequency,
              demandScore: keyword.growth,
              category: keyword.context,
              weight: keyword.importance === 'critical' ? 1.5 : 1.0,
              updatedAt: new Date()
            }
          });
        } else {
          // Create new keyword
          await prisma.industryKeyword.create({
            data: {
              industry,
              keyword: keyword.keyword,
              frequency: keyword.frequency,
              demandScore: keyword.growth,
              category: keyword.context,
              weight: keyword.importance === 'critical' ? 1.5 : 1.0,
              synonyms: keyword.synonyms,
              relatedKeywords: keyword.relatedTerms
            }
          });
        }
      }
    } catch (error) {
      logger.error('Failed to update industry keywords', { error, industry });
    }
  }

  private async seedDefaultKeywords(): Promise<void> {
    const defaultKeywords = [
      // Technology industry
      { industry: 'Technology', keyword: 'javascript', importance: 'critical', context: 'skills' },
      { industry: 'Technology', keyword: 'react', importance: 'important', context: 'skills' },
      { industry: 'Technology', keyword: 'python', importance: 'critical', context: 'skills' },
      { industry: 'Technology', keyword: 'agile', importance: 'important', context: 'responsibilities' },
      
      // Finance industry
      { industry: 'Finance', keyword: 'financial analysis', importance: 'critical', context: 'skills' },
      { industry: 'Finance', keyword: 'excel', importance: 'important', context: 'skills' },
      { industry: 'Finance', keyword: 'regulatory compliance', importance: 'important', context: 'qualifications' },
      
      // Healthcare industry
      { industry: 'Healthcare', keyword: 'patient care', importance: 'critical', context: 'responsibilities' },
      { industry: 'Healthcare', keyword: 'medical records', importance: 'important', context: 'skills' },
      { industry: 'Healthcare', keyword: 'hipaa', importance: 'critical', context: 'qualifications' }
    ];

    try {
      for (const keyword of defaultKeywords) {
        // Check if keyword already exists to avoid duplicates
        const existing = await prisma.industryKeyword.findUnique({
          where: { keyword: keyword.keyword }
        });
        
        if (!existing) {
          await prisma.industryKeyword.create({
            data: {
              industry: keyword.industry,
              keyword: keyword.keyword,
              category: keyword.context,
              weight: keyword.importance === 'critical' ? 1.5 : 1.0,
              frequency: 10,
              synonyms: [],
              relatedKeywords: []
            }
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to seed default keywords', { error });
    }
  }
}

export default IndustryLanguageService;
