# Locked Doors & Keys System - Implementation Summary

## ✅ What's Been Implemented

### 1. **Locked Exit System**
- Rooms can have `lockedExits` object that blocks movement
- Each locked exit requires a specific key to unlock
- Exits can be unlocked and re-locked (if `relockable: true`)
- Once unlocked, exits stay unlocked until manually re-locked
- Non-relockable exits stay permanently open once unlocked
- Other players still need their own key

### 2. **Key Items**
- Special item type: `itemType: "key"`
- Keys can be consumed on use (default) or reusable
- Keys unlock specific directions (north, south, east, west, up, down, etc.)
- Supports named locks (door, gate, trapdoor, etc.)

### 3. **Player Commands**
- `use [key-name]` - Uses a key to unlock matching door
- `unlock [direction]` - Unlocks specific direction with appropriate key
- `unlock [name]` - Unlocks by lock name (e.g., "unlock gate")
- `lock [direction]` - Re-locks specific direction (requires key and relockable: true)
- `lock [name]` - Re-locks by lock name (e.g., "lock door")
- Movement commands now check for locked exits and show helpful messages

### 4. **AI Integration**
- Natural language parsing supports unlock commands
- Gemini AI recognizes "unlock the door", "open the gate", etc.
- Automatically extracts direction or object being unlocked

## 📁 Files Modified

1. **js/game.js**
   - Added locked exit checking in `case 'go'` (line ~3013)
   - Updated `case 'key'` in `handleSpecialItem()` (line ~2600)
   - Added new `case 'unlock'` command handler (line ~4147)
   - Added new `case 'lock'` command handler (line ~4220)

2. **js/ai.js**
   - Added "unlock" and "lock" to valid action list
   - Added unlock/lock examples to parsing prompt

## 📋 JSON Schema

### Room with Locked Exits
```json
{
  "id": "room-id",
  "exits": { "north": "destination-room" },
  "lockedExits": {
    "north": {
      "keyId": "key-item-id",
      "name": "descriptive name",
      "lockedMessage": "Message when locked",
      "unlockMessage": "Message when unlocked",
      "lockMessage": "Message when re-locked",
      "relockable": true
    }
  }
}
```

### Key Item
```json
{
  "id": "key-id",
  "itemType": "key",
  "specialData": {
    "unlocks": "direction",
    "consumeOnUse": false
  }
}
```

### Player Data (Automatic)
```json
{
  "unlockedExits": [
    "room1:north",
    "room2:east"
  ]
}
```

## 🎮 How It Works

### When Player Tries to Move:
1. Check if direction exists in `exits`
2. Check if direction exists in `lockedExits`
3. Check if player has unlocked this exit before (in `unlockedExits` array)
4. If locked and not unlocked → Block movement, show locked message
5. If unlocked or not locked → Allow movement

### When Player Uses Key to Unlock:
1. Get current room and check for `lockedExits`
2. Find which exit this key unlocks (by direction or keyId match)
3. Check if already unlocked
4. Add `roomId:direction` to player's `unlockedExits` array
5. Show unlock message
6. Optionally consume key (based on `consumeOnUse`)

### When Player Locks a Door:
1. Get current room and check for `lockedExits`
2. Find which exit to lock
3. Check if it's currently unlocked
4. Check if `relockable` is true (default: true)
5. Verify player has the correct key
6. Remove `roomId:direction` from player's `unlockedExits` array
7. Show lock message

## 🎯 Design Philosophy

The system is **generic and flexible**:

- **Not just for doors**: Use for gates, barriers, seals, mechanisms, etc.
- **Named locks**: Refer to locks by name ("unlock gate") not just direction
- **Permanent unlocking**: Once unlocked, stays unlocked (realistic)
- **Multiple locks per room**: Each exit can be independently locked
- **Reusable keys**: Master keys, skeleton keys don't disappear
- **Creative freedom**: Use any item name/description for "keys"

## 💡 Creative Uses

1. **Puzzle Keys**: Crystal orbs, magical seals, ancient artifacts
2. **Quest Items**: Elder tokens, royal seals, proof of deeds
3. **Hidden Mechanisms**: Levers disguised as books, loose bricks
4. **Multi-part Keys**: Fragments that must be assembled
5. **One-way Secrets**: Lock entry but not exit (relockable: false)
6. **Temporary Access**: Keys that crumble after use
7. **Security Rooms**: Lock doors behind you for safety (relockable: true)
8. **Puzzle Sequences**: Doors must be locked/unlocked in specific order
9. **Tactical Gameplay**: Lock doors to prevent monster/player pursuit

## 📚 Documentation Created

1. **LOCKED_DOORS_GUIDE.md** - Complete usage guide with examples
2. **data/locked-rooms-example.json** - Example rooms with locked exits
3. **data/keys-example.json** - Example key items

## 🚀 Next Steps

1. Import example templates to test the system
2. Create your own locked areas
3. Hide keys in creative locations using:
   - Room items
   - Room details (examine to find)
   - NPC triggers (talk to NPC to get key)
   - Monster drops
   - Quest rewards

## Example Workflow

```bash
# Create a room with locked exit
{
  "id": "treasure-vault-entrance",
  "exits": { "in": "treasure-vault", "out": "hallway" },
  "lockedExits": {
    "in": { "keyId": "vault-key", "lockedMessage": "Locked!", "unlockMessage": "Unlocked!" }
  }
}

# Create the key
{
  "id": "vault-key",
  "name": "Vault Key",
  "itemType": "key",
  "specialData": { "unlocks": "in" }
}

# Hide the key somewhere creative
{
  "id": "guard-room",
  "npcs": ["guard"],
  "details": {
    "desk": "Searching the desk, you find a small key!"
  },
  "items": ["vault-key"]
}
```

Player experience:
1. `examine desk` → Finds hint about key
2. `get vault-key` → Takes the key
3. Goes to treasure-vault-entrance
4. `go in` → "Locked!" message
5. `use vault-key` → Unlocks the door
6. `go in` → Success!

## 🎨 Generic Nature

This system can be used for:
- **Physical locks**: Doors, gates, chests (future)
- **Magical barriers**: Seals, wards, force fields
- **Mechanisms**: Levers, switches, puzzles
- **Social barriers**: Tokens of permission, badges
- **Quest gates**: Proof items, achievement unlocks

Anything that blocks progress and requires an item to bypass!
