# Hybrid Mode for Multi-Admin Collaboration

## Overview
Hybrid mode allows you to configure **which collections load from Firebase** (for live editing by multiple admins) and **which load from static files** (for performance and reduced Firebase costs).

## The Problem with Static Files
- **Static files are great for performance** - 90% fewer Firebase reads, faster loading
- **BUT they don't support real-time collaboration** - changes require:
  1. Admin edits in Firebase
  2. Export to JSON files
  3. Commit to git
  4. Other admins pull changes
  5. Players refresh to see updates

## The Hybrid Solution
**Load frequently-edited collections from Firebase, stable collections from static files**

### Current Configuration (`js/data-loader.js`)
```javascript
const STATIC_CONFIG = {
    rooms: false,      // ⚡ Firebase - admins build rooms live
    items: true,       // 📁 Static - items rarely change
    npcs: false,       // ⚡ Firebase - admins add NPCs frequently
    monsters: true,    // 📁 Static - monster templates stable
    classes: true,     // 📁 Static - classes rarely change
    spells: true,      // 📁 Static - spells rarely change
    quests: true       // 📁 Static - quests change occasionally
};
```

## How It Works

### For Collections Set to `false` (Firebase)
```javascript
rooms: false  // Load from Firebase
```
- Admins edit in admin panel
- Changes visible **immediately** to all players
- Multiple admins can work simultaneously
- No export/commit needed for changes to take effect
- Uses Firebase reads (costs apply)

### For Collections Set to `true` (Static Files)
```javascript
items: true  // Load from static files
```
- Game loads from `data/items.json`
- **Much faster** than Firebase
- **No Firebase reads** (saves costs)
- Changes require export → commit → pull cycle
- Best for rarely-changed content

## Multi-Admin Workflow

### Option 1: Direct Firebase Editing (Current Default)
**Best for: Rooms and NPCs**

1. Admin 1 creates a new room in admin panel
2. Admin 2 sees it immediately (no export needed)
3. Players see it immediately (no refresh needed)
4. **Periodic backups**: Run `npm run export` weekly to backup to static files

### Option 2: Static Files (Current Default)
**Best for: Items, Monsters, Classes, Spells, Quests**

1. Admin 1 edits items in admin panel
2. Admin 1 runs `npm run export` (saves to `data/items.json`)
3. Admin 1 commits and pushes to git
4. Admin 2 pulls changes
5. Players refresh page to load updated static files

## Configuration Examples

### Scenario 1: Heavy Building Phase (Multiple Admins)
```javascript
const STATIC_CONFIG = {
    rooms: false,      // ⚡ Live building
    items: false,      // ⚡ Adding new items frequently
    npcs: false,       // ⚡ Creating NPCs
    monsters: false,   // ⚡ Balancing monster stats
    classes: true,     // 📁 Classes stable
    spells: true,      // 📁 Spells stable
    quests: false      // ⚡ Creating quests
};
```
**Result**: All actively-edited content loads from Firebase, only stable content from static files.

### Scenario 2: Stable Game (Performance Focus)
```javascript
const STATIC_CONFIG = {
    rooms: true,       // 📁 World complete
    items: true,       // 📁 Items finalized
    npcs: true,        // 📁 NPCs finalized
    monsters: true,    // 📁 Monsters balanced
    classes: true,     // 📁 Classes stable
    spells: true,      // 📁 Spells stable
    quests: true       // 📁 Quests complete
};
```
**Result**: Maximum performance, minimal Firebase costs, but changes require export workflow.

### Scenario 3: Solo Admin
```javascript
const USE_STATIC_FILES = false;  // Just set this to false
```
**Result**: Everything from Firebase, edit freely, no export needed.

## Export Workflow

### Method 1: Node.js Script (Recommended)
**Saves directly to `/data/` folder**

1. **Install Node.js** (one-time):
   - Download from https://nodejs.org/ (LTS version)
   - Run installer with defaults
   - Restart PowerShell

2. **Install dependencies** (one-time):
   ```powershell
   cd C:\Users\Paul\Documents\MUD
   npm install
   ```

3. **Export from Firebase**:
   ```powershell
   npm run export
   ```
   
4. **Verify files updated**:
   - Check `data/rooms.json`, `data/items.json`, etc.
   - Files are formatted with 2-space indentation

5. **Commit to git**:
   ```powershell
   git add data/*.json
   git commit -m "Export game data from Firebase"
   git push
   ```

### Method 2: Browser Export (Manual)
**Downloads to Downloads folder, requires manual move**

1. Open game and login as admin
2. Click "Export" tab in admin panel
3. Click "Export All" or individual collection buttons
4. Files download to `Downloads/` folder
5. **Move files** to `C:\Users\Paul\Documents\MUD\data\`
6. Commit to git

## Benefits Summary

### Firebase Loading (false in config)
✅ Real-time collaboration  
✅ Immediate changes visible  
✅ Multiple admins work simultaneously  
✅ No export/commit cycle  
❌ Uses Firebase reads (costs money)  
❌ Slower initial load  

### Static File Loading (true in config)
✅ **90% fewer Firebase reads**  
✅ Faster loading  
✅ Version controlled (git history)  
✅ Works offline  
❌ Requires export workflow  
❌ Changes not immediate  
❌ Admins must coordinate  

## Recommended Strategy

### Phase 1: Active Development
- Set frequently-edited collections to `false` (Firebase)
- Let admins build freely without export hassle
- Run `npm run export` weekly for backups

### Phase 2: Soft Launch
- Keep rooms/NPCs on Firebase (content still being added)
- Move stable content to static files (items, monsters, classes)
- Reduces Firebase costs while allowing content updates

### Phase 3: Production
- Move everything to static files for maximum performance
- Use Firebase only for player data (characters, progress)
- Export workflow is acceptable for infrequent updates

## Troubleshooting

### "Collection shows as empty after changing config"
- Static file might not exist yet
- Run `npm run export` to create it
- Or set that collection to `false` to load from Firebase

### "Changes don't appear for other admins"
- Check if collection is set to `true` (static files)
- If yes, you need to export and commit
- Or change to `false` for real-time updates

### "Game loads slowly"
- Too many collections loading from Firebase
- Move stable collections to static files (`true` in config)
- Check console logs to see which collections load from where

### "npm not recognized"
- Node.js not installed
- Download from https://nodejs.org/
- Restart PowerShell after installation

## Console Logging
The game logs which source each collection loads from:
```
[DataLoader] Using hybrid/static file mode for game content
[DataLoader] Loading rooms from Firebase (live editing enabled)
[DataLoader] Loaded items from static file (147 documents)
[DataLoader] Loading NPCs from Firebase (live editing enabled)
[DataLoader] Loaded monsters from static file (23 documents)
```

This helps you verify the configuration is working as expected.
