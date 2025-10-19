# Restore Local Configuration Files
# This script restores your local configuration files with API keys from the .local backups

Write-Host "Restoring local configuration files..." -ForegroundColor Green

# Check if backup files exist
$backupFiles = @(
    "js\config.js.local", 
    "index.html.local", 
    "setup-default-classes.html.local", 
    "setup-default-spells.html.local", 
    "setup-default-world.html.local"
)

foreach ($file in $backupFiles) {
    $backupPath = Join-Path $PSScriptRoot $file
    $targetPath = $backupPath -replace "\.local$", ""
    
    if (Test-Path $backupPath) {
        Copy-Item -Path $backupPath -Destination $targetPath -Force
        Write-Host "✓ Restored $targetPath" -ForegroundColor Green
    } else {
        Write-Host "! Backup not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nLocal configuration restored with your API keys." -ForegroundColor Cyan
Write-Host "You can now run your application locally." -ForegroundColor Cyan
Write-Host "Note: These files will not be committed to GitHub due to .gitignore settings." -ForegroundColor Cyan