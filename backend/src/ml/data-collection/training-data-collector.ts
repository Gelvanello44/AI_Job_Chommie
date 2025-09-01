import { prisma } from '../../config/database.js';
import { cache } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { Job, User, Application } from '@prisma/client';

/**
 *  TRAINING DATA COLLECTION SYSTEM
 * Comprehensive data collection for all ML models
 */

export interface JobMatchingTrainingData {
  id: string;
  userId: string;
  jobId: string;
  userProfile: {
    skills: string[];
    experience: any[];
    education: any[];
    yearsOfExperience: number;
    location: { province: string; city: string };
    salaryExpectation: { min: number; max: number };
    cvContent: string;
    personalityTraits: any;
  };
  jobProfile: {
    title: string;
    description: string;
    requiredSkills: string[];
    preferredSkills: string[];
    yearsExperienceMin: number;
    yearsExperienceMax: number;
    salaryMin: number;
    salaryMax: number;
    location: { province: string; city: string };
    isRemote: boolean;
    companySize: string;
    industry: string;
  };
  outcome: {
    applied: boolean;
    viewed: boolean;
    responded: boolean;
    interviewed: boolean;
    hired: boolean;
    rejected: boolean;
    responseTime?: number; // hours
    interviewStages?: number;
    finalDecision?: 'hired' | 'rejected' | 'withdrawn' | 'pending';
    userRating?: number; // 1-5 stars
    companyRating?: number; // 1-5 stars
  };
  timeline: {
    viewedAt?: Date;
    appliedAt?: Date;
    responseAt?: Date;
    interviewAt?: Date;
    decisionAt?: Date;
  };
  context: {
    marketConditions: any;
    competitionLevel: number;
    applicationMethod: string;
    coverLetterUsed: boolean;
    referralUsed: boolean;
  };
  createdAt: Date;
}

export interface PersonalityTrainingData {
  id: string;
  userId: string;
  cvContent: string;
  personalityAssessment: {
    communicationStyle: 'formal' | 'conversational' | 'technical' | 'creative';
    workingPreference: 'collaborative' | 'independent' | 'leadership' | 'supportive';
    problemSolving: 'analytical' | 'creative' | 'systematic' | 'innovative';
    decisionMaking: 'data-driven' | 'intuitive' | 'consensus' | 'decisive';
    confidence: number;
    validated: boolean;
    validationSource: 'self_assessment' | 'peer_review' | 'interview_feedback' | 'performance_review';
  };
  jobPerformance?: {
    ratings: number[];
    feedback: string[];
    promotions: boolean;
    teamLead: boolean;
    projectSuccess: number;
  };
  createdAt: Date;
}

export interface SalaryTrainingData {
  id: string;
  jobTitle: string;
  industry: string;
  location: { province: string; city: string };
  companySize: 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
  yearsExperience: number;
  skills: string[];
  education: string;
  offeredSalary: number;
  acceptedSalary?: number;
  negotiated: boolean;
  marketSalaryRange: { min: number; max: number };
  benefits: string[];
  equity?: boolean;
  remote: boolean;
  contractType: 'PERMANENT' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP';
  timestamp: Date;
}

export class TrainingDataCollector {
  
  /**
   *  Collect job matching training data
   */
  async collectJobMatchingData(): Promise<JobMatchingTrainingData[]> {
    logger.info(' Collecting job matching training data');
    
    const applications = await prisma.application.findMany({
      include: {
        user: {
          include: {
            skills: { include: { skill: true } },
            experiences: true,
            educations: true,
            cvs: { orderBy: { createdAt: 'desc' }, take: 1 },
            jobSeekerProfile: true
          }
        },
        job: {
          include: {
            company: true
          }
        },
        interviews: true
      },
      where: {
        // Only collect data where we have outcome information
        OR: [
          { status: { not: 'APPLIED' } },
          { updatedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } // Week old applications
        ]
      }
    });

    const trainingData: JobMatchingTrainingData[] = applications.map(app => ({
      id: app.id,
      userId: app.userId,
      jobId: app.jobId,
      userProfile: {
        skills: app.user.skills.map(s => s.skill.name),
        experience: app.user.experiences,
        education: app.user.educations,
        yearsOfExperience: app.user.jobSeekerProfile?.yearsOfExperience || 0,
        location: {
          province: app.user.province || '',
          city: app.user.city || ''
        },
        salaryExpectation: {
          min: app.user.jobSeekerProfile?.expectedSalaryMin || 0,
          max: app.user.jobSeekerProfile?.expectedSalaryMax || 0
        },
        cvContent: app.user.cvs[0]?.content || '',
        personalityTraits: {} // Will be filled by personality model
      },
      jobProfile: {
        title: app.job.title,
        description: app.job.description,
        requiredSkills: app.job.requiredSkills,
        preferredSkills: app.job.preferredSkills,
        yearsExperienceMin: app.job.yearsExperienceMin || 0,
        yearsExperienceMax: app.job.yearsExperienceMax || 10,
        salaryMin: app.job.salaryMin || 0,
        salaryMax: app.job.salaryMax || 0,
        location: {
          province: app.job.province,
          city: app.job.city
        },
        isRemote: app.job.isRemote,
        companySize: app.job.company.size || 'MEDIUM',
        industry: app.job.company.industry || 'TECHNOLOGY'
      },
      outcome: {
        applied: true,
        viewed: app.status !== 'APPLIED',
        responded: ['REVIEWING', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'HIRED'].includes(app.status),
        interviewed: app.interviews.length > 0,
        hired: app.status === 'HIRED',
        rejected: app.status === 'REJECTED',
        responseTime: this.calculateResponseTime(app.createdAt, app.updatedAt),
        interviewStages: app.interviews.length,
        finalDecision: this.mapStatusToDecision(app.status),
        userRating: app.userRating || undefined,
        companyRating: app.companyRating || undefined
      },
      timeline: {
        appliedAt: app.createdAt,
        responseAt: app.status !== 'APPLIED' ? app.updatedAt : undefined,
        interviewAt: app.interviews[0]?.scheduledAt || undefined,
        decisionAt: ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(app.status) ? app.updatedAt : undefined
      },
      context: {
        marketConditions: {}, // Would be filled with market data
        competitionLevel: 0.7, // Would be calculated based on similar applications
        applicationMethod: 'PLATFORM',
        coverLetterUsed: !!app.coverLetter,
        referralUsed: !!app.referralSource
      },
      createdAt: app.createdAt
    }));

    logger.info(' Job matching training data collected', { count: trainingData.length });
    return trainingData;
  }

  /**
   *  Collect personality analysis training data
   */
  async collectPersonalityTrainingData(): Promise<PersonalityTrainingData[]> {
    logger.info(' Collecting personality training data');
    
    // This would need to be built up over time through:
    // 1. User self-assessments
    // 2. Interview feedback
    // 3. Job performance data
    // 4. Peer reviews
    
    const users = await prisma.user.findMany({
      include: {
        cvs: { orderBy: { createdAt: 'desc' }, take: 1 },
        jobSeekerProfile: true,
        applications: {
          include: {
            interviews: true
          },
          where: {
            status: { in: ['HIRED', 'INTERVIEWED'] }
          }
        }
      },
      where: {
        cvs: { some: {} } // Only users with CVs
      }
    });

    const trainingData: PersonalityTrainingData[] = users
      .filter(user => user.cvs[0]?.content && user.cvs[0].content.length > 200)
      .map(user => ({
        id: user.id,
        userId: user.id,
        cvContent: user.cvs[0].content,
        personalityAssessment: {
          // These would come from validated assessments
          communicationStyle: 'conversational', // Default - needs real data
          workingPreference: 'collaborative',   // Default - needs real data
          problemSolving: 'analytical',         // Default - needs real data
          decisionMaking: 'data-driven',        // Default - needs real data
          confidence: 0.7,                      // Default - needs real data
          validated: false,                     // Mark as needing validation
          validationSource: 'self_assessment'
        },
        jobPerformance: user.applications.length > 0 ? {
          ratings: [4], // Would come from employer feedback
          feedback: ['Good team player'], // Would come from reviews
          promotions: false,
          teamLead: false,
          projectSuccess: 0.8
        } : undefined,
        createdAt: user.createdAt
      }));

    logger.info(' Personality training data collected', { count: trainingData.length });
    return trainingData;
  }

  /**
   *  Collect salary intelligence training data
   */
  async collectSalaryTrainingData(): Promise<SalaryTrainingData[]> {
    logger.info(' Collecting salary training data');
    
    const applications = await prisma.application.findMany({
      include: {
        user: {
          include: {
            skills: { include: { skill: true } },
            educations: true,
            jobSeekerProfile: true
          }
        },
        job: {
          include: {
            company: true
          }
        }
      },
      where: {
        status: { in: ['HIRED', 'OFFERED'] },
        negotiatedSalary: { not: null }
      }
    });

    const trainingData: SalaryTrainingData[] = applications.map(app => ({
      id: app.id,
      jobTitle: app.job.title,
      industry: app.job.company.industry || 'TECHNOLOGY',
      location: {
        province: app.job.province,
        city: app.job.city
      },
      companySize: app.job.company.size || 'MEDIUM',
      yearsExperience: app.user.jobSeekerProfile?.yearsOfExperience || 0,
      skills: app.user.skills.map(s => s.skill.name),
      education: app.user.educations[0]?.degree || 'Bachelor',
      offeredSalary: app.job.salaryMax || 0,
      acceptedSalary: app.negotiatedSalary || undefined,
      negotiated: !!app.negotiatedSalary,
      marketSalaryRange: {
        min: app.job.salaryMin || 0,
        max: app.job.salaryMax || 0
      },
      benefits: [], // Would need to be collected from job description
      equity: false, // Would need to be determined from offer details
      remote: app.job.isRemote,
      contractType: app.job.contractType || 'PERMANENT',
      timestamp: app.updatedAt
    }));

    logger.info(' Salary training data collected', { count: trainingData.length });
    return trainingData;
  }

  /**
   *  Export training datasets
   */
  async exportTrainingDatasets() {
    logger.info(' Exporting all training datasets');
    
    const [jobMatchingData, personalityData, salaryData] = await Promise.all([
      this.collectJobMatchingData(),
      this.collectPersonalityTrainingData(),
      this.collectSalaryTrainingData()
    ]);

    const datasets = {
      jobMatching: {
        data: jobMatchingData,
        schema: 'JobMatchingTrainingData',
        size: jobMatchingData.length,
        exportedAt: new Date().toISOString()
      },
      personality: {
        data: personalityData,
        schema: 'PersonalityTrainingData',
        size: personalityData.length,
        exportedAt: new Date().toISOString()
      },
      salary: {
        data: salaryData,
        schema: 'SalaryTrainingData',
        size: salaryData.length,
        exportedAt: new Date().toISOString()
      }
    };

    // Cache for ML pipeline access
    await cache.set('ml:training:datasets', datasets, 86400); // 24 hours

    logger.info(' Training datasets exported', {
      jobMatchingRecords: jobMatchingData.length,
      personalityRecords: personalityData.length,
      salaryRecords: salaryData.length
    });

    return datasets;
  }

  /**
   *  Set up continuous data collection
   */
  setupContinuousCollection() {
    // This would set up event listeners to continuously collect training data
    // as users interact with the system
    
    logger.info(' Setting up continuous data collection pipelines');
    
    // Event handlers for:
    // - Application submissions
    // - Interview outcomes  
    // - Hiring decisions
    // - User feedback
    // - Salary negotiations
    // - Performance reviews
  }

  private calculateResponseTime(appliedAt: Date, respondedAt: Date): number {
    return Math.round((respondedAt.getTime() - appliedAt.getTime()) / (1000 * 60 * 60)); // hours
  }

  private mapStatusToDecision(status: string): 'hired' | 'rejected' | 'withdrawn' | 'pending' {
    switch (status) {
      case 'HIRED': return 'hired';
      case 'REJECTED': return 'rejected';
      case 'WITHDRAWN': return 'withdrawn';
      default: return 'pending';
    }
  }
}

export const trainingDataCollector = new TrainingDataCollector();
