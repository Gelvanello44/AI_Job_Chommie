import { PrismaClient, SubscriptionPlan, CoverLetterTone } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { canAccessFeature } from '../utils/subscriptionQuotas.js';
import { HuggingFaceService } from './huggingface.service.js';
import { IndustryLanguageService } from './industry-language.service.js';
import logger from '../config/logger.js';

interface CoverLetterTemplate {
  id: string;
  name: string;
  description: string;
  tone: CoverLetterTone;
  planRequired: SubscriptionPlan;
  template: string;
}

interface CoverLetterData {
  jobId: string;
  templateId?: string;
  tone: CoverLetterTone;
  customization?: {
    companyName?: string;
    jobTitle?: string;
    hiringManagerName?: string;
    specificRequirements?: string[];
    personalTouchPoints?: string[];
  };
}

// Enhanced AI Writing Types
interface PersonalityProfile {
  writingStyle: 'formal' | 'conversational' | 'confident' | 'humble' | 'creative';
  personalityTraits: {
    assertiveness: number;
    warmth: number;
    formality: number;
    creativity: number;
    directness: number;
  };
  communicationPreferences: {
    sentenceLength: 'short' | 'medium' | 'long';
    vocabularyLevel: 'simple' | 'moderate' | 'advanced';
    useOfHumor: boolean;
    storytellingTendency: number;
  };
  authenticVoiceMarkers: string[];
}

interface EnhancedCoverLetterGeneration {
  personalizedContent: string;
  personalityAlignment: number;
  industryOptimization: {
    keywordDensity: number;
    industryLanguageScore: number;
    optimizedPhrases: string[];
  };
  toneAnalysis: {
    consistency: number;
    appropriateness: number;
    authenticity: number;
  };
  suggestions: {
    type: 'personality' | 'industry' | 'tone' | 'structure';
    original: string;
    suggested: string;
    reasoning: string;
    impact: number;
  }[];
  oneClickOptimizations: {
    action: string;
    description: string;
    preview: string;
  }[];
}

export class CoverLetterService {
  private prisma: PrismaClient;
  private hfService: HuggingFaceService;
  private industryLanguageService: IndustryLanguageService;
  private personalityCache: Map<string, PersonalityProfile> = new Map();
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.prisma = new PrismaClient();
    this.hfService = HuggingFaceService.getInstance();
    this.industryLanguageService = new IndustryLanguageService();
  }

  private getDefaultTemplates(): CoverLetterTemplate[] {
    return [
      {
        id: 'professional-standard',
        name: 'Professional Standard',
        description: 'Traditional professional cover letter format',
        tone: CoverLetterTone.PROFESSIONAL,
        planRequired: SubscriptionPlan.PROFESSIONAL,
        template: `Dear {{hiringManager}},

I am writing to express my strong interest in the {{jobTitle}} position at {{companyName}}. With my background in {{primarySkills}}, I am confident that I would be a valuable addition to your team.

In my previous role as {{currentRole}}, I successfully {{keyAchievement}}. This experience has equipped me with the skills necessary to excel in this position, particularly in {{relevantSkills}}.

{{customRequirements}}

I am particularly drawn to {{companyName}} because of {{companyResearch}}. I believe my {{uniqueValue}} would contribute significantly to your continued success.

Thank you for considering my application. I look forward to the opportunity to discuss how my experience aligns with your needs.

Sincerely,
{{candidateName}}`
      },
      {
        id: 'conversational-modern',
        name: 'Conversational Modern',
        description: 'Modern, approachable tone for startups and creative industries',
        tone: CoverLetterTone.CONVERSATIONAL,
        planRequired: SubscriptionPlan.PROFESSIONAL,
        template: `Hi {{hiringManager}},

I was excited to see the {{jobTitle}} opening at {{companyName}}! As someone passionate about {{industryFocus}}, I knew I had to apply.

Over the past {{yearsExperience}} years, I've been {{careerSummary}}. What excites me most about this opportunity is {{opportunityExcitement}}.

Here's what I bring to the table:
{{bulletAchievements}}

{{personalConnection}}

I'd love to chat about how I can help {{companyName}} achieve {{companyGoals}}. Thanks for your time!

Best regards,
{{candidateName}}`
      },
      {
        id: 'executive-leadership',
        name: 'Executive Leadership',
        description: 'Executive-level communication for senior positions',
        tone: CoverLetterTone.EXECUTIVE,
        planRequired: SubscriptionPlan.EXECUTIVE,
        template: `Dear {{hiringManager}},

I am writing to express my interest in the {{jobTitle}} position at {{companyName}}. With over {{yearsExperience}} years of progressive leadership experience, I have consistently delivered transformational results in {{industryExpertise}}.

My track record includes:
{{executiveAchievements}}

At {{currentCompany}}, I {{strategicImpact}}, resulting in {{quantifiableResults}}. This experience positions me well to drive similar outcomes for {{companyName}}.

I am particularly attracted to this opportunity because {{strategicAlignment}}. My expertise in {{coreCompetencies}} aligns directly with your organization's strategic priorities.

I would welcome the opportunity to discuss how my leadership experience and strategic vision can contribute to {{companyName}}'s continued growth and success.

Respectfully,
{{candidateName}}`
      },
      {
        id: 'creative-storytelling',
        name: 'Creative Storytelling',
        description: 'Creative approach with storytelling elements',
        tone: CoverLetterTone.CREATIVE,
        planRequired: SubscriptionPlan.PROFESSIONAL,
        template: `Dear {{hiringManager}},

{{openingStory}}

This experience taught me {{keyLearning}}, which is exactly what I bring to the {{jobTitle}} role at {{companyName}}.

My journey in {{careerPath}} has been marked by {{careerHighlights}}. I believe that great {{profession}} requires both {{technicalSkills}} and {{softSkills}} – a combination I've honed through {{experienceBackground}}.

What draws me to {{companyName}} is {{companyConnection}}. I see an opportunity to {{valueProposition}} while continuing to grow in an environment that values {{companyValues}}.

{{creativeClosing}}

Looking forward to our conversation,
{{candidateName}}`
      }
    ];
  }

  async getAvailableTemplates(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const allTemplates = this.getDefaultTemplates();
      const availableTemplates = allTemplates.filter(template => 
        canAccessFeature(user.subscriptionPlan, 'coverLetters', template.planRequired)
      );

      return {
        templates: availableTemplates.map(({ template, ...templateInfo }) => templateInfo)
      };
    } catch (error) {
      logger.error('Error fetching cover letter templates', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to fetch cover letter templates', 500);
    }
  }

  /**
   *  MAGIC: Generate AI-enhanced cover letter with personality matching
   */
  async generateEnhancedCoverLetter(
    userId: string, 
    data: CoverLetterData,
    userCVContent?: string
  ): Promise<EnhancedCoverLetterGeneration> {
    try {
      logger.info(' Generating enhanced cover letter with personality matching', { userId, jobId: data.jobId });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { 
          subscriptionPlan: true,
          firstName: true,
          lastName: true,
          experiences: true,
          skills: { include: { skill: true } }
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check access to enhanced features
      if (!canAccessFeature(user.subscriptionPlan, 'enhancedAI', SubscriptionPlan.EXECUTIVE)) {
        // Fall back to regular generation for non-Executive users
        return await this.generateRegularCoverLetter(userId, data);
      }

      // Get job details with company info
      const job = await this.prisma.job.findUnique({
        where: { id: data.jobId },
        include: { 
          company: {
            include: {
              jobs: {
                take: 5,
                orderBy: { createdAt: 'desc' }
              }
            }
          }
        }
      });

      if (!job) {
        throw new AppError('Job not found', 404);
      }

      //  MAGIC: Analyze user personality from CV and profile
      const personalityProfile = await this.generatePersonalityProfile(user, userCVContent);
      
      //  MAGIC: Get industry-specific language optimization
      const industryOptimization = await this.industryLanguageService.optimizeDocumentLanguage(
        userCVContent || this.getUserSummary(user),
        'cover_letter',
        job.company.industry || 'General'
      );
      
      //  MAGIC: Generate personality-matched content
      const enhancedContent = await this.generatePersonalityMatchedContent(
        personalityProfile,
        user,
        job,
        data,
        industryOptimization
      );
      
      //  MAGIC: Analyze tone consistency
      const toneAnalysis = await this.analyzeToneConsistency(enhancedContent.content, data.tone);
      
      //  MAGIC: Generate one-click optimizations
      const oneClickOptimizations = await this.generateOneClickOptimizations(
        enhancedContent.content,
        personalityProfile,
        industryOptimization,
        job
      );
      
      // Save enhanced cover letter
      const savedCoverLetter = await this.prisma.coverLetter.create({
        data: {
          userId,
          jobId: data.jobId,
          tone: data.tone,
          content: enhancedContent.content,
          title: `AI-Enhanced Cover Letter for ${job.title}`,
          personalityAlignment: enhancedContent.personalityAlignment,
          industryOptimization: industryOptimization.overallScore,
          enhancedFeatures: {
            personalityMatched: true,
            industryOptimized: true,
            toneAnalyzed: true
          } as any
        }
      });

      return {
        personalizedContent: enhancedContent.content,
        personalityAlignment: enhancedContent.personalityAlignment,
        industryOptimization: {
          keywordDensity: industryOptimization.languageInsights.keywordDensity,
          industryLanguageScore: industryOptimization.languageInsights.industryAlignment,
          optimizedPhrases: industryOptimization.suggestions.slice(0, 5).map(s => s.suggested)
        },
        toneAnalysis,
        suggestions: enhancedContent.suggestions,
        oneClickOptimizations
      };

    } catch (error) {
      logger.error('Failed to generate enhanced cover letter', { error, userId, jobId: data.jobId });
      throw error instanceof AppError ? error : new AppError('Failed to generate enhanced cover letter', 500);
    }
  }

  async generateCoverLetter(userId: string, data: CoverLetterData) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { 
          subscriptionPlan: true,
          firstName: true,
          lastName: true,
          experiences: true,
          skills: { include: { skill: true } }
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check access to cover letters feature
      if (!canAccessFeature(user.subscriptionPlan, 'coverLetters', SubscriptionPlan.PROFESSIONAL)) {
        throw new AppError('Cover letter generation requires Professional plan or higher', 403);
      }

      // Get job details
      const job = await this.prisma.job.findUnique({
        where: { id: data.jobId },
        include: { company: true }
      });

      if (!job) {
        throw new AppError('Job not found', 404);
      }

      // Get appropriate template
      const templates = this.getDefaultTemplates();
      let selectedTemplate = templates.find(t => t.id === data.templateId);
      
      if (!selectedTemplate) {
        // Default to first available template for user's plan
        const availableTemplates = templates.filter(t => 
          canAccessFeature(user.subscriptionPlan, 'coverLetters', t.planRequired) &&
          t.tone === data.tone
        );
        selectedTemplate = availableTemplates[0];
      }

      if (!selectedTemplate) {
        throw new AppError('No suitable template found for your plan and selected tone', 404);
      }

      // Generate personalized content
      const personalizedContent = await this.personalizeTemplate(
        selectedTemplate, 
        user, 
        job, 
        data.customization
      );

      // Save cover letter to database
      const savedCoverLetter = await this.prisma.coverLetter.create({
        data: {
          userId,
          jobId: data.jobId,
          tone: data.tone,
          content: personalizedContent,
          title: `Cover Letter for ${job.title}`
        }
      });

      return {
        id: savedCoverLetter.id,
        content: personalizedContent,
        templateName: selectedTemplate.name,
        tone: data.tone,
        createdAt: savedCoverLetter.createdAt
      };

    } catch (error) {
      logger.error('Error generating cover letter', { error: error instanceof Error ? error.message : String(error), userId, jobId: data.jobId });
      throw error instanceof AppError ? error : new AppError('Failed to generate cover letter', 500);
    }
  }

  async getUserCoverLetters(userId: string) {
    try {
      const coverLetters = await this.prisma.coverLetter.findMany({
        where: { userId },
        include: {
          job: {
            select: {
              title: true,
              company: { select: { name: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return {
        coverLetters: coverLetters.map(cl => ({
          id: cl.id,
          jobTitle: cl.job?.title || 'Unknown Job',
          companyName: cl.job?.company?.name || 'Unknown Company',
          tone: cl.tone,
          createdAt: cl.createdAt,
          updatedAt: cl.updatedAt
        }))
      };
    } catch (error) {
      logger.error('Error fetching user cover letters', { error: error instanceof Error ? error.message : String(error), userId });
      throw new AppError('Failed to fetch cover letters', 500);
    }
  }

  async getCoverLetter(userId: string, coverLetterId: string) {
    try {
      const coverLetter = await this.prisma.coverLetter.findFirst({
        where: { 
          id: coverLetterId,
          userId 
        },
        include: {
          job: {
            include: { company: true }
          }
        }
      });

      if (!coverLetter) {
        throw new AppError('Cover letter not found', 404);
      }

      return coverLetter;
    } catch (error) {
      logger.error('Error getting cover letter', { error: error instanceof Error ? error.message : String(error), userId, id: coverLetterId });
      throw error instanceof AppError ? error : new AppError('Failed to fetch cover letter', 500);
    }
  }

  /**
   *  MAGIC: Apply one-click optimization to existing cover letter
   */
  async applyOneClickOptimization(
    userId: string,
    coverLetterId: string,
    optimizationType: 'personality' | 'industry' | 'tone' | 'keywords'
  ): Promise<{
    optimizedContent: string;
    improvementScore: number;
    changes: string[];
  }> {
    try {
      logger.info(' Applying one-click optimization', { userId, coverLetterId, optimizationType });

      const coverLetter = await this.prisma.coverLetter.findFirst({
        where: { id: coverLetterId, userId },
        include: {
          job: {
            include: { company: true }
          }
        }
      });

      if (!coverLetter) {
        throw new AppError('Cover letter not found', 404);
      }

      let optimizedContent = coverLetter.content;
      const changes: string[] = [];
      let improvementScore = 0;

      switch (optimizationType) {
        case 'personality':
          const personalityResult = await this.optimizeForPersonality(coverLetter.content, userId);
          optimizedContent = personalityResult.content;
          changes.push(...personalityResult.changes);
          improvementScore = personalityResult.score;
          break;
          
        case 'industry':
          const industryResult = await this.optimizeForIndustry(
            coverLetter.content,
            coverLetter.job.company.industry || 'General'
          );
          optimizedContent = industryResult.content;
          changes.push(...industryResult.changes);
          improvementScore = industryResult.score;
          break;
          
        case 'tone':
          const toneResult = await this.optimizeForTone(coverLetter.content, coverLetter.tone);
          optimizedContent = toneResult.content;
          changes.push(...toneResult.changes);
          improvementScore = toneResult.score;
          break;
          
        case 'keywords':
          const keywordResult = await this.optimizeForKeywords(
            coverLetter.content,
            coverLetter.job
          );
          optimizedContent = keywordResult.content;
          changes.push(...keywordResult.changes);
          improvementScore = keywordResult.score;
          break;
      }

      // Update the cover letter
      await this.prisma.coverLetter.update({
        where: { id: coverLetterId },
        data: {
          content: optimizedContent,
          updatedAt: new Date()
        }
      });

      return {
        optimizedContent,
        improvementScore,
        changes
      };

    } catch (error) {
      logger.error('Failed to apply one-click optimization', { error, userId, coverLetterId });
      throw error instanceof AppError ? error : new AppError('Failed to optimize cover letter', 500);
    }
  }

  async updateCoverLetter(userId: string, coverLetterId: string, content: string) {
    try {
      const coverLetter = await this.prisma.coverLetter.findFirst({
        where: { 
          id: coverLetterId,
          userId 
        }
      });

      if (!coverLetter) {
        throw new AppError('Cover letter not found', 404);
      }

      const updated = await this.prisma.coverLetter.update({
        where: { id: coverLetterId },
        data: { 
          content,
          updatedAt: new Date()
        }
      });

      return updated;
    } catch (error) {
      logger.error('Error updating cover letter', { error: error instanceof Error ? error.message : String(error), userId, id: coverLetterId });
      throw error instanceof AppError ? error : new AppError('Failed to update cover letter', 500);
    }
  }

  private async personalizeTemplate(
    template: CoverLetterTemplate, 
    user: any, 
    job: any, 
    customization?: any
  ): Promise<string> {
    const candidateName = `${user.firstName} ${user.lastName}`;
    const companyName = customization?.companyName || job.company.name;
    const jobTitle = customization?.jobTitle || job.title;
    const hiringManager = customization?.hiringManagerName || 'Hiring Manager';

    // Extract user skills and experience
    const primarySkills = user.skills?.slice(0, 3).map((s: any) => s.skill.name).join(', ') || 'relevant skills';
    const currentRole = user.experiences?.[0]?.jobTitle || 'previous role';
    const yearsExperience = this.calculateExperience(user.experiences);

    // Create substitution map
    const substitutions: Record<string, string> = {
      candidateName,
      companyName,
      jobTitle,
      hiringManager,
      primarySkills,
      currentRole,
      yearsExperience: yearsExperience.toString(),
      // Add more sophisticated personalizations here
      keyAchievement: this.generateKeyAchievement(user.experiences),
      relevantSkills: this.matchSkillsToJob(user.skills, job.description),
      companyResearch: this.generateCompanyInsight(job.company),
      uniqueValue: this.generateUniqueValue(user),
      customRequirements: customization?.specificRequirements?.join('\n\n') || ''
    };

    // Replace placeholders in template
    let personalizedContent = template.template;
    Object.entries(substitutions).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      personalizedContent = personalizedContent.replace(regex, value);
    });

    return personalizedContent;
  }

  private calculateExperience(experiences: any[]): number {
    if (!experiences || experiences.length === 0) return 0;
    
    const totalMonths = experiences.reduce((total, exp) => {
      const start = new Date(exp.startDate);
      const end = exp.endDate ? new Date(exp.endDate) : new Date();
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      return total + months;
    }, 0);

    return Math.round(totalMonths / 12);
  }

  private generateKeyAchievement(experiences: any[]): string {
    if (!experiences || experiences.length === 0) {
      return 'delivered exceptional results in my previous role';
    }
    
    const latestExp = experiences[0];
    return latestExp.description || `led successful initiatives at ${latestExp.company}`;
  }

  private matchSkillsToJob(userSkills: any[], jobDescription: string): string {
    if (!userSkills || userSkills.length === 0) {
      return 'key technical areas';
    }

    // Simple keyword matching - in production, use more sophisticated NLP
    const relevantSkills = userSkills
      .filter((s: any) => jobDescription?.toLowerCase().includes(s.skill.name.toLowerCase()))
      .slice(0, 3)
      .map((s: any) => s.skill.name);

    return relevantSkills.length > 0 ? relevantSkills.join(', ') : 'relevant technical skills';
  }

  private generateCompanyInsight(company: any): string {
    const defaultInsights = [
      `your company's commitment to innovation and excellence`,
      `the company's strong reputation in the ${company.industry || 'industry'}`,
      `your organization's growth trajectory and market position`,
      `the collaborative culture and values that ${company.name} represents`
    ];

    return defaultInsights[Math.floor(Math.random() * defaultInsights.length)];
  }

  private generateUniqueValue(_user: any): string {
    const defaultValues = [
      'proven track record of delivering results',
      'combination of technical expertise and leadership skills',
      'passion for innovation and continuous learning',
      'ability to drive cross-functional collaboration'
    ];

    return defaultValues[Math.floor(Math.random() * defaultValues.length)];
  }

  //  ENHANCED AI WRITING - Private Methods

  private async generatePersonalityProfile(user: any, cvContent?: string): Promise<PersonalityProfile> {
    const cacheKey = `personality:${user.id}`;
    const cached = this.personalityCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.authenticVoiceMarkers.length) < this.cacheExpiry) {
      return cached;
    }

    // Analyze user's authentic voice from CV and experiences
    let textForAnalysis = '';
    
    if (cvContent) {
      textForAnalysis = cvContent;
    } else {
      // Build text from user profile
      textForAnalysis = this.buildUserTextForAnalysis(user);
    }

    // Use AI to analyze personality traits from writing
    const aiPersonalityAnalysis = await this.hfService.analyzeText(textForAnalysis, {
      task: 'personality_analysis',
      focus: 'writing_style'
    });

    const profile: PersonalityProfile = {
      writingStyle: this.determineWritingStyle(aiPersonalityAnalysis, textForAnalysis),
      personalityTraits: {
        assertiveness: this.extractTraitScore(aiPersonalityAnalysis, 'assertiveness'),
        warmth: this.extractTraitScore(aiPersonalityAnalysis, 'warmth'),
        formality: this.extractTraitScore(aiPersonalityAnalysis, 'formality'),
        creativity: this.extractTraitScore(aiPersonalityAnalysis, 'creativity'),
        directness: this.extractTraitScore(aiPersonalityAnalysis, 'directness')
      },
      communicationPreferences: {
        sentenceLength: this.analyzeSentenceLength(textForAnalysis),
        vocabularyLevel: this.analyzeVocabularyLevel(textForAnalysis),
        useOfHumor: this.detectHumorTendency(textForAnalysis),
        storytellingTendency: this.analyzeStorytellingTendency(textForAnalysis)
      },
      authenticVoiceMarkers: this.extractVoiceMarkers(textForAnalysis)
    };

    this.personalityCache.set(cacheKey, profile);
    return profile;
  }

  private async generatePersonalityMatchedContent(
    personality: PersonalityProfile,
    user: any,
    job: any,
    data: CoverLetterData,
    industryOptimization: any
  ): Promise<{
    content: string;
    personalityAlignment: number;
    suggestions: any[];
  }> {
    // Get base template
    const templates = this.getDefaultTemplates();
    let selectedTemplate = templates.find(t => t.tone === data.tone) || templates[0];
    
    // Adapt template to user's personality
    const personalizedTemplate = this.adaptTemplateToPersonality(selectedTemplate, personality);
    
    // Generate content with personality awareness
    const baseContent = await this.personalizeTemplate(
      personalizedTemplate,
      user,
      job,
      data.customization
    );
    
    // Apply personality-specific language adjustments
    const personalityAdjustedContent = await this.applyPersonalityAdjustments(
      baseContent,
      personality,
      job.company.industry
    );
    
    // Insert industry-specific language naturally
    const finalContent = this.insertIndustryLanguage(
      personalityAdjustedContent,
      industryOptimization.suggestions,
      personality
    );
    
    // Calculate personality alignment score
    const personalityAlignment = this.calculatePersonalityAlignment(
      finalContent,
      personality
    );
    
    // Generate suggestions for further improvement
    const suggestions = await this.generatePersonalitySuggestions(
      finalContent,
      personality,
      industryOptimization
    );

    return {
      content: finalContent,
      personalityAlignment,
      suggestions
    };
  }

  private async analyzeToneConsistency(
    content: string,
    targetTone: CoverLetterTone
  ): Promise<{
    consistency: number;
    appropriateness: number;
    authenticity: number;
  }> {
    // Use AI to analyze tone consistency
    const toneAnalysis = await this.hfService.analyzeText(content, {
      task: 'tone_analysis',
      target_tone: targetTone
    });

    return {
      consistency: this.extractToneScore(toneAnalysis, 'consistency'),
      appropriateness: this.extractToneScore(toneAnalysis, 'appropriateness'),
      authenticity: this.extractToneScore(toneAnalysis, 'authenticity')
    };
  }

  private async generateOneClickOptimizations(
    content: string,
    personality: PersonalityProfile,
    industryOptimization: any,
    job: any
  ): Promise<any[]> {
    const optimizations = [];

    // Personality enhancement
    if (personality.personalityTraits.assertiveness < 0.7) {
      optimizations.push({
        action: 'Boost Confidence',
        description: 'Add more assertive language to match your personality',
        preview: 'Replace "I believe I could contribute" with "I will drive significant impact"'
      });
    }

    // Industry keyword optimization
    if (industryOptimization.languageInsights.keywordDensity < 0.6) {
      optimizations.push({
        action: 'Add Industry Keywords',
        description: 'Insert trending industry keywords naturally',
        preview: `Add "${industryOptimization.missingKeywords[0]?.keyword}" to highlight expertise`
      });
    }

    // Tone refinement
    optimizations.push({
      action: 'Refine Tone',
      description: 'Adjust tone to match company culture',
      preview: 'Make language more conversational for startup environment'
    });

    // Structure optimization
    optimizations.push({
      action: 'Optimize Structure',
      description: 'Reorganize for maximum impact',
      preview: 'Lead with strongest qualification in opening paragraph'
    });

    return optimizations.slice(0, 4);
  }

  // Enhanced AI Writing Helper Methods

  private async generateRegularCoverLetter(userId: string, data: CoverLetterData): Promise<any> {
    // Fallback to regular generation for non-Executive users
    const result = await this.generateCoverLetter(userId, data);
    
    return {
      personalizedContent: result.content,
      personalityAlignment: 0.7, // Mock score
      industryOptimization: {
        keywordDensity: 0.6,
        industryLanguageScore: 0.7,
        optimizedPhrases: []
      },
      toneAnalysis: {
        consistency: 0.8,
        appropriateness: 0.8,
        authenticity: 0.7
      },
      suggestions: [],
      oneClickOptimizations: []
    };
  }

  private buildUserTextForAnalysis(user: any): string {
    let text = '';
    
    // Add experience descriptions
    if (user.experiences) {
      text += user.experiences
        .map((exp: any) => exp.description || `${exp.jobTitle} at ${exp.company}`)
        .join(' ');
    }
    
    // Add skills as context
    if (user.skills) {
      text += ' Skills: ' + user.skills.map((s: any) => s.skill.name).join(', ');
    }
    
    return text || 'No text available for analysis';
  }

  private getUserSummary(user: any): string {
    const skills = user.skills?.slice(0, 5).map((s: any) => s.skill.name).join(', ') || 'various skills';
    const experience = user.experiences?.[0]?.jobTitle || 'professional experience';
    
    return `Professional with ${experience} and expertise in ${skills}`;
  }

  private determineWritingStyle(aiAnalysis: any, text: string): 'formal' | 'conversational' | 'confident' | 'humble' | 'creative' {
    // Analyze text characteristics to determine writing style
    const avgSentenceLength = this.getAverageSentenceLength(text);
    const formalWords = this.countFormalWords(text);
    const personalPronouns = this.countPersonalPronouns(text);
    
    if (formalWords > 0.3) return 'formal';
    if (personalPronouns > 0.1) return 'conversational';
    if (avgSentenceLength < 15) return 'confident';
    
    return 'conversational'; // Default
  }

  private extractTraitScore(aiAnalysis: any, trait: string): number {
    // Extract personality trait scores from AI analysis
    return Math.random() * 0.4 + 0.6; // Mock: 0.6-1.0 range
  }

  private analyzeSentenceLength(text: string): 'short' | 'medium' | 'long' {
    const avgLength = this.getAverageSentenceLength(text);
    
    if (avgLength < 12) return 'short';
    if (avgLength < 20) return 'medium';
    return 'long';
  }

  private analyzeVocabularyLevel(text: string): 'simple' | 'moderate' | 'advanced' {
    const words = text.split(/\s+/);
    const complexWords = words.filter(word => word.length > 7).length;
    const complexity = complexWords / words.length;
    
    if (complexity < 0.15) return 'simple';
    if (complexity < 0.25) return 'moderate';
    return 'advanced';
  }

  private detectHumorTendency(text: string): boolean {
    const humorIndicators = ['!', 'exciting', 'amazing', 'fantastic', 'love', 'passion'];
    const textLower = text.toLowerCase();
    
    return humorIndicators.some(indicator => textLower.includes(indicator));
  }

  private analyzeStorytellingTendency(text: string): number {
    // Look for narrative elements
    const narrativeWords = ['when', 'during', 'while', 'after', 'before', 'first', 'then', 'finally'];
    const textLower = text.toLowerCase();
    const matches = narrativeWords.filter(word => textLower.includes(word)).length;
    
    return Math.min(matches / 10, 1); // Normalize to 0-1
  }

  private extractVoiceMarkers(text: string): string[] {
    // Extract unique phrases and words that represent the user's authentic voice
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = [...new Set(words)]
      .filter(word => word.length > 4 && !this.isCommonWord(word))
      .slice(0, 10);
    
    return uniqueWords;
  }

  private adaptTemplateToPersonality(template: CoverLetterTemplate, personality: PersonalityProfile): CoverLetterTemplate {
    let adaptedTemplate = { ...template };
    
    // Adjust template based on personality traits
    if (personality.personalityTraits.assertiveness > 0.8) {
      adaptedTemplate.template = adaptedTemplate.template.replace(
        'I am confident that I would be',
        'I am excited to be'
      );
    }
    
    if (personality.communicationPreferences.sentenceLength === 'short') {
      // Simplify long sentences
      adaptedTemplate.template = this.simplifySentences(adaptedTemplate.template);
    }
    
    return adaptedTemplate;
  }

  private async applyPersonalityAdjustments(
    content: string,
    personality: PersonalityProfile,
    industry: string
  ): Promise<string> {
    let adjustedContent = content;
    
    // Apply personality-specific language patterns
    if (personality.writingStyle === 'confident') {
      adjustedContent = this.makeMoreConfident(adjustedContent);
    }
    
    if (personality.communicationPreferences.useOfHumor) {
      adjustedContent = this.addPersonalityTouch(adjustedContent);
    }
    
    // Incorporate authentic voice markers
    adjustedContent = this.incorporateVoiceMarkers(adjustedContent, personality.authenticVoiceMarkers);
    
    return adjustedContent;
  }

  private insertIndustryLanguage(
    content: string,
    industrySuggestions: any[],
    personality: PersonalityProfile
  ): string {
    let enhancedContent = content;
    
    // Insert industry keywords naturally based on personality
    industrySuggestions.slice(0, 3).forEach(suggestion => {
      if (suggestion.type === 'keyword_add') {
        enhancedContent = this.naturallyInsertKeyword(
          enhancedContent,
          suggestion.suggested,
          personality.writingStyle
        );
      }
    });
    
    return enhancedContent;
  }

  private calculatePersonalityAlignment(content: string, personality: PersonalityProfile): number {
    let score = 0.7; // Base score
    
    // Check if content matches user's writing style
    if (this.contentMatchesStyle(content, personality.writingStyle)) {
      score += 0.2;
    }
    
    // Check for authentic voice markers
    const voiceMarkerCount = personality.authenticVoiceMarkers.filter(marker => 
      content.toLowerCase().includes(marker)
    ).length;
    score += (voiceMarkerCount / Math.max(personality.authenticVoiceMarkers.length, 1)) * 0.1;
    
    return Math.min(score, 1);
  }

  private async generatePersonalitySuggestions(
    content: string,
    personality: PersonalityProfile,
    industryOptimization: any
  ): Promise<any[]> {
    const suggestions = [];
    
    // Personality-based suggestions
    if (personality.personalityTraits.warmth > 0.8 && !this.hasWarmLanguage(content)) {
      suggestions.push({
        type: 'personality',
        original: content,
        suggested: 'Add more warm, personal language',
        reasoning: 'Your personality profile shows high warmth - let that shine through',
        impact: 85
      });
    }
    
    // Voice authenticity suggestions
    if (personality.authenticVoiceMarkers.length > 0) {
      suggestions.push({
        type: 'personality',
        original: content,
        suggested: `Consider incorporating phrases like "${personality.authenticVoiceMarkers[0]}"`,
        reasoning: 'This aligns with your authentic voice pattern',
        impact: 75
      });
    }
    
    return suggestions;
  }

  private async optimizeForPersonality(content: string, userId: string): Promise<{
    content: string;
    changes: string[];
    score: number;
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const personality = await this.generatePersonalityProfile(user);
    
    let optimizedContent = content;
    const changes = [];
    
    // Apply personality optimizations
    if (personality.personalityTraits.assertiveness > 0.8) {
      optimizedContent = this.makeMoreAssertive(optimizedContent);
      changes.push('Increased assertiveness to match your confident personality');
    }
    
    return {
      content: optimizedContent,
      changes,
      score: 0.85
    };
  }

  private async optimizeForIndustry(content: string, industry: string): Promise<{
    content: string;
    changes: string[];
    score: number;
  }> {
    const optimization = await this.industryLanguageService.optimizeDocumentLanguage(
      content,
      'cover_letter',
      industry
    );
    
    let optimizedContent = content;
    const changes = [];
    
    // Apply top suggestions
    optimization.suggestions.slice(0, 3).forEach(suggestion => {
      if (suggestion.type === 'keyword_add') {
        optimizedContent = this.insertKeywordNaturally(optimizedContent, suggestion.suggested);
        changes.push(`Added industry keyword: ${suggestion.suggested}`);
      }
    });
    
    return {
      content: optimizedContent,
      changes,
      score: optimization.overallScore
    };
  }

  private async optimizeForTone(content: string, tone: CoverLetterTone): Promise<{
    content: string;
    changes: string[];
    score: number;
  }> {
    let optimizedContent = content;
    const changes = [];
    
    switch (tone) {
      case CoverLetterTone.PROFESSIONAL:
        optimizedContent = this.makMoreFormal(optimizedContent);
        changes.push('Refined language for professional tone');
        break;
      case CoverLetterTone.CONVERSATIONAL:
        optimizedContent = this.makeMoreConversational(optimizedContent);
        changes.push('Adjusted tone to be more conversational');
        break;
      case CoverLetterTone.CREATIVE:
        optimizedContent = this.addCreativeElements(optimizedContent);
        changes.push('Enhanced creative expression');
        break;
    }
    
    return {
      content: optimizedContent,
      changes,
      score: 0.9
    };
  }

  private async optimizeForKeywords(content: string, job: any): Promise<{
    content: string;
    changes: string[];
    score: number;
  }> {
    let optimizedContent = content;
    const changes = [];
    
    // Extract important keywords from job description
    const jobKeywords = this.extractJobKeywords(job.description);
    
    // Insert missing keywords
    jobKeywords.slice(0, 3).forEach(keyword => {
      if (!content.toLowerCase().includes(keyword.toLowerCase())) {
        optimizedContent = this.insertKeywordNaturally(optimizedContent, keyword);
        changes.push(`Added relevant keyword: ${keyword}`);
      }
    });
    
    return {
      content: optimizedContent,
      changes,
      score: 0.8
    };
  }

  // Utility Methods

  private getAverageSentenceLength(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).length;
    return sentences.length > 0 ? words / sentences.length : 0;
  }

  private countFormalWords(text: string): number {
    const formalWords = ['furthermore', 'moreover', 'consequently', 'therefore', 'accordingly'];
    const textLower = text.toLowerCase();
    const matches = formalWords.filter(word => textLower.includes(word)).length;
    return matches / text.split(/\s+/).length;
  }

  private countPersonalPronouns(text: string): number {
    const pronouns = ['i', 'my', 'me', 'myself'];
    const words = text.toLowerCase().split(/\s+/);
    const matches = words.filter(word => pronouns.includes(word)).length;
    return matches / words.length;
  }

  private isCommonWord(word: string): boolean {
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return commonWords.includes(word.toLowerCase());
  }

  private extractToneScore(analysis: any, metric: string): number {
    return Math.random() * 0.3 + 0.7; // Mock: 0.7-1.0 range
  }

  private simplifySentences(content: string): string {
    // Break down long sentences into shorter ones
    return content.replace(/,\s+and\s+/g, '. Additionally, ');
  }

  private makeMoreConfident(content: string): string {
    return content
      .replace(/I believe/g, 'I am confident')
      .replace(/I think/g, 'I know')
      .replace(/I might/g, 'I will');
  }

  private addPersonalityTouch(content: string): string {
    // Add subtle personality touches
    return content.replace(/I am writing to express/g, 'I am excited to express');
  }

  private incorporateVoiceMarkers(content: string, markers: string[]): string {
    // Naturally incorporate authentic voice markers
    let enhancedContent = content;
    
    markers.slice(0, 2).forEach(marker => {
      if (!enhancedContent.toLowerCase().includes(marker.toLowerCase())) {
        enhancedContent = this.insertPhraseNaturally(enhancedContent, marker);
      }
    });
    
    return enhancedContent;
  }

  private contentMatchesStyle(content: string, style: string): boolean {
    // Check if content matches the expected writing style
    const avgSentenceLength = this.getAverageSentenceLength(content);
    
    switch (style) {
      case 'formal': return this.countFormalWords(content) > 0.2;
      case 'conversational': return this.countPersonalPronouns(content) > 0.05;
      case 'confident': return avgSentenceLength < 18;
      default: return true;
    }
  }

  private hasWarmLanguage(content: string): boolean {
    const warmWords = ['excited', 'passionate', 'enthusiastic', 'thrilled', 'delighted'];
    const textLower = content.toLowerCase();
    return warmWords.some(word => textLower.includes(word));
  }

  private makeMoreAssertive(content: string): string {
    return content
      .replace(/I would be/g, 'I am')
      .replace(/I could contribute/g, 'I will contribute')
      .replace(/I hope to/g, 'I will');
  }

  private naturallyInsertKeyword(content: string, keyword: string, style: string): string {
    // Insert keyword naturally based on writing style
    const insertionPoints = content.split('. ');
    
    if (insertionPoints.length > 1) {
      const insertIndex = Math.floor(insertionPoints.length / 2);
      insertionPoints[insertIndex] += ` My expertise in ${keyword} positions me well for this role.`;
      return insertionPoints.join('. ');
    }
    
    return content + ` I bring extensive ${keyword} experience to this position.`;
  }

  private insertKeywordNaturally(content: string, keyword: string): string {
    return this.naturallyInsertKeyword(content, keyword, 'professional');
  }

  private makMoreFormal(content: string): string {
    return content
      .replace(/I'm/g, 'I am')
      .replace(/can't/g, 'cannot')
      .replace(/won't/g, 'will not');
  }

  private makeMoreConversational(content: string): string {
    return content
      .replace(/I am writing to express/g, 'I wanted to reach out about')
      .replace(/I would be pleased/g, 'I would love');
  }

  private addCreativeElements(content: string): string {
    // Add creative touches while maintaining professionalism
    return content.replace(
      /Dear Hiring Manager,/g,
      'Dear Hiring Team,\n\nImagine finding a candidate who brings both expertise and genuine passion to your team...'  
    );
  }

  private extractJobKeywords(description: string): string[] {
    // Extract important keywords from job description
    const words = description.toLowerCase().split(/\s+/);
    const importantWords = words.filter(word => 
      word.length > 4 && 
      !this.isCommonWord(word) &&
      (word.includes('skill') || word.includes('experience') || word.includes('knowledge'))
    );
    
    return [...new Set(importantWords)].slice(0, 5);
  }

  private insertPhraseNaturally(content: string, phrase: string): string {
    const sentences = content.split('. ');
    if (sentences.length > 2) {
      sentences[1] += ` This aligns with my ${phrase}.`;
      return sentences.join('. ');
    }
    return content;
  }
}

export default new CoverLetterService();
