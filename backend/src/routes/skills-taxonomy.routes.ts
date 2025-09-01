import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { AIMatchingService } from '../services/ai-matching.service.js';
import { expandSkills, normalizeSkill, SKILLS_TAXONOMY } from '../data/skills_taxonomy.js';
import logger from '../config/logger.js';
import { body, param, query } from 'express-validator';
import { prisma } from '../config/database.js';

const router = Router();

// Initialize services
const aiMatchingService = new AIMatchingService();

// Apply authentication to all routes
router.use(authenticate);

/**
 *  Get Hierarchical Skills Taxonomy
 * GET /api/skills-taxonomy/hierarchy
 */
router.get('/hierarchy',
  query('category').isString().optional(),
  async (req: Request, res: Response) => {
    try {
      const { category } = req.query;
      
      logger.info(' Getting skills hierarchy', { category });

      // Build hierarchical structure
      const hierarchy: Record<string, any> = {};
      
      // Group skills by parent categories
      for (const [skill, parents] of Object.entries(SKILLS_TAXONOMY.parents)) {
        for (const parent of parents) {
          if (!hierarchy[parent]) {
            hierarchy[parent] = {
              category: parent,
              skills: [],
              subcategories: {}
            };
          }
          hierarchy[parent].skills.push(skill);
        }
      }

      // Add synonyms information
      const synonymsMap: Record<string, string[]> = {};
      for (const [canonical, synonyms] of Object.entries(SKILLS_TAXONOMY.synonyms)) {
        synonymsMap[canonical] = synonyms;
      }

      // Filter by category if specified
      let result = category && typeof category === 'string' 
        ? { [category]: hierarchy[category] || { category, skills: [], subcategories: {} } }
        : hierarchy;

      res.json({
        success: true,
        data: {
          hierarchy: result,
          synonyms: synonymsMap,
          totalCategories: Object.keys(hierarchy).length,
          totalSkills: Object.keys(SKILLS_TAXONOMY.synonyms).length + Object.keys(SKILLS_TAXONOMY.parents).length
        }
      });

    } catch (error) {
      logger.error('Error getting skills hierarchy', { error });
      throw new AppError(500, 'Failed to get skills hierarchy');
    }
  }
);

/**
 *  Expand Skills with Taxonomy
 * POST /api/skills-taxonomy/expand
 */
router.post('/expand',
  body('skills').isArray().notEmpty().withMessage('Skills array required'),
  async (req: Request, res: Response) => {
    try {
      const { skills } = req.body;
      
      logger.info(' Expanding skills with taxonomy', { skillCount: skills.length });

      // Expand skills using taxonomy
      const expandedSkillsSet = expandSkills(skills);
      const expandedSkills = Array.from(expandedSkillsSet);

      // Categorize expanded skills
      const categorizedSkills: Record<string, string[]> = {
        original: skills,
        expanded: expandedSkills.filter(s => !skills.includes(s)),
        normalized: skills.map(s => normalizeSkill(s)),
        categories: []
      };

      // Find categories for skills
      const categories = new Set<string>();
      for (const skill of expandedSkills) {
        const parents = SKILLS_TAXONOMY.parents[skill.toLowerCase()];
        if (parents) {
          parents.forEach(p => categories.add(p));
        }
      }
      categorizedSkills.categories = Array.from(categories);

      res.json({
        success: true,
        data: {
          originalCount: skills.length,
          expandedCount: expandedSkills.length,
          expansionRate: (expandedSkills.length / skills.length).toFixed(2),
          skills: categorizedSkills,
          relatedSkills: expandedSkills
        }
      });

    } catch (error) {
      logger.error('Error expanding skills', { error });
      throw new AppError(500, 'Failed to expand skills');
    }
  }
);

/**
 *  Analyze Skills Gap
 * POST /api/skills-taxonomy/gap-analysis
 */
router.post('/gap-analysis',
  body('userSkills').isArray().withMessage('User skills array required'),
  body('requiredSkills').isArray().withMessage('Required skills array required'),
  body('preferredSkills').isArray().optional(),
  async (req: Request, res: Response) => {
    try {
      const { userSkills, requiredSkills, preferredSkills = [] } = req.body;
      const userId = req.user?.id;
      
      logger.info(' Analyzing skills gap', { userId, userSkillCount: userSkills.length });

      // Expand all skill sets
      const userSkillsExpanded = expandSkills(userSkills);
      const requiredSkillsExpanded = expandSkills(requiredSkills);
      const preferredSkillsExpanded = expandSkills(preferredSkills);

      // Calculate gaps
      const missingRequired = Array.from(requiredSkillsExpanded).filter(
        skill => !userSkillsExpanded.has(skill)
      );
      const missingPreferred = Array.from(preferredSkillsExpanded).filter(
        skill => !userSkillsExpanded.has(skill)
      );

      // Calculate match percentages
      const requiredMatch = requiredSkillsExpanded.size > 0 
        ? ((requiredSkillsExpanded.size - missingRequired.length) / requiredSkillsExpanded.size) * 100
        : 100;
      const preferredMatch = preferredSkillsExpanded.size > 0
        ? ((preferredSkillsExpanded.size - missingPreferred.length) / preferredSkillsExpanded.size) * 100
        : 100;

      // Group missing skills by category
      const gapsByCategory: Record<string, string[]> = {};
      for (const skill of missingRequired) {
        const parents = SKILLS_TAXONOMY.parents[skill.toLowerCase()] || ['uncategorized'];
        for (const parent of parents) {
          if (!gapsByCategory[parent]) {
            gapsByCategory[parent] = [];
          }
          gapsByCategory[parent].push(skill);
        }
      }

      // Generate learning recommendations
      const recommendations = await aiMatchingService.generateSkillsRecommendations(
        Array.from(userSkillsExpanded),
        missingRequired,
        missingPreferred
      );

      res.json({
        success: true,
        data: {
          analysis: {
            userSkillCount: userSkills.length,
            expandedUserSkillCount: userSkillsExpanded.size,
            requiredSkillCount: requiredSkills.length,
            expandedRequiredSkillCount: requiredSkillsExpanded.size,
            matchPercentage: {
              required: requiredMatch.toFixed(1),
              preferred: preferredMatch.toFixed(1),
              overall: ((requiredMatch * 0.7 + preferredMatch * 0.3)).toFixed(1)
            }
          },
          gaps: {
            missingRequired,
            missingPreferred,
            byCategory: gapsByCategory,
            criticalGaps: missingRequired.slice(0, 5)
          },
          recommendations,
          strengths: Array.from(userSkillsExpanded).filter(
            skill => requiredSkillsExpanded.has(skill) || preferredSkillsExpanded.has(skill)
          )
        }
      });

    } catch (error) {
      logger.error('Error in gap analysis', { error });
      throw new AppError(500, 'Failed to analyze skills gap');
    }
  }
);

/**
 *  Match Skills Hierarchically
 * POST /api/skills-taxonomy/hierarchical-match
 */
router.post('/hierarchical-match',
  body('userSkills').isArray().withMessage('User skills required'),
  body('jobId').isUUID().optional(),
  body('jobSkills').isObject().optional(),
  async (req: Request, res: Response) => {
    try {
      const { userSkills, jobId, jobSkills } = req.body;
      
      logger.info(' Performing hierarchical skills matching', { userSkillCount: userSkills.length, jobId });

      let targetSkills = jobSkills;
      
      // Get job skills if jobId provided
      if (jobId && !jobSkills) {
        const job = await prisma.job.findUnique({
          where: { id: jobId },
          select: {
            requiredSkills: true,
            preferredSkills: true,
            title: true
          }
        });
        
        if (!job) {
          throw new AppError(404, 'Job not found');
        }
        
        targetSkills = {
          required: job.requiredSkills,
          preferred: job.preferredSkills,
          jobTitle: job.title
        };
      }

      if (!targetSkills || !targetSkills.required) {
        throw new AppError(400, 'Job skills information required');
      }

      // Perform hierarchical matching
      const userExpanded = expandSkills(userSkills);
      const requiredExpanded = expandSkills(targetSkills.required);
      const preferredExpanded = expandSkills(targetSkills.preferred || []);

      // Calculate matches at different levels
      const exactMatches = userSkills.filter(skill => 
        targetSkills.required.includes(skill) || targetSkills.preferred?.includes(skill)
      );
      
      const synonymMatches: string[] = [];
      const parentMatches: string[] = [];
      
      // Check for synonym and parent matches
      for (const userSkill of userExpanded) {
        // Check if it's a synonym match
        for (const [canonical, synonyms] of Object.entries(SKILLS_TAXONOMY.synonyms)) {
          if (synonyms.includes(userSkill) && requiredExpanded.has(canonical)) {
            synonymMatches.push(`${userSkill} → ${canonical}`);
          }
        }
        
        // Check for parent category matches
        const parents = SKILLS_TAXONOMY.parents[userSkill.toLowerCase()];
        if (parents) {
          for (const parent of parents) {
            if (requiredExpanded.has(parent) || preferredExpanded.has(parent)) {
              parentMatches.push(`${userSkill} → ${parent}`);
            }
          }
        }
      }

      // Calculate hierarchical score
      const totalRequired = requiredExpanded.size;
      const exactScore = exactMatches.length / Math.max(targetSkills.required.length, 1);
      const synonymScore = synonymMatches.length / Math.max(totalRequired, 1);
      const parentScore = parentMatches.length / Math.max(totalRequired, 1);
      
      const hierarchicalScore = (exactScore * 0.6) + (synonymScore * 0.25) + (parentScore * 0.15);

      res.json({
        success: true,
        data: {
          jobInfo: {
            jobId,
            jobTitle: targetSkills.jobTitle
          },
          matches: {
            exact: exactMatches,
            synonyms: synonymMatches,
            parentCategories: parentMatches,
            totalMatches: exactMatches.length + synonymMatches.length + parentMatches.length
          },
          scores: {
            exact: exactScore.toFixed(2),
            synonym: synonymScore.toFixed(2),
            parent: parentScore.toFixed(2),
            hierarchical: hierarchicalScore.toFixed(2)
          },
          recommendation: hierarchicalScore > 0.7 ? 'Strong Match' : 
                         hierarchicalScore > 0.5 ? 'Good Match' : 
                         hierarchicalScore > 0.3 ? 'Fair Match' : 'Weak Match'
        }
      });

    } catch (error) {
      logger.error('Error in hierarchical matching', { error });
      throw new AppError(500, 'Hierarchical matching failed');
    }
  }
);

/**
 *  Normalize Skills
 * POST /api/skills-taxonomy/normalize
 */
router.post('/normalize',
  body('skills').isArray().notEmpty().withMessage('Skills array required'),
  async (req: Request, res: Response) => {
    try {
      const { skills } = req.body;
      
      logger.info(' Normalizing skills', { count: skills.length });

      const normalized = skills.map(skill => ({
        original: skill,
        normalized: normalizeSkill(skill),
        isCanonical: normalizeSkill(skill) === skill.toLowerCase()
      }));

      const stats = {
        totalSkills: skills.length,
        changedSkills: normalized.filter(s => s.original !== s.normalized).length,
        canonicalSkills: normalized.filter(s => s.isCanonical).length
      };

      res.json({
        success: true,
        data: {
          skills: normalized,
          statistics: stats,
          normalizationRate: (stats.changedSkills / stats.totalSkills * 100).toFixed(1) + '%'
        }
      });

    } catch (error) {
      logger.error('Error normalizing skills', { error });
      throw new AppError(500, 'Failed to normalize skills');
    }
  }
);

/**
 *  Get Skills Recommendations
 * GET /api/skills-taxonomy/recommendations/:userId
 */
router.get('/recommendations/:userId',
  param('userId').isUUID().optional(),
  query('industry').isString().optional(),
  query('role').isString().optional(),
  async (req: Request, res: Response) => {
    try {
      const targetUserId = req.params.userId || req.user?.id;
      const { industry, role } = req.query;
      
      if (!targetUserId) {
        throw new AppError(401, 'User authentication required');
      }

      logger.info(' Getting skills recommendations', { targetUserId, industry, role });

      // Get user's current skills
      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          skills: true,
          desiredJobTitles: true,
          industries: true
        }
      });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      const targetIndustry = (industry as string) || user.industries?.[0];
      const targetRole = (role as string) || user.desiredJobTitles?.[0];

      // Get trending skills for the industry/role
      const trendingSkills = await aiMatchingService.getTrendingSkills(
        targetIndustry,
        targetRole
      );

      // Get complementary skills based on current skills
      const currentSkillsExpanded = expandSkills(user.skills || []);
      const complementarySkills = await aiMatchingService.getComplementarySkills(
        Array.from(currentSkillsExpanded)
      );

      // Filter out skills user already has
      const recommendations = {
        trending: trendingSkills.filter(s => !currentSkillsExpanded.has(normalizeSkill(s.skill))),
        complementary: complementarySkills.filter(s => !currentSkillsExpanded.has(normalizeSkill(s.skill))),
        nextLevel: [] as any[] // Skills that build on current skills
      };

      // Find next-level skills (advanced versions of current skills)
      for (const skill of user.skills || []) {
        const advanced = await aiMatchingService.getAdvancedSkills(skill);
        recommendations.nextLevel.push(...advanced.filter(s => !currentSkillsExpanded.has(normalizeSkill(s))));
      }

      res.json({
        success: true,
        data: {
          currentSkills: user.skills || [],
          recommendations,
          focusArea: {
            industry: targetIndustry,
            role: targetRole
          },
          summary: {
            trendingCount: recommendations.trending.length,
            complementaryCount: recommendations.complementary.length,
            nextLevelCount: recommendations.nextLevel.length
          }
        }
      });

    } catch (error) {
      logger.error('Error getting skill recommendations', { error });
      throw new AppError(500, 'Failed to get skill recommendations');
    }
  }
);

export { router as skillsTaxonomyRoutes };
