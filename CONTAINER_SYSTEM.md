# Container System & Carrying Capacity Guide

## Overview
The MUD now features a comprehensive inventory management system with:
- **Weight System**: Every item has weight in pounds
- **Carrying Capacity**: Based on Strength stat (base 50 + Strength × 5)
- **Containers**: Backpacks, bags, pouches that organize and store items
- **Weight Limits**: Prevents over-encumbrance

## Weight & Carrying Capacity

### How It Works
```javascript
Base Capacity = 50 lbs
Strength Bonus = Strength × 5 lbs
Container Bonus = Sum of equipped container bonuses
Total Capacity = Base + Strength Bonus + Container Bonus
```

### Example
- Player with Strength 12
- Wearing Leather Backpack (capacityBonus: 20)
- **Total Capacity**: 50 + (12 × 5) + 20 = **130 lbs**

### Weight Checking
- Automatic check when picking up items (`get` command)
- Shows current weight when at capacity
- Warning messages at 75% and 90% capacity
- Display in `inventory` command

## Container Items

### Container Properties
```json
{
  "id": "leather_backpack",
  "name": "Leather Backpack",
  "itemType": "container",
  "weight": 3,
  "specialData": {
    "capacity": 50,
    "capacityBonus": 20,
    "description": "..."
  }
}
```

**Key Properties:**
- `weight`: How much the container itself weighs
- `specialData.capacity`: Max weight it can hold (lbs)
- `specialData.capacityBonus`: Carrying capacity increase when equipped
- `contents`: Runtime array of items stored inside (auto-initialized)

### Container Types & Examples

#### Small Containers
```json
{
  "id": "small_pouch",
  "name": "Small Pouch",
  "weight": 0.5,
  "specialData": {
    "capacity": 10
  }
}
```
Use for: Coins, keys, small components

#### Medium Containers
```json
{
  "id": "leather_backpack",
  "name": "Leather Backpack",
  "weight": 3,
  "specialData": {
    "capacity": 50,
    "capacityBonus": 20
  }
}
```
Use for: General adventuring gear

#### Large Containers
```json
{
  "id": "military_duffel",
  "name": "Military Duffel Bag",
  "weight": 5,
  "specialData": {
    "capacity": 100,
    "capacityBonus": 50
  }
}
```
Use for: Heavy equipment, treasure hauls

## Player Commands

### Opening Containers
```
> use backpack
> open backpack

You open Leather Backpack.
It contains:
- Iron Sword (x1) [5 lbs]
- Health Potion (x2) [1 lbs]
Capacity: 6.0/50 lbs
Use 'put [item] in Leather Backpack' to store items.
Use 'take [item] from Leather Backpack' to retrieve items.
```

### Storing Items
```
> put sword in backpack

You put an Iron Sword in a Leather Backpack.
```

**Validation:**
- Item must be in main inventory
- Container must exist in inventory
- Container must have capacity
- Can't put container inside itself

### Retrieving Items
```
> take sword from backpack

You take an Iron Sword from a Leather Backpack.
```

**Validation:**
- Container must exist
- Item must be in container
- Player must have carrying capacity
- Weight limit checked

### Viewing Inventory
```
> inventory
> inv

You are carrying:
- Leather Backpack [3 lbs] (contains 2 items)
- Torch [1 lbs]
- Gold Coin (x50) [0.5 lbs]

Carrying: 4.5/130 lbs (3%)
```

**Features:**
- Shows item weight
- Shows equipped status
- Shows container contents count
- Total weight / max capacity
- Percentage used
- Warning at 75%+ capacity

## Item Weight Guidelines

### Weight Scale (lbs)
- **Tiny** (0-0.5): Coins, keys, rings, scrolls
- **Small** (0.5-2): Potions, books, daggers, wands
- **Medium** (2-10): Swords, armor pieces, shields, backpacks
- **Large** (10-25): Full armor sets, large weapons, chests
- **Heavy** (25+): Immovable furniture, statues

### Setting Item Weights
```json
{
  "id": "health_potion",
  "name": "Health Potion",
  "weight": 0.5,
  "...": "..."
}
```

**Default Weight**: If not specified, weight = 0

### Recommended Weights
```json
{
  "coins": 0.01,
  "potion": 0.5,
  "dagger": 1,
  "scroll": 0.2,
  "book": 2,
  "sword": 5,
  "shield": 8,
  "armor": 15,
  "backpack": 3,
  "chest": 20
}
```

## Technical Implementation

### Weight Calculation
```javascript
// Calculate total inventory weight
const calculateInventoryWeight = (inventory) => {
    let totalWeight = 0;
    for (const item of inventory) {
        const itemData = gameItems[item.id];
        if (itemData) {
            const itemWeight = itemData.weight || 0;
            const quantity = item.quantity || 1;
            totalWeight += itemWeight * quantity;
        }
    }
    return totalWeight;
};
```

### Capacity Calculation
```javascript
// Calculate max carrying capacity
const calculateMaxCarryWeight = (playerData) => {
    const strength = playerData.strength || 10;
    const baseCapacity = 50;
    const strengthBonus = strength * 5;
    
    let bagBonus = 0;
    const inventory = playerData.inventory || [];
    for (const item of inventory) {
        const itemData = gameItems[item.id];
        if (itemData && itemData.itemType === 'container' && item.equipped) {
            bagBonus += itemData.specialData?.capacityBonus || 0;
        }
    }
    
    return baseCapacity + strengthBonus + bagBonus;
};
```

### Can Carry Check
```javascript
// Check if player can carry item
const canCarryItem = (playerData, itemId, quantity = 1) => {
    const itemData = gameItems[itemId];
    if (!itemData) return false;
    
    const itemWeight = (itemData.weight || 0) * quantity;
    const currentWeight = calculateInventoryWeight(playerData.inventory || []);
    const maxWeight = calculateMaxCarryWeight(playerData);
    
    return (currentWeight + itemWeight) <= maxWeight;
};
```

## Data Structure

### Container Instance
```javascript
{
  id: "leather_backpack",
  name: "Leather Backpack",
  equipped: true, // Provides capacityBonus
  contents: [
    {
      id: "iron_sword",
      name: "Iron Sword",
      quantity: 1,
      // ... other item properties
    },
    {
      id: "health_potion",
      name: "Health Potion",
      quantity: 3
    }
  ]
}
```

### Player Inventory
```javascript
{
  inventory: [
    { id: "leather_backpack", ..., contents: [...] },
    { id: "torch", ..., equipped: false },
    { id: "gold_coin", ..., quantity: 50 }
  ],
  strength: 12,
  // carrying capacity = 50 + (12 * 5) + backpack_bonus
}
```

## Admin Panel Setup

### Creating Container Items
1. Go to **Items** tab
2. Click **Add New Item**
3. Fill basic info:
   - **ID**: `leather_backpack`
   - **Name**: `Leather Backpack`
   - **Item Type**: `container`
   - **Weight**: `3`
   - **Value**: `25`
4. Set **Special Data** (JSON):
```json
{
  "capacity": 50,
  "capacityBonus": 20,
  "description": "A sturdy backpack that increases carrying capacity."
}
```
5. Click **Save**

### Setting Item Weights
- Edit any existing item
- Add `weight` field (number)
- Recommended: 0.5-5 lbs for most items
- Save changes

## Gameplay Tips

### For Players
1. **Get a Backpack Early**: Dramatically increases capacity
2. **Organize by Weight**: Store heavy items you don't need often
3. **Check Weight**: Use `inventory` to monitor capacity
4. **Specialize Containers**: Spell components in pouch, gear in backpack
5. **Drop Before Combat**: Remove heavy containers for better mobility

### For Dungeon Masters
1. **Balance Loot**: Consider total weight of treasure
2. **Gate Progress**: Heavy quest items create interesting choices
3. **Reward Strength**: High-strength characters can carry more
4. **Container Rewards**: Backpacks are valuable quest rewards
5. **Weight Puzzles**: Create scenarios requiring item management

## Advanced Features

### Nested Weight
Container weight calculation:
```
Total Weight = Container Weight + Contents Weight
```

A backpack (3 lbs) with sword (5 lbs) = **8 lbs total**

### Equipping Containers
Containers with `capacityBonus` must be equipped to provide benefit:
```javascript
// Check if container is equipped
item.equipped === true
```

Future: Add `equip` command to toggle container equipped status

### Container Limits
Prevents abuse:
- Can't put container inside itself
- Can't exceed container capacity
- Can't take from container if at weight limit

## Example Scenarios

### Scenario 1: Basic Usage
```
> get backpack
You take a Leather Backpack.

> inventory
You are carrying:
- Leather Backpack [3 lbs]
Carrying: 3.0/70 lbs (4%)

> put all weapons in backpack
(Not implemented - use individual put commands)

> put sword in backpack
You put an Iron Sword in a Leather Backpack.
```

### Scenario 2: Over-Encumbered
```
> get treasure chest
You can't carry that! (Current: 65.0/70 lbs, item weighs 20 lbs)
Try dropping some items first, or store items in a container.

> put armor in backpack
You put Steel Armor in a Leather Backpack.

> get treasure chest
You take a Treasure Chest.
```

### Scenario 3: Organizing Inventory
```
> use backpack
You open Leather Backpack.
It contains:
- Iron Sword [5 lbs]
- Steel Armor [15 lbs]
- Health Potion (x3) [1.5 lbs]
Capacity: 21.5/50 lbs

> take potion from backpack
You take a Health Potion from a Leather Backpack.

> use potion
You drink the Health Potion...
```

## Database Collections

### Items Collection
```javascript
{
  id: "leather_backpack",
  name: "Leather Backpack",
  itemType: "container",
  weight: 3,
  value: 25,
  movable: true,
  specialData: {
    capacity: 50,
    capacityBonus: 20,
    description: "..."
  }
}
```

### Player Collection
```javascript
{
  name: "PlayerName",
  inventory: [
    {
      id: "leather_backpack",
      name: "Leather Backpack",
      equipped: true,
      contents: [...]
    }
  ],
  strength: 12
}
```

## Future Enhancements

### Potential Features
1. **Auto-organize**: Sort items by weight/type
2. **Quick access**: Hotkey items in containers
3. **Container upgrades**: Enchant to increase capacity
4. **Weight effects**: Encumbrance affects movement/combat
5. **Shared storage**: Guild banks, home storage
6. **Container locking**: Secure valuable items
7. **Bulk commands**: `put all potions in pouch`
8. **Equip slots**: Dedicated container slots

### Balance Adjustments
- Tweak base capacity (currently 50)
- Adjust strength multiplier (currently 5)
- Add class-based bonuses
- Weight affects combat stats
- Container durability system

## Troubleshooting

### "You can't carry that!"
- Check current weight: `inventory`
- Drop unnecessary items: `drop item`
- Store in container: `put item in backpack`
- Increase Strength stat

### "The backpack is too full!"
- Container has capacity limit
- Take items out: `take item from backpack`
- Use larger container
- Check capacity: `use backpack`

### Container not found
- Ensure container in inventory
- Check spelling: `inventory` to see exact name
- Containers must be carried to use

### Can't take item from container
- At weight limit
- Free up space first
- Item might not exist in container
- Check contents: `use backpack`

## Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `use [container]` | Open and view container contents | `use backpack` |
| `open [container]` | Same as use | `open backpack` |
| `put [item] in [container]` | Store item in container | `put sword in backpack` |
| `take [item] from [container]` | Retrieve item from container | `take sword from backpack` |
| `inventory` | View all items with weights | `inventory` |
| `get [item]` | Pick up item (checks weight) | `get sword` |
| `drop [item]` | Drop item from inventory | `drop sword` |

## See Also
- **containers-example.json**: Example container item definitions
- **TRADING_SYSTEM.md**: Item values and economy
- **QUEST_SYSTEM.md**: Weight-based quest objectives
- **CLASS_LEVELING.md**: Strength stat progression
