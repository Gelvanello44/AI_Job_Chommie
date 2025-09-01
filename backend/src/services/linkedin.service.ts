import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { z } from 'zod';

const prisma = new PrismaClient();

// LinkedIn Profile Schema
const LinkedInProfileSchema = z.object({
  userId: z.string(),
  profileUrl: z.string().url().optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    duration: z.string(),
    description: z.string().optional(),
    skills: z.array(z.string()).optional()
  })).optional(),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    year: z.string().optional(),
    field: z.string().optional()
  })).optional(),
  skills: z.array(z.string()).optional(),
  certifications: z.array(z.object({
    name: z.string(),
    issuer: z.string(),
    date: z.string().optional()
  })).optional(),
  languages: z.array(z.string()).optional(),
  publications: z.array(z.object({
    title: z.string(),
    publisher: z.string().optional(),
    date: z.string().optional()
  })).optional(),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    technologies: z.array(z.string()).optional()
  })).optional(),
  completenessScore: z.number().min(0).max(100).optional(),
  optimizationSuggestions: z.array(z.string()).optional()
});

type LinkedInProfile = z.infer<typeof LinkedInProfileSchema>;

export class LinkedInService {
  private readonly OPTIMIZATION_WEIGHTS = {
    profilePhoto: 5,
    headline: 10,
    summary: 15,
    experience: 25,
    education: 10,
    skills: 15,
    certifications: 5,
    recommendations: 10,
    customUrl: 3,
    contactInfo: 2
  };

  /**
   * Parse LinkedIn profile data from URL or HTML
   */
  async parseProfile(profileUrl: string, userId: string): Promise<LinkedInProfile> {
    try {
      // Note: In production, you'd need LinkedIn API access or use a scraping service
      // This is a placeholder implementation
      const profileData = await this.fetchProfileData(profileUrl);
      const parsedProfile = this.extractProfileData(profileData, userId);
      
      // Calculate completeness score
      parsedProfile.completenessScore = this.calculateCompletenessScore(parsedProfile);
      
      // Generate optimization suggestions
      parsedProfile.optimizationSuggestions = this.generateOptimizationSuggestions(parsedProfile);
      
      // Save to database
      await this.saveProfile(parsedProfile);
      
      return parsedProfile;
    } catch (error) {
      console.error('Error parsing LinkedIn profile:', error);
      throw new Error('Failed to parse LinkedIn profile');
    }
  }

  /**
   * Fetch profile data (placeholder - would use LinkedIn API in production)
   */
  private async fetchProfileData(profileUrl: string): Promise<any> {
    // In production, this would use LinkedIn API or authorized scraping
    // For now, return mock data structure
    return {
      url: profileUrl,
      html: '<html>Mock profile data</html>'
    };
  }

  /**
   * Extract profile data from HTML/API response
   */
  private extractProfileData(data: any, userId: string): LinkedInProfile {
    // This would parse actual LinkedIn data
    // For now, return a mock profile structure
    return {
      userId,
      profileUrl: data.url,
      headline: 'Software Engineer | Full Stack Developer',
      summary: 'Passionate about building scalable applications...',
      experience: [
        {
          title: 'Senior Developer',
          company: 'Tech Company',
          duration: '2020 - Present',
          description: 'Leading development of key features',
          skills: ['React', 'Node.js', 'TypeScript']
        }
      ],
      education: [
        {
          degree: 'BSc Computer Science',
          institution: 'University of Cape Town',
          year: '2019',
          field: 'Computer Science'
        }
      ],
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python'],
      certifications: [],
      languages: ['English', 'Afrikaans'],
      publications: [],
      projects: [],
      completenessScore: 0,
      optimizationSuggestions: []
    };
  }

  /**
   * Calculate profile completeness score
   */
  calculateCompletenessScore(profile: LinkedInProfile): number {
    let score = 0;
    let maxScore = 0;

    // Check each component
    if (profile.headline && profile.headline.length > 0) {
      score += this.OPTIMIZATION_WEIGHTS.headline;
    }
    maxScore += this.OPTIMIZATION_WEIGHTS.headline;

    if (profile.summary && profile.summary.length > 100) {
      score += this.OPTIMIZATION_WEIGHTS.summary;
    }
    maxScore += this.OPTIMIZATION_WEIGHTS.summary;

    if (profile.experience && profile.experience.length > 0) {
      const expScore = Math.min(profile.experience.length * 5, this.OPTIMIZATION_WEIGHTS.experience);
      score += expScore;
    }
    maxScore += this.OPTIMIZATION_WEIGHTS.experience;

    if (profile.education && profile.education.length > 0) {
      score += this.OPTIMIZATION_WEIGHTS.education;
    }
    maxScore += this.OPTIMIZATION_WEIGHTS.education;

    if (profile.skills && profile.skills.length >= 5) {
      const skillScore = Math.min(profile.skills.length * 1.5, this.OPTIMIZATION_WEIGHTS.skills);
      score += skillScore;
    }
    maxScore += this.OPTIMIZATION_WEIGHTS.skills;

    if (profile.certifications && profile.certifications.length > 0) {
      score += this.OPTIMIZATION_WEIGHTS.certifications;
    }
    maxScore += this.OPTIMIZATION_WEIGHTS.certifications;

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Generate optimization suggestions based on profile analysis
   */
  generateOptimizationSuggestions(profile: LinkedInProfile): string[] {
    const suggestions: string[] = [];

    // Headline suggestions
    if (!profile.headline || profile.headline.length < 50) {
      suggestions.push('Add a compelling headline that includes your key skills and value proposition');
    }

    // Summary suggestions
    if (!profile.summary || profile.summary.length < 200) {
      suggestions.push('Write a comprehensive summary (200+ words) highlighting your achievements and goals');
    }

    // Experience suggestions
    if (!profile.experience || profile.experience.length === 0) {
      suggestions.push('Add your work experience with detailed descriptions and achievements');
    } else {
      profile.experience.forEach((exp, index) => {
        if (!exp.description || exp.description.length < 100) {
          suggestions.push(`Add more details to your ${exp.title} role description`);
        }
      });
    }

    // Skills suggestions
    if (!profile.skills || profile.skills.length < 5) {
      suggestions.push('Add at least 5-10 relevant skills to improve searchability');
    } else if (profile.skills.length < 10) {
      suggestions.push('Consider adding more skills (aim for 10-15) to increase profile visibility');
    }

    // Education suggestions
    if (!profile.education || profile.education.length === 0) {
      suggestions.push('Add your educational background');
    }

    // Certifications suggestions
    if (!profile.certifications || profile.certifications.length === 0) {
      suggestions.push('Add relevant certifications to showcase continuous learning');
    }

    // Keywords optimization
    suggestions.push('Include industry-specific keywords throughout your profile for better search visibility');

    // Network suggestions
    suggestions.push('Aim for 500+ connections to expand your professional network');

    // Activity suggestions
    suggestions.push('Share content and engage with posts weekly to increase profile visibility');

    return suggestions;
  }

  /**
   * Save profile to database
   */
  private async saveProfile(profile: LinkedInProfile): Promise<void> {
    try {
      // Store in a JSON field in the user profile or create a separate table
      await prisma.userProfile.update({
        where: { userId: profile.userId },
        data: {
          linkedInData: JSON.stringify(profile),
          linkedInScore: profile.completenessScore
        }
      });
    } catch (error) {
      console.error('Error saving LinkedIn profile:', error);
    }
  }

  /**
   * Get optimization checklist for a user
   */
  async getOptimizationChecklist(userId: string): Promise<any> {
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    if (!userProfile || !userProfile.linkedInData) {
      return this.getDefaultChecklist();
    }

    const profile = JSON.parse(userProfile.linkedInData as string) as LinkedInProfile;
    
    return {
      completenessScore: profile.completenessScore,
      checklist: [
        {
          category: 'Profile Basics',
          items: [
            {
              item: 'Professional profile photo',
              completed: true, // Would check actual photo presence
              impact: 'High',
              tip: 'Use a high-quality, professional headshot'
            },
            {
              item: 'Compelling headline',
              completed: !!profile.headline && profile.headline.length > 50,
              impact: 'High',
              tip: 'Include your role, skills, and value proposition'
            },
            {
              item: 'Custom profile URL',
              completed: false, // Would check for custom URL
              impact: 'Medium',
              tip: 'Create a custom LinkedIn URL for easier sharing'
            }
          ]
        },
        {
          category: 'Professional Summary',
          items: [
            {
              item: 'Comprehensive summary (200+ words)',
              completed: !!profile.summary && profile.summary.length > 200,
              impact: 'High',
              tip: 'Tell your professional story and highlight achievements'
            },
            {
              item: 'Keywords included',
              completed: false, // Would analyze keywords
              impact: 'High',
              tip: 'Include industry-specific keywords for searchability'
            }
          ]
        },
        {
          category: 'Experience',
          items: [
            {
              item: 'All positions listed',
              completed: !!profile.experience && profile.experience.length > 0,
              impact: 'High',
              tip: 'Include all relevant work experience'
            },
            {
              item: 'Detailed descriptions with achievements',
              completed: profile.experience?.some(e => e.description && e.description.length > 100) || false,
              impact: 'High',
              tip: 'Use bullet points to highlight key achievements'
            },
            {
              item: 'Quantified results',
              completed: false, // Would check for numbers/metrics
              impact: 'Medium',
              tip: 'Include metrics and numbers to quantify impact'
            }
          ]
        },
        {
          category: 'Skills & Endorsements',
          items: [
            {
              item: 'At least 10 skills listed',
              completed: !!profile.skills && profile.skills.length >= 10,
              impact: 'Medium',
              tip: 'Add relevant skills to improve discoverability'
            },
            {
              item: 'Skills endorsed by connections',
              completed: false, // Would check endorsement data
              impact: 'Medium',
              tip: 'Request endorsements from colleagues'
            }
          ]
        },
        {
          category: 'Education & Certifications',
          items: [
            {
              item: 'Education history complete',
              completed: !!profile.education && profile.education.length > 0,
              impact: 'Medium',
              tip: 'Include all degrees and relevant coursework'
            },
            {
              item: 'Certifications added',
              completed: !!profile.certifications && profile.certifications.length > 0,
              impact: 'Medium',
              tip: 'Showcase professional certifications and licenses'
            }
          ]
        }
      ],
      suggestions: profile.optimizationSuggestions
    };
  }

  /**
   * Get default optimization checklist
   */
  private getDefaultChecklist(): any {
    return {
      completenessScore: 0,
      checklist: [
        {
          category: 'Getting Started',
          items: [
            {
              item: 'Connect your LinkedIn profile',
              completed: false,
              impact: 'High',
              tip: 'Connect your profile to get personalized recommendations'
            }
          ]
        }
      ],
      suggestions: [
        'Connect your LinkedIn profile to receive personalized optimization recommendations',
        'Complete your profile to increase visibility to recruiters',
        'Add a professional photo and compelling headline'
      ]
    };
  }

  /**
   * Generate LinkedIn profile improvement report
   */
  async generateImprovementReport(userId: string): Promise<any> {
    const checklist = await this.getOptimizationChecklist(userId);
    
    const completedItems = checklist.checklist
      .flatMap((c: any) => c.items)
      .filter((i: any) => i.completed).length;
    
    const totalItems = checklist.checklist
      .flatMap((c: any) => c.items).length;
    
    return {
      userId,
      completenessScore: checklist.completenessScore,
      completedItems,
      totalItems,
      completionPercentage: Math.round((completedItems / totalItems) * 100),
      topPriorities: checklist.checklist
        .flatMap((c: any) => c.items)
        .filter((i: any) => !i.completed && i.impact === 'High')
        .slice(0, 3),
      checklist: checklist.checklist,
      suggestions: checklist.suggestions,
      generatedAt: new Date()
    };
  }
}

export default new LinkedInService();
