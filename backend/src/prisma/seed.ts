import { PrismaClient, Province, SubscriptionPlan, UserRole, JobType, ExperienceLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// South African provinces and major cities
const SOUTH_AFRICAN_LOCATIONS = {
  WESTERN_CAPE: ['Cape Town', 'Stellenbosch', 'Paarl', 'George', 'Hermanus', 'Mossel Bay'],
  GAUTENG: ['Johannesburg', 'Pretoria', 'Sandton', 'Midrand', 'Centurion', 'Roodepoort', 'Germiston'],
  KWAZULU_NATAL: ['Durban', 'Pietermaritzburg', 'Richards Bay', 'Newcastle', 'Ladysmith'],
  EASTERN_CAPE: ['Port Elizabeth', 'East London', 'Uitenhage', 'King Williams Town', 'Queenstown'],
  MPUMALANGA: ['Nelspruit', 'Witbank', 'Secunda', 'Middelburg', 'Ermelo'],
  LIMPOPO: ['Polokwane', 'Tzaneen', 'Thohoyandou', 'Giyani', 'Mokopane'],
  NORTH_WEST: ['Rustenburg', 'Mahikeng', 'Potchefstroom', 'Klerksdorp', 'Vryburg'],
  NORTHERN_CAPE: ['Kimberley', 'Upington', 'Springbok', 'De Aar', 'Kuruman'],
  FREE_STATE: ['Bloemfontein', 'Welkom', 'Kroonstad', 'Bethlehem', 'Sasolburg']
};

// Comprehensive skills database for South African job market
const SKILLS_DATA = [
  // Programming & Development
  { name: 'JavaScript', category: 'Programming Languages', isInDemand: true },
  { name: 'TypeScript', category: 'Programming Languages', isInDemand: true },
  { name: 'Python', category: 'Programming Languages', isInDemand: true },
  { name: 'Java', category: 'Programming Languages', isInDemand: true },
  { name: 'C#', category: 'Programming Languages', isInDemand: true },
  { name: 'PHP', category: 'Programming Languages', isInDemand: true },
  { name: 'C++', category: 'Programming Languages', isInDemand: false },
  { name: 'Go', category: 'Programming Languages', isInDemand: true },
  { name: 'Rust', category: 'Programming Languages', isInDemand: false },
  { name: 'Swift', category: 'Programming Languages', isInDemand: false },
  { name: 'Kotlin', category: 'Programming Languages', isInDemand: true },

  // Web Technologies
  { name: 'React', category: 'Frontend Frameworks', isInDemand: true },
  { name: 'Angular', category: 'Frontend Frameworks', isInDemand: true },
  { name: 'Vue.js', category: 'Frontend Frameworks', isInDemand: true },
  { name: 'Next.js', category: 'Frontend Frameworks', isInDemand: true },
  { name: 'Node.js', category: 'Backend Technologies', isInDemand: true },
  { name: 'Express.js', category: 'Backend Technologies', isInDemand: true },
  { name: 'NestJS', category: 'Backend Technologies', isInDemand: true },
  { name: 'Django', category: 'Backend Technologies', isInDemand: true },
  { name: 'Flask', category: 'Backend Technologies', isInDemand: true },
  { name: 'Spring Boot', category: 'Backend Technologies', isInDemand: true },

  // Databases
  { name: 'PostgreSQL', category: 'Databases', isInDemand: true },
  { name: 'MySQL', category: 'Databases', isInDemand: true },
  { name: 'MongoDB', category: 'Databases', isInDemand: true },
  { name: 'Redis', category: 'Databases', isInDemand: true },
  { name: 'Microsoft SQL Server', category: 'Databases', isInDemand: true },
  { name: 'Oracle Database', category: 'Databases', isInDemand: true },
  { name: 'Elasticsearch', category: 'Databases', isInDemand: true },

  // Cloud & DevOps
  { name: 'AWS', category: 'Cloud Platforms', isInDemand: true },
  { name: 'Microsoft Azure', category: 'Cloud Platforms', isInDemand: true },
  { name: 'Google Cloud Platform', category: 'Cloud Platforms', isInDemand: true },
  { name: 'Docker', category: 'DevOps', isInDemand: true },
  { name: 'Kubernetes', category: 'DevOps', isInDemand: true },
  { name: 'Jenkins', category: 'DevOps', isInDemand: true },
  { name: 'GitLab CI/CD', category: 'DevOps', isInDemand: true },
  { name: 'Terraform', category: 'DevOps', isInDemand: true },
  { name: 'Ansible', category: 'DevOps', isInDemand: true },

  // Data & Analytics
  { name: 'Power BI', category: 'Data Analysis', isInDemand: true },
  { name: 'Tableau', category: 'Data Analysis', isInDemand: true },
  { name: 'SQL', category: 'Data Analysis', isInDemand: true },
  { name: 'Excel Advanced', category: 'Data Analysis', isInDemand: true },
  { name: 'R', category: 'Data Science', isInDemand: true },
  { name: 'Machine Learning', category: 'Data Science', isInDemand: true },
  { name: 'Data Mining', category: 'Data Science', isInDemand: true },
  { name: 'Apache Spark', category: 'Big Data', isInDemand: true },

  // Business & Soft Skills
  { name: 'Project Management', category: 'Management', isInDemand: true },
  { name: 'Agile Methodology', category: 'Management', isInDemand: true },
  { name: 'Scrum Master', category: 'Management', isInDemand: true },
  { name: 'Leadership', category: 'Soft Skills', isInDemand: true },
  { name: 'Communication', category: 'Soft Skills', isInDemand: true },
  { name: 'Problem Solving', category: 'Soft Skills', isInDemand: true },
  { name: 'Critical Thinking', category: 'Soft Skills', isInDemand: true },
  { name: 'Team Management', category: 'Management', isInDemand: true },

  // Finance & Accounting
  { name: 'Financial Reporting', category: 'Finance', isInDemand: true },
  { name: 'IFRS', category: 'Finance', isInDemand: true },
  { name: 'SAP', category: 'Enterprise Software', isInDemand: true },
  { name: 'Sage', category: 'Enterprise Software', isInDemand: true },
  { name: 'Pastel', category: 'Enterprise Software', isInDemand: true },
  { name: 'Taxation', category: 'Finance', isInDemand: true },
  { name: 'Auditing', category: 'Finance', isInDemand: true },

  // Marketing & Digital
  { name: 'Digital Marketing', category: 'Marketing', isInDemand: true },
  { name: 'SEO', category: 'Digital Marketing', isInDemand: true },
  { name: 'Google Ads', category: 'Digital Marketing', isInDemand: true },
  { name: 'Facebook Ads', category: 'Digital Marketing', isInDemand: true },
  { name: 'Content Marketing', category: 'Marketing', isInDemand: true },
  { name: 'Social Media Marketing', category: 'Marketing', isInDemand: true },
  { name: 'Email Marketing', category: 'Marketing', isInDemand: true },

  // Design
  { name: 'Adobe Photoshop', category: 'Design', isInDemand: true },
  { name: 'Adobe Illustrator', category: 'Design', isInDemand: true },
  { name: 'Figma', category: 'Design', isInDemand: true },
  { name: 'UI/UX Design', category: 'Design', isInDemand: true },
  { name: 'Adobe XD', category: 'Design', isInDemand: true },

  // Industry Specific
  { name: 'Mining Engineering', category: 'Mining', isInDemand: true },
  { name: 'Geology', category: 'Mining', isInDemand: true },
  { name: 'Mechanical Engineering', category: 'Engineering', isInDemand: true },
  { name: 'Electrical Engineering', category: 'Engineering', isInDemand: true },
  { name: 'Civil Engineering', category: 'Engineering', isInDemand: true },
  { name: 'Chemical Engineering', category: 'Engineering', isInDemand: true },
  { name: 'Telecommunications', category: 'Engineering', isInDemand: true },
  { name: 'Agriculture', category: 'Agriculture', isInDemand: true },
  { name: 'Viticulture', category: 'Agriculture', isInDemand: true },
  { name: 'Tourism Management', category: 'Tourism', isInDemand: true },
  { name: 'Hospitality Management', category: 'Tourism', isInDemand: true },

  // Languages (South African context)
  { name: 'Afrikaans', category: 'Languages', isInDemand: true },
  { name: 'Zulu', category: 'Languages', isInDemand: true },
  { name: 'Xhosa', category: 'Languages', isInDemand: true },
  { name: 'English', category: 'Languages', isInDemand: true },
  { name: 'Sotho', category: 'Languages', isInDemand: true },
  { name: 'Tswana', category: 'Languages', isInDemand: true },
];

// Sample companies representative of South African market
const SAMPLE_COMPANIES = [
  {
    name: 'Shoprite Holdings',
    industry: 'Retail',
    province: 'WESTERN_CAPE',
    city: 'Cape Town',
    address: '1 Shoprite Way, Brackenfell',
    postalCode: '7560',
    size: '10000+',
    description: 'Leading retail group in Africa',
    website: 'https://www.shopriteholdings.co.za',
    verified: true
  },
  {
    name: 'Standard Bank Group',
    industry: 'Banking & Finance',
    province: 'GAUTENG',
    city: 'Johannesburg',
    address: '9th Floor, Standard Bank Centre',
    postalCode: '2001',
    size: '10000+',
    description: 'Leading financial services group in Africa',
    website: 'https://www.standardbank.co.za',
    verified: true
  },
  {
    name: 'Sasol Limited',
    industry: 'Energy & Chemicals',
    province: 'GAUTENG',
    city: 'Sandton',
    address: 'Sasol Place, 50 Katherine Street',
    postalCode: '2196',
    size: '5000-10000',
    description: 'Integrated energy and chemical company',
    website: 'https://www.sasol.com',
    verified: true
  },
  {
    name: 'MTN Group',
    industry: 'Telecommunications',
    province: 'GAUTENG',
    city: 'Johannesburg',
    address: 'MTN Centre, 144 Bram Fischer Drive',
    postalCode: '2196',
    size: '5000-10000',
    description: 'Leading telecommunications group in Africa',
    website: 'https://www.mtn.com',
    verified: true
  },
  {
    name: 'Woolworths Holdings',
    industry: 'Retail',
    province: 'WESTERN_CAPE',
    city: 'Cape Town',
    address: '93 Longmarket Street',
    postalCode: '8001',
    size: '1000-5000',
    description: 'Premium retail and food company',
    website: 'https://www.woolworthsholdings.co.za',
    verified: true
  },
  {
    name: 'Discovery Limited',
    industry: 'Insurance & Financial Services',
    province: 'GAUTENG',
    city: 'Sandton',
    address: '1 Discovery Place',
    postalCode: '2196',
    size: '5000-10000',
    description: 'Leading insurance and financial services company',
    website: 'https://www.discovery.co.za',
    verified: true
  },
  {
    name: 'Naspers',
    industry: 'Technology & Media',
    province: 'WESTERN_CAPE',
    city: 'Cape Town',
    address: '40 Heerengracht',
    postalCode: '8001',
    size: '1000-5000',
    description: 'Global technology investor and internet group',
    website: 'https://www.naspers.com',
    verified: true
  },
  {
    name: 'Anglo American',
    industry: 'Mining',
    province: 'GAUTENG',
    city: 'Johannesburg',
    address: '45 Main Street',
    postalCode: '2001',
    size: '10000+',
    description: 'Leading global mining company',
    website: 'https://www.angloamerican.com',
    verified: true
  },
  {
    name: 'Capitec Bank',
    industry: 'Banking & Finance',
    province: 'WESTERN_CAPE',
    city: 'Stellenbosch',
    address: 'Bank Street, Stellenbosch',
    postalCode: '7600',
    size: '1000-5000',
    description: 'Digital banking solutions',
    website: 'https://www.capitecbank.co.za',
    verified: true
  },
  {
    name: 'Takealot.com',
    industry: 'E-commerce',
    province: 'WESTERN_CAPE',
    city: 'Cape Town',
    address: 'Takealot Park, Cape Town',
    postalCode: '7405',
    size: '1000-5000',
    description: 'Leading online retailer in South Africa',
    website: 'https://www.takealot.com',
    verified: true
  }
];

// Sample job postings for testing
const SAMPLE_JOBS = [
  {
    title: 'Senior Software Developer',
    description: 'We are looking for an experienced software developer to join our growing team. You will be responsible for developing and maintaining web applications using modern technologies.',
    requirements: 'Bachelor\'s degree in Computer Science or related field. 5+ years of experience with React, Node.js, and PostgreSQL. Strong problem-solving skills and attention to detail.',
    responsibilities: 'Develop and maintain web applications, collaborate with cross-functional teams, participate in code reviews, mentor junior developers.',
    jobType: 'FULL_TIME',
    experienceLevel: 'SENIOR',
    province: 'GAUTENG',
    city: 'Sandton',
    isRemote: false,
    salaryMin: 60000,
    salaryMax: 80000,
    salaryCurrency: 'ZAR',
    salaryPeriod: 'monthly',
    requiredSkills: ['JavaScript', 'React', 'Node.js', 'PostgreSQL'],
    preferredSkills: ['TypeScript', 'AWS', 'Docker'],
    education: 'Bachelor\'s degree',
    yearsExperienceMin: 5,
    yearsExperienceMax: 10,
    active: true,
    featured: true
  },
  {
    title: 'Data Scientist',
    description: 'Join our analytics team to drive data-driven decision making across the organization. You will work with large datasets to extract meaningful insights.',
    requirements: 'Master\'s degree in Data Science, Statistics, or related field. Experience with Python, R, SQL, and machine learning algorithms.',
    responsibilities: 'Analyze complex datasets, build predictive models, create data visualizations, present findings to stakeholders.',
    jobType: 'FULL_TIME',
    experienceLevel: 'MID_LEVEL',
    province: 'WESTERN_CAPE',
    city: 'Cape Town',
    isRemote: true,
    salaryMin: 45000,
    salaryMax: 65000,
    salaryCurrency: 'ZAR',
    salaryPeriod: 'monthly',
    requiredSkills: ['Python', 'SQL', 'Machine Learning', 'R'],
    preferredSkills: ['Power BI', 'Tableau', 'Apache Spark'],
    education: 'Master\'s degree',
    yearsExperienceMin: 3,
    yearsExperienceMax: 7,
    active: true,
    featured: false
  },
  {
    title: 'Digital Marketing Manager',
    description: 'Lead our digital marketing initiatives to grow brand awareness and drive customer acquisition across South Africa.',
    requirements: 'Degree in Marketing or related field. 4+ years of digital marketing experience. Strong understanding of SEO, SEM, and social media marketing.',
    responsibilities: 'Develop digital marketing strategies, manage advertising campaigns, analyze marketing metrics, lead marketing team.',
    jobType: 'FULL_TIME',
    experienceLevel: 'MID_LEVEL',
    province: 'GAUTENG',
    city: 'Johannesburg',
    isRemote: false,
    salaryMin: 35000,
    salaryMax: 50000,
    salaryCurrency: 'ZAR',
    salaryPeriod: 'monthly',
    requiredSkills: ['Digital Marketing', 'SEO', 'Google Ads', 'Social Media Marketing'],
    preferredSkills: ['Content Marketing', 'Email Marketing', 'Facebook Ads'],
    education: 'Bachelor\'s degree',
    yearsExperienceMin: 4,
    yearsExperienceMax: 8,
    active: true,
    featured: false
  },
  {
    title: 'Mining Engineer',
    description: 'Join our mining operations team to ensure safe and efficient extraction processes at our Gauteng operations.',
    requirements: 'Bachelor\'s degree in Mining Engineering. Professional registration with ECSA. 3+ years of mining experience.',
    responsibilities: 'Plan mining operations, ensure safety compliance, optimize extraction processes, manage mining teams.',
    jobType: 'FULL_TIME',
    experienceLevel: 'MID_LEVEL',
    province: 'GAUTENG',
    city: 'Johannesburg',
    isRemote: false,
    salaryMin: 55000,
    salaryMax: 75000,
    salaryCurrency: 'ZAR',
    salaryPeriod: 'monthly',
    requiredSkills: ['Mining Engineering', 'Safety Management', 'Project Management'],
    preferredSkills: ['Geology', 'AutoCAD', 'Mining Software'],
    education: 'Bachelor\'s degree',
    yearsExperienceMin: 3,
    yearsExperienceMax: 8,
    active: true,
    featured: false
  }
];

// System configuration data
const SYSTEM_CONFIG = [
  {
    key: 'job_scraping_enabled',
    value: true,
    description: 'Enable automated job scraping from external sources'
  },
  {
    key: 'ai_matching_enabled',
    value: true,
    description: 'Enable AI-powered job matching'
  },
  {
    key: 'email_notifications_enabled',
    value: true,
    description: 'Enable email notifications'
  },
  {
    key: 'max_applications_per_day',
    value: 10,
    description: 'Maximum job applications per day for free users'
  },
  {
    key: 'max_cv_uploads',
    value: 3,
    description: 'Maximum CV uploads for free users'
  },
  {
    key: 'job_alert_frequency_hours',
    value: 24,
    description: 'Default job alert frequency in hours'
  }
];

async function main() {
  try {
    console.log(' Starting database seeding...');

    // Clean existing data (for development)
    console.log(' Cleaning existing data...');
    await prisma.userActivity.deleteMany();
    await prisma.savedJob.deleteMany();
    await prisma.userSkill.deleteMany();
    await prisma.application.deleteMany();
    await prisma.job.deleteMany();
    await prisma.company.deleteMany();
    await prisma.skill.deleteMany();
    await prisma.systemConfig.deleteMany();
    await prisma.jobSeekerProfile.deleteMany();
    await prisma.employerProfile.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    // Seed skills
    console.log(' Seeding skills...');
    for (const skill of SKILLS_DATA) {
      await prisma.skill.create({
        data: skill
      });
    }
    console.log(` Created ${SKILLS_DATA.length} skills`);

    // Seed companies
    console.log(' Seeding companies...');
    for (const company of SAMPLE_COMPANIES) {
      await prisma.company.create({
        data: {
          ...company,
          province: company.province as Province
        }
      });
    }
    console.log(` Created ${SAMPLE_COMPANIES.length} companies`);

    // Get company IDs for job creation
    const companies = await prisma.company.findMany({
      select: { id: true, name: true }
    });

    // Seed sample jobs
    console.log(' Seeding sample jobs...');
    for (let i = 0; i < SAMPLE_JOBS.length; i++) {
      const job = SAMPLE_JOBS[i];
      const company = companies[i % companies.length];
      
      await prisma.job.create({
        data: {
          ...job,
          companyId: company.id,
          jobType: job.jobType as JobType,
          experienceLevel: job.experienceLevel as ExperienceLevel,
          province: job.province as Province,
          applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          publishedAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days from now
        }
      });
    }
    console.log(` Created ${SAMPLE_JOBS.length} sample jobs`);

    // Seed system configuration
    console.log(' Seeding system configuration...');
    for (const config of SYSTEM_CONFIG) {
      await prisma.systemConfig.create({
        data: config
      });
    }
    console.log(` Created ${SYSTEM_CONFIG.length} system configurations`);

    // Create test users with hashed passwords
    console.log(' Creating test users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Test job seeker
    const testUser = await prisma.user.create({
      data: {
        email: 'test@aijobchommie.co.za',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'JOB_SEEKER',
        subscriptionPlan: 'PROFESSIONAL',
        creditsRemaining: 5,
        monthlyQuota: 5,
        quotaResetDate: new Date(),
        emailVerified: true,
        province: 'GAUTENG',
        city: 'Johannesburg',
        phone: '+27123456789',
        bio: 'Experienced software developer looking for new opportunities'
      }
    });
    
    // Premium job seeker
    const premiumUser = await prisma.user.create({
      data: {
        email: 'premium@aijobchommie.co.za',
        password: hashedPassword,
        firstName: 'Premium',
        lastName: 'JobSeeker',
        role: 'JOB_SEEKER',
        subscriptionPlan: 'EXECUTIVE',
        creditsRemaining: 10,
        monthlyQuota: 10,
        quotaResetDate: new Date(),
        emailVerified: true,
        province: 'WESTERN_CAPE',
        city: 'Cape Town',
        phone: '+27823456789',
        bio: 'Senior executive seeking leadership opportunities'
      }
    });
    
    // Employer user
    const employerUser = await prisma.user.create({
      data: {
        email: 'employer@aijobchommie.co.za',
        password: hashedPassword,
        firstName: 'Employer',
        lastName: 'Recruiter',
        role: 'EMPLOYER',
        subscriptionPlan: 'PROFESSIONAL',
        creditsRemaining: 20,
        monthlyQuota: 20,
        quotaResetDate: new Date(),
        emailVerified: true,
        province: 'GAUTENG',
        city: 'Sandton',
        phone: '+27713456789',
        bio: 'HR Manager at leading tech company'
      }
    });

    // Create job seeker profiles
    await prisma.jobSeekerProfile.create({
      data: {
        userId: testUser.id,
        currentJobTitle: 'Software Developer',
        yearsOfExperience: 5,
        expectedSalaryMin: 50000,
        expectedSalaryMax: 70000,
        preferredJobTypes: ['FULL_TIME', 'REMOTE'],
        preferredIndustries: ['Technology', 'Finance'],
        noticePeriod: 30,
        willingToRelocate: false,
        preferredLocations: ['Johannesburg', 'Cape Town']
      }
    });
    
    await prisma.jobSeekerProfile.create({
      data: {
        userId: premiumUser.id,
        currentJobTitle: 'Senior Executive',
        yearsOfExperience: 15,
        expectedSalaryMin: 100000,
        expectedSalaryMax: 150000,
        preferredJobTypes: ['FULL_TIME'],
        preferredIndustries: ['Banking & Finance', 'Technology'],
        noticePeriod: 60,
        willingToRelocate: true,
        preferredLocations: ['Cape Town', 'Johannesburg', 'Durban']
      }
    });
    
    // Get a company to link to employer profile
    const techCompany = await prisma.company.findFirst({
      where: { name: 'Naspers' }
    });
    
    // Create employer profile
    await prisma.employerProfile.create({
      data: {
        userId: employerUser.id,
        companyId: techCompany?.id,
        position: 'HR Manager',
        department: 'Human Resources',
        isRecruiter: true,
        canPostJobs: true
      }
    });

    // Add some skills to test user
    const testUserSkills = ['JavaScript', 'React', 'Node.js', 'PostgreSQL'];
    const skillIds = await prisma.skill.findMany({
      where: { name: { in: testUserSkills } },
      select: { id: true, name: true }
    });

    for (const skill of skillIds) {
      await prisma.userSkill.create({
        data: {
          userId: testUser.id,
          skillId: skill.id,
          proficiencyLevel: 4,
          yearsOfExperience: 3
        }
      });
    }

    console.log(' Created test users with skills');
    
    // Add skills to premium user
    const premiumSkills = ['Leadership', 'Project Management', 'Agile Methodology', 'Team Management'];
    const premiumSkillIds = await prisma.skill.findMany({
      where: { name: { in: premiumSkills } },
      select: { id: true, name: true }
    });
    
    for (const skill of premiumSkillIds) {
      await prisma.userSkill.create({
        data: {
          userId: premiumUser.id,
          skillId: skill.id,
          proficiencyLevel: 5,
          yearsOfExperience: 10
        }
      });
    }

    // Create admin user
    console.log(' Creating admin user...');
    await prisma.user.create({
      data: {
        email: 'admin@aijobchommie.co.za',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        subscriptionPlan: 'EXECUTIVE',
        creditsRemaining: 100,
        monthlyQuota: 100,
        quotaResetDate: new Date(),
        emailVerified: true,
        province: 'EASTERN_CAPE',
        city: 'Port Elizabeth',
        phone: '+27612345678',
        bio: 'Platform administrator'
      }
    });
    
    // Create sample applications
    console.log(' Creating sample applications...');
    const jobs = await prisma.job.findMany({ take: 3 });
    
    if (jobs.length > 0) {
      // Test user applies to first job
      await prisma.application.create({
        data: {
          userId: testUser.id,
          jobId: jobs[0].id,
          status: 'PENDING',
          coverLetter: 'I am very interested in this position and believe my skills in JavaScript and React make me a perfect fit.',
          matchScore: 85.5
        }
      });
      
      // Premium user applies to second job
      if (jobs[1]) {
        await prisma.application.create({
          data: {
            userId: premiumUser.id,
            jobId: jobs[1].id,
            status: 'REVIEWED',
            coverLetter: 'With my extensive experience in leadership and management, I can drive your team to success.',
            matchScore: 92.3,
            viewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Viewed 1 day ago
            reviewedAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // Reviewed 12 hours ago
          }
        });
      }
      
      // Create saved jobs
      await prisma.savedJob.create({
        data: {
          userId: testUser.id,
          jobId: jobs[0].id
        }
      });
      
      if (jobs[2]) {
        await prisma.savedJob.create({
          data: {
            userId: premiumUser.id,
            jobId: jobs[2].id
          }
        });
      }
    }

    console.log(' Database seeding completed successfully!');
    console.log(' Summary:');
    console.log(`   - ${SKILLS_DATA.length} skills created`);
    console.log(`   - ${SAMPLE_COMPANIES.length} companies created`);
    console.log(`   - ${SAMPLE_JOBS.length} jobs created`);
    console.log(`   - ${SYSTEM_CONFIG.length} system configs created`);
    console.log('   - 4 test users created:');
    console.log('     • test@aijobchommie.co.za (Professional Job Seeker)');
    console.log('     • premium@aijobchommie.co.za (Executive Job Seeker)');
    console.log('     • employer@aijobchommie.co.za (Employer/Recruiter)');
    console.log('     • admin@aijobchommie.co.za (Admin)');
    console.log('\n All test accounts use password: password123');
    console.log('\n Tips:');
    console.log('   - Run "npm run prisma:seed" to seed the database');
    console.log('   - Run "npm run prisma:studio" to view data in Prisma Studio');
    console.log('   - The backend runs on port 3001 by default');

  } catch (error) {
    console.error(' Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
