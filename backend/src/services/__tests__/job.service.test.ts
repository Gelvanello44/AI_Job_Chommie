import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { JobService } from '../job.service';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis.config';
import { huggingFaceService } from '../huggingface.service';
import { AppError } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('../../config/database', () => ({
  prisma: {
    job: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    company: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
    application: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn()
    },
    savedJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn()
    },
    jobMatchScore: {
      create: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    userActivity: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

jest.mock('../../config/redis.config', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn()
  }
}));

jest.mock('../huggingface.service', () => ({
  huggingFaceService: {
    matchJobWithProfile: jest.fn(),
    generateEmbeddings: jest.fn(),
    classifySkills: jest.fn()
  }
}));

describe('JobService', () => {
  let jobService: JobService;

  beforeEach(() => {
    jobService = new JobService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('searchJobs', () => {
    const mockSearchParams = {
      keyword: 'developer',
      location: 'Cape Town',
      jobType: 'FULL_TIME',
      experienceLevel: 'MID_LEVEL',
      salaryMin: 30000,
      salaryMax: 80000,
      page: 1,
      limit: 10
    };

    const mockJobs = [
      {
        id: 'job-1',
        title: 'Senior Developer',
        company: { name: 'Tech Corp' },
        location: 'Cape Town',
        jobType: 'FULL_TIME',
        experienceLevel: 'SENIOR',
        salaryMin: 60000,
        salaryMax: 80000,
        createdAt: new Date()
      },
      {
        id: 'job-2',
        title: 'Junior Developer',
        company: { name: 'StartUp Inc' },
        location: 'Cape Town',
        jobType: 'FULL_TIME',
        experienceLevel: 'JUNIOR',
        salaryMin: 25000,
        salaryMax: 35000,
        createdAt: new Date()
      }
    ];

    it('should search jobs with filters', async () => {
      (prisma.job.findMany as jest.Mock).mockResolvedValue(mockJobs);
      (prisma.job.count as jest.Mock).mockResolvedValue(2);

      const result = await jobService.searchJobs(mockSearchParams);

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            active: true
          }),
          include: expect.objectContaining({
            company: true
          }),
          skip: 0,
          take: 10
        })
      );
      expect(result).toHaveProperty('jobs', mockJobs);
      expect(result).toHaveProperty('total', 2);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('totalPages', 1);
    });

    it('should handle empty search results', async () => {
      (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.job.count as jest.Mock).mockResolvedValue(0);

      const result = await jobService.searchJobs(mockSearchParams);

      expect(result.jobs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should use cache when available', async () => {
      const cacheKey = `jobs:search:${JSON.stringify(mockSearchParams)}`;
      const cachedData = JSON.stringify({ jobs: mockJobs, total: 2 });
      
      (redis.get as jest.Mock).mockResolvedValue(cachedData);

      const result = await jobService.searchJobs(mockSearchParams);

      expect(redis.get).toHaveBeenCalledWith(expect.stringContaining('jobs:search:'));
      expect(prisma.job.findMany).not.toHaveBeenCalled();
      expect(result.jobs).toEqual(mockJobs);
    });

    it('should handle pagination correctly', async () => {
      const params = { ...mockSearchParams, page: 2, limit: 5 };
      
      (prisma.job.findMany as jest.Mock).mockResolvedValue(mockJobs);
      (prisma.job.count as jest.Mock).mockResolvedValue(15);

      const result = await jobService.searchJobs(params);

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5
        })
      );
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('getJobById', () => {
    const mockJobId = 'job-123';
    const mockJob = {
      id: mockJobId,
      title: 'Software Developer',
      description: 'Great opportunity',
      company: {
        id: 'company-123',
        name: 'Tech Corp'
      },
      views: 10,
      applications: 5
    };

    it('should get job by ID', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.job.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        views: 11
      });

      const result = await jobService.getJobById(mockJobId);

      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { id: mockJobId },
        include: expect.objectContaining({
          company: true
        })
      });
      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: mockJobId },
        data: { views: { increment: 1 } }
      });
      expect(result).toEqual({ ...mockJob, views: 11 });
    });

    it('should throw error for non-existent job', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(jobService.getJobById(mockJobId))
        .rejects.toThrow('Job not found');
    });

    it('should track user activity', async () => {
      const userId = 'user-123';
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.job.update as jest.Mock).mockResolvedValue(mockJob);

      await jobService.getJobById(mockJobId, userId);

      expect(prisma.userActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          action: 'job_view',
          entityType: 'job',
          entityId: mockJobId
        })
      });
    });
  });

  describe('createJob', () => {
    const mockJobData = {
      title: 'Senior Developer',
      description: 'We are looking for a senior developer',
      requirements: '5+ years experience',
      responsibilities: 'Lead development team',
      companyId: 'company-123',
      jobType: 'FULL_TIME' as const,
      experienceLevel: 'SENIOR' as const,
      province: 'WESTERN_CAPE' as const,
      city: 'Cape Town',
      salaryMin: 60000,
      salaryMax: 90000
    };

    const mockUserId = 'user-123';

    it('should create a new job', async () => {
      const mockCreatedJob = {
        id: 'job-new',
        ...mockJobData,
        userId: mockUserId,
        active: true,
        featured: false,
        createdAt: new Date()
      };

      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobData.companyId,
        name: 'Tech Corp'
      });
      (prisma.job.create as jest.Mock).mockResolvedValue(mockCreatedJob);

      const result = await jobService.createJob(mockJobData, mockUserId);

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: mockJobData.companyId }
      });
      expect(prisma.job.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...mockJobData,
          userId: mockUserId,
          active: true
        }),
        include: { company: true }
      });
      expect(result).toEqual(mockCreatedJob);
    });

    it('should throw error for invalid company', async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(jobService.createJob(mockJobData, mockUserId))
        .rejects.toThrow('Company not found');
    });

    it('should validate salary range', async () => {
      const invalidData = {
        ...mockJobData,
        salaryMin: 90000,
        salaryMax: 60000
      };

      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobData.companyId
      });

      await expect(jobService.createJob(invalidData, mockUserId))
        .rejects.toThrow('Minimum salary cannot be greater than maximum salary');
    });

    it('should extract and save skills from job description', async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobData.companyId
      });
      (prisma.job.create as jest.Mock).mockResolvedValue({
        id: 'job-new',
        ...mockJobData
      });
      (huggingFaceService.classifySkills as jest.Mock).mockResolvedValue([
        { label: 'JavaScript', score: 0.9 },
        { label: 'React', score: 0.85 }
      ]);

      await jobService.createJob(mockJobData, mockUserId);

      expect(huggingFaceService.classifySkills).toHaveBeenCalled();
    });
  });

  describe('updateJob', () => {
    const mockJobId = 'job-123';
    const mockUserId = 'user-123';
    const updateData = {
      title: 'Updated Title',
      salaryMin: 70000
    };

    it('should update job successfully', async () => {
      const existingJob = {
        id: mockJobId,
        userId: mockUserId,
        title: 'Original Title',
        salaryMin: 60000,
        salaryMax: 90000
      };

      const updatedJob = {
        ...existingJob,
        ...updateData
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(existingJob);
      (prisma.job.update as jest.Mock).mockResolvedValue(updatedJob);

      const result = await jobService.updateJob(mockJobId, updateData, mockUserId);

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: mockJobId },
        data: updateData,
        include: { company: true }
      });
      expect(result).toEqual(updatedJob);
    });

    it('should throw error if user is not job owner', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobId,
        userId: 'other-user'
      });

      await expect(jobService.updateJob(mockJobId, updateData, mockUserId))
        .rejects.toThrow('Unauthorized to update this job');
    });

    it('should clear cache after update', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobId,
        userId: mockUserId
      });
      (prisma.job.update as jest.Mock).mockResolvedValue({});

      await jobService.updateJob(mockJobId, updateData, mockUserId);

      expect(redis.del).toHaveBeenCalledWith(`job:${mockJobId}`);
    });
  });

  describe('deleteJob', () => {
    const mockJobId = 'job-123';
    const mockUserId = 'user-123';

    it('should delete job successfully', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobId,
        userId: mockUserId
      });
      (prisma.job.delete as jest.Mock).mockResolvedValue({
        id: mockJobId
      });

      await jobService.deleteJob(mockJobId, mockUserId);

      expect(prisma.job.delete).toHaveBeenCalledWith({
        where: { id: mockJobId }
      });
    });

    it('should throw error if user is not authorized', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobId,
        userId: 'other-user'
      });

      await expect(jobService.deleteJob(mockJobId, mockUserId))
        .rejects.toThrow('Unauthorized to delete this job');
    });

    it('should allow admin to delete any job', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobId,
        userId: 'other-user'
      });
      (prisma.job.delete as jest.Mock).mockResolvedValue({
        id: mockJobId
      });

      await jobService.deleteJob(mockJobId, 'admin-user', 'ADMIN');

      expect(prisma.job.delete).toHaveBeenCalled();
    });
  });

  describe('applyToJob', () => {
    const mockJobId = 'job-123';
    const mockUserId = 'user-123';
    const applicationData = {
      coverLetter: 'I am interested in this position...',
      cvId: 'cv-123'
    };

    it('should apply to job successfully', async () => {
      const mockJob = {
        id: mockJobId,
        title: 'Developer',
        active: true
      };

      const mockApplication = {
        id: 'app-123',
        jobId: mockJobId,
        userId: mockUserId,
        ...applicationData,
        status: 'PENDING',
        createdAt: new Date()
      };

      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.application.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.application.create as jest.Mock).mockResolvedValue(mockApplication);
      (huggingFaceService.matchJobWithProfile as jest.Mock).mockResolvedValue({
        matchScore: 85,
        relevantSkills: [],
        missingSkills: [],
        sentiment: [],
        explanation: 'Good match'
      });

      const result = await jobService.applyToJob(mockJobId, mockUserId, applicationData);

      expect(prisma.application.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jobId: mockJobId,
          userId: mockUserId,
          ...applicationData,
          status: 'PENDING'
        })
      });
      expect(result).toEqual(mockApplication);
    });

    it('should prevent duplicate applications', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobId,
        active: true
      });
      (prisma.application.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-app'
      });

      await expect(jobService.applyToJob(mockJobId, mockUserId, applicationData))
        .rejects.toThrow('You have already applied to this job');
    });

    it('should prevent applying to inactive jobs', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobId,
        active: false
      });

      await expect(jobService.applyToJob(mockJobId, mockUserId, applicationData))
        .rejects.toThrow('This job is no longer accepting applications');
    });

    it('should calculate and save match score', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobId,
        active: true,
        description: 'Job description'
      });
      (prisma.application.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.application.create as jest.Mock).mockResolvedValue({
        id: 'app-123'
      });
      (huggingFaceService.matchJobWithProfile as jest.Mock).mockResolvedValue({
        matchScore: 75,
        relevantSkills: [],
        missingSkills: [],
        sentiment: [],
        explanation: 'Good match'
      });

      await jobService.applyToJob(mockJobId, mockUserId, applicationData);

      expect(prisma.jobMatchScore.upsert).toHaveBeenCalledWith({
        where: { jobId_userId: { jobId: mockJobId, userId: mockUserId } },
        create: expect.objectContaining({
          jobId: mockJobId,
          userId: mockUserId,
          overallScore: 75
        }),
        update: expect.objectContaining({
          overallScore: 75
        })
      });
    });
  });

  describe('saveJob', () => {
    const mockJobId = 'job-123';
    const mockUserId = 'user-123';

    it('should save job successfully', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobId,
        active: true
      });
      (prisma.savedJob.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.savedJob.create as jest.Mock).mockResolvedValue({
        id: 'saved-123',
        jobId: mockJobId,
        userId: mockUserId
      });

      const result = await jobService.saveJob(mockJobId, mockUserId);

      expect(prisma.savedJob.create).toHaveBeenCalledWith({
        data: { jobId: mockJobId, userId: mockUserId }
      });
      expect(result).toHaveProperty('id', 'saved-123');
    });

    it('should handle already saved jobs', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: mockJobId,
        active: true
      });
      (prisma.savedJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-saved'
      });

      await expect(jobService.saveJob(mockJobId, mockUserId))
        .rejects.toThrow('Job already saved');
    });
  });

  describe('unsaveJob', () => {
    const mockJobId = 'job-123';
    const mockUserId = 'user-123';

    it('should unsave job successfully', async () => {
      (prisma.savedJob.findUnique as jest.Mock).mockResolvedValue({
        id: 'saved-123'
      });
      (prisma.savedJob.delete as jest.Mock).mockResolvedValue({
        id: 'saved-123'
      });

      await jobService.unsaveJob(mockJobId, mockUserId);

      expect(prisma.savedJob.delete).toHaveBeenCalledWith({
        where: {
          userId_jobId: {
            userId: mockUserId,
            jobId: mockJobId
          }
        }
      });
    });

    it('should throw error if job not saved', async () => {
      (prisma.savedJob.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(jobService.unsaveJob(mockJobId, mockUserId))
        .rejects.toThrow('Job not saved');
    });
  });

  describe('getSavedJobs', () => {
    const mockUserId = 'user-123';

    it('should get user saved jobs', async () => {
      const mockSavedJobs = [
        {
          id: 'saved-1',
          job: { id: 'job-1', title: 'Developer' }
        },
        {
          id: 'saved-2',
          job: { id: 'job-2', title: 'Designer' }
        }
      ];

      (prisma.savedJob.findMany as jest.Mock).mockResolvedValue(mockSavedJobs);

      const result = await jobService.getSavedJobs(mockUserId);

      expect(prisma.savedJob.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: {
          job: {
            include: { company: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toEqual(mockSavedJobs);
    });
  });

  describe('getRecommendedJobs', () => {
    const mockUserId = 'user-123';

    it('should get recommended jobs based on user profile', async () => {
      const mockJobs = [
        { id: 'job-1', title: 'React Developer', score: 90 },
        { id: 'job-2', title: 'Node.js Developer', score: 85 }
      ];

      // Mock user profile and skills
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockUserId,
        skills: [
          { skill: { name: 'React' } },
          { skill: { name: 'Node.js' } }
        ],
        jobSeekerProfile: {
          preferredJobTypes: ['FULL_TIME'],
          preferredLocations: ['Cape Town']
        }
      });

      (prisma.job.findMany as jest.Mock).mockResolvedValue(mockJobs);

      const result = await jobService.getRecommendedJobs(mockUserId);

      expect(result).toBeInstanceOf(Array);
    });
  });
});
