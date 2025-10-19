# Clean Git Repository History
# This script removes sensitive API keys from your Git repository history

$ErrorActionPreference = "Stop"
Write-Host "Starting repository history cleaning process..." -ForegroundColor Cyan

# Step 1: Create a fresh directory for the clean repository
$cleanDir = "C:\Users\Paul\mud-clean"
if (Test-Path $cleanDir) {
    Remove-Item -Recurse -Force $cleanDir
}
New-Item -ItemType Directory -Path $cleanDir | Out-Null
Set-Location $cleanDir

# Step 2: Clone the repository
Write-Host "Cloning repository..." -ForegroundColor Green
git clone https://github.com/TheGnomeAtHome/mud.git .

# Step 3: Replace API keys in all commits using filter-branch
Write-Host "Cleaning repository history. This may take a while..." -ForegroundColor Yellow

# These commands replace the API keys with placeholders in all files across all branches
git filter-branch --force --tree-filter '
find . -type f -not -path "./.git/*" -exec sed -i "s/AIzaSyBxmx2BCT_xWBHzIMi0l88J5MHo2wVyNZ0/REMOVED_GEMINI_API_KEY/g" {} \;
find . -type f -not -path "./.git/*" -exec sed -i "s/AIzaSyDgIWOeoR7IlUO8h_AFCPWJ1mIaZsxOQ0w/REMOVED_FIREBASE_API_KEY_1/g" {} \;
find . -type f -not -path "./.git/*" -exec sed -i "s/AIzaSyD454EmNJFMHPsL2XrNJc7-dQ4bnoCFASs/REMOVED_FIREBASE_API_KEY_2/g" {} \;
find . -type f -not -path "./.git/*" -exec sed -i "s/AIzaSyDLFgt8jwT8Hde5cNKeyGn0o77UZGyWq9U/REMOVED_FIREBASE_API_KEY_3/g" {} \;
find . -type f -not -path "./.git/*" -exec sed -i "s/AIzaSyCxlPIOexempyCmO3Ljs_T00-Tr_YjNY0o/REMOVED_FIREBASE_API_KEY_4/g" {} \;
' --tag-name-filter cat -- --all

# Step 4: Clean up refs and garbage collect
Write-Host "Cleaning up references..." -ForegroundColor Green
git for-each-ref --format="delete %(refname)" refs/original/ | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Step 5: Force push to remote
Write-Host "Ready to push changes to GitHub" -ForegroundColor Cyan
Write-Host "WARNING: This will overwrite your GitHub repository history!" -ForegroundColor Red
Write-Host "Make sure you have backed up any important data before proceeding." -ForegroundColor Red

$confirmation = Read-Host "Type 'yes' to force push changes to GitHub"
if ($confirmation -eq "yes") {
    Write-Host "Force pushing to GitHub..." -ForegroundColor Yellow
    git push origin --force --all
    git push origin --force --tags
    Write-Host "Repository history has been cleaned and pushed to GitHub!" -ForegroundColor Green
    
    Write-Host "`nIMPORTANT NEXT STEPS:" -ForegroundColor Magenta
    Write-Host "1. All collaborators should run: git fetch origin && git reset --hard origin/main" -ForegroundColor Cyan
    Write-Host "2. Rotate all API keys that were exposed" -ForegroundColor Cyan
    Write-Host "3. Update your local config files with new API keys" -ForegroundColor Cyan
    Write-Host "4. Run: .\save-local-config.ps1" -ForegroundColor Cyan
} else {
    Write-Host "Push cancelled. Your local cleaned repository is at: $cleanDir" -ForegroundColor Yellow
    Write-Host "You can manually push later with: git push origin --force --all" -ForegroundColor Yellow
}

# Return to original directory
Set-Location "C:\Users\Paul\Documents\MUD"