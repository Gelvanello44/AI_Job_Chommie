@echo off
echo ========================================
echo AI Job Chommie - Minimal Startup Mode
echo ========================================
echo.
echo This script starts the platform with minimal dependencies
echo and features to get you up and running quickly.
echo.

cd /d "%~dp0"

echo Starting services in minimal mode...
echo.

echo [1/3] Starting Job Scraping Service (Python)...
start "Job Scraping Service" cmd /c "python job_scraping_server.py"
timeout /t 3 /nobreak > nul

echo [2/3] Starting Frontend Development Server...  
start "Frontend Server" cmd /c "cd ai-job-chommie-landing-source && npm run dev"
timeout /t 5 /nobreak > nul

echo [3/3] Backend service will be skipped due to TypeScript compilation issues.
echo         The frontend and job scraping service should work independently.
echo.

echo ========================================
echo SERVICES STARTED
echo ========================================
echo.
echo Frontend:        http://localhost:3000 (or check the terminal for actual port)
echo Job Scraping:     http://localhost:8000
echo Documentation:    http://localhost:8000/docs
echo.
echo To access backend services, you'll need to:
echo 1. Fix the TypeScript compilation errors in ai-job-chommie-backend
echo 2. Set up PostgreSQL and Redis databases
echo 3. Run database migrations
echo.
echo Press any key to continue...
pause > nul
