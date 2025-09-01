import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { AIMatchingService } from '../services/ai-matching.service.js';
import { CareerDNAService } from '../services/career-dna.service.js';
import logger from '../config/logger.js';
import { body, param, query } from 'express-validator';
import { prisma } from '../config/database.js';

const router = Router();

// Initialize services
const aiMatchingService = new AIMatchingService();
const careerDnaService = new CareerDNAService();

// Apply authentication to all routes
router.use(authenticate);

/**
 *  Calculate Multi-Modal Score
 * POST /api/scoring-system/multi-modal
 */
router.post('/multi-modal',
  body('userId').isUUID().optional(),
  body('jobId').isUUID().withMessage('Valid job ID required'),
  body('scoringOptions').isObject().optional(),
  async (req: Request, res: Response) => {
    try {
      const { jobId, scoringOptions = {} } = req.body;
      const userId = req.body.userId || req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Calculating multi-modal score', { userId, jobId });

      // Get comprehensive match data
      const matchResult = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchResult.length === 0) {
        throw new AppError(404, 'Unable to calculate score for this job');
      }

      const match = matchResult[0];
      
      // Calculate detailed modal scores
      const modalScores = {
        technical: {
          score: match.skillsScore,
          weight: scoringOptions.weights?.technical || 0.35,
          components: {
            hardSkills: match.skillsScore * 0.7,
            toolsProficiency: match.skillsScore * 0.3
          }
        },
        experience: {
          score: match.experienceScore,
          weight: scoringOptions.weights?.experience || 0.25,
          components: {
            yearsOfExperience: match.experienceScore * 0.6,
            relevantExperience: match.experienceScore * 0.4
          }
        },
        softSkills: {
          score: match.personalityScore,
          weight: scoringOptions.weights?.softSkills || 0.20,
          components: {
            communication: match.personalityScore * 0.4,
            leadership: match.personalityScore * 0.3,
            teamwork: match.personalityScore * 0.3
          }
        },
        cultural: {
          score: match.culturalFitScore,
          weight: scoringOptions.weights?.cultural || 0.10,
          components: {
            values: match.culturalFitScore * 0.5,
            workStyle: match.culturalFitScore * 0.5
          }
        },
        education: {
          score: match.educationScore,
          weight: scoringOptions.weights?.education || 0.10,
          components: {
            degree: match.educationScore * 0.7,
            certifications: match.educationScore * 0.3
          }
        }
      };

      // Calculate weighted overall score
      let overallScore = 0;
      let totalWeight = 0;
      for (const [modal, data] of Object.entries(modalScores)) {
        overallScore += data.score * data.weight;
        totalWeight += data.weight;
      }
      
      if (totalWeight !== 1.0) {
        // Normalize weights
        overallScore = overallScore / totalWeight;
      }

      // Generate score interpretation
      const interpretation = interpretScore(overallScore, modalScores);

      res.json({
        success: true,
        data: {
          jobId,
          overallScore: Math.round(overallScore * 100) / 100,
          modalScores,
          interpretation,
          confidence: calculateConfidence(modalScores),
          recommendations: generateScoreRecommendations(modalScores)
        }
      });

    } catch (error) {
      logger.error('Error calculating multi-modal score', { error, userId: req.user?.id });
      throw new AppError(500, 'Multi-modal scoring failed');
    }
  }
);

/**
 *  Technical Skills Scoring
 * POST /api/scoring-system/technical-skills
 */
router.post('/technical-skills',
  body('userSkills').isArray().withMessage('User skills required'),
  body('jobRequirements').isObject().withMessage('Job requirements required'),
  body('industry').isString().optional(),
  async (req: Request, res: Response) => {
    try {
      const { userSkills, jobRequirements, industry } = req.body;
      const userId = req.user?.id;

      logger.info(' Calculating technical skills score', { userId, skillCount: userSkills.length });

      // Calculate detailed technical score
      const technicalScore = await aiMatchingService.calculateTechnicalScore(
        userSkills,
        jobRequirements.requiredSkills || [],
        jobRequirements.preferredSkills || [],
        industry
      );

      // Categorize technical skills
      const skillCategories = {
        programming: [],
        frameworks: [],
        databases: [],
        tools: [],
        cloud: [],
        other: []
      };

      // Categorize user skills
      userSkills.forEach((skill: string) => {
        const category = categorizeSkill(skill);
        skillCategories[category].push(skill);
      });

      // Calculate proficiency levels
      const proficiencyAnalysis = await analyzeProficiencyLevels(
        userSkills,
        jobRequirements,
        industry
      );

      res.json({
        success: true,
        data: {
          overallScore: technicalScore.overall,
          breakdown: {
            requiredSkillsMatch: technicalScore.requiredMatch,
            preferredSkillsMatch: technicalScore.preferredMatch,
            industryAlignment: technicalScore.industryAlignment
          },
          skillCategories,
          proficiencyAnalysis,
          gaps: technicalScore.gaps,
          strengths: technicalScore.strengths,
          recommendations: technicalScore.recommendations
        }
      });

    } catch (error) {
      logger.error('Error in technical skills scoring', { error, userId: req.user?.id });
      throw new AppError(500, 'Technical skills scoring failed');
    }
  }
);

/**
 *  Soft Skills Scoring
 * POST /api/scoring-system/soft-skills
 */
router.post('/soft-skills',
  body('userId').isUUID().optional(),
  body('jobId').isUUID().withMessage('Valid job ID required'),
  body('assessmentData').isObject().optional(),
  async (req: Request, res: Response) => {
    try {
      const { jobId, assessmentData } = req.body;
      const userId = req.body.userId || req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Calculating soft skills score', { userId, jobId });

      // Get user's career DNA for soft skills analysis
      const careerDNA = await careerDnaService.analyzeCareerDNA(userId);
      
      // Get job requirements
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true }
      });

      if (!job) {
        throw new AppError(404, 'Job not found');
      }

      // Extract soft skills requirements from job description
      const requiredSoftSkills = await extractSoftSkillsRequirements(job.description);

      // Calculate soft skills alignment
      const softSkillsScore = calculateSoftSkillsAlignment(
        careerDNA.personalityProfile,
        requiredSoftSkills,
        assessmentData
      );

      // Analyze behavioral indicators
      const behavioralAnalysis = {
        communication: careerDNA.personalityProfile.communicationStyle,
        leadership: analyzeLeadershipPotential(careerDNA),
        teamwork: analyzeTeamworkStyle(careerDNA),
        adaptability: analyzeAdaptability(careerDNA),
        problemSolving: careerDNA.personalityProfile.problemSolving
      };

      res.json({
        success: true,
        data: {
          jobId,
          overallScore: softSkillsScore.overall,
          dimensions: {
            communication: softSkillsScore.communication,
            leadership: softSkillsScore.leadership,
            teamwork: softSkillsScore.teamwork,
            adaptability: softSkillsScore.adaptability,
            emotionalIntelligence: softSkillsScore.emotionalIntelligence
          },
          behavioralAnalysis,
          alignment: {
            strongMatch: softSkillsScore.strongMatches,
            development: softSkillsScore.developmentAreas
          },
          recommendations: generateSoftSkillsRecommendations(softSkillsScore, behavioralAnalysis)
        }
      });

    } catch (error) {
      logger.error('Error in soft skills scoring', { error, userId: req.user?.id });
      throw new AppError(500, 'Soft skills scoring failed');
    }
  }
);

/**
 *  Cultural Fit Scoring
 * POST /api/scoring-system/cultural-fit
 */
router.post('/cultural-fit',
  body('userId').isUUID().optional(),
  body('companyId').isUUID().withMessage('Valid company ID required'),
  body('jobId').isUUID().optional(),
  async (req: Request, res: Response) => {
    try {
      const { companyId, jobId } = req.body;
      const userId = req.body.userId || req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Calculating cultural fit score', { userId, companyId, jobId });

      // Get user profile and preferences
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userProfile: true }
      });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      // Get company culture information
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { companyProfile: true }
      });

      if (!company) {
        throw new AppError(404, 'Company not found');
      }

      // Analyze cultural alignment
      const culturalFitAnalysis = await analyzeCulturalFit(
        user,
        company,
        jobId
      );

      // Calculate value alignment
      const valueAlignment = calculateValueAlignment(
        user.userProfile?.values || [],
        company.companyProfile?.cultureValues || []
      );

      // Analyze work environment preferences
      const environmentFit = analyzeEnvironmentFit(
        user.userProfile?.workPreferences || {},
        company.companyProfile?.workEnvironment || {}
      );

      res.json({
        success: true,
        data: {
          companyId,
          overallScore: culturalFitAnalysis.score,
          dimensions: {
            values: valueAlignment.score,
            workStyle: culturalFitAnalysis.workStyle,
            environment: environmentFit.score,
            teamDynamics: culturalFitAnalysis.teamDynamics,
            growthAlignment: culturalFitAnalysis.growthAlignment
          },
          insights: {
            strongAlignments: culturalFitAnalysis.strengths,
            potentialChallenges: culturalFitAnalysis.challenges,
            adaptationRequired: culturalFitAnalysis.adaptationAreas
          },
          recommendation: culturalFitAnalysis.recommendation
        }
      });

    } catch (error) {
      logger.error('Error in cultural fit scoring', { error, userId: req.user?.id });
      throw new AppError(500, 'Cultural fit scoring failed');
    }
  }
);

/**
 *  Custom Weighted Scoring
 * POST /api/scoring-system/custom-weighted
 */
router.post('/custom-weighted',
  body('userId').isUUID().optional(),
  body('jobId').isUUID().withMessage('Valid job ID required'),
  body('weights').isObject().withMessage('Custom weights required'),
  async (req: Request, res: Response) => {
    try {
      const { jobId, weights } = req.body;
      const userId = req.body.userId || req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Calculating custom weighted score', { userId, jobId, weights });

      // Validate weights
      const validatedWeights = validateWeights(weights);

      // Get all scoring components
      const matchResult = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchResult.length === 0) {
        throw new AppError(404, 'Unable to calculate score for this job');
      }

      const match = matchResult[0];

      // Apply custom weights
      const customScore = calculateCustomWeightedScore(match, validatedWeights);

      // Generate insights based on custom weights
      const weightInsights = generateWeightInsights(validatedWeights, customScore);

      res.json({
        success: true,
        data: {
          jobId,
          customScore: customScore.overall,
          weights: validatedWeights,
          components: customScore.components,
          insights: weightInsights,
          comparison: {
            standard: match.overallScore,
            custom: customScore.overall,
            difference: customScore.overall - match.overallScore
          }
        }
      });

    } catch (error) {
      logger.error('Error in custom weighted scoring', { error, userId: req.user?.id });
      throw new AppError(500, 'Custom weighted scoring failed');
    }
  }
);

/**
 *  Score History & Trends
 * GET /api/scoring-system/history/:userId
 */
router.get('/history/:userId',
  param('userId').isUUID().optional(),
  query('period').isString().optional(),
  query('jobId').isUUID().optional(),
  async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.userId || req.user?.id;
      const { period = '30days', jobId } = req.query;

      if (!targetUserId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Getting score history', { targetUserId, period, jobId });

      // Get historical scores
      const scoreHistory = await getScoreHistory(
        targetUserId,
        period as string,
        jobId as string
      );

      // Calculate trends
      const trends = analyzeScoreTrends(scoreHistory);

      // Get improvement areas
      const improvements = identifyImprovementAreas(scoreHistory);

      res.json({
        success: true,
        data: {
          userId: targetUserId,
          period,
          history: scoreHistory,
          trends,
          improvements,
          summary: {
            averageScore: calculateAverageScore(scoreHistory),
            highestScore: Math.max(...scoreHistory.map(s => s.score)),
            lowestScore: Math.min(...scoreHistory.map(s => s.score)),
            totalAssessments: scoreHistory.length
          }
        }
      });

    } catch (error) {
      logger.error('Error getting score history', { error });
      throw new AppError(500, 'Failed to get score history');
    }
  }
);

/**
 *  Score Certification
 * POST /api/scoring-system/certify
 */
router.post('/certify',
  body('userId').isUUID().optional(),
  body('jobId').isUUID().withMessage('Valid job ID required'),
  body('scoreData').isObject().withMessage('Score data required'),
  async (req: Request, res: Response) => {
    try {
      const { jobId, scoreData } = req.body;
      const userId = req.body.userId || req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Certifying score', { userId, jobId });

      // Verify score authenticity
      const isValid = await verifyScoreData(userId, jobId, scoreData);

      if (!isValid) {
        throw new AppError(400, 'Invalid score data');
      }

      // Generate certification
      const certification = {
        id: generateCertificationId(),
        userId,
        jobId,
        score: scoreData.overallScore,
        components: scoreData.components,
        certifiedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        verificationCode: generateVerificationCode()
      };

      // Store certification
      await storeCertification(certification);

      res.json({
        success: true,
        data: {
          certification,
          message: 'Score certified successfully',
          shareableLink: `/verify/${certification.verificationCode}`
        }
      });

    } catch (error) {
      logger.error('Error certifying score', { error, userId: req.user?.id });
      throw new AppError(500, 'Score certification failed');
    }
  }
);

// Helper functions

function interpretScore(score: number, modalScores: any): any {
  const level = score > 0.85 ? 'Excellent' :
                score > 0.70 ? 'Strong' :
                score > 0.55 ? 'Good' :
                score > 0.40 ? 'Fair' : 'Needs Improvement';

  const strengths = [];
  const improvements = [];

  for (const [modal, data] of Object.entries(modalScores)) {
    if (data.score > 0.75) {
      strengths.push(modal);
    } else if (data.score < 0.50) {
      improvements.push(modal);
    }
  }

  return {
    level,
    strengths,
    improvements,
    summary: `${level} match with strengths in ${strengths.join(', ') || 'multiple areas'}`
  };
}

function calculateConfidence(modalScores: any): number {
  // Calculate confidence based on score consistency
  const scores = Object.values(modalScores).map((m: any) => m.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
  
  // Lower variance = higher confidence
  return Math.max(0.5, Math.min(1, 1 - variance));
}

function generateScoreRecommendations(modalScores: any): string[] {
  const recommendations = [];
  
  for (const [modal, data] of Object.entries(modalScores)) {
    if (data.score < 0.6) {
      recommendations.push(`Improve ${modal} skills to increase overall match`);
    }
  }
  
  return recommendations;
}

function categorizeSkill(skill: string): string {
  const lowerSkill = skill.toLowerCase();
  
  if (['javascript', 'python', 'java', 'c#', 'php', 'ruby', 'go'].some(lang => lowerSkill.includes(lang))) {
    return 'programming';
  }
  if (['react', 'angular', 'vue', 'django', 'spring', 'laravel'].some(fw => lowerSkill.includes(fw))) {
    return 'frameworks';
  }
  if (['mysql', 'postgresql', 'mongodb', 'redis'].some(db => lowerSkill.includes(db))) {
    return 'databases';
  }
  if (['aws', 'azure', 'gcp', 'docker', 'kubernetes'].some(cloud => lowerSkill.includes(cloud))) {
    return 'cloud';
  }
  if (['git', 'jira', 'jenkins', 'vscode'].some(tool => lowerSkill.includes(tool))) {
    return 'tools';
  }
  
  return 'other';
}

async function analyzeProficiencyLevels(userSkills: string[], jobRequirements: any, industry?: string): Promise<any> {
  // Simplified proficiency analysis
  const proficiencyMap: Record<string, string> = {};
  
  userSkills.forEach(skill => {
    // Assign proficiency based on various factors
    if (jobRequirements.requiredSkills?.includes(skill)) {
      proficiencyMap[skill] = 'Advanced';
    } else if (jobRequirements.preferredSkills?.includes(skill)) {
      proficiencyMap[skill] = 'Intermediate';
    } else {
      proficiencyMap[skill] = 'Beginner';
    }
  });
  
  return {
    levels: proficiencyMap,
    summary: {
      advanced: Object.values(proficiencyMap).filter(l => l === 'Advanced').length,
      intermediate: Object.values(proficiencyMap).filter(l => l === 'Intermediate').length,
      beginner: Object.values(proficiencyMap).filter(l => l === 'Beginner').length
    }
  };
}

async function extractSoftSkillsRequirements(jobDescription: string): Promise<any> {
  const softSkillKeywords = {
    communication: ['communication', 'verbal', 'written', 'presentation'],
    leadership: ['leadership', 'lead', 'manage', 'mentor'],
    teamwork: ['team', 'collaborate', 'cooperation'],
    adaptability: ['adaptable', 'flexible', 'dynamic'],
    problemSolving: ['problem-solving', 'analytical', 'critical thinking']
  };
  
  const requirements: Record<string, boolean> = {};
  const lowerDescription = jobDescription.toLowerCase();
  
  for (const [skill, keywords] of Object.entries(softSkillKeywords)) {
    requirements[skill] = keywords.some(keyword => lowerDescription.includes(keyword));
  }
  
  return requirements;
}

function calculateSoftSkillsAlignment(personalityProfile: any, requirements: any, assessmentData?: any): any {
  const scores = {
    communication: personalityProfile?.communicationStyle ? 0.8 : 0.5,
    leadership: personalityProfile?.workingPreference === 'leadership' ? 0.9 : 0.6,
    teamwork: personalityProfile?.workingPreference === 'collaborative' ? 0.9 : 0.7,
    adaptability: 0.75, // Default
    emotionalIntelligence: 0.7 // Default
  };
  
  // Adjust based on assessment data if available
  if (assessmentData) {
    Object.assign(scores, assessmentData.scores || {});
  }
  
  const overall = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.values(scores).length;
  
  return {
    overall,
    ...scores,
    strongMatches: Object.entries(scores).filter(([_, score]) => score > 0.8).map(([skill, _]) => skill),
    developmentAreas: Object.entries(scores).filter(([_, score]) => score < 0.6).map(([skill, _]) => skill)
  };
}

function analyzeLeadershipPotential(careerDNA: any): string {
  if (careerDNA.personalityProfile?.workingPreference === 'leadership') {
    return 'High leadership potential';
  }
  return 'Moderate leadership potential';
}

function analyzeTeamworkStyle(careerDNA: any): string {
  const style = careerDNA.personalityProfile?.workingPreference;
  if (style === 'collaborative') return 'Strong team player';
  if (style === 'supportive') return 'Supportive team member';
  return 'Independent contributor';
}

function analyzeAdaptability(careerDNA: any): string {
  // Simplified analysis
  return 'Good adaptability';
}

function generateSoftSkillsRecommendations(scores: any, behavioral: any): string[] {
  const recommendations = [];
  
  if (scores.communication < 0.7) {
    recommendations.push('Develop communication skills through practice and feedback');
  }
  
  if (scores.leadership < 0.7 && behavioral.leadership.includes('High')) {
    recommendations.push('Seek leadership opportunities to demonstrate potential');
  }
  
  return recommendations;
}

async function analyzeCulturalFit(user: any, company: any, jobId?: string): Promise<any> {
  // Simplified cultural fit analysis
  const score = Math.random() * 0.4 + 0.6; // 0.6-1.0 range
  
  return {
    score,
    workStyle: 0.75,
    teamDynamics: 0.8,
    growthAlignment: 0.7,
    strengths: ['Value alignment', 'Work style compatibility'],
    challenges: ['Different communication preferences'],
    adaptationAreas: ['Team collaboration style'],
    recommendation: score > 0.7 ? 'Strong cultural fit' : 'Good cultural fit with some adaptation needed'
  };
}

function calculateValueAlignment(userValues: string[], companyValues: string[]): any {
  const commonValues = userValues.filter(v => companyValues.includes(v));
  const score = companyValues.length > 0 ? commonValues.length / companyValues.length : 0.5;
  
  return {
    score,
    aligned: commonValues,
    userUnique: userValues.filter(v => !companyValues.includes(v)),
    companyUnique: companyValues.filter(v => !userValues.includes(v))
  };
}

function analyzeEnvironmentFit(userPrefs: any, companyEnv: any): any {
  // Simplified environment fit
  return {
    score: 0.75,
    matches: ['Flexible hours', 'Remote options'],
    mismatches: ['Open office layout']
  };
}

function validateWeights(weights: any): any {
  const defaultWeights = {
    technical: 0.35,
    experience: 0.25,
    softSkills: 0.20,
    cultural: 0.10,
    education: 0.10
  };
  
  const validated = { ...defaultWeights };
  
  // Override with provided weights
  for (const [key, value] of Object.entries(weights)) {
    if (typeof value === 'number' && value >= 0 && value <= 1) {
      validated[key] = value;
    }
  }
  
  // Normalize to ensure sum is 1
  const sum = Object.values(validated).reduce((a: number, b: number) => a + b, 0);
  for (const key of Object.keys(validated)) {
    validated[key] = validated[key] / sum;
  }
  
  return validated;
}

function calculateCustomWeightedScore(match: any, weights: any): any {
  const components = {
    technical: match.skillsScore * weights.technical,
    experience: match.experienceScore * weights.experience,
    softSkills: match.personalityScore * weights.softSkills,
    cultural: match.culturalFitScore * weights.cultural,
    education: match.educationScore * weights.education
  };
  
  const overall = Object.values(components).reduce((sum: number, val: number) => sum + val, 0);
  
  return {
    overall,
    components
  };
}

function generateWeightInsights(weights: any, score: any): string[] {
  const insights = [];
  
  // Find highest weighted component
  const highest = Object.entries(weights).reduce((a, b) => b[1] > a[1] ? b : a);
  insights.push(`Highest priority given to ${highest[0]} (${(highest[1] * 100).toFixed(0)}%)`);
  
  // Check if weights are balanced
  const variance = Object.values(weights).reduce((sum: number, w: number) => {
    const avg = 1 / Object.keys(weights).length;
    return sum + Math.pow(w - avg, 2);
  }, 0) / Object.keys(weights).length;
  
  if (variance < 0.01) {
    insights.push('Weights are well-balanced across all components');
  } else {
    insights.push('Weights show strong preference for specific components');
  }
  
  return insights;
}

async function getScoreHistory(userId: string, period: string, jobId?: string): Promise<any[]> {
  // Simulated score history
  const days = period === '7days' ? 7 : period === '30days' ? 30 : 90;
  const history = [];
  
  for (let i = 0; i < Math.min(days, 10); i++) {
    history.push({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      score: Math.random() * 0.3 + 0.6, // 0.6-0.9 range
      jobId: jobId || `job-${i}`,
      components: {
        technical: Math.random() * 0.3 + 0.6,
        experience: Math.random() * 0.3 + 0.6,
        softSkills: Math.random() * 0.3 + 0.6,
        cultural: Math.random() * 0.3 + 0.6
      }
    });
  }
  
  return history;
}

function analyzeScoreTrends(history: any[]): any {
  if (history.length < 2) {
    return { trend: 'insufficient_data' };
  }
  
  const recent = history.slice(0, 5);
  const older = history.slice(5);
  
  const recentAvg = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
  const olderAvg = older.length > 0 ? older.reduce((sum, h) => sum + h.score, 0) / older.length : recentAvg;
  
  return {
    trend: recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable',
    change: ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1) + '%',
    recentAverage: recentAvg,
    historicalAverage: olderAvg
  };
}

function identifyImprovementAreas(history: any[]): string[] {
  if (history.length === 0) return [];
  
  const latestScore = history[0];
  const improvements = [];
  
  for (const [component, score] of Object.entries(latestScore.components || {})) {
    if (score < 0.7) {
      improvements.push(`Improve ${component} skills (current: ${(score * 100).toFixed(0)}%)`);
    }
  }
  
  return improvements;
}

function calculateAverageScore(history: any[]): number {
  if (history.length === 0) return 0;
  return history.reduce((sum, h) => sum + h.score, 0) / history.length;
}

async function verifyScoreData(userId: string, jobId: string, scoreData: any): Promise<boolean> {
  // Verify that the score data is legitimate
  // In real implementation, this would check against stored calculations
  return true;
}

function generateCertificationId(): string {
  return `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 15).toUpperCase();
}

async function storeCertification(certification: any): Promise<void> {
  // Store certification in database
  // In real implementation, this would save to database
  logger.info('Certification stored', { certificationId: certification.id });
}

export { router as scoringSystemRoutes };
