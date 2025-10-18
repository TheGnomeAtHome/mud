# Class-Specific Leveling System

## Overview
Each character class now has unique leveling progression, making class choice meaningful and strategic. Classes level at different rates, gain different amounts of HP/MP, and have specialized stat growth patterns.

## Leveling Properties

### XP Multiplier
Determines how fast a class levels up relative to the base progression.

- **Rogue**: 0.90 (fastest leveling, -10% XP required)
- **Warrior**: 0.95 (fast leveling, -5% XP required)
- **Ranger**: 0.95 (fast leveling, -5% XP required)
- **Priest**: 1.00 (standard leveling)
- **Paladin**: 1.05 (slow leveling, +5% XP required)
- **Wizard**: 1.10 (slowest leveling, +10% XP required)

**Example**: At level 10, base XP required is ~3,162:
- Rogue needs: 2,846 XP (fastest)
- Warrior needs: 3,004 XP
- Priest needs: 3,162 XP
- Wizard needs: 3,478 XP (slowest)

### HP Per Level
How much maximum HP increases each level.

| Class | HP/Level | Starting HP (with bonus) | HP at Level 30 |
|-------|----------|-------------------------|----------------|
| Warrior | 12 | 120 | 468 |
| Paladin | 10 | 115 | 405 |
| Ranger | 10 | 110 | 400 |
| Rogue | 9 | 100 | 361 |
| Priest | 8 | 100 | 332 |
| Wizard | 6 | 90 | 264 |

### MP Per Level
How much maximum MP increases each level.

| Class | MP/Level | Starting MP (with bonus) | MP at Level 30 |
|-------|----------|-------------------------|----------------|
| Wizard | 10 | 130 | 420 |
| Priest | 8 | 120 | 332 |
| Paladin | 5 | 110 | 255 |
| Ranger | 4 | 105 | 216 |
| Rogue | 3 | 100 | 187 |
| Warrior | 2 | 100 | 158 |

### Stat Growth
Each stat increases by +1 every N levels (lower = faster growth).

**Warrior**: Strength-focused melee powerhouse
- STR: +1 every 2 levels (fast)
- DEX: +1 every 4 levels
- CON: +1 every 3 levels (good)
- INT: +1 every 6 levels (slow)
- WIS: +1 every 5 levels
- CHA: +1 every 5 levels

**Wizard**: Intelligence-focused spellcaster
- INT: +1 every 2 levels (fast)
- WIS: +1 every 3 levels (good)
- DEX: +1 every 4 levels
- CON: +1 every 5 levels
- STR: +1 every 6 levels (slow)
- CHA: +1 every 5 levels

**Priest**: Wisdom and charisma support
- WIS: +1 every 2 levels (fast)
- CHA: +1 every 3 levels (good)
- CON: +1 every 4 levels
- INT: +1 every 4 levels
- DEX: +1 every 5 levels
- STR: +1 every 6 levels (slow)

**Rogue**: Dexterity and charisma specialist
- DEX: +1 every 2 levels (fast)
- CHA: +1 every 3 levels (good)
- STR: +1 every 4 levels
- CON: +1 every 4 levels
- WIS: +1 every 4 levels
- INT: +1 every 5 levels

**Paladin**: Balanced holy warrior
- STR: +1 every 3 levels
- CON: +1 every 3 levels
- WIS: +1 every 4 levels
- CHA: +1 every 4 levels
- DEX: +1 every 5 levels
- INT: +1 every 5 levels

**Ranger**: Dexterity and wisdom tracker
- DEX: +1 every 2 levels (fast)
- WIS: +1 every 3 levels (good)
- STR: +1 every 4 levels
- CON: +1 every 4 levels
- INT: +1 every 5 levels
- CHA: +1 every 6 levels (slow)

## Level-Up Bonuses

### What Happens on Level Up
1. **HP Increase**: Gain HP based on class (6-12 per level)
2. **MP Increase**: Gain MP based on class (2-10 per level)
3. **Stat Increases**: Automatic stat growth based on class specialization
4. **Full Heal**: HP and MP restored to new maximum
5. **News Announcement**: Level up broadcast to all players

### Level-Up Message Example
```
🎉 LEVEL UP! You are now level 5 Warrior - Combatant!
Max HP increased to 168! (+12)
Max MP increased to 108! (+2)
Strength increased to 15! (+1)
Constitution increased to 13! (+1)
XP to next level: 243
```

## Strategic Class Comparison

### Fast Levelers (Good for New Players)
**Rogue** - Fastest XP progression, moderate survivability
- Best for: Learning the game, quick progression
- Strengths: Speed, evasion, critical hits
- Weaknesses: Low HP, moderate damage

**Warrior** - Fast XP, highest HP, strong in combat
- Best for: Solo play, tanking, direct combat
- Strengths: High HP, strong attacks, good defense
- Weaknesses: Low MP, limited utility

**Ranger** - Fast XP, balanced stats, versatile
- Best for: Solo exploration, ranged combat
- Strengths: Good HP, excellent dodge, consistent damage
- Weaknesses: Jack-of-all-trades

### Standard Levelers
**Priest** - Balanced XP, support-focused
- Best for: Group play, healing, support
- Strengths: High MP, best dodge, support abilities
- Weaknesses: Low HP, weak physical attacks

### Slow Levelers (Powerful Late Game)
**Paladin** - Slightly slow XP, versatile holy warrior
- Best for: Balanced gameplay, PvP
- Strengths: Good at everything, versatile
- Weaknesses: No outstanding strengths

**Wizard** - Slowest XP, powerful magic user
- Best for: Patient players, magical damage
- Strengths: Highest MP, powerful spells (future)
- Weaknesses: Lowest HP, slow leveling

## Stat Totals at Level 30

Assuming base stats of 10 + class bonuses + level bonuses:

### Warrior (Level 30)
- STR: 13 + 14 = 27 (dominant)
- DEX: 10 + 7 = 17
- CON: 12 + 9 = 21 (excellent)
- INT: 9 + 4 = 13
- WIS: 10 + 5 = 15
- CHA: 10 + 5 = 15
- HP: 468 | MP: 158

### Wizard (Level 30)
- INT: 14 + 14 = 28 (dominant)
- WIS: 11 + 9 = 20 (excellent)
- DEX: 10 + 7 = 17
- CON: 9 + 5 = 14
- CHA: 10 + 5 = 15
- STR: 9 + 4 = 13
- HP: 264 | MP: 420

### Priest (Level 30)
- WIS: 13 + 14 = 27 (dominant)
- CHA: 12 + 9 = 21 (excellent)
- INT: 10 + 7 = 17
- CON: 11 + 7 = 18
- DEX: 10 + 5 = 15
- STR: 10 + 4 = 14
- HP: 332 | MP: 332

### Rogue (Level 30)
- DEX: 14 + 14 = 28 (dominant)
- CHA: 12 + 9 = 21 (excellent)
- STR: 10 + 7 = 17
- CON: 10 + 7 = 17
- WIS: 10 + 7 = 17
- INT: 10 + 5 = 15
- HP: 361 | MP: 187

### Paladin (Level 30)
- STR: 12 + 9 = 21
- CON: 12 + 9 = 21
- WIS: 11 + 7 = 18
- CHA: 11 + 7 = 18
- DEX: 10 + 5 = 15
- INT: 10 + 5 = 15
- HP: 405 | MP: 255

### Ranger (Level 30)
- DEX: 13 + 14 = 27 (dominant)
- WIS: 12 + 9 = 21 (excellent)
- STR: 11 + 7 = 18
- CON: 11 + 7 = 18
- INT: 10 + 5 = 15
- CHA: 10 + 4 = 14
- HP: 400 | MP: 216

## Tips and Strategies

### Early Game (Levels 1-10)
- **Choose Rogue or Warrior** for fastest progression
- Focus on killing monsters for XP
- Class differences are minor at low levels

### Mid Game (Levels 11-20)
- Class specializations become apparent
- **Warriors** have significant HP advantage
- **Wizards** struggle with low HP but high MP
- Stat differences start affecting combat

### Late Game (Levels 21-30)
- Class identity fully realized
- **Wizards** are powerful but took longer to get there
- **Warriors** are tanky powerhouses
- **Rogues** have best crit rate and dodge
- Specialized stat growth creates distinct playstyles

### PvP Considerations
- **Warriors**: High HP, hard to kill
- **Rogues**: High dodge and crit, burst damage
- **Wizards**: Future spell power (when implemented)
- **Priests**: Best dodge, support role
- **Paladins**: Jack-of-all-trades, reliable
- **Rangers**: Consistent damage, good dodge

## Future Enhancements

### Planned Features
- **Class-specific abilities** unlocked at certain levels
- **Prestige classes** after reaching max level
- **Dual-classing** system
- **Class quests** for unique rewards
- **MP-based spell system** (spells cost MP to cast)
- **Class balance updates** based on gameplay data

## Adding New Classes

To add a new class, add these properties to the class definition:

```javascript
{
    name: 'Class Name',
    description: 'Class description',
    statBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    hpBonus: 0,        // Starting HP bonus (positive or negative)
    mpBonus: 0,        // Starting MP bonus
    abilities: [],     // Array of ability names
    xpMultiplier: 1.0, // XP rate (0.9 = faster, 1.1 = slower)
    hpPerLevel: 10,    // HP gained per level
    mpPerLevel: 5,     // MP gained per level
    statGrowth: {      // Levels per +1 stat (lower = faster)
        str: 3,
        dex: 3,
        con: 3,
        int: 3,
        wis: 3,
        cha: 3
    }
}
```

## Testing

To test class progression:
1. Create characters of different classes
2. Use admin panel to grant XP
3. Verify HP/MP gains match expected values
4. Check stat growth at various levels
5. Compare leveling speed across classes
