# Ranged Combat System - Implementation Complete

## Version: v=20251021-022

---

## Overview

The MUD game now has a complete **Ranged Combat System** supporting:
- ✅ Ranged weapons (bows, crossbows, slings)
- ✅ Ammunition system (arrows, bolts, stones)
- ✅ Throwing any item at targets
- ✅ Range checking (same room + adjacent rooms)
- ✅ Combat from a distance (no counter-attacks)

---

## New Player Commands

### Shooting with Ranged Weapons

```
shoot [target]                    - Shoot at target in range
shoot goblin                      - Shoots the goblin
shoot guard with crossbow         - Specify weapon if multiple
```

**How it works:**
1. Player must have a ranged weapon (bow, crossbow, sling)
2. Player must have matching ammunition (arrows, bolts, stones)
3. Target must be within weapon's range
4. Each shot consumes 1 ammunition
5. No counter-attack from monsters/players

**Example Session:**
```
> get bow
You take a wooden longbow.

> get arrows
You take a bundle of arrows.

> shoot goblin
You shoot the goblin at close range with your a wooden longbow for 12 damage!
You used 1 a bundle of arrows.
You have defeated the goblin!
```

### Throwing Items

```
throw [item] at [target]          - Throw any item
throw spear at dragon             - Throws your spear
throw dagger at thief             - Throws a dagger
throw beer at guard               - Even throw beer!
```

**How it works:**
1. Item is removed from your inventory
2. Throw damage calculated based on item (DEX-based)
3. Item lands in target's room (can be picked up)
4. Target must be within throwing range (adjacent rooms)
5. Weapons marked `isThrowable` deal more damage

**Example Session:**
```
> throw spear at dragon
You threw a sturdy spear at the dragon for 15 damage!
a sturdy spear lands in Dragon's Lair.

> go north
> get spear
You take a sturdy spear.
```

---

## New Item Types

### Ranged Weapons

**Wooden Longbow**
- Damage: 8
- Ammo: Arrows
- Range: 1 (adjacent rooms)
- Cost: 50 gold

**Heavy Crossbow**
- Damage: 10
- Ammo: Bolts
- Range: 1 (adjacent rooms)
- Cost: 75 gold

**Leather Sling**
- Damage: 4
- Ammo: Stones
- Range: 1 (adjacent rooms)
- Cost: 10 gold

### Ammunition

**Bundle of Arrows** (20 arrows)
- For: Bow
- Cost: 10 gold
- Each shot consumes 1

**Quiver of Crossbow Bolts** (20 bolts)
- For: Crossbow
- Cost: 15 gold
- Each shot consumes 1

**Pouch of Sling Stones** (30 stones)
- For: Sling
- Cost: 5 gold
- Each shot consumes 1

### Throwable Weapons

**Sturdy Spear**
- Melee Damage: 6
- Throw Damage: 8
- Cost: 30 gold
- Versatile: Use in melee OR throw

**Throwing Dagger**
- Melee Damage: 4
- Throw Damage: 5
- Cost: 20 gold
- Balanced for throwing

**Javelin**
- Melee Damage: 5
- Throw Damage: 7
- Cost: 25 gold
- Light throwing spear

---

## Range System

### How Range Works

**Range 0 - Same Room Only**
```
[You] ----> [Target]
```
Can only attack targets in your current room.

**Range 1 - Adjacent Rooms** (Standard for ranged weapons)
```
[You] --exit--> [Target's Room]
```
Can attack targets in your room OR rooms directly connected by exits.

**Range 2 - Two Rooms Away** (Future advanced weapons)
```
[You] --exit--> [Room] --exit--> [Target's Room]
```
Can attack targets up to 2 rooms away through connected exits.

### Finding Targets in Range

The game checks:
1. Your current room
2. All rooms connected by exits (north, south, east, west, up, down, etc.)
3. Rooms connected to those rooms (if range 2)

**Example:**
```
        [Forest]
           |
      [Your Room] --- [Cave]
           |
        [Lake]
```

With range 1, you can shoot targets in: Your Room, Forest, Cave, or Lake

---

## Combat Mechanics

### Ranged Attack vs Melee Attack

| Feature | Melee (attack) | Ranged (shoot) | Throwing |
|---------|---------------|----------------|----------|
| Range | Same room only | Same + adjacent | Same + adjacent |
| Counter-attack | Yes, monsters hit back | No counter-attack | No counter-attack |
| Ammunition | Not required | Required, consumed | Item consumed |
| XP Reward | 100% | 100% | 80% |
| Item Recovery | N/A | N/A | Yes, item lands in room |

### Damage Calculation

**Ranged Weapons:**
- Base damage from weapon (8 for bow, 10 for crossbow, etc.)
- Modified by attributes (STR, DEX, CON)
- Critical hits on natural 20 (double damage)
- Can be dodged by high-DEX targets

**Throwing:**
- Base damage from item's `throwDamage` or `weaponDamage`
- Uses DEX instead of STR for attack bonus
- Critical hits on natural 20
- Non-weapons deal minimal damage (2-3)
- Can be dodged

### Ammunition System

**Consumption:**
- Each shot consumes exactly 1 ammunition
- Ammunition with `quantity > 1` decreases by 1 per shot
- When quantity reaches 0, item removed from inventory
- Game shows: "You used 1 a bundle of arrows"

**Out of Ammo:**
```
> shoot goblin
You need arrow to use your a wooden longbow.
```

**Quantity Tracking:**
- Arrows: Start with 20, can shoot 20 times
- Bolts: Start with 20, can shoot 20 times
- Stones: Start with 30, can shoot 30 times

---

## Admin Panel - Creating Ranged Content

### Creating a Ranged Weapon

1. Open **Admin Panel → Items Tab**
2. Click **New Item**
3. Fill in:
   - **ID**: `magic_bow`
   - **Name**: `a magic bow`
   - **Item Type**: `normal`
   - **Movable**: `true`
   - **Cost**: `100`
   - **Is Weapon**: ✓ (check box)
   - **Weapon Damage**: `12`

4. In the **JSON editor**, add:
```json
{
  "isRanged": true,
  "weaponType": "ranged",
  "ammoType": "arrow",
  "range": 1
}
```

5. Click **Save Item**

### Creating Ammunition

1. Open **Admin Panel → Items Tab**
2. Click **New Item**
3. Fill in:
   - **ID**: `fire_arrows`
   - **Name**: `a bundle of fire arrows`
   - **Item Type**: `ammunition`
   - **Movable**: `true`
   - **Cost**: `50`

4. In the **JSON editor**, add:
```json
{
  "isAmmunition": true,
  "ammoFor": "magic_bow",
  "quantity": 10
}
```

5. Click **Save Item**

### Creating a Throwable Weapon

1. Open **Admin Panel → Items Tab**
2. Click **New Item**
3. Fill in:
   - **ID**: `battle_axe`
   - **Name**: `a battle axe`
   - **Item Type**: `normal`
   - **Is Weapon**: ✓
   - **Weapon Damage**: `10`

4. In the **JSON editor**, add:
```json
{
  "isThrowable": true,
  "throwDamage": 12,
  "weaponType": "melee"
}
```

5. Click **Save Item**

### Creating a Fletcher NPC (Bow Shop)

1. Open **Admin Panel → NPCs Tab**
2. Click **New NPC**
3. Fill in:
   - **ID**: `fletcher`
   - **Name**: `Gareth the Fletcher`
   - **Short Name**: `Gareth`
   - **Description**: `A skilled bowyer and arrow-maker`
   - **Dialogue**: `"I sell the finest bows and arrows!", "Quality craftsmanship!"`
   - **Use AI**: Unchecked
   - **Shop Items**: `bow, crossbow, sling, arrows, bolts, stones, spear, dagger, javelin`

4. Click **Save NPC**

---

## Balance Guidelines

### Weapon Damage Recommendations

**Ranged Weapons:**
- Low tier (Sling): 3-5 damage, 10 gold
- Mid tier (Bow): 6-9 damage, 50 gold
- High tier (Crossbow): 9-12 damage, 75 gold
- Legendary: 13-20 damage, 200+ gold

**Throwing Weapons:**
- Light (Dagger): 4-6 damage, 20 gold
- Medium (Spear): 7-9 damage, 30 gold
- Heavy (Axe): 10-12 damage, 50 gold

### Ammunition Pricing

- Cheap (Stones): 5 gold per 30
- Standard (Arrows): 10 gold per 20
- Quality (Bolts): 15 gold per 20
- Magical: 50+ gold per 10

### Range vs Damage Tradeoff

- **Range 0** (same room): Higher damage OK
- **Range 1** (adjacent): Standard damage
- **Range 2** (two rooms): 20-30% less damage for balance

### Advantages & Disadvantages

**Ranged Weapons - Pros:**
- Attack from safety
- No counter-attacks
- Can kite enemies between rooms
- Strategic positioning

**Ranged Weapons - Cons:**
- Requires ammunition (recurring cost)
- Need inventory space for ammo
- Can still be dodged
- Initial investment (weapon + ammo)

**Throwing - Pros:**
- Any item can be thrown
- No ammunition needed
- Item can be recovered
- Emergency attack option

**Throwing - Cons:**
- Lose the item temporarily
- Less XP than melee (80%)
- Non-weapons do minimal damage
- Must retrieve item after

---

## Technical Details

### Code Changes (v022)

**Files Modified:**
1. `js/game.js` - Added ~600 lines
   - `getRoomsInRange()` - Range calculation function
   - `findTargetInRange()` - Target search within range
   - `case 'shoot'` - Ranged weapon command handler
   - `case 'throw'` - Throwing command handler

2. `data/items.json` - Added 9 new items
   - 3 ranged weapons (bow, crossbow, sling)
   - 3 ammunition types (arrows, bolts, stones)
   - 3 throwable weapons (spear, dagger, javelin)

3. `DUNGEON_MASTERS_GUIDE.md` - Added section
   - Comprehensive ranged combat documentation
   - Item property explanations
   - Balance guidelines
   - Examples and tips

4. `mud.html` - Version bump
   - Updated to v=20251021-022

### New Item Properties

```javascript
// Ranged Weapon
{
  "isRanged": true,              // Marks as ranged weapon
  "weaponDamage": 8,             // Damage per shot
  "ammoType": "arrow",           // Required ammunition type
  "range": 1,                    // 0=same room, 1=adjacent, 2=two rooms
  "weaponType": "ranged"         // Category
}

// Ammunition
{
  "isAmmunition": true,          // Marks as ammo
  "ammoFor": "bow",              // Which weapon ID it's for
  "quantity": 20,                // Number of shots
  "itemType": "ammunition"       // Category
}

// Throwable
{
  "isThrowable": true,           // Can be thrown effectively
  "throwDamage": 8,              // Damage when thrown
  "weaponType": "melee"          // Still usable in melee
}
```

### Algorithm: Range Checking

```javascript
getRoomsInRange(startRoomId, range) {
  if (range === 0) return [startRoomId];
  
  visited = Set([startRoomId]);
  rooms = [startRoomId];
  currentLevel = [startRoomId];
  
  for (depth = 0; depth < range; depth++) {
    nextLevel = [];
    for (roomId in currentLevel) {
      room = gameWorld[roomId];
      for (neighborRoomId in room.exits) {
        if (!visited.has(neighborRoomId)) {
          visited.add(neighborRoomId);
          rooms.push(neighborRoomId);
          nextLevel.push(neighborRoomId);
        }
      }
    }
    currentLevel = nextLevel;
  }
  
  return rooms;
}
```

This breadth-first search finds all rooms within X exits of the starting room.

---

## Testing Checklist

### Basic Functionality
- ✅ Shoot command works in same room
- ✅ Shoot command works in adjacent room
- ✅ Ammunition is consumed per shot
- ✅ Out of ammo error message
- ✅ Throw command works in same room
- ✅ Throw command works in adjacent room
- ✅ Thrown items land in target room
- ✅ Thrown items can be picked up
- ✅ Out of range error messages

### Combat Testing
- ✅ Ranged damage calculation
- ✅ No counter-attacks from monsters
- ✅ No counter-attacks from players
- ✅ Critical hits work
- ✅ Dodge mechanic works
- ✅ XP and gold rewards
- ✅ Quest progress tracking
- ✅ Guild XP bonus applies

### Edge Cases
- ✅ Shooting without weapon
- ✅ Shooting without ammo
- ✅ Shooting out of range target
- ✅ Throwing non-existent item
- ✅ Throwing at out of range target
- ✅ Multiple ranged weapons in inventory
- ✅ Quantity tracking for ammo stacks

### Admin Panel
- ✅ Create ranged weapon
- ✅ Create ammunition
- ✅ Create throwable weapon
- ✅ Add items to NPC shops
- ✅ Place items in rooms

---

## Known Limitations & Future Enhancements

### Current Limitations
- Monsters don't use ranged weapons (yet)
- NPCs don't use ranged weapons (yet)
- No special ammunition (fire arrows, poison bolts, etc.)
- Maximum range is 2 rooms
- Can't aim at specific body parts
- No accuracy/miss chance beyond dodge

### Planned Enhancements
- [ ] Archer/Ranger enemy types
- [ ] Special ammunition effects
- [ ] Magical bows with stat bonuses
- [ ] Auto-targeting closest enemy
- [ ] Range-based accuracy penalties
- [ ] Cover system (hide behind objects)
- [ ] Ammunition crafting system
- [ ] Quiver equipment slot

---

## Common Issues & Solutions

### "You need arrow to use your bow"
**Problem**: Missing ammunition
**Solution**: Get the correct ammunition type:
```
> get arrows
> shoot target
```

### "You don't see X within range"
**Problem**: Target is too far away
**Solution**: Move closer or use higher range weapon:
```
> go north
> shoot target
```

### "You don't have a ranged weapon equipped"
**Problem**: No ranged weapon in inventory
**Solution**: Get a ranged weapon:
```
> get bow
> get arrows
> shoot target
```

### Throw command doesn't work
**Problem**: Incorrect syntax
**Solution**: Use "throw [item] at [target]":
```
> throw spear at goblin
```

### Item thrown but not found in target room
**Problem**: Item went to target's room, not your room
**Solution**: Go to target's room:
```
> go north
> get spear
```

---

## Deployment

**Version**: v=20251021-022
**Commit**: `799f52c`
**Branch**: `main`
**Status**: ✅ Pushed to GitHub

**Files to Upload:**
- `mud.html` (updated version)
- `js/game.js` (ranged combat code)
- `data/items.json` (new weapons and ammo)

**Documentation Updated:**
- `DUNGEON_MASTERS_GUIDE.md` (new section added)
- `RANGED_COMBAT_GUIDE.md` (this file)

---

## Summary

The ranged combat system is **fully implemented and tested**! Players can now:
- Shoot enemies from a distance with bows, crossbows, and slings
- Throw any item at targets in adjacent rooms
- Use strategic positioning to avoid counter-attacks
- Manage ammunition as a resource

This adds a new tactical dimension to combat, allowing for different playstyles and strategies. Have fun sniping goblins from the next room! 🏹

---

*For more details, see the Ranged Weapons & Throwing section in DUNGEON_MASTERS_GUIDE.md*
