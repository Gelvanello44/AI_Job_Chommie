import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import aiService from './ai.service';

const prisma = new PrismaClient();

// Template Schema
const TemplateSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(), // null for system templates
  title: z.string(),
  category: z.enum([
    'thank_you',
    'follow_up',
    'check_in',
    'networking',
    'rejection_response',
    'offer_negotiation',
    'reference_request',
    'introduction',
    'informational_interview'
  ]),
  applicationStatus: z.enum([
    'applied',
    'screening',
    'interview_scheduled',
    'interviewed',
    'offer',
    'rejected',
    'any'
  ]).optional(),
  subject: z.string(),
  content: z.string(),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    defaultValue: z.string().optional()
  })),
  tone: z.enum(['professional', 'friendly', 'enthusiastic', 'formal']).default('professional'),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().default(false),
  usageCount: z.number().default(0),
  rating: z.number().min(0).max(5).optional()
});

type Template = z.infer<typeof TemplateSchema>;

export class TemplateLibraryService {
  private systemTemplates: Template[] = [
    {
      id: 'sys_1',
      title: 'Post-Interview Thank You',
      category: 'thank_you',
      applicationStatus: 'interviewed',
      subject: 'Thank you - {{position}} Interview at {{company}}',
      content: `Dear {{interviewer_name}},

Thank you for taking the time to meet with me {{interview_date}} to discuss the {{position}} role at {{company}}.

I was particularly excited to learn about {{specific_topic}} and how the team is {{team_initiative}}. Our conversation reinforced my interest in joining {{company}} and contributing to {{contribution_area}}.

{{additional_thoughts}}

I look forward to the next steps in the process. Please don't hesitate to reach out if you need any additional information from me.

Best regards,
{{your_name}}`,
      variables: [
        { name: 'interviewer_name', description: 'Name of the interviewer' },
        { name: 'interview_date', description: 'Date of the interview', defaultValue: 'today' },
        { name: 'position', description: 'Position title' },
        { name: 'company', description: 'Company name' },
        { name: 'specific_topic', description: 'Specific topic discussed that excited you' },
        { name: 'team_initiative', description: 'Team initiative or project discussed' },
        { name: 'contribution_area', description: 'Area where you can contribute' },
        { name: 'additional_thoughts', description: 'Any additional thoughts (optional)', defaultValue: '' },
        { name: 'your_name', description: 'Your full name' }
      ],
      tone: 'professional',
      tags: ['interview', 'thank-you'],
      isPublic: true,
      usageCount: 0
    },
    {
      id: 'sys_2',
      title: 'Application Follow-Up',
      category: 'follow_up',
      applicationStatus: 'applied',
      subject: 'Following up on my application - {{position}} at {{company}}',
      content: `Dear {{hiring_manager}} / Hiring Team,

I hope this email finds you well. I recently submitted my application for the {{position}} role at {{company}} on {{application_date}}, and I wanted to follow up to reiterate my strong interest in this opportunity.

With my background in {{relevant_experience}}, I'm confident I can contribute to {{team_goal}}. I'm particularly drawn to {{company_attraction}}.

I understand you may be reviewing many applications. I'm happy to provide any additional information that might be helpful in evaluating my candidacy.

Thank you for your consideration. I look forward to the opportunity to discuss how I can contribute to your team.

Best regards,
{{your_name}}
{{phone_number}}
{{email}}`,
      variables: [
        { name: 'hiring_manager', description: 'Hiring manager name (if known)', defaultValue: 'Hiring Manager' },
        { name: 'position', description: 'Position title' },
        { name: 'company', description: 'Company name' },
        { name: 'application_date', description: 'Date you applied' },
        { name: 'relevant_experience', description: 'Your relevant experience/skills' },
        { name: 'team_goal', description: 'Team or company goal you can help with' },
        { name: 'company_attraction', description: 'What attracts you to the company' },
        { name: 'your_name', description: 'Your full name' },
        { name: 'phone_number', description: 'Your phone number' },
        { name: 'email', description: 'Your email address' }
      ],
      tone: 'professional',
      tags: ['follow-up', 'application'],
      isPublic: true,
      usageCount: 0
    },
    {
      id: 'sys_3',
      title: 'Networking Connection Request',
      category: 'networking',
      applicationStatus: 'any',
      subject: 'Connecting with a fellow {{industry}} professional',
      content: `Hi {{contact_name}},

I came across your profile while {{how_found}}, and I'm impressed by your work in {{their_expertise}}.

I'm currently {{your_situation}} and would love to connect with professionals in the {{industry}} space. {{specific_interest}}

Would you be open to a brief {{meeting_type}} to discuss {{discussion_topic}}? I'd be happy to work around your schedule.

Thank you for considering my request.

Best regards,
{{your_name}}`,
      variables: [
        { name: 'contact_name', description: 'Contact person\'s name' },
        { name: 'how_found', description: 'How you found them', defaultValue: 'researching leaders in the industry' },
        { name: 'their_expertise', description: 'Their area of expertise' },
        { name: 'your_situation', description: 'Your current situation', defaultValue: 'exploring new opportunities' },
        { name: 'industry', description: 'Industry name' },
        { name: 'specific_interest', description: 'Specific interest or question' },
        { name: 'meeting_type', description: 'Type of meeting', defaultValue: 'virtual coffee chat' },
        { name: 'discussion_topic', description: 'What you want to discuss' },
        { name: 'your_name', description: 'Your full name' }
      ],
      tone: 'friendly',
      tags: ['networking', 'connection'],
      isPublic: true,
      usageCount: 0
    },
    {
      id: 'sys_4',
      title: 'Gracious Rejection Response',
      category: 'rejection_response',
      applicationStatus: 'rejected',
      subject: 'Re: {{position}} at {{company}} - Thank you',
      content: `Dear {{recruiter_name}},

Thank you for letting me know about your decision regarding the {{position}} role. While I'm disappointed, I appreciate you taking the time to inform me.

I remain very interested in {{company}} and would welcome the opportunity to be considered for future roles that align with my skills in {{your_skills}}.

{{feedback_request}}

Thank you again for your time and consideration throughout the process. I hope our paths cross again in the future.

Best regards,
{{your_name}}`,
      variables: [
        { name: 'recruiter_name', description: 'Recruiter or hiring manager name' },
        { name: 'position', description: 'Position title' },
        { name: 'company', description: 'Company name' },
        { name: 'your_skills', description: 'Your key skills' },
        { name: 'feedback_request', description: 'Optional: Request for feedback', defaultValue: 'If possible, I would appreciate any feedback that could help me in my job search.' },
        { name: 'your_name', description: 'Your full name' }
      ],
      tone: 'professional',
      tags: ['rejection', 'follow-up'],
      isPublic: true,
      usageCount: 0
    },
    {
      id: 'sys_5',
      title: 'Reference Request',
      category: 'reference_request',
      applicationStatus: 'any',
      subject: 'Reference Request - {{your_name}}',
      content: `Dear {{reference_name}},

I hope this message finds you well. {{opening_context}}

I'm currently in the final stages of interviews for a {{position}} role at {{company}}, and they've requested professional references. Given our work together at {{previous_company}}, I believe you could speak to my {{skills_to_highlight}}.

The role involves {{role_responsibilities}}, which aligns well with the work we did on {{relevant_project}}.

Would you be willing to serve as a reference? If yes, may I share your contact information with them? They may reach out in the next {{timeline}}.

I'm happy to provide any additional information that might be helpful, including a summary of my key accomplishments or the job description.

Thank you for considering this request.

Warm regards,
{{your_name}}`,
      variables: [
        { name: 'reference_name', description: 'Reference person\'s name' },
        { name: 'opening_context', description: 'Opening context', defaultValue: 'It\'s been a while since we last connected.' },
        { name: 'position', description: 'Position you\'re applying for' },
        { name: 'company', description: 'Company name' },
        { name: 'previous_company', description: 'Where you worked together' },
        { name: 'skills_to_highlight', description: 'Skills they can speak to' },
        { name: 'role_responsibilities', description: 'Key responsibilities of the new role' },
        { name: 'relevant_project', description: 'Relevant project you worked on together' },
        { name: 'timeline', description: 'When they might be contacted', defaultValue: 'week' },
        { name: 'your_name', description: 'Your full name' }
      ],
      tone: 'friendly',
      tags: ['reference', 'request'],
      isPublic: true,
      usageCount: 0
    }
  ];

  /**
   * Get contextual templates based on application status
   */
  async getContextualTemplates(userId: string, applicationId: string): Promise<Template[]> {
    try {
      // Get application details
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: true,
          user: true
        }
      });

      if (!application) {
        throw new Error('Application not found');
      }

      // Get user's custom templates
      const userTemplates = await prisma.emailTemplate.findMany({
        where: {
          userId,
          OR: [
            { applicationStatus: application.status },
            { applicationStatus: 'any' }
          ]
        }
      });

      // Filter system templates by status
      const relevantSystemTemplates = this.systemTemplates.filter(
        t => t.applicationStatus === application.status || t.applicationStatus === 'any'
      );

      // Combine and format templates
      const allTemplates = [
        ...relevantSystemTemplates,
        ...userTemplates.map(this.formatTemplate)
      ];

      // Pre-fill variables with application data
      return allTemplates.map(template => ({
        ...template,
        variables: template.variables.map(variable => {
          let defaultValue = variable.defaultValue;
          
          // Auto-fill known variables
          switch (variable.name) {
            case 'position':
              defaultValue = application.job.title;
              break;
            case 'company':
              defaultValue = application.job.company;
              break;
            case 'your_name':
              defaultValue = application.user.name || '';
              break;
            case 'email':
              defaultValue = application.user.email;
              break;
            case 'application_date':
              defaultValue = application.createdAt.toLocaleDateString();
              break;
          }
          
          return { ...variable, defaultValue };
        })
      }));
    } catch (error) {
      console.error('Error getting contextual templates:', error);
      throw new Error('Failed to get contextual templates');
    }
  }

  /**
   * Get all templates for a category
   */
  async getTemplatesByCategory(category: string, userId?: string): Promise<Template[]> {
    try {
      // Get system templates
      const systemTemplatesFiltered = this.systemTemplates.filter(
        t => t.category === category
      );

      // Get user templates if userId provided
      let userTemplates: any[] = [];
      if (userId) {
        userTemplates = await prisma.emailTemplate.findMany({
          where: {
            userId,
            category
          }
        });
      }

      // Get public templates from other users
      const publicTemplates = await prisma.emailTemplate.findMany({
        where: {
          category,
          isPublic: true,
          userId: { not: userId }
        },
        take: 10,
        orderBy: [
          { rating: 'desc' },
          { usageCount: 'desc' }
        ]
      });

      return [
        ...systemTemplatesFiltered,
        ...userTemplates.map(this.formatTemplate),
        ...publicTemplates.map(this.formatTemplate)
      ];
    } catch (error) {
      console.error('Error getting templates by category:', error);
      throw new Error('Failed to get templates');
    }
  }

  /**
   * Create custom template
   */
  async createTemplate(templateData: Partial<Template>): Promise<Template> {
    try {
      const validated = TemplateSchema.parse(templateData);
      
      const template = await prisma.emailTemplate.create({
        data: {
          userId: validated.userId,
          title: validated.title,
          category: validated.category,
          applicationStatus: validated.applicationStatus,
          subject: validated.subject,
          content: validated.content,
          variables: JSON.stringify(validated.variables),
          tone: validated.tone,
          tags: JSON.stringify(validated.tags || []),
          isPublic: validated.isPublic
        }
      });

      return this.formatTemplate(template);
    } catch (error) {
      console.error('Error creating template:', error);
      throw new Error('Failed to create template');
    }
  }

  /**
   * Generate AI-powered template
   */
  async generateTemplate(params: {
    userId: string;
    category: string;
    context: string;
    tone?: string;
    additionalInfo?: string;
  }): Promise<Template> {
    try {
      const prompt = `Create a professional email template for the following:
        Category: ${params.category}
        Context: ${params.context}
        Tone: ${params.tone || 'professional'}
        Additional Info: ${params.additionalInfo || 'None'}
        
        The template should:
        1. Have a clear subject line with variables in {{variable_name}} format
        2. Include appropriate variables for personalization
        3. Be concise but complete
        4. Match the requested tone
        5. Include a proper greeting and closing
        
        Return in this JSON format:
        {
          "subject": "Email subject with {{variables}}",
          "content": "Email body with {{variables}}",
          "variables": [
            {"name": "variable_name", "description": "What this variable represents", "defaultValue": "optional default"}
          ],
          "suggestedTitle": "Template title"
        }`;

      const aiResponse = await aiService.generateText(prompt);
      const generated = JSON.parse(aiResponse);

      // Create the template
      return await this.createTemplate({
        userId: params.userId,
        title: generated.suggestedTitle,
        category: params.category as any,
        subject: generated.subject,
        content: generated.content,
        variables: generated.variables,
        tone: (params.tone || 'professional') as any,
        applicationStatus: 'any'
      });
    } catch (error) {
      console.error('Error generating template:', error);
      throw new Error('Failed to generate template');
    }
  }

  /**
   * Fill template with data
   */
  fillTemplate(template: Template, data: Record<string, string>): {
    subject: string;
    content: string;
  } {
    let subject = template.subject;
    let content = template.content;

    // Replace variables in subject and content
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      content = content.replace(new RegExp(placeholder, 'g'), value);
    }

    // Replace any remaining variables with defaults or empty string
    for (const variable of template.variables) {
      const placeholder = `{{${variable.name}}}`;
      const value = data[variable.name] || variable.defaultValue || '';
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      content = content.replace(new RegExp(placeholder, 'g'), value);
    }

    return { subject, content };
  }

  /**
   * Track template usage
   */
  async trackUsage(templateId: string): Promise<void> {
    try {
      await prisma.emailTemplate.update({
        where: { id: templateId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error tracking template usage:', error);
    }
  }

  /**
   * Rate template
   */
  async rateTemplate(templateId: string, userId: string, rating: number): Promise<void> {
    try {
      // Store rating
      await prisma.templateRating.upsert({
        where: {
          userId_templateId: {
            userId,
            templateId
          }
        },
        update: { rating },
        create: {
          userId,
          templateId,
          rating
        }
      });

      // Update average rating
      const ratings = await prisma.templateRating.findMany({
        where: { templateId }
      });

      const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

      await prisma.emailTemplate.update({
        where: { id: templateId },
        data: { rating: avgRating }
      });
    } catch (error) {
      console.error('Error rating template:', error);
    }
  }

  /**
   * Get template suggestions based on user behavior
   */
  async getTemplateSuggestions(userId: string): Promise<Template[]> {
    try {
      // Get user's recent applications
      const recentApplications = await prisma.application.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 5
      });

      // Determine most common statuses
      const statusCounts = recentApplications.reduce((acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostCommonStatus = Object.entries(statusCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0];

      // Get templates for common status
      const suggestions = this.systemTemplates.filter(
        t => t.applicationStatus === mostCommonStatus || t.applicationStatus === 'any'
      );

      // Get popular templates
      const popularTemplates = await prisma.emailTemplate.findMany({
        where: {
          isPublic: true,
          rating: { gte: 4 }
        },
        orderBy: { usageCount: 'desc' },
        take: 3
      });

      return [
        ...suggestions.slice(0, 3),
        ...popularTemplates.map(this.formatTemplate)
      ];
    } catch (error) {
      console.error('Error getting template suggestions:', error);
      return this.systemTemplates.slice(0, 5);
    }
  }

  /**
   * Format template from database
   */
  private formatTemplate(dbTemplate: any): Template {
    return {
      ...dbTemplate,
      variables: typeof dbTemplate.variables === 'string' 
        ? JSON.parse(dbTemplate.variables) 
        : dbTemplate.variables,
      tags: typeof dbTemplate.tags === 'string' 
        ? JSON.parse(dbTemplate.tags) 
        : dbTemplate.tags
    };
  }
}

export default new TemplateLibraryService();
