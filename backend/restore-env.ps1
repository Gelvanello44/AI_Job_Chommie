# Emergency .env Restore Script
# Run this if your .env file ever disappears

Write-Host " AI Job Chommie .env Emergency Restore" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$envExists = Test-Path ".env"
if ($envExists) {
    Write-Host " .env file already exists!" -ForegroundColor Green
    $response = Read-Host "Do you want to backup the current .env and restore? (y/N)"
    if ($response -ne "y") {
        Write-Host " Restore cancelled" -ForegroundColor Red
        exit
    }
}

# Check for backup files
$backupFiles = @()
if (Test-Path ".env.backup") { $backupFiles += ".env.backup" }
if (Test-Path ".env.txt") { $backupFiles += ".env.txt" }
$timestampedBackups = Get-ChildItem -Name ".env.backup-*" -ErrorAction SilentlyContinue

if ($backupFiles.Count -eq 0 -and $timestampedBackups.Count -eq 0) {
    Write-Host " No backup files found!" -ForegroundColor Red
    Write-Host "Please check API_KEYS_MASTER_BACKUP.md for manual restore" -ForegroundColor Yellow
    exit
}

Write-Host " Available backup files:" -ForegroundColor Cyan
for ($i = 0; $i -lt $backupFiles.Count; $i++) {
    Write-Host "  $($i + 1). $($backupFiles[$i])" -ForegroundColor White
}
for ($i = 0; $i -lt $timestampedBackups.Count; $i++) {
    Write-Host "  $($backupFiles.Count + $i + 1). $($timestampedBackups[$i])" -ForegroundColor White
}

$choice = Read-Host "Select backup file number to restore (1-$($backupFiles.Count + $timestampedBackups.Count))"
$selectedFile = ""

if ([int]$choice -le $backupFiles.Count) {
    $selectedFile = $backupFiles[[int]$choice - 1]
} else {
    $selectedFile = $timestampedBackups[[int]$choice - $backupFiles.Count - 1]
}

if (Test-Path $selectedFile) {
    # Create backup of current .env if it exists
    if ($envExists) {
        $timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
        Copy-Item ".env" ".env.backup-before-restore-$timestamp"
        Write-Host " Current .env backed up as: .env.backup-before-restore-$timestamp" -ForegroundColor Green
    }
    
    Copy-Item $selectedFile ".env"
    Write-Host " Successfully restored .env from $selectedFile" -ForegroundColor Green
    Write-Host " Run 'npm run dev' to test the restored configuration" -ForegroundColor Cyan
} else {
    Write-Host " Selected backup file not found!" -ForegroundColor Red
}
