# Deployment Checklist for Domain Updates

## Problem
The domain serves cached versions of JavaScript files even after uploading new code. This causes:
- Old config.js with wrong API keys
- Old game logic (broken navigation, dropdowns)
- Inconsistency between local (working) and domain (broken)

## Solution: Cache-Busting Strategy

### 1. Version Query Parameters
**What**: Add `?v=YYYYMMDD-NNN` to script imports
**Why**: Forces browsers and CDNs to fetch new versions

**Current version in mud.html**: `?v=20251019-002`

### 2. Update Process
Every time you deploy changes to the domain:

1. **Increment the version number** in `mud.html`:
   ```html
   <script type="module" src="./js/app.js?v=20251019-003"></script>
   ```

2. **Upload ALL files** to the domain (not just changed files):
   - mud.html (with new version number)
   - js/config.js
   - js/firebase-init.js
   - js/admin.js
   - js/data-loader.js
   - js/ai.js
   - js/app.js
   - js/game.js
   - js/ui.js
   - js/auth.js
   - js/bots.js
   
3. **Clear CDN cache** if your host uses one:
   - Check hosting provider's control panel for "Clear Cache" or "Purge CDN"
   - Common providers: Cloudflare, Netlify, Vercel, Firebase Hosting

4. **Test with hard refresh**:
   - Windows: Ctrl + F5
   - Mac: Cmd + Shift + R
   - Or use Incognito/Private browsing mode

### 3. Verification Steps

After deploying, verify the update worked:

1. **Open browser dev tools** (F12)
2. **Go to Network tab**
3. **Hard refresh** (Ctrl + F5)
4. **Check JS files** - should see `?v=20251019-003` in URLs
5. **Check config.js contents**:
   ```javascript
   console.log('Testing config:', FIREBASE_CONFIG.apiKey);
   ```
   Should show: `AIzaSyD454EmNJFMHPsL2XrNJc7-dQ4bnoCFASs`

6. **Test navigation**: Try `s`, `n`, `south`, `north`
7. **Test admin dropdowns**: Open admin panel, check if dropdowns populate

## Common Hosting Platforms

### Firebase Hosting
```bash
firebase deploy --only hosting
# Automatically invalidates cache
```

### Netlify
1. Upload files via drag-and-drop or Git push
2. Netlify auto-clears cache on deploy
3. Can manually clear in: Site settings > Build & deploy > Post processing > Asset optimization > "Trigger cache purge"

### Vercel
```bash
vercel --prod
# Auto-clears cache
```

### Traditional Web Hosting (cPanel, FTP)
1. Upload files via FTP/FileZilla
2. **Must manually update version number** in mud.html
3. May need to wait 5-15 minutes for CDN propagation
4. Check host's control panel for cache clearing options

### Cloudflare
If using Cloudflare CDN:
1. Dashboard > Caching > Configuration > "Purge Everything"
2. Or use "Purge by URL" for specific files

## Version Numbering Convention

Format: `YYYYMMDD-NNN`
- `YYYYMMDD`: Date (e.g., 20251019 for Oct 19, 2025)
- `NNN`: Sequential number for multiple deploys on same day (001, 002, 003...)

Examples:
- First deploy today: `?v=20251019-001`
- Second deploy today: `?v=20251019-002`
- Tomorrow's first: `?v=20251020-001`

## Emergency: Users Still See Old Version

If users still see cached files after all above steps:

1. **Meta tags** - Add to `<head>` of mud.html:
   ```html
   <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
   <meta http-equiv="Pragma" content="no-cache">
   <meta http-equiv="Expires" content="0">
   ```

2. **Service Workers** - Check if any service worker is caching:
   - Dev tools > Application > Service Workers
   - Click "Unregister" if present

3. **DNS/CDN propagation** - May take up to 24 hours globally
   - Test from different locations/devices
   - Use incognito mode to bypass local cache

## Automated Solution (Future Enhancement)

Create a build script that auto-increments version:

**PowerShell script** (`deploy.ps1`):
```powershell
# Get current timestamp
$version = Get-Date -Format "yyyyMMdd-HHmmss"

# Update mud.html with new version
$content = Get-Content mud.html -Raw
$content = $content -replace '\?v=[^"]+', "?v=$version"
Set-Content mud.html $content

Write-Host "Updated to version: $version"
Write-Host "Now upload all files to your domain"
```

Usage:
```bash
.\deploy.ps1
# Then upload files via FTP or hosting platform
```

## Current Status

- **Local**: ✅ Working correctly with proper API keys
- **Domain**: ⚠️ Serving cached files (old config.js, old game.js)
- **Version updated**: mud.html now has `?v=20251019-002`
- **Next step**: Upload all files with new version to domain

## Files That Changed Recently

These files MUST be uploaded together:
1. `mud.html` - Updated version parameter
2. `js/config.js` - Correct Firebase API key
3. `js/firebase-init.js` - Imports from config.js
4. `js/admin.js` - Fixed classList errors
5. `js/data-loader.js` - Added Firestore diagnostics
6. `js/ai.js` - Direction shortcuts
7. `js/app.js` - Debug logging
8. `js/game.js` - Movement debug logs

Upload ALL files even if you think some haven't changed - avoids version mismatches.
