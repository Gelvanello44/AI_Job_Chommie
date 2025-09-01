-- AI Job Chommie Database Setup Script
-- Run this with: psql -U postgres -h localhost -f setup-database.sql

-- Create dedicated database
CREATE DATABASE ai_job_chommie
  WITH 
  OWNER = postgres
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TABLESPACE = pg_default
  CONNECTION LIMIT = -1;

-- Create dedicated user (optional but recommended)
CREATE USER ai_job_user WITH 
  PASSWORD '0414572811Mla$'
  CREATEDB
  NOSUPERUSER
  NOCREATEROLE;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE ai_job_chommie TO ai_job_user;

-- Connect to new database to set up schema permissions
\c ai_job_chommie;

-- Grant schema permissions for future tables
GRANT ALL ON SCHEMA public TO ai_job_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ai_job_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ai_job_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ai_job_user;

-- Create test database
CREATE DATABASE ai_job_chommie_test
  WITH 
  OWNER = postgres
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TABLESPACE = pg_default
  CONNECTION LIMIT = -1;

GRANT ALL PRIVILEGES ON DATABASE ai_job_chommie_test TO ai_job_user;

-- Success message
SELECT 'Database setup completed successfully!' AS status;
