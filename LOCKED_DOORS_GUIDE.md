# Locked Doors & Keys System

## Overview
The locked door system allows you to create exits that require keys or other conditions to unlock. Once unlocked, exits remain unlocked for that player permanently.

## Room Configuration

### Basic Locked Exit
```json
{
  "id": "castle-entrance",
  "name": "Castle Entrance",
  "description": "A massive iron gate blocks the way north. The gate is sealed with a heavy lock.",
  "exits": {
    "south": "courtyard",
    "north": "throne-room"
  },
  "lockedExits": {
    "north": {
      "keyId": "iron-key",
      "lockedMessage": "The iron gate is locked. You need a key.",
      "unlockMessage": "The iron key fits perfectly! The gate swings open with a loud creak.",
      "lockMessage": "You lock the gate behind you. It clicks shut securely.",
      "relockable": true
    }
  }
}
```

### Non-Relockable Exit (One-Way Unlock)
```json
{
  "id": "secret-vault",
  "exits": {
    "out": "hallway",
    "in": "treasure-room"
  },
  "lockedExits": {
    "in": {
      "keyId": "vault-seal",
      "lockedMessage": "A magical seal prevents entry.",
      "unlockMessage": "The seal shatters! The way is now permanently open.",
      "relockable": false
    }
  }
}
```

### Multiple Locked Exits
```json
{
  "id": "junction",
  "name": "Crossroads Junction",
  "description": "Four paths meet here. Doors to the east and west are locked.",
  "exits": {
    "north": "plaza",
    "south": "market",
    "east": "vault",
    "west": "armory"
  },
  "lockedExits": {
    "east": {
      "keyId": "vault-key",
      "name": "vault door",
      "lockedMessage": "The vault door is sealed with an intricate lock mechanism.",
      "unlockMessage": "The vault key clicks into place. The door unseals with a hiss."
    },
    "west": {
      "keyId": "armory-key",
      "name": "armory gate",
      "lockedMessage": "The armory gate is locked with a heavy padlock.",
      "unlockMessage": "You unlock the armory gate. It swings open smoothly."
    }
  }
}
```

### Advanced: Named Locks
The `name` field helps players identify what they're unlocking:
```json
"lockedExits": {
  "up": {
    "keyId": "tower-key",
    "name": "trapdoor",
    "lockedMessage": "A heavy wooden trapdoor above you is locked tight.",
    "unlockMessage": "You unlock the trapdoor. It creaks open, revealing stairs above."
  }
}
```

Now players can type: `unlock trapdoor` or `unlock up`

## Key Item Configuration

### Basic Key (Consumed on Use)
```json
{
  "id": "iron-key",
  "name": "Iron Key",
  "description": "A heavy iron key with rust along its edges. It looks ancient but sturdy.",
  "itemType": "key",
  "value": 50,
  "specialData": {
    "unlocks": "north"
  }
}
```

### Reusable Key (Not Consumed)
```json
{
  "id": "master-key",
  "name": "Master Key",
  "description": "An ornate golden key that never seems to wear out. It bears the royal seal.",
  "itemType": "key",
  "value": 500,
  "specialData": {
    "unlocks": "north",
    "consumeOnUse": false
  }
}
```

### Universal Key (Can unlock any direction)
Create different instances for different rooms, but you can make keys that work on multiple locks:
```json
{
  "id": "skeleton-key",
  "name": "Skeleton Key",
  "description": "A mysterious key that seems to shift and change shape. It might fit many locks.",
  "itemType": "key",
  "value": 1000,
  "specialData": {
    "unlocks": "east",
    "consumeOnUse": false
  }
}
```

## Player Commands

### Using Keys
- `use iron-key` - Automatically unlocks the matching door
- `unlock north` - Attempts to unlock north exit with appropriate key
- `unlock door` - Unlocks by name (if lock has a "name" field)
- `unlock gate` - Same as above
- `lock north` - Re-locks the north exit (requires key and `relockable: true`)
- `lock door` - Re-locks by name
- `lock gate behind me` - Natural language supported

### Movement
- `go north` - If locked, shows locked message and hints about required key
- `north` - Shortcut, same as above

## How It Works

1. **Player tries to move through locked exit**
   - System checks if exit is in `lockedExits`
   - Checks if player has unlocked it before (in `unlockedExits` array)
   - If locked, blocks movement and shows message

2. **Player uses a key to unlock**
   - System finds matching locked exit
   - Adds `roomId:direction` to player's `unlockedExits` array
   - Shows unlock message
   - Optionally consumes the key (default)

3. **Player can re-lock if allowed**
   - Player uses `lock [direction]` command
   - System checks if lock has `relockable: true` (default)
   - Removes `roomId:direction` from player's `unlockedExits` array
   - Exit becomes locked again

4. **Exit stays unlocked (or locked)**
   - Once unlocked, exit remains open for that player
   - Player can re-lock it if `relockable: true`
   - Other players still need their own key

## Creative Uses

### Security Doors (Lock Behind You)
```json
{
  "lockedExits": {
    "west": {
      "keyId": "safe-room-key",
      "name": "reinforced door",
      "lockedMessage": "The reinforced door is locked for your safety.",
      "unlockMessage": "You unlock the door and it swings open.",
      "lockMessage": "You lock the door behind you. You feel safer now.",
      "relockable": true
    }
  }
}
```

Players can lock themselves in safe rooms!

### Puzzle Sequences
```json
{
  "id": "puzzle-chamber",
  "lockedExits": {
    "north": { "keyId": "lever-a", "relockable": true },
    "south": { "keyId": "lever-b", "relockable": true },
    "east": { "keyId": "lever-c", "relockable": true }
  }
}
```

Create puzzles where doors must be locked/unlocked in the right order!

### One-Way Breakthroughs
```json
{
  "lockedExits": {
    "through": {
      "keyId": "battering-ram",
      "lockedMessage": "A wooden barricade blocks the way.",
      "unlockMessage": "You smash through the barricade! It splinters into pieces.",
      "relockable": false
    }
  }
}
```

Some barriers can't be restored once broken.
```json
{
  "lockedExits": {
    "down": {
      "keyId": "crystal-orb",
      "name": "magical seal",
      "lockedMessage": "An ethereal barrier blocks the stairs. Ancient runes glow faintly.",
      "unlockMessage": "The crystal orb pulses with light! The magical barrier dissipates."
    }
  }
}
```

### Quest Gates
```json
{
  "lockedExits": {
    "west": {
      "keyId": "elder-token",
      "name": "elder gate",
      "lockedMessage": "The Elder Gate requires proof of worth to open.",
      "unlockMessage": "The elders recognize your token. The gate opens to honor your deed."
    }
  }
}
```

### One-Way Secrets
Lock an exit going one way but not the other:
```json
{
  "id": "secret-room",
  "exits": {
    "out": "library"
  }
}

{
  "id": "library",
  "exits": {
    "in": "secret-room"
  },
  "lockedExits": {
    "in": {
      "keyId": "hidden-mechanism",
      "lockedMessage": "The bookshelf looks solid. Perhaps examining it would reveal more?",
      "unlockMessage": "You pull the hidden lever. The bookshelf swings inward!"
    }
  }
}
```

## Tips

1. **Always include helpful messages** - Guide players on what they need
2. **Use the `name` field** - Makes commands more intuitive ("unlock gate" vs "unlock north")
3. **Hide keys creatively** - Use room `details`, NPC triggers, or monster drops
4. **Consider consumable vs reusable** - Important keys should probably not be consumed
5. **Test both directions** - If you can go north to south, make sure south to north works too

## Database Fields

### Room Schema
- `lockedExits` (object) - Maps directions to lock configurations
  - `keyId` (string) - ID of the key item required
  - `name` (string, optional) - Named identifier for the lock
  - `lockedMessage` (string) - Shown when player tries locked door
  - `unlockMessage` (string) - Shown when successfully unlocked
  - `lockMessage` (string, optional) - Shown when re-locked
  - `relockable` (boolean, optional) - Whether door can be re-locked (default: true)

### Player Schema (automatic)
- `unlockedExits` (array) - List of "roomId:direction" strings for unlocked exits

### Item Schema (for keys)
- `itemType` (string) - Must be "key"
- `specialData.unlocks` (string) - Direction this key unlocks
- `specialData.consumeOnUse` (boolean) - Whether key disappears after use (default: true)

## Example: Complete Dungeon

```json
{
  "rooms": [
    {
      "id": "dungeon-entrance",
      "name": "Dungeon Entrance",
      "description": "A dark corridor stretches north. A heavy wooden door blocks the way.",
      "exits": { "south": "castle", "north": "dungeon-1" },
      "lockedExits": {
        "north": {
          "keyId": "rusty-key",
          "name": "wooden door",
          "lockedMessage": "The wooden door is locked with an old rusty lock.",
          "unlockMessage": "The rusty key turns with a grinding sound. The door opens."
        }
      }
    },
    {
      "id": "dungeon-1",
      "name": "Dark Cell",
      "description": "A damp cell. A skeleton lies in the corner.",
      "exits": { "south": "dungeon-entrance", "east": "dungeon-treasure" },
      "details": {
        "skeleton": "Examining the skeleton, you find a small silver key clutched in its bony hand."
      },
      "items": ["silver-key"],
      "lockedExits": {
        "east": {
          "keyId": "silver-key",
          "name": "iron bars",
          "lockedMessage": "Iron bars block the way. You need a key.",
          "unlockMessage": "The silver key opens the iron bars. You're free!"
        }
      }
    },
    {
      "id": "dungeon-treasure",
      "name": "Treasure Room",
      "description": "Gold and jewels glitter in the torchlight!",
      "exits": { "west": "dungeon-1" },
      "items": ["golden-crown", "treasure-chest"]
    }
  ],
  "items": [
    {
      "id": "rusty-key",
      "name": "Rusty Key",
      "description": "An old, corroded key. It might still work.",
      "itemType": "key",
      "value": 10,
      "specialData": { "unlocks": "north" }
    },
    {
      "id": "silver-key",
      "name": "Silver Key",
      "description": "A small silver key, surprisingly well-preserved.",
      "itemType": "key",
      "value": 50,
      "specialData": { "unlocks": "east" }
    }
  ]
}
```
