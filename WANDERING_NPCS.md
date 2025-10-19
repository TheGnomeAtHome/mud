# Wandering NPC System

## Overview
The Wandering NPC System allows NPCs to autonomously move between connected rooms at random intervals, creating a more dynamic and immersive game world. NPCs can wander freely through the world, bringing life to different areas and creating unexpected encounters for players.

## Features

### Autonomous Movement
- NPCs move automatically between connected rooms
- Movement follows valid exits defined in room data
- Random interval timing for natural, unpredictable behavior
- System broadcasts movement messages to players

### Configurable Behavior
- **Enable/Disable per NPC** - Toggle wandering on individual NPCs
- **Custom Intervals** - Set minimum and maximum time between movements
- **Persistent State** - NPC locations tracked across sessions
- **Smart Pathing** - Only moves through valid room exits

### Player Notifications
- **Departure Messages:** "Bob leaves north."
- **Arrival Messages:** "Bob arrives."
- **Automatic Room Refresh:** Players see updated NPC lists

## Configuration

### Admin Panel Setup

1. **Open Admin Panel → NPCs Tab**
2. **Select or Create an NPC**
3. **Enable Wandering:**
   - Check "Wanders Between Rooms?"
   - Set Min Interval (seconds): Default 60
   - Set Max Interval (seconds): Default 180
4. **Save NPC**

### Recommended Settings

| NPC Type | Min Interval | Max Interval | Purpose |
|----------|--------------|--------------|---------|
| Merchant | 120 | 300 | Slow, predictable |
| Guard | 90 | 180 | Regular patrol |
| Traveler | 60 | 120 | Frequent movement |
| Wanderer | 30 | 90 | Very mobile |
| Hermit | 180 | 600 | Rarely moves |

### Data Structure

```javascript
{
  "shortName": "Bob",
  "name": "a traveling merchant",
  "description": "A friendly merchant with a pack full of goods.",
  "wanders": true,
  "wanderInterval": {
    "min": 60,   // Minimum seconds between moves
    "max": 180   // Maximum seconds between moves
  }
}
```

## Technical Implementation

### Core Functions

#### `initializeWanderingNpcs()`
- Scans all NPCs in `gameNpcs` for `wanders: true`
- Determines starting room from world data
- Initializes timers for each wandering NPC
- Called automatically on game initialization (2-second delay)

#### `startNpcWandering(npcId, npc)`
- Sets up random interval timer for specific NPC
- Schedules next move based on min/max interval
- Continuously reschedules after each move

#### `moveNpcToRandomRoom(npcId, npc)`
- Gets current room and available exits
- Chooses random valid direction
- Updates Firebase room data (removes from old, adds to new)
- Broadcasts movement messages
- Updates local state tracking

#### `stopNpcWandering(npcId)`
- Clears movement timer for specific NPC
- Used when disabling wandering or removing NPC

#### `broadcastNpcMovement(npcId, npc, fromRoomId, toRoomId, direction)`
- Sends system messages to both rooms
- "NPC leaves [direction]" to departure room
- "NPC arrives" to arrival room
- Refreshes player view if they're in affected rooms

### State Tracking

```javascript
let npcWanderTimers = {};    // Track active timers by NPC ID
let npcCurrentRooms = {};    // Track current room for each wandering NPC
```

### Firebase Integration

**Rooms Updated:**
- Old room: NPC removed from `npcs` array
- New room: NPC added to `npcs` array

**Messages Created:**
```javascript
{
  roomId: "room-id",
  userId: "system",
  username: "System",
  text: "Bob leaves north.",
  timestamp: serverTimestamp(),
  isSystem: true
}
```

## Usage Examples

### Example 1: Wandering Merchant
```javascript
{
  "shortName": "Merrick",
  "name": "a wandering merchant",
  "wanders": true,
  "wanderInterval": {
    "min": 120,
    "max": 300
  },
  "sells": ["potion", "bread", "sword"]
}
```

**Behavior:** Moves every 2-5 minutes, selling items in different locations

### Example 2: Patrolling Guard
```javascript
{
  "shortName": "Captain Harris",
  "name": "a town guard",
  "wanders": true,
  "wanderInterval": {
    "min": 90,
    "max": 180
  },
  "canFight": true,
  "hostile": false
}
```

**Behavior:** Patrols between rooms every 1.5-3 minutes, can defend if attacked

### Example 3: Mysterious Traveler
```javascript
{
  "shortName": "Eldrin",
  "name": "a mysterious traveler",
  "wanders": true,
  "wanderInterval": {
    "min": 60,
    "max": 120
  },
  "useAI": true,
  "dialogue": "You are a mysterious wanderer who shares cryptic hints about the world..."
}
```

**Behavior:** Moves frequently (1-2 minutes), provides AI-powered hints

## Player Experience

### What Players See

**When NPC Leaves:**
```
Bob the merchant leaves west.
```

**When NPC Arrives:**
```
Bob the merchant arrives.
```

**In Room Description:**
```
The Town Square
A bustling area with a fountain in the center.

NPCs here:
- Bob the merchant
- Guard
```

### Interacting with Wandering NPCs

Players can interact normally with wandering NPCs:
- **Talk:** `talk to Bob`
- **Buy:** `buy potion from Bob`
- **Attack:** `attack Bob` (if NPC can fight)
- **Examine:** `examine Bob`

If an NPC wanders away mid-conversation:
- Conversation context is lost
- Player must find the NPC in the new location
- Creates urgency and realism

## Advanced Features

### Combination with Other Systems

#### Wandering + AI Conversations
```javascript
{
  "wanders": true,
  "useAI": true,
  "dialogue": "You are a friendly bard who wanders between taverns..."
}
```

**Result:** NPC moves between rooms AND chats with other NPCs in each location

#### Wandering + Combat
```javascript
{
  "wanders": true,
  "canFight": true,
  "hostile": true,
  "name": "a roaming bandit"
}
```

**Result:** Dangerous NPC that appears unexpectedly in different locations

#### Wandering + Shopkeeper
```javascript
{
  "wanders": true,
  "sells": ["rare-gem", "magic-scroll"]
}
```

**Result:** Mobile shop that players must track down

### Performance Considerations

**Timers:**
- Each wandering NPC uses one setTimeout
- Automatically rescheduled after each move
- Cleaned up when NPC is deleted

**Firebase Writes:**
- 2 room updates per move (remove + add)
- 2 message documents per move (leave + arrive)
- Estimated: ~4 writes per NPC movement

**Recommended Limits:**
- Maximum 10-20 wandering NPCs for optimal performance
- Minimum 30-second intervals to avoid excessive Firebase writes
- Longer intervals (60-300s) recommended for most use cases

## Troubleshooting

### NPC Not Moving

**Check:**
1. Is `wanders: true` set in Firebase?
2. Does the current room have valid exits?
3. Is the NPC in the `gameNpcs` collection?
4. Check browser console for errors

**Console Commands:**
```javascript
// Check if NPC is wandering
console.log(npcWanderTimers);

// Check NPC current room
console.log(npcCurrentRooms);

// Manually trigger initialization
gameLogic.initializeWanderingNpcs();
```

### NPC Stuck in Invalid Room

**Solution:**
1. Edit the NPC in admin panel
2. Remove from current room's `npcs` array
3. Add to correct room's `npcs` array
4. Save changes

### Too Many Firebase Writes

**Solutions:**
- Increase min/max intervals
- Reduce number of wandering NPCs
- Disable wandering during peak hours

### NPC Disappears

**Check:**
- Room data integrity (ensure exits point to valid rooms)
- Firebase console for recent updates
- NPC current location: `gameLogic.getNpcCurrentRoom('npc-id')`

## Best Practices

### Design Tips

1. **Purpose-Driven Wandering**
   - Merchants: Slow movement between shops/markets
   - Guards: Regular patrol patterns
   - Travelers: Frequent, unpredictable movement

2. **Balanced Timing**
   - Too fast: Confusing for players, excessive Firebase usage
   - Too slow: Feels static, defeats purpose
   - Sweet spot: 60-180 seconds for most NPCs

3. **Strategic Placement**
   - Start wandering NPCs in central locations
   - Ensure they can't get trapped in dead-end rooms
   - Create "patrol routes" with circular exit patterns

4. **Narrative Integration**
   - Use wandering to tell stories (patrol guards, traveling merchants)
   - Create mystery (mysterious figure appears randomly)
   - Add urgency (time-limited quest NPCs)

### World Design for Wandering NPCs

**Good Room Layout:**
```
[Town Square] ←→ [Market] ←→ [Tavern]
      ↕                          ↕
   [Temple]                  [Inn]
```
NPCs can move freely in loops

**Bad Room Layout:**
```
[Start] → [Dead End]
```
NPC gets trapped

## Future Enhancements (Potential)

### Advanced Pathing
- Weighted exits (prefer certain directions)
- Patrol routes (predefined paths)
- Home room (return to base periodically)
- Avoid certain rooms

### Conditional Wandering
- Time-based (wander only during day/night)
- Player-count-based (reduce wandering when busy)
- Event-triggered (stop during special events)

### Enhanced Notifications
- Compass-style tracking ("You hear footsteps to the north")
- Encounter chances when paths cross
- "Last seen" information

### AI Integration
- NPCs remember where they've been
- Mention their travels in dialogue
- React to rooms they enter

## Summary

The Wandering NPC System brings dynamic life to the MUD world:

✅ **Easy Configuration** - Simple admin panel checkbox
✅ **Autonomous Behavior** - NPCs move without manual intervention  
✅ **Player Immersion** - Unexpected encounters, living world
✅ **Flexible** - Works with AI, combat, shops, and dialogue
✅ **Firebase Integrated** - Real-time updates across all players
✅ **Performance Optimized** - Minimal resource usage

Perfect for creating traveling merchants, patrolling guards, mysterious wanderers, and dynamic NPC populations!
