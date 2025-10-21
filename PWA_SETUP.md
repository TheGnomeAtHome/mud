# PWA Setup Guide - MUD Game

Your MUD game is now configured as a Progressive Web App (PWA)!

## What This Means

Users can now:
- **Install your game** like a native app
- **Play from home screen** with an app icon
- **Work offline** (basic functionality cached)
- **No app store needed** - install directly from browser

---

## Files to Upload to Server

Upload these new files to your server at `/mud/`:

### Required Files:
1. ✅ **manifest.json** - App configuration
2. ✅ **service-worker.js** - Offline caching
3. ✅ **offline.html** - Offline fallback page
4. ✅ **mud.html** (v021) - Updated with PWA integration

### Optional but Recommended:
5. 📁 **icons/** folder - App icons (see icons/README.md)
6. 📁 **screenshots/** folder - Install prompt images (see screenshots/README.md)

---

## Testing the PWA

### On Desktop (Chrome/Edge):

1. Open your game: `https://jphsoftware.com/mud/mud.html`
2. Look for the **install icon** in the address bar (⊕ or install button)
3. Click it and select "Install"
4. Game opens as standalone app!

### On Android:

1. Open Chrome on your phone
2. Go to your game URL
3. Tap the **3-dot menu** → **"Add to Home screen"**
   - Or Chrome will show an install banner automatically
4. Tap **"Install"**
5. Icon appears on home screen!
6. Tap icon to launch like a native app

### On iOS (iPhone/iPad):

1. Open Safari on your iPhone
2. Go to your game URL
3. Tap the **Share** button (square with arrow)
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **"Add"**
6. Icon appears on home screen!

---

## Checking Service Worker Registration

After uploading files:

1. Open your game in Chrome
2. Press **F12** to open DevTools
3. Go to **"Application"** tab
4. Click **"Service Workers"** in left sidebar
5. You should see: `✓ Activated and running`

If you see errors, check the Console tab for details.

---

## What Works Offline

With the service worker cached:
- ✅ Basic UI loads
- ✅ Can see character data (if previously loaded)
- ❌ Real-time multiplayer (requires internet)
- ❌ Firebase authentication (requires internet)
- ❌ AI features (requires internet)

The offline page will display if completely disconnected.

---

## Customization Options

### manifest.json - App Settings

You can customize:

```json
{
  "name": "Multi-User Dungeon",        // Full app name
  "short_name": "MUD",                  // Home screen label
  "description": "Your description",    // App description
  "theme_color": "#00ff41",            // Status bar color
  "background_color": "#0d0d0d",       // Splash screen background
  "start_url": "/mud/mud.html"         // Where app opens
}
```

### service-worker.js - Caching

Currently caches:
- HTML, CSS, JavaScript files
- External fonts and libraries

Skips caching:
- Firebase API calls
- Google Gemini AI calls

You can add more files to cache in the `urlsToCache` array.

---

## Updating the PWA

When you make changes:

1. **Update files on server** as usual
2. **Update CACHE_NAME** in service-worker.js:
   ```javascript
   const CACHE_NAME = 'mud-game-v2'; // Increment version
   ```
3. **Upload service-worker.js**
4. Users will automatically get updates on next visit

The service worker checks for updates automatically.

---

## Creating App Icons

### Quick Method (5 minutes):

1. Go to https://www.pwabuilder.com/imageGenerator
2. Upload a 512x512 image (your game logo/design)
3. Click "Generate" - creates all sizes
4. Download and extract to `/mud/icons/` folder
5. Upload to server

### Icon Design Suggestions:

**Simple "MUD" Logo:**
- Black background (#0d0d0d)
- Green "MUD" text (#00ff41) in VT323 font
- Maybe add a small sword/dungeon icon

**Tools to Create:**
- https://www.photopea.com (free Photoshop)
- https://www.canva.com (templates)
- Gimp (free desktop software)

---

## Troubleshooting

### "Add to Home Screen" doesn't appear

**Requirements:**
- ✅ HTTPS connection (not HTTP)
- ✅ manifest.json properly linked
- ✅ Service worker registered
- ✅ At least one icon (192x192 or 512x512)

**Check:**
1. Open DevTools → Application → Manifest
2. Look for errors in red
3. Check Console for service worker errors

### Service Worker won't register

**Common fixes:**
1. Check file path: `/mud/service-worker.js`
2. Update cache paths in service-worker.js to match your structure
3. Clear browser cache (Ctrl+Shift+Delete)
4. Hard refresh (Ctrl+F5)

### App won't update

1. Increment CACHE_NAME in service-worker.js
2. Upload new service-worker.js
3. Users: Close and reopen app
4. Or: DevTools → Application → Service Workers → Unregister

---

## Future: Capacitor (Option 2)

When you're ready to publish to Google Play Store:

1. **Install Capacitor:**
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init
   ```

2. **Add Android platform:**
   ```bash
   npm install @capacitor/android
   npx cap add android
   ```

3. **Build APK:**
   ```bash
   npx cap sync
   npx cap open android
   ```

4. **Android Studio** opens → Build → Generate Signed Bundle/APK

Your PWA setup (manifest.json, service worker) will work perfectly with Capacitor!

---

## Benefits of PWA vs Regular Website

✅ **Installable** - Appears in app drawer/home screen
✅ **Standalone** - Opens without browser UI
✅ **Offline Support** - Works without internet (limited)
✅ **Fast Loading** - Assets cached locally
✅ **Push Notifications** - Can add later (with user permission)
✅ **Smaller Size** - ~2MB vs ~50MB native app
✅ **Auto-Updates** - No app store approval needed
✅ **Cross-Platform** - Works on Android AND iOS

---

## Statistics & Testing

After setup, you can track:
- Number of installs
- App usage vs website usage
- Service worker cache hit rate

**Tools:**
- Chrome DevTools → Application tab
- Lighthouse audit (in DevTools)
- Google Analytics (can track PWA installs)

---

## Questions?

The PWA is ready to go! Just upload the files and test.

**Next Steps:**
1. Upload 4 required files (manifest.json, service-worker.js, offline.html, mud.html)
2. Create icons using PWA Builder
3. Upload icons folder
4. Test installation on your phone
5. Share install instructions with players!

Your game now works as both:
- 🌐 Regular website (browser)
- 📱 Installable app (PWA)

Same code, two experiences!
