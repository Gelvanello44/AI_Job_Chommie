import { PrismaClient, SubscriptionPlan } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { canAccessFeature } from '../utils/subscriptionQuotas.js'; // PLAN_QUOTAS not used
import logger from '../config/logger.js';
import pdfGenerationService, { CvData } from './pdf-generation.service.js';

interface CvTemplate {
  id: string;
  name: string;
  description?: string;
  planRequired: SubscriptionPlan;
  templateData: any;
}

interface CvDocumentData {
  templateId: string;
  personalInfo: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    headline?: string;
    summary?: string;
  };
  experience: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate?: string;
    description?: string;
    achievements?: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    startDate: string;
    endDate?: string;
    grade?: string;
  }>;
  skills: Array<{
    name: string;
    category?: string;
    proficiency?: number;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
    url?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date: string;
    url?: string;
  }>;
  languages?: Array<{
    language: string;
    proficiency: string;
  }>;
}

export class CvService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Default CV templates available per plan
  private getDefaultTemplates(): CvTemplate[] {
    return [
      {
        id: 'modern-basic',
        name: 'Modern Basic',
        description: 'Clean, professional layout perfect for most industries',
        planRequired: SubscriptionPlan.FREE,
        templateData: {
          layout: 'single-column',
          colors: { primary: '#333333', accent: '#0066cc' },
          fonts: { heading: 'Roboto', body: 'Open Sans' },
          sections: ['personalInfo', 'summary', 'experience', 'education', 'skills']
        }
      },
      {
        id: 'ats-optimized',
        name: 'ATS Optimized',
        description: 'Designed to pass applicant tracking systems with high scores',
        planRequired: SubscriptionPlan.FREE,
        templateData: {
          layout: 'single-column',
          colors: { primary: '#000000', accent: '#444444' },
          fonts: { heading: 'Arial', body: 'Arial' },
          sections: ['personalInfo', 'summary', 'experience', 'education', 'skills'],
          atsOptimized: true
        }
      },
      {
        id: 'professional-executive',
        name: 'Professional Executive',
        description: 'Executive-level template with sophisticated design',
        planRequired: SubscriptionPlan.PROFESSIONAL,
        templateData: {
          layout: 'two-column',
          colors: { primary: '#2c3e50', accent: '#3498db' },
          fonts: { heading: 'Merriweather', body: 'Source Sans Pro' },
          sections: ['personalInfo', 'summary', 'experience', 'education', 'skills', 'projects', 'certifications']
        }
      },
      {
        id: 'leadership-focused',
        name: 'Leadership Focused',
        description: 'Emphasizes leadership experience and achievements',
        planRequired: SubscriptionPlan.EXECUTIVE,
        templateData: {
          layout: 'leadership',
          colors: { primary: '#1a1a1a', accent: '#d4af37' },
          fonts: { heading: 'Playfair Display', body: 'Lato' },
          sections: ['personalInfo', 'leadershipSummary', 'experience', 'achievements', 'education', 'skills', 'boardPositions']
        }
      },
      {
        id: 'c-suite-premium',
        name: 'C-Suite Premium',
        description: 'Premium template for C-level executives and board members',
        planRequired: SubscriptionPlan.EXECUTIVE,
        templateData: {
          layout: 'executive-premium',
          colors: { primary: '#0f1419', accent: '#c9a876' },
          fonts: { heading: 'Cormorant Garamond', body: 'Source Serif Pro' },
          sections: ['personalInfo', 'executiveSummary', 'boardExperience', 'experience', 'achievements', 'education', 'recognitions']
        }
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
        canAccessFeature(user.subscriptionPlan, 'cvTemplates', template.planRequired)
      );

      return {
        templates: availableTemplates.map(({ templateData, ...template }) => template)
      };
    } catch (error) {
      logger.error('Error getting templates', { error: error instanceof Error ? error.message : String(error) });
      throw error instanceof AppError ? error : new AppError('Failed to fetch CV templates', 500);
    }
  }

  async createCvDocument(userId: string, data: CvDocumentData) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { 
          subscriptionPlan: true,
          firstName: true,
          lastName: true,
          email: true
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Verify template access
      const templates = this.getDefaultTemplates();
      const selectedTemplate = templates.find(t => t.id === data.templateId);
      
      if (!selectedTemplate) {
        throw new AppError('Template not found', 404);
      }

      if (!canAccessFeature(user.subscriptionPlan, 'cvTemplates', selectedTemplate.planRequired)) {
        throw new AppError('This template requires a higher subscription plan', 403);
      }

      // Generate CV content
      const cvContent = {
        template: selectedTemplate,
        data: {
          personalInfo: {
            name: data.personalInfo.name || `${user.firstName} ${user.lastName}`,
            email: data.personalInfo.email || user.email,
            ...data.personalInfo
          },
          experience: data.experience || [],
          education: data.education || [],
          skills: data.skills || [],
          projects: data.projects || [],
          certifications: data.certifications || [],
          languages: data.languages || []
        },
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0'
        }
      };

      // Calculate ATS score
      const atsScore = this.calculateAtsScore(cvContent);

      // Save CV to database
      const savedCv = await this.prisma.cV.create({
        data: {
          userId,
          name: `CV - ${selectedTemplate.name}`,
          fileUrl: '', // Will be updated after PDF generation
          fileType: 'application/pdf',
          fileSize: 0, // Will be updated after PDF generation
          parsedData: cvContent as any,
          atsScore,
          extractedSkills: data.skills.map(skill => skill.name),
          extractedEducation: data.education as any,
          extractedExperience: data.experience as any,
          suggestions: this.generateCvSuggestions(cvContent, atsScore) as any
        }
      });

      return {
        id: savedCv.id,
        templateId: data.templateId,
        content: cvContent,
        atsScore,
        suggestions: savedCv.suggestions
      };

    } catch (error) {
      logger.error('Error creating CV', { error: error instanceof Error ? error.message : String(error), userId });
      throw error instanceof AppError ? error : new AppError('Failed to create CV document', 500);
    }
  }

  async getUserCvs(userId: string) {
    try {
      const cvs = await this.prisma.cV.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          atsScore: true,
          createdAt: true,
          updatedAt: true,
          isDefault: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return { cvs };
    } catch (error) {
      logger.error('Error fetching user CVs', { error: error instanceof Error ? error.message : String(error), userId });
      throw new AppError('Failed to fetch CVs', 500);
    }
  }

  async getCvDocument(userId: string, cvId: string) {
    try {
      const cv = await this.prisma.cV.findFirst({
        where: { 
          id: cvId,
          userId 
        },
        select: {
          id: true,
          name: true,
          parsedData: true,
          atsScore: true,
          suggestions: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!cv) {
        throw new AppError('CV not found', 404);
      }

      return cv;
    } catch (error) {
      logger.error('Error fetching CV document', { error: error instanceof Error ? error.message : String(error), userId, cvId });
      throw error instanceof AppError ? error : new AppError('Failed to fetch CV document', 500);
    }
  }

  async updateCvDocument(userId: string, cvId: string, data: Partial<CvDocumentData>) {
    try {
      const existingCv = await this.prisma.cV.findFirst({
        where: { 
          id: cvId,
          userId 
        }
      });

      if (!existingCv) {
        throw new AppError('CV not found', 404);
      }

      const currentContent = existingCv.parsedData as any;
      
      // Update content with new data
      const updatedContent = {
        ...currentContent,
        data: {
          ...currentContent.data,
          ...data
        },
        metadata: {
          ...currentContent.metadata,
          updatedAt: new Date().toISOString(),
          version: this.incrementVersion(currentContent.metadata.version)
        }
      };

      // Recalculate ATS score
      const atsScore = this.calculateAtsScore(updatedContent);

      const updatedCv = await this.prisma.cV.update({
        where: { id: cvId },
        data: {
          parsedData: updatedContent as any,
          atsScore,
          extractedSkills: data.skills ? data.skills.map(skill => skill.name) : existingCv.extractedSkills,
          extractedEducation: (data.education || existingCv.extractedEducation) as any,
          extractedExperience: (data.experience || existingCv.extractedExperience) as any,
          suggestions: this.generateCvSuggestions(updatedContent, atsScore) as any,
          updatedAt: new Date()
        }
      });

      return {
        id: updatedCv.id,
        content: updatedContent,
        atsScore,
        suggestions: updatedCv.suggestions
      };

    } catch (error) {
      logger.error('Error updating CV document', { error: error instanceof Error ? error.message : String(error), userId, id: cvId });
      throw error instanceof AppError ? error : new AppError('Failed to update CV document', 500);
    }
  }

  async deleteCvDocument(userId: string, cvId: string) {
    try {
      const cv = await this.prisma.cV.findFirst({
        where: { 
          id: cvId,
          userId 
        }
      });

      if (!cv) {
        throw new AppError('CV not found', 404);
      }

      await this.prisma.cV.delete({
        where: { id: cvId }
      });

      return { success: true };
    } catch (error) {
      logger.error('Error deleting CV', { error: error instanceof Error ? error.message : String(error), userId, id: cvId });
      throw error instanceof AppError ? error : new AppError('Failed to delete CV document', 500);
    }
  }

  async exportCvToPdf(userId: string, cvId: string) {
    try {
      const cv = await this.prisma.cV.findFirst({
        where: { 
          id: cvId,
          userId 
        }
      });

      if (!cv) {
        throw new AppError('CV not found', 404);
      }

      const cvContent = cv.parsedData as any;
      if (!cvContent) {
        throw new AppError('CV content not found', 404);
      }

      // Prepare CV data for PDF generation
      const cvData: CvData = {
        template: cvContent.template,
        personalInfo: cvContent.data.personalInfo || {},
        experience: cvContent.data.experience || [],
        education: cvContent.data.education || [],
        skills: cvContent.data.skills || [],
        projects: cvContent.data.projects || [],
        certifications: cvContent.data.certifications || [],
        languages: cvContent.data.languages || []
      };

      // Generate PDF using the PDF generation service
      const pdfResult = await pdfGenerationService.generateCvPdf(cvData, cvId);
      
      // Update CV record with the actual PDF info
      await this.prisma.cV.update({
        where: { id: cvId },
        data: { 
          fileUrl: pdfResult.downloadUrl,
          fileSize: pdfResult.fileSize
        }
      });

      logger.info('PDF generated successfully', { 
        cvId, 
        userId, 
        fileName: pdfResult.fileName, 
        fileSize: pdfResult.fileSize 
      });

      return {
        downloadUrl: pdfResult.downloadUrl,
        fileName: pdfResult.fileName,
        fileSize: pdfResult.fileSize
      };

    } catch (error) {
      logger.error('Error exporting CV to PDF', { error: error instanceof Error ? error.message : String(error), userId, cvId });
      throw error instanceof AppError ? error : new AppError('Failed to export CV to PDF', 500);
    }
  }

  // ATS Score calculation algorithm
  private calculateAtsScore(cvContent: any): number {
    let score = 0;
    const data = cvContent.data;

    // Personal info completeness (20 points)
    if (data.personalInfo.name) score += 5;
    if (data.personalInfo.email) score += 5;
    if (data.personalInfo.phone) score += 5;
    if (data.personalInfo.location) score += 5;

    // Experience section (30 points)
    if (data.experience && data.experience.length > 0) {
      score += Math.min(data.experience.length * 10, 30);
    }

    // Education section (15 points)
    if (data.education && data.education.length > 0) {
      score += Math.min(data.education.length * 7.5, 15);
    }

    // Skills section (20 points)
    if (data.skills && data.skills.length > 0) {
      score += Math.min(data.skills.length * 2, 20);
    }

    // Content quality (15 points)
    const hasDescriptions = data.experience.some((exp: any) => exp.description && exp.description.length > 50);
    if (hasDescriptions) score += 15;

    // Template optimization bonus
    if (cvContent.template.templateData.atsOptimized) {
      score += 5;
    }

    return Math.min(Math.round(score), 100);
  }

  // Generate CV improvement suggestions
  private generateCvSuggestions(cvContent: any, atsScore: number): any {
    const suggestions = [];
    const data = cvContent.data;

    if (atsScore < 70) {
      suggestions.push({
        type: 'critical',
        message: 'Your CV needs significant improvement to pass ATS systems',
        action: 'Review and complete missing sections'
      });
    }

    if (!data.personalInfo.phone) {
      suggestions.push({
        type: 'warning',
        message: 'Add a phone number to improve employer contact options',
        action: 'Add phone number to personal info'
      });
    }

    if (!data.personalInfo.headline) {
      suggestions.push({
        type: 'info',
        message: 'Add a professional headline to make a strong first impression',
        action: 'Add professional headline'
      });
    }

    if (data.experience.length === 0) {
      suggestions.push({
        type: 'critical',
        message: 'Add work experience to showcase your professional background',
        action: 'Add work experience entries'
      });
    }

    if (data.skills.length < 5) {
      suggestions.push({
        type: 'warning',
        message: 'Add more relevant skills to improve keyword matching',
        action: 'Add 5-10 relevant skills'
      });
    }

    return suggestions;
  }

  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    const minor = parseInt(parts[1]) + 1;
    return `${parts[0]}.${minor}`;
  }
}

export default new CvService();
