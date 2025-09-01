# PowerShell script to remove all emoji characters from project files

# File extensions to process
$fileExtensions = @(
    "*.py", "*.js", "*.ts", "*.jsx", "*.tsx", 
    "*.md", "*.txt", "*.json", "*.yml", "*.yaml", 
    "*.env", "*.env.*", "*.css", "*.scss", "*.html",
    "*.vue", "*.svelte", "*.astro", "*.xml", "*.toml",
    "*.ini", "*.cfg", "*.conf", "*.sh", "*.ps1",
    "*.java", "*.cpp", "*.c", "*.h", "*.hpp",
    "*.cs", "*.rb", "*.go", "*.rs", "*.swift",
    "*.kt", "*.dart", "*.php", "*.r", "*.R"
)

# Directories to exclude
$excludeDirs = @(
    "node_modules",
    ".git",
    ".vscode",
    ".idea",
    "dist",
    "build",
    "coverage",
    "__pycache__",
    ".pytest_cache",
    "venv",
    ".env",
    "vendor"
)

# Function to remove emojis from content using comprehensive regex patterns
function Remove-Emojis {
    param (
        [string]$content
    )
    
    # Define comprehensive emoji regex patterns using proper Unicode ranges
    $emojiPatterns = @(
        # Main emoji blocks
        '[\x{1F600}-\x{1F64F}]',  # Emoticons
        '[\x{1F300}-\x{1F5FF}]',  # Miscellaneous Symbols and Pictographs
        '[\x{1F680}-\x{1F6FF}]',  # Transport and Map Symbols
        '[\x{1F700}-\x{1F77F}]',  # Alchemical Symbols
        '[\x{1F780}-\x{1F7FF}]',  # Geometric Shapes Extended
        '[\x{1F800}-\x{1F8FF}]',  # Supplemental Arrows-C
        '[\x{1F900}-\x{1F9FF}]',  # Supplemental Symbols and Pictographs
        '[\x{1FA00}-\x{1FA6F}]',  # Chess Symbols
        '[\x{1FA70}-\x{1FAFF}]',  # Symbols and Pictographs Extended-A
        
        # Regional indicators (flags)
        '[\x{1F1E6}-\x{1F1FF}]',
        
        # Miscellaneous symbols
        '[\x{2600}-\x{26FF}]',    # Miscellaneous Symbols
        '[\x{2700}-\x{27BF}]',    # Dingbats
        
        # Additional symbols commonly used as emojis
        '[\x{2B50}]',             # Star
        '[\x{2B55}]',             # Heavy large circle
        '[\x{2B1B}-\x{2B1C}]',    # Black/white large squares
        '[\x{2934}-\x{2935}]',    # Arrow symbols
        '[\x{2B05}-\x{2B07}]',    # Arrow symbols
        '[\x{2B11}]',             # Arrow symbol
        '[\x{2139}]',             # Information source
        '[\x{2194}-\x{2199}]',    # Arrow symbols
        '[\x{21A9}-\x{21AA}]',    # Arrow symbols
        
        # Clock faces
        '[\x{1F550}-\x{1F567}]',
        
        # Keycap sequences
        '[\x{1F51F}]',            # Keycap ten
        '[\x{1F522}-\x{1F523}]',  # Input numbers
        '[\x{1F524}]',            # Input Latin uppercase
        '[\x{1F525}]',            # Fire
        '[\x{1F526}]',            # Flashlight
        
        # Playing cards and mahjong
        '[\x{1F0A0}-\x{1F0FF}]',
        '[\x{1F004}]',            # Mahjong red dragon
        '[\x{1F0CF}]',            # Playing card black joker
        
        # Enclosed characters
        '[\x{1F170}-\x{1F251}]',
        
        # Various symbols
        '[\x{231A}-\x{231B}]',    # Watch and hourglass
        '[\x{2328}]',             # Keyboard
        '[\x{23CF}]',             # Eject button
        '[\x{23E9}-\x{23F3}]',    # Media control symbols
        '[\x{23F8}-\x{23FA}]',    # Media control symbols
        '[\x{24C2}]',             # Circled M
        '[\x{25AA}-\x{25AB}]',    # Black/white small squares
        '[\x{25B6}]',             # Black right-pointing triangle
        '[\x{25C0}]',             # Black left-pointing triangle
        '[\x{25FB}-\x{25FE}]',    # Square symbols
        '[\x{2600}-\x{2604}]',    # Weather symbols
        '[\x{260E}]',             # Black telephone
        '[\x{2611}]',             # Ballot box with check
        '[\x{2614}-\x{2615}]',    # Umbrella and hot beverage
        '[\x{2618}]',             # Shamrock
        '[\x{261D}]',             # White up pointing index
        '[\x{2620}]',             # Skull and crossbones
        '[\x{2622}-\x{2623}]',    # Radioactive and biohazard
        '[\x{2626}]',             # Orthodox cross
        '[\x{262A}]',             # Star and crescent
        '[\x{262E}-\x{262F}]',    # Peace symbol and yin yang
        '[\x{2638}-\x{263A}]',    # Wheel of dharma and smiley
        '[\x{2640}]',             # Female sign
        '[\x{2642}]',             # Male sign
        '[\x{2648}-\x{2653}]',    # Zodiac signs
        '[\x{2660}]',             # Black spade suit
        '[\x{2663}]',             # Black club suit
        '[\x{2665}-\x{2666}]',    # Black heart and diamond suits
        '[\x{2668}]',             # Hot springs
        '[\x{267B}]',             # Black universal recycling symbol
        '[\x{267F}]',             # Wheelchair symbol
        '[\x{2692}-\x{2697}]',    # Various symbols
        '[\x{2699}]',             # Gear
        '[\x{269B}-\x{269C}]',    # Atom symbol and fleur-de-lis
        '[\x{26A0}-\x{26A1}]',    # Warning sign and high voltage
        '[\x{26AA}-\x{26AB}]',    # Medium circles
        '[\x{26B0}-\x{26B1}]',    # Coffin and funeral urn
        '[\x{26BD}-\x{26BE}]',    # Soccer ball and baseball
        '[\x{26C4}-\x{26C5}]',    # Snowman and sun behind cloud
        '[\x{26C8}]',             # Thunder cloud and rain
        '[\x{26CE}]',             # Ophiuchus
        '[\x{26CF}]',             # Pick
        '[\x{26D1}]',             # Helmet with white cross
        '[\x{26D3}-\x{26D4}]',    # Chains and no entry sign
        '[\x{26E9}-\x{26EA}]',    # Shinto shrine and church
        '[\x{26F0}-\x{26F5}]',    # Mountain to sailboat
        '[\x{26F7}-\x{26FA}]',    # Skier to tent
        '[\x{26FD}]',             # Fuel pump
        '[\x{2702}]',             # Black scissors
        '[\x{2705}]',             # White heavy check mark
        '[\x{2708}-\x{2709}]',    # Airplane and envelope
        '[\x{270A}-\x{270B}]',    # Raised fist symbols
        '[\x{270C}-\x{270D}]',    # Victory hand and writing hand
        '[\x{270F}]',             # Pencil
        '[\x{2712}]',             # Black nib
        '[\x{2714}]',             # Heavy check mark
        '[\x{2716}]',             # Heavy multiplication x
        '[\x{271D}]',             # Latin cross
        '[\x{2721}]',             # Star of David
        '[\x{2728}]',             # Sparkles
        '[\x{2733}-\x{2734}]',    # Eight-spoked asterisk
        '[\x{2744}]',             # Snowflake
        '[\x{2747}]',             # Sparkle
        '[\x{274C}]',             # Cross mark
        '[\x{274E}]',             # Negative squared cross mark
        '[\x{2753}-\x{2755}]',    # Question and exclamation marks
        '[\x{2757}]',             # Heavy exclamation mark
        '[\x{2763}-\x{2764}]',    # Heart symbols
        '[\x{2795}-\x{2797}]',    # Heavy plus/minus signs
        '[\x{27A1}]',             # Black rightwards arrow
        '[\x{27B0}]',             # Curly loop
        '[\x{27BF}]',             # Double curly loop
        
        # Variation selectors (often used with emojis)
        '[\x{FE00}-\x{FE0F}]',
        
        # Zero-width joiner (used in emoji sequences)
        '[\x{200D}]'
    )
    
    # Combine all patterns
    $fullPattern = '(' + ($emojiPatterns -join '|') + ')'
    
    # Apply the regex replacement
    $cleaned = $content -replace $fullPattern, ''
    
    # Additional cleanup for any remaining high Unicode characters
    $cleaned = $cleaned -replace '[\x{1F000}-\x{1FFFF}]', ''
    
    return $cleaned
}

# Initialize counters
$filesProcessed = 0
$filesWithEmojis = 0
$totalEmojisRemoved = 0
$modifiedFiles = @()

Write-Host "Starting emoji removal process..." -ForegroundColor Yellow
Write-Host "Searching for files..." -ForegroundColor Cyan

# Get all files matching the specified extensions
$files = @()
foreach ($ext in $fileExtensions) {
    $foundFiles = Get-ChildItem -Path . -Filter $ext -Recurse -File -ErrorAction SilentlyContinue | 
        Where-Object {
            $path = $_.FullName
            $exclude = $false
            foreach ($dir in $excludeDirs) {
                if ($path -match [regex]::Escape($dir)) {
                    $exclude = $true
                    break
                }
            }
            -not $exclude
        }
    $files += $foundFiles
}

Write-Host "Found $($files.Count) files to process" -ForegroundColor Green

# Process each file
foreach ($file in $files) {
    try {
        # Read the file content
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop
        if ($null -eq $content -or $content -eq "") { 
            $filesProcessed++
            continue 
        }
        
        # Check original length and clean emojis
        $originalLength = $content.Length
        $cleanedContent = Remove-Emojis -content $content
        $newLength = $cleanedContent.Length
        
        # If content changed, emojis were found
        if ($originalLength -ne $newLength) {
            $filesWithEmojis++
            $emojisInFile = $originalLength - $newLength
            $totalEmojisRemoved += $emojisInFile
            $modifiedFiles += $file.FullName
            
            Write-Host "Found emojis in: $($file.FullName)" -ForegroundColor Yellow
            Write-Host "  Removed $emojisInFile emoji characters" -ForegroundColor Green
            
            # Write the cleaned content back to the file
            Set-Content -Path $file.FullName -Value $cleanedContent -Encoding UTF8 -NoNewline
        }
        
        $filesProcessed++
        
        # Show progress every 100 files
        if ($filesProcessed % 100 -eq 0) {
            Write-Host "Progress: $filesProcessed files processed..." -ForegroundColor Cyan
        }
        
    } catch {
        Write-Host "Error processing file: $($file.FullName)" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Display completion summary
Write-Host "`nEmoji Removal Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host "Files processed: $filesProcessed" -ForegroundColor White
Write-Host "Files with emojis found: $filesWithEmojis" -ForegroundColor White
Write-Host "Total emoji characters removed: $totalEmojisRemoved" -ForegroundColor White

# Generate detailed report
$reportPath = ".\emoji-removal-report.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$report = @"
Emoji Removal Report
====================
Generated: $timestamp
Project Directory: $(Get-Location)

Summary:
--------
Files processed: $filesProcessed
Files containing emojis: $filesWithEmojis
Total emoji characters removed: $totalEmojisRemoved

Modified Files:
---------------
"@

if ($modifiedFiles.Count -gt 0) {
    foreach ($modifiedFile in $modifiedFiles) {
        $report += "`n- $modifiedFile"
    }
} else {
    $report += "`nNo files were modified (no emojis found)."
}

$report += "`n`nFile Extensions Processed:"
$report += "`n--------------------------"
foreach ($ext in $fileExtensions) {
    $report += "`n- $ext"
}

$report += "`n`nExcluded Directories:"
$report += "`n--------------------"
foreach ($dir in $excludeDirs) {
    $report += "`n- $dir"
}

# Save the report
try {
    Set-Content -Path $reportPath -Value $report -Encoding UTF8
    Write-Host "`nDetailed report saved to: $reportPath" -ForegroundColor Cyan
} catch {
    Write-Host "`nError saving report: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nScript execution completed!" -ForegroundColor Green