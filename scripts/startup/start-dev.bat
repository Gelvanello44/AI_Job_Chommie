@echo off
echo Starting AI Job Chommie Development Environment...

echo.
echo [1/4] Installing frontend dependencies...
cd ai-job-chommie-landing-source
if not exist node_modules (
    echo Installing frontend node_modules...
    npm install
) else (
    echo Frontend dependencies already installed.
)

echo.
echo [2/4] Installing backend dependencies...
cd ..\ai-job-chommie-backend
if not exist node_modules (
    echo Installing backend node_modules...
    npm install
) else (
    echo Backend dependencies already installed.
)

echo.
echo [3/4] Generating Prisma client...
npm run prisma:generate

echo.
echo [4/4] Starting both frontend and backend...
echo.
echo Backend will start on: http://localhost:5000
echo Frontend will start on: http://localhost:3000
echo.
echo Press Ctrl+C to stop both processes
echo.

:: Start backend in background
start "AI Job Chommie Backend" cmd /k "cd /d "%CD%" && npm run dev"

:: Wait a bit for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend
cd ..\ai-job-chommie-landing-source
start "AI Job Chommie Frontend" cmd /k "cd /d "%CD%" && npm run dev"

echo.
echo Both services started!
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:5000/api-docs (development only)
echo Health Check: http://localhost:5000/health
pause
