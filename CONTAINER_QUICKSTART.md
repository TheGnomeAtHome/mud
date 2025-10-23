# Container System Quick Start

## For Players

### Basic Commands
```bash
# View your inventory and weight
inventory

# Pick up a container
get backpack

# Open a container to see what's inside
use backpack

# Store an item
put sword in backpack

# Take an item out
take sword from backpack
```

### Weight System
- Every item has weight (in pounds)
- Your carrying capacity = 50 + (Strength × 5) + container bonuses
- At 75% capacity = warning
- At 100% capacity = can't pick up more items

### Tips
1. Get a backpack ASAP - it increases your carrying capacity!
2. Store heavy items you don't need immediately
3. Check `inventory` regularly to see your weight
4. Containers with `capacityBonus` increase your total carrying capacity

## For Dungeon Masters

### Quick Setup (3 Steps)

#### 1. Add Container Items
Go to Admin Panel → Items → Add New Item:
```json
{
  "id": "leather_backpack",
  "name": "Leather Backpack",
  "itemType": "container",
  "weight": 3,
  "value": 25,
  "movable": true,
  "specialData": {
    "capacity": 50,
    "capacityBonus": 20
  }
}
```

#### 2. Set Item Weights
Edit existing items and add `weight` property:
```json
{
  "id": "iron_sword",
  "name": "Iron Sword",
  "weight": 5,
  "...": "..."
}
```

**Weight Guidelines:**
- Coins/keys: 0.01-0.1 lbs
- Potions: 0.5 lbs
- Weapons: 1-10 lbs
- Armor: 10-20 lbs
- Containers: 2-5 lbs

#### 3. Place Containers in Game
Add container items to starting rooms or merchant inventories:
```json
{
  "roomId": "general_store",
  "npcs": ["merchant"],
  "items": ["leather_backpack", "small_pouch"]
}
```

### Container Examples

**Small Pouch** (10 lbs capacity)
```json
{
  "id": "small_pouch",
  "name": "Small Pouch",
  "itemType": "container",
  "weight": 0.5,
  "specialData": {"capacity": 10}
}
```

**Leather Backpack** (50 lbs capacity, +20 bonus)
```json
{
  "id": "leather_backpack",
  "name": "Leather Backpack",
  "itemType": "container",
  "weight": 3,
  "specialData": {
    "capacity": 50,
    "capacityBonus": 20
  }
}
```

**Military Duffel** (100 lbs capacity, +50 bonus)
```json
{
  "id": "military_duffel",
  "name": "Military Duffel Bag",
  "itemType": "container",
  "weight": 5,
  "specialData": {
    "capacity": 100,
    "capacityBonus": 50
  }
}
```

## How It Works

### Carrying Capacity Formula
```
Base Capacity = 50 lbs
+ Strength Bonus = (Strength stat × 5) lbs
+ Container Bonuses = Sum of equipped containers
= Total Capacity
```

**Example:**
- Player with Strength 10
- Equipped Leather Backpack (+20 bonus)
- Total: 50 + (10 × 5) + 20 = **120 lbs capacity**

### Container Storage
- Each container has its own capacity limit
- Items in containers still count toward total weight
- Container weight + contents weight = total
- Can't put containers inside themselves

### Weight Checking
- Automatic when using `get` command
- Shows error if over capacity
- Displays current/max weight
- Warnings at 75% and 90%

## Common Scenarios

### Starting Area Merchant
```json
{
  "id": "merchant_items",
  "items": [
    {
      "id": "small_pouch",
      "price": 5
    },
    {
      "id": "leather_backpack", 
      "price": 25
    }
  ]
}
```

### Quest Reward
```json
{
  "questId": "fetch_quest",
  "rewards": {
    "items": ["military_duffel"],
    "gold": 50
  }
}
```

### Hidden Treasure
```json
{
  "roomId": "secret_chamber",
  "items": ["adventurers_satchel"],
  "details": {
    "chest": "Inside you find a well-worn adventurer's satchel!"
  }
}
```

## Troubleshooting

**Items have no weight?**
- Default weight is 0 if not specified
- Add `"weight": X` to item definitions

**Container doesn't increase capacity?**
- Add `"capacityBonus": X` to specialData
- Container must be equipped (future feature)

**Can't pick up items?**
- Player at weight limit
- Use `inventory` to check capacity
- Store/drop items to free space

## Next Steps

1. **Import Examples**: Load `containers-example.json` into your items collection
2. **Set Weights**: Edit existing items to add weight values
3. **Test System**: Create character, get backpack, test commands
4. **Balance**: Adjust weights and capacities based on gameplay

For complete documentation, see **CONTAINER_SYSTEM.md**
