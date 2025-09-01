@echo off
echo Starting Redis Server...
cd /d "%~dp0"
start /B redis\redis-server.exe
echo Redis Server started on port 6379
echo.
echo To test if Redis is running, use: redis\redis-cli.exe ping
echo To stop Redis, close the Redis window or use Task Manager
pause
