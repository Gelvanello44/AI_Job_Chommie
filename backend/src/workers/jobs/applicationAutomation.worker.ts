import { Job } from 'bull';
import { PrismaClient } from '@prisma/client';
import { OpenAI } from 'openai';
import logger from '../../config/logger.js';
import { queues } from '../queues/queue.config.js';
import { JobService } from '../../services/job.service.js';
import { ApplicationService } from '../../services/application.service.js';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const jobService = new JobService();
const applicationService = new ApplicationService();

interface ApplicationJobData {
  userId: string;
  preferences: {
    jobTypes?: string[];
    locations?: string[];
    salaryMin?: number;
    industries?: string[];
    skills?: string[];
    experienceLevel?: string;
  };
  limit?: number;
  autoApply?: boolean;
}

/**
 * Process automated job applications
 */
export const processApplicationJob = async (job: Job<ApplicationJobData>) => {
  const { userId, preferences, limit = 10, autoApply = false } = job.data;

  try {
    logger.info('Starting automated job application process', { userId, preferences });

    // Get user profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        cvs: {
          where: { isDefault: true },
          take: 1,
        },
      },
    });

    if (!user || !user.profile) {
      throw new Error('User profile not found');
    }

    // Check user quota
    const quota = await prisma.userQuota.findUnique({
      where: { userId },
    });

    if (quota && quota.applicationsUsed >= quota.applicationsLimit) {
      throw new Error('Application quota exceeded');
    }

    // Find matching jobs using AI
    const matchingJobs = await findMatchingJobs(user, preferences, limit);
    
    logger.info(`Found ${matchingJobs.length} matching jobs`, { userId });

    const results = {
      matched: matchingJobs.length,
      applied: 0,
      failed: 0,
      applications: [] as any[],
    };

    // Apply to jobs if autoApply is enabled
    if (autoApply && user.cvs.length > 0) {
      for (const job of matchingJobs) {
        try {
          // Generate personalized cover letter
          const coverLetter = await generateCoverLetter(user, job);

          // Submit application
          const application = await applicationService.submitApplication(userId, {
            jobId: job.id,
            cvId: user.cvs[0].id,
            coverLetter,
            customFields: {
              appliedVia: 'automation',
              matchScore: job.matchScore,
            },
          });

          results.applied++;
          results.applications.push({
            jobId: job.id,
            applicationId: application.id,
            status: 'success',
          });

          // Update quota
          if (quota) {
            await prisma.userQuota.update({
              where: { userId },
              data: { applicationsUsed: { increment: 1 } },
            });
          }

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          logger.error('Failed to apply to job', { jobId: job.id, error });
          results.failed++;
          results.applications.push({
            jobId: job.id,
            status: 'failed',
            error: error.message,
          });
        }
      }
    }

    // Send notification email
    await queues.emailQueue.add('application-summary', {
      userId,
      subject: 'Job Application Automation Summary',
      results,
    });

    logger.info('Automated job application process completed', { userId, results });

    return results;
  } catch (error) {
    logger.error('Job application automation failed', { userId, error });
    throw error;
  }
};

/**
 * Find matching jobs using AI
 */
async function findMatchingJobs(user: any, preferences: any, limit: number) {
  try {
    // Build search query based on preferences
    const searchParams = {
      skills: preferences.skills || extractSkillsFromProfile(user.profile),
      experienceLevel: preferences.experienceLevel || user.profile.experienceLevel,
      location: preferences.locations?.[0],
      salaryMin: preferences.salaryMin,
      jobTypes: preferences.jobTypes,
    };

    // Get jobs from database
    const jobs = await prisma.job.findMany({
      where: {
        status: 'ACTIVE',
        applicationDeadline: {
          gte: new Date(),
        },
        ...(searchParams.experienceLevel && {
          experienceLevel: searchParams.experienceLevel,
        }),
        ...(searchParams.salaryMin && {
          salaryMin: { gte: searchParams.salaryMin },
        }),
      },
      include: {
        company: true,
        applications: {
          where: { userId: user.id },
        },
      },
      take: limit * 3, // Get more jobs to filter
    });

    // Filter out already applied jobs
    const availableJobs = jobs.filter(job => job.applications.length === 0);

    // Use AI to rank jobs by match score
    const rankedJobs = await rankJobsWithAI(user, availableJobs, preferences);

    return rankedJobs.slice(0, limit);
  } catch (error) {
    logger.error('Failed to find matching jobs', { error });
    return [];
  }
}

/**
 * Extract skills from user profile
 */
function extractSkillsFromProfile(profile: any): string[] {
  const skills = [];
  
  if (profile.skills) {
    skills.push(...profile.skills);
  }
  
  if (profile.bio) {
    // Extract skills from bio using simple keyword matching
    const skillKeywords = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'SQL'];
    skillKeywords.forEach(skill => {
      if (profile.bio.toLowerCase().includes(skill.toLowerCase())) {
        skills.push(skill);
      }
    });
  }
  
  return [...new Set(skills)];
}

/**
 * Rank jobs using AI based on user profile match
 */
async function rankJobsWithAI(user: any, jobs: any[], preferences: any) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a job matching expert. Rank jobs based on how well they match the user profile and preferences. Return a JSON array of job IDs with match scores (0-100).',
        },
        {
          role: 'user',
          content: `User Profile: ${JSON.stringify({
            skills: user.profile.skills,
            experience: user.profile.experienceYears,
            education: user.profile.education,
            preferences,
          })}
          
          Jobs: ${JSON.stringify(jobs.map(job => ({
            id: job.id,
            title: job.title,
            requirements: job.requirements,
            skills: job.requiredSkills,
          })))}
          
          Return format: [{"id": "jobId", "score": 85}, ...]`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const rankings = JSON.parse(completion.choices[0].message.content || '{"rankings": []}').rankings;
    
    // Merge rankings with jobs
    return jobs
      .map(job => {
        const ranking = rankings.find(r => r.id === job.id);
        return {
          ...job,
          matchScore: ranking?.score || 50,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    logger.error('AI ranking failed, using fallback', { error });
    // Fallback to random scoring
    return jobs.map(job => ({
      ...job,
      matchScore: Math.floor(Math.random() * 30) + 60,
    }));
  }
}

/**
 * Generate personalized cover letter
 */
async function generateCoverLetter(user: any, job: any): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Generate a concise, professional cover letter (max 300 words).',
        },
        {
          role: 'user',
          content: `Generate a cover letter for:
          User: ${user.profile.firstName} ${user.profile.lastName}
          Skills: ${user.profile.skills?.join(', ')}
          Experience: ${user.profile.experienceYears} years
          
          Job: ${job.title} at ${job.company.name}
          Requirements: ${job.requirements}`,
        },
      ],
    });

    return completion.choices[0].message.content || 'Generated cover letter';
  } catch (error) {
    logger.error('Failed to generate cover letter', { error });
    return `Dear Hiring Manager,

I am writing to express my interest in the ${job.title} position at ${job.company.name}.

With my background and skills, I believe I would be a valuable addition to your team.

I look forward to discussing this opportunity further.

Best regards,
${user.profile.firstName} ${user.profile.lastName}`;
  }
}

// Register the worker
queues.applicationQueue.process('auto-apply', processApplicationJob);

// Schedule periodic job matching for premium users
export const scheduleAutomatedApplications = async () => {
  // Get premium users with automation enabled
  const premiumUsers = await prisma.user.findMany({
    where: {
      subscription: {
        plan: { in: ['PROFESSIONAL', 'ENTERPRISE'] },
        status: 'ACTIVE',
      },
      preferences: {
        automatedApplications: true,
      },
    },
    select: {
      id: true,
      preferences: true,
    },
  });

  for (const user of premiumUsers) {
    await queues.applicationQueue.add(
      'auto-apply',
      {
        userId: user.id,
        preferences: user.preferences?.applicationPreferences || {},
        limit: 5,
        autoApply: true,
      },
      {
        repeat: {
          cron: '0 9 * * *', // Daily at 9 AM
        },
      }
    );
  }

  logger.info(`Scheduled automated applications for ${premiumUsers.length} users`);
};

export default processApplicationJob;
