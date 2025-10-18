# MUD Game Refactoring Guide

## Current Structure
- **index.html** - Single 2559-line file containing everything

## Recommended Structure

```
MUD/
├── index.html              # Clean HTML structure only
├── css/
│   └── style.css          # ✅ DONE - All styles
├── js/
│   ├── config.js          # Configuration & constants
│   ├── firebase-config.js # Firebase initialization
│   ├── ai.js              # AI/Gemini API functions
│   ├── game-state.js      # Game state management
│   ├── game-logic.js      # Core game functions
│   ├── commands.js        # Command execution
│   ├── combat.js          # Combat system
│   ├── admin.js           # Admin panel logic
│   └── main.js            # Main initialization & event handlers
└── README.md
```

## File Breakdown

### **js/config.js** (Export constants)
```javascript
export const APP_ID = 'mudgame-3cbb1';
export const GEMINI_API_KEY = "YOUR_KEY_HERE";
export const GEMINI_MODEL = "gemini-2.0-flash";
```

### **js/firebase-config.js** (Firebase setup)
```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export function initFirebase() {
    const firebaseConfig = { /* config */ };
    const app = initializeApp(firebaseConfig);
    return {
        app,
        auth: getAuth(app),
        db: getFirestore(app)
    };
}
```

### **js/ai.js** (AI functions)
```javascript
import { GEMINI_API_KEY, GEMINI_MODEL } from './config.js';

export async function callGeminiForText(prompt) { /* ... */ }
export async function parseCommandWithGemini(command) { /* ... */ }
export async function callGeminiForRoom(prompt, data) { /* ... */ }
export async function callGeminiForMonster(prompt, data) { /* ... */ }
export async function callGeminiForItem(prompt, data) { /* ... */ }
export async function callGeminiForNpc(prompt, data) { /* ... */ }
```

### **js/game-state.js** (State management)
```javascript
export const gameState = {
    world: {},
    items: {},
    npcs: {},
    monsters: {},
    activeMonsters: {},
    players: {},
    currentPlayerId: null,
    currentPlayerRoomId: null,
    playerName: '',
    lastNpcInteraction: null
};
```

### **js/game-logic.js** (Game functions)
```javascript
export function generateAttributes() { /* ... */ }
export async function initializeGameData() { /* ... */ }
export async function showRoom(roomId) { /* ... */ }
export async function spawnMonster(monsterId, roomId) { /* ... */ }
```

### **js/commands.js** (Command execution)
```javascript
export async function executeParsedCommand(parsedCommand, cmdText) { /* ... */ }
// Handle all game commands
```

### **js/admin.js** (Admin panel)
```javascript
export function initAdminPanel(db, appId) {
    // All admin panel event listeners and functions
}
```

### **js/main.js** (Main entry point)
```javascript
import { initFirebase } from './firebase-config.js';
import { initAdminPanel } from './admin.js';
// ... other imports

// Main initialization
const { app, auth, db } = initFirebase();
// ... setup auth listeners, game initialization
```

### **index.html** (Clean structure)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Multi-User Dungeon</title>
    <link rel="stylesheet" href="css/style.css">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <!-- Game UI -->
    <div id="app-container">...</div>
    <div id="admin-panel">...</div>
    
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

## Migration Steps

### Option 1: Gradual Migration (Recommended)
1. ✅ Extract CSS (DONE)
2. Extract configuration (config.js)
3. Extract one module at a time (AI first, then game logic, etc.)
4. Test after each extraction
5. Keep backup of working version

### Option 2: Full Refactor
- Rebuild from scratch using modules
- More work but cleaner result
- Risk of breaking things

### Option 3: Hybrid Approach
- Keep current single-file version as `index-legacy.html`
- Create new modular version alongside it
- Gradually migrate features
- Switch when stable

## Benefits of Splitting

✅ **Easier to maintain** - Find code quickly  
✅ **Better organization** - Logical separation  
✅ **Reusability** - Import modules where needed  
✅ **Team collaboration** - Multiple people can work on different files  
✅ **Version control** - See changes per module  
✅ **Testing** - Test individual modules  

## Challenges

⚠️ **Scope management** - Need to carefully manage what's global vs module-scoped  
⚠️ **Import/Export** - Must properly export/import functions between modules  
⚠️ **Firebase references** - Auth, DB need to be passed around or made accessible  
⚠️ **State sharing** - Game state needs to be accessible across modules  

## Quick Win: Extract Just AI Functions

If you want a quick improvement without full refactor:

1. Keep most code in index.html
2. Extract only AI functions to `js/ai.js`
3. Import AI module in main script
4. This gives you modularity for the most complex part

Would you like me to:
A) Create the full modular structure? (lots of work)
B) Just extract AI functions as a quick win? (easy)
C) Create a skeleton/template you can fill in gradually? (middle ground)
