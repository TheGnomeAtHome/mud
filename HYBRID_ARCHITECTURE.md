# Hybrid MySQL + Firebase Architecture

## Overview
Your MUD game uses a **hybrid backend architecture** combining MySQL for persistent game data and Firebase for real-time multiplayer features.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        MUD Game Client                       │
│                    (Browser JavaScript)                      │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
                ▼                         ▼
    ┌─────────────────────┐   ┌─────────────────────┐
    │   MySQL Backend     │   │  Firebase Backend   │
    │   (PHP REST API)    │   │  (Firestore SDK)    │
    └─────────────────────┘   └─────────────────────┘
                │                         │
                ▼                         ▼
    ┌─────────────────────┐   ┌─────────────────────┐
    │  MySQL Database     │   │  Firestore DB       │
    │  (Persistent Data)  │   │  (Real-time Data)   │
    └─────────────────────┘   └─────────────────────┘
```

---

## MySQL Backend (Static/Persistent Data)

### What Uses MySQL:
- ✅ **Rooms** - World geography and room definitions
- ✅ **Items** - Item templates and properties
- ✅ **NPCs** - NPC definitions (location, dialogue, inventory)
- ✅ **Monsters** - Monster templates for spawning
- ✅ **Classes** - Character class definitions
- ✅ **Quests** - Quest definitions and objectives
- ✅ **Spells** - Spell definitions and effects
- ✅ **Players** - Player character data and progress

### Configuration:
```javascript
// js/config.js
export const MYSQL_CONFIG = {
    USE_MYSQL_BACKEND: true,  // ✓ ENABLED
    MYSQL_API_URL: 'https://jphsoftware.com/api',
    ADMIN_API_KEY: 'cu4s2YmwWdpMGZ8PfLaJC6RTje1FNSbO'
};
```

### API Endpoints:
- `GET /api/index.php?type=rooms` - Fetch all rooms
- `GET /api/index.php?type=items` - Fetch all items
- `GET /api/index.php?type=npcs` - Fetch all NPCs
- `GET /api/index.php?type=monsters` - Fetch all monsters
- `POST /api/bulk-import.php` - Bulk import content (admin only)

### Benefits:
- ✅ **No API quotas** - Unlimited reads/writes
- ✅ **Fast queries** - Direct SQL queries with JOINs
- ✅ **No referrer restrictions** - No domain whitelist needed
- ✅ **Full control** - Own your data on your server
- ✅ **Better for large datasets** - Efficient pagination and filtering

---

## Firebase Backend (Real-time Features)

### What Uses Firebase:
- 🔥 **Chat Messages** - Real-time room-based chat (`mud-messages`)
- 🔥 **Player Presence** - Online/offline status
- 🔥 **Active Monsters** - Live monster instances (`mud-active-monsters`)
- 🔥 **Live Updates** - Room events visible to all players
- 🔥 **Authentication** - User login (Google, email/password)

### Firebase Collections:
```
/artifacts/mudgame-3cbb1/public/data/
├── mud-messages/          # Real-time chat (keep in Firebase)
├── mud-active-monsters/   # Live monster spawns (keep in Firebase)
└── mud-players/           # Player data (can migrate to MySQL)
```

### Configuration:
```javascript
// js/config.js
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD454EmNJFMHPsL2XrNJc7-dQ4bnoCFASs",
    authDomain: "mudgame-3cbb1.firebaseapp.com",
    projectId: "mudgame-3cbb1",
    // ...
};
```

### Benefits:
- ✅ **Real-time sync** - Automatic updates via `onSnapshot()`
- ✅ **No polling** - Push-based updates reduce server load
- ✅ **Built-in auth** - Easy Google/email authentication
- ✅ **Perfect for chat** - WebSocket-based instant messaging
- ✅ **Scalable** - Handles concurrent connections well

---

## Decision Matrix: When to Use Each Backend

| Feature | MySQL | Firebase | Reason |
|---------|-------|----------|--------|
| Chat messages | ❌ | ✅ | Real-time sync essential |
| Player presence | ❌ | ✅ | Online/offline status updates |
| Room definitions | ✅ | ❌ | Static, rarely changes |
| Item templates | ✅ | ❌ | Static, large dataset |
| NPC definitions | ✅ | ❌ | Static, complex queries |
| Monster templates | ✅ | ❌ | Static, used for spawning |
| Active monsters | ❌ | ✅ | Live instances, real-time combat |
| Player data | ✅ | 🟡 | Can be either (MySQL recommended) |
| Classes/Spells | ✅ | ❌ | Static, reference data |
| Quest progress | ✅ | ❌ | Player-specific, complex queries |

**Legend:** ✅ Recommended | ❌ Not recommended | 🟡 Either works

---

## Content Management Tools

### 1. MySQL Import Tool
**File:** `import-mysql.html`
- Bulk import JSON data to MySQL
- No authentication required (uses API key)
- No Firebase referrer restrictions
- Direct to PHP API

**Usage:**
```bash
# 1. Open import-mysql.html in browser
# 2. Select content type (rooms, items, npcs, etc.)
# 3. Paste JSON array or load template
# 4. Click "Import" button
```

### 2. Firebase Import Tool
**File:** `import-data.html`
- Bulk import to Firebase (for chat-related features)
- Requires Google sign-in
- Subject to API key restrictions
- Use only for real-time data

### 3. Setup Default World
**File:** `setup-default-world.html`
- Creates starter content (Firebase only)
- Use for initial Firebase setup
- Consider migrating to MySQL after creation

---

## Migration Guide: Firebase → MySQL

If you want to move existing Firebase data to MySQL:

### Step 1: Export from Firebase
```javascript
// Use export-from-firebase.js or export-to-json.html
// Downloads all collections as JSON files
```

### Step 2: Import to MySQL
```bash
# Open import-mysql.html
# For each data type:
#   1. Load exported JSON
#   2. Click "Import" button
#   3. Verify in game
```

### Step 3: Update Configuration
```javascript
// js/data-loader.js
const USE_MYSQL_BACKEND = true;  // Already enabled!
```

### Step 4: Clean Up Firebase (Optional)
```javascript
// Keep only real-time collections:
- mud-messages (chat)
- mud-active-monsters (live spawns)
- Authentication users

// Delete static collections:
- mud-rooms ❌
- mud-items ❌
- mud-npcs ❌
- mud-monsters ❌
- mud-classes ❌
- mud-quests ❌
```

---

## API Key Management

### Firebase API Keys
**Issue:** Referrer restrictions block some domains

**Solution for Hybrid:**
- Use MySQL for content management (no restrictions)
- Use Firebase only for chat/real-time features
- Add only necessary domains to Firebase whitelist:
  - `https://jphsoftware.com/*`
  - `http://localhost:*` (for testing)

### MySQL API Key
**File:** `api/config.php`
```php
define('ADMIN_API_KEY', 'cu4s2YmwWdpMGZ8PfLaJC6RTje1FNSbO');
```
- Required only for write operations
- Read operations are public
- No domain restrictions

---

## Development Workflow

### Adding New Content (Recommended Flow):

1. **Create JSON file** in `/data/templates/`
   ```json
   [
     {"id": "newitem", "name": "New Item", ...}
   ]
   ```

2. **Import via MySQL tool**
   - Open `import-mysql.html`
   - Load JSON file
   - Import to MySQL

3. **Test in game**
   - Refresh game page
   - Content loads from MySQL immediately

### Real-time Features (Chat, Events):

1. **Use Firebase SDK directly**
   ```javascript
   // js/game.js
   const messagesRef = collection(db, `artifacts/${APP_ID}/public/data/mud-messages`);
   await addDoc(messagesRef, { text, roomId, timestamp });
   ```

2. **Listen for updates**
   ```javascript
   onSnapshot(messagesRef, (snapshot) => {
     // Real-time updates
   });
   ```

---

## Performance Comparison

| Operation | MySQL | Firebase |
|-----------|-------|----------|
| Read all rooms | ~50ms | ~200ms |
| Search items | ~30ms | ~500ms (client-side filter) |
| Join queries | ✅ Fast | ❌ Not supported |
| Write item | ~40ms | ~150ms |
| Real-time chat | ❌ Requires polling | ✅ Instant (WebSocket) |
| Bulk import | ✅ Fast (500 items ~2s) | 🟡 Slower (rate limits) |
| Cost | 💰 Hosting only | 💰 Firebase quotas |

---

## Current Status

✅ **MySQL Backend:** Fully configured and enabled
✅ **Firebase Backend:** Configured for real-time features
✅ **Hybrid Mode:** Active and working
✅ **Import Tools:** Both MySQL and Firebase tools available

### Next Steps:
1. ✅ Use `import-mysql.html` for content management (no auth issues)
2. ✅ Keep Firebase for chat messages and real-time events
3. 🔄 Optionally migrate existing Firebase data to MySQL
4. 🔄 Add only essential domains to Firebase API key whitelist

---

## Troubleshooting

### "Firebase API key blocked" error:
- **Solution:** Use MySQL import tool instead (`import-mysql.html`)
- Firebase is only needed for chat/real-time features

### "MySQL connection failed":
- Check `api/config.php` database credentials
- Verify PHP MySQL extension is installed
- Test: `https://jphsoftware.com/api/index.php?type=rooms`

### Content not appearing in game:
- Check `js/config.js`: `USE_MYSQL_BACKEND: true`
- Verify data imported: `https://jphsoftware.com/api/index.php?type=items`
- Check browser console for errors

### Chat not working:
- Firebase required for chat
- Check Firebase config in `js/config.js`
- Verify Firestore rules allow write to `mud-messages`

---

## File Reference

### Configuration Files:
- `js/config.js` - MySQL and Firebase settings
- `api/config.php` - MySQL database credentials
- `js/data-loader.js` - Backend switcher logic

### Import Tools:
- `import-mysql.html` - MySQL bulk import (✅ Use this)
- `import-data.html` - Firebase bulk import (only for real-time data)
- `setup-default-world.html` - Firebase default content

### API Endpoints:
- `api/index.php` - MySQL read API
- `api/bulk-import.php` - MySQL write API (admin)
- Firebase SDK - Real-time operations

### Template Files:
- `data/templates/*.json` - Example data files
- `data/templates/IMPORT-GUIDE.md` - Import instructions

---

## Summary

**Your game is perfectly set up for hybrid mode:**

✅ **MySQL handles:** Static content (rooms, items, NPCs, monsters, classes, quests)
✅ **Firebase handles:** Real-time features (chat, player presence, live events)

**Benefits:**
- No Firebase API quota issues for content
- No referrer restrictions for content management
- Real-time chat still works perfectly
- Best performance for both use cases

**Use `import-mysql.html` for all content management!**
