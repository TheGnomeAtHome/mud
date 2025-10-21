# Dungeon Master's Guide - MUD Game
## Complete Guide to Building Your World

---

## Table of Contents
1. [Getting Started](#getting-started)
2. [World Building](#world-building)
3. [Creating Rooms](#creating-rooms)
4. [Creating Items](#creating-items)
5. [Creating NPCs](#creating-npcs)
6. [Creating Monsters](#creating-monsters)
7. [Creating Character Classes](#creating-character-classes)
8. [Creating Spells](#creating-spells)
9. [Creating Quests](#creating-quests)
10. [Creating Guilds](#creating-guilds)
11. [Advanced Features](#advanced-features)
12. [Testing & Balancing](#testing--balancing)
13. [Common Patterns](#common-patterns)
14. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Admin Access
1. **First Login**: The first player to register automatically becomes admin
2. **Admin Panel**: Click "Admin Panel" button in game interface
3. **Multiple Admins**: Manually set `isAdmin: true` in Firebase for additional admins

### Admin Panel Overview
The admin panel has these tabs:
- **Rooms** - Create and connect locations
- **Items** - Create equipment, consumables, and treasures
- **NPCs** - Create interactive characters
- **Monsters** - Create enemies for combat
- **Classes** - Define character classes
- **Spells** - Create magical abilities
- **Quests** - Design quest chains
- **Guilds** - Manage player guilds
- **Online** - See active players
- **Levels** - Configure level progression
- **Actions** - Set custom emotes
- **Map** - Visualize world connections
- **Settings** - System configuration
- **Export** - Backup your data

---

## World Building

### Planning Your World

Before creating content, plan your world structure:

1. **Theme**: Medieval fantasy? Sci-fi? Post-apocalyptic?
2. **Geography**: Towns, dungeons, wilderness, planes?
3. **Factions**: Who are the major powers?
4. **Level Ranges**: Beginner area (1-5), intermediate (6-10), advanced (11+)?
5. **Economy**: How expensive are items? How much gold do monsters drop?

### World Design Tips

**Start Small**
- Create 10-20 rooms initially
- Add one town, one dungeon, one wilderness
- Expand based on player feedback

**Create Hubs**
- Central meeting areas (tavern, town square)
- Connect multiple paths from hubs
- Include shops, trainers, quest givers

**Difficulty Zones**
- Low level: Near starting area
- Medium level: Require exploration
- High level: Hidden or distant locations

**Use Themes**
- Forest theme: Consistent descriptions, similar monsters
- Dungeon theme: Dark, dangerous, treasure-filled
- Town theme: Safe, NPCs, shops

---

## Creating Rooms

### Room Structure

Rooms are the foundation of your world. Each room has:

```javascript
{
  id: "unique_room_id",
  name: "Display Name",
  description: "What players see when they look",
  exits: { "direction": "destination_room_id" },
  items: ["item_id_1", "item_id_2"],
  npcs: ["npc_id_1"],
  monsterSpawns: [
    { monsterId: "monster_id", respawnTime: 300000 }
  ],
  details: {
    "feature_name": "Description when examined"
  },
  isIndoor: true/false
}
```

### Step-by-Step Room Creation

1. **Open Admin Panel → Rooms Tab**

2. **Click "New Room"**

3. **Fill Required Fields:**
   - **Room ID**: `tavern` (lowercase, no spaces, use underscores)
   - **Room Name**: `The Coach and Horses Tavern`
   - **Description**: Write atmospheric text (2-3 sentences)

4. **Set Indoor/Outdoor:**
   - `"isIndoor": true` for buildings/caves (weather protection)
   - `"isIndoor": false` for outdoors (affected by weather)

5. **Add Exits (JSON format):**
   ```json
   {
     "north": "town_square",
     "east": "tavern_storage",
     "south": "forest_path",
     "up": "tavern_upper_floor",
     "down": "tavern_cellar"
   }
   ```

6. **Add Items (Optional):**
   - Click in Items field, type item IDs: `"torch", "rope", "gold_coin"`
   - Items appear on the floor for players to pick up

7. **Add NPCs (Optional):**
   - Type NPC IDs: `"barkeep", "old_man"`
   - NPCs will appear in this room

8. **Add Monster Spawns (JSON format):**
   ```json
   [
     { "monsterId": "goblin", "respawnTime": 300000 },
     { "monsterId": "rat", "respawnTime": 180000 }
   ]
   ```
   - `respawnTime` is in milliseconds (300000 = 5 minutes)

9. **Add Examinable Details (JSON format):**
   ```json
   {
     "painting": "A portrait of a stern-looking nobleman",
     "fireplace": "A crackling fire warms the room",
     "bar": "The wooden bar is well-worn and sturdy"
   }
   ```
   - Players can examine these with: `examine painting`

10. **Click "Save Room"**

### Room Writing Tips

**Good Descriptions:**
- Use sensory details (sight, sound, smell)
- Keep to 2-4 sentences
- Mention notable features
- Set the atmosphere

**Example:**
> "The tavern is warm and filled with the smell of old wood and ale. A crackling fireplace casts dancing shadows on the walls. Rough-hewn tables are scattered about, and a well-worn bar runs along the eastern wall."

**Avoid:**
- Overly long descriptions (players get tired of reading)
- Mentioning items/NPCs in description (they're listed separately)
- Present tense inconsistency

### Room Types

**Starting Room** (`id: "start"`)
- Should be safe (no monsters)
- Clear exits marked
- Include basic instructions
- Connect to beginner areas

**Towns/Safe Zones**
- `isIndoor: true` (weather protection)
- NPCs for shops, quests
- No monster spawns
- Multiple exit connections

**Dungeons**
- Dark, dangerous atmosphere
- Monster spawns with appropriate respawn times
- Treasure items on floors
- Dead-end rooms with special rewards

**Wilderness**
- `isIndoor: false` (weather affects players)
- Scattered monster spawns
- Connects different zones
- Harvestable items (herbs, wood)

**Boss Rooms**
- Single powerful monster
- Long respawn time (30+ minutes)
- High-value treasure
- Dramatic description

### Connecting Rooms

**Bidirectional Exits:**
Always connect rooms in both directions!

Room A:
```json
{ "exits": { "north": "room_b" } }
```

Room B:
```json
{ "exits": { "south": "room_a" } }
```

**Cardinal Directions:**
- `north`, `south`, `east`, `west`
- `up`, `down`
- `northeast`, `northwest`, `southeast`, `southwest`

**Named Exits:**
- `enter`, `exit`, `portal`
- Only use if directional doesn't make sense

### Room IDs Best Practices

**Good IDs:**
- `tavern`
- `dark_forest_1`
- `goblin_cave_entrance`
- `town_square`

**Bad IDs:**
- `Room 1` (has space)
- `The Tavern` (has space and capital)
- `тавerna` (non-ASCII characters)
- `rm-01` (unclear naming)

---

## Creating Items

### Item Structure

```javascript
{
  id: "item_id",
  name: "Display Name",
  description: "Shown when examined",
  itemType: "weapon/armor/consumable/tool/treasure",
  movable: true/false,
  cost: 100,
  
  // Weapon properties
  isWeapon: true,
  weaponDamage: 5,
  
  // Consumable properties
  consumable: true,
  healAmount: 20,
  
  // Weather protection
  weatherProtection: {
    "rainy": 0.9,
    "cold": 0.6
  }
}
```

### Step-by-Step Item Creation

1. **Open Admin Panel → Items Tab**

2. **Click "New Item"**

3. **Fill Basic Info:**
   - **Item ID**: `iron_sword` (unique, lowercase, underscores)
   - **Item Name**: `an iron sword` (include article: a/an)
   - **Description**: `A well-balanced sword with a sharp iron blade`
   - **Item Type**: Choose from dropdown (weapon, armor, consumable, tool, treasure)

4. **Set Movability:**
   - **Movable**: `true` (players can pick up)
   - **Movable**: `false` (scenery/furniture)

5. **Set Cost:**
   - **Cost**: `50` (gold coins to buy/sell)
   - Set to `0` for quest items or non-tradable

6. **Weapon Properties (if weapon):**
   - **Is Weapon**: Check box
   - **Weapon Damage**: `5` (bonus damage in combat)

7. **Consumable Properties (if consumable):**
   - **Consumable**: Check box
   - **Heal Amount**: `20` (HP restored when used)

8. **Weather Protection (optional, JSON):**
   ```json
   {
     "rainy": 0.9,
     "cold": 0.6,
     "hot": 0.3
   }
   ```
   - Values from 0.0 to 1.0 (0% to 100% protection)

9. **Aliases (optional):**
   - `sword, blade, weapon`
   - Alternate names players can use

10. **Click "Save Item"**

### Item Categories

**Weapons**
```javascript
{
  id: "iron_sword",
  name: "an iron sword",
  description: "A well-balanced blade forged from iron",
  itemType: "weapon",
  isWeapon: true,
  weaponDamage: 5,
  cost: 50,
  movable: true
}
```

**Armor** (Currently for flavor, future defense system)
```javascript
{
  id: "leather_armor",
  name: "leather armor",
  description: "Supple leather armor, well-worn but sturdy",
  itemType: "armor",
  cost: 75,
  movable: true
}
```

**Consumables (Healing)**
```javascript
{
  id: "health_potion",
  name: "a health potion",
  description: "A glass vial filled with glowing red liquid",
  itemType: "consumable",
  consumable: true,
  healAmount: 50,
  cost: 25,
  movable: true
}
```

**Tools**
```javascript
{
  id: "lockpick",
  name: "a set of lockpicks",
  description: "Fine metal tools for picking locks",
  itemType: "tool",
  cost: 15,
  movable: true
}
```

**Treasure**
```javascript
{
  id: "ruby",
  name: "a gleaming ruby",
  description: "A flawless ruby that sparkles in the light",
  itemType: "treasure",
  cost: 500,
  movable: true
}
```

**Quest Items**
```javascript
{
  id: "ancient_scroll",
  name: "an ancient scroll",
  description: "A yellowed scroll covered in mysterious runes",
  itemType: "quest",
  cost: 0,
  movable: true
}
```

**Scenery (Non-Movable)**
```javascript
{
  id: "fountain",
  name: "a stone fountain",
  description: "Water burbles from a carved stone fountain",
  itemType: "scenery",
  movable: false,
  cost: 0
}
```

### Item Balance Guidelines

**Weapon Damage by Level:**
- Level 1-3: 2-4 damage
- Level 4-6: 5-8 damage
- Level 7-10: 9-12 damage
- Level 11+: 13-20 damage

**Healing Potions:**
- Minor: 20 HP, 15 gold
- Normal: 50 HP, 25 gold
- Greater: 100 HP, 50 gold
- Superior: 200 HP, 100 gold

**Pricing Formula:**
- Weapons: 10 gold per damage point
- Armor: 15 gold per defense point (future)
- Consumables: 0.5 gold per HP healed
- Treasure: Whatever makes sense for rarity

### Weather Protection Items

For the weather system to work, add protection values:

**Raincoat:**
```json
{
  "weatherProtection": {
    "rainy": 0.9,
    "stormy": 0.7,
    "cold": 0.2
  }
}
```

**Warm Cloak:**
```json
{
  "weatherProtection": {
    "cold": 0.8,
    "snowy": 0.7,
    "freezing": 0.85
  }
}
```

See `data/weather-items-example.json` for more examples.

### Ranged Weapons & Throwing

**NEW FEATURE**: The game now supports ranged combat with bows, crossbows, slings, and throwing weapons!

#### Ranged Weapon Properties

**Required Properties:**
- `isRanged: true` - Marks this as a ranged weapon
- `weaponDamage: X` - Damage dealt per shot
- `ammoType: "arrow"` - Type of ammunition required ("arrow", "bolt", "stone")
- `range: 1` - How far it can shoot (0=same room, 1=adjacent, 2=two rooms away)
- `weaponType: "ranged"` - Weapon category

**Example Bow:**
```json
{
  "id": "bow",
  "name": "a wooden longbow",
  "description": "A reliable ranged weapon made from flexible yew wood",
  "isWeapon": true,
  "isRanged": true,
  "weaponType": "ranged",
  "weaponDamage": 8,
  "ammoType": "arrow",
  "range": 1,
  "cost": 50,
  "movable": true,
  "itemType": "normal",
  "aliases": ["longbow", "bow"]
}
```

**Example Crossbow:**
```json
{
  "id": "crossbow",
  "name": "a heavy crossbow",
  "description": "A powerful mechanical ranged weapon",
  "isWeapon": true,
  "isRanged": true,
  "weaponType": "ranged",
  "weaponDamage": 10,
  "ammoType": "bolt",
  "range": 1,
  "cost": 75,
  "movable": true,
  "itemType": "normal"
}
```

**Example Sling:**
```json
{
  "id": "sling",
  "name": "a leather sling",
  "description": "A simple but effective ranged weapon",
  "isWeapon": true,
  "isRanged": true,
  "weaponType": "ranged",
  "weaponDamage": 4,
  "ammoType": "stone",
  "range": 1,
  "cost": 10,
  "movable": true,
  "itemType": "normal"
}
```

#### Ammunition Properties

**Required Properties:**
- `isAmmunition: true` - Marks this as ammunition
- `ammoFor: "bow"` - Which weapon ID it's for
- `quantity: 20` - How many shots (consumed one at a time)
- `itemType: "ammunition"` - Category

**Example Arrows:**
```json
{
  "id": "arrows",
  "name": "a bundle of arrows",
  "description": "Twenty well-crafted arrows with steel tips",
  "isAmmunition": true,
  "ammoFor": "bow",
  "quantity": 20,
  "cost": 10,
  "movable": true,
  "itemType": "ammunition",
  "aliases": ["arrow", "arrows", "bundle of arrows"]
}
```

**Example Crossbow Bolts:**
```json
{
  "id": "bolts",
  "name": "a quiver of crossbow bolts",
  "description": "Twenty heavy bolts for a crossbow",
  "isAmmunition": true,
  "ammoFor": "crossbow",
  "quantity": 20,
  "cost": 15,
  "movable": true,
  "itemType": "ammunition"
}
```

#### Throwable Weapons

Any item can be thrown! But weapons with `isThrowable: true` deal better damage.

**Example Throwable Spear:**
```json
{
  "id": "spear",
  "name": "a sturdy spear",
  "description": "A versatile weapon good for both melee and throwing",
  "isWeapon": true,
  "weaponType": "melee",
  "weaponDamage": 6,
  "isThrowable": true,
  "throwDamage": 8,
  "cost": 30,
  "movable": true,
  "itemType": "normal"
}
```

**Example Throwing Dagger:**
```json
{
  "id": "dagger",
  "name": "a throwing dagger",
  "description": "A balanced blade perfect for throwing",
  "isWeapon": true,
  "weaponType": "melee",
  "weaponDamage": 4,
  "isThrowable": true,
  "throwDamage": 5,
  "cost": 20,
  "movable": true,
  "itemType": "normal"
}
```

#### How Players Use Ranged Weapons

**Shooting:**
```
shoot [target]              - Shoot at target in same room or adjacent
shoot goblin                - Shoots the goblin
shoot guard with crossbow   - Specify weapon if you have multiple
```

**Throwing:**
```
throw [item] at [target]    - Throw any item at a target
throw spear at dragon       - Throws your spear
throw dagger at thief       - Throws a dagger
```

#### Ranged Combat Mechanics

**Range System:**
- `range: 0` - Same room only
- `range: 1` - Same room + adjacent rooms (through exits)
- `range: 2` - Up to 2 rooms away

**Ammunition Consumption:**
- Each shot consumes 1 ammunition
- Ammunition with `quantity > 1` decreases by 1
- When quantity reaches 0, item is removed from inventory
- No ammunition = can't shoot

**Throwing Mechanics:**
- Thrown items are removed from inventory
- Items land in the target's room on the floor
- Throw damage uses DEX instead of STR
- Thrown items can be picked up again
- Throwing range is fixed at 1 (adjacent rooms)

**Combat Differences:**
- Ranged attacks don't trigger counter-attacks
- Throwing deals slightly less XP than melee (80%)
- Can attack monsters/players in adjacent rooms
- Messages broadcast to both rooms if different

#### Ranged Weapon Balance

**Damage Guidelines:**
- Sling: 3-5 damage (cheap, low damage)
- Bow: 6-9 damage (moderate cost, good damage)
- Crossbow: 9-12 damage (expensive, high damage)
- Throwing weapons: Similar to melee but consumable

**Ammunition Pricing:**
- Stones: 5 gold for 30 (cheapest)
- Arrows: 10 gold for 20 (moderate)
- Bolts: 15 gold for 20 (expensive)

**Range vs Damage Tradeoff:**
- Higher range = Lower damage (for balance)
- Range 1 is standard
- Range 2 should have 20-30% less damage
- Range 0 (no advantage) = higher damage OK

**Advantages of Ranged:**
- Attack from safety (adjacent rooms)
- No counter-attacks from monsters
- Can kite enemies between rooms

**Disadvantages of Ranged:**
- Requires ammunition (recurring cost)
- Throwing consumes the weapon
- Still can be dodged
- Need inventory space for ammo

#### Tips for Building Ranged Content

1. **Always Pair Weapons with Ammo**: If you add a bow to a room, add arrows too!

2. **Shop Setup**: Weapon merchants should sell both weapons AND ammunition

3. **Monster Drops**: Consider having archers/rangers drop ammunition

4. **Quest Rewards**: Giving unlimited arrows as a quest reward is powerful!

5. **Room Design**: Long corridors or keeps with arrow slits make sense for ranged combat

6. **NPC Archers**: Create archer NPCs who sell specialized ammunition

7. **Special Ammunition**: Consider adding magic arrows, fire arrows, etc. (future feature)

**Example Shop NPC:**
```javascript
{
  id: "fletcher",
  name: "Gareth the Fletcher",
  shortName: "Gareth",
  description: "A skilled bowyer and arrow-maker",
  dialogue: ["I sell the finest bows and arrows!", "Quality craftsmanship guaranteed!"],
  useAI: false,
  shop: ["bow", "crossbow", "arrows", "bolts", "sling", "stones"]
}
```

---

## Creating NPCs

### NPC Structure

```javascript
{
  id: "npc_id",
  name: "Full Name",
  shortName: "Display Name",
  description: "What players see",
  dialogue: ["Response 1", "Response 2"],
  useAI: false,
  canFight: false,
  shop: ["item1", "item2"],
  triggers: { "keyword": "itemId" }
}
```

### NPC Types

**1. Simple Talking NPCs**
```javascript
{
  id: "barkeep",
  name: "Bram the Barkeeper",
  shortName: "Bram",
  description: "A burly man with a friendly smile",
  dialogue: [
    "Welcome to the Coach and Horses!",
    "What can I get you?",
    "We have the finest ale in the realm."
  ],
  useAI: false
}
```

**2. Shop NPCs**
```javascript
{
  id: "blacksmith",
  name: "Grok the Blacksmith",
  shortName: "Grok",
  description: "A muscular dwarf covered in soot",
  dialogue: ["Looking for quality weapons?"],
  shop: ["iron_sword", "steel_sword", "leather_armor"],
  useAI: false
}
```

**3. AI-Powered NPCs**
```javascript
{
  id: "wise_elder",
  name: "Elder Theron",
  shortName: "Theron",
  description: "An ancient elf with knowing eyes",
  dialogue: [
    "You are Elder Theron, a 500-year-old elf wizard who has seen the rise and fall of kingdoms. You speak in a wise, measured tone and often reference historical events. You're helpful but cryptic."
  ],
  useAI: true,
  triggers: {
    "help": "magic_scroll",
    "quest": "ancient_map"
  }
}
```

### Step-by-Step NPC Creation

1. **Open Admin Panel → NPCs Tab**

2. **Click "New NPC"**

3. **Fill Basic Info:**
   - **NPC ID**: `town_guard`
   - **Full Name**: `Captain Marcus of the Town Guard`
   - **Short Name**: `Marcus` (shown in room)
   - **Description**: `A stern-looking guard in polished armor`

4. **Add Dialogue:**

   **For Simple NPCs:**
   ```json
   [
     "Halt! State your business.",
     "The town is safe under our watch.",
     "Move along, citizen."
   ]
   ```

   **For AI NPCs:**
   ```json
   [
     "You are Marcus, captain of the town guard. You are professional, protective of citizens, and suspicious of strangers. You have 20 years of military experience and take your duty seriously."
   ]
   ```
   - AI NPCs need only ONE dialogue entry: the personality prompt

5. **Set AI Mode:**
   - **Use AI**: Check box if this is an AI NPC
   - Leave unchecked for random dialogue responses

6. **Add Shop Inventory (optional):**
   ```json
   ["health_potion", "iron_sword", "rope", "torch"]
   ```

7. **Add Item Triggers (AI NPCs only, JSON):**
   ```json
   {
     "help": "quest_item",
     "magic": "spell_scroll",
     "gold": "treasure_map"
   }
   ```
   - When player says trigger word, AI gives that item

8. **Click "Save NPC"**

### NPC Dialogue Tips

**Simple NPCs:**
- Write 3-10 responses
- Vary the tone (friendly, grumpy, mysterious)
- Include hints about quests or locations
- Reference the NPC's role/personality

**AI NPCs:**
- Write detailed personality description
- Include background, motivations, speech patterns
- Mention knowledge areas
- Set boundaries (what they will/won't do)

**Good AI Prompt:**
> "You are Elara, a mysterious fortune teller who sees glimpses of the future. You speak in riddles and metaphors. You're genuinely trying to help but can't give direct answers due to the laws of fate. You have knowledge of ancient prophecies and local legends."

**Bad AI Prompt:**
> "You are a fortune teller."

### Shop NPCs

Place shop NPCs in safe areas (towns, taverns).

**Merchants:**
- General goods (rope, torch, food)
- Healing potions
- Basic equipment

**Blacksmiths:**
- Weapons
- Armor
- Repair services (future)

**Magic Shops:**
- Spell scrolls
- Magic items
- Alchemy ingredients

**Trainers:**
- Class-specific items
- Skill books (future)
- Special equipment

### NPC Placement

**Don't Overcrowd:**
- 1-3 NPCs per room maximum
- Spread important NPCs across zones

**Strategic Placement:**
- Quest givers near starting area
- Shops in central hubs
- Rare NPCs in hard-to-reach locations

**Multiple Locations:**
- Same NPC can appear in multiple rooms (merchants travel)
- Use different NPC IDs for each instance

---

## Creating Monsters

### Monster Structure

```javascript
{
  id: "monster_id",
  name: "Display Name",
  description: "What players see",
  maxHp: 50,
  maxAtk: 10,
  def: 5,
  xp: 100,
  gold: 25,
  itemDrop: "item_id",
  newsworthy: false
}
```

### Step-by-Step Monster Creation

1. **Open Admin Panel → Monsters Tab**

2. **Click "New Monster"**

3. **Fill Basic Info:**
   - **Monster ID**: `forest_wolf`
   - **Name**: `a forest wolf`
   - **Description**: `A lean gray wolf with hungry eyes`

4. **Set Combat Stats:**
   - **Max HP**: `30` (how much damage to kill)
   - **Max Attack**: `8` (damage range 0-8)
   - **Defense**: `3` (damage reduction)

5. **Set Rewards:**
   - **XP**: `50` (experience gained)
   - **Gold**: `10` (gold dropped)

6. **Item Drop (optional):**
   - **Item Drop ID**: `wolf_pelt`
   - Leave empty for no item drop

7. **Newsworthy (optional):**
   - Check if killing this should broadcast to all players
   - Use for bosses or rare monsters

8. **Click "Save Monster"**

### Monster Balance by Level

**Level 1-2 (Starter Zone):**
```javascript
{
  id: "rat",
  name: "a giant rat",
  maxHp: 15,
  maxAtk: 3,
  def: 1,
  xp: 10,
  gold: 2
}
```

**Level 3-5 (Beginner):**
```javascript
{
  id: "goblin",
  name: "a goblin warrior",
  maxHp: 40,
  maxAtk: 8,
  def: 3,
  xp: 50,
  gold: 15
}
```

**Level 6-8 (Intermediate):**
```javascript
{
  id: "orc",
  name: "an orc raider",
  maxHp: 80,
  maxAtk: 15,
  def: 8,
  xp: 150,
  gold: 40
}
```

**Level 9-12 (Advanced):**
```javascript
{
  id: "troll",
  name: "a cave troll",
  maxHp: 150,
  maxAtk: 25,
  def: 15,
  xp: 300,
  gold: 100
}
```

**Boss Monsters:**
```javascript
{
  id: "dragon",
  name: "an ancient red dragon",
  maxHp: 500,
  maxAtk: 50,
  def: 30,
  xp: 1000,
  gold: 500,
  itemDrop: "dragon_scale",
  newsworthy: true
}
```

### Monster Types

**Trash Mobs** (Common, respawn quickly)
- Low HP, low damage
- Fast respawn (2-5 minutes)
- Small gold drops
- Place in groups

**Elite Mobs** (Uncommon, moderate challenge)
- Medium HP, good damage
- Medium respawn (10-15 minutes)
- Decent rewards
- Special item drops

**Rare Spawns** (Uncommon spawn)
- High HP, high damage
- Long respawn (30-60 minutes)
- Rare item drops
- Newsworthy kills

**Boss Monsters** (Unique, very challenging)
- Very high HP, very high damage
- Very long respawn (2-24 hours)
- Guaranteed rare drops
- Always newsworthy

### Monster Placement

In room monster spawns:

```json
[
  { "monsterId": "goblin", "respawnTime": 300000 },
  { "monsterId": "goblin", "respawnTime": 300000 },
  { "monsterId": "goblin_shaman", "respawnTime": 600000 }
]
```

**Spawn Guidelines:**
- 1-3 monsters per room
- Mix weak and strong
- Longer respawn for stronger monsters
- Boss monsters should have unique rooms

### Monster Descriptions

**Good:**
- Mention appearance
- Hint at danger level
- One sentence

**Examples:**
- "A small goblin with beady eyes and a rusty dagger."
- "A massive troll, its hide covered in scars and moss."
- "An ancient dragon, its scales gleaming like molten gold."

---

## Creating Character Classes

### Class Structure

```javascript
{
  id: "class_id",
  name: "Class Name",
  description: "Brief description",
  startingHP: 100,
  hpPerLevel: 10,
  startingMP: 50,
  mpPerLevel: 5,
  abilities: ["Ability 1", "Ability 2"],
  startingStats: {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10
  }
}
```

### Step-by-Step Class Creation

1. **Open Admin Panel → Classes Tab**

2. **Click "New Class"**

3. **Fill Basic Info:**
   - **Class ID**: `warrior`
   - **Class Name**: `Warrior`
   - **Description**: `A mighty fighter skilled in melee combat`

4. **Set Starting Stats:**
   - **Starting HP**: `120`
   - **HP Per Level**: `15`
   - **Starting MP**: `20`
   - **MP Per Level**: `2`

5. **Set Attributes (JSON):**
   ```json
   {
     "str": 14,
     "dex": 10,
     "con": 13,
     "int": 8,
     "wis": 9,
     "cha": 10
   }
   ```

6. **Add Abilities (JSON array):**
   ```json
   [
     "Power Strike",
     "Shield Block",
     "Battle Cry"
   ]
   ```

7. **Click "Save Class"**

### Example Classes

**Warrior (Tank/Melee DPS)**
```javascript
{
  id: "warrior",
  name: "Warrior",
  description: "A mighty fighter skilled in melee combat",
  startingHP: 120,
  hpPerLevel: 15,
  startingMP: 20,
  mpPerLevel: 2,
  startingStats: {
    str: 14,
    dex: 10,
    con: 13,
    int: 8,
    wis: 9,
    cha: 10
  },
  abilities: ["Power Strike", "Shield Block", "Battle Cry"]
}
```

**Wizard (Ranged DPS/Caster)**
```javascript
{
  id: "wizard",
  name: "Wizard",
  description: "A master of arcane magic",
  startingHP: 60,
  hpPerLevel: 6,
  startingMP: 100,
  mpPerLevel: 10,
  startingStats: {
    str: 8,
    dex: 10,
    con: 9,
    int: 15,
    wis: 13,
    cha: 9
  },
  abilities: ["Fireball", "Ice Shield", "Teleport"]
}
```

**Rogue (High DPS/Stealth)**
```javascript
{
  id: "rogue",
  name: "Rogue",
  description: "A cunning thief skilled in stealth and deception",
  startingHP: 80,
  hpPerLevel: 10,
  startingMP: 40,
  mpPerLevel: 4,
  startingStats: {
    str: 10,
    dex: 15,
    con: 10,
    int: 12,
    wis: 9,
    cha: 11
  },
  abilities: ["Backstab", "Sneak", "Pick Lock"]
}
```

**Cleric (Healer/Support)**
```javascript
{
  id: "cleric",
  name: "Cleric",
  description: "A devout priest with healing powers",
  startingHP: 90,
  hpPerLevel: 11,
  startingMP: 80,
  mpPerLevel: 8,
  startingStats: {
    str: 10,
    dex: 9,
    con: 12,
    int: 11,
    wis: 14,
    cha: 12
  },
  abilities: ["Heal", "Divine Protection", "Turn Undead"]
}
```

### Class Balance Guidelines

**Total Attribute Points:** 64
- Distribute across 6 attributes
- Primary stat: 14-15
- Secondary stats: 12-13
- Weak stats: 8-10

**HP Scaling:**
- Tank classes: 120 + 15/level
- Melee DPS: 100 + 12/level
- Ranged/Caster: 80 + 8/level
- Caster (fragile): 60 + 6/level

**MP Scaling:**
- Heavy casters: 100 + 10/level
- Medium casters: 60 + 6/level
- Light magic: 40 + 4/level
- Non-magic: 20 + 2/level

---

## Creating Spells

### Spell Structure

```javascript
{
  id: "spell_id",
  name: "Spell Name",
  description: "What the spell does",
  manaCost: 20,
  damage: 30,
  healing: 0,
  school: "evocation",
  level: 1,
  cooldown: 0
}
```

### Step-by-Step Spell Creation

1. **Open Admin Panel → Spells Tab**

2. **Click "New Spell"**

3. **Fill Basic Info:**
   - **Spell ID**: `fireball`
   - **Spell Name**: `Fireball`
   - **Description**: `Hurls a ball of flame at your enemy`

4. **Set Spell Properties:**
   - **Mana Cost**: `25`
   - **Damage**: `35` (if attack spell)
   - **Healing**: `0` (or healing amount)
   - **School**: `evocation` (or other school)
   - **Level**: `3` (level required to learn)

5. **Cooldown (optional):**
   - **Cooldown**: `5000` (milliseconds, 0 = no cooldown)

6. **Click "Save Spell"**

### Spell Schools

- **Evocation**: Direct damage (fireball, lightning)
- **Conjuration**: Summoning (summon creature)
- **Abjuration**: Protection (shield, dispel)
- **Necromancy**: Life/death (drain life, animate dead)
- **Enchantment**: Mind control (charm, sleep)
- **Illusion**: Deception (invisibility, disguise)
- **Transmutation**: Transformation (polymorph, haste)
- **Divination**: Knowledge (detect magic, scry)

### Example Spells

**Damage Spells:**
```javascript
{
  id: "magic_missile",
  name: "Magic Missile",
  description: "Launches magical projectiles at your target",
  manaCost: 15,
  damage: 20,
  school: "evocation",
  level: 1
}

{
  id: "fireball",
  name: "Fireball",
  description: "Hurls a ball of flame at your enemy",
  manaCost: 30,
  damage: 50,
  school: "evocation",
  level: 5
}
```

**Healing Spells:**
```javascript
{
  id: "heal",
  name: "Heal",
  description: "Restores health to yourself or an ally",
  manaCost: 20,
  healing: 40,
  school: "conjuration",
  level: 2
}

{
  id: "greater_heal",
  name: "Greater Heal",
  description: "Powerful healing magic",
  manaCost: 50,
  healing: 100,
  school: "conjuration",
  level: 8
}
```

**Utility Spells:**
```javascript
{
  id: "teleport",
  name: "Teleport",
  description: "Instantly transport to a known location",
  manaCost: 40,
  school: "conjuration",
  level: 7
}
```

### Spell Balance

**Damage Efficiency:**
- Damage per Mana ≈ 1.5 to 2.0
- Level 1 spell: 15 mana, 25 damage
- Level 5 spell: 30 mana, 50 damage
- Level 10 spell: 50 mana, 85 damage

**Healing Efficiency:**
- Healing per Mana ≈ 2.0 to 2.5
- Level 2 spell: 20 mana, 40 healing
- Level 5 spell: 35 mana, 75 healing
- Level 10 spell: 60 mana, 140 healing

---

## Creating Quests

### Quest Structure

```javascript
{
  id: "quest_id",
  name: "Quest Name",
  description: "Quest description",
  giver: "npc_id",
  objectives: [
    { type: "kill", target: "goblin", count: 5 },
    { type: "collect", item: "herb", count: 3 },
    { type: "talk", npc: "elder" }
  ],
  rewards: {
    xp: 500,
    gold: 100,
    items: ["magic_sword"]
  },
  levelRequired: 5
}
```

### Step-by-Step Quest Creation

1. **Open Admin Panel → Quests Tab**

2. **Click "New Quest"**

3. **Fill Basic Info:**
   - **Quest ID**: `goblin_menace`
   - **Quest Name**: `The Goblin Menace`
   - **Description**: `Goblins are raiding the nearby farms. Slay 10 goblins to protect the village.`
   - **Quest Giver**: `town_guard` (NPC ID)

4. **Set Requirements:**
   - **Level Required**: `3`
   - **Prerequisites**: `["previous_quest_id"]` (optional)

5. **Add Objectives (JSON):**
   ```json
   [
     { "type": "kill", "target": "goblin", "count": 10 },
     { "type": "return", "npc": "town_guard" }
   ]
   ```

6. **Set Rewards (JSON):**
   ```json
   {
     "xp": 300,
     "gold": 75,
     "items": ["iron_sword"]
   }
   ```

7. **Click "Save Quest"**

### Quest Objective Types

**Kill Objectives:**
```json
{ "type": "kill", "target": "goblin", "count": 10 }
```

**Collection Objectives:**
```json
{ "type": "collect", "item": "wolf_pelt", "count": 5 }
```

**Talk Objectives:**
```json
{ "type": "talk", "npc": "elder" }
```

**Location Objectives:**
```json
{ "type": "visit", "room": "ancient_temple" }
```

**Return Objective:**
```json
{ "type": "return", "npc": "quest_giver" }
```

### Quest Types

**Kill Quests** (Combat)
```javascript
{
  id: "rat_problem",
  name: "The Rat Problem",
  description: "The tavern cellar is infested with rats. Kill 5 rats.",
  giver: "barkeep",
  objectives: [
    { type: "kill", target: "rat", count: 5 },
    { type: "return", npc: "barkeep" }
  ],
  rewards: { xp: 100, gold: 25 },
  levelRequired: 1
}
```

**Collection Quests** (Gathering)
```javascript
{
  id: "herb_gathering",
  name: "Medicinal Herbs",
  description: "Gather 3 healing herbs from the forest.",
  giver: "healer",
  objectives: [
    { type: "collect", item: "healing_herb", count: 3 },
    { type: "return", npc: "healer" }
  ],
  rewards: { xp: 150, gold: 30, items: ["health_potion"] },
  levelRequired: 2
}
```

**Delivery Quests** (Transport)
```javascript
{
  id: "urgent_message",
  name: "Urgent Message",
  description: "Deliver this sealed letter to the captain in the next town.",
  giver: "messenger",
  objectives: [
    { type: "talk", npc: "captain" },
    { type: "return", npc: "messenger" }
  ],
  rewards: { xp: 200, gold: 50 },
  levelRequired: 3
}
```

**Exploration Quests** (Discovery)
```javascript
{
  id: "ancient_ruins",
  name: "Explore the Ancient Ruins",
  description: "Find and explore the ancient ruins to the east.",
  giver: "scholar",
  objectives: [
    { type: "visit", room: "ancient_ruins" },
    { type: "return", npc: "scholar" }
  ],
  rewards: { xp: 300, gold: 100, items: ["ancient_artifact"] },
  levelRequired: 5
}
```

### Quest Chains

Link quests together with prerequisites:

**Part 1:**
```javascript
{
  id: "investigate_goblins",
  name: "Investigate the Goblins",
  objectives: [
    { type: "kill", target: "goblin", count: 3 }
  ]
}
```

**Part 2:**
```javascript
{
  id: "goblin_lair",
  name: "Find the Goblin Lair",
  prerequisites: ["investigate_goblins"],
  objectives: [
    { type: "visit", room: "goblin_cave" }
  ]
}
```

**Part 3:**
```javascript
{
  id: "goblin_king",
  name: "Defeat the Goblin King",
  prerequisites: ["goblin_lair"],
  objectives: [
    { type: "kill", target: "goblin_king", count: 1 }
  ]
}
```

### Quest Rewards

**By Level:**
- Level 1-3: 50-150 XP, 10-50 gold
- Level 4-6: 200-400 XP, 50-150 gold
- Level 7-10: 500-800 XP, 150-300 gold
- Level 11+: 1000+ XP, 300+ gold

**Item Rewards:**
- Common: Basic gear
- Uncommon: Enhanced gear
- Rare: Unique items
- Legendary: Exclusive quest rewards

---

## Creating Guilds

### Guild Structure

```javascript
{
  id: "guild_id",
  name: "Guild Name",
  description: "Guild description",
  leader: "player_id",
  members: ["player1", "player2"],
  level: 1,
  xp: 0,
  perks: {
    expBonus: 10,
    goldBonus: 5
  }
}
```

### Step-by-Step Guild Creation

1. **Open Admin Panel → Guilds Tab**

2. **Click "New Guild"**

3. **Fill Basic Info:**
   - **Guild ID**: `warriors_guild`
   - **Guild Name**: `Warriors of Light`
   - **Description**: `A brotherhood of honorable warriors`
   - **Guild Leader**: `player_user_id`

4. **Set Initial Values:**
   - **Level**: `1`
   - **XP**: `0`
   - **Members**: `[]` (will populate as players join)

5. **Set Perks (JSON):**
   ```json
   {
     "expBonus": 10,
     "goldBonus": 5,
     "healthBonus": 50
   }
   ```

6. **Click "Save Guild"**

### Guild Perks

Available perks guilds can have:

- **expBonus**: `10` (10% more XP for all members)
- **goldBonus**: `5` (5% more gold)
- **healthBonus**: `50` (50 extra max HP)
- **damageBonus**: `5` (5% more damage)

### Guild Management

**Admin Commands:**
- `createguild <name>` - Create new guild
- `disbandguild <name>` - Remove guild
- `setguildleader <guild> <player>` - Change leader

**Player Commands:**
- `guild create <name>` - Create guild (costs gold)
- `guild invite <player>` - Invite player
- `guild accept` - Accept invitation
- `guild leave` - Leave guild
- `guild info` - View guild details

---

## Advanced Features

### Weather System

The weather system affects outdoor gameplay.

**Enable Weather:**
1. Weather is already implemented (see `js/weather.js`)
2. Update rooms with `isIndoor` property
3. Create weather protection items

**Set Weather (Admin):**
```
setweather sunny
setweather rainy
setweather stormy
setweather snowy
```

**Weather Types:**
- `sunny` - Normal conditions
- `cloudy` - Overcast
- `rainy` - Players get wet, lose 1 HP/2 min
- `snowy` - Players get cold, movement penalty
- `stormy` - Dangerous, lightning strikes
- `foggy` - Low visibility
- `hot` - Heat exhaustion
- `cold` - Freezing conditions

### Death & Graveyard System

**Player Death Options:**

When a player level 10+ dies, they choose:
1. **Respawn** - Return to start, lose inventory and 10% gold
2. **Permadeath** - Character deleted, gravestone created

**Commands:**
- `epitaph <text>` - Set gravestone message (level 10+)
- `respawn` - Choose to respawn after death
- `permadeath confirm` - Permanently delete character

**Create Graveyard:**
1. Admin Panel → Rooms
2. Create room with ID: `graveyard`
3. Add atmospheric description
4. Connect to world

### Trading System

**Player Commands:**
- `trade <player>` - Initiate trade
- `trade accept` - Accept trade offer
- `trade offer <item>` <player>` - Offer item
- `trade cancel` - Cancel trade

### Party System

**Party Commands:**
- `party create` - Create party
- `party invite <player>` - Invite to party
- `party join` - Accept invitation
- `party leave` - Leave party
- `party kick <player>` - Remove member (leader only)
- `party info` - View party details

### Combat System

**Enhanced Combat:**
- Attribute-based damage calculation
- Critical hits (based on stats)
- Dodge chance (Dexterity based)
- Armor system (future)

**Verbose Combat:**
- Detailed attack descriptions
- Hit location messages
- Critical hit announcements

### MySQL Backend

**Benefits:**
- Self-hosted data
- No Firebase costs for static content
- Real-time admin collaboration
- SQL queries for analytics

**Setup:**
See `PHP_MYSQL_SETUP.md` for complete guide.

---

## Testing & Balancing

### Before Launch

**Test Every Room:**
- [ ] All exits work both ways
- [ ] Descriptions are clear
- [ ] Items can be picked up
- [ ] NPCs respond correctly
- [ ] Monster spawns work

**Test Combat:**
- [ ] Monsters spawn correctly
- [ ] Combat damage is balanced
- [ ] Loot drops properly
- [ ] XP rewards feel fair

**Test NPCs:**
- [ ] Dialogue triggers correctly
- [ ] Shops sell items
- [ ] AI NPCs respond naturally
- [ ] Quest givers work

**Test Quests:**
- [ ] Objectives track correctly
- [ ] Rewards are granted
- [ ] Prerequisites work
- [ ] Quest chains flow logically

### Balance Testing

**Player Progression:**
- Level 1-5: Should take 1-2 hours
- Level 5-10: Should take 3-5 hours
- Level 10-15: Should take 5-10 hours

**Monster Difficulty:**
- Player should kill 3-5 monsters of their level to level up
- Boss monsters should be challenging but possible
- Trash mobs should die in 2-3 hits

**Economy:**
- Healing potion should cost ~10% of level-appropriate gold
- Weapons should be expensive but obtainable
- Players shouldn't hoard gold (create gold sinks)

### Player Feedback

**Watch for:**
- Rooms that confuse players (add clearer exits)
- Monsters that are too hard/easy (adjust stats)
- Quests that get stuck (fix objectives)
- Items that are never used (rebalance or remove)

---

## Common Patterns

### Starter Zone Design

```
[Town Square] (safe, NPCs, shops)
     |
[Forest Path] (easy monsters)
     |
[Forest Clearing] (moderate monsters)
     |
[Cave Entrance] (harder monsters)
     |
[Deep Cave] (boss monster)
```

### Hub & Spoke Design

```
        [North Zone]
              |
[West Zone]--[Hub]--[East Zone]
              |
        [South Zone]
```

### Progressive Difficulty

**Zone 1 (Levels 1-3):**
- Rats, bats, weak goblins
- Basic equipment
- Tutorial quests

**Zone 2 (Levels 4-6):**
- Wolves, goblins, bandits
- Better equipment
- Story quests

**Zone 3 (Levels 7-10):**
- Orcs, trolls, undead
- Magic items
- Challenging quests

**Zone 4 (Levels 11+):**
- Dragons, demons, powerful foes
- Legendary items
- Epic quests

### Quest Flow Patterns

**Linear Quest Chain:**
Quest 1 → Quest 2 → Quest 3 → Finale

**Branching Quests:**
```
      Quest 1
      /     \
Quest 2A   Quest 2B
      \     /
      Quest 3
```

**Hub Quests:**
```
    Quest 1
    Quest 2
    Quest 3  → All → Finale
    Quest 4
    Quest 5
```

---

## Troubleshooting

### Players Can't Move

**Problem:** Exits not working

**Solutions:**
- Check exits are bidirectional
- Verify room IDs match exactly
- Look for typos in exit definitions

### Items Won't Pick Up

**Problem:** Items can't be taken

**Solutions:**
- Ensure `movable: true`
- Check item ID matches exactly
- Verify item is in room's items array

### NPCs Not Talking

**Problem:** NPC dialogue doesn't trigger

**Solutions:**
- Verify NPC ID in room matches NPC definition
- Check dialogue array isn't empty
- For AI NPCs, ensure Gemini API key is set

### Monsters Not Spawning

**Problem:** Rooms don't have monsters

**Solutions:**
- Check `monsterSpawns` array syntax
- Verify monster ID exists
- Check respawnTime is in milliseconds
- Look for errors in console

### Quests Not Tracking

**Problem:** Objectives don't update

**Solutions:**
- Verify objective type is correct
- Check target/item IDs match exactly
- Ensure quest is in player's quest log
- Check for typos in quest objectives

### AI NPCs Not Responding

**Problem:** AI dialogue doesn't work

**Solutions:**
- Verify `useAI: true` is set
- Check Gemini API key in config
- Ensure dialogue has personality prompt
- Check API quota hasn't been exceeded

### Combat Issues

**Problem:** Combat is too hard/easy

**Solutions:**
- Adjust monster HP/Attack/Defense
- Rebalance weapon damage
- Check player level progression
- Test with different classes

### Performance Issues

**Problem:** Game is slow

**Solutions:**
- Reduce number of monsters per room
- Use MySQL backend for static content
- Limit real-time Firebase listeners
- Optimize room descriptions (keep short)

---

## Quick Reference

### Essential Room Properties
```javascript
{
  id: "room_id",
  name: "Room Name",
  description: "Description text",
  exits: { "north": "other_room" },
  isIndoor: true,
  items: ["item_id"],
  npcs: ["npc_id"],
  monsterSpawns: [{ monsterId: "monster", respawnTime: 300000 }]
}
```

### Essential Item Properties
```javascript
{
  id: "item_id",
  name: "item name",
  description: "Description",
  cost: 50,
  movable: true,
  isWeapon: true,
  weaponDamage: 5
}
```

### Essential NPC Properties
```javascript
{
  id: "npc_id",
  name: "Full Name",
  shortName: "Short",
  description: "Description",
  dialogue: ["Response"],
  shop: ["item_id"]
}
```

### Essential Monster Properties
```javascript
{
  id: "monster_id",
  name: "monster name",
  maxHp: 50,
  maxAtk: 10,
  def: 5,
  xp: 100,
  gold: 25
}
```

### Admin Commands
- `setweather [type]` - Change weather
- `createguild <name>` - Create guild
- `givexp <player> <amount>` - Give XP
- `teleport <room>` - Teleport to room

### File Locations
- **Game Code**: `js/game.js`
- **Admin Code**: `js/admin.js`
- **Configuration**: `js/config.js`
- **Data**: `/data/*.json` (if using static files)
- **Documentation**: `*.md` files in root

---

## Resources

### Guides
- `README.md` - General game information
- `COMBAT_SYSTEM.md` - Combat mechanics
- `QUEST_SYSTEM.md` - Quest system details
- `GUILD_SYSTEM.md` - Guild system details
- `PARTY_SYSTEM.md` - Party system details
- `TRADING_SYSTEM.md` - Trading mechanics
- `WEATHER_SYSTEM.md` - Weather system
- `CLASS_LEVELING.md` - Class and leveling
- `PHP_MYSQL_SETUP.md` - MySQL backend setup

### Templates
- `data/weather-items-example.json` - Weather item examples
- `setup-default-world.html` - Default content creator
- `setup-default-classes.html` - Default classes
- `setup-default-spells.html` - Default spells

### Tools
- Admin Panel - In-game content editor
- Export Panel - Backup your data
- Map Visualization - See room connections

---

## Best Practices Summary

1. **Start Small**: Build 10-20 rooms before expanding
2. **Test Everything**: Play through as a player would
3. **Balance Carefully**: Test combat with different classes
4. **Write Clearly**: Descriptions should be 2-4 sentences
5. **Connect Properly**: Always make exits bidirectional
6. **Theme Consistently**: Each area should feel cohesive
7. **Reward Exploration**: Hide secrets and treasures
8. **Guide New Players**: Clear tutorial and starting quests
9. **Listen to Feedback**: Players will find issues you missed
10. **Backup Regularly**: Use Export panel or git

---

## Getting Help

### Resources
- Check console for errors (F12 in browser)
- Review `.md` documentation files
- Test in incognito mode (fresh state)
- Check Firebase Console for data issues

### Common Issues Document
See `TROUBLESHOOTING.md` for common problems and solutions.

### Community
- GitHub Issues: Report bugs or request features
- Create discussion threads for design questions

---

**Remember:** Game design is iterative. Start simple, test often, and expand based on what works!

**Have fun building your world!** 🏰⚔️🧙‍♂️
