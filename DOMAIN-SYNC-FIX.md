# Domain vs Local Sync Issue - Resolution Guide

## Problem Summary
**Local environment**: ✅ Works perfectly - navigation, dropdowns, API keys all correct
**Domain deployment**: ❌ Broken - old cached JavaScript files being served

## Root Cause
Browser and CDN caching is serving outdated versions of your JavaScript files on the domain, even though you've uploaded new files to the server.

## Files Modified to Fix

### 1. `mud.html`
**Changes**:
- Added cache control meta tags to prevent browser caching
- Added version query parameter to app.js import: `?v=20251019-002`

**What it does**: Forces browsers to fetch fresh JavaScript files on each deployment

### 2. Created `update-version.ps1`
**Purpose**: PowerShell script to auto-increment version numbers

**Usage**:
```powershell
.\update-version.ps1
```

This automatically updates the version in mud.html with a timestamp (e.g., `20251019-143052`).

### 3. Created `DEPLOYMENT.md`
**Purpose**: Complete deployment checklist and troubleshooting guide

**Covers**:
- Cache-busting strategies
- Platform-specific deployment steps
- Verification procedures
- Emergency troubleshooting

## Deployment Process (Step-by-Step)

### Before Every Domain Upload:

1. **Run the version updater**:
   ```powershell
   .\update-version.ps1
   ```

2. **Upload ALL these files** to your domain:
   - ✅ mud.html (with new version number)
   - ✅ js/config.js (with correct API keys)
   - ✅ js/firebase-init.js
   - ✅ js/admin.js
   - ✅ js/data-loader.js
   - ✅ js/ai.js
   - ✅ js/app.js
   - ✅ js/game.js
   - ✅ js/ui.js
   - ✅ js/auth.js
   - ✅ js/bots.js

3. **Clear CDN cache** (if your host uses one):
   - Cloudflare: Dashboard > Caching > Purge Everything
   - Netlify: Auto-clears on deploy
   - Firebase Hosting: Auto-clears with `firebase deploy`
   - cPanel: Look for "Clear Cache" in control panel

4. **Test with hard refresh**:
   - Windows: **Ctrl + F5**
   - Mac: **Cmd + Shift + R**
   - Or use **Incognito/Private browsing** mode

5. **Verify**:
   - Open browser dev tools (F12)
   - Network tab should show `app.js?v=20251019-XXXXXX`
   - Test navigation: `s`, `n`, `south`, `north`
   - Check admin dropdowns populate

## Why Local Works But Domain Doesn't

| Aspect | Local | Domain |
|--------|-------|--------|
| File loading | Direct from disk, always fresh | Through CDN/browser cache |
| Caching | None (file:// protocol) | Aggressive (HTTP caching headers) |
| Updates | Instant on file save | Requires cache invalidation |
| API keys | From local config.js | From cached old config.js |

## Technical Details

### Cache-Busting Methods Implemented

1. **Query Parameters** (`?v=timestamp`)
   - Browsers treat different query strings as different files
   - Each deployment gets a unique version
   - Forces cache miss and fresh download

2. **HTTP Meta Tags**
   ```html
   <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
   ```
   - Tells browsers not to cache the HTML page
   - Ensures version parameter always updates

3. **Version Automation**
   - PowerShell script generates unique timestamps
   - Format: `YYYYMMDD-HHMMSS` (e.g., `20251019-143052`)
   - Prevents human error in version numbering

## Current API Keys (Correct Configuration)

```javascript
// js/config.js
export const GEMINI_API_KEY = "AIzaSyCscVJaLJV1FoOulHQBateoRh1UYhEE5gg";
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD454EmNJFMHPsL2XrNJc7-dQ4bnoCFASs", // DIFFERENT from Gemini!
  authDomain: "mudgame-3cbb1.firebaseapp.com",
  projectId: "mudgame-3cbb1",
  // ...
};
```

**Common mistake**: Using Gemini API key for Firebase (causes `auth/api-key-not-valid` error)

## Debugging Cached Files on Domain

### Check What Version Is Loading

1. Open domain in browser
2. Press F12 for dev tools
3. Go to **Network** tab
4. Hard refresh (Ctrl + F5)
5. Look for `app.js` - should show `?v=20251019-XXXXXX`

### Verify Config.js Contents

Add temporarily to console:
```javascript
import { FIREBASE_CONFIG, GEMINI_API_KEY } from './js/config.js';
console.log('Firebase Key:', FIREBASE_CONFIG.apiKey);
console.log('Gemini Key:', GEMINI_API_KEY);
```

Expected output:
```
Firebase Key: AIzaSyD454EmNJFMHPsL2XrNJc7-dQ4bnoCFASs
Gemini Key: AIzaSyCscVJaLJV1FoOulHQBateoRh1UYhEE5gg
```

### Check Service Workers (Advanced)

Sometimes service workers aggressively cache files:

1. Dev tools > **Application** tab
2. **Service Workers** section
3. If any are registered, click **Unregister**
4. Hard refresh page

## Quick Reference: Deployment Checklist

```
[ ] Run: .\update-version.ps1
[ ] Verify version updated in mud.html
[ ] Upload ALL .js files to domain
[ ] Upload mud.html to domain
[ ] Clear CDN cache (if applicable)
[ ] Hard refresh domain (Ctrl+F5)
[ ] Test navigation commands (s, n, south, north)
[ ] Test admin dropdowns
[ ] Verify console shows correct API keys
```

## Troubleshooting

### "Navigation still broken on domain"

1. Check Network tab - is `?v=` parameter present?
2. If NO: Old mud.html is cached. Clear browser cache completely
3. If YES: Clear CDN cache on hosting provider
4. If still broken: Check browser console for JavaScript errors

### "Dropdowns still empty"

1. Open browser console
2. Look for `[Firestore] Loaded X rooms` messages
3. If no messages: JavaScript not loading (check version parameter)
4. If shows 0 rooms: Firestore rules or data issue (check Firebase console)

### "API key still invalid"

1. Check console: `console.log(FIREBASE_CONFIG.apiKey)`
2. Should show: `AIzaSyD454EmNJFMHPsL2XrNJc7-dQ4bnoCFASs`
3. If shows old key: config.js is cached
4. Solution: Increment version, upload config.js again, hard refresh

## Platform-Specific Notes

### Firebase Hosting
```bash
firebase deploy --only hosting
```
Automatically handles cache invalidation ✅

### Netlify (Git Deploy)
```bash
git push origin main
```
Netlify auto-deploys and clears cache ✅

### Netlify (Manual Upload)
Drag and drop files - auto-clears cache ✅

### Traditional FTP/cPanel
- Must manually run `update-version.ps1` ⚠️
- Upload all files via FileZilla/FTP ⚠️
- May take 5-15 minutes for CDN propagation ⚠️
- Check for "Clear Cache" button in hosting control panel

### Cloudflare CDN
Extra step required:
1. Upload files to host
2. Go to Cloudflare dashboard
3. Caching > Configuration > "Purge Everything"

## Future Enhancements

1. **Automated CI/CD**: GitHub Actions to auto-deploy and version
2. **Build process**: Webpack/Vite to bundle and hash filenames
3. **Service Worker**: Implement proper SW for offline support with versioning
4. **API monitoring**: Alert when API keys change or become invalid

## Need Help?

1. Check `DEPLOYMENT.md` for detailed troubleshooting
2. Run diagnostic tools: `connection-test.html` and `api-key-diagnostics.html`
3. Compare local vs domain with browser dev tools Network tab

---

**Last Updated**: October 19, 2025
**Current Version**: 20251019-002
**Status**: Ready for deployment with cache-busting enabled
