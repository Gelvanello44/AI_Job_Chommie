-- AI Job Chommie Performance Indexes (Corrected for Prisma naming)
-- Run with: psql -U ai_job_user -h localhost -d ai_job_chommie -f create-performance-indexes.sql

-- Full-text search for job matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_fulltext 
ON "Job" USING gin(to_tsvector('english', title || ' ' || description));

-- User lookup optimizations (correct column names)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_subscription_plan ON "User"("subscriptionPlan");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_quota_reset ON "User"("quotaResetDate") WHERE "quotaResetDate" IS NOT NULL;

-- Application performance (correct column names)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_user_status ON "Application"("userId", status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_created_month ON "Application"((date_trunc('month', "createdAt")));

-- Job search optimizations (correct column names)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_salary_range ON "Job"("salaryMin", "salaryMax") WHERE "salaryMin" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_remote_active ON "Job"("isRemote", active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_experience_level ON "Job"("experienceLevel", active);

-- JSON field optimizations for AI features (correct column names)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cvs_parsed_data_gin ON "CV" USING gin("parsedData");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_metadata_gin ON "UserActivity" USING gin(metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_skills_assessment_results ON "SkillsAssessment" USING gin(results);

-- Job alerts performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_alerts_keywords_gin ON "JobAlert" USING gin(keywords);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_alerts_provinces_gin ON "JobAlert" USING gin(provinces);

-- Analytics and reporting (correct column names)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_match_scores_overall ON "JobMatchScore"("overallScore" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_created ON "Payment"(status, "createdAt" DESC);

-- Executive features (correct column names)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_networking_events_start_active ON "NetworkingEvent"("startDateTime", active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personal_brand_audit_score ON "PersonalBrandAudit"("overallScore") WHERE "overallScore" IS NOT NULL;

-- Newsletter system (correct column names)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_targeting ON "Newsletter" USING gin("targetAudience");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_newsletter_sub_active ON "NewsletterSubscription"(subscribed, "newsletterId");

-- Company search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_industry_province ON "Company"(industry, province);

-- Salary benchmarking performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_salary_benchmark_lookup ON "SalaryBenchmark"("jobTitle", "experienceLevel", province);

-- Success message
SELECT 'All corrected performance indexes created successfully!' AS status;
