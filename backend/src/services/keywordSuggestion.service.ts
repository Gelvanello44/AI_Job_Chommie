import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import aiService from './ai.service';
import industryLanguageService from './industry-language.service';

const prisma = new PrismaClient();

// Keyword Suggestion Schema
const KeywordSuggestionSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  cvId: z.string(),
  jobId: z.string().optional(),
  suggestions: z.array(z.object({
    id: z.string(),
    type: z.enum(['add', 'replace', 'remove']),
    keyword: z.string(),
    context: z.string(), // Where in CV this applies
    originalText: z.string().optional(), // For replace/remove
    replacementText: z.string().optional(), // For replace
    reason: z.string(),
    impact: z.enum(['low', 'medium', 'high']),
    category: z.enum(['technical', 'soft_skill', 'achievement', 'industry', 'action_verb']),
    accepted: z.boolean().default(false),
    rejected: z.boolean().default(false)
  })),
  diffView: z.object({
    original: z.string(),
    suggested: z.string(),
    changes: z.array(z.object({
      type: z.enum(['addition', 'deletion', 'modification']),
      lineNumber: z.number(),
      originalLine: z.string().optional(),
      newLine: z.string().optional()
    }))
  }),
  stats: z.object({
    totalSuggestions: z.number(),
    acceptedCount: z.number(),
    rejectedCount: z.number(),
    pendingCount: z.number(),
    atsScoreImprovement: z.number() // Estimated improvement
  })
});

type KeywordSuggestion = z.infer<typeof KeywordSuggestionSchema>;

export class KeywordSuggestionService {
  /**
   * Generate keyword suggestions for a CV based on job posting
   */
  async generateSuggestions(cvId: string, jobId: string, userId: string): Promise<KeywordSuggestion> {
    try {
      // Fetch CV and job details
      const [cv, job] = await Promise.all([
        prisma.cv.findUnique({ where: { id: cvId } }),
        prisma.job.findUnique({ where: { id: jobId } })
      ]);

      if (!cv || !job) {
        throw new Error('CV or Job not found');
      }

      // Extract keywords from job posting
      const jobKeywords = await this.extractJobKeywords(job);
      
      // Analyze CV content
      const cvAnalysis = await this.analyzeCVContent(cv);
      
      // Generate suggestions
      const suggestions = await this.generateKeywordSuggestions(
        cvAnalysis,
        jobKeywords,
        job
      );

      // Create diff view
      const diffView = this.createDiffView(cv, suggestions);

      // Calculate statistics
      const stats = {
        totalSuggestions: suggestions.length,
        acceptedCount: 0,
        rejectedCount: 0,
        pendingCount: suggestions.length,
        atsScoreImprovement: this.estimateATSImprovement(suggestions)
      };

      // Save suggestions
      const suggestionRecord = await prisma.keywordSuggestion.create({
        data: {
          userId,
          cvId,
          jobId,
          suggestions: JSON.stringify(suggestions),
          diffView: JSON.stringify(diffView),
          stats: JSON.stringify(stats),
          status: 'pending'
        }
      });

      return this.formatSuggestion(suggestionRecord);
    } catch (error) {
      console.error('Error generating keyword suggestions:', error);
      throw new Error('Failed to generate keyword suggestions');
    }
  }

  /**
   * Extract keywords from job posting
   */
  private async extractJobKeywords(job: any): Promise<any> {
    const description = `${job.title} ${job.description} ${job.requirements || ''}`;
    
    // Get industry-specific keywords
    const industryKeywords = await industryLanguageService.getIndustryKeywords(
      job.industry || 'general'
    );

    // Use AI to extract key requirements
    const prompt = `Extract key skills, technologies, and requirements from this job posting:
      ${description}
      
      Return a JSON object with:
      {
        "technical_skills": ["skill1", "skill2"],
        "soft_skills": ["skill1", "skill2"],
        "certifications": ["cert1", "cert2"],
        "experience_keywords": ["keyword1", "keyword2"],
        "action_verbs": ["verb1", "verb2"]
      }`;

    const aiResponse = await aiService.generateText(prompt);
    const extractedKeywords = JSON.parse(aiResponse);

    return {
      ...extractedKeywords,
      industry: industryKeywords
    };
  }

  /**
   * Analyze CV content
   */
  private async analyzeCVContent(cv: any): Promise<any> {
    const sections = {
      summary: cv.summary || '',
      experience: cv.experience || [],
      skills: cv.skills || [],
      education: cv.education || [],
      achievements: cv.achievements || []
    };

    // Extract current keywords
    const currentKeywords = new Set<string>();
    
    // Parse all text content
    const allText = [
      sections.summary,
      ...sections.experience.map((exp: any) => exp.description),
      ...sections.skills,
      ...sections.achievements
    ].join(' ').toLowerCase();

    // Simple keyword extraction (in production, use NLP library)
    const words = allText.split(/\s+/);
    words.forEach(word => {
      if (word.length > 3) currentKeywords.add(word);
    });

    return {
      sections,
      currentKeywords: Array.from(currentKeywords),
      structure: this.analyzeCVStructure(cv)
    };
  }

  /**
   * Generate keyword suggestions
   */
  private async generateKeywordSuggestions(
    cvAnalysis: any,
    jobKeywords: any,
    job: any
  ): Promise<any[]> {
    const suggestions = [];
    const suggestionId = (type: string, index: number) => `${type}_${index}`;

    // Technical skills suggestions
    jobKeywords.technical_skills.forEach((skill: string, index: number) => {
      if (!cvAnalysis.currentKeywords.includes(skill.toLowerCase())) {
        suggestions.push({
          id: suggestionId('tech', index),
          type: 'add',
          keyword: skill,
          context: 'skills',
          reason: `This technical skill is mentioned in the job posting but missing from your CV`,
          impact: 'high',
          category: 'technical',
          accepted: false,
          rejected: false
        });
      }
    });

    // Action verbs for experience
    const weakVerbs = ['responsible for', 'helped', 'worked on', 'assisted'];
    cvAnalysis.sections.experience.forEach((exp: any, expIndex: number) => {
      weakVerbs.forEach((weak, index) => {
        if (exp.description.toLowerCase().includes(weak)) {
          const strongVerb = jobKeywords.action_verbs[index] || 'Led';
          suggestions.push({
            id: suggestionId(`verb_${expIndex}`, index),
            type: 'replace',
            keyword: strongVerb,
            context: `experience_${expIndex}`,
            originalText: weak,
            replacementText: strongVerb.toLowerCase(),
            reason: `Replace weak verb "${weak}" with stronger action verb`,
            impact: 'medium',
            category: 'action_verb',
            accepted: false,
            rejected: false
          });
        }
      });
    });

    // Industry-specific keywords
    jobKeywords.industry.forEach((keyword: string, index: number) => {
      if (!cvAnalysis.currentKeywords.includes(keyword.toLowerCase())) {
        suggestions.push({
          id: suggestionId('industry', index),
          type: 'add',
          keyword: keyword,
          context: 'summary',
          reason: `Industry-specific term that demonstrates domain knowledge`,
          impact: 'medium',
          category: 'industry',
          accepted: false,
          rejected: false
        });
      }
    });

    // Achievement quantification
    const needsQuantification = /increased|improved|reduced|saved|generated/i;
    cvAnalysis.sections.experience.forEach((exp: any, index: number) => {
      if (needsQuantification.test(exp.description) && !/\d+%|\$\d+|\d+/.test(exp.description)) {
        suggestions.push({
          id: suggestionId('quant', index),
          type: 'modify',
          keyword: 'quantification',
          context: `experience_${index}`,
          originalText: exp.description,
          reason: 'Add specific numbers or percentages to quantify this achievement',
          impact: 'high',
          category: 'achievement',
          accepted: false,
          rejected: false
        });
      }
    });

    return suggestions;
  }

  /**
   * Create diff view
   */
  private createDiffView(cv: any, suggestions: any[]): any {
    const original = this.cvToText(cv);
    let suggested = original;
    const changes: any[] = [];

    // Apply accepted suggestions to create suggested version
    suggestions.forEach(suggestion => {
      if (suggestion.type === 'replace' && suggestion.originalText && suggestion.replacementText) {
        suggested = suggested.replace(
          new RegExp(suggestion.originalText, 'gi'),
          suggestion.replacementText
        );
      } else if (suggestion.type === 'add' && suggestion.context === 'skills') {
        // Add to skills section
        const skillsMatch = suggested.match(/Skills:(.*?)(\n\n|$)/s);
        if (skillsMatch) {
          const newSkills = skillsMatch[1] + ', ' + suggestion.keyword;
          suggested = suggested.replace(skillsMatch[0], `Skills:${newSkills}\n\n`);
        }
      }
    });

    // Generate line-by-line diff
    const originalLines = original.split('\n');
    const suggestedLines = suggested.split('\n');

    originalLines.forEach((line, index) => {
      if (line !== suggestedLines[index]) {
        changes.push({
          type: 'modification',
          lineNumber: index + 1,
          originalLine: line,
          newLine: suggestedLines[index]
        });
      }
    });

    return {
      original,
      suggested,
      changes
    };
  }

  /**
   * Apply accepted suggestions
   */
  async applySuggestions(
    suggestionId: string,
    acceptedIds: string[],
    rejectedIds: string[]
  ): Promise<any> {
    try {
      const suggestionRecord = await prisma.keywordSuggestion.findUnique({
        where: { id: suggestionId }
      });

      if (!suggestionRecord) {
        throw new Error('Suggestion record not found');
      }

      const suggestions = JSON.parse(suggestionRecord.suggestions as string);
      
      // Update suggestion status
      suggestions.forEach((suggestion: any) => {
        if (acceptedIds.includes(suggestion.id)) {
          suggestion.accepted = true;
          suggestion.rejected = false;
        } else if (rejectedIds.includes(suggestion.id)) {
          suggestion.accepted = false;
          suggestion.rejected = true;
        }
      });

      // Apply accepted suggestions to CV
      const acceptedSuggestions = suggestions.filter((s: any) => s.accepted);
      const cv = await prisma.cv.findUnique({
        where: { id: suggestionRecord.cvId }
      });

      if (cv) {
        const updatedCV = await this.applyChangesToCV(cv, acceptedSuggestions);
        
        // Save updated CV
        await prisma.cv.update({
          where: { id: cv.id },
          data: updatedCV
        });
      }

      // Update statistics
      const stats = {
        totalSuggestions: suggestions.length,
        acceptedCount: acceptedIds.length,
        rejectedCount: rejectedIds.length,
        pendingCount: suggestions.length - acceptedIds.length - rejectedIds.length,
        atsScoreImprovement: this.estimateATSImprovement(
          suggestions.filter((s: any) => s.accepted)
        )
      };

      // Save updated suggestions
      await prisma.keywordSuggestion.update({
        where: { id: suggestionId },
        data: {
          suggestions: JSON.stringify(suggestions),
          stats: JSON.stringify(stats),
          status: 'processed'
        }
      });

      return {
        success: true,
        appliedCount: acceptedIds.length,
        atsScoreImprovement: stats.atsScoreImprovement
      };
    } catch (error) {
      console.error('Error applying suggestions:', error);
      throw new Error('Failed to apply suggestions');
    }
  }

  /**
   * Get suggestion history
   */
  async getSuggestionHistory(userId: string): Promise<any[]> {
    try {
      const suggestions = await prisma.keywordSuggestion.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          cv: true,
          job: true
        }
      });

      return suggestions.map(this.formatSuggestion);
    } catch (error) {
      console.error('Error getting suggestion history:', error);
      throw new Error('Failed to get suggestion history');
    }
  }

  /**
   * Apply changes to CV
   */
  private async applyChangesToCV(cv: any, acceptedSuggestions: any[]): Promise<any> {
    const updates: any = {};

    acceptedSuggestions.forEach(suggestion => {
      switch (suggestion.context) {
        case 'skills':
          if (suggestion.type === 'add') {
            updates.skills = [...(cv.skills || []), suggestion.keyword];
          }
          break;
        
        case 'summary':
          if (suggestion.type === 'add') {
            updates.summary = `${cv.summary} ${suggestion.keyword}`;
          } else if (suggestion.type === 'replace') {
            updates.summary = cv.summary.replace(
              suggestion.originalText,
              suggestion.replacementText
            );
          }
          break;
        
        default:
          // Handle experience updates
          if (suggestion.context.startsWith('experience_')) {
            const expIndex = parseInt(suggestion.context.split('_')[1]);
            const experience = [...cv.experience];
            
            if (suggestion.type === 'replace' && experience[expIndex]) {
              experience[expIndex].description = experience[expIndex].description.replace(
                new RegExp(suggestion.originalText, 'gi'),
                suggestion.replacementText
              );
              updates.experience = experience;
            }
          }
      }
    });

    return updates;
  }

  /**
   * Convert CV to text format
   */
  private cvToText(cv: any): string {
    let text = '';
    
    if (cv.summary) {
      text += `Summary:\n${cv.summary}\n\n`;
    }
    
    if (cv.experience?.length > 0) {
      text += 'Experience:\n';
      cv.experience.forEach((exp: any) => {
        text += `${exp.title} at ${exp.company}\n`;
        text += `${exp.description}\n\n`;
      });
    }
    
    if (cv.skills?.length > 0) {
      text += `Skills: ${cv.skills.join(', ')}\n\n`;
    }
    
    return text;
  }

  /**
   * Analyze CV structure
   */
  private analyzeCVStructure(cv: any): any {
    return {
      hasSummary: !!cv.summary,
      experienceCount: cv.experience?.length || 0,
      skillsCount: cv.skills?.length || 0,
      hasEducation: !!cv.education?.length,
      hasAchievements: !!cv.achievements?.length
    };
  }

  /**
   * Estimate ATS improvement
   */
  private estimateATSImprovement(acceptedSuggestions: any[]): number {
    let improvement = 0;
    
    acceptedSuggestions.forEach(suggestion => {
      switch (suggestion.impact) {
        case 'high':
          improvement += 5;
          break;
        case 'medium':
          improvement += 3;
          break;
        case 'low':
          improvement += 1;
          break;
      }
    });
    
    return Math.min(improvement, 30); // Cap at 30% improvement
  }

  /**
   * Format suggestion record
   */
  private formatSuggestion(record: any): KeywordSuggestion {
    return {
      ...record,
      suggestions: JSON.parse(record.suggestions),
      diffView: JSON.parse(record.diffView),
      stats: JSON.parse(record.stats)
    };
  }

  /**
   * Get real-time preview
   */
  async getPreview(cvId: string, acceptedSuggestionIds: string[]): Promise<any> {
    try {
      const cv = await prisma.cv.findUnique({ where: { id: cvId } });
      if (!cv) throw new Error('CV not found');

      // Get current suggestions
      const suggestionRecord = await prisma.keywordSuggestion.findFirst({
        where: { cvId },
        orderBy: { createdAt: 'desc' }
      });

      if (!suggestionRecord) {
        return { preview: this.cvToText(cv), changes: [] };
      }

      const suggestions = JSON.parse(suggestionRecord.suggestions as string);
      const acceptedSuggestions = suggestions.filter((s: any) => 
        acceptedSuggestionIds.includes(s.id)
      );

      // Apply changes temporarily
      const tempUpdates = await this.applyChangesToCV(cv, acceptedSuggestions);
      const updatedCV = { ...cv, ...tempUpdates };

      return {
        preview: this.cvToText(updatedCV),
        changes: acceptedSuggestions.map((s: any) => ({
          type: s.type,
          description: s.reason,
          impact: s.impact
        })),
        estimatedImprovement: this.estimateATSImprovement(acceptedSuggestions)
      };
    } catch (error) {
      console.error('Error generating preview:', error);
      throw new Error('Failed to generate preview');
    }
  }
}

export default new KeywordSuggestionService();
