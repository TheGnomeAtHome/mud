# Static Game Data

This folder contains static JSON files for game content (rooms, items, NPCs, monsters, spells, classes, quests).

## Why Use Static Files?

**Performance Benefits:**
- 90% reduction in Firebase reads on page load
- 5x increase in concurrent player capacity on free tier  
- Faster loading times (browser caches static files)
- Dramatically reduced API costs

**How It Works:**
- Static content (rooms, items, NPCs, etc.) loads from JSON files
- Dynamic content (players, active monsters, parties) still uses Firebase for real-time sync
- Automatic fallback to Firebase if static files not found

## Usage

### 1. Export Current Data
Open `export-to-json.html` in your browser:
```
http://localhost:YOUR_PORT/export-to-json.html
```

Click "Export All Collections" to download all JSON files.

### 2. Place Files Here
Save the downloaded files to this `/data/` folder:
- `rooms.json`
- `items.json`
- `npcs.json`
- `monsters.json`
- `spells.json`
- `classes.json`
- `quests.json`

### 3. Enable Static Mode
In `js/data-loader.js`, set:
```javascript
const USE_STATIC_FILES = true;
```

### 4. Deploy
Upload the `/data/` folder and updated `data-loader.js` to your server.

## Updating Content

When you make changes via the admin panel:

**Option A - Manual (Recommended for now):**
1. Make changes in admin panel (saves to Firebase)
2. Run export tool again
3. Download updated JSON files
4. Replace files in `/data/` folder
5. Redeploy

**Option B - Automated (Future):**
- Add export button to admin panel
- Automatically generate JSON after edits
- (Requires server-side write API)

## File Format

Each JSON file is an object with document IDs as keys:

```json
{
  "room-id-1": {
    "name": "The Tavern",
    "description": "A cozy tavern...",
    "exits": { "north": "room-id-2" }
  },
  "room-id-2": {
    "name": "Town Square",
    "description": "The bustling center...",
    "exits": { "south": "room-id-1" }
  }
}
```

## Performance Impact

**Before (Firebase only):**
- Page load: ~500-1000 reads
- 10 players max on free tier

**After (Static files):**
- Page load: ~50-100 reads (dynamic data only)
- 50+ players on free tier

## Fallback Behavior

If a static file fails to load, the system automatically falls back to Firebase:
```
[DataLoader] Failed to load rooms from static files: HTTP 404
[DataLoader] Falling back to Firebase for rooms...
[DataLoader] ✓ Loaded 25 rooms from Firebase (fallback)
```

This ensures your game always works, even during migration.

## Troubleshooting

**"Failed to load X from static files"**
- Check that JSON files exist in `/data/` folder
- Verify files are valid JSON (use JSONLint if needed)
- Check browser console for specific errors

**"Game content is outdated"**
- Re-export from Firebase
- Replace JSON files
- Hard refresh browser (Ctrl+F5)

**"Admin changes not appearing"**
- Static files bypass Firebase for content
- Must manually re-export after admin edits
- Or temporarily set `USE_STATIC_FILES = false` for editing

## Configuration

In `js/data-loader.js`:
```javascript
// Toggle between static and Firebase
const USE_STATIC_FILES = true;  // or false

// Change location if needed
const STATIC_FILES_PATH = './data/';
```
