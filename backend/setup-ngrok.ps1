# Ngrok Setup Script for Yoco Webhook Testing
# This script helps you set up ngrok to expose your local server

Write-Host " Ngrok Setup for Yoco Webhooks" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow

# Check if ngrok is installed
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokPath) {
    Write-Host " Ngrok not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host " Please download and install ngrok:" -ForegroundColor Cyan
    Write-Host "   1. Go to: https://ngrok.com/download"
    Write-Host "   2. Download the Windows version"
    Write-Host "   3. Extract ngrok.exe to a folder in your PATH"
    Write-Host "   4. Run this script again"
    Write-Host ""
    
    $download = Read-Host "Open ngrok download page? (y/N)"
    if ($download -eq "y") {
        Start-Process "https://ngrok.com/download"
    }
    exit
}

Write-Host " Ngrok found at: $($ngrokPath.Source)" -ForegroundColor Green

# Check if server is running
Write-Host ""
Write-Host " Checking if your server is running..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host " Server is running on port 5000" -ForegroundColor Green
    }
} catch {
    Write-Host " Server not running on port 5000!" -ForegroundColor Red
    Write-Host "   Please start your server first:" -ForegroundColor Yellow
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host ""
    $startServer = Read-Host "Do you want to start the server now? (y/N)"
    if ($startServer -eq "y") {
        Write-Host " Starting server..." -ForegroundColor Cyan
        Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory (Get-Location)
        Start-Sleep 5
    } else {
        exit
    }
}

Write-Host ""
Write-Host " Starting ngrok tunnel..." -ForegroundColor Cyan
Write-Host "   This will expose http://localhost:5000 to the internet"
Write-Host "   Keep this window open while testing webhooks"
Write-Host ""

# Start ngrok
try {
    Write-Host " Running: ngrok http 5000" -ForegroundColor Yellow
    Write-Host ""
    Write-Host " Instructions:" -ForegroundColor Cyan
    Write-Host "   1. Look for the HTTPS URL (e.g., https://abc123.ngrok.io)"
    Write-Host "   2. Copy that URL"
    Write-Host "   3. In another terminal, run: node register-yoco-webhook.js"
    Write-Host "   4. Choose option 1 and paste your ngrok HTTPS URL"
    Write-Host ""
    Write-Host " Press Ctrl+C to stop ngrok when done"
    Write-Host ""
    
    & ngrok http 5000
} catch {
    Write-Host " Failed to start ngrok: $($_.Exception.Message)" -ForegroundColor Red
}
