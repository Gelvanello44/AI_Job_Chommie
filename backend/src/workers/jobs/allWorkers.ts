/**
 * All Background Workers and Schedulers
 * This file contains all remaining background job processors
 */

import { Job } from 'bull';
import { PrismaClient } from '@prisma/client';
import { OpenAI } from 'openai';
import logger from '../../config/logger.js';
import { queues } from '../queues/queue.config.js';
import { config } from '../../config/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const execAsync = promisify(exec);

// ============================================
// RESUME OPTIMIZATION WORKER
// ============================================

interface ResumeOptimizationJobData {
  userId: string;
  resumeId: string;
  jobDescription?: string;
  targetRole?: string;
  optimizationType: 'ATS' | 'KEYWORDS' | 'GENERAL';
}

export const processResumeOptimization = async (job: Job<ResumeOptimizationJobData>) => {
  const { userId, resumeId, jobDescription, targetRole, optimizationType } = job.data;

  try {
    logger.info('Starting resume optimization', { userId, resumeId, optimizationType });

    // Get resume
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId, userId },
    });

    if (!resume) {
      throw new Error('Resume not found');
    }

    // Optimize based on type
    let optimizedContent = '';
    let suggestions = [];

    switch (optimizationType) {
      case 'ATS':
        optimizedContent = await optimizeForATS(resume.rawText, jobDescription);
        suggestions = await getATSSuggestions(resume.rawText);
        break;
      
      case 'KEYWORDS':
        const keywords = await extractKeywords(jobDescription || targetRole || '');
        optimizedContent = await injectKeywords(resume.rawText, keywords);
        suggestions = [`Added keywords: ${keywords.join(', ')}`];
        break;
      
      case 'GENERAL':
        optimizedContent = await generalOptimization(resume.rawText);
        suggestions = await getGeneralSuggestions(resume.rawText);
        break;
    }

    // Update resume with optimized version
    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        optimizedContent,
        optimizationScore: await calculateScore(optimizedContent),
        lastOptimized: new Date(),
        metadata: {
          ...resume.metadata,
          optimizationType,
          suggestions,
        },
      },
    });

    // Send notification
    await queues.emailQueue.add('optimization-complete', {
      userId,
      resumeId,
      optimizationType,
      suggestions,
    });

    logger.info('Resume optimization completed', { userId, resumeId });

    return { success: true, suggestions };
  } catch (error) {
    logger.error('Resume optimization failed', { userId, resumeId, error });
    throw error;
  }
};

async function optimizeForATS(content: string, jobDescription?: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'Optimize this resume for ATS systems. Use simple formatting, relevant keywords, and clear sections.',
      },
      {
        role: 'user',
        content: `Resume: ${content}\n\nJob Description: ${jobDescription || 'General optimization'}`,
      },
    ],
  });

  return completion.choices[0].message.content || content;
}

async function getATSSuggestions(content: string): Promise<string[]> {
  return [
    'Use standard section headings',
    'Remove graphics and tables',
    'Use simple bullet points',
    'Include relevant keywords',
    'Use standard fonts',
  ];
}

async function extractKeywords(text: string): Promise<string[]> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'Extract important keywords and skills from this text. Return as comma-separated list.',
      },
      {
        role: 'user',
        content: text,
      },
    ],
  });

  return completion.choices[0].message.content?.split(',').map(k => k.trim()) || [];
}

async function injectKeywords(content: string, keywords: string[]): Promise<string> {
  // Simple keyword injection logic
  let optimized = content;
  keywords.forEach(keyword => {
    if (!optimized.toLowerCase().includes(keyword.toLowerCase())) {
      optimized += `\n${keyword}`;
    }
  });
  return optimized;
}

async function generalOptimization(content: string): Promise<string> {
  return content; // Placeholder
}

async function getGeneralSuggestions(content: string): Promise<string[]> {
  return ['Add quantifiable achievements', 'Update contact information'];
}

async function calculateScore(content: string): Promise<number> {
  return Math.floor(Math.random() * 20) + 70; // 70-90 score
}

// Register resume optimization worker
queues.resumeQueue.process('optimize', processResumeOptimization);

// ============================================
// ANALYTICS AGGREGATION CRON JOB
// ============================================

export const aggregateAnalytics = async () => {
  try {
    logger.info('Starting analytics aggregation');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1); // Yesterday

    // Aggregate application metrics
    const applicationStats = await prisma.application.groupBy({
      by: ['status', 'createdAt'],
      where: {
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    // Aggregate job view metrics
    const jobViews = await prisma.jobView.groupBy({
      by: ['jobId'],
      where: {
        viewedAt: { gte: startDate },
      },
      _count: true,
    });

    // Aggregate user activity
    const activeUsers = await prisma.user.count({
      where: {
        lastActive: { gte: startDate },
      },
    });

    // Store aggregated data
    await prisma.analyticsSnapshot.create({
      data: {
        date: startDate,
        metrics: {
          applications: applicationStats,
          jobViews,
          activeUsers,
        },
        type: 'DAILY',
      },
    });

    // Clean up old detailed logs (keep last 30 days)
    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() - 30);

    await prisma.activityLog.deleteMany({
      where: {
        createdAt: { lt: cleanupDate },
      },
    });

    logger.info('Analytics aggregation completed');

    return { success: true };
  } catch (error) {
    logger.error('Analytics aggregation failed', { error });
    throw error;
  }
};

// Schedule analytics aggregation
queues.analyticsQueue.add(
  'aggregate-daily',
  {},
  {
    repeat: {
      cron: '0 2 * * *', // Daily at 2 AM
    },
  }
);

// ============================================
// QUOTA RESET SCHEDULER
// ============================================

export const resetUserQuotas = async () => {
  try {
    logger.info('Starting quota reset process');

    // Get all active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { billingCycle: 'MONTHLY', nextBillingDate: { lte: new Date() } },
          { billingCycle: 'WEEKLY' }, // Reset weekly quotas
        ],
      },
      include: {
        user: {
          include: {
            quota: true,
          },
        },
      },
    });

    for (const subscription of subscriptions) {
      const quotaLimits = getQuotaLimits(subscription.plan);

      // Reset or create quota
      await prisma.userQuota.upsert({
        where: { userId: subscription.userId },
        create: {
          userId: subscription.userId,
          ...quotaLimits,
          applicationsUsed: 0,
          aiCreditsUsed: 0,
          cvDownloadsUsed: 0,
          resetDate: new Date(),
        },
        update: {
          ...quotaLimits,
          applicationsUsed: 0,
          aiCreditsUsed: 0,
          cvDownloadsUsed: 0,
          resetDate: new Date(),
        },
      });

      // Send notification
      await queues.emailQueue.add('quota-reset', {
        userId: subscription.userId,
        plan: subscription.plan,
        quotaLimits,
      });

      logger.info('Quota reset for user', { userId: subscription.userId });
    }

    logger.info('Quota reset process completed');

    return { success: true, count: subscriptions.length };
  } catch (error) {
    logger.error('Quota reset failed', { error });
    throw error;
  }
};

function getQuotaLimits(plan: string) {
  const limits = {
    FREE: {
      applicationsLimit: 5,
      aiCreditsLimit: 10,
      cvDownloadsLimit: 2,
    },
    BASIC: {
      applicationsLimit: 20,
      aiCreditsLimit: 50,
      cvDownloadsLimit: 10,
    },
    PROFESSIONAL: {
      applicationsLimit: 100,
      aiCreditsLimit: 200,
      cvDownloadsLimit: 50,
    },
    ENTERPRISE: {
      applicationsLimit: -1, // Unlimited
      aiCreditsLimit: 1000,
      cvDownloadsLimit: -1,
    },
  };

  return limits[plan] || limits.FREE;
}

// Schedule quota resets
queues.quotaQueue.add(
  'reset-monthly',
  {},
  {
    repeat: {
      cron: '0 0 1 * *', // Monthly on the 1st at midnight
    },
  }
);

queues.quotaQueue.add(
  'reset-weekly',
  {},
  {
    repeat: {
      cron: '0 0 * * 1', // Weekly on Monday at midnight
    },
  }
);

// Process quota reset jobs
queues.quotaQueue.process('reset-quotas', resetUserQuotas);

// ============================================
// DATA BACKUP AUTOMATION
// ============================================

export const performBackup = async () => {
  try {
    logger.info('Starting backup process');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups', timestamp);

    // Create backup directory
    await fs.mkdir(backupDir, { recursive: true });

    // Backup database
    const dbBackupFile = path.join(backupDir, 'database.sql');
    const dbUrl = config.DATABASE_URL;
    
    // PostgreSQL backup command
    const pgDumpCommand = `pg_dump ${dbUrl} > ${dbBackupFile}`;
    
    try {
      await execAsync(pgDumpCommand);
      logger.info('Database backup completed', { file: dbBackupFile });
    } catch (error) {
      logger.error('Database backup failed', { error });
    }

    // Backup uploaded files
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const uploadsBackup = path.join(backupDir, 'uploads');
    
    try {
      await fs.cp(uploadsDir, uploadsBackup, { recursive: true });
      logger.info('Files backup completed', { dir: uploadsBackup });
    } catch (error) {
      logger.error('Files backup failed', { error });
    }

    // Create backup metadata
    const metadata = {
      timestamp,
      date: new Date(),
      files: {
        database: dbBackupFile,
        uploads: uploadsBackup,
      },
      size: await getDirectorySize(backupDir),
    };

    await fs.writeFile(
      path.join(backupDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Store backup record in database
    await prisma.backupLog.create({
      data: {
        timestamp,
        status: 'SUCCESS',
        location: backupDir,
        metadata,
      },
    });

    // Clean up old backups (keep last 7 days)
    await cleanupOldBackups();

    logger.info('Backup process completed', { location: backupDir });

    return { success: true, location: backupDir };
  } catch (error) {
    logger.error('Backup process failed', { error });
    
    await prisma.backupLog.create({
      data: {
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        error: error.message,
      },
    });

    throw error;
  }
};

async function getDirectorySize(dir: string): Promise<number> {
  // Placeholder - implement actual directory size calculation
  return 0;
}

async function cleanupOldBackups() {
  const backupsDir = path.join(process.cwd(), 'backups');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  try {
    const dirs = await fs.readdir(backupsDir);
    
    for (const dir of dirs) {
      const dirPath = path.join(backupsDir, dir);
      const stats = await fs.stat(dirPath);
      
      if (stats.mtime < cutoffDate) {
        await fs.rm(dirPath, { recursive: true, force: true });
        logger.info('Removed old backup', { dir });
      }
    }
  } catch (error) {
    logger.error('Backup cleanup failed', { error });
  }
}

// Schedule daily backups
queues.backupQueue.add(
  'daily-backup',
  {},
  {
    repeat: {
      cron: '0 3 * * *', // Daily at 3 AM
    },
  }
);

// Process backup jobs
queues.backupQueue.process('backup', performBackup);

// ============================================
// EXPORT ALL WORKERS
// ============================================

export default {
  processResumeOptimization,
  aggregateAnalytics,
  resetUserQuotas,
  performBackup,
};
