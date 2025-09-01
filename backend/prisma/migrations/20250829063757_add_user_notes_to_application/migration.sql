-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('SUBMITTED', 'VIEWED', 'REVIEWED', 'INTERVIEWING', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ScheduledApplicationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "BackgroundJobType" AS ENUM ('AUTO_APPLICATION_SUBMIT', 'EMAIL_NOTIFICATION', 'CV_ANALYSIS', 'SKILL_EXTRACTION', 'COMPANY_RESEARCH', 'SALARY_BENCHMARK_UPDATE');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED', 'PENDING');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PAYMENT', 'REFUND', 'CHARGEBACK', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "userNotes" TEXT;

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "coverLetter" TEXT,
    "cvId" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "responseTime" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "scheduledApplicationId" TEXT,
    "estimatedSuccessRate" DOUBLE PRECISION,
    "matchScore" DOUBLE PRECISION,
    "timingScore" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "coverLetter" TEXT NOT NULL,
    "cvId" TEXT,
    "timingAnalysis" JSONB NOT NULL,
    "estimatedSuccessRate" DOUBLE PRECISION NOT NULL,
    "config" JSONB NOT NULL,
    "executedAt" TIMESTAMP(3),
    "applicationId" TEXT,
    "failureReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationTracking" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "previousStatus" TEXT,
    "notes" TEXT,
    "wasViewed" BOOLEAN NOT NULL DEFAULT false,
    "responseTime" INTEGER,
    "responseType" TEXT,
    "timingScore" DOUBLE PRECISION,
    "actualSubmissionTime" TIMESTAMP(3),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" "BackgroundJobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "lastError" TIMESTAMP(3),
    "userId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimingFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "timingScore" DOUBLE PRECISION NOT NULL,
    "wasSuccessful" BOOLEAN NOT NULL,
    "submissionTime" TIMESTAMP(3) NOT NULL,
    "responseTime" INTEGER,
    "industryContext" TEXT,
    "companySize" TEXT,
    "jobLevel" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "skills" TEXT[],
    "location" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "completionScore" DOUBLE PRECISION,
    "skillsAnalysis" JSONB,
    "profileSummary" TEXT,
    "jobSearchStatus" TEXT NOT NULL DEFAULT 'active',
    "availabilityDate" TIMESTAMP(3),
    "salaryExpectation" DOUBLE PRECISION,
    "preferredRoles" TEXT[],
    "preferredIndustries" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "showContact" BOOLEAN NOT NULL DEFAULT false,
    "allowRecruiterContact" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationActivity" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "performedBy" TEXT,
    "source" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationTimingData" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "optimalSubmissionTime" TIMESTAMP(3) NOT NULL,
    "actualSubmissionTime" TIMESTAMP(3) NOT NULL,
    "timingScore" DOUBLE PRECISION NOT NULL,
    "firstViewTime" TIMESTAMP(3),
    "avgViewTime" TIMESTAMP(3),
    "responseTime" INTEGER,
    "industryBenchmark" DOUBLE PRECISION,
    "companyBenchmark" DOUBLE PRECISION,
    "seasonalFactor" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationTimingData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerDNA" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalityType" TEXT,
    "workStyle" JSONB,
    "motivationFactors" TEXT[],
    "idealWorkEnvironment" JSONB,
    "careerValues" TEXT[],
    "riskTolerance" TEXT,
    "coreStrengths" TEXT[],
    "developmentAreas" TEXT[],
    "learningStyle" TEXT,
    "careerPathRecommendations" JSONB,
    "skillGapAnalysis" JSONB,
    "industryFitScore" JSONB,
    "lastAnalyzed" TIMESTAMP(3),
    "confidenceScore" DOUBLE PRECISION,
    "dataCompleteness" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerDNA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorEvent" (
    "id" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "severity" "ErrorSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "stackTrace" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,
    "requestId" TEXT,
    "endpoint" TEXT,
    "method" TEXT,
    "service" TEXT NOT NULL,
    "version" TEXT,
    "environment" TEXT,
    "metadata" JSONB,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseRecord" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "rate" DOUBLE PRECISION,
    "service" TEXT NOT NULL,
    "userId" TEXT,
    "resourceId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "provider" TEXT,
    "providerResourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAccess" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT,
    "accessType" TEXT NOT NULL,
    "accessSource" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "bytesTransferred" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryKeyword" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "category" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "demandScore" DOUBLE PRECISION,
    "synonyms" TEXT[],
    "relatedKeywords" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "description" TEXT NOT NULL,
    "providerIntentId" TEXT,
    "providerClientSecret" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "status" TEXT NOT NULL DEFAULT 'created',
    "confirmationMethod" TEXT,
    "metadata" JSONB,
    "receiptEmail" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "succeededAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceHealthCheck" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "endpoint" TEXT,
    "status" "ServiceStatus" NOT NULL,
    "responseTime" INTEGER,
    "statusCode" INTEGER,
    "checkType" TEXT NOT NULL,
    "expectedResponse" TEXT,
    "actualResponse" TEXT,
    "errorMessage" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorTime" TIMESTAMP(3),
    "uptimePercentage" DOUBLE PRECISION,
    "avgResponseTime" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "interval" TEXT NOT NULL,
    "providerSubscriptionId" TEXT,
    "providerCustomerId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "paymentId" TEXT,
    "subscriptionId" TEXT,
    "reference" TEXT,
    "providerTransactionId" TEXT,
    "providerReference" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "fees" DOUBLE PRECISION,
    "netAmount" DOUBLE PRECISION,
    "processedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobApplication_userId_idx" ON "JobApplication"("userId");

-- CreateIndex
CREATE INDEX "JobApplication_jobId_idx" ON "JobApplication"("jobId");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");

-- CreateIndex
CREATE INDEX "JobApplication_appliedAt_idx" ON "JobApplication"("appliedAt");

-- CreateIndex
CREATE INDEX "JobApplication_source_idx" ON "JobApplication"("source");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_userId_jobId_key" ON "JobApplication"("userId", "jobId");

-- CreateIndex
CREATE INDEX "ScheduledApplication_userId_idx" ON "ScheduledApplication"("userId");

-- CreateIndex
CREATE INDEX "ScheduledApplication_jobId_idx" ON "ScheduledApplication"("jobId");

-- CreateIndex
CREATE INDEX "ScheduledApplication_scheduledFor_idx" ON "ScheduledApplication"("scheduledFor");

-- CreateIndex
CREATE INDEX "ScheduledApplication_status_idx" ON "ScheduledApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledApplication_userId_jobId_key" ON "ScheduledApplication"("userId", "jobId");

-- CreateIndex
CREATE INDEX "ApplicationTracking_applicationId_idx" ON "ApplicationTracking"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationTracking_status_idx" ON "ApplicationTracking"("status");

-- CreateIndex
CREATE INDEX "ApplicationTracking_timestamp_idx" ON "ApplicationTracking"("timestamp");

-- CreateIndex
CREATE INDEX "BackgroundJob_type_idx" ON "BackgroundJob"("type");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_idx" ON "BackgroundJob"("status");

-- CreateIndex
CREATE INDEX "BackgroundJob_scheduledFor_idx" ON "BackgroundJob"("scheduledFor");

-- CreateIndex
CREATE INDEX "BackgroundJob_priority_idx" ON "BackgroundJob"("priority");

-- CreateIndex
CREATE INDEX "BackgroundJob_createdAt_idx" ON "BackgroundJob"("createdAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_userId_idx" ON "BackgroundJob"("userId");

-- CreateIndex
CREATE INDEX "TimingFeedback_userId_idx" ON "TimingFeedback"("userId");

-- CreateIndex
CREATE INDEX "TimingFeedback_action_idx" ON "TimingFeedback"("action");

-- CreateIndex
CREATE INDEX "TimingFeedback_wasSuccessful_idx" ON "TimingFeedback"("wasSuccessful");

-- CreateIndex
CREATE INDEX "TimingFeedback_timestamp_idx" ON "TimingFeedback"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_jobSearchStatus_idx" ON "UserProfile"("jobSearchStatus");

-- CreateIndex
CREATE INDEX "UserProfile_isPublic_idx" ON "UserProfile"("isPublic");

-- CreateIndex
CREATE INDEX "ApplicationActivity_applicationId_idx" ON "ApplicationActivity"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationActivity_activity_idx" ON "ApplicationActivity"("activity");

-- CreateIndex
CREATE INDEX "ApplicationActivity_timestamp_idx" ON "ApplicationActivity"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationTimingData_applicationId_key" ON "ApplicationTimingData"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationTimingData_applicationId_idx" ON "ApplicationTimingData"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationTimingData_timingScore_idx" ON "ApplicationTimingData"("timingScore");

-- CreateIndex
CREATE UNIQUE INDEX "CareerDNA_userId_key" ON "CareerDNA"("userId");

-- CreateIndex
CREATE INDEX "CareerDNA_userId_idx" ON "CareerDNA"("userId");

-- CreateIndex
CREATE INDEX "CareerDNA_lastAnalyzed_idx" ON "CareerDNA"("lastAnalyzed");

-- CreateIndex
CREATE INDEX "ErrorEvent_errorType_idx" ON "ErrorEvent"("errorType");

-- CreateIndex
CREATE INDEX "ErrorEvent_severity_idx" ON "ErrorEvent"("severity");

-- CreateIndex
CREATE INDEX "ErrorEvent_resolved_idx" ON "ErrorEvent"("resolved");

-- CreateIndex
CREATE INDEX "ErrorEvent_createdAt_idx" ON "ErrorEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ErrorEvent_userId_idx" ON "ErrorEvent"("userId");

-- CreateIndex
CREATE INDEX "ExpenseRecord_category_idx" ON "ExpenseRecord"("category");

-- CreateIndex
CREATE INDEX "ExpenseRecord_service_idx" ON "ExpenseRecord"("service");

-- CreateIndex
CREATE INDEX "ExpenseRecord_periodStart_periodEnd_idx" ON "ExpenseRecord"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ExpenseRecord_userId_idx" ON "ExpenseRecord"("userId");

-- CreateIndex
CREATE INDEX "FileAccess_fileId_idx" ON "FileAccess"("fileId");

-- CreateIndex
CREATE INDEX "FileAccess_userId_idx" ON "FileAccess"("userId");

-- CreateIndex
CREATE INDEX "FileAccess_accessType_idx" ON "FileAccess"("accessType");

-- CreateIndex
CREATE INDEX "FileAccess_timestamp_idx" ON "FileAccess"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryKeyword_keyword_key" ON "IndustryKeyword"("keyword");

-- CreateIndex
CREATE INDEX "IndustryKeyword_industry_idx" ON "IndustryKeyword"("industry");

-- CreateIndex
CREATE INDEX "IndustryKeyword_category_idx" ON "IndustryKeyword"("category");

-- CreateIndex
CREATE INDEX "IndustryKeyword_weight_idx" ON "IndustryKeyword"("weight");

-- CreateIndex
CREATE INDEX "IndustryKeyword_trending_idx" ON "IndustryKeyword"("trending");

-- CreateIndex
CREATE INDEX "PaymentIntent_userId_idx" ON "PaymentIntent"("userId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX "PaymentIntent_providerIntentId_idx" ON "PaymentIntent"("providerIntentId");

-- CreateIndex
CREATE INDEX "ServiceHealthCheck_serviceName_idx" ON "ServiceHealthCheck"("serviceName");

-- CreateIndex
CREATE INDEX "ServiceHealthCheck_status_idx" ON "ServiceHealthCheck"("status");

-- CreateIndex
CREATE INDEX "ServiceHealthCheck_timestamp_idx" ON "ServiceHealthCheck"("timestamp");

-- CreateIndex
CREATE INDEX "ServiceHealthCheck_serviceType_idx" ON "ServiceHealthCheck"("serviceType");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_plan_idx" ON "Subscription"("plan");

-- CreateIndex
CREATE INDEX "Subscription_providerSubscriptionId_idx" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_reference_idx" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_providerTransactionId_idx" ON "Transaction"("providerTransactionId");

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "CV"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledApplication" ADD CONSTRAINT "ScheduledApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledApplication" ADD CONSTRAINT "ScheduledApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledApplication" ADD CONSTRAINT "ScheduledApplication_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "CV"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationTracking" ADD CONSTRAINT "ApplicationTracking_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimingFeedback" ADD CONSTRAINT "TimingFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationActivity" ADD CONSTRAINT "ApplicationActivity_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationTimingData" ADD CONSTRAINT "ApplicationTimingData_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerDNA" ADD CONSTRAINT "CareerDNA_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAccess" ADD CONSTRAINT "FileAccess_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
