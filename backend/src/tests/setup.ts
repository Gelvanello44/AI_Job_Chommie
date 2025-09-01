import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Use test database URL if not already set
if (!process.env.DATABASE_URL?.includes('_test')) {
  const baseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/ai_job_chommie';
  process.env.DATABASE_URL = baseUrl.replace(/\/[^/]*$/, '/ai_job_chommie_test');
}

// Test database cleanup utility
export async function cleanDatabase() {
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

// Setup before all tests
beforeAll(async () => {
  try {
    // Connect to test database
    await prisma.$connect();
    
    // Ensure Redis is connected
    await redis.ping();
    
    // Clean database before tests
    await cleanDatabase();
  } catch (error) {
    console.error('Failed to setup test environment:', error);
    throw error;
  }
});

// Clean up after each test
afterEach(async () => {
  // Clear Redis cache
  try {
    await redis.flushdb();
  } catch (error) {
    // Redis might not be available, ignore
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    // Clean database
    await cleanDatabase();
    
    // Disconnect from database
    await prisma.$disconnect();
    
    // Disconnect from Redis
    await redis.quit();
  } catch (error) {
    console.error('Failed to cleanup test environment:', error);
  }
});
