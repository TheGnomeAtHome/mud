# Quest Prerequisites Guide

## Overview
The quest system supports prerequisite quests - quests that must be completed before a new quest becomes available. This is perfect for creating quest chains and progressive storylines where NPCs only mention certain quests to players who have proven themselves by completing earlier tasks.

## How It Works

When a player talks to an NPC, the game automatically:
1. Checks what quests the NPC offers
2. Filters out quests where the player hasn't completed the prerequisites
3. Only shows/mentions quests the player is eligible for
4. For AI NPCs, passes only eligible quests to the AI for natural conversation

This works for both traditional NPCs and AI-powered NPCs!

## Setting Up Prerequisites

### In the Admin Panel - Quests Tab

When creating or editing a quest, use the **`prerequisites`** field. This field accepts a **JSON array** of quest IDs that must be completed first.

#### Format:
```json
["quest-id-1", "quest-id-2", "quest-id-3"]
```

### Example Quest Chain

Let's create a 3-quest chain:

#### Quest 1: "Welcome to Town" (Starting Quest)
- **ID**: `welcome-quest`
- **Giver NPC**: Town Guard (ID: `town-guard`)
- **Prerequisites**: `[]` (empty - anyone can accept)
- **Description**: "Welcome, traveler! Help me patrol the town."

```json
{
  "id": "welcome-quest",
  "title": "Welcome to Town",
  "giverNpcId": "town-guard",
  "description": "The town guard asks you to help patrol the streets.",
  "prerequisites": [],
  "levelRequired": 1,
  "objectives": [
    {
      "type": "visit",
      "roomId": "town-square",
      "count": 1,
      "description": "Visit the town square"
    }
  ],
  "rewards": {
    "xp": 50,
    "gold": 10
  }
}
```

#### Quest 2: "The Guard's Trust" (Requires Quest 1)
- **ID**: `guard-trust-quest`
- **Giver NPC**: Town Guard (ID: `town-guard`)
- **Prerequisites**: `["welcome-quest"]`
- **Description**: "Since you helped me before, I have a more important task..."

```json
{
  "id": "guard-trust-quest",
  "title": "The Guard's Trust",
  "giverNpcId": "town-guard",
  "description": "The guard trusts you with a more important mission.",
  "prerequisites": ["welcome-quest"],
  "levelRequired": 2,
  "objectives": [
    {
      "type": "collect",
      "itemId": "stolen-goods",
      "count": 5,
      "description": "Recover stolen goods"
    }
  ],
  "rewards": {
    "xp": 100,
    "gold": 25
  }
}
```

#### Quest 3: "The Secret Mission" (Requires Quests 1 & 2)
- **ID**: `secret-mission-quest`
- **Giver NPC**: Captain (ID: `town-captain`)
- **Prerequisites**: `["welcome-quest", "guard-trust-quest"]`
- **Description**: "I heard about your work with the guard. I have a secret mission..."

```json
{
  "id": "secret-mission-quest",
  "title": "The Secret Mission",
  "giverNpcId": "town-captain",
  "description": "The captain trusts you with classified information.",
  "prerequisites": ["welcome-quest", "guard-trust-quest"],
  "levelRequired": 5,
  "objectives": [
    {
      "type": "talk",
      "npcId": "mysterious-stranger",
      "count": 1,
      "description": "Talk to the mysterious stranger"
    }
  ],
  "rewards": {
    "xp": 250,
    "gold": 100,
    "items": ["rare-dagger"]
  }
}
```

## Player Experience

### Before Completing Prerequisites

Player talks to Town Guard:
```
> talk to guard

Town Guard: "Welcome to town, traveler! We could use someone like you. I have a simple patrol task if you're interested."

[Quest Available: Welcome to Town]
Type 'quest accept welcome to town' to accept this quest.
```

Notice the second quest "The Guard's Trust" is **NOT shown** because the player hasn't completed "Welcome to Town" yet.

### After Completing First Quest

Player completes "Welcome to Town" and talks to guard again:
```
> talk to guard

Town Guard: "Excellent work on that patrol! I knew I could count on you. Now that you've proven yourself, I have something more important. Can I trust you with a sensitive matter?"

[Quest Available: The Guard's Trust]
Type 'quest accept guard trust' to accept this quest.
```

Now the second quest appears because the prerequisite was met!

### With AI NPCs

For AI-powered NPCs, the system is even more natural:

**Before prerequisites:**
```
> talk to captain

Captain is thinking...
Captain: "I don't know you yet, stranger. Speak with the town guard first and prove yourself worthy."
```

**After completing prerequisites:**
```
> talk to captain

Captain is thinking...
Captain: "Ah, you're the one the guard mentioned! He speaks highly of your work. I have a classified mission that requires someone... discreet. Interested?"

> yes

Captain: "Excellent. I need you to make contact with a mysterious stranger in the tavern..."

[Quest Available: The Secret Mission]
```

The AI naturally incorporates the quest into conversation because it was passed to the AI prompt!

## Multiple Prerequisites

You can require multiple quests to be completed:

```json
{
  "id": "master-quest",
  "prerequisites": ["quest-1", "quest-2", "quest-3", "quest-4"],
  "description": "Only the most accomplished adventurers can attempt this..."
}
```

**All** quests in the prerequisites array must be completed for the quest to become available.

## Tips for Quest Design

### 1. **Story Progression**
Use prerequisites to tell a story:
- Quest 1: Meet the NPC, do simple task
- Quest 2: Earn NPC's trust, learn about problem
- Quest 3: Solve the main problem
- Quest 4: Deal with consequences

### 2. **Reputation Building**
Create chains where NPCs reference previous accomplishments:
```
"I heard about how you helped Marcus. I could use someone reliable..."
```

### 3. **Skill Gating**
Combine prerequisites with level requirements:
```json
{
  "prerequisites": ["beginner-combat"],
  "levelRequired": 10
}
```

### 4. **Branching Paths**
Create multiple quest chains that converge:
```
Quest A1 → Quest A2 ↘
                     → Master Quest (requires both A2 and B2)
Quest B1 → Quest B2 ↗
```

### 5. **Hidden Quests**
Use prerequisites to keep advanced quests secret:
- New players only see starter quests
- As they progress, new quests "unlock"
- Creates sense of discovery

### 6. **AI NPC Integration**
For AI NPCs, the prerequisites work seamlessly:
- NPC won't mention quest if prerequisites aren't met
- NPC will naturally reference past accomplishments
- Creates more realistic conversations

## Common Patterns

### The Tutorial Chain
```json
[
  {"id": "tutorial-1", "prerequisites": []},
  {"id": "tutorial-2", "prerequisites": ["tutorial-1"]},
  {"id": "tutorial-3", "prerequisites": ["tutorial-2"]}
]
```

### The Trust System
```json
[
  {"id": "prove-yourself", "prerequisites": []},
  {"id": "minor-task", "prerequisites": ["prove-yourself"]},
  {"id": "major-task", "prerequisites": ["minor-task"]},
  {"id": "ultimate-trust", "prerequisites": ["major-task"]}
]
```

### The Investigation
```json
[
  {"id": "crime-scene", "prerequisites": []},
  {"id": "interview-witnesses", "prerequisites": ["crime-scene"]},
  {"id": "find-clues", "prerequisites": ["crime-scene"]},
  {"id": "confront-suspect", "prerequisites": ["interview-witnesses", "find-clues"]}
]
```

### The Epic Journey
```json
[
  {"id": "hear-legend", "prerequisites": []},
  {"id": "find-map", "prerequisites": ["hear-legend"]},
  {"id": "gather-supplies", "prerequisites": ["find-map"]},
  {"id": "begin-journey", "prerequisites": ["gather-supplies"]},
  {"id": "face-guardian", "prerequisites": ["begin-journey"]},
  {"id": "claim-treasure", "prerequisites": ["face-guardian"]}
]
```

## Technical Details

### How Prerequisites Are Checked

When a player talks to an NPC, the game:

1. **Gets player's completed quests** from `player.completedQuests` array
2. **Filters NPC's quests** checking:
   - Is this the right NPC? (`quest.giverNpcId === npc.id`)
   - Does player meet level requirement? (`quest.levelRequired`)
   - Is quest already active? (not in `player.activeQuests`)
   - Is quest completed and not repeatable? (not in `player.completedQuests` unless `quest.isRepeatable`)
   - **Are all prerequisites met?** (all IDs in `quest.prerequisites` are in `player.completedQuests`)
3. **Shows only eligible quests** to player or AI

### Storage Format

Prerequisites are stored as:
- **JSON array of strings** in MySQL database
- Example: `["quest-1", "quest-2"]`
- Empty array `[]` means no prerequisites

### Repeatable Quests

Repeatable quests (`isRepeatable: true`) can be accepted again even if completed, but they still:
- Require prerequisites to be met the first time
- Show up again after completion
- Add to quest completion count each time

## Troubleshooting

### Quest Not Showing Up

**Check these:**
1. ✅ Is the `giverNpcId` correct?
2. ✅ Are all prerequisite quest IDs spelled correctly?
3. ✅ Has the player completed all prerequisite quests?
4. ✅ Does the player meet the level requirement?
5. ✅ Is the quest already active or completed (if not repeatable)?

**Debug tips:**
- Open browser console (F12)
- Talk to the NPC
- Look for logs showing quest filtering
- Check player's `completedQuests` array in Firebase

### Prerequisites Not Working

**Common issues:**
1. **Wrong quest ID** - Quest IDs are case-sensitive
2. **JSON syntax error** - Must be valid JSON array: `["quest-1"]` not `[quest-1]`
3. **String instead of array** - Must be `["quest-1"]` not `"quest-1"`
4. **Typo in quest ID** - Double-check the exact ID in the quests collection

### Quest Shows Even Though Prerequisites Not Met

**Possible causes:**
1. Prerequisites field is empty or null instead of an array
2. Quest ID in prerequisites doesn't match actual quest ID
3. Player has quest marked as completed but shouldn't

## Advanced: Quest Networks

You can create complex quest networks with multiple branches:

```
        Start Quest
           / \
          /   \
      Path A  Path B
        /       \
       /         \
   Quest A1    Quest B1
      |            |
   Quest A2    Quest B2
       \          /
        \        /
      Convergence Quest (requires A2 AND B2)
              |
         Final Quest
```

This creates player choice and replayability!

## Example: Your Tomb Quest Setup

Based on your request, here's how to set it up:

**Quest 1: "The Iron Collection"**
```json
{
  "id": "iron-collection",
  "title": "Get the Iron",
  "giverNpcId": "bronson",
  "prerequisites": [],
  "description": "Bronson needs iron ore for his smithing."
}
```

**Quest 2: "The Ancient Tomb"** (only for players who helped Bronson)
```json
{
  "id": "ancient-tomb",
  "title": "The Ancient Tomb",
  "giverNpcId": "bronson",
  "prerequisites": ["iron-collection"],
  "description": "Bronson trusts you with the location of an ancient tomb containing a powerful artifact."
}
```

Now Bronson will only mention the tomb quest to players who completed the iron quest!

For an AI NPC like Bronson:
- Before iron quest: Bronson talks about needing iron
- After iron quest: Bronson says "You've proven yourself trustworthy. There's an ancient tomb..."

## Conclusion

Prerequisites are a powerful tool for:
- ✅ Creating engaging quest chains
- ✅ Progressive storytelling
- ✅ Gating content appropriately
- ✅ Making NPCs feel more realistic
- ✅ Rewarding player progression
- ✅ Creating discovery moments

Use them to make your game world feel more alive and responsive to player actions!
