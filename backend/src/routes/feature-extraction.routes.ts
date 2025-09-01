import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { AIMatchingService } from '../services/ai-matching.service.js';
import { HuggingFaceService } from '../services/huggingface.service.js';
import logger from '../config/logger.js';
import { body, param, query } from 'express-validator';
import natural from 'natural';

const router = Router();

// Initialize services
const aiMatchingService = new AIMatchingService();
const huggingfaceService = HuggingFaceService.getInstance();

// Apply authentication to all routes
router.use(authenticate);

/**
 *  Extract Features from CV
 * POST /api/feature-extraction/cv
 */
router.post('/cv',
  body('cvContent').isString().notEmpty().withMessage('CV content required'),
  body('extractionLevel').isString().optional().isIn(['basic', 'detailed', 'comprehensive']),
  async (req: Request, res: Response) => {
    try {
      const { cvContent, extractionLevel = 'detailed' } = req.body;
      const userId = req.user?.id;

      logger.info(' Extracting features from CV', { userId, extractionLevel });

      // Extract skills using NLP
      const skills = await aiMatchingService.extractSkillsFromText(cvContent);

      // Extract experience information
      const experience = extractExperienceFromText(cvContent);

      // Extract education information
      const education = extractEducationFromText(cvContent);

      // Extract contact and personal information
      const personalInfo = extractPersonalInfo(cvContent);

      // Extract achievements and highlights
      const achievements = extractAchievements(cvContent);

      // Advanced extraction for comprehensive level
      let advancedFeatures = {};
      if (extractionLevel === 'comprehensive') {
        advancedFeatures = {
          writingStyle: analyzeWritingStyle(cvContent),
          keywords: extractKeywords(cvContent),
          industryTerms: await huggingfaceService.extractIndustryTerms(cvContent),
          sentiment: await analyzeSentiment(cvContent),
          structure: analyzeStructure(cvContent)
        };
      }

      res.json({
        success: true,
        data: {
          extractionLevel,
          features: {
            skills,
            experience,
            education,
            personalInfo,
            achievements,
            ...advancedFeatures
          },
          metadata: {
            wordCount: cvContent.split(/\s+/).length,
            characterCount: cvContent.length,
            extractionTimestamp: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      logger.error('Error extracting CV features', { error, userId: req.user?.id });
      throw new AppError(500, 'CV feature extraction failed');
    }
  }
);

/**
 *  Extract Features from Job Description
 * POST /api/feature-extraction/job
 */
router.post('/job',
  body('jobDescription').isString().notEmpty().withMessage('Job description required'),
  body('companyInfo').isObject().optional(),
  async (req: Request, res: Response) => {
    try {
      const { jobDescription, companyInfo } = req.body;
      const userId = req.user?.id;

      logger.info(' Extracting features from job description', { userId });

      // Extract required skills
      const requiredSkills = await aiMatchingService.extractSkillsFromText(jobDescription);
      
      // Categorize skills
      const skillCategories = categorizeSkills(requiredSkills);

      // Extract requirements
      const requirements = extractRequirements(jobDescription);

      // Extract benefits and perks
      const benefits = extractBenefits(jobDescription);

      // Extract company culture indicators
      const cultureIndicators = extractCultureIndicators(jobDescription);

      // Extract experience requirements
      const experienceRequirements = extractExperienceRequirements(jobDescription);

      // Extract education requirements
      const educationRequirements = extractEducationRequirements(jobDescription);

      // Analyze job complexity
      const complexity = analyzeJobComplexity(jobDescription, requiredSkills);

      res.json({
        success: true,
        data: {
          features: {
            skills: {
              all: requiredSkills,
              categorized: skillCategories,
              count: requiredSkills.length
            },
            requirements,
            benefits,
            cultureIndicators,
            experienceRequirements,
            educationRequirements,
            complexity
          },
          companyInsights: companyInfo ? {
            industry: companyInfo.industry,
            size: companyInfo.size,
            location: companyInfo.location
          } : null,
          metadata: {
            wordCount: jobDescription.split(/\s+/).length,
            extractionTimestamp: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      logger.error('Error extracting job features', { error, userId: req.user?.id });
      throw new AppError(500, 'Job feature extraction failed');
    }
  }
);

/**
 *  Advanced Entity Extraction
 * POST /api/feature-extraction/entities
 */
router.post('/entities',
  body('text').isString().notEmpty().withMessage('Text content required'),
  body('entityTypes').isArray().optional(),
  async (req: Request, res: Response) => {
    try {
      const { text, entityTypes = ['skills', 'companies', 'locations', 'tools', 'certifications'] } = req.body;
      const userId = req.user?.id;

      logger.info(' Performing advanced entity extraction', { userId, entityTypes });

      const entities: Record<string, any[]> = {};

      // Extract different entity types
      if (entityTypes.includes('skills')) {
        entities.skills = await aiMatchingService.extractSkillsFromText(text);
      }

      if (entityTypes.includes('companies')) {
        entities.companies = extractCompanies(text);
      }

      if (entityTypes.includes('locations')) {
        entities.locations = extractLocations(text);
      }

      if (entityTypes.includes('tools')) {
        entities.tools = extractTools(text);
      }

      if (entityTypes.includes('certifications')) {
        entities.certifications = extractCertifications(text);
      }

      // Use NER for additional entity recognition
      const nerEntities = await huggingfaceService.performNER(text);

      res.json({
        success: true,
        data: {
          entities,
          nerEntities,
          summary: {
            totalEntities: Object.values(entities).flat().length,
            byType: Object.entries(entities).map(([type, items]) => ({
              type,
              count: items.length
            }))
          }
        }
      });

    } catch (error) {
      logger.error('Error in entity extraction', { error, userId: req.user?.id });
      throw new AppError(500, 'Entity extraction failed');
    }
  }
);

/**
 *  Comparative Feature Analysis
 * POST /api/feature-extraction/compare
 */
router.post('/compare',
  body('cvFeatures').isObject().withMessage('CV features required'),
  body('jobFeatures').isObject().withMessage('Job features required'),
  async (req: Request, res: Response) => {
    try {
      const { cvFeatures, jobFeatures } = req.body;
      const userId = req.user?.id;

      logger.info(' Performing comparative feature analysis', { userId });

      // Compare skills
      const skillComparison = compareSkills(cvFeatures.skills || [], jobFeatures.skills?.all || []);

      // Compare experience
      const experienceComparison = compareExperience(cvFeatures.experience, jobFeatures.experienceRequirements);

      // Compare education
      const educationComparison = compareEducation(cvFeatures.education, jobFeatures.educationRequirements);

      // Calculate feature alignment score
      const alignmentScore = calculateAlignmentScore({
        skills: skillComparison,
        experience: experienceComparison,
        education: educationComparison
      });

      // Generate insights
      const insights = generateComparativeInsights({
        skillComparison,
        experienceComparison,
        educationComparison,
        alignmentScore
      });

      res.json({
        success: true,
        data: {
          comparisons: {
            skills: skillComparison,
            experience: experienceComparison,
            education: educationComparison
          },
          alignmentScore,
          insights,
          recommendations: generateImprovementRecommendations(
            skillComparison,
            experienceComparison,
            educationComparison
          )
        }
      });

    } catch (error) {
      logger.error('Error in comparative analysis', { error, userId: req.user?.id });
      throw new AppError(500, 'Comparative feature analysis failed');
    }
  }
);

/**
 *  Extract Key Phrases
 * POST /api/feature-extraction/key-phrases
 */
router.post('/key-phrases',
  body('text').isString().notEmpty().withMessage('Text content required'),
  body('maxPhrases').isInt().optional(),
  async (req: Request, res: Response) => {
    try {
      const { text, maxPhrases = 20 } = req.body;
      const userId = req.user?.id;

      logger.info(' Extracting key phrases', { userId, maxPhrases });

      // Use TF-IDF for key phrase extraction
      const tfidf = new natural.TfIdf();
      tfidf.addDocument(text);

      const keyPhrases: Array<{ phrase: string; score: number }> = [];
      
      // Extract n-grams
      const tokenizer = new natural.WordTokenizer();
      const words = tokenizer.tokenize(text.toLowerCase());
      
      // Extract bigrams and trigrams
      const bigrams = natural.NGrams.bigrams(words);
      const trigrams = natural.NGrams.trigrams(words);

      // Score phrases
      [...bigrams, ...trigrams].forEach(ngram => {
        const phrase = ngram.join(' ');
        let score = 0;
        ngram.forEach((word: string, idx: number) => {
          tfidf.tfidfs(word, (i, measure) => {
            score += measure;
          });
        });
        if (score > 0) {
          keyPhrases.push({ phrase, score: score / ngram.length });
        }
      });

      // Sort by score and limit
      keyPhrases.sort((a, b) => b.score - a.score);
      const topPhrases = keyPhrases.slice(0, maxPhrases);

      res.json({
        success: true,
        data: {
          keyPhrases: topPhrases,
          summary: {
            totalExtracted: keyPhrases.length,
            returned: topPhrases.length,
            topPhrase: topPhrases[0]
          }
        }
      });

    } catch (error) {
      logger.error('Error extracting key phrases', { error, userId: req.user?.id });
      throw new AppError(500, 'Key phrase extraction failed');
    }
  }
);

// Helper functions

function extractExperienceFromText(text: string): any[] {
  const experiences = [];
  const lines = text.split('\n');
  
  // Simple pattern matching for experience sections
  const experienceKeywords = ['experience', 'employment', 'work history', 'professional experience'];
  let inExperienceSection = false;
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    if (experienceKeywords.some(keyword => lowerLine.includes(keyword))) {
      inExperienceSection = true;
      continue;
    }
    
    if (inExperienceSection && line.trim()) {
      // Look for date patterns
      const datePattern = /(\d{4}|\d{2}\/\d{2}\/\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
      if (datePattern.test(line)) {
        experiences.push({
          text: line.trim(),
          hasDate: true
        });
      }
    }
  }
  
  return experiences;
}

function extractEducationFromText(text: string): any[] {
  const education = [];
  const degrees = ['bachelor', 'master', 'phd', 'diploma', 'certificate', 'degree'];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (degrees.some(degree => lowerLine.includes(degree))) {
      education.push({
        text: line.trim(),
        level: degrees.find(d => lowerLine.includes(d))
      });
    }
  }
  
  return education;
}

function extractPersonalInfo(text: string): any {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}/;
  
  return {
    email: text.match(emailRegex)?.[0] || null,
    phone: text.match(phoneRegex)?.[0] || null
  };
}

function extractAchievements(text: string): string[] {
  const achievements = [];
  const achievementKeywords = ['achieved', 'accomplished', 'increased', 'decreased', 'improved', 'led', 'managed'];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (achievementKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
      achievements.push(line.trim());
    }
  }
  
  return achievements;
}

function analyzeWritingStyle(text: string): any {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const words = text.split(/\s+/);
  
  return {
    averageSentenceLength: sentences.length > 0 ? words.length / sentences.length : 0,
    sentenceCount: sentences.length,
    complexity: words.length > 500 ? 'detailed' : words.length > 200 ? 'moderate' : 'concise'
  };
}

function extractKeywords(text: string): string[] {
  const tfidf = new natural.TfIdf();
  tfidf.addDocument(text);
  
  const keywords: string[] = [];
  tfidf.listTerms(0).slice(0, 20).forEach(item => {
    if (item.term.length > 3) {
      keywords.push(item.term);
    }
  });
  
  return keywords;
}

async function analyzeSentiment(text: string): Promise<any> {
  const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text);
  const sentiment = analyzer.getSentiment(tokens);
  
  return {
    score: sentiment,
    label: sentiment > 0.1 ? 'positive' : sentiment < -0.1 ? 'negative' : 'neutral'
  };
}

function analyzeStructure(text: string): any {
  const sections = text.split(/\n\n+/);
  return {
    sectionCount: sections.length,
    hasHeaders: /^#+\s/m.test(text) || /^[A-Z\s]+$/m.test(text),
    hasBulletPoints: /^[\*\-\•]/m.test(text),
    formatting: 'structured'
  };
}

function categorizeSkills(skills: string[]): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    technical: [],
    soft: [],
    tools: [],
    languages: []
  };
  
  const technicalKeywords = ['programming', 'development', 'engineering', 'technical'];
  const softKeywords = ['communication', 'leadership', 'teamwork', 'management'];
  const toolKeywords = ['software', 'platform', 'framework', 'tool'];
  
  skills.forEach(skill => {
    const lowerSkill = skill.toLowerCase();
    if (technicalKeywords.some(k => lowerSkill.includes(k))) {
      categories.technical.push(skill);
    } else if (softKeywords.some(k => lowerSkill.includes(k))) {
      categories.soft.push(skill);
    } else if (toolKeywords.some(k => lowerSkill.includes(k))) {
      categories.tools.push(skill);
    } else {
      categories.languages.push(skill);
    }
  });
  
  return categories;
}

function extractRequirements(text: string): string[] {
  const requirements = [];
  const lines = text.split('\n');
  const requirementKeywords = ['required', 'must have', 'essential', 'mandatory'];
  
  for (const line of lines) {
    if (requirementKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
      requirements.push(line.trim());
    }
  }
  
  return requirements;
}

function extractBenefits(text: string): string[] {
  const benefits = [];
  const benefitKeywords = ['benefit', 'perk', 'offer', 'provide', 'competitive', 'package'];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (benefitKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
      benefits.push(line.trim());
    }
  }
  
  return benefits;
}

function extractCultureIndicators(text: string): string[] {
  const indicators = [];
  const cultureKeywords = ['culture', 'values', 'environment', 'team', 'collaborative', 'innovative'];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (cultureKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
      indicators.push(line.trim());
    }
  }
  
  return indicators;
}

function extractExperienceRequirements(text: string): any {
  const yearPattern = /(\d+)\+?\s*(years?|yrs?)/i;
  const match = text.match(yearPattern);
  
  return {
    years: match ? parseInt(match[1]) : null,
    text: match ? match[0] : null
  };
}

function extractEducationRequirements(text: string): any {
  const degrees = ['bachelor', 'master', 'phd', 'diploma', 'degree'];
  const found = degrees.filter(degree => 
    text.toLowerCase().includes(degree)
  );
  
  return {
    degrees: found,
    required: found.length > 0
  };
}

function analyzeJobComplexity(description: string, skills: string[]): any {
  const wordCount = description.split(/\s+/).length;
  const skillCount = skills.length;
  
  let complexity = 'entry';
  if (skillCount > 15 || wordCount > 500) {
    complexity = 'senior';
  } else if (skillCount > 8 || wordCount > 300) {
    complexity = 'intermediate';
  }
  
  return {
    level: complexity,
    factors: {
      skillCount,
      wordCount,
      requiresSeniorSkills: description.toLowerCase().includes('senior') || 
                           description.toLowerCase().includes('lead')
    }
  };
}

function extractCompanies(text: string): string[] {
  // Simple company extraction - would be enhanced with NER
  const companies = [];
  const companyIndicators = ['Inc.', 'LLC', 'Ltd.', 'Corporation', 'Corp.', 'Company', 'Co.'];
  const words = text.split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    if (companyIndicators.some(indicator => words[i].includes(indicator))) {
      if (i > 0) {
        companies.push(`${words[i-1]} ${words[i]}`);
      }
    }
  }
  
  return [...new Set(companies)];
}

function extractLocations(text: string): string[] {
  // South African cities and provinces
  const locations = [
    'johannesburg', 'cape town', 'durban', 'pretoria', 'port elizabeth',
    'gauteng', 'western cape', 'kwazulu-natal', 'eastern cape', 'free state',
    'limpopo', 'mpumalanga', 'northern cape', 'north west'
  ];
  
  const found = locations.filter(location => 
    text.toLowerCase().includes(location)
  );
  
  return found;
}

function extractTools(text: string): string[] {
  const tools = [];
  const toolPatterns = [
    'microsoft office', 'excel', 'powerpoint', 'word',
    'google workspace', 'slack', 'jira', 'git', 'github',
    'docker', 'kubernetes', 'aws', 'azure', 'gcp'
  ];
  
  toolPatterns.forEach(tool => {
    if (text.toLowerCase().includes(tool)) {
      tools.push(tool);
    }
  });
  
  return tools;
}

function extractCertifications(text: string): string[] {
  const certifications = [];
  const certPatterns = [
    'certified', 'certification', 'certificate',
    'pmp', 'aws certified', 'microsoft certified',
    'cisco', 'comptia', 'scrum master'
  ];
  
  const lines = text.split('\n');
  for (const line of lines) {
    if (certPatterns.some(pattern => line.toLowerCase().includes(pattern))) {
      certifications.push(line.trim());
    }
  }
  
  return certifications;
}

function compareSkills(cvSkills: string[], jobSkills: string[]): any {
  const cvSkillsSet = new Set(cvSkills.map(s => s.toLowerCase()));
  const jobSkillsSet = new Set(jobSkills.map(s => s.toLowerCase()));
  
  const matching = jobSkills.filter(skill => cvSkillsSet.has(skill.toLowerCase()));
  const missing = jobSkills.filter(skill => !cvSkillsSet.has(skill.toLowerCase()));
  const additional = cvSkills.filter(skill => !jobSkillsSet.has(skill.toLowerCase()));
  
  return {
    matching,
    missing,
    additional,
    matchPercentage: jobSkills.length > 0 ? (matching.length / jobSkills.length) * 100 : 0
  };
}

function compareExperience(cvExperience: any, jobRequirement: any): any {
  // Simplified comparison
  return {
    meets: cvExperience?.length > 0,
    cvYears: cvExperience?.length || 0,
    requiredYears: jobRequirement?.years || 0,
    gap: jobRequirement?.years ? jobRequirement.years - (cvExperience?.length || 0) : 0
  };
}

function compareEducation(cvEducation: any, jobRequirement: any): any {
  return {
    meets: cvEducation?.length > 0 && jobRequirement?.required,
    cvDegrees: cvEducation?.map((e: any) => e.level) || [],
    requiredDegrees: jobRequirement?.degrees || []
  };
}

function calculateAlignmentScore(comparisons: any): number {
  const skillsWeight = 0.5;
  const experienceWeight = 0.3;
  const educationWeight = 0.2;
  
  const skillsScore = comparisons.skills.matchPercentage / 100;
  const experienceScore = comparisons.experience.gap <= 0 ? 1 : Math.max(0, 1 - (comparisons.experience.gap * 0.2));
  const educationScore = comparisons.education.meets ? 1 : 0.5;
  
  return (skillsScore * skillsWeight) + 
         (experienceScore * experienceWeight) + 
         (educationScore * educationWeight);
}

function generateComparativeInsights(data: any): string[] {
  const insights = [];
  
  if (data.skillComparison.matchPercentage > 80) {
    insights.push('Excellent skills alignment with job requirements');
  } else if (data.skillComparison.matchPercentage > 60) {
    insights.push('Good skills match with some gaps to address');
  } else {
    insights.push('Significant skills gap requiring development');
  }
  
  if (data.experienceComparison.gap <= 0) {
    insights.push('Experience level meets or exceeds requirements');
  } else {
    insights.push(`${data.experienceComparison.gap} years experience gap`);
  }
  
  if (data.educationComparison.meets) {
    insights.push('Education requirements satisfied');
  }
  
  return insights;
}

function generateImprovementRecommendations(skills: any, experience: any, education: any): string[] {
  const recommendations = [];
  
  if (skills.missing.length > 0) {
    recommendations.push(`Develop skills in: ${skills.missing.slice(0, 3).join(', ')}`);
  }
  
  if (experience.gap > 0) {
    recommendations.push('Gain more relevant experience or highlight transferable skills');
  }
  
  if (!education.meets && education.requiredDegrees.length > 0) {
    recommendations.push('Consider pursuing required educational qualifications');
  }
  
  return recommendations;
}

export { router as featureExtractionRoutes };
