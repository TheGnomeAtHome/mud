# Quest System Documentation

## Overview
The quest system allows players to accept quests from NPCs, complete objectives, and earn rewards. Quests can be solo or group-based (party quests), repeatable or one-time, and can have prerequisites.

## Quest Structure

### Firebase Collection
**Collection**: `/artifacts/{appId}/public/data/mud-quests/{questId}`

### Quest Data Format
```json
{
  "id": "quest-dragon-slayer",
  "title": "Slay the Dragon",
  "description": "The ancient dragon terrorizes the village. Slay it and bring proof.",
  "levelRequired": 5,
  "isRepeatable": false,
  "isPartyQuest": false,
  "giverNpcId": "village-elder",
  "turninNpcId": "village-elder",
  "objectives": [
    {
      "type": "kill",
      "target": "dragon",
      "count": 1
    },
    {
      "type": "collect",
      "item": "dragon-scale",
      "count": 5
    }
  ],
  "rewards": {
    "xp": 500,
    "gold": 100,
    "items": ["dragon-slayer-sword"]
  },
  "prerequisites": []
}
```

## Objective Types

### 1. Kill Objectives
Kill a specific monster type.
```json
{
  "type": "kill",
  "target": "goblin",
  "count": 10
}
```

### 2. Collect Objectives
Collect specific items.
```json
{
  "type": "collect",
  "item": "healing-potion",
  "count": 3
}
```

### 3. Visit Objectives
Visit a specific room.
```json
{
  "type": "visit",
  "room": "ancient-temple",
  "count": 1
}
```

### 4. Talk Objectives
Talk to a specific NPC.
```json
{
  "type": "talk",
  "npc": "wise-wizard",
  "count": 1
}
```

## Player Commands

### View Quests
- **`quests`** - Shows active quests and available quests from NPCs in current room
- **`quest progress`** or **`quest log`** - Shows detailed progress for all active quests

### Accept Quest
```
quest accept [quest name]
```
- Must be in same room as quest giver NPC
- Must meet level requirement
- Must have completed prerequisite quests
- Can't accept if already active or already completed (unless repeatable)
- **Party quests**: Any party member can accept, and all members will share progress

### Abandon Quest
```
quest abandon [quest name]
```
- Removes quest from active quests without rewards
- Can be accepted again later
```
quest abandon [quest name]
```
- Removes quest from active quests without rewards
- Can be accepted again later

### Turn In Quest
Simply **talk to the quest NPC** after completing all objectives. The quest will automatically turn in and rewards will be awarded.

## Quest Flow

### 1. Quest Availability
A quest is available if:
- Quest giver NPC is in the player's current room
- Player meets level requirement (`levelRequired`)
- Player has completed all prerequisite quests (`prerequisites`)
- Quest is not already active
- Quest has not been completed (or is repeatable)

### 2. Quest Acceptance
When player accepts a quest:
- Quest is added to `player.activeQuests` array
- Objectives are initialized with `current: 0`
- Player is notified of quest objectives

### 3. Progress Tracking
Objectives automatically update when:
- **Kill**: Player defeats a monster (tracked in combat system)
- **Collect**: Player picks up an item with `get` command
- **Visit**: Player enters a room with `go` command
- **Talk**: Player talks to an NPC with `talk` command

### 4. Quest Completion
When all objectives reach their count:
- Player is notified that objectives are complete
- Player is told to return to turn-in NPC

### 5. Quest Turn-In
When player talks to turn-in NPC after completing objectives:
- Quest is removed from `activeQuests`
- Quest ID is added to `completedQuests` (unless repeatable)
- Rewards are automatically awarded:
  - XP added to player
  - Gold added to player
  - Items added to inventory
- Level-up check is performed if XP was awarded

## Admin Panel

### Creating a Quest
1. Click **📜 Quests** tab in admin panel
2. Click **➕ New Quest** to clear form
3. Fill in quest details:
   - **Quest ID**: Unique identifier (e.g., `quest-dragon-slayer`)
   - **Quest Title**: Display name
   - **Description**: Quest story/context
   - **Level Required**: Minimum level to accept
   - **Repeatable**: Can be done multiple times?
   - **Party Quest**: Requires group? (not yet implemented)
   - **Quest Giver NPC ID**: NPC who gives the quest
   - **Turn-in NPC ID**: NPC to turn in to (defaults to giver)
   - **Objectives**: JSON array of objectives
   - **Rewards**: JSON object with xp, gold, items
   - **Prerequisites**: JSON array of quest IDs that must be completed first
4. Click **💾 Save Quest**

### Editing a Quest
1. Select quest from dropdown
2. Modify fields
3. Click **💾 Save Quest**

### Deleting a Quest
1. Select quest from dropdown
2. Click **🗑️ Delete Quest**
3. Quest will be removed from all players' active and completed quest lists

## Rewards Format

### Rewards Object
```json
{
  "xp": 500,
  "gold": 100,
  "items": ["magic-sword", "healing-potion"]
}
```

All fields are optional:
- **xp**: Experience points to award
- **gold**: Gold coins to award
- **items**: Array of item IDs to add to player's inventory

## Prerequisites

Quests can require other quests to be completed first:
```json
{
  "prerequisites": ["quest-tutorial", "quest-first-monster"]
}
```

Players must have completed ALL prerequisite quests before the quest becomes available.

## Repeatable Quests

Set `isRepeatable: true` to allow players to complete the quest multiple times. Repeatable quests:
- Can be accepted again after completion
- Are NOT added to `completedQuests` list
- Can be used for daily/weekly tasks or grinding

## Party Quests

`isPartyQuest: true` enables party quest functionality. Party quests:
- ✅ **Implemented** - Fully functional party system
- ✅ Can be accepted by any party member
- ✅ Progress is shared among ALL party members in real-time
- ✅ All party members receive full rewards when quest is completed
- ✅ Works with all objective types (kill, collect, visit, talk)
- See **PARTY_SYSTEM.md** for detailed party and party quest documentation

Example party quest:
```json
{
  "id": "quest-raid-dungeon",
  "title": "Raid the Ancient Dungeon",
  "isPartyQuest": true,
  "levelRequired": 10,
  "objectives": [
    {"type": "kill", "target": "dungeon-boss", "count": 1}
  ],
  "rewards": {
    "xp": 2000,
    "gold": 500,
    "items": ["legendary-armor"]
  }
}
```

## Integration Points

### game.js Functions
- **`updateQuestProgress(playerId, progressType, target, count)`** - Updates quest objectives (with party support)
- **`getObjectiveDescription(objective)`** - Formats objective text for display
- Quest handling in these commands:
  - `case 'quest'` / `case 'quests'` - Main quest command handler
  - `case 'attack'` - Tracks kill objectives
  - `case 'get'` - Tracks collect objectives
  - `case 'go'` - Tracks visit objectives
  - `case 'talk'` - Tracks talk objectives and handles turn-in

### admin.js Functions
- **`populateQuestSelector()`** - Fills quest dropdown
- **`loadQuestData(questId)`** - Loads quest into form
- **`clearQuestForm()`** - Clears quest form

### data-loader.js
- Loads `mud-quests` collection into `gameQuests` object
- Real-time listener updates when quests are added/modified/deleted

### ai.js Parser
Quest commands supported:
- `"quests"` → `{"action": "quests"}`
- `"quest accept dragon slayer"` → `{"action": "quest", "target": "accept", "topic": "dragon slayer"}`
- `"quest abandon dragon slayer"` → `{"action": "quest", "target": "abandon", "topic": "dragon slayer"}`
- `"quest progress"` → `{"action": "quest", "target": "progress"}`
- `"quest log"` → `{"action": "quest", "target": "log"}`

## Example Quest Scenarios

### Simple Fetch Quest
```json
{
  "id": "quest-fetch-herbs",
  "title": "Fetch Healing Herbs",
  "description": "The healer needs herbs from the forest.",
  "levelRequired": 1,
  "isRepeatable": true,
  "giverNpcId": "healer",
  "objectives": [
    {"type": "collect", "item": "healing-herb", "count": 5}
  ],
  "rewards": {
    "xp": 50,
    "gold": 25
  }
}
```

### Kill Quest
```json
{
  "id": "quest-goblin-slayer",
  "title": "Goblin Slayer",
  "description": "Clear out the goblin camp.",
  "levelRequired": 3,
  "isRepeatable": false,
  "giverNpcId": "guard-captain",
  "objectives": [
    {"type": "kill", "target": "goblin", "count": 10}
  ],
  "rewards": {
    "xp": 200,
    "gold": 50,
    "items": ["iron-sword"]
  }
}
```

### Chain Quest (with Prerequisites)
```json
{
  "id": "quest-dragon-slayer",
  "title": "Dragon Slayer",
  "description": "Only the bravest can face the dragon.",
  "levelRequired": 10,
  "isRepeatable": false,
  "giverNpcId": "king",
  "turninNpcId": "king",
  "prerequisites": ["quest-goblin-slayer", "quest-troll-hunter"],
  "objectives": [
    {"type": "kill", "target": "dragon", "count": 1},
    {"type": "collect", "item": "dragon-head", "count": 1}
  ],
  "rewards": {
    "xp": 1000,
    "gold": 500,
    "items": ["legendary-sword", "dragon-armor"]
  }
}
```

### Exploration Quest
```json
{
  "id": "quest-explore-ruins",
  "title": "Explore the Ancient Ruins",
  "description": "Discover the secrets of the lost civilization.",
  "levelRequired": 5,
  "isRepeatable": false,
  "giverNpcId": "scholar",
  "objectives": [
    {"type": "visit", "room": "ancient-temple", "count": 1},
    {"type": "visit", "room": "buried-library", "count": 1},
    {"type": "talk", "npc": "ghost-scholar", "count": 1}
  ],
  "rewards": {
    "xp": 300,
    "gold": 75,
    "items": ["ancient-tome"]
  }
}
```

## Best Practices

1. **Quest IDs**: Use descriptive IDs with `quest-` prefix (e.g., `quest-dragon-slayer`)
2. **Level Scaling**: Set appropriate level requirements for quest difficulty
3. **Reward Balance**: XP rewards should scale with quest difficulty and level requirement
4. **Quest Chains**: Use prerequisites to create story progression
5. **Objective Clarity**: Use clear, specific target names that match game entities
6. **Repeatable Quests**: Good for resource gathering, daily tasks, or grinding
7. **Turn-in NPCs**: Can be different from giver for delivery quests
8. **Testing**: Always test quest flow from accept → complete → turn-in

## Future Enhancements

- **Party Quest System**: Share progress and rewards among party members
- **Quest Timers**: Time-limited quests
- **Quest Stages**: Multi-stage quests with intermediate checkpoints
- **Quest Dialogue**: Custom NPC dialogue for quest states (available, active, complete)
- **Quest Markers**: Visual indicators for quest NPCs
- **Quest Journal UI**: Dedicated UI panel for quest tracking
- **Achievement Integration**: Quests that grant achievements
- **Quest Chains UI**: Visual representation of quest prerequisites
