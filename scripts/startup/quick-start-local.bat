@echo off
echo ========================================
echo AI Job Chommie Platform - Local Development Setup
echo ========================================
echo.

REM Set working directory
cd /d "%~dp0"

echo [1/5] Installing Python dependencies...
cd job-scraping-service
pip install -r requirements.txt
cd ..

echo.
echo [2/5] Installing Backend dependencies...  
cd ai-job-chommie-backend
call npm install --legacy-peer-deps
cd ..

echo.
echo [3/5] Installing Frontend dependencies...
cd ai-job-chommie-landing-source  
call npm install --legacy-peer-deps
cd ..

echo.
echo [4/5] Setting up basic configuration...
REM Copy environment files if they don't exist
if not exist ".env" (
    echo Creating basic .env file...
    echo NODE_ENV=development > .env
    echo DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_job_chommie >> .env
    echo REDIS_URL=redis://localhost:6379 >> .env
    echo JWT_ACCESS_SECRET=your-jwt-access-secret-key-change-this-in-production >> .env
    echo JWT_REFRESH_SECRET=your-jwt-refresh-secret-key-change-this-in-production >> .env
    echo FRONTEND_URL=http://localhost:3000 >> .env
    echo BACKEND_URL=http://localhost:5000 >> .env
    echo ENABLE_AI_FEATURES=false >> .env
    echo HUGGINGFACE_API_KEY= >> .env
    echo OPENAI_API_KEY= >> .env
    echo SERPAPI_API_KEY= >> .env
)

echo.
echo [5/5] Services configured and ready!
echo.
echo ========================================
echo SETUP COMPLETE
echo ========================================
echo.
echo To start the services individually:
echo.  
echo 1. Job Scraping Service:
echo    python job_scraping_server.py
echo.
echo 2. Backend API (in ai-job-chommie-backend folder):
echo    npm run dev
echo.
echo 3. Frontend App (in ai-job-chommie-landing-source folder):
echo    npm run dev
echo.
echo NOTE: You'll need PostgreSQL and Redis running locally
echo      OR use Docker if Docker Desktop is working properly
echo.
pause
