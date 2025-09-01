$filePath = ".\src\services\subscription.service.ts"

# Read the file content
$content = Get-Content -Path $filePath -Raw

# Replace literal \n with actual newlines
$content = $content -replace '\\n', "`n"

# Write the fixed content back
Set-Content -Path $filePath -Value $content -NoNewline

Write-Host "Fixed all escape sequences in subscription.service.ts"

# Verify the fix by checking around line 128
$lines = $content -split "`n"
if ($lines.Length -gt 127) {
    Write-Host "Line 128: $($lines[127].Substring(0, [Math]::Min(100, $lines[127].Length)))"
}
