import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';
import { AIMatchingService } from '../services/ai-matching.service.js';
import { HuggingFaceService } from '../services/huggingface.service.js';
import { emailService } from '../services/email.service.js';
import { cache } from '../config/redis.js';
import { z } from 'zod';

// Validation schemas
const InterviewScheduleSchema = z.object({
  jobId: z.string().uuid(),
  companyId: z.string().uuid(),
  interviewDate: z.string().datetime(),
  interviewType: z.enum(['phone', 'video', 'in-person', 'technical', 'behavioral', 'panel']),
  duration: z.number().min(15).max(480),
  interviewers: z.array(z.object({
    name: z.string(),
    role: z.string(),
    linkedinUrl: z.string().url().optional()
  })).optional(),
  location: z.string().optional(),
  meetingUrl: z.string().url().optional(),
  notes: z.string().optional()
});

const InterviewFeedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  technicalScore: z.number().min(0).max(100).optional(),
  culturalFitScore: z.number().min(0).max(100).optional(),
  communicationScore: z.number().min(0).max(100).optional(),
  overallRecommendation: z.enum(['strong-hire', 'hire', 'maybe', 'no-hire']),
  detailedFeedback: z.string(),
  nextSteps: z.string().optional()
});

export class InterviewController {
  private aiMatchingService: AIMatchingService;
  private huggingfaceService: HuggingFaceService;
  private emailService: typeof emailService;

  constructor() {
    this.aiMatchingService = new AIMatchingService();
    this.huggingfaceService = HuggingFaceService.getInstance();
    this.emailService = emailService;
  }

  /**
   *  Schedule an interview
   */
  scheduleInterview = async (req: Request, res: Response) => {
    try {
      const validatedData = InterviewScheduleSchema.parse(req.body);
      const userId = req.user?.id;

      logger.info(' Scheduling interview', { userId, jobId: validatedData.jobId });

      // Create interview record
      const interview = await prisma.interview.create({
        data: {
          userId,
          ...validatedData,
          status: 'SCHEDULED',
          createdAt: new Date(),
          reminders: {
            create: [
              { type: 'EMAIL', sendAt: new Date(validatedData.interviewDate).getTime() - 24 * 60 * 60 * 1000 }, // 24 hours before
              { type: 'EMAIL', sendAt: new Date(validatedData.interviewDate).getTime() - 60 * 60 * 1000 }, // 1 hour before
            ]
          }
        },
        include: {
          job: {
            include: {
              company: true
            }
          },
          reminders: true
        }
      });

      // Send confirmation email
      await this.emailService.sendInterviewScheduledEmail(userId, interview);

      // Cache interview data for quick access
      await cache.set(`interview:${interview.id}`, JSON.stringify(interview), 86400);

      res.status(201).json({
        success: true,
        data: interview,
        message: 'Interview scheduled successfully'
      });

    } catch (error) {
      logger.error('Error scheduling interview', { error, userId: req.user?.id });
      throw new AppError(500, 'Failed to schedule interview');
    }
  };

  /**
   *  Get AI-powered interview preparation
   */
  getInterviewPreparation = async (req: Request, res: Response) => {
    try {
      const { interviewId } = req.params;
      const userId = req.user?.id;

      logger.info(' Generating interview preparation', { userId, interviewId });

      // Get interview details
      const interview = await prisma.interview.findFirst({
        where: { id: interviewId, userId },
        include: {
          job: {
            include: {
              company: true,
              requirements: true
            }
          }
        }
      });

      if (!interview) {
        throw new AppError(404, 'Interview not found');
      }

      // Check cache first
      const cacheKey = `interview-prep:${interviewId}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached as string),
          cached: true
        });
      }

      // Get user profile for personalization
      const userProfile = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          experiences: true,
          skills: true
        }
      });

      // Generate comprehensive preparation
      const preparation = await this.generateComprehensivePreparation(interview, userProfile);

      // Cache for 12 hours
      await cache.set(cacheKey, JSON.stringify(preparation), 43200);

      res.json({
        success: true,
        data: preparation,
        message: 'Interview preparation generated successfully'
      });

    } catch (error) {
      logger.error('Error generating interview preparation', { error });
      throw new AppError(500, 'Failed to generate interview preparation');
    }
  };

  /**
   *  Get real-time interview coaching
   */
  getInterviewCoaching = async (req: Request, res: Response) => {
    try {
      const { interviewId } = req.params;
      const { question, userAnswer } = req.body;
      const userId = req.user?.id;

      logger.info(' Providing interview coaching', { userId, interviewId });

      // Analyze the answer using AI
      const analysis = await this.huggingfaceService.analyzeInterviewAnswer({
        question,
        answer: userAnswer,
        context: await this.getInterviewContext(interviewId)
      });

      // Generate improvement suggestions
      const coaching = {
        analysis,
        strengths: this.identifyAnswerStrengths(analysis),
        improvements: this.suggestImprovements(analysis),
        betterAnswer: await this.generateBetterAnswer(question, userAnswer, analysis),
        tips: this.getAnswerTips(question, analysis),
        score: this.calculateAnswerScore(analysis)
      };

      res.json({
        success: true,
        data: coaching,
        message: 'Coaching feedback generated'
      });

    } catch (error) {
      logger.error('Error providing interview coaching', { error });
      throw new AppError(500, 'Failed to provide coaching');
    }
  };

  /**
   *  Practice interview with AI
   */
  practiceInterview = async (req: Request, res: Response) => {
    try {
      const { jobId, interviewType = 'behavioral', difficulty = 'medium' } = req.body;
      const userId = req.user?.id;

      logger.info(' Starting practice interview', { userId, jobId, interviewType });

      // Get job details for context
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          company: true,
          requirements: true
        }
      });

      if (!job) {
        throw new AppError(404, 'Job not found');
      }

      // Generate practice questions based on job and interview type
      const questions = await this.generatePracticeQuestions(job, interviewType, difficulty);

      // Create practice session
      const session = await prisma.practiceSession.create({
        data: {
          userId,
          jobId,
          interviewType,
          difficulty,
          questions: questions,
          status: 'IN_PROGRESS',
          startedAt: new Date()
        }
      });

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          questions,
          estimatedDuration: questions.length * 3, // 3 minutes per question
          tips: this.getInterviewTypeTips(interviewType)
        },
        message: 'Practice interview started'
      });

    } catch (error) {
      logger.error('Error starting practice interview', { error });
      throw new AppError(500, 'Failed to start practice interview');
    }
  };

  /**
   *  Submit practice interview answers
   */
  submitPracticeAnswers = async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { answers } = req.body;
      const userId = req.user?.id;

      logger.info(' Evaluating practice interview', { userId, sessionId });

      // Get session
      const session = await prisma.practiceSession.findFirst({
        where: { id: sessionId, userId },
        include: {
          job: {
            include: {
              company: true
            }
          }
        }
      });

      if (!session) {
        throw new AppError(404, 'Practice session not found');
      }

      // Evaluate each answer
      const evaluations = await Promise.all(
        answers.map(async (answer: any) => {
          const evaluation = await this.evaluatePracticeAnswer(
            answer.question,
            answer.answer,
            session.job
          );
          return {
            question: answer.question,
            answer: answer.answer,
            evaluation
          };
        })
      );

      // Calculate overall score
      const overallScore = this.calculateOverallScore(evaluations);

      // Update session
      await prisma.practiceSession.update({
        where: { id: sessionId },
        data: {
          answers,
          evaluations,
          overallScore,
          completedAt: new Date(),
          status: 'COMPLETED'
        }
      });

      // Generate detailed feedback report
      const feedback = await this.generateDetailedFeedback(evaluations, session);

      res.json({
        success: true,
        data: {
          evaluations,
          overallScore,
          feedback,
          certificate: overallScore >= 80 ? await this.generateCertificate(session, overallScore) : null
        },
        message: 'Practice interview evaluated successfully'
      });

    } catch (error) {
      logger.error('Error evaluating practice interview', { error });
      throw new AppError(500, 'Failed to evaluate practice interview');
    }
  };

  /**
   *  Get interview performance analytics
   */
  getInterviewAnalytics = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { period = '30d' } = req.query;

      logger.info(' Getting interview analytics', { userId, period });

      // Get all interviews and practice sessions
      const [interviews, practiceSessions] = await Promise.all([
        prisma.interview.findMany({
          where: { userId },
          include: {
            feedback: true,
            job: {
              include: {
                company: true
              }
            }
          },
          orderBy: { interviewDate: 'desc' }
        }),
        prisma.practiceSession.findMany({
          where: { 
            userId,
            status: 'COMPLETED'
          },
          orderBy: { completedAt: 'desc' }
        })
      ]);

      // Calculate analytics
      const analytics = {
        summary: {
          totalInterviews: interviews.length,
          completedInterviews: interviews.filter(i => i.status === 'COMPLETED').length,
          upcomingInterviews: interviews.filter(i => i.status === 'SCHEDULED').length,
          averageRating: this.calculateAverageRating(interviews),
          practiceSessionsCompleted: practiceSessions.length,
          averagePracticeScore: this.calculateAveragePracticeScore(practiceSessions)
        },
        performance: {
          byType: this.analyzePerformanceByType(interviews),
          byCompany: this.analyzePerformanceByCompany(interviews),
          trends: this.analyzePerformanceTrends(interviews, period),
          strengths: this.identifyStrengths(interviews, practiceSessions),
          areasForImprovement: this.identifyImprovementAreas(interviews, practiceSessions)
        },
        insights: await this.generatePersonalizedInsights(interviews, practiceSessions),
        recommendations: await this.generateRecommendations(analytics)
      };

      res.json({
        success: true,
        data: analytics,
        message: 'Interview analytics generated successfully'
      });

    } catch (error) {
      logger.error('Error getting interview analytics', { error });
      throw new AppError(500, 'Failed to get interview analytics');
    }
  };

  /**
   *  Record mock interview video
   */
  recordMockInterview = async (req: Request, res: Response) => {
    try {
      const { sessionId, videoUrl, duration } = req.body;
      const userId = req.user?.id;

      logger.info(' Recording mock interview', { userId, sessionId });

      // Update session with video
      const session = await prisma.practiceSession.update({
        where: { 
          id: sessionId,
          userId 
        },
        data: {
          videoUrl,
          videoDuration: duration,
          hasVideo: true
        }
      });

      // Analyze video for body language and communication
      const videoAnalysis = await this.analyzeInterviewVideo(videoUrl);

      res.json({
        success: true,
        data: {
          session,
          videoAnalysis
        },
        message: 'Mock interview recorded successfully'
      });

    } catch (error) {
      logger.error('Error recording mock interview', { error });
      throw new AppError(500, 'Failed to record mock interview');
    }
  };

  /**
   *  Get interview checklist
   */
  getInterviewChecklist = async (req: Request, res: Response) => {
    try {
      const { interviewId } = req.params;
      const userId = req.user?.id;

      logger.info(' Getting interview checklist', { userId, interviewId });

      const interview = await prisma.interview.findFirst({
        where: { id: interviewId, userId },
        include: {
          job: {
            include: {
              company: true
            }
          }
        }
      });

      if (!interview) {
        throw new AppError(404, 'Interview not found');
      }

      const checklist = {
        preparation: [
          { task: 'Research company culture and values', completed: false, priority: 'high' },
          { task: 'Review job description thoroughly', completed: false, priority: 'high' },
          { task: 'Prepare STAR examples for behavioral questions', completed: false, priority: 'high' },
          { task: 'Practice technical questions if applicable', completed: false, priority: 'medium' },
          { task: 'Prepare thoughtful questions to ask', completed: false, priority: 'high' },
          { task: 'Review your resume and portfolio', completed: false, priority: 'medium' },
          { task: 'Check interviewer LinkedIn profiles', completed: false, priority: 'low' }
        ],
        logistics: [
          { task: 'Confirm interview time and location', completed: false, priority: 'high' },
          { task: 'Test video/audio equipment if virtual', completed: false, priority: 'high' },
          { task: 'Plan route and parking if in-person', completed: false, priority: 'high' },
          { task: 'Prepare professional attire', completed: false, priority: 'medium' },
          { task: 'Print copies of resume', completed: false, priority: 'low' },
          { task: 'Charge devices', completed: false, priority: 'medium' }
        ],
        dayOf: [
          { task: 'Review preparation notes', completed: false, priority: 'high' },
          { task: 'Arrive 10-15 minutes early', completed: false, priority: 'high' },
          { task: 'Bring water and mints', completed: false, priority: 'low' },
          { task: 'Turn off phone notifications', completed: false, priority: 'high' },
          { task: 'Take deep breaths and stay calm', completed: false, priority: 'medium' }
        ],
        followUp: [
          { task: 'Send thank you email within 24 hours', completed: false, priority: 'high' },
          { task: 'Connect on LinkedIn if appropriate', completed: false, priority: 'low' },
          { task: 'Follow up if no response after a week', completed: false, priority: 'medium' }
        ]
      };

      res.json({
        success: true,
        data: checklist,
        message: 'Interview checklist generated'
      });

    } catch (error) {
      logger.error('Error getting interview checklist', { error });
      throw new AppError(500, 'Failed to get interview checklist');
    }
  };

  // Private helper methods
  private async generateComprehensivePreparation(interview: any, userProfile: any) {
    return {
      companyResearch: await this.generateCompanyResearch(interview.job.company),
      likelyQuestions: await this.generateLikelyQuestions(interview),
      suggestedAnswers: await this.generateSuggestedAnswers(interview, userProfile),
      technicalTopics: await this.identifyTechnicalTopics(interview.job),
      behavioralScenarios: await this.generateBehavioralScenarios(interview.job),
      questionsToAsk: await this.generateQuestionsToAsk(interview.job.company),
      salaryGuidance: await this.generateSalaryGuidance(interview.job, userProfile),
      culturalFitTips: await this.generateCulturalFitTips(interview.job.company)
    };
  }

  private async generateCompanyResearch(company: any) {
    return {
      overview: company.description,
      mission: company.mission,
      values: company.values,
      recentNews: [], // Would fetch from news API
      competitorAnalysis: [],
      industryTrends: []
    };
  }

  private async generateLikelyQuestions(interview: any) {
    // Generate questions based on job requirements and interview type
    return [
      "Tell me about yourself",
      "Why are you interested in this position?",
      "What are your greatest strengths?",
      // Add more based on AI analysis
    ];
  }

  private async generateSuggestedAnswers(interview: any, userProfile: any) {
    // Generate personalized answers based on user's background
    return {};
  }

  private async identifyTechnicalTopics(job: any) {
    // Extract technical requirements from job description
    return [];
  }

  private async generateBehavioralScenarios(job: any) {
    // Generate STAR format scenarios
    return [];
  }

  private async generateQuestionsToAsk(company: any) {
    return [
      "What does success look like in this role?",
      "Can you describe the team I'll be working with?",
      "What are the biggest challenges facing the team right now?",
      // Add more intelligent questions
    ];
  }

  private async generateSalaryGuidance(job: any, userProfile: any) {
    return {
      marketRange: { min: 0, max: 0 },
      yourValue: 0,
      negotiationTips: []
    };
  }

  private async generateCulturalFitTips(company: any) {
    return [];
  }

  private async getInterviewContext(interviewId: string) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        job: {
          include: {
            company: true
          }
        }
      }
    });
    return interview;
  }

  private identifyAnswerStrengths(analysis: any) {
    return [];
  }

  private suggestImprovements(analysis: any) {
    return [];
  }

  private async generateBetterAnswer(question: string, userAnswer: string, analysis: any) {
    return "";
  }

  private getAnswerTips(question: string, analysis: any) {
    return [];
  }

  private calculateAnswerScore(analysis: any) {
    return 0;
  }

  private async generatePracticeQuestions(job: any, interviewType: string, difficulty: string) {
    // Generate questions based on job and parameters
    return [];
  }

  private getInterviewTypeTips(interviewType: string) {
    const tips = {
      behavioral: [
        "Use the STAR method",
        "Provide specific examples",
        "Focus on your actions and results"
      ],
      technical: [
        "Think out loud",
        "Ask clarifying questions",
        "Consider edge cases"
      ],
      panel: [
        "Make eye contact with all panelists",
        "Address the person who asked the question",
        "Take notes on panel members' names and roles"
      ]
    };
    return tips[interviewType] || [];
  }

  private async evaluatePracticeAnswer(question: string, answer: string, job: any) {
    return {
      score: 0,
      feedback: "",
      strengths: [],
      improvements: []
    };
  }

  private calculateOverallScore(evaluations: any[]) {
    return 0;
  }

  private async generateDetailedFeedback(evaluations: any[], session: any) {
    return {
      summary: "",
      strengths: [],
      improvements: [],
      nextSteps: []
    };
  }

  private async generateCertificate(session: any, score: number) {
    return {
      certificateId: "",
      url: "",
      validUntil: new Date()
    };
  }

  private calculateAverageRating(interviews: any[]) {
    return 0;
  }

  private calculateAveragePracticeScore(sessions: any[]) {
    return 0;
  }

  private analyzePerformanceByType(interviews: any[]) {
    return {};
  }

  private analyzePerformanceByCompany(interviews: any[]) {
    return {};
  }

  private analyzePerformanceTrends(interviews: any[], period: string) {
    return [];
  }

  private identifyStrengths(interviews: any[], sessions: any[]) {
    return [];
  }

  private identifyImprovementAreas(interviews: any[], sessions: any[]) {
    return [];
  }

  private async generatePersonalizedInsights(interviews: any[], sessions: any[]) {
    return [];
  }

  private async generateRecommendations(analytics: any) {
    return [];
  }

  private async analyzeInterviewVideo(videoUrl: string) {
    return {
      bodyLanguage: {
        eyeContact: 0,
        posture: 0,
        gestures: 0
      },
      speech: {
        pace: "moderate",
        clarity: 0,
        fillerWords: []
      },
      overall: {
        confidence: 0,
        engagement: 0,
        professionalism: 0
      }
    };
  }

  /**
   *  Get upcoming interviews
   */
  getUpcomingInterviews = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      
      const interviews = await prisma.interview.findMany({
        where: {
          userId,
          status: 'SCHEDULED',
          interviewDate: {
            gte: new Date()
          }
        },
        include: {
          job: {
            include: {
              company: true
            }
          }
        },
        orderBy: {
          interviewDate: 'asc'
        }
      });

      res.json({
        success: true,
        data: interviews,
        message: 'Upcoming interviews retrieved'
      });

    } catch (error) {
      logger.error('Error getting upcoming interviews', { error });
      throw new AppError(500, 'Failed to get upcoming interviews');
    }
  };

  /**
   *  Update interview details
   */
  updateInterview = async (req: Request, res: Response) => {
    try {
      const { interviewId } = req.params;
      const userId = req.user?.id;
      const updates = req.body;

      const interview = await prisma.interview.update({
        where: {
          id: interviewId,
          userId
        },
        data: updates
      });

      res.json({
        success: true,
        data: interview,
        message: 'Interview updated successfully'
      });

    } catch (error) {
      logger.error('Error updating interview', { error });
      throw new AppError(500, 'Failed to update interview');
    }
  };

  /**
   *  Cancel interview
   */
  cancelInterview = async (req: Request, res: Response) => {
    try {
      const { interviewId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;

      const interview = await prisma.interview.update({
        where: {
          id: interviewId,
          userId
        },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: new Date()
        }
      });

      // Send cancellation email
      await this.emailService.sendInterviewCancelledEmail(userId, interview);

      res.json({
        success: true,
        data: interview,
        message: 'Interview cancelled successfully'
      });

    } catch (error) {
      logger.error('Error cancelling interview', { error });
      throw new AppError(500, 'Failed to cancel interview');
    }
  };

  /**
   *  Submit interview feedback
   */
  submitFeedback = async (req: Request, res: Response) => {
    try {
      const { interviewId } = req.params;
      const userId = req.user?.id;
      const validatedData = InterviewFeedbackSchema.parse(req.body);

      const feedback = await prisma.interviewFeedback.create({
        data: {
          interviewId,
          userId,
          ...validatedData
        }
      });

      // Update interview status
      await prisma.interview.update({
        where: { id: interviewId },
        data: { status: 'COMPLETED' }
      });

      res.json({
        success: true,
        data: feedback,
        message: 'Feedback submitted successfully'
      });

    } catch (error) {
      logger.error('Error submitting feedback', { error });
      throw new AppError(500, 'Failed to submit feedback');
    }
  };
}
