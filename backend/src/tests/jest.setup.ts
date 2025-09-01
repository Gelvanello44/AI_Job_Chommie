import '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

// Mock modules before they are imported
jest.mock('../config/redis.config.js');
jest.mock('../config/database.js');
jest.mock('../utils/logger.js');
jest.mock('../services/email.service.js');
jest.mock('@huggingface/inference');
jest.mock('twilio');
jest.mock('nodemailer');
jest.mock('onesignal-node');

// Global test configuration
beforeAll(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});
