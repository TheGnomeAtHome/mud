# Save Local Configuration Files
# This script saves your local configuration files with API keys to .local backups

Write-Host "Saving local configuration files..." -ForegroundColor Green

# Check if source files exist
$sourceFiles = @(
    "js\config.js", 
    "index.html", 
    "setup-default-classes.html", 
    "setup-default-spells.html", 
    "setup-default-world.html"
)

foreach ($file in $sourceFiles) {
    $sourcePath = Join-Path $PSScriptRoot $file
    $backupPath = "$sourcePath.local"
    
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $backupPath -Force
        Write-Host "✓ Saved $file to $backupPath" -ForegroundColor Green
    } else {
        Write-Host "! Source file not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nLocal configuration backed up with your API keys." -ForegroundColor Cyan
Write-Host "If you update your API keys, run this script again to update your backups." -ForegroundColor Cyan