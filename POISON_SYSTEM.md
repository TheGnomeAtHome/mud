# Poison & Damage Effects System

## Overview
The poison system allows consumable items to apply damage-over-time effects or instant damage to players who consume them.

## Features
- ✅ Poison damage over time
- ✅ Instant damage items
- ✅ Configurable duration and damage
- ✅ Status display in score
- ✅ Death from poison
- ✅ Automatic cleanup when expired

## How to Create Poisoned Items

### 1. Poisoned Cake (Damage Over Time)

**Item Editor Configuration:**
- **Item ID**: `poisoned_cake`
- **Name**: `a delicious chocolate cake`
- **Description**: `A rich, tempting chocolate cake with dark frosting. It looks absolutely delicious.`
- **Is Consumable**: ✅ Checked
- **HP Restored**: `0` (or `5` to make it tempting at first)
- **Effect**: `The cake tastes amazing! Wait... you feel strange...`
- **Special Data**:
```json
{"onUseEffect": "poison", "effectPower": 5, "buffDuration": 60, "damagePerTick": 3, "tickInterval": 10}
```

**What this does:**
- Applies poison for 60 seconds
- Deals 3 damage every 10 seconds
- Player sees "💀 You've been poisoned!" message
- Poison ticks automatically every 10 seconds
- Shows poison status in `score` command

### 2. Instant Damage Item (e.g., Toxic Mushroom)

**Special Data:**
```json
{"onUseEffect": "damage", "effectPower": 25}
```

**What this does:**
- Deals 25 damage immediately
- No ongoing effect

### 3. Negative HP Restore (Simple Damage)

**Item Editor Configuration:**
- **HP Restored**: `-15` (deals 15 damage immediately)
- **Effect**: `The food was spoiled! You feel sick.`
- **Special Data**: `{}` (leave empty)

## Special Data Properties

### Poison Effect
```json
{
  "onUseEffect": "poison",
  "effectPower": 5,        // Damage per tick (optional, default: 5)
  "buffDuration": 60,      // Total duration in seconds (optional, default: 60)
  "damagePerTick": 3,      // Damage each tick (optional, uses effectPower if not set)
  "tickInterval": 10       // Seconds between ticks (optional, default: 10)
}
```

### Instant Damage
```json
{
  "onUseEffect": "damage",
  "effectPower": 30        // Immediate damage amount
}
```

## Examples

### Lethal Poison (High Damage)
```json
{"onUseEffect": "poison", "effectPower": 10, "buffDuration": 120, "damagePerTick": 10, "tickInterval": 5}
```
- 10 damage every 5 seconds for 2 minutes (total: ~240 damage)

### Mild Poison (Annoying but survivable)
```json
{"onUseEffect": "poison", "effectPower": 2, "buffDuration": 30, "damagePerTick": 2, "tickInterval": 10}
```
- 2 damage every 10 seconds for 30 seconds (total: 6 damage)

### One-Shot Poison Dart
```json
{"onUseEffect": "damage", "effectPower": 50}
```
- 50 instant damage

## Player Experience

### Consuming Poison:
```
> eat cake
You eat a delicious chocolate cake. The cake tastes amazing! Wait... you feel strange... 💀 You've been poisoned!
```

### Poison Tick:
```
💀 The poison courses through your veins! You take 3 damage.
HP: 47/100
```

### Checking Status:
```
> score
--- Player Status ---
Name: PlayerName
Race: Human | Class: Warrior
Level: 5 - Seasoned Fighter
HP: 47 / 100
MP: 100 / 100
💀 Status: POISONED (42s remaining, 3 damage per tick)
...
```

### Poison Expires:
```
The poison has worn off.
```

### Death from Poison:
```
💀 The poison courses through your veins! You take 3 damage.
HP: 0/100
💀 You have died from poison!
```

## Technical Details

### How It Works
1. Player consumes item with poison special data
2. `poisonedUntil`, `poisonDamage`, `poisonInterval`, and `lastPoisonTick` fields are added to player document
3. Poison tick system runs every 5 seconds (checks all players)
4. When interval time passes, damage is applied and `lastPoisonTick` is updated
5. When `poisonedUntil` expires, poison fields are cleared

### Database Fields
```javascript
{
  poisonedUntil: 1730000000000,  // Timestamp when poison expires
  poisonDamage: 3,                // Damage per tick
  poisonInterval: 10,             // Seconds between ticks
  lastPoisonTick: 1729999990000   // Last time damage was applied
}
```

### System Components
- **Consume Handler**: Applies poison status when item is eaten (`game.js` line ~5420)
- **Poison Tick System**: Processes damage over time (`game.js` line ~982)
- **Score Display**: Shows poison status (`game.js` line ~7600)
- **Auto-cleanup**: Removes expired poison effects

## Quest/Puzzle Ideas

1. **Poisoned Feast**: NPC offers cake that secretly poisons players who fail to detect trap
2. **Antidote Quest**: Find antidote item before poison timer runs out
3. **Poison Resistance**: Class or equipment that reduces/prevents poison
4. **Russian Roulette**: Multiple cakes, only one is poisoned
5. **Sacrifice Puzzle**: Someone must eat poison cake to unlock door

## Future Enhancements (Not Yet Implemented)
- Cure poison spell/potion
- Poison resistance stat
- Different poison types (paralysis, weakness, etc.)
- Poison resistance equipment
- Poison immunity classes
