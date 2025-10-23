# Quest System Features Guide

## Overview
Your MUD has a fully-featured quest system with support for multiple quest types, party quests, and repeatable quests. This guide explains how to create and use each type.

## Quest Types Supported

### 1. **Collect Quests** ✅ FULLY WORKING
Require players to gather specific items.

**Example Quest Data:**
```json
{
  "id": "iron_quest",
  "title": "Get the Iron!",
  "description": "Get me some iron from the small cave just north of the village.",
  "giverNpcId": "bronson",
  "turninNpcId": "bronson",
  "levelRequired": 1,
  "isRepeatable": true,
  "objectives": [
    {
      "type": "collect",
      "itemId": "iron_ore",
      "count": 5
    }
  ],
  "rewards": {
    "xp": 100,
    "gold": 10,
    "items": ["iron_sword", "health_potion"]
  }
}
```

**How It Works:**
- Players pick up items normally with `get` or `take` commands
- Quest tracks items in inventory AND inside containers
- When player has required amount, they talk to the turn-in NPC
- Items are automatically removed from inventory upon completion
- Works with item quantities in rooms

### 2. **Kill Quests** ✅ FULLY WORKING
Require players to defeat specific monsters.

**Example Quest Data:**
```json
{
  "id": "goblin_slayer",
  "title": "Goblin Problem",
  "description": "The goblins have been raiding our village. Defeat 10 of them!",
  "giverNpcId": "guard_captain",
  "levelRequired": 3,
  "objectives": [
    {
      "type": "kill",
      "monsterId": "goblin",
      "count": 10
    }
  ],
  "rewards": {
    "xp": 500,
    "gold": 50
  }
}
```

**How It Works:**
- Progress tracked automatically when player defeats monsters
- Supports all combat types (melee, ranged, thrown, magic)
- Quest updates immediately after monster death
- Notifies player when objectives complete

### 3. **Visit/Exploration Quests** ✅ FULLY WORKING
Require players to visit specific locations.

**Example Quest Data:**
```json
{
  "id": "explore_cave",
  "title": "Scout the Cave",
  "description": "Explore the dark cave to the north and report back.",
  "giverNpcId": "scout_master",
  "objectives": [
    {
      "type": "visit",
      "roomId": "dark_cave",
      "count": 1
    }
  ],
  "rewards": {
    "xp": 150,
    "gold": 20
  }
}
```

**How It Works:**
- Progress tracked when player enters the specified room
- Can require visiting multiple different rooms
- Useful for exploration and discovery quests

### 4. **Talk Quests** ✅ FULLY WORKING
Require players to speak with specific NPCs.

**Example Quest Data:**
```json
{
  "id": "messenger_quest",
  "title": "Deliver the Message",
  "description": "Take this message to the merchant in the market.",
  "giverNpcId": "mayor",
  "objectives": [
    {
      "type": "talk",
      "npcId": "merchant",
      "count": 1
    }
  ],
  "rewards": {
    "xp": 50,
    "gold": 5
  }
}
```

**How It Works:**
- Progress tracked when player uses `talk to [npc]` command
- Can be combined with collect quests (deliver item + talk to NPC)
- Useful for delivery and messenger quests

## Advanced Features

### Multiple Objectives
Quests can have multiple objectives of different types:

```json
{
  "objectives": [
    {
      "type": "collect",
      "itemId": "herb",
      "count": 5
    },
    {
      "type": "kill",
      "monsterId": "wolf",
      "count": 3
    },
    {
      "type": "visit",
      "roomId": "forest_clearing",
      "count": 1
    }
  ]
}
```

### Multiple Item Rewards
Quests can reward multiple items at once:

```json
{
  "rewards": {
    "xp": 1000,
    "gold": 100,
    "items": ["magic_sword", "health_potion", "mana_potion", "gold_ring"]
  }
}
```

### Party Quests
Set `"isPartyQuest": true` to make quest progress shared among party members:

```json
{
  "id": "dragon_slayer",
  "title": "Slay the Dragon",
  "isPartyQuest": true,
  "objectives": [
    {
      "type": "kill",
      "monsterId": "dragon",
      "count": 1
    }
  ],
  "rewards": {
    "xp": 5000,
    "gold": 1000
  }
}
```

**Party Quest Features:**
- All party members get quest progress updates
- All party members receive rewards when completed
- Any party member can turn in the quest

### Repeatable Quests
Set `"isRepeatable": true` to allow players to accept quest again after completion:

```json
{
  "id": "daily_herbs",
  "title": "Daily Herb Gathering",
  "isRepeatable": true,
  "objectives": [...],
  "rewards": {...}
}
```

### Prerequisites
Require completion of other quests first:

```json
{
  "id": "advanced_quest",
  "title": "Advanced Mission",
  "prerequisites": ["beginner_quest", "iron_quest"],
  "objectives": [...],
  "rewards": {...}
}
```

### Level Requirements
Restrict quests to minimum player level:

```json
{
  "id": "elite_quest",
  "title": "Elite Mission",
  "levelRequired": 10,
  "objectives": [...],
  "rewards": {...}
}
```

## Player Commands

### Natural Language Support
Players can use natural language commands:

**Quest Management:**
- `quests` - Show all active and available quests
- `quest accept iron` - Accept quest with "iron" in the name
- `accept the iron quest` - Natural language variation
- `I want to take the quest` - More natural
- `quest progress` - Show detailed progress
- `how am I doing on my quests` - Natural variation
- `quest abandon iron` - Abandon a quest
- `drop the quest` - Natural variation

**For Collect Quests:**
- `get iron` / `take iron` - Pick up items
- `grab the sword` - Natural language
- Items are counted automatically (including in containers)

**For Kill Quests:**
- `attack goblin` / `fight wolf` - Combat commands
- `kick the orc` - Verb-based combat
- Progress tracked automatically

**For Visit Quests:**
- Just move to the location normally
- `north` / `go north` / `head east` - Any movement command
- Progress tracked when entering room

**For Talk Quests:**
- `talk to merchant` - Standard command
- `speak with the blacksmith` - Natural variation
- `chat with bob` - More casual

### Quest Turn-in
- Simply talk to the quest giver/turn-in NPC when objectives are complete
- Quest completes automatically
- Rewards granted immediately
- Collect quest items are removed from inventory

## AI NPC Integration

### Quest Awareness
AI NPCs automatically know about quests they offer and mention them naturally:

**When you talk to an AI NPC with available quests:**
```
> talk to bronson

Bronson has a quest for you!
📜 Get the Iron!
  get me some iron from the small cave just north of the village.
  Type 'quest accept get the iron!' to accept this quest.
  
Bronson says, "I've got work that needs doing - need someone to 
fetch iron from the cave north of here. Pays well, it does."
```

The AI will naturally weave quest mentions into their dialogue based on their personality.

## Admin Panel Setup

### Creating Quests
1. Open the admin panel
2. Go to the "Quests" tab
3. Fill in quest details:
   - **ID**: Unique identifier (e.g., "iron_quest")
   - **Title**: Display name (e.g., "Get the Iron!")
   - **Description**: Quest text
   - **Quest Giver NPC ID**: NPC who gives the quest
   - **Turn-in NPC ID**: NPC who completes quest (optional, defaults to giver)
   - **Level Required**: Minimum level (optional)
   - **Is Repeatable**: Check if quest can be repeated
   - **Is Party Quest**: Check if progress shared with party

4. Add objectives (JSON array):
```json
[
  {
    "type": "collect",
    "itemId": "iron_ore",
    "count": 5
  }
]
```

5. Add rewards (JSON object):
```json
{
  "xp": 100,
  "gold": 10,
  "items": ["iron_sword", "health_potion"]
}
```

6. Prerequisites (optional, JSON array of quest IDs):
```json
["beginner_quest", "tutorial_complete"]
```

## Tips for Quest Design

### Collect Quests
- Use with room quantity system for renewable resources
- Set `isRepeatable: true` for daily/farming quests
- Items in containers count toward objectives

### Kill Quests
- Perfect for clearing areas or hunting bounties
- Combine with `newsworthy: true` on monsters for server-wide announcements
- Use party quests for boss encounters

### Visit Quests
- Great for exploration and unlocking new areas
- Combine with collect quests for fetch missions
- Can create quest chains leading players through world

### Talk Quests
- Perfect for story progression and dialogue
- Combine with collect for delivery quests
- Use to connect quest givers in chains

### Reward Balance
- **XP**: Usually 50-100 per quest level requirement
- **Gold**: 5-20 for low level, scale up for higher
- **Items**: Use sparingly, consider quest difficulty
- **Multiple rewards**: Use for major quest completions

## Quest Chains Example

Create interconnected quests:

**Quest 1: "Gather Supplies"**
```json
{
  "id": "gather_supplies",
  "title": "Gather Supplies",
  "objectives": [{"type": "collect", "itemId": "wood", "count": 10}],
  "rewards": {"xp": 50, "gold": 10}
}
```

**Quest 2: "Deliver the Wood" (requires Quest 1)**
```json
{
  "id": "deliver_wood",
  "title": "Deliver the Wood",
  "prerequisites": ["gather_supplies"],
  "objectives": [{"type": "talk", "npcId": "carpenter", "count": 1}],
  "rewards": {"xp": 75, "gold": 15}
}
```

**Quest 3: "Defend the Workshop" (requires Quest 2)**
```json
{
  "id": "defend_workshop",
  "title": "Defend the Workshop",
  "prerequisites": ["deliver_wood"],
  "objectives": [{"type": "kill", "monsterId": "bandit", "count": 5}],
  "rewards": {"xp": 200, "gold": 50, "items": ["iron_axe"]}
}
```

This creates a narrative progression guiding players through your world!

## Troubleshooting

### Quest not appearing?
- Check that quest giver NPC is in the room
- Verify player meets level requirement
- Check prerequisites are completed
- Ensure quest isn't already active or completed (if not repeatable)

### Progress not updating?
- For collect: Verify itemId matches exactly
- For kill: Check monsterId matches exactly
- For visit: Confirm roomId matches exactly
- For talk: Verify npcId matches exactly

### Items not being removed?
- This only happens for collect quests upon turn-in
- Items are removed from inventory AND containers
- Check that objectives use "collect" type with itemId field

### Can't accept repeatable quest again?
- Talk to the quest giver NPC again
- Check that `isRepeatable: true` is set in quest data
- Quest should appear in available quests list after completion
