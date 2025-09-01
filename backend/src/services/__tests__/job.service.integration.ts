import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { jobService } from '../job.service.js';
import { prisma } from '../../config/database.js';
import { 
  cleanupTestData, 
  createTestUser, 
  createTestJob,
  createTestCompany,
  createTestLocation,
  createTestIndustry,
  createTestSkill,
  seedTestData
} from '../../tests/helpers/testHelpers.js';
import { UserRole, JobStatus, JobType, ExperienceLevel } from '@prisma/client';

describe('JobService Integration Tests', () => {
  let testData: any;

  beforeEach(async () => {
    await cleanupTestData();
    testData = await seedTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('createJob', () => {
    it('should create a new job successfully', async () => {
      const jobData = {
        title: 'Full Stack Developer',
        description: 'We are looking for a full stack developer',
        requirements: ['3+ years experience', 'React knowledge'],
        responsibilities: ['Develop features', 'Code reviews'],
        salaryMin: 60000,
        salaryMax: 90000,
        type: JobType.FULL_TIME,
        experienceLevel: ExperienceLevel.MID,
        educationLevel: 'BACHELORS',
        companyId: testData.companies[0].id,
        locationId: testData.locations[0].id,
        industryId: testData.industries[0].id,
        userId: testData.users.employer.id,
        skills: [testData.skills[0].id, testData.skills[2].id],
      };

      const job = await jobService.createJob(jobData);

      expect(job).toBeTruthy();
      expect(job.title).toBe(jobData.title);
      expect(job.description).toBe(jobData.description);
      expect(job.salaryMin).toBe(jobData.salaryMin);
      expect(job.salaryMax).toBe(jobData.salaryMax);
      expect(job.status).toBe(JobStatus.ACTIVE);

      // Verify job was created in database
      const dbJob = await prisma.job.findUnique({
        where: { id: job.id },
        include: { skills: true },
      });
      expect(dbJob).toBeTruthy();
      expect(dbJob?.skills).toHaveLength(2);
    });

    it('should connect skills to job when provided', async () => {
      const jobData = {
        title: 'Backend Developer',
        description: 'Backend position',
        requirements: ['Node.js', 'MongoDB'],
        responsibilities: ['API development'],
        salaryMin: 70000,
        salaryMax: 100000,
        type: JobType.FULL_TIME,
        experienceLevel: ExperienceLevel.SENIOR,
        educationLevel: 'BACHELORS',
        companyId: testData.companies[0].id,
        locationId: testData.locations[0].id,
        industryId: testData.industries[0].id,
        userId: testData.users.employer.id,
        skills: testData.skills.map((s: any) => s.id),
      };

      const job = await jobService.createJob(jobData);

      const jobWithSkills = await prisma.job.findUnique({
        where: { id: job.id },
        include: { skills: true },
      });

      expect(jobWithSkills?.skills).toHaveLength(testData.skills.length);
    });
  });

  describe('getJobs', () => {
    it('should get all active jobs', async () => {
      const jobs = await jobService.getJobs({});

      expect(jobs.jobs).toHaveLength(2); // We created 2 jobs in seed data
      expect(jobs.total).toBe(2);
      expect(jobs.page).toBe(1);
    });

    it('should filter jobs by title', async () => {
      const jobs = await jobService.getJobs({ search: 'Senior' });

      expect(jobs.jobs).toHaveLength(1);
      expect(jobs.jobs[0].title).toContain('Senior');
    });

    it('should filter jobs by location', async () => {
      const jobs = await jobService.getJobs({ 
        locationId: testData.locations[0].id 
      });

      expect(jobs.jobs).toHaveLength(1);
      expect(jobs.jobs[0].locationId).toBe(testData.locations[0].id);
    });

    it('should filter jobs by salary range', async () => {
      const jobs = await jobService.getJobs({ 
        salaryMin: 50000,
        salaryMax: 80000 
      });

      expect(jobs.jobs.length).toBeGreaterThan(0);
      jobs.jobs.forEach(job => {
        expect(job.salaryMax).toBeGreaterThanOrEqual(50000);
        expect(job.salaryMin).toBeLessThanOrEqual(80000);
      });
    });

    it('should paginate results', async () => {
      // Create more jobs for pagination test
      await Promise.all([
        createTestJob({ title: 'Job 3', userId: testData.users.employer.id }),
        createTestJob({ title: 'Job 4', userId: testData.users.employer.id }),
        createTestJob({ title: 'Job 5', userId: testData.users.employer.id }),
      ]);

      const page1 = await jobService.getJobs({ page: 1, limit: 2 });
      const page2 = await jobService.getJobs({ page: 2, limit: 2 });

      expect(page1.jobs).toHaveLength(2);
      expect(page2.jobs).toHaveLength(2);
      expect(page1.jobs[0].id).not.toBe(page2.jobs[0].id);
      expect(page1.total).toBe(5);
    });

    it('should sort jobs by date', async () => {
      const jobs = await jobService.getJobs({ sortBy: 'createdAt', sortOrder: 'desc' });

      for (let i = 1; i < jobs.jobs.length; i++) {
        const prevDate = new Date(jobs.jobs[i - 1].createdAt);
        const currDate = new Date(jobs.jobs[i].createdAt);
        expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
      }
    });
  });

  describe('getJobById', () => {
    it('should get job by id with all relations', async () => {
      const jobId = testData.jobs[0].id;
      const job = await jobService.getJobById(jobId);

      expect(job).toBeTruthy();
      expect(job?.id).toBe(jobId);
      expect(job?.company).toBeTruthy();
      expect(job?.location).toBeTruthy();
      expect(job?.industry).toBeTruthy();
    });

    it('should return null for non-existent job', async () => {
      const job = await jobService.getJobById('non-existent-id');
      expect(job).toBeNull();
    });

    it('should increment view count', async () => {
      const jobId = testData.jobs[0].id;
      
      const jobBefore = await prisma.job.findUnique({ where: { id: jobId } });
      const viewsBefore = jobBefore?.views || 0;

      await jobService.getJobById(jobId);

      const jobAfter = await prisma.job.findUnique({ where: { id: jobId } });
      expect(jobAfter?.views).toBe(viewsBefore + 1);
    });
  });

  describe('updateJob', () => {
    it('should update job successfully', async () => {
      const jobId = testData.jobs[0].id;
      const updateData = {
        title: 'Updated Job Title',
        salaryMin: 90000,
        salaryMax: 130000,
      };

      const updatedJob = await jobService.updateJob(jobId, updateData);

      expect(updatedJob.title).toBe(updateData.title);
      expect(updatedJob.salaryMin).toBe(updateData.salaryMin);
      expect(updatedJob.salaryMax).toBe(updateData.salaryMax);

      // Verify in database
      const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
      expect(dbJob?.title).toBe(updateData.title);
    });

    it('should update job skills', async () => {
      const jobId = testData.jobs[0].id;
      const newSkills = [testData.skills[1].id, testData.skills[3].id];

      const updatedJob = await jobService.updateJob(jobId, {
        skills: newSkills,
      });

      const jobWithSkills = await prisma.job.findUnique({
        where: { id: jobId },
        include: { skills: true },
      });

      expect(jobWithSkills?.skills).toHaveLength(2);
      expect(jobWithSkills?.skills.map(s => s.id)).toEqual(expect.arrayContaining(newSkills));
    });
  });

  describe('deleteJob', () => {
    it('should soft delete job', async () => {
      const jobId = testData.jobs[0].id;

      await jobService.deleteJob(jobId);

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe(JobStatus.CLOSED);
    });

    it('should handle deleting non-existent job', async () => {
      await expect(
        jobService.deleteJob('non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('applyForJob', () => {
    it('should create job application successfully', async () => {
      const jobId = testData.jobs[0].id;
      const userId = testData.users.jobSeeker.id;
      
      const applicationData = {
        jobId,
        userId,
        coverLetter: 'I am very interested in this position...',
        resume: 'resume-url.pdf',
      };

      const application = await jobService.applyForJob(applicationData);

      expect(application).toBeTruthy();
      expect(application.jobId).toBe(jobId);
      expect(application.userId).toBe(userId);
      expect(application.coverLetter).toBe(applicationData.coverLetter);
      expect(application.status).toBe('PENDING');

      // Verify in database
      const dbApplication = await prisma.application.findUnique({
        where: { id: application.id },
      });
      expect(dbApplication).toBeTruthy();
    });

    it('should not allow duplicate applications', async () => {
      const jobId = testData.jobs[0].id;
      const userId = testData.users.jobSeeker.id;
      
      const applicationData = {
        jobId,
        userId,
        coverLetter: 'First application',
        resume: 'resume.pdf',
      };

      // First application
      await jobService.applyForJob(applicationData);

      // Try duplicate application
      await expect(
        jobService.applyForJob(applicationData)
      ).rejects.toThrow();
    });

    it('should increment application count on job', async () => {
      const jobId = testData.jobs[0].id;
      const userId = testData.users.jobSeeker.id;

      const jobBefore = await prisma.job.findUnique({ where: { id: jobId } });
      const countBefore = jobBefore?.applicationCount || 0;

      await jobService.applyForJob({
        jobId,
        userId,
        coverLetter: 'Application',
        resume: 'resume.pdf',
      });

      const jobAfter = await prisma.job.findUnique({ where: { id: jobId } });
      expect(jobAfter?.applicationCount).toBe(countBefore + 1);
    });
  });

  describe('getApplications', () => {
    it('should get applications for a job', async () => {
      const jobId = testData.jobs[0].id;
      
      // Create some applications
      await jobService.applyForJob({
        jobId,
        userId: testData.users.jobSeeker.id,
        coverLetter: 'Application 1',
        resume: 'resume1.pdf',
      });

      const anotherJobSeeker = await createTestUser({
        email: 'jobseeker2@test.com',
        role: UserRole.JOB_SEEKER,
      });

      await jobService.applyForJob({
        jobId,
        userId: anotherJobSeeker.id,
        coverLetter: 'Application 2',
        resume: 'resume2.pdf',
      });

      const applications = await jobService.getApplications({ jobId });

      expect(applications.applications).toHaveLength(2);
      expect(applications.total).toBe(2);
    });

    it('should get applications for a user', async () => {
      const userId = testData.users.jobSeeker.id;

      // Apply to multiple jobs
      await jobService.applyForJob({
        jobId: testData.jobs[0].id,
        userId,
        coverLetter: 'Application 1',
        resume: 'resume.pdf',
      });

      await jobService.applyForJob({
        jobId: testData.jobs[1].id,
        userId,
        coverLetter: 'Application 2',
        resume: 'resume.pdf',
      });

      const applications = await jobService.getApplications({ userId });

      expect(applications.applications).toHaveLength(2);
      expect(applications.applications.every(a => a.userId === userId)).toBe(true);
    });
  });

  describe('getSimilarJobs', () => {
    it('should find similar jobs based on industry and location', async () => {
      // Create a job with specific attributes
      const baseJob = await createTestJob({
        title: 'React Developer',
        industryId: testData.industries[0].id,
        locationId: testData.locations[0].id,
        userId: testData.users.employer.id,
      });

      // Create similar jobs
      await createTestJob({
        title: 'Vue Developer',
        industryId: testData.industries[0].id, // Same industry
        locationId: testData.locations[0].id, // Same location
        userId: testData.users.employer.id,
      });

      await createTestJob({
        title: 'Angular Developer',
        industryId: testData.industries[0].id, // Same industry
        locationId: testData.locations[1].id, // Different location
        userId: testData.users.employer.id,
      });

      const similarJobs = await jobService.getSimilarJobs(baseJob.id);

      expect(similarJobs.length).toBeGreaterThan(0);
      expect(similarJobs.length).toBeLessThanOrEqual(5);
      // Should not include the original job
      expect(similarJobs.find(j => j.id === baseJob.id)).toBeUndefined();
    });
  });

  describe('getJobStats', () => {
    it('should return job statistics', async () => {
      // Apply to some jobs to generate stats
      await jobService.applyForJob({
        jobId: testData.jobs[0].id,
        userId: testData.users.jobSeeker.id,
        coverLetter: 'Application',
        resume: 'resume.pdf',
      });

      const stats = await jobService.getJobStats();

      expect(stats).toHaveProperty('totalJobs');
      expect(stats).toHaveProperty('activeJobs');
      expect(stats).toHaveProperty('totalApplications');
      expect(stats).toHaveProperty('jobsByType');
      expect(stats).toHaveProperty('jobsByIndustry');
      
      expect(stats.totalJobs).toBeGreaterThan(0);
      expect(stats.activeJobs).toBeGreaterThan(0);
      expect(stats.totalApplications).toBeGreaterThan(0);
    });
  });
});
