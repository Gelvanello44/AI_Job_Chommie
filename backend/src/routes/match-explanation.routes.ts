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
 *  Get Detailed Match Explanation
 * POST /api/match-explanation/detailed
 */
router.post('/detailed',
  body('userId').isUUID().optional(),
  body('jobId').isUUID().withMessage('Valid job ID required'),
  body('includeVisualizations').isBoolean().optional(),
  async (req: Request, res: Response) => {
    try {
      const { jobId, includeVisualizations = true } = req.body;
      const userId = req.body.userId || req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Generating detailed match explanation', { userId, jobId });

      // Get match data
      const matchData = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchData.length === 0) {
        throw new AppError(404, 'No match data available for this job');
      }

      const match = matchData[0];

      // Generate detailed explanation
      const explanation = generateDetailedExplanation(match);

      // Generate reasoning chains
      const reasoning = generateReasoningChains(match);

      // Generate insights
      const insights = generateMatchInsights(match);

      // Generate visualizations if requested
      let visualizations = null;
      if (includeVisualizations) {
        visualizations = generateVisualizationData(match);
      }

      res.json({
        success: true,
        data: {
          jobId,
          overallScore: match.overallScore,
          explanation,
          reasoning,
          insights,
          visualizations,
          confidence: calculateExplanationConfidence(match),
          recommendations: generateActionableRecommendations(match)
        }
      });

    } catch (error) {
      logger.error('Error generating match explanation', { error, userId: req.user?.id });
      throw new AppError(500, 'Match explanation generation failed');
    }
  }
);

/**
 *  Get Match Reasoning
 * GET /api/match-explanation/reasoning/:jobId
 */
router.get('/reasoning/:jobId',
  param('jobId').isUUID(),
  query('depth').isString().optional().isIn(['summary', 'detailed', 'comprehensive']),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { depth = 'detailed' } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Getting match reasoning', { userId, jobId, depth });

      // Get match data
      const matchData = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchData.length === 0) {
        throw new AppError(404, 'No match data available');
      }

      const match = matchData[0];

      // Generate reasoning based on depth
      let reasoning;
      switch (depth) {
        case 'summary':
          reasoning = generateSummaryReasoning(match);
          break;
        case 'comprehensive':
          reasoning = await generateComprehensiveReasoning(match, userId, jobId);
          break;
        default:
          reasoning = generateDetailedReasoning(match);
      }

      res.json({
        success: true,
        data: {
          jobId,
          depth,
          reasoning,
          keyFactors: extractKeyFactors(match),
          decisionSupport: generateDecisionSupport(match)
        }
      });

    } catch (error) {
      logger.error('Error getting match reasoning', { error });
      throw new AppError(500, 'Failed to get match reasoning');
    }
  }
);

/**
 *  Get Match Visualization Data
 * GET /api/match-explanation/visualization/:jobId
 */
router.get('/visualization/:jobId',
  param('jobId').isUUID(),
  query('type').isString().optional().isIn(['radar', 'bar', 'heatmap', 'sankey', 'all']),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { type = 'all' } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Getting visualization data', { userId, jobId, type });

      // Get match data
      const matchData = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchData.length === 0) {
        throw new AppError(404, 'No match data available');
      }

      const match = matchData[0];

      // Generate visualization data based on type
      let visualizationData: any = {};

      if (type === 'all' || type === 'radar') {
        visualizationData.radar = generateRadarChartData(match);
      }

      if (type === 'all' || type === 'bar') {
        visualizationData.bar = generateBarChartData(match);
      }

      if (type === 'all' || type === 'heatmap') {
        visualizationData.heatmap = generateHeatmapData(match);
      }

      if (type === 'all' || type === 'sankey') {
        visualizationData.sankey = generateSankeyData(match);
      }

      res.json({
        success: true,
        data: {
          jobId,
          type,
          visualizations: visualizationData,
          metadata: {
            generatedAt: new Date().toISOString(),
            matchScore: match.overallScore
          }
        }
      });

    } catch (error) {
      logger.error('Error getting visualization data', { error });
      throw new AppError(500, 'Failed to get visualization data');
    }
  }
);

/**
 *  Get Match Strengths and Gaps
 * GET /api/match-explanation/analysis/:jobId
 */
router.get('/analysis/:jobId',
  param('jobId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Analyzing match strengths and gaps', { userId, jobId });

      // Get match data
      const matchData = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchData.length === 0) {
        throw new AppError(404, 'No match data available');
      }

      const match = matchData[0];

      // Analyze strengths
      const strengths = analyzeStrengths(match);

      // Analyze gaps
      const gaps = analyzeGaps(match);

      // Generate improvement plan
      const improvementPlan = generateImprovementPlan(gaps, match);

      // Calculate potential score
      const potentialScore = calculatePotentialScore(match, improvementPlan);

      res.json({
        success: true,
        data: {
          jobId,
          currentScore: match.overallScore,
          strengths,
          gaps,
          improvementPlan,
          potentialScore,
          timeToImprove: estimateImprovementTime(improvementPlan)
        }
      });

    } catch (error) {
      logger.error('Error analyzing match', { error });
      throw new AppError(500, 'Match analysis failed');
    }
  }
);

/**
 *  Get Natural Language Explanation
 * POST /api/match-explanation/natural-language
 */
router.post('/natural-language',
  body('userId').isUUID().optional(),
  body('jobId').isUUID().withMessage('Valid job ID required'),
  body('style').isString().optional().isIn(['professional', 'casual', 'detailed', 'brief']),
  body('language').isString().optional(),
  async (req: Request, res: Response) => {
    try {
      const { jobId, style = 'professional', language = 'en' } = req.body;
      const userId = req.body.userId || req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Generating natural language explanation', { 
        userId, 
        jobId, 
        style, 
        language 
      });

      // Get match data
      const matchData = await aiMatchingService.calculateJobMatches(userId, [jobId]);
      
      if (matchData.length === 0) {
        throw new AppError(404, 'No match data available');
      }

      const match = matchData[0];

      // Get job and user details for context
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { company: true }
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userProfile: true }
      });

      // Generate natural language explanation
      const explanation = generateNaturalLanguageExplanation(
        match,
        job,
        user,
        style
      );

      // Generate key takeaways
      const keyTakeaways = generateKeyTakeaways(match, style);

      res.json({
        success: true,
        data: {
          jobId,
          explanation,
          keyTakeaways,
          style,
          language,
          readingTime: estimateReadingTime(explanation)
        }
      });

    } catch (error) {
      logger.error('Error generating natural language explanation', { error });
      throw new AppError(500, 'Natural language generation failed');
    }
  }
);

/**
 *  Compare Multiple Matches
 * POST /api/match-explanation/compare
 */
router.post('/compare',
  body('jobIds').isArray().notEmpty().withMessage('Job IDs array required'),
  body('userId').isUUID().optional(),
  async (req: Request, res: Response) => {
    try {
      const { jobIds } = req.body;
      const userId = req.body.userId || req.user?.id;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      if (jobIds.length > 5) {
        throw new AppError(400, 'Maximum 5 jobs can be compared at once');
      }

      logger.info(' Comparing multiple matches', { userId, jobCount: jobIds.length });

      // Get match data for all jobs
      const matchData = await aiMatchingService.calculateJobMatches(userId, jobIds);

      // Generate comparison data
      const comparison = {
        jobs: matchData.map(match => ({
          jobId: match.jobId,
          overallScore: match.overallScore,
          strengths: match.strengths.slice(0, 3),
          gaps: match.gaps.slice(0, 3)
        })),
        dimensions: compareMatchDimensions(matchData),
        ranking: rankMatches(matchData),
        insights: generateComparisonInsights(matchData),
        recommendation: recommendBestMatch(matchData)
      };

      res.json({
        success: true,
        data: comparison
      });

    } catch (error) {
      logger.error('Error comparing matches', { error });
      throw new AppError(500, 'Match comparison failed');
    }
  }
);

/**
 *  Get Historical Match Explanations
 * GET /api/match-explanation/history
 */
router.get('/history',
  query('limit').isInt().optional(),
  query('period').isString().optional(),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { limit = 10, period = '30days' } = req.query;

      if (!userId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Getting historical match explanations', { userId, limit, period });

      // Get historical matches
      const historicalMatches = await getHistoricalMatches(
        userId,
        parseInt(limit as string),
        period as string
      );

      // Analyze trends
      const trends = analyzeMatchTrends(historicalMatches);

      // Generate insights
      const insights = generateHistoricalInsights(historicalMatches, trends);

      res.json({
        success: true,
        data: {
          matches: historicalMatches,
          trends,
          insights,
          summary: {
            totalMatches: historicalMatches.length,
            averageScore: calculateAverageScore(historicalMatches),
            improvementRate: trends.improvementRate
          }
        }
      });

    } catch (error) {
      logger.error('Error getting historical explanations', { error });
      throw new AppError(500, 'Failed to get historical data');
    }
  }
);

// Helper functions

function generateDetailedExplanation(match: any): any {
  return {
    summary: `Your overall match score is ${(match.overallScore * 100).toFixed(0)}%, indicating a ${
      match.overallScore > 0.8 ? 'strong' : match.overallScore > 0.6 ? 'good' : 'moderate'
    } fit for this position.`,
    breakdown: {
      skills: {
        score: match.skillsScore,
        explanation: `Your technical skills match ${(match.skillsScore * 100).toFixed(0)}% of the requirements.`,
        details: match.matchDetails?.skillsAnalysis || 'Skills analysis pending'
      },
      experience: {
        score: match.experienceScore,
        explanation: `Your experience level aligns ${(match.experienceScore * 100).toFixed(0)}% with the role requirements.`,
        details: match.matchDetails?.experienceAnalysis || 'Experience analysis pending'
      },
      personality: {
        score: match.personalityScore,
        explanation: `Your personality profile shows ${(match.personalityScore * 100).toFixed(0)}% alignment with the role.`,
        details: match.personalityInsights || {}
      },
      cultural: {
        score: match.culturalFitScore,
        explanation: `Cultural fit assessment indicates ${(match.culturalFitScore * 100).toFixed(0)}% compatibility.`,
        details: 'Based on company values and work style preferences'
      }
    }
  };
}

function generateReasoningChains(match: any): any {
  const chains = [];

  // Skills reasoning chain
  if (match.skillsScore > 0.7) {
    chains.push({
      type: 'skills',
      conclusion: 'Strong technical fit',
      steps: [
        'Analyzed required technical skills',
        'Matched against your skill profile',
        'Found significant overlap in key areas',
        'Confirmed proficiency levels align with requirements'
      ]
    });
  }

  // Experience reasoning chain
  if (match.experienceScore > 0.6) {
    chains.push({
      type: 'experience',
      conclusion: 'Adequate experience level',
      steps: [
        'Evaluated years of relevant experience',
        'Assessed industry-specific background',
        'Compared role responsibilities',
        'Determined transferable skills value'
      ]
    });
  }

  // Personality reasoning chain
  if (match.personalityScore > 0.7) {
    chains.push({
      type: 'personality',
      conclusion: 'Good personality-role alignment',
      steps: [
        'Analyzed communication style requirements',
        'Evaluated work preference compatibility',
        'Assessed problem-solving approach fit',
        'Confirmed leadership style alignment'
      ]
    });
  }

  return chains;
}

function generateMatchInsights(match: any): string[] {
  const insights = [];

  if (match.overallScore > 0.85) {
    insights.push('This is an exceptional match - you should definitely apply');
  } else if (match.overallScore > 0.7) {
    insights.push('This is a strong match worth pursuing with a tailored application');
  }

  if (match.skillsScore > match.experienceScore) {
    insights.push('Your skills are your strongest asset for this role');
  }

  if (match.personalityScore > 0.8) {
    insights.push('Your personality profile aligns exceptionally well with this role');
  }

  if (match.gaps?.length > 0) {
    insights.push(`Focus on addressing ${match.gaps[0]} to improve your match`);
  }

  return insights;
}

function generateVisualizationData(match: any): any {
  return {
    radar: generateRadarChartData(match),
    bar: generateBarChartData(match),
    flow: generateFlowVisualization(match)
  };
}

function generateRadarChartData(match: any): any {
  return {
    type: 'radar',
    data: {
      labels: ['Technical Skills', 'Experience', 'Soft Skills', 'Education', 'Cultural Fit'],
      datasets: [{
        label: 'Your Match',
        data: [
          match.skillsScore * 100,
          match.experienceScore * 100,
          match.personalityScore * 100,
          match.educationScore * 100,
          match.culturalFitScore * 100
        ],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2
      }]
    },
    options: {
      scale: {
        ticks: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  };
}

function generateBarChartData(match: any): any {
  return {
    type: 'bar',
    data: {
      labels: ['Overall', 'Skills', 'Experience', 'Personality', 'Cultural Fit'],
      datasets: [{
        label: 'Match Percentage',
        data: [
          match.overallScore * 100,
          match.skillsScore * 100,
          match.experienceScore * 100,
          match.personalityScore * 100,
          match.culturalFitScore * 100
        ],
        backgroundColor: [
          'rgba(75, 192, 192, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)',
          'rgba(153, 102, 255, 0.2)',
          'rgba(255, 99, 132, 0.2)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 99, 132, 1)'
        ],
        borderWidth: 1
      }]
    }
  };
}

function generateHeatmapData(match: any): any {
  return {
    type: 'heatmap',
    data: {
      x: ['Skills', 'Experience', 'Education', 'Location', 'Salary'],
      y: ['Required', 'Your Profile', 'Gap'],
      z: [
        [1.0, match.skillsScore, 1.0 - match.skillsScore],
        [1.0, match.experienceScore, 1.0 - match.experienceScore],
        [1.0, match.educationScore, 1.0 - match.educationScore],
        [1.0, match.locationScore, 1.0 - match.locationScore],
        [1.0, match.salaryScore, 1.0 - match.salaryScore]
      ]
    }
  };
}

function generateSankeyData(match: any): any {
  return {
    type: 'sankey',
    data: {
      nodes: [
        { id: 'you', label: 'Your Profile' },
        { id: 'skills', label: 'Skills Match' },
        { id: 'experience', label: 'Experience Match' },
        { id: 'personality', label: 'Personality Match' },
        { id: 'overall', label: 'Overall Match' }
      ],
      links: [
        { source: 'you', target: 'skills', value: match.skillsScore },
        { source: 'you', target: 'experience', value: match.experienceScore },
        { source: 'you', target: 'personality', value: match.personalityScore },
        { source: 'skills', target: 'overall', value: match.skillsScore * 0.35 },
        { source: 'experience', target: 'overall', value: match.experienceScore * 0.25 },
        { source: 'personality', target: 'overall', value: match.personalityScore * 0.4 }
      ]
    }
  };
}

function calculateExplanationConfidence(match: any): number {
  // Calculate confidence based on data completeness and score consistency
  const dataCompleteness = match.matchDetails ? 0.9 : 0.7;
  const scoreConsistency = 1 - calculateScoreVariance(match);
  return (dataCompleteness + scoreConsistency) / 2;
}

function calculateScoreVariance(match: any): number {
  const scores = [
    match.skillsScore,
    match.experienceScore,
    match.educationScore,
    match.personalityScore,
    match.culturalFitScore
  ];
  
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
  return Math.min(variance, 1);
}

function generateActionableRecommendations(match: any): string[] {
  const recommendations = [];

  if (match.skillsScore < 0.7) {
    recommendations.push('Develop missing technical skills through online courses or certifications');
  }

  if (match.experienceScore < 0.6) {
    recommendations.push('Highlight transferable experience and relevant projects');
  }

  if (match.overallScore > 0.7) {
    recommendations.push('Customize your application to emphasize your strongest matching areas');
  }

  recommendations.push(...match.recommendations.slice(0, 2));

  return recommendations;
}

function generateSummaryReasoning(match: any): any {
  return {
    conclusion: match.overallScore > 0.7 ? 'Recommended to apply' : 'Consider with improvements',
    mainReasons: [
      `Skills match: ${(match.skillsScore * 100).toFixed(0)}%`,
      `Experience alignment: ${(match.experienceScore * 100).toFixed(0)}%`,
      `Cultural fit: ${(match.culturalFitScore * 100).toFixed(0)}%`
    ]
  };
}

function generateDetailedReasoning(match: any): any {
  return {
    overallAssessment: generateOverallAssessment(match),
    componentAnalysis: {
      skills: analyzeSkillsReasoning(match),
      experience: analyzeExperienceReasoning(match),
      personality: analyzePersonalityReasoning(match),
      culture: analyzeCultureReasoning(match)
    },
    synthesis: synthesizeReasoning(match)
  };
}

async function generateComprehensiveReasoning(match: any, userId: string, jobId: string): Promise<any> {
  // Get additional context
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userProfile: true }
  });

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { company: true }
  });

  return {
    contextualAnalysis: {
      userBackground: analyzeUserBackground(user),
      jobRequirements: analyzeJobRequirements(job),
      marketContext: await analyzeMarketContext(job)
    },
    detailedReasoning: generateDetailedReasoning(match),
    comparativeAnalysis: await generateComparativeAnalysis(match, job),
    futureProjection: projectFutureSuccess(match, user, job)
  };
}

function extractKeyFactors(match: any): any[] {
  const factors = [];

  if (match.skillsScore > 0.8) {
    factors.push({
      factor: 'Technical Excellence',
      impact: 'High',
      score: match.skillsScore
    });
  }

  if (match.experienceScore > 0.7) {
    factors.push({
      factor: 'Relevant Experience',
      impact: 'High',
      score: match.experienceScore
    });
  }

  if (match.personalityScore > 0.75) {
    factors.push({
      factor: 'Personality Fit',
      impact: 'Medium-High',
      score: match.personalityScore
    });
  }

  return factors.sort((a, b) => b.score - a.score);
}

function generateDecisionSupport(match: any): any {
  const shouldApply = match.overallScore > 0.6;
  
  return {
    recommendation: shouldApply ? 'Apply' : 'Improve First',
    confidence: shouldApply ? match.overallScore : 1 - match.overallScore,
    actionItems: shouldApply ? 
      ['Tailor your CV', 'Write custom cover letter', 'Research company culture'] :
      ['Develop missing skills', 'Gain more experience', 'Reassess in 3-6 months'],
    timeline: shouldApply ? 'Apply within 1 week' : 'Revisit in 3-6 months'
  };
}

function generateFlowVisualization(match: any): any {
  return {
    type: 'flow',
    nodes: [
      { id: 'start', label: 'Your Profile', level: 0 },
      { id: 'skills', label: `Skills (${(match.skillsScore * 100).toFixed(0)}%)`, level: 1 },
      { id: 'exp', label: `Experience (${(match.experienceScore * 100).toFixed(0)}%)`, level: 1 },
      { id: 'personality', label: `Personality (${(match.personalityScore * 100).toFixed(0)}%)`, level: 1 },
      { id: 'match', label: `Overall Match (${(match.overallScore * 100).toFixed(0)}%)`, level: 2 },
      { id: 'decision', label: match.overallScore > 0.7 ? 'Apply ' : 'Improve First', level: 3 }
    ],
    edges: [
      { from: 'start', to: 'skills' },
      { from: 'start', to: 'exp' },
      { from: 'start', to: 'personality' },
      { from: 'skills', to: 'match' },
      { from: 'exp', to: 'match' },
      { from: 'personality', to: 'match' },
      { from: 'match', to: 'decision' }
    ]
  };
}

function analyzeStrengths(match: any): any {
  const strengths = [];

  const components = [
    { name: 'Technical Skills', score: match.skillsScore },
    { name: 'Experience', score: match.experienceScore },
    { name: 'Soft Skills', score: match.personalityScore },
    { name: 'Cultural Fit', score: match.culturalFitScore },
    { name: 'Education', score: match.educationScore }
  ];

  components
    .filter(c => c.score > 0.7)
    .sort((a, b) => b.score - a.score)
    .forEach(component => {
      strengths.push({
        area: component.name,
        score: component.score,
        impact: component.score > 0.85 ? 'Major Strength' : 'Strong Point',
        leverage: `Emphasize your ${component.name.toLowerCase()} in your application`
      });
    });

  return strengths;
}

function analyzeGaps(match: any): any {
  const gaps = [];

  if (match.gaps && match.gaps.length > 0) {
    match.gaps.forEach((gap: string) => {
      gaps.push({
        area: gap,
        severity: 'Medium',
        impact: 'May affect application success',
        solution: `Develop skills in ${gap}`
      });
    });
  }

  const components = [
    { name: 'Technical Skills', score: match.skillsScore },
    { name: 'Experience', score: match.experienceScore },
    { name: 'Soft Skills', score: match.personalityScore }
  ];

  components
    .filter(c => c.score < 0.6)
    .forEach(component => {
      if (!gaps.find(g => g.area === component.name)) {
        gaps.push({
          area: component.name,
          severity: component.score < 0.4 ? 'High' : 'Medium',
          impact: `${component.name} below requirements`,
          solution: generateGapSolution(component.name, component.score)
        });
      }
    });

  return gaps;
}

function generateImprovementPlan(gaps: any[], match: any): any {
  const plan = {
    immediate: [],
    shortTerm: [],
    mediumTerm: []
  };

  gaps.forEach(gap => {
    if (gap.severity === 'High') {
      plan.immediate.push({
        action: gap.solution,
        timeline: '1-2 weeks',
        impact: 'High'
      });
    } else {
      plan.shortTerm.push({
        action: gap.solution,
        timeline: '1-3 months',
        impact: 'Medium'
      });
    }
  });

  // Add general improvements
  if (match.overallScore < 0.8) {
    plan.mediumTerm.push({
      action: 'Build portfolio projects demonstrating required skills',
      timeline: '3-6 months',
      impact: 'High'
    });
  }

  return plan;
}

function calculatePotentialScore(match: any, improvementPlan: any): number {
  let potentialIncrease = 0;

  // Calculate potential increase from addressing gaps
  const immediateImpact = improvementPlan.immediate.length * 0.05;
  const shortTermImpact = improvementPlan.shortTerm.length * 0.03;
  const mediumTermImpact = improvementPlan.mediumTerm.length * 0.02;

  potentialIncrease = immediateImpact + shortTermImpact + mediumTermImpact;

  return Math.min(match.overallScore + potentialIncrease, 0.95);
}

function estimateImprovementTime(plan: any): string {
  if (plan.immediate.length > 0) return '2-4 weeks';
  if (plan.shortTerm.length > 0) return '1-3 months';
  if (plan.mediumTerm.length > 0) return '3-6 months';
  return 'Already optimized';
}

function generateNaturalLanguageExplanation(match: any, job: any, user: any, style: string): string {
  const intro = style === 'casual' ? 
    `Hey ${user.firstName || 'there'}! Let me break down how you match with this ${job.title} role at ${job.company?.name || 'this company'}.` :
    `Based on our comprehensive analysis, here is how your profile aligns with the ${job.title} position at ${job.company?.name || 'this organization'}.`;

  const scoreExplanation = `Your overall match score is ${(match.overallScore * 100).toFixed(0)}%, which indicates ${
    match.overallScore > 0.8 ? 'an excellent' : 
    match.overallScore > 0.65 ? 'a strong' : 
    match.overallScore > 0.5 ? 'a moderate' : 'a developing'
  } fit for this role.`;

  const strengthsText = match.strengths.length > 0 ?
    `Your key strengths for this position include ${match.strengths.slice(0, 3).join(', ')}.` :
    'You have several transferable skills that could be valuable in this role.';

  const recommendation = match.overallScore > 0.7 ?
    'I recommend applying for this position with a tailored application that highlights your relevant strengths.' :
    'Consider developing the identified skill gaps before applying to maximize your chances of success.';

  return `${intro}\n\n${scoreExplanation}\n\n${strengthsText}\n\n${recommendation}`;
}

function generateKeyTakeaways(match: any, style: string): string[] {
  const takeaways = [];

  if (style === 'casual') {
    takeaways.push(`You're a ${(match.overallScore * 100).toFixed(0)}% match - ${match.overallScore > 0.7 ? 'pretty good!' : 'room to grow'}`);
    if (match.skillsScore > 0.8) takeaways.push('Your tech skills are on point ');
    if (match.personalityScore > 0.75) takeaways.push('Your personality fits well with this role');
  } else {
    takeaways.push(`Overall match: ${(match.overallScore * 100).toFixed(0)}%`);
    takeaways.push(`Primary strength: ${getTopStrength(match)}`);
    if (match.gaps.length > 0) takeaways.push(`Key gap to address: ${match.gaps[0]}`);
  }

  return takeaways;
}

function estimateReadingTime(text: string): string {
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} min read`;
}

function compareMatchDimensions(matches: any[]): any {
  const dimensions = ['skillsScore', 'experienceScore', 'personalityScore', 'culturalFitScore'];
  const comparison = {};

  dimensions.forEach(dim => {
    comparison[dim] = matches.map(match => ({
      jobId: match.jobId,
      score: match[dim],
      rank: 0 // Will be calculated
    }));

    // Calculate ranks
    comparison[dim].sort((a: any, b: any) => b.score - a.score);
    comparison[dim].forEach((item: any, index: number) => {
      item.rank = index + 1;
    });
  });

  return comparison;
}

function rankMatches(matches: any[]): any[] {
  return matches
    .map(match => ({
      jobId: match.jobId,
      overallScore: match.overallScore,
      rank: 0
    }))
    .sort((a, b) => b.overallScore - a.overallScore)
    .map((match, index) => ({
      ...match,
      rank: index + 1
    }));
}

function generateComparisonInsights(matches: any[]): string[] {
  const insights = [];

  // Find best overall match
  const bestMatch = matches.reduce((best, current) => 
    current.overallScore > best.overallScore ? current : best
  );

  insights.push(`Best overall match: Job ${bestMatch.jobId} with ${(bestMatch.overallScore * 100).toFixed(0)}% compatibility`);

  // Find dimension leaders
  const skillsLeader = matches.reduce((best, current) => 
    current.skillsScore > best.skillsScore ? current : best
  );

  if (skillsLeader.jobId !== bestMatch.jobId) {
    insights.push(`Strongest skills match: Job ${skillsLeader.jobId}`);
  }

  // Identify patterns
  const avgScore = matches.reduce((sum, m) => sum + m.overallScore, 0) / matches.length;
  if (avgScore > 0.7) {
    insights.push('You have multiple strong matches - consider applying to all');
  }

  return insights;
}

function recommendBestMatch(matches: any[]): any {
  const bestMatch = matches.reduce((best, current) => 
    current.overallScore > best.overallScore ? current : best
  );

  return {
    jobId: bestMatch.jobId,
    reason: `Highest overall compatibility at ${(bestMatch.overallScore * 100).toFixed(0)}%`,
    alternativeChoice: matches.length > 1 ? 
      matches.sort((a, b) => b.overallScore - a.overallScore)[1].jobId : null
  };
}

async function getHistoricalMatches(userId: string, limit: number, period: string): Promise<any[]> {
  // Simulated historical data
  const matches = [];
  const days = period === '7days' ? 7 : period === '30days' ? 30 : 90;
  
  for (let i = 0; i < Math.min(limit, 10); i++) {
    matches.push({
      jobId: `job-${i}`,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      overallScore: Math.random() * 0.4 + 0.5,
      applied: Math.random() > 0.5,
      outcome: Math.random() > 0.7 ? 'interview' : 'pending'
    });
  }

  return matches;
}

function analyzeMatchTrends(matches: any[]): any {
  const recentMatches = matches.slice(0, 5);
  const olderMatches = matches.slice(5);

  const recentAvg = recentMatches.reduce((sum, m) => sum + m.overallScore, 0) / recentMatches.length;
  const olderAvg = olderMatches.length > 0 ? 
    olderMatches.reduce((sum, m) => sum + m.overallScore, 0) / olderMatches.length : 
    recentAvg;

  return {
    trend: recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable',
    improvementRate: ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1) + '%',
    recentAverage: recentAvg,
    historicalAverage: olderAvg
  };
}

function generateHistoricalInsights(matches: any[], trends: any): string[] {
  const insights = [];

  if (trends.trend === 'improving') {
    insights.push('Your match scores are improving over time');
  }

  const applicationRate = matches.filter(m => m.applied).length / matches.length;
  if (applicationRate < 0.5) {
    insights.push('Consider applying to more positions where you have >70% match');
  }

  const successfulMatches = matches.filter(m => m.outcome === 'interview');
  if (successfulMatches.length > 0) {
    const avgSuccessScore = successfulMatches.reduce((sum, m) => sum + m.overallScore, 0) / successfulMatches.length;
    insights.push(`Your successful applications averaged ${(avgSuccessScore * 100).toFixed(0)}% match score`);
  }

  return insights;
}

function calculateAverageScore(matches: any[]): number {
  if (matches.length === 0) return 0;
  return matches.reduce((sum, m) => sum + (m.overallScore || m.score || 0), 0) / matches.length;
}

// Additional helper functions for comprehensive reasoning

function generateOverallAssessment(match: any): string {
  const level = match.overallScore > 0.8 ? 'Excellent' :
                match.overallScore > 0.65 ? 'Good' :
                match.overallScore > 0.5 ? 'Fair' : 'Developing';
                
  return `${level} match with strong potential in ${getTopStrength(match)} and opportunities for growth in ${match.gaps?.[0] || 'some areas'}.`;
}

function getTopStrength(match: any): string {
  const components = [
    { name: 'technical skills', score: match.skillsScore },
    { name: 'experience', score: match.experienceScore },
    { name: 'personality fit', score: match.personalityScore },
    { name: 'cultural alignment', score: match.culturalFitScore }
  ];

  const topComponent = components.reduce((top, current) => 
    current.score > top.score ? current : top
  );

  return topComponent.name;
}

function analyzeSkillsReasoning(match: any): any {
  return {
    assessment: match.skillsScore > 0.7 ? 'Strong technical alignment' : 'Skills development needed',
    details: `Matching ${(match.skillsScore * 100).toFixed(0)}% of required technical competencies`,
    evidence: match.matchDetails?.matchingSkills || [],
    recommendation: match.skillsScore < 0.7 ? 'Focus on acquiring missing technical skills' : 'Highlight technical expertise'
  };
}

function analyzeExperienceReasoning(match: any): any {
  return {
    assessment: match.experienceScore > 0.7 ? 'Relevant experience demonstrated' : 'Experience gap identified',
    details: `Experience level aligns ${(match.experienceScore * 100).toFixed(0)}% with requirements`,
    evidence: match.matchDetails?.experienceAnalysis || 'Based on years and relevance',
    recommendation: match.experienceScore < 0.6 ? 'Emphasize transferable experience' : 'Showcase relevant achievements'
  };
}

function analyzePersonalityReasoning(match: any): any {
  return {
    assessment: match.personalityScore > 0.75 ? 'Strong personality-role fit' : 'Moderate personality alignment',
    details: match.personalityInsights || {},
    evidence: 'Based on communication style and work preferences',
    recommendation: 'Align your application tone with company culture'
  };
}

function analyzeCultureReasoning(match: any): any {
  return {
    assessment: match.culturalFitScore > 0.7 ? 'Good cultural alignment' : 'Cultural fit needs exploration',
    details: `Cultural compatibility score: ${(match.culturalFitScore * 100).toFixed(0)}%`,
    evidence: 'Based on values and work style preferences',
    recommendation: 'Research company culture thoroughly before applying'
  };
}

function synthesizeReasoning(match: any): string {
  const strengths = [];
  const weaknesses = [];

  if (match.skillsScore > 0.7) strengths.push('technical skills');
  else weaknesses.push('technical skills');

  if (match.experienceScore > 0.7) strengths.push('experience');
  else if (match.experienceScore < 0.5) weaknesses.push('experience');

  if (match.personalityScore > 0.75) strengths.push('personality fit');

  return `Your profile shows strength in ${strengths.join(', ') || 'several areas'} ${
    weaknesses.length > 0 ? `with development opportunities in ${weaknesses.join(', ')}` : ''
  }. ${match.overallScore > 0.7 ? 'This combination makes you a competitive candidate.' : 'Consider addressing gaps before applying.'}`;
}

function analyzeUserBackground(user: any): any {
  return {
    experienceLevel: user.userProfile?.yearsOfExperience || 0,
    industries: user.userProfile?.industries || [],
    skills: user.skills || [],
    education: user.userProfile?.education || []
  };
}

function analyzeJobRequirements(job: any): any {
  return {
    requiredSkills: job.requiredSkills || [],
    preferredSkills: job.preferredSkills || [],
    experienceRequired: `${job.yearsExperienceMin || 0}-${job.yearsExperienceMax || 10} years`,
    educationRequired: job.education || 'Not specified',
    industry: job.company?.industry || 'Not specified'
  };
}

async function analyzeMarketContext(job: any): Promise<any> {
  // Simulated market analysis
  return {
    demandLevel: 'High',
    competitionLevel: 'Moderate',
    salaryBenchmark: 'Competitive',
    growthPotential: 'Strong'
  };
}

async function generateComparativeAnalysis(match: any, job: any): Promise<any> {
  return {
    vsAverageCandidate: {
      yourScore: match.overallScore,
      averageScore: 0.65,
      percentile: match.overallScore > 0.65 ? '75th' : '50th'
    },
    vsIdealCandidate: {
      yourScore: match.overallScore,
      idealScore: 0.95,
      gap: 0.95 - match.overallScore
    }
  };
}

function projectFutureSuccess(match: any, user: any, job: any): any {
  const successProbability = match.overallScore * 0.8 + 0.1; // Baseline 10%
  
  return {
    applicationSuccess: successProbability,
    interviewProbability: successProbability * 0.7,
    offerProbability: successProbability * 0.4,
    longTermSuccess: match.culturalFitScore > 0.7 ? 'High' : 'Moderate',
    careerImpact: 'Positive progression likely'
  };
}

function generateGapSolution(area: string, score: number): string {
  const solutions = {
    'Technical Skills': 'Take online courses or certifications in missing technologies',
    'Experience': 'Highlight transferable skills and consider freelance projects',
    'Soft Skills': 'Practice through mock interviews and seek feedback'
  };
  
  return solutions[area] || `Improve ${area.toLowerCase()} through targeted development`;
}

export { router as matchExplanationRoutes };
