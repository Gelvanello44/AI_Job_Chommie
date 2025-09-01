import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { AppError } from '../utils/AppError.js';
import logger from '../config/logger.js';

export interface CvData {
  template: {
    id: string;
    name: string;
    templateData: any;
  };
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

export class PdfGenerationService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'cv');
    this.ensureUploadsDirectory();
  }

  private async ensureUploadsDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  async generateCvPdf(cvData: CvData, cvId: string): Promise<{ filePath: string; fileName: string; fileSize: number; downloadUrl: string }> {
    try {
      logger.info('Starting CV PDF generation', { cvId, template: cvData.template.id });
      
      // Generate HTML from CV data
      const html = this.generateHtmlFromCvData(cvData);
      
      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      // Set page format for CV
      await page.emulateMediaType('print');
      
      const fileName = `cv-${cvId}-${Date.now()}.pdf`;
      const filePath = path.join(this.uploadsDir, fileName);
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
      
      await browser.close();
      
      // Save PDF file
      await fs.writeFile(filePath, pdfBuffer);
      const stats = await fs.stat(filePath);
      
      logger.info('CV PDF generated successfully', { 
        cvId, 
        fileName, 
        fileSize: stats.size 
      });
      
      return {
        filePath,
        fileName,
        fileSize: stats.size,
        downloadUrl: `/api/v1/cv/documents/${cvId}/download`
      };
      
    } catch (error) {
      logger.error('Error generating CV PDF', { 
        error: error instanceof Error ? error.message : String(error), 
        cvId 
      });
      throw new AppError('Failed to generate PDF', 500);
    }
  }

  private generateHtmlFromCvData(cvData: CvData): string {
    const { template } = cvData;
    
    // Generate HTML based on template
    switch (template.id) {
      case 'ats-optimized':
        return this.generateAtsOptimizedTemplate(cvData);
      case 'professional-executive':
        return this.generateProfessionalExecutiveTemplate(cvData);
      case 'leadership-focused':
        return this.generateLeadershipFocusedTemplate(cvData);
      case 'c-suite-premium':
        return this.generateCSuitePremiumTemplate(cvData);
      default:
        return this.generateModernBasicTemplate(cvData);
    }
  }

  private generateModernBasicTemplate(data: any): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CV - ${data.personalInfo.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333;
          font-size: 11pt;
        }
        .container { max-width: 100%; margin: 0; padding: 0; }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white; 
          padding: 30px; 
          text-align: center; 
        }
        .header h1 { font-size: 28pt; margin-bottom: 10px; font-weight: 300; }
        .header .contact { font-size: 12pt; margin-top: 15px; }
        .contact span { margin: 0 15px; }
        .section { margin: 25px 0; padding: 0 30px; }
        .section h2 { 
          color: #667eea; 
          font-size: 16pt; 
          margin-bottom: 15px; 
          padding-bottom: 8px;
          border-bottom: 2px solid #667eea;
        }
        .summary { 
          font-style: italic; 
          color: #666; 
          margin-bottom: 20px;
          font-size: 12pt;
        }
        .experience-item, .education-item { margin-bottom: 20px; }
        .experience-item h3 { color: #333; font-size: 14pt; margin-bottom: 5px; }
        .experience-item .company { color: #667eea; font-weight: bold; }
        .experience-item .duration { color: #666; font-size: 10pt; }
        .skills-container { display: flex; flex-wrap: wrap; gap: 10px; }
        .skill-tag { 
          background: #f0f4ff; 
          color: #667eea; 
          padding: 5px 12px; 
          border-radius: 15px; 
          font-size: 10pt;
          border: 1px solid #e0e8ff;
        }
        .education-item h3 { color: #333; font-size: 13pt; }
        .education-item .institution { color: #667eea; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${data.personalInfo.name || 'Your Name'}</h1>
          ${data.personalInfo.headline ? `<div style="font-size: 14pt; margin-top: 5px;">${data.personalInfo.headline}</div>` : ''}
          <div class="contact">
            ${data.personalInfo.email ? `<span> ${data.personalInfo.email}</span>` : ''}
            ${data.personalInfo.phone ? `<span> ${data.personalInfo.phone}</span>` : ''}
            ${data.personalInfo.location ? `<span> ${data.personalInfo.location}</span>` : ''}
          </div>
        </div>

        ${data.personalInfo.summary ? `
        <div class="section">
          <h2>Professional Summary</h2>
          <div class="summary">${data.personalInfo.summary}</div>
        </div>
        ` : ''}

        ${data.experience?.length > 0 ? `
        <div class="section">
          <h2>Professional Experience</h2>
          ${data.experience.map((exp: any) => `
            <div class="experience-item">
              <h3>${exp.role}</h3>
              <div class="company">${exp.company}</div>
              <div class="duration">${this.formatDate(exp.startDate)} - ${exp.endDate ? this.formatDate(exp.endDate) : 'Present'}</div>
              ${exp.description ? `<div style="margin-top: 8px;">${exp.description}</div>` : ''}
              ${exp.achievements?.length > 0 ? `
                <ul style="margin-top: 8px; margin-left: 20px;">
                  ${exp.achievements.map((achievement: string) => `<li>${achievement}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${data.skills?.length > 0 ? `
        <div class="section">
          <h2>Skills & Expertise</h2>
          <div class="skills-container">
            ${data.skills.map((skill: any) => `
              <div class="skill-tag">${skill.name}</div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        ${data.education?.length > 0 ? `
        <div class="section">
          <h2>Education</h2>
          ${data.education.map((edu: any) => `
            <div class="education-item">
              <h3>${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}</h3>
              <div class="institution">${edu.institution}</div>
              <div class="duration">${this.formatDate(edu.startDate)} - ${edu.endDate ? this.formatDate(edu.endDate) : 'Present'}</div>
              ${edu.grade ? `<div style="color: #666;">Grade: ${edu.grade}</div>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${data.certifications?.length > 0 ? `
        <div class="section">
          <h2>Certifications</h2>
          ${data.certifications.map((cert: any) => `
            <div style="margin-bottom: 10px;">
              <strong>${cert.name}</strong><br>
              <span style="color: #667eea;">${cert.issuer}</span> • <span style="color: #666;">${this.formatDate(cert.date)}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${data.projects?.length > 0 ? `
        <div class="section">
          <h2>Projects</h2>
          ${data.projects.map((project: any) => `
            <div style="margin-bottom: 15px;">
              <h3 style="color: #333; font-size: 13pt;">${project.name}</h3>
              <div>${project.description}</div>
              ${project.technologies?.length > 0 ? `
                <div style="margin-top: 5px;">
                  <strong>Technologies:</strong> ${project.technologies.join(', ')}
                </div>
              ` : ''}
              ${project.url ? `<div style="margin-top: 5px; color: #667eea;">${project.url}</div>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${data.languages?.length > 0 ? `
        <div class="section">
          <h2>Languages</h2>
          ${data.languages.map((lang: any) => `
            <span style="display: inline-block; margin-right: 20px; margin-bottom: 5px;">
              <strong>${lang.language}</strong> - ${lang.proficiency}
            </span>
          `).join('')}
        </div>
        ` : ''}
      </div>
    </body>
    </html>`;
  }

  private generateAtsOptimizedTemplate(data: any): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>CV - ${data.personalInfo.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.5; 
          color: #000;
          font-size: 11pt;
          margin: 20px;
        }
        h1 { font-size: 24pt; margin-bottom: 10px; }
        h2 { font-size: 14pt; margin: 20px 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
        h3 { font-size: 12pt; margin: 10px 0 5px 0; }
        .contact { margin-bottom: 20px; }
        .contact div { margin-bottom: 3px; }
        .section { margin-bottom: 25px; }
        .experience-item, .education-item { margin-bottom: 15px; }
        .duration { color: #666; margin-bottom: 5px; }
        ul { margin-left: 20px; margin-top: 5px; }
      </style>
    </head>
    <body>
      <h1>${data.personalInfo.name || 'Your Name'}</h1>
      
      <div class="contact">
        ${data.personalInfo.email ? `<div>Email: ${data.personalInfo.email}</div>` : ''}
        ${data.personalInfo.phone ? `<div>Phone: ${data.personalInfo.phone}</div>` : ''}
        ${data.personalInfo.location ? `<div>Location: ${data.personalInfo.location}</div>` : ''}
      </div>

      ${data.personalInfo.summary ? `
      <div class="section">
        <h2>PROFESSIONAL SUMMARY</h2>
        <div>${data.personalInfo.summary}</div>
      </div>
      ` : ''}

      ${data.experience?.length > 0 ? `
      <div class="section">
        <h2>PROFESSIONAL EXPERIENCE</h2>
        ${data.experience.map((exp: any) => `
          <div class="experience-item">
            <h3>${exp.role}</h3>
            <div><strong>${exp.company}</strong></div>
            <div class="duration">${this.formatDate(exp.startDate)} - ${exp.endDate ? this.formatDate(exp.endDate) : 'Present'}</div>
            ${exp.description ? `<div>${exp.description}</div>` : ''}
            ${exp.achievements?.length > 0 ? `
              <ul>
                ${exp.achievements.map((achievement: string) => `<li>${achievement}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${data.skills?.length > 0 ? `
      <div class="section">
        <h2>SKILLS</h2>
        <div>${data.skills.map((skill: any) => skill.name).join(' • ')}</div>
      </div>
      ` : ''}

      ${data.education?.length > 0 ? `
      <div class="section">
        <h2>EDUCATION</h2>
        ${data.education.map((edu: any) => `
          <div class="education-item">
            <h3>${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}</h3>
            <div><strong>${edu.institution}</strong></div>
            <div class="duration">${this.formatDate(edu.startDate)} - ${edu.endDate ? this.formatDate(edu.endDate) : 'Present'}</div>
            ${edu.grade ? `<div>Grade: ${edu.grade}</div>` : ''}
          </div>
        `).join('')}
      </div>
      ` : ''}
    </body>
    </html>`;
  }

  private generateProfessionalExecutiveTemplate(data: any): string {
    // Similar structure with more sophisticated styling for executive template
    return this.generateModernBasicTemplate(data); // Using basic as fallback for now
  }

  private generateLeadershipFocusedTemplate(data: any): string {
    // Leadership-focused template would emphasize achievements and leadership
    return this.generateModernBasicTemplate(data); // Using basic as fallback for now
  }

  private generateCSuitePremiumTemplate(data: any): string {
    // Premium template for C-suite executives
    return this.generateModernBasicTemplate(data); // Using basic as fallback for now
  }

  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short'
      });
    } catch {
      return dateString;
    }
  }

  async deletePdfFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info('PDF file deleted', { filePath });
    } catch (error) {
      logger.warn('Failed to delete PDF file', { 
        filePath, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

export default new PdfGenerationService();
