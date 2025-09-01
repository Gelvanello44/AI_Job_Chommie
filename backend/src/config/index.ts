import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

/**
 * Environment configuration schema
 */
const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  API_VERSION: z.string().default('v1'),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_USERNAME: z.string().default('default'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0').transform(Number),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // OAuth2
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CALLBACK_URL: z.string().url().optional(),

  // Third-party APIs
  HUGGINGFACE_API_KEY: z.string(),
  SERPAPI_API_KEY: z.string(),
  OPENAI_API_KEY: z.string().optional(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),

  // Paystack
  PAYSTACK_SECRET_KEY: z.string(),
  PAYSTACK_PUBLIC_KEY: z.string(),
  PAYSTACK_WEBHOOK_SECRET: z.string(),

  // Yoco
  YOCO_SECRET_KEY: z.string().optional(),
  YOCO_PUBLIC_KEY: z.string().optional(),
  YOCO_WEBHOOK_SECRET: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_PHONE_NUMBER: z.string(),
  TWILIO_VERIFY_SERVICE_SID: z.string(),

  // OneSignal
  ONESIGNAL_APP_ID: z.string(),
  ONESIGNAL_API_KEY: z.string(),

  // Email
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_SECURE: z.string().default('false').transform(val => val === 'true'),
  SMTP_USER: z.string().email(),
  SMTP_PASSWORD: z.string(),
  EMAIL_FROM: z.string().default('AI Job Chommie <noreply@aijobchommie.co.za>'),

  // URLs
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),
  SCRAPING_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  INFERENCE_SERVICE_URL: z.string().url().default('http://localhost:5000'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  // Session
  SESSION_SECRET: z.string().min(32),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('logs/app.log'),

  // Bull Queue Redis
  BULL_REDIS_HOST: z.string().default('localhost'),
  BULL_REDIS_PORT: z.string().default('6379').transform(Number),
  BULL_REDIS_PASSWORD: z.string().optional(),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:5173'),

  // Admin
  ADMIN_API_KEY: z.string().min(32),

  // South African specific
  DEFAULT_CURRENCY: z.string().default('ZAR'),
  DEFAULT_COUNTRY: z.string().default('ZA'),
  DEFAULT_TIMEZONE: z.string().default('Africa/Johannesburg'),

  // Feature flags
  ENABLE_AI_MATCHING: z.string().default('true').transform(val => val === 'true'),
  ENABLE_JOB_SCRAPING: z.string().default('true').transform(val => val === 'true'),
  ENABLE_SMS_NOTIFICATIONS: z.string().default('true').transform(val => val === 'true'),
  ENABLE_PUSH_NOTIFICATIONS: z.string().default('true').transform(val => val === 'true'),
  ENABLE_EMAIL_NOTIFICATIONS: z.string().default('true').transform(val => val === 'true'),

  // Security
  ENCRYPTION_KEY: z.string().min(32),
  BCRYPT_ROUNDS: z.string().default('12').transform(Number),

  // File upload
  MAX_FILE_SIZE_MB: z.string().default('10').transform(Number),
  ALLOWED_FILE_TYPES: z.string().default('pdf,doc,docx,txt'),

  // Optional integrations
  SENTRY_DSN: z.string().optional(),
  GOOGLE_ANALYTICS_ID: z.string().optional(),
  MIXPANEL_TOKEN: z.string().optional(),
});

// Parse and validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(' Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const config = parsedEnv.data;

// Export specific configurations
export const corsOptions = {
  origin: config.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  credentials: true,
  optionsSuccessStatus: 200,
};

export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};

export const redisConfig = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  username: config.REDIS_USERNAME,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
};

export const bullRedisConfig = {
  host: config.BULL_REDIS_HOST,
  port: config.BULL_REDIS_PORT,
  username: config.REDIS_USERNAME,
  password: config.BULL_REDIS_PASSWORD,
};

export const cloudinaryConfig = {
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
};

export const emailConfig = {
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_SECURE,
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASSWORD,
  },
};

export const twilioConfig = {
  accountSid: config.TWILIO_ACCOUNT_SID,
  authToken: config.TWILIO_AUTH_TOKEN,
  phoneNumber: config.TWILIO_PHONE_NUMBER,
  verifyServiceSid: config.TWILIO_VERIFY_SERVICE_SID,
};

export const paystackConfig = {
  secretKey: config.PAYSTACK_SECRET_KEY,
  publicKey: config.PAYSTACK_PUBLIC_KEY,
  webhookSecret: config.PAYSTACK_WEBHOOK_SECRET,
};

export const yocoConfig = {
  secretKey: config.YOCO_SECRET_KEY,
  publicKey: config.YOCO_PUBLIC_KEY,
  webhookSecret: config.YOCO_WEBHOOK_SECRET,
};

export const oneSignalConfig = {
  appId: config.ONESIGNAL_APP_ID,
  apiKey: config.ONESIGNAL_API_KEY,
};

// South African provinces and major cities
export const SA_PROVINCES = [
  'EASTERN_CAPE',
  'FREE_STATE',
  'GAUTENG',
  'KWAZULU_NATAL',
  'LIMPOPO',
  'MPUMALANGA',
  'NORTHERN_CAPE',
  'NORTH_WEST',
  'WESTERN_CAPE',
] as const;

export const SA_MAJOR_CITIES = {
  EASTERN_CAPE: ['Port Elizabeth', 'East London', 'Mthatha', 'Grahamstown'],
  FREE_STATE: ['Bloemfontein', 'Welkom', 'Sasolburg', 'Parys'],
  GAUTENG: ['Johannesburg', 'Pretoria', 'Centurion', 'Midrand', 'Sandton', 'Kempton Park'],
  KWAZULU_NATAL: ['Durban', 'Pietermaritzburg', 'Newcastle', 'Richards Bay'],
  LIMPOPO: ['Polokwane', 'Mokopane', 'Thohoyandou', 'Musina'],
  MPUMALANGA: ['Nelspruit', 'Witbank', 'Secunda', 'Ermelo'],
  NORTHERN_CAPE: ['Kimberley', 'Upington', 'Kuruman', 'Springbok'],
  NORTH_WEST: ['Rustenburg', 'Potchefstroom', 'Klerksdorp', 'Mahikeng'],
  WESTERN_CAPE: ['Cape Town', 'Stellenbosch', 'Paarl', 'George', 'Knysna'],
};

// Job-related constants
export const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'REMOTE'] as const;
export const EXPERIENCE_LEVELS = ['ENTRY_LEVEL', 'JUNIOR', 'MID_LEVEL', 'SENIOR', 'EXECUTIVE'] as const;
export const SUBSCRIPTION_PLANS = ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'] as const;

// Subscription features
export const SUBSCRIPTION_FEATURES = {
  FREE: {
    jobApplications: 5,
    cvUploads: 1,
    jobAlerts: 1,
    aiMatching: false,
    priority: false,
  },
  BASIC: {
    jobApplications: 20,
    cvUploads: 3,
    jobAlerts: 5,
    aiMatching: true,
    priority: false,
  },
  PROFESSIONAL: {
    jobApplications: 100,
    cvUploads: 10,
    jobAlerts: 20,
    aiMatching: true,
    priority: true,
  },
  ENTERPRISE: {
    jobApplications: -1, // unlimited
    cvUploads: -1,
    jobAlerts: -1,
    aiMatching: true,
    priority: true,
  },
};

export default config;
