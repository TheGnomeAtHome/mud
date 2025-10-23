# Equipment System Guide

## Overview
The equipment system allows players to equip weapons, armor, shields, clothing, and other wearable items. Equipped items provide bonuses and are displayed separately from regular inventory.

## Player Commands

### Equipping Items
```
equip [item]     - Equip an item from your inventory
wear [item]      - Same as equip (for clothing/armor)
wield [item]     - Same as equip (for weapons)
```

**Examples:**
```
> equip sword
You equip an iron sword. (+5 damage)

> wear leather armor
You equip leather armor. (+2 armor)

> wield bow
You equip a wooden longbow. (+8 damage)

> equip backpack
You equip a leather backpack. (+20 lbs carrying capacity)
```

### Unequipping Items
```
unequip [item]   - Remove equipped item
remove [item]    - Same as unequip
```

**Examples:**
```
> unequip sword
You unequip an iron sword.

> remove armor
You unequip leather armor.
```

### Viewing Equipment
```
equipment        - Show all equipped items
equipped         - Same as equipment
inventory        - Shows items with (equipped) status
```

**Example:**
```
> equipment
=== Equipped Items ===
Weapon: iron sword (+5 damage)
Shield: wooden shield
Armor: leather armor (+2 protection)
container: leather backpack (+20 lbs capacity)

Total Bonuses: +5 damage, +2 armor
```

## Equipment Types & Slots

### Weapons
**Item Properties:**
```json
{
  "id": "iron_sword",
  "name": "Iron Sword",
  "itemType": "weapon",
  "isWeapon": true,
  "weaponDamage": 5,
  "weight": 5,
  "value": 50
}
```

**Slot:** `weapon` (equippedWeapon)
**Commands:** `equip`, `wield`, `unequip`
**Bonus:** Adds damage to combat attacks

### Shields
**Item Properties:**
```json
{
  "id": "wooden_shield",
  "name": "Wooden Shield",
  "type": "shield",
  "itemType": "shield",
  "weight": 6,
  "value": 30
}
```

**Slot:** `shield` (equippedShield)
**Commands:** `equip`, `unequip`
**Bonus:** Provides chance to block attacks

### Armor
**Item Properties:**
```json
{
  "id": "leather_armor",
  "name": "Leather Armor",
  "type": "armor",
  "itemType": "armor",
  "subtype": "leather",
  "damageReduction": 2,
  "weight": 10,
  "value": 75
}
```

**Slot:** `armor` (equippedArmor)
**Commands:** `equip`, `wear`, `unequip`, `remove`
**Bonus:** Reduces incoming damage

**Armor Subtypes:**
- `cloth`: 1 damage reduction (robes, tunics)
- `leather`: 2 damage reduction (leather, hide)
- `chainmail`: 3 damage reduction (chain, scale mail)
- `plate`: 5 damage reduction (full plate)

### Containers (Backpacks, Bags)
**Item Properties:**
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

**Slot:** `container`
**Commands:** `equip`, `unequip`
**Bonus:** Increases carrying capacity when equipped

### Clothing & Accessories
**Item Properties:**
```json
{
  "id": "leather_boots",
  "name": "Leather Boots",
  "itemType": "clothing",
  "weight": 2,
  "value": 15,
  "specialData": {
    "slot": "feet",
    "defenseBonus": 1
  }
}
```

**Slot:** Custom (defined in `specialData.slot`)
**Commands:** `equip`, `wear`, `unequip`, `remove`
**Bonus:** Can provide various bonuses (future expansion)

## How Equipment Works

### Equipping Process
1. **Check Inventory**: Item must be in your inventory
2. **Determine Type**: System identifies weapon/armor/shield/etc.
3. **Unequip Previous**: Auto-unequips item in same slot
4. **Mark as Equipped**: Item flagged with `equipped: true`
5. **Update Player**: Sets `equippedWeapon`, `equippedArmor`, etc.
6. **Apply Bonuses**: Damage/armor/capacity bonuses take effect

### Combat Integration
- **Weapons**: Damage automatically added to attacks
- **Shields**: Chance to block enemy attacks
- **Armor**: Reduces damage from attacks
- **Equipment checked**: Every attack references equipped items

### Inventory Display
```
> inventory
You are carrying:
- iron sword (equipped) [5 lbs]
- leather armor (equipped) [10 lbs]
- wooden shield (equipped) [6 lbs]
- health potion [0.5 lbs]
- leather backpack (equipped) [3 lbs] (contains 2 items)

Carrying: 24.5/130 lbs (19%)
```

## Creating Equippable Items (Admin)

### Weapon Example
```json
{
  "id": "steel_sword",
  "name": "Steel Sword",
  "description": "A finely crafted steel blade",
  "itemType": "weapon",
  "isWeapon": true,
  "weaponDamage": 8,
  "weight": 6,
  "value": 150,
  "movable": true
}
```

### Armor Example
```json
{
  "id": "chainmail_armor",
  "name": "Chainmail Armor",
  "description": "Interlocking metal rings providing good protection",
  "type": "armor",
  "itemType": "armor",
  "subtype": "chainmail",
  "damageReduction": 3,
  "weight": 15,
  "value": 200,
  "movable": true
}
```

### Shield Example
```json
{
  "id": "iron_shield",
  "name": "Iron Shield",
  "description": "A sturdy iron shield",
  "type": "shield",
  "itemType": "shield",
  "weight": 8,
  "value": 50,
  "movable": true
}
```

### Clothing Example
```json
{
  "id": "magic_cloak",
  "name": "Cloak of Shadows",
  "description": "A mysterious cloak that seems to shimmer",
  "itemType": "clothing",
  "weight": 2,
  "value": 300,
  "movable": true,
  "specialData": {
    "slot": "back",
    "stealthBonus": 2,
    "description": "Provides bonus to stealth"
  }
}
```

## Equipment Bonuses

### Combat Bonuses
```javascript
// Weapon damage bonus
baseDamage + weaponDamage + strengthBonus = totalDamage

// Armor damage reduction
incomingDamage - armorReduction - constitutionBonus = actualDamage

// Shield block chance
blockChance = baseBlockChance + dexterityBonus
```

### Carrying Capacity
```javascript
baseCapacity = 50
strengthBonus = strength × 5
containerBonus = sum of equipped container capacityBonuses
totalCapacity = baseCapacity + strengthBonus + containerBonus
```

### Example Calculation
```
Player Stats:
- Strength: 12
- Equipped Backpack: +20 capacity

Carrying Capacity:
50 (base) + (12 × 5) + 20 = 130 lbs
```

## Equipment Workflow

### Starting the Game
1. New players start with no equipment
2. Must find or buy weapons/armor
3. Use `equip` command to wear items
4. Check `equipment` to see what's equipped

### During Combat
1. Equipped weapon damage applied automatically
2. Armor reduces incoming damage
3. Shield provides block chance
4. No need to specify weapon in attack command

### Managing Equipment
```
> inventory
- iron sword
- steel sword [Better!]

> unequip iron sword
You unequip an iron sword.

> equip steel sword
You equip a steel sword. (+8 damage)

> equipment
=== Equipped Items ===
Weapon: steel sword (+8 damage)
```

## Advanced Features

### Auto-Equipping (Future)
- Best weapon auto-equipped when picked up
- Smart equipment suggestions
- Quick-swap equipment sets

### Equipment Sets (Future)
- Matching armor pieces provide set bonuses
- "Knight's Plate" set: +10 armor when all pieces worn
- Visual indicators for set completion

### Durability System (Future)
- Equipment degrades with use
- Repair at blacksmith
- Broken equipment provides no bonus

### Enchantments (Future)
- Magical items with special properties
- "+1 Flaming Sword" deals fire damage
- "Boots of Speed" increase movement

## Troubleshooting

### "You aren't carrying that item"
- Item must be in inventory first
- Use `get [item]` to pick it up
- Check `inventory` to see what you have

### "That item cannot be equipped"
- Item must have proper itemType (weapon/armor/shield/clothing/container)
- Check item definition in admin panel
- Regular items (type: "normal") cannot be equipped

### Equipment not showing bonuses
- Check item has weaponDamage or damageReduction property
- Verify item is marked as equipped
- Use `equipment` command to confirm

### Can't unequip item
- Ensure you're using correct item name
- Item must currently be equipped
- Check `equipment` to see what's equipped

## Integration with Other Systems

### Combat System
- Equipped weapon adds to attack damage
- Equipped armor reduces damage taken
- Shield provides block chance
- All automatic during combat

### Weight System
- Equipped items count toward total weight
- Equipped containers provide capacity bonus
- See total in `inventory` command

### Trading System
- Can trade equipped items
- Items auto-unequipped when traded
- Buyer must equip items themselves

### Quest System
- Quests can require specific equipment
- "Wear the King's Armor to enter throne room"
- Equipment state tracked for objectives

## Commands Reference

| Command | Aliases | Description | Example |
|---------|---------|-------------|---------|
| `equip [item]` | `wear`, `wield` | Equip an item | `equip sword` |
| `unequip [item]` | `remove` | Remove equipped item | `unequip sword` |
| `equipment` | `equipped` | Show equipped items | `equipment` |
| `inventory` | `inv`, `i` | Show all items | `inventory` |

## Best Practices

### For Players
1. **Equip weapons early** - Significantly increases damage
2. **Balance weight** - Heavy armor slows you down
3. **Upgrade often** - Better equipment = easier fights
4. **Check equipment** - Use `equipment` to verify bonuses
5. **Specialized builds** - Focus on STR or DEX based on equipment

### For Dungeon Masters
1. **Provide variety** - Different weapons for different builds
2. **Balance rewards** - Make equipment progression meaningful
3. **Visual feedback** - Equipment affects descriptions
4. **Merchant stocks** - Offer equipment at shops
5. **Quest rewards** - Unique equipment as quest completion prizes

## Examples

### Complete Equipment Setup
```bash
# Start of game
> inventory
You are not carrying anything.

# Find some gear
> get sword
You take an iron sword.

> get armor
You take leather armor.

> get shield
You take a wooden shield.

# Equip everything
> equip sword
You equip an iron sword. (+5 damage)

> equip armor
You equip leather armor. (+2 armor)

> equip shield
You equip a wooden shield.

# Check your gear
> equipment
=== Equipped Items ===
Weapon: iron sword (+5 damage)
Shield: wooden shield
Armor: leather armor (+2 protection)

Total Bonuses: +5 damage, +2 armor

# Go into battle!
> attack goblin
You slash the goblin with an iron sword for 15 damage!
The goblin attacks but your wooden shield blocks the blow!
```

### Upgrading Equipment
```bash
> inventory
- iron sword (equipped) [5 lbs]
- steel sword [6 lbs]

> examine steel sword
A finely crafted steel blade
Damage: 8

> unequip iron sword
You unequip an iron sword.

> equip steel sword
You equip a steel sword. (+8 damage)

> drop iron sword
You drop an iron sword.
```

## See Also
- **CONTAINER_SYSTEM.md** - Backpack equipment and carrying capacity
- **COMBAT_SYSTEM.md** - How equipment affects combat
- **TRADING_SYSTEM.md** - Buying and selling equipment
- **CLASS_LEVELING.md** - Class-specific equipment bonuses
