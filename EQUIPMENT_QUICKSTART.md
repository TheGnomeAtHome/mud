# Equipment System - Quick Reference

## Player Commands

```bash
# Equipping items
equip [item]       # Equip weapon/armor/shield/clothing
wear [item]        # Same as equip (for armor/clothing)
wield [item]       # Same as equip (for weapons)

# Unequipping items
unequip [item]     # Remove equipped item
remove [item]      # Same as unequip

# Viewing equipment
equipment          # Show all equipped items with bonuses
equipped           # Same as equipment
inventory          # Shows items with (equipped) status
```

## Quick Examples

```bash
# Basic equipment
> equip sword
You equip an iron sword. (+5 damage)

> wear armor
You equip leather armor. (+2 armor)

> equipment
=== Equipped Items ===
Weapon: iron sword (+5 damage)
Armor: leather armor (+2 protection)

# Changing equipment
> unequip sword
You unequip an iron sword.

> equip steel sword
You equip a steel sword. (+8 damage)

# With containers
> equip backpack
You equip a leather backpack. (+20 lbs carrying capacity)
```

## Equipment Types

| Type | Slot | Bonus | Example |
|------|------|-------|---------|
| **Weapon** | weapon | +damage | iron sword (+5) |
| **Armor** | armor | +protection | leather armor (+2) |
| **Shield** | shield | block chance | wooden shield |
| **Container** | container | +capacity | backpack (+20 lbs) |
| **Clothing** | custom | varies | magic cloak |

## Creating Equippable Items (DM)

### Weapon
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

### Armor
```json
{
  "id": "leather_armor",
  "name": "Leather Armor",
  "type": "armor",
  "itemType": "armor",
  "damageReduction": 2,
  "weight": 10,
  "value": 75
}
```

### Shield
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

### Container (Backpack)
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

## Armor Types & Reduction

| Subtype | Reduction | Examples |
|---------|-----------|----------|
| cloth | 1 | Robes, tunics |
| leather | 2 | Leather armor, hide |
| chainmail | 3 | Chain mail, scale mail |
| plate | 5 | Full plate, heavy armor |

## Combat Bonuses

```javascript
// Attack damage
baseDamage + weaponDamage + strengthBonus

// Damage reduction
incomingDamage - armorReduction - constitutionBonus

// Block chance
if (hasShield) chance to block = based on DEX
```

## Tips

**For Players:**
- ✅ Equip weapons ASAP - huge damage boost
- ✅ Balance armor weight vs protection
- ✅ Shields save lives - block attacks
- ✅ Check `equipment` after changes
- ✅ Upgrade when you find better gear

**For DMs:**
- ✅ Start players with basic equipment
- ✅ Place upgrades as quest rewards
- ✅ Balance weight vs power
- ✅ Offer variety (light/heavy armor)
- ✅ Make legendary items special

## Troubleshooting

**"You aren't carrying that item"**
- Use `get [item]` to pick it up first

**"That item cannot be equipped"**
- Item needs proper itemType (weapon/armor/shield/etc.)

**Not seeing damage bonus?**
- Item needs `weaponDamage` or `damageReduction` property
- Check with `equipment` command

**Can't unequip?**
- Make sure you're using the exact item name
- Check what's equipped with `equipment`

## Complete Walkthrough

```bash
# 1. Get some equipment
> get sword
You take an iron sword.

> get armor
You take leather armor.

> get backpack
You take a leather backpack.

# 2. Equip everything
> equip sword
You equip an iron sword. (+5 damage)

> equip armor
You equip leather armor. (+2 armor)

> equip backpack
You equip a leather backpack. (+20 lbs carrying capacity)

# 3. Check your setup
> equipment
=== Equipped Items ===
Weapon: iron sword (+5 damage)
Armor: leather armor (+2 protection)
container: leather backpack (+20 lbs capacity)

Total Bonuses: +5 damage, +2 armor

> inventory
You are carrying:
- iron sword (equipped) [5 lbs]
- leather armor (equipped) [10 lbs]
- leather backpack (equipped) [3 lbs]

Carrying: 18.0/130 lbs (14%)

# 4. Go fight!
> attack goblin
You slash the goblin with an iron sword for 15 damage!
# ^^ Notice weapon is automatically used in combat
```

## Integration Notes

- **Combat**: Equipment bonuses apply automatically
- **Weight**: Equipped items count toward total weight
- **Inventory**: Shows (equipped) status on items
- **Trading**: Can trade equipped items
- **Quests**: Some quests require specific equipment

For complete documentation, see **EQUIPMENT_SYSTEM.md**
