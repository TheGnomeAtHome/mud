# Deployment Version Updater
# This script automatically updates the version number in mud.html for cache-busting

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   MUD Game Deployment Version Updater" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if mud.html exists
if (-not (Test-Path "mud.html")) {
    Write-Host "ERROR: mud.html not found in current directory!" -ForegroundColor Red
    Write-Host "Please run this script from the MUD project root folder." -ForegroundColor Yellow
    exit 1
}

# Generate new version number
$date = Get-Date -Format "yyyyMMdd"
$time = Get-Date -Format "HHmmss"
$newVersion = "$date-$time"

Write-Host "Reading mud.html..." -ForegroundColor Yellow

# Read the file
$content = Get-Content "mud.html" -Raw

# Find current version
if ($content -match '\?v=([^"]+)') {
    $oldVersion = $matches[1]
    Write-Host "Current version: $oldVersion" -ForegroundColor Gray
} else {
    $oldVersion = "none"
    Write-Host "No version found (will add one)" -ForegroundColor Gray
}

# Replace or add version
if ($content -match 'src="\.\/js\/app\.js\?v=[^"]+') {
    # Replace existing version
    $content = $content -replace '(src="\.\/js\/app\.js)\?v=[^"]+', "`$1?v=$newVersion"
} elseif ($content -match 'src="\.\/js\/app\.js"') {
    # Add version parameter
    $content = $content -replace '(src="\.\/js\/app\.js)"', "`$1?v=$newVersion`""
} else {
    Write-Host "ERROR: Could not find app.js script tag in mud.html" -ForegroundColor Red
    exit 1
}

# Write back to file
Set-Content "mud.html" $content -NoNewline

Write-Host "✓ Updated version to: $newVersion" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Upload ALL files to your domain:" -ForegroundColor White
Write-Host "   - mud.html (with new version)" -ForegroundColor Gray
Write-Host "   - js/config.js" -ForegroundColor Gray
Write-Host "   - js/firebase-init.js" -ForegroundColor Gray
Write-Host "   - js/admin.js" -ForegroundColor Gray
Write-Host "   - js/data-loader.js" -ForegroundColor Gray
Write-Host "   - js/ai.js" -ForegroundColor Gray
Write-Host "   - js/app.js" -ForegroundColor Gray
Write-Host "   - js/game.js" -ForegroundColor Gray
Write-Host "   - js/ui.js" -ForegroundColor Gray
Write-Host "   - js/auth.js" -ForegroundColor Gray
Write-Host "   - js/bots.js" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Clear CDN cache (if applicable)" -ForegroundColor White
Write-Host ""
Write-Host "3. Test with hard refresh (Ctrl+F5)" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
