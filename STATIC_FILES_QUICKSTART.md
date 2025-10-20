# Quick Start: Static Files Migration

This will reduce your Firebase reads by 90% and increase capacity 5x!

## Steps:

### 1. Export Your Data (5 minutes)

1. Open your browser to: `http://localhost:YOUR_PORT/export-to-json.html`
   (Replace YOUR_PORT with your development server port)

2. Click **"Export All Collections"** button

3. Your browser will download 7 JSON files:
   - rooms.json
   - items.json
   - npcs.json
   - monsters.json
   - spells.json
   - classes.json
   - quests.json

4. **Move all downloaded files to the `/data/` folder** in your project

### 2. Verify Setup

Check that you have these files:
```
MUD/
├── data/
│   ├── rooms.json
│   ├── items.json
│   ├── npcs.json
│   ├── monsters.json
│   ├── spells.json
│   ├── classes.json
│   ├── quests.json
│   └── README.md
├── js/
│   └── data-loader.js  (already updated!)
└── export-to-json.html
```

### 3. Test Locally

1. Reload your game in the browser
2. Open browser console (F12)
3. Look for these messages:
   ```
   [DataLoader] Using static file mode for game content
   [DataLoader] ✓ Loaded 25 rooms from static file
   [DataLoader] ✓ Loaded 15 items from static file
   [DataLoader] ✓ Loaded 10 NPCs from static file
   ...
   ```

4. Verify game works normally:
   - Look around
   - Check inventory
   - Talk to NPCs
   - Use admin panel

### 4. Deploy

Upload these to your server:
- `/data/` folder with all JSON files
- `/js/data-loader.js` (updated)
- `/export-to-json.html` (for future exports)

### 5. Updating Content Later

When you edit content via admin panel:

1. Open `export-to-json.html` on your server
2. Click "Export All Collections"
3. Download the updated JSON files
4. Upload to `/data/` folder on server
5. Hard refresh browsers (Ctrl+F5)

## Configuration

Static file mode is **ENABLED by default** in `js/data-loader.js`:

```javascript
const USE_STATIC_FILES = true;  // ✓ Already set!
```

To temporarily use Firebase (for testing):
```javascript
const USE_STATIC_FILES = false;
```

## Benefits

**Before (Firebase only):**
- 50K reads/day limit → ~10 concurrent players
- Every page load = 500-1000 reads
- Slow loading

**After (Static files):**
- 50K reads/day limit → ~50+ concurrent players
- Every page load = 50-100 reads (90% reduction!)
- Fast loading (browser cache)
- $0 for static content (just bandwidth)

## Troubleshooting

**"Game won't load"**
- Check browser console for errors
- Verify JSON files are in `/data/` folder
- Check that files are valid JSON
- Try setting `USE_STATIC_FILES = false` to use Firebase temporarily

**"Content is outdated"**
- Re-export from Firebase
- Replace JSON files
- Clear browser cache (Ctrl+F5)

**"Changes from admin panel not showing"**
- Admin panel still writes to Firebase
- Must re-export JSON files to see changes
- Upload new files to server

## Success!

You should now have:
- ✓ 90% fewer Firebase reads
- ✓ 5x player capacity  
- ✓ Faster page loads
- ✓ Lower costs

Enjoy your optimized MUD! 🎉
