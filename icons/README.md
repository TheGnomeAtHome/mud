# PWA Icons Guide

You need to create app icons for different sizes. Here are your options:

## Option 1: Use an Online Generator (Easiest)

1. **Go to:** https://www.pwabuilder.com/imageGenerator
2. **Upload a 512x512 image** (can be PNG, JPG)
3. **Click "Generate"** - it creates all sizes automatically
4. **Download** and extract to the `/icons/` folder

## Option 2: Use Photopea (Free Photoshop Alternative)

1. **Go to:** https://www.photopea.com
2. **Create** 512x512 canvas with black background
3. **Add** green (#00ff41) "MUD" text in VT323 font
4. **Export** as PNG
5. **Use PWA Builder** (option 1) to generate all sizes

## Option 3: Manual Creation

Create these sizes manually:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

## Icon Design Tips

**Your Icon Should:**
- Use your game's colors (black #0d0d0d background, green #00ff41 text/design)
- Be simple and recognizable
- Work at small sizes
- Not have thin lines (they disappear at small sizes)

**Suggested Design:**
```
Black background (#0d0d0d)
Large green "MUD" text (#00ff41)
Maybe a small sword or dungeon icon
```

## Temporary Solution

For now, I've created a README. You can temporarily use any 512x512 image and the PWA will still work (just with a generic icon).

The app will function without icons, but they're needed for:
- Home screen icon
- App switcher
- Splash screen
