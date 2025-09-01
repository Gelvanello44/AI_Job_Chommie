import { prisma } from '../../config/database.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, UserRole, Job, Company, Location, Industry, Skill } from '@prisma/client';

/**
 * Create a test user with hashed password
 */
export async function createTestUser(data?: Partial<User>) {
  const password = data?.password || 'TestPassword123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      email: data?.email || `test${Date.now()}@example.com`,
      password: hashedPassword,
      firstName: data?.firstName || 'Test',
      lastName: data?.lastName || 'User',
      role: data?.role || UserRole.JOB_SEEKER,
      isEmailVerified: data?.isEmailVerified ?? true,
      isActive: data?.isActive ?? true,
      ...data,
      password: hashedPassword, // Ensure hashed password is used
    },
  });
}

/**
 * Create an auth token for a user
 */
export function createAuthToken(userId: string) {
  const token = jwt.sign(
    { userId, role: UserRole.JOB_SEEKER },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

/**
 * Create test location
 */
export async function createTestLocation(data?: Partial<Location>) {
  return prisma.location.create({
    data: {
      city: data?.city || 'Cape Town',
      province: data?.province || 'Western Cape',
      country: data?.country || 'South Africa',
      ...data,
    },
  });
}

/**
 * Create test industry
 */
export async function createTestIndustry(data?: Partial<Industry>) {
  return prisma.industry.create({
    data: {
      name: data?.name || 'Technology',
      ...data,
    },
  });
}

/**
 * Create test skill
 */
export async function createTestSkill(data?: Partial<Skill>) {
  return prisma.skill.create({
    data: {
      name: data?.name || 'JavaScript',
      category: data?.category || 'Programming',
      ...data,
    },
  });
}

/**
 * Create test company
 */
export async function createTestCompany(data?: Partial<Company>) {
  return prisma.company.create({
    data: {
      name: data?.name || 'Test Company',
      description: data?.description || 'A test company',
      website: data?.website || 'https://test-company.com',
      size: data?.size || 'MEDIUM',
      ...data,
    },
  });
}

/**
 * Create test job with all required relations
 */
export async function createTestJob(data?: Partial<Job> & { 
  companyId?: string; 
  locationId?: string; 
  industryId?: string;
  userId?: string; 
}) {
  // Create required relations if not provided
  const location = data?.locationId 
    ? null 
    : await createTestLocation();
  
  const industry = data?.industryId 
    ? null 
    : await createTestIndustry();
  
  const company = data?.companyId 
    ? null 
    : await createTestCompany();

  const employer = data?.userId
    ? null
    : await createTestUser({ role: UserRole.EMPLOYER });

  return prisma.job.create({
    data: {
      title: data?.title || 'Test Job',
      description: data?.description || 'Test job description',
      requirements: data?.requirements || ['Requirement 1', 'Requirement 2'],
      responsibilities: data?.responsibilities || ['Responsibility 1', 'Responsibility 2'],
      salaryMin: data?.salaryMin || 50000,
      salaryMax: data?.salaryMax || 100000,
      type: data?.type || 'FULL_TIME',
      experienceLevel: data?.experienceLevel || 'MID',
      educationLevel: data?.educationLevel || 'BACHELORS',
      status: data?.status || 'ACTIVE',
      companyId: data?.companyId || company?.id!,
      locationId: data?.locationId || location?.id!,
      industryId: data?.industryId || industry?.id!,
      userId: data?.userId || employer?.id!,
      ...data,
    },
    include: {
      company: true,
      location: true,
      industry: true,
      skills: true,
    },
  });
}

/**
 * Clean up all test data
 */
export async function cleanupTestData() {
  const tables = [
    'Application',
    'SavedJob',
    'JobAlert',
    'RefreshToken',
    'Notification',
    'Job',
    'UserProfile',
    'User',
    'Company',
    'Skill',
    'Industry',
    'Location',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    } catch (error) {
      // Table might not exist, ignore
    }
  }
}

/**
 * Seed basic test data
 */
export async function seedTestData() {
  // Create locations
  const locations = await Promise.all([
    createTestLocation({ city: 'Cape Town', province: 'Western Cape' }),
    createTestLocation({ city: 'Johannesburg', province: 'Gauteng' }),
    createTestLocation({ city: 'Durban', province: 'KwaZulu-Natal' }),
  ]);

  // Create industries
  const industries = await Promise.all([
    createTestIndustry({ name: 'Technology' }),
    createTestIndustry({ name: 'Finance' }),
    createTestIndustry({ name: 'Healthcare' }),
  ]);

  // Create skills
  const skills = await Promise.all([
    createTestSkill({ name: 'JavaScript', category: 'Programming' }),
    createTestSkill({ name: 'Python', category: 'Programming' }),
    createTestSkill({ name: 'React', category: 'Framework' }),
    createTestSkill({ name: 'Node.js', category: 'Framework' }),
  ]);

  // Create companies
  const companies = await Promise.all([
    createTestCompany({ name: 'Tech Corp', size: 'LARGE' }),
    createTestCompany({ name: 'StartUp Inc', size: 'SMALL' }),
  ]);

  // Create users
  const employer = await createTestUser({
    email: 'employer@test.com',
    role: UserRole.EMPLOYER,
    firstName: 'Employer',
    lastName: 'Test',
  });

  const jobSeeker = await createTestUser({
    email: 'jobseeker@test.com',
    role: UserRole.JOB_SEEKER,
    firstName: 'Job',
    lastName: 'Seeker',
  });

  const admin = await createTestUser({
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    firstName: 'Admin',
    lastName: 'User',
  });

  // Create jobs
  const jobs = await Promise.all([
    createTestJob({
      title: 'Senior Developer',
      companyId: companies[0].id,
      locationId: locations[0].id,
      industryId: industries[0].id,
      userId: employer.id,
      salaryMin: 80000,
      salaryMax: 120000,
    }),
    createTestJob({
      title: 'Junior Developer',
      companyId: companies[1].id,
      locationId: locations[1].id,
      industryId: industries[0].id,
      userId: employer.id,
      salaryMin: 40000,
      salaryMax: 60000,
    }),
  ]);

  return {
    locations,
    industries,
    skills,
    companies,
    users: { employer, jobSeeker, admin },
    jobs,
  };
}
