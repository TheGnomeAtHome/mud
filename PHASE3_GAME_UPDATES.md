# Phase 3: Game.js Update Guide

## Critical Update Points in game.js

This document identifies the specific locations in game.js that need to be updated to use the new player persistence system.

### Setup Required

At the top of initializeGameLogic function, add access to playerPersistence:

```javascript
// Add to function parameters or retrieve from window
const playerPersistence = window.playerPersistence;
```

## Movement Commands (Lines ~3445-3650)

**Current:** Uses `updateDoc(playerRef, updates)` twice (north and all other directions)

**Problem:** Movement code handles multiple data types:
- Session data: `roomId` (real-time position)
- Permanent data: `score`, `visitedRooms`, `level` (discovery bonuses)

**Solution:** Split updates based on data type

```javascript
// Instead of:
await updateDoc(playerRef, updates);

// Use:
// 1. Always update roomId in session (fast)
await playerPersistence.updateSession(userId, { roomId: destinationRoomId });

// 2. If new room discovered, sync permanent data to MySQL
if (!playerData.visitedRooms || !playerData.visitedRooms.includes(destinationRoomId)) {
    await playerPersistence.syncToMySQL(userId, {
        score: (playerData.score || 0) + 25,
        visitedRooms: [...(playerData.visitedRooms || []), destinationRoomId]
    });
    
    // If level up, update maxHp/maxMp in session too
    const newLevel = getLevelFromXp(updates.score);
    if (newLevel > (playerData.level || 1)) {
        const newMaxHp = calculateMaxHp(newLevel, playerData);
        const newMaxMp = calculateMaxMp(newLevel, playerData);
        await playerPersistence.syncToMySQL(userId, { level: newLevel });
        await playerPersistence.updateSession(userId, { maxHp: newMaxHp, maxMp: newMaxMp });
    }
}
```

**Locations:**
- Line ~3514: North movement updateDoc
- Line ~3630: All other directions updateDoc

## Inventory Commands

### Get/Take (Lines ~3650+)

**Current:** Adds items to Firebase inventory
**Update:** Use `syncToMySQL` for inventory changes

```javascript
// Instead of:
await updateDoc(playerRef, { inventory: newInventory });

// Use:
await playerPersistence.syncToMySQL(userId, { inventory: newInventory });
```

### Drop (Search for 'case "drop":')

**Current:** Removes items from Firebase inventory
**Update:** Use `syncToMySQL` for inventory changes

```javascript
await playerPersistence.syncToMySQL(userId, { inventory: newInventory });
```

### Buy (Search for 'case "buy":')

**Current:** Updates inventory AND money in Firebase
**Update:** Both are permanent, use `syncToMySQL`

```javascript
await playerPersistence.syncToMySQL(userId, { 
    inventory: newInventory,
    money: newMoney 
});
```

### Sell (Search for 'case "sell":')

**Current:** Updates inventory AND money in Firebase
**Update:** Both are permanent, use `syncToMySQL`

```javascript
await playerPersistence.syncToMySQL(userId, { 
    inventory: newInventory,
    money: newMoney 
});
```

## Equipment Commands

### Equip/Wear (Search for 'case "equip":', 'case "wear":')

**Current:** Updates equipment in Firebase
**Update:** Equipment is permanent, use `syncToMySQL`

```javascript
await playerPersistence.syncToMySQL(userId, { 
    equipment: newEquipment,
    inventory: newInventory 
});
```

### Unequip/Remove (Search for 'case "unequip":', 'case "remove":')

**Current:** Updates equipment in Firebase
**Update:** Use `syncToMySQL`

```javascript
await playerPersistence.syncToMySQL(userId, { 
    equipment: newEquipment,
    inventory: newInventory 
});
```

## Combat System

### Taking Damage (Search for damage calculation functions)

**Current:** Updates hp in Firebase
**Update:** HP is session data, use `updateSession`

```javascript
// Instead of:
await updateDoc(playerRef, { hp: newHp });

// Use:
await playerPersistence.updateSession(userId, { hp: newHp });
```

### Healing (Search for 'heal', 'rest', 'sleep')

**Current:** Updates hp/mp in Firebase
**Update:** Session data, use `updateSession`

```javascript
await playerPersistence.updateSession(userId, { 
    hp: newHp,
    mp: newMp 
});
```

### Monster Kill (Search for monster death/kill handling)

**Current:** Updates xp, monstersKilled, money
**Update:** All permanent, use `syncToMySQL`

```javascript
await playerPersistence.syncToMySQL(userId, {
    score: newXp,
    monstersKilled: (playerData.monstersKilled || 0) + 1,
    money: newMoney
});

// Check for level up
const newLevel = getLevelFromXp(newXp);
if (newLevel > playerData.level) {
    await playerPersistence.syncToMySQL(userId, { level: newLevel });
    // Update session with new maximums
    await playerPersistence.updateSession(userId, {
        maxHp: calculateMaxHp(newLevel, playerData),
        maxMp: calculateMaxMp(newLevel, playerData)
    });
}
```

## Spell System

### Cast Spell (Search for 'case "cast":')

**Current:** Updates mp in Firebase
**Update:** MP is session data, use `updateSession`

```javascript
await playerPersistence.updateSession(userId, { mp: newMp });
```

### Learn Spell (Search for spell learning)

**Current:** Updates knownSpells in Firebase
**Update:** Permanent data, use `syncToMySQL`

```javascript
await playerPersistence.syncToMySQL(userId, { 
    knownSpells: newKnownSpells 
});
```

## Quest System

### Quest Completion (Search for quest completion handling)

**Current:** Updates completedQuests, activeQuests
**Update:** Permanent data, use `syncToMySQL`

```javascript
await playerPersistence.syncToMySQL(userId, {
    completedQuests: newCompleted,
    activeQuests: newActive,
    score: newXp,
    money: newMoney
});
```

### Quest Acceptance (Search for quest acceptance)

**Current:** Updates activeQuests
**Update:** Use `syncToMySQL`

```javascript
await playerPersistence.syncToMySQL(userId, {
    activeQuests: newActive
});
```

## Search Strategy

Use grep to find all `updateDoc` calls in game.js:

```bash
grep -n "updateDoc(playerRef" js/game.js
grep -n "await updateDoc" js/game.js
```

For each occurrence:
1. Identify what data is being updated
2. Check if it's session data (hp, mp, roomId, position, online)
3. Or permanent data (inventory, equipment, xp, quests, etc.)
4. Replace with appropriate playerPersistence method

## Helper Function Suggestion

Add to game.js to simplify updates:

```javascript
// Helper to update player data with correct persistence method
async function updatePlayerData(updates) {
    const sessionKeys = ['hp', 'mp', 'roomId', 'position', 'online', 'lastSeen'];
    const sessionUpdates = {};
    const permanentUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
        if (sessionKeys.includes(key)) {
            sessionUpdates[key] = value;
        } else {
            permanentUpdates[key] = value;
        }
    }
    
    if (Object.keys(sessionUpdates).length > 0) {
        await playerPersistence.updateSession(userId, sessionUpdates);
    }
    
    if (Object.keys(permanentUpdates).length > 0) {
        await playerPersistence.syncToMySQL(userId, permanentUpdates);
    }
}
```

Then use:
```javascript
await updatePlayerData({ 
    hp: newHp,  // Goes to session
    score: newXp,  // Goes to MySQL + Firebase
    roomId: newRoom  // Goes to session
});
```

## Priority Order

1. **HIGH**: Movement (most frequent) - Lines ~3445-3650
2. **HIGH**: Combat damage/healing - Search for HP/MP updates
3. **MEDIUM**: Inventory (get, drop, buy, sell)
4. **MEDIUM**: Equipment (equip, unequip)
5. **MEDIUM**: Monster kills and XP gains
6. **LOW**: Quest system
7. **LOW**: Spell learning
8. **LOW**: Guild/Party systems

## Testing After Updates

For each updated command:
1. Execute the command in-game
2. Check browser console for "[PlayerPersistence]" logs
3. Verify MySQL database updated (for permanent data)
4. Verify Firebase updated (for session data)
5. Logout and login again to verify persistence
