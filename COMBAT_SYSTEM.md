# Enhanced Combat System

## Overview
The combat system has been upgraded to utilize all player attributes (STR, DEX, CON, INT, WIS, CHA) for more strategic and realistic combat encounters. The system now features **verbose, contextual combat descriptions** that bring every fight to life!

> 💡 **New!** See [VERBOSE_COMBAT.md](VERBOSE_COMBAT.md) for the complete guide to the immersive combat description system including shield blocking, armor deflection, and damage-based narrative text.

## Quick Feature Highlights

### 🎯 Verbose Combat Descriptions
Combat now features dynamic, contextual messages that change based on:
- **Damage severity** (light, moderate, heavy, severe, devastating)
- **Weapon type** (slash, stab, punch, kick, claw, bite)
- **Critical hits** (dramatic flair with visual effects: ⚡ CRITICAL HIT!)
- **Attack verbs** (hundreds of varied descriptions)

**Example:**
```
You cleave into the Dragon with your greatsword finding a vulnerable spot for 24 damage! ⚡ CRITICAL HIT!
(+5 STR, +3 DEX, +8 weapon)
```

### 🛡️ Shield Blocking System
- **Block chance**: 15% base + 2% per DEX point above 10 (max 40%)
- **Damage reduction**: 50-100% of incoming damage
- **Descriptive messages**: "You raise your iron shield and block the attack!"
- **Requires**: Shield equipped in `equippedShield` slot

### 🛡️ Armor Deflection System  
- **Armor types**: Cloth (1), Leather (2), Chainmail (3), Plate (5) damage reduction
- **Full deflection**: 10% chance to completely deflect light attacks
- **Descriptive messages**: "The blow glances off your chainmail!"
- **Requires**: Armor equipped in `equippedArmor` slot

### 🤸 Enhanced Dodging
Dodge descriptions now reflect character DEX:
- **High DEX (18+)**: "You dodge with lightning reflexes!"
- **Medium DEX (14-17)**: "You quickly step aside!"
- **Low DEX**: "You barely dodge the attack!"

## Attribute Effects

### Strength (STR)
- **Primary damage stat** for physical attacks
- Modifier: `(STR - 10) / 2` (D&D 5e style)
- Example: STR 16 = +3 damage bonus

### Dexterity (DEX)
- **Hit accuracy bonus**: Adds to damage `(DEX - 10) / 4`
- **Critical hit chance**: 5% base + 0.5% per point above 10
- **Dodge chance**: Major contributor to avoiding attacks
- Example: DEX 18 = +2 damage, 9% crit chance, improved dodge

### Constitution (CON)
- **Damage reduction**: Reduces incoming damage `(CON - 10) / 3`
- **Survivability**: Higher CON means you take less damage from all sources
- Example: CON 15 = -1 damage from all attacks (minimum 1)

### Intelligence (INT)
- **Magical damage** (future implementation for spells)
- Can be used instead of STR for magic-based attacks
- Currently affects magical weapon damage

### Wisdom (WIS)
- **Dodge chance**: Secondary contributor to evasion
- **Perception**: Helps avoid surprise attacks
- Dodge formula: `5% + (DEX_mod × 2%) + (WIS_mod × 1%)`
- Example: WIS 14 = additional 2% dodge chance

### Charisma (CHA)
- **Future implementations**: Morale, first strike, intimidation
- Reserved for social combat mechanics

## Combat Mechanics

### Damage Calculation
```
Base Damage = 1d6 (1-6 random)
+ STR modifier (physical) or INT modifier (magical)
+ DEX accuracy bonus
+ Weapon damage
- Target's CON damage reduction
= Final Damage (minimum 1)
```

### Critical Hits
- Base chance: 5%
- DEX bonus: +0.5% per DEX point above 10
- Effect: 2× total damage
- Example: With DEX 16, you have 8% crit chance

### Dodge System
- Calculated before damage is dealt
- Formula: `5% base + (DEX-10)/2 × 2% + (WIS-10)/4 × 1%`
- Maximum dodge chance: 50%
- When successful: No damage taken, no counter-attack

### Combat Flow

#### PvP Combat
1. Player attacks → Dodge check
2. If not dodged → Calculate damage with all bonuses
3. Apply damage to target
4. Target counter-attacks → Dodge check
5. If not dodged → Calculate counter-attack damage
6. Apply counter-damage
7. Show detailed combat log with breakdown

#### Monster Combat
1. Player attacks monster → Monster dodge check (5% base)
2. If not dodged → Calculate enhanced damage
3. Apply damage to monster
4. Monster counter-attacks → Player dodge check
5. If not dodged → Calculate monster damage (reduced by player CON)
6. Apply damage to player
7. Show combat breakdown

## Combat Messages

### Standard Attack
```
You hit the Goblin for 12 damage!
(+3 STR, +2 DEX, +5 weapon, -1 target CON)
```

### Critical Hit
```
You hit the Dragon for 28 damage (Critical Hit!)!
(+4 STR, +3 DEX, +8 weapon, -1 target CON)
```

### Dodge
```
The Skeleton dodges your attack!
```

### Counter-Attack
```
The Orc counter-attacks for 15 damage (Critical Hit!)!
```

## Strategic Implications

### Character Builds

**Tank (High CON)**
- Takes reduced damage from all sources
- Can survive longer fights
- Good for solo grinding

**Damage Dealer (High STR + DEX)**
- High damage output
- Frequent critical hits
- Glass cannon if CON is low

**Evasive Fighter (High DEX + WIS)**
- Dodges many attacks
- Reliable critical hits
- Lower raw damage but survives well

**Balanced (Moderate all stats)**
- Reliable in all situations
- No major weaknesses
- Good for PvP

### Equipment Strategy
- **Weapons**: Add flat damage (scales with STR/DEX bonuses)
- **High STR builds**: Maximize weapon damage
- **High DEX builds**: Focus on weapons with critical bonuses (future)
- **Low CON**: Seek armor that adds HP or damage reduction

### Class Synergies

**Warrior** (STR+3, CON+2)
- High damage with damage reduction
- Best for direct combat

**Rogue** (DEX+4, CHA+2)
- Highest crit chance and dodge
- Hit-and-run tactics

**Wizard** (INT+4, WIS+1)
- Future magical damage potential
- Good dodge from WIS

**Priest** (WIS+3, CHA+2)
- Excellent dodge capability
- Support role with decent defense

**Paladin** (STR+2, CON+2, WIS+1, CHA+1)
- Balanced offense and defense
- Versatile combatant

**Ranger** (DEX+3, STR+1, WIS+2)
- High crit and dodge
- Consistent damage

## Future Enhancements

### Planned Features
- **Armor system**: Additional damage reduction beyond CON
- **Weapon types**: Different crit multipliers (daggers 3x, axes 2.5x)
- **Magic spells**: INT-based attacks with different effects
- **Status effects**: Bleed (DEX), stun (STR), confusion (INT)
- **Combat stances**: Defensive (+dodge), Aggressive (+damage)
- **Combo attacks**: Multiple hits with DEX checks
- **Backstab**: Extra damage when attacking from stealth (Rogue ability)

### Balancing Notes
- All minimum damages are 1 to ensure progress
- Dodge capped at 50% to prevent invincibility
- Critical multiplier at 2× for consistency
- CON reduction formula prevents negative damage
- Monster stats scale to provide appropriate challenge

## Testing Tips

1. **Test different builds**: Create characters with min/maxed stats
2. **Check combat logs**: Verify bonuses are applied correctly
3. **PvP balance**: Ensure no single stat dominates
4. **Monster difficulty**: Adjust monster stats if too easy/hard
5. **Weapon scaling**: Verify weapon bonuses interact correctly with stats
